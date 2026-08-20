import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

/**
 * Allt appen behöver säga när ingen har appen öppen.
 *
 * TVÅ SLAGS UTSKICK, med olika logik och olika rätt att finnas:
 *
 * 1. Utgångsradarn. Produktens kärna är att ingen förlängning ska hinna rinna
 *    ut obemärkt, men radarn fanns bara INNE i appen. Den som glömde logga in
 *    missade precis det hon betalade för att slippa missa. Går att stänga av.
 *
 * 2. Kontot. Provperioden tog slut i tystnad för den som inte råkade öppna
 *    appen den sista veckan, och en betalning som slutar fungera märks först
 *    nästa inloggning, vilket kan dröja veckor. De här mejlen går inte att
 *    stänga av, för de handlar om pengar och tillgång och inte om innehåll.
 *
 * Båda delarna körs ALLTID, även när den andra inte hittar något. Tidigare
 * utkast lät radarn returnera tidigt vid noll licenser, vilket hade tystat
 * kontomejlen för varje ny kund som ännu inte lagt in en licens, alltså exakt
 * den kund som behöver påminnelsen mest.
 *
 * Körningen loggas alltid, med egna siffror för varje del, så att "det fanns
 * inget att skicka" går att skilja från "jobbet kördes aldrig".
 */

const SISTA_VECKAN_DAGAR = 7
const APP = 'https://piches.essensiadesign.se'

type LicensRad = {
  id: string
  user_id: string
  ends_on: string
  fee_sek: number | null
  brand_id: string | null
}

type Abonnemang = {
  user_id: string
  status: string
  trial_ends_on: string | null
  current_period_end: string | null
  granted_by_owner: boolean
}

type KontoSort = 'prov_3_dagar' | 'prov_sista_dagen' | 'betalning_stoppade'

Deno.serve(async (req) => {
  // Fail-closed. Saknas hemligheten nekas allt, den släpps aldrig igenom av
  // misstag bara för att den inte hunnit konfigureras.
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
  let kontoHittade = 0
  let kontoSkickade = 0
  let felText: string | null = null
  let smtp: SMTPClient | null = null

  try {
    // Kontrollen av SMTP ligger LÄNGRE NER, precis före utskicket.
    //
    // Först låg den här överst, och då loggade en körning utan mailserver
    // "hittade 0, skickade 0" plus ett felmeddelande. Alltså såg det ut som om
    // det inte fanns något att skicka, när sanningen var att tre påminnelser
    // stod och väntade. Nu räknas allt först, så loggen säger hur mycket som
    // faktiskt ligger och väntar på att någon fixar hemligheterna.
    const idag = new Date()
    const datum = (d: Date) => d.toISOString().slice(0, 10)
    const idagStr = datum(idag)

    const { data: abonnemangRader, error: abonnemangFel } = await supabase
      .from('piches_subscriptions')
      .select('user_id, status, trial_ends_on, current_period_end, granted_by_owner')
    if (abonnemangFel) throw abonnemangFel
    const abonnemang = (abonnemangRader ?? []) as Abonnemang[]

    // ---- DEL 1, utgångsradarn ---------------------------------------------

    // Bara konton som faktiskt får använda appen. Att jaga förnyelser hos någon
    // som är utelåst vore att sälja på något hon inte kan använda.
    const slappsIn = new Set(
      abonnemang
        .filter((s) => {
          if (s.granted_by_owner) return true
          if (s.status === 'aktiv') return true
          if (s.status === 'provperiod') return !!s.trial_ends_on && s.trial_ends_on >= idagStr
          if (s.status === 'uppsagd') {
            return !!s.current_period_end && new Date(s.current_period_end) >= idag
          }
          return false
        })
        .map((s) => s.user_id),
    )

    const konfig = new Map<string, { lead: number; uplift: number; pa: boolean }>()
    if (slappsIn.size > 0) {
      const { data: installningar } = await supabase
        .from('piches_settings')
        .select('user_id, renewal_lead_days, renewal_uplift_pct, email_radar')
        .in('user_id', [...slappsIn])
      for (const s of installningar ?? []) {
        konfig.set(s.user_id as string, {
          lead: (s.renewal_lead_days as number | null) ?? 30,
          uplift: (s.renewal_uplift_pct as number | null) ?? 0,
          pa: s.email_radar !== false,
        })
      }
    }

    const radarMottagare = [...slappsIn].filter((id) => konfig.get(id)?.pa !== false)
    type Post = { rad: LicensRad; dagar: number; sort: 'lead' | 'sista_veckan' }
    const licensPerAnvandare = new Map<string, Post[]>()

    if (radarMottagare.length > 0) {
      const maxLead = Math.max(...radarMottagare.map((id) => konfig.get(id)?.lead ?? 30), 30)
      const bortre = new Date(idag)
      bortre.setDate(bortre.getDate() + maxLead)

      const { data: licenser, error: licensFel } = await supabase
        .from('piches_licenses')
        .select('id, user_id, ends_on, fee_sek, brand_id')
        .in('user_id', radarMottagare)
        .eq('perpetual', false)
        .not('ends_on', 'is', null)
        .gte('ends_on', idagStr)
        .lte('ends_on', datum(bortre))
      if (licensFel) throw licensFel

      const { data: redanSkickat } = await supabase
        .from('piches_radar_utskick')
        .select('license_id, sort')
        .in('user_id', radarMottagare)
      const skickatNyckel = new Set((redanSkickat ?? []).map((r) => `${r.license_id}:${r.sort}`))

      for (const rad of (licenser ?? []) as LicensRad[]) {
        const cfg = konfig.get(rad.user_id) ?? { lead: 30, uplift: 0, pa: true }
        const dagar = dagarMellan(idagStr, rad.ends_on)
        if (dagar > cfg.lead) continue

        const sort: 'lead' | 'sista_veckan' = dagar <= SISTA_VECKAN_DAGAR ? 'sista_veckan' : 'lead'
        if (skickatNyckel.has(`${rad.id}:${sort}`)) continue

        const lista = licensPerAnvandare.get(rad.user_id) ?? []
        lista.push({ rad, dagar, sort })
        licensPerAnvandare.set(rad.user_id, lista)
      }
      hittade = [...licensPerAnvandare.values()].reduce((n, l) => n + l.length, 0)
    }

    // ---- DEL 2, kontot ----------------------------------------------------

    const { data: kontoSkickatRader } = await supabase
      .from('piches_konto_utskick')
      .select('user_id, sort')
    const kontoSkickatNyckel = new Set(
      (kontoSkickatRader ?? []).map((r) => `${r.user_id}:${r.sort}`),
    )

    const kontoArbete: { userId: string; sort: KontoSort; dagar: number }[] = []
    for (const s of abonnemang) {
      // Ett konto som öppnats för hand faktureras utanför appen och ska aldrig
      // få mejl om provperioder eller kort som slutat fungera.
      if (s.granted_by_owner) continue

      let sort: KontoSort | null = null
      let dagar = 0

      if (s.status === 'provperiod' && s.trial_ends_on) {
        dagar = dagarMellan(idagStr, s.trial_ends_on)
        if (dagar === 0) sort = 'prov_sista_dagen'
        else if (dagar > 0 && dagar <= 3) sort = 'prov_3_dagar'
      } else if (s.status === 'forfallen') {
        sort = 'betalning_stoppade'
      }

      if (!sort) continue
      if (kontoSkickatNyckel.has(`${s.user_id}:${sort}`)) continue
      kontoArbete.push({ userId: s.user_id, sort, dagar })
    }
    kontoHittade = kontoArbete.length

    if (hittade === 0 && kontoHittade === 0) {
      await logga(supabase, {
        hittade: 0,
        skickade: 0,
        misslyckade: 0,
        fel: null,
        konto_hittade: 0,
        konto_skickade: 0,
      })
      return json({ hittade: 0, skickade: 0, kontoHittade: 0, orsak: 'ingenting att skicka' })
    }

    // ---- Avsändaren -------------------------------------------------------

    const { data: varumarken } = await supabase
      .from('piches_brands')
      .select('id, name')
      .in('user_id', [...licensPerAnvandare.keys(), '00000000-0000-0000-0000-000000000000'])
    const namn = new Map((varumarken ?? []).map((b) => [b.id as string, b.name as string]))

    const smtpUser = Deno.env.get('SMTP_USERNAME')
    const smtpPass = Deno.env.get('SMTP_PASSWORD')
    if (!smtpUser || !smtpPass) {
      throw new Error(
        `SMTP_USERNAME eller SMTP_PASSWORD saknas, ${hittade} radarmejl och ${kontoHittade} kontomejl väntar`,
      )
    }

    smtp = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOSTNAME') ?? 'smtp.hostinger.com',
        port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    })
    const fran = Deno.env.get('PICHES_SENDER_EMAIL') ?? `Piches <${smtpUser}>`

    async function adressen(userId: string): Promise<string | null> {
      const { data } = await supabase.auth.admin.getUserById(userId)
      return data?.user?.email ?? null
    }

    // ---- Skicka radarmejlen -----------------------------------------------

    for (const [userId, poster] of licensPerAnvandare) {
      try {
        const adress = await adressen(userId)
        if (!adress) continue

        const cfg = konfig.get(userId) ?? { lead: 30, uplift: 0, pa: true }
        poster.sort((a, b) => a.dagar - b.dagar)

        const { amne, text, html } = byggRadarMail(poster, namn, cfg.uplift)
        await smtp!.send({ from: fran, to: adress, subject: amne, content: text, html })

        await supabase.from('piches_radar_utskick').upsert(
          poster.map((p) => ({ user_id: userId, license_id: p.rad.id, sort: p.sort })),
          { onConflict: 'user_id,license_id,sort' },
        )
        skickade++
      } catch (e) {
        misslyckade++
        felText = `${felText ? felText + ' | ' : ''}radar ${userId}: ${String(e).slice(0, 100)}`
        console.error('piches-radar-mail, radar misslyckades:', e)
      }
    }

    // ---- Skicka kontomejlen -----------------------------------------------

    for (const jobb of kontoArbete) {
      try {
        const adress = await adressen(jobb.userId)
        if (!adress) continue

        const { amne, text, html } = byggKontoMail(jobb.sort, jobb.dagar)
        await smtp!.send({ from: fran, to: adress, subject: amne, content: text, html })

        await supabase
          .from('piches_konto_utskick')
          .upsert({ user_id: jobb.userId, sort: jobb.sort }, { onConflict: 'user_id,sort' })
        kontoSkickade++
      } catch (e) {
        misslyckade++
        felText = `${felText ? felText + ' | ' : ''}konto ${jobb.userId}: ${String(e).slice(0, 100)}`
        console.error('piches-radar-mail, kontomejl misslyckades:', e)
      }
    }
  } catch (e) {
    felText = String(e).slice(0, 400)
    console.error('piches-radar-mail:', e)
  } finally {
    try {
      await smtp?.close()
    } catch {
      // En stängning som strular får aldrig radera resultatet av körningen.
    }
  }

  await logga(supabase, {
    hittade,
    skickade,
    misslyckade,
    fel: felText,
    konto_hittade: kontoHittade,
    konto_skickade: kontoSkickade,
  })
  return json(
    { hittade, skickade, misslyckade, kontoHittade, kontoSkickade, fel: felText },
    felText && skickade === 0 && kontoSkickade === 0 ? 500 : 200,
  )
})

/** Hela dagar mellan två datumsträngar, räknat i UTC så att sommartid inte stör. */
function dagarMellan(fran: string, till: string): number {
  return Math.round(
    (Date.parse(till + 'T00:00:00Z') - Date.parse(fran + 'T00:00:00Z')) / 86400000,
  )
}

/** Priset på en förlängning, samma formel som appen visar i förnyelsekön. */
function forlangningspris(fee: number | null, upliftPct: number): number | null {
  if (fee === null || fee === undefined) return null
  return Math.round(fee * (1 + upliftPct / 100))
}

function kr(n: number): string {
  return n.toLocaleString('sv-SE') + ' kr'
}

function dagarText(n: number): string {
  if (n <= 0) return 'idag'
  if (n === 1) return 'om 1 dag'
  return `om ${n} dagar`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Ramen runt varje mejl, så att de ser ut att komma från samma avsändare. */
function ram(rubrik: string, brodtext: string, kropp: string, knapp: { text: string; url: string }) {
  return `<!doctype html>
<html lang="sv"><body style="margin:0;padding:24px;background:#fbf9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1b17">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d8;border-radius:16px;padding:28px">
    <p style="margin:0 0 18px;font-size:18px;font-weight:600;line-height:1.35">${rubrik}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#54524a">${brodtext}</p>
    ${kropp}
    <a href="${knapp.url}"
       style="display:inline-block;background:#3d5245;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">
      ${knapp.text}
    </a>
  </div>
</body></html>`
}

function byggRadarMail(
  poster: { rad: LicensRad; dagar: number; sort: string }[],
  namn: Map<string, string>,
  upliftPct: number,
) {
  const narmast = poster[0]
  const varumarke = narmast.rad.brand_id ? namn.get(narmast.rad.brand_id) : null

  const amne =
    poster.length === 1
      ? `${varumarke ?? 'En licens'} går ut ${dagarText(narmast.dagar)}`
      : `${poster.length} licenser går ut snart, den första ${dagarText(narmast.dagar)}`

  const summa = poster.reduce((n, p) => n + (forlangningspris(p.rad.fee_sek, upliftPct) ?? 0), 0)

  const namnet = (id: string | null) =>
    id ? (namn.get(id) ?? 'Okänt varumärke') : 'Okänt varumärke'

  const text = [
    'Hej,',
    '',
    poster.length === 1
      ? 'En av dina licenser tar slut snart, och det är nu förlängningen är enklast att prata om.'
      : 'Några av dina licenser tar slut snart, och det är nu förlängningen är enklast att prata om.',
    '',
    ...poster.map((p) => {
      const pris = forlangningspris(p.rad.fee_sek, upliftPct)
      return `- ${namnet(p.rad.brand_id)}, slutar ${p.rad.ends_on} (${dagarText(p.dagar)})${pris ? `, förlängning ungefär ${kr(pris)}` : ''}`
    }),
    '',
    summa > 0 ? `Tillsammans är det ungefär ${kr(summa)} i förlängningar att hämta hem.` : '',
    '',
    'Öppna Piches så ser du hela förnyelsekön:',
    `${APP}/rattigheter`,
    '',
    'Vill du inte ha de här mejlen stänger du av dem under Inställningar.',
  ]
    .filter((r) => r !== '')
    .join('\n')

  const tabell = `<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
      ${poster
        .map((p) => {
          const pris = forlangningspris(p.rad.fee_sek, upliftPct)
          return `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0ece4;font-size:15px">
              <strong>${escapeHtml(namnet(p.rad.brand_id))}</strong><br>
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
    }`

  const html = ram(
    poster.length === 1 ? 'En licens tar slut snart' : `${poster.length} licenser tar slut snart`,
    'Det är nu förlängningen är enklast att prata om, medan materialet fortfarande används och innan någon hinner vänja sig vid att ha det gratis.',
    tabell,
    { text: 'Öppna förnyelsekön', url: `${APP}/rattigheter` },
  ).replace(
    '</div>\n</body>',
    `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8a8578">Vill du inte ha de här mejlen stänger du av dem under Inställningar i Piches.</p>
  </div>
</body>`,
  )

  return { amne, text, html }
}

function byggKontoMail(sort: KontoSort, dagar: number) {
  if (sort === 'betalning_stoppade') {
    return {
      amne: 'Betalningen gick inte igenom',
      text: [
        'Hej,',
        '',
        'Din betalning för Piches gick inte igenom, oftast för att kortet hunnit gå ut. Allt du lagt in ligger kvar orört, men kontot är pausat tills betalningen är på plats igen.',
        '',
        'Uppdatera kortet här, det tar en minut:',
        `${APP}/konto`,
      ].join('\n'),
      html: ram(
        'Betalningen gick inte igenom',
        'Oftast är det bara ett kort som hunnit gå ut. Allt du lagt in ligger kvar orört, men kontot är pausat tills betalningen är på plats igen.',
        '',
        { text: 'Uppdatera betalningen', url: `${APP}/konto` },
      ),
    }
  }

  const sista = sort === 'prov_sista_dagen'
  const nar = sista ? 'idag' : dagar === 1 ? 'imorgon' : `om ${dagar} dagar`

  return {
    amne: sista ? 'Sista dagen av din provperiod' : `Provperioden tar slut ${nar}`,
    text: [
      'Hej,',
      '',
      `Din provperiod i Piches tar slut ${nar}.`,
      '',
      'Allt du lagt in finns kvar oavsett vad du väljer, alltså uppdragen, licenserna och datumen. Vill du fortsätta väljer du nivå inne i appen, och vill du inte behöver du inte göra någonting alls.',
      '',
      'En enda licens som hinner löpa ut obemärkt kostar oftast mer än ett helt år av verktyget.',
      '',
      `${APP}/konto`,
    ].join('\n'),
    html: ram(
      sista ? 'Sista dagen av din provperiod' : `Provperioden tar slut ${nar}`,
      'Allt du lagt in finns kvar oavsett vad du väljer, alltså uppdragen, licenserna och datumen. Vill du fortsätta väljer du nivå inne i appen, och vill du inte behöver du inte göra någonting alls.',
      '<p style="margin:0 0 22px;font-size:15px;color:#54524a">En enda licens som hinner löpa ut obemärkt kostar oftast mer än ett helt år av verktyget.</p>',
      { text: 'Välj nivå', url: `${APP}/konto` },
    ),
  }
}

async function logga(
  supabase: ReturnType<typeof createClient>,
  rad: {
    hittade: number
    skickade: number
    misslyckade: number
    fel: string | null
    konto_hittade?: number
    konto_skickade?: number
  },
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
