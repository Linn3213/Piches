import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

/**
 * Utgångsradarn, utanför appen.
 *
 * Hela produktens kärna är att ingen förlängning ska hinna rinna ut obemärkt,
 * men radarn har hittills bara funnits INNE i appen. Den som glömde logga in
 * missade alltså precis det hon betalade för att slippa missa.
 *
 * Två utskick per licens, aldrig fler: ett när den installda framförhållningen
 * slår till, och ett sista under den avslutande veckan. Fler än så blir brus
 * som hon slutar öppna, och då är påminnelsen värdelös just den gången det
 * gäller.
 *
 * Körningen loggas ALLTID, även när den inte skickade något. Ett schemalagt
 * jobb som slutar fungera gör det tyst, och skillnaden mellan "det fanns inget
 * att skicka" och "jobbet kördes aldrig" går annars inte att se.
 */

const SISTA_VECKAN_DAGAR = 7

type Rad = {
  id: string
  user_id: string
  ends_on: string
  fee_sek: number | null
  brand_id: string | null
}

Deno.serve(async (req) => {
  // Fail-closed. Saknas hemligheten nekas allt, den slapps aldrig igenom av
  // misstag bara for att den inte hunnit konfigureras.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Ej behörig' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let hittade = 0
  let skickade = 0
  let misslyckade = 0
  let felText: string | null = null
  let smtp: SMTPClient | null = null

  try {
    const smtpUser = Deno.env.get('SMTP_USERNAME')
    const smtpPass = Deno.env.get('SMTP_PASSWORD')
    if (!smtpUser || !smtpPass) throw new Error('SMTP_USERNAME eller SMTP_PASSWORD saknas')

    const idag = new Date()
    const datum = (d: Date) => d.toISOString().slice(0, 10)

    // 1. Vilka konton far mail? Samma regel som slapper in dem i appen, alltsa
    //    aldrig nagon vars provperiod tagit slut eller vars betalning fallerat.
    const { data: abonnemang, error: abonnemangFel } = await supabase
      .from('piches_subscriptions')
      .select('user_id, status, trial_ends_on, current_period_end, granted_by_owner')
    if (abonnemangFel) throw abonnemangFel

    const slappsIn = new Set(
      (abonnemang ?? [])
        .filter((s) => {
          if (s.granted_by_owner) return true
          if (s.status === 'aktiv') return true
          if (s.status === 'provperiod') return !!s.trial_ends_on && s.trial_ends_on >= datum(idag)
          if (s.status === 'uppsagd') {
            return !!s.current_period_end && new Date(s.current_period_end) >= idag
          }
          return false
        })
        .map((s) => s.user_id as string),
    )
    if (slappsIn.size === 0) {
      await logga(supabase, { hittade: 0, skickade: 0, misslyckade: 0, fel: null })
      return json({ hittade: 0, skickade: 0, misslyckade: 0, orsak: 'inga konton med tillgang' })
    }

    // 2. Var och en har sin egen framforhallning. Mailet maste anvanda SAMMA
    //    siffra som radarn i appen, annars sager de tva olika saker om samma
    //    licens och da tror hon att en av dem har fel.
    const { data: installningar } = await supabase
      .from('piches_settings')
      .select('user_id, renewal_lead_days, renewal_uplift_pct, email_radar')
      .in('user_id', [...slappsIn])

    const konfig = new Map(
      (installningar ?? []).map((s) => [
        s.user_id as string,
        {
          lead: (s.renewal_lead_days as number | null) ?? 30,
          uplift: (s.renewal_uplift_pct as number | null) ?? 0,
          pa: s.email_radar !== false,
        },
      ]),
    )

    const mottagare = [...slappsIn].filter((id) => konfig.get(id)?.pa !== false)
    if (mottagare.length === 0) {
      await logga(supabase, { hittade: 0, skickade: 0, misslyckade: 0, fel: null })
      return json({ hittade: 0, skickade: 0, misslyckade: 0, orsak: 'alla har stängt av' })
    }

    // 3. Licenser med ett slutdatum framfor sig. Den langsta framforhallningen
    //    nagon har satt avgor hur langt fram vi behover titta.
    const maxLead = Math.max(...mottagare.map((id) => konfig.get(id)?.lead ?? 30), 30)
    const bortre = new Date(idag)
    bortre.setDate(bortre.getDate() + maxLead)

    const { data: licenser, error: licensFel } = await supabase
      .from('piches_licenses')
      .select('id, user_id, ends_on, fee_sek, brand_id')
      .in('user_id', mottagare)
      .eq('perpetual', false)
      .not('ends_on', 'is', null)
      .gte('ends_on', datum(idag))
      .lte('ends_on', datum(bortre))
    if (licensFel) throw licensFel

    // 4. Vad har redan skickats? Ingen ska fa samma paminnelse tva ganger.
    const { data: redanSkickat } = await supabase
      .from('piches_radar_utskick')
      .select('license_id, sort')
      .in('user_id', mottagare)
    const skickatNyckel = new Set(
      (redanSkickat ?? []).map((r) => `${r.license_id}:${r.sort}`),
    )

    type Post = { rad: Rad; dagar: number; sort: 'lead' | 'sista_veckan' }
    const perAnvandare = new Map<string, Post[]>()

    for (const rad of (licenser ?? []) as Rad[]) {
      const cfg = konfig.get(rad.user_id) ?? { lead: 30, uplift: 0, pa: true }
      const dagar = Math.round(
        (Date.parse(rad.ends_on + 'T00:00:00Z') - Date.parse(datum(idag) + 'T00:00:00Z')) / 86400000,
      )
      if (dagar > cfg.lead) continue

      const sort: 'lead' | 'sista_veckan' = dagar <= SISTA_VECKAN_DAGAR ? 'sista_veckan' : 'lead'
      if (skickatNyckel.has(`${rad.id}:${sort}`)) continue

      const lista = perAnvandare.get(rad.user_id) ?? []
      lista.push({ rad, dagar, sort })
      perAnvandare.set(rad.user_id, lista)
    }

    hittade = [...perAnvandare.values()].reduce((n, l) => n + l.length, 0)
    if (hittade === 0) {
      await logga(supabase, { hittade: 0, skickade: 0, misslyckade: 0, fel: null })
      return json({ hittade: 0, skickade: 0, misslyckade: 0, orsak: 'inga licenser i fönstret' })
    }

    // 5. Varumarkesnamnen, sa att mailet sager "Nordkust Skincare" och inte ett
    //    id hon aldrig sett.
    const { data: varumarken } = await supabase
      .from('piches_brands')
      .select('id, name')
      .in('user_id', [...perAnvandare.keys()])
    const namn = new Map((varumarken ?? []).map((b) => [b.id as string, b.name as string]))

    const smtpHost = Deno.env.get('SMTP_HOSTNAME') ?? 'smtp.hostinger.com'
    const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '465')
    const fran = Deno.env.get('PICHES_SENDER_EMAIL') ?? `Piches <${smtpUser}>`

    smtp = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    })

    for (const [userId, poster] of perAnvandare) {
      try {
        const { data: personen } = await supabase.auth.admin.getUserById(userId)
        const adress = personen?.user?.email
        if (!adress) continue

        const cfg = konfig.get(userId) ?? { lead: 30, uplift: 0, pa: true }
        poster.sort((a, b) => a.dagar - b.dagar)

        const { amne, text, html } = byggMail(poster, namn, cfg.uplift)
        await smtp.send({ from: fran, to: adress, subject: amne, content: text, html })

        await supabase.from('piches_radar_utskick').upsert(
          poster.map((p) => ({ user_id: userId, license_id: p.rad.id, sort: p.sort })),
          { onConflict: 'user_id,license_id,sort' },
        )
        skickade++
      } catch (e) {
        misslyckade++
        felText = `${felText ? felText + ' | ' : ''}${userId}: ${String(e).slice(0, 120)}`
        console.error('piches-radar-mail, en mottagare misslyckades:', e)
      }
    }
  } catch (e) {
    felText = String(e).slice(0, 400)
    console.error('piches-radar-mail:', e)
  } finally {
    try {
      await smtp?.close()
    } catch {
      // En stangning som strular far aldrig radera resultatet av korningen.
    }
  }

  await logga(supabase, { hittade, skickade, misslyckade, fel: felText })
  return json({ hittade, skickade, misslyckade, fel: felText }, felText && skickade === 0 ? 500 : 200)
})

/**
 * Priset pa en forlangning, samma formel som appen visar i fornyelsekon.
 * Star de olika litar hon pa ingen av dem.
 */
function forlangningspris(fee: number | null, upliftPct: number): number | null {
  if (fee === null || fee === undefined) return null
  return Math.round(fee * (1 + upliftPct / 100))
}

function kr(n: number): string {
  return n.toLocaleString('sv-SE').replace(/ /g, ' ') + ' kr'
}

function dagarText(n: number): string {
  if (n <= 0) return 'idag'
  if (n === 1) return 'om 1 dag'
  return `om ${n} dagar`
}

function byggMail(
  poster: { rad: Rad; dagar: number; sort: string }[],
  namn: Map<string, string>,
  upliftPct: number,
) {
  const narmast = poster[0]
  const varumarke = narmast.rad.brand_id ? namn.get(narmast.rad.brand_id) : null

  const amne =
    poster.length === 1
      ? `${varumarke ?? 'En licens'} går ut ${dagarText(narmast.dagar)}`
      : `${poster.length} licenser går ut snart, den första ${dagarText(narmast.dagar)}`

  const rader = poster.map((p) => {
    const namnet = p.rad.brand_id ? (namn.get(p.rad.brand_id) ?? 'Okänt varumärke') : 'Okänt varumärke'
    const pris = forlangningspris(p.rad.fee_sek, upliftPct)
    const prisdel = pris ? `, förlängning ungefär ${kr(pris)}` : ''
    return { namnet, rad: `${namnet}, slutar ${p.rad.ends_on} (${dagarText(p.dagar)})${prisdel}` }
  })

  const summa = poster.reduce(
    (n, p) => n + (forlangningspris(p.rad.fee_sek, upliftPct) ?? 0),
    0,
  )

  const text = [
    'Hej,',
    '',
    poster.length === 1
      ? 'En av dina licenser tar slut snart, och det är nu förlängningen är enklast att prata om.'
      : 'Några av dina licenser tar slut snart, och det är nu förlängningen är enklast att prata om.',
    '',
    ...rader.map((r) => '- ' + r.rad),
    '',
    summa > 0 ? `Tillsammans är det ungefär ${kr(summa)} i förlängningar att hämta hem.` : '',
    '',
    'Öppna Piches så ser du hela förnyelsekön:',
    'https://piches.essensiadesign.se/rattigheter',
    '',
    'Vill du inte ha de här mejlen stänger du av dem under Inställningar.',
  ]
    .filter((r) => r !== '')
    .join('\n')

  const html = `<!doctype html>
<html lang="sv"><body style="margin:0;padding:24px;background:#fbf9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1b17">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d8;border-radius:16px;padding:28px">
    <p style="margin:0 0 18px;font-size:18px;font-weight:600;line-height:1.35">
      ${poster.length === 1 ? 'En licens tar slut snart' : `${poster.length} licenser tar slut snart`}
    </p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#54524a">
      Det är nu förlängningen är enklast att prata om, medan materialet fortfarande används och
      innan någon hinner vänja sig vid att ha det gratis.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
      ${poster
        .map((p) => {
          const namnet = p.rad.brand_id
            ? (namn.get(p.rad.brand_id) ?? 'Okänt varumärke')
            : 'Okänt varumärke'
          const pris = forlangningspris(p.rad.fee_sek, upliftPct)
          return `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0ece4;font-size:15px">
              <strong>${escapeHtml(namnet)}</strong><br>
              <span style="color:#54524a">slutar ${p.rad.ends_on}, ${dagarText(p.dagar)}</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:15px;white-space:nowrap">
              ${pris ? escapeHtml(kr(pris)) : ''}
            </td>
          </tr>`
        })
        .join('')}
    </table>
    ${
      summa > 0
        ? `<p style="margin:0 0 22px;font-size:15px;color:#54524a">Tillsammans ungefär <strong style="color:#1c1b17">${escapeHtml(kr(summa))}</strong> i förlängningar att hämta hem.</p>`
        : ''
    }
    <a href="https://piches.essensiadesign.se/rattigheter"
       style="display:inline-block;background:#3d5245;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">
      Öppna förnyelsekön
    </a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8a8578">
      Vill du inte ha de här mejlen stänger du av dem under Inställningar i Piches.
    </p>
  </div>
</body></html>`

  return { amne, text, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function logga(
  supabase: ReturnType<typeof createClient>,
  rad: { hittade: number; skickade: number; misslyckade: number; fel: string | null },
) {
  try {
    await supabase.from('piches_radar_korningar').insert(rad)
  } catch (e) {
    console.error('kunde inte logga körningen:', e)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
