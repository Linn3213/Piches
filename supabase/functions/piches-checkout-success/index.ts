import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import Stripe from 'https://esm.sh/stripe@18.5.0'

/**
 * SANDLÅDA ELLER SKARPT LÄGE.
 *
 * Alla Linns appar delar ett Stripe-konto och en Supabase-instans, så de delar
 * också strömbrytare: raden stripe_testlage i app_config. Står den på 'pa'
 * handlar appen i Stripes sandlåda, alltså samma kassa och samma webhook men
 * med testkort i stället för pengar. Linn slår om den i Studio L.A:s
 * adminpanel, och den gäller då alla apparna på en gång.
 *
 * INGEN TYST RESERV. Saknas testnyckeln när läget är på kastas ett fel som
 * säger exakt vilken hemlighet som fattas. Att i det läget falla tillbaka på
 * den skarpa nyckeln vore det dyraste felet som finns: Linn tror att hon
 * testar medan hennes eget kort dras.
 *
 * Läser via REST i stället för en klient, så samma block passar i varje
 * funktion oavsett hur den i övrigt är byggd.
 */
async function stripeSandlada(): Promise<boolean> {
  try {
    const bas = Deno.env.get("SUPABASE_URL") ?? "";
    const nyckel = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!bas || !nyckel) return false;
    const svar = await fetch(
      `${bas}/rest/v1/app_config?key=eq.stripe_testlage&select=value`,
      { headers: { apikey: nyckel, Authorization: `Bearer ${nyckel}` } },
    );
    if (!svar.ok) return false;
    const rader = await svar.json();
    return (rader?.[0]?.value ?? "").trim() === "pa";
  } catch (_fel) {
    /* Gar lasningen inte fram vet vi inte, och da ar skarpt lage det enda
       svaret som inte kan overraska: en riktig kund kan fortfarande handla. */
    return false;
  }
}

/** Nyckeln for det lage appen star i just nu. */
async function stripeNyckeln(): Promise<string> {
  const sandlada = await stripeSandlada();
  const n = sandlada
    ? Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? ""
    : Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!n) {
    throw new Error(
      sandlada
        ? "Stripe star i sandlada men STRIPE_SECRET_KEY_TEST saknas. Ingenting gjordes, for annars hade kortet dragits pa riktigt."
        : "STRIPE_SECRET_KEY saknas.",
    );
  }
  return n;
}

/** Efter kassan avgor sessionen sjalv, aldrig installningen. */
function stripeNyckelForSession(sessionId: string): string {
  const sandlada = sessionId.startsWith("cs_test_");
  const n = sandlada
    ? Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? ""
    : Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!n) throw new Error(`Saknar ${sandlada ? "STRIPE_SECRET_KEY_TEST" : "STRIPE_SECRET_KEY"}.`);
  return n;
}

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
    const stripe = new Stripe(stripeNyckelForSession(sessionId), { apiVersion: '2025-08-27.basil' })
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
