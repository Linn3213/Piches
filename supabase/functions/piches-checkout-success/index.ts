import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import Stripe from 'https://esm.sh/stripe@18.5.0'

/**
 * Aktiveringen efter betalning.
 *
 * Kunden landar här direkt från Stripe. Funktionen hämtar sessionen med
 * service-role-nyckeln och kontrollerar att den FAKTISKT är betald innan den
 * skriver något, i stället för att lita på att någon kom tillbaka till rätt
 * adress. Därför behövs ingen webhook-hemlighet för att aktiveringen ska
 * fungera, vilket är hela poängen: en kund som betalat ska aldrig bli
 * stående utanför för att en hemlighet råkat vara osatt.
 */
/**
 * Periodens slut, oavsett var Stripe lagt det.
 *
 * Faltet current_period_end låg länge på prenumerationens rot och flyttades i
 * en senare API-version ner till raderna. Vilken form vårt konto svarar med
 * gick inte att observera, eftersom det ännu inte finns en enda prenumeration
 * att titta på, och en gissning här hade märkts först när första kunden betalat
 * och hennes period aldrig uppdaterades. Läs därför båda ställena.
 */
function periodensSlut(sub: unknown): string | null {
  if (!sub || typeof sub !== 'object') return null
  const o = sub as {
    current_period_end?: number
    items?: { data?: { current_period_end?: number }[] }
  }
  const unix = o.current_period_end ?? o.items?.data?.[0]?.current_period_end ?? null
  return unix ? new Date(unix * 1000).toISOString() : null
}

/**
 * Larmar i felkanalen. En betalning som gar sonder utan att nagon hor det ar
 * den dyraste sortens tystnad: kunden har dragits pengar och far ingen tillgang,
 * och det upptacks forst nar hon hor av sig arg, om hon gor det.
 */
async function larmaFelkanal(fel: unknown, funktion: string) {
  const token = Deno.env.get('OPS_INGEST_TOKEN')
  if (!token) return
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ops-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ops-token': token },
      body: JSON.stringify({
        app: 'piches',
        source: 'edge',
        level: 'error',
        message: `${funktion}: ${fel instanceof Error ? fel.message : String(fel)}`,
        stack: fel instanceof Error ? fel.stack : null,
        context: { funktion },
      }),
    })
  } catch {
    // Larmet far aldrig sanka sjalva funktionen.
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session_id')
  const redirect = url.searchParams.get('redirect') || 'https://piches.essensiadesign.se/'

  const tillbaka = (fraga: string) =>
    Response.redirect(redirect + (redirect.includes('?') ? '&' : '?') + fraga, 303)

  if (!sessionId) return tillbaka('prenumeration=saknas')

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    })
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return tillbaka('prenumeration=obetald')
    }

    const userId = session.metadata?.user_id
    const tier = session.metadata?.tier === 'studio' ? 'studio' : 'solo'
    if (!userId) return tillbaka('prenumeration=okand')

    const subscription = session.subscription as Stripe.Subscription | string | null
    const subId = typeof subscription === 'string' ? subscription : subscription?.id ?? null

    // Hämta prenumerationen färsk i stället för att lita på det som råkade
    // följa med sessionen, så att hela objektet finns.
    let fullSub: Stripe.Subscription | null = null
    if (subId) {
      try {
        fullSub = await stripe.subscriptions.retrieve(subId)
      } catch (e) {
        console.error('piches-checkout-success: kunde inte hämta prenumerationen', e)
      }
    }
    const periodSlut = periodensSlut(fullSub ?? subscription)
    if (subId && !periodSlut) {
      // Tyst null här hade betytt att appen frågar Stripe vid varje sidladdning
      // för evigt, utan att någon förstår varför. Namnge det i stället.
      console.error(
        'piches-checkout-success: hittade inget periodslut på prenumerationen',
        subId,
      )
      await larmaFelkanal(
        new Error(`inget periodslut på prenumeration ${subId}`),
        'piches-checkout-success',
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await supabase.from('piches_subscriptions').upsert({
      user_id: userId,
      tier,
      status: 'aktiv',
      trial_ends_on: null,
      current_period_end: periodSlut,
      stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
      stripe_subscription_id: subId,
    }, { onConflict: 'user_id' })

    return tillbaka('prenumeration=klar')
  } catch (error) {
    console.error('piches-checkout-success error:', error)
    await larmaFelkanal(error, 'piches-checkout-success')
    return tillbaka('prenumeration=fel')
  }
})
