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

/**
 * Nyckeln for det lage appen star i just nu.
 *
 * EN SLAGEN STROMBRYTARE UTAN NYCKEL FAR ALDRIG STANGA KASSAN. Forsta
 * versionen kastade ett fel har. Raden stod pa "pa" medan
 * STRIPE_SECRET_KEY_TEST saknades, och da svarade kassan med ett fel for VARJE
 * besokare, i alla apparna, i tva och en halv timme. Ett brutet kop kostar
 * alltid mer an ett testkop som blir skarpt, sa vi stannar i skarpt lage och
 * skriker i loggen i stallet for att stanga butiken.
 */
async function stripeNyckeln(): Promise<string> {
  const onskad = await stripeSandlada();
  const testnyckel = Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? "";
  if (onskad && !testnyckel) {
    console.error(
      "SANDLADAN AR PASLAGEN MEN STRIPE_SECRET_KEY_TEST SAKNAS. Kor SKARPT sa att kunder kan handla. Satt hemligheten, eller sla av laget.",
    );
  }
  const n = onskad && testnyckel ? testnyckel : Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!n) throw new Error("STRIPE_SECRET_KEY saknas.");
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Priserna byggs inline (price_data), så ingen Stripe-produkt behöver skapas
// för hand. Håll dem i synk med TIERS i src/lib/access.ts — den listan är vad
// kunden faktiskt läser innan hon klickar.
const PLANS: Record<string, { label: string; amountOre: number; beskrivning: string }> = {
  solo: {
    label: 'Solo',
    amountOre: 29900,
    beskrivning: 'Rättighetsmotor, uppdrag, prisräknare och fakturaunderlag',
  },
  studio: {
    label: 'Studio',
    amountOre: 89900,
    beskrivning: 'Allt i Solo plus lönsamhetsmotor, produktmotor och brief-läsare',
  },
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Ej autentiserad' }, 401)

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    ).auth.getUser()
    if (authError || !user || !user.email) return json({ error: 'Ogiltig token' }, 401)

    const { tier } = await req.json()
    const plan = PLANS[tier]
    if (!plan) return json({ error: 'Okänd nivå' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // En andra checkout på ett redan betalande konto skapar en parallell
    // prenumeration och dubbeldebiterar. Spärren gäller bara rader med ett
    // riktigt Stripe-abonnemang bakom sig, så varken provperiod eller ett
    // konto som öppnats för hand blockerar någon från att börja betala.
    const { data: befintlig } = await supabase
      .from('piches_subscriptions')
      .select('status, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (befintlig?.status === 'aktiv' && befintlig.stripe_subscription_id) {
      return json({ error: 'Du har redan en aktiv prenumeration. Hantera den under Konto.' }, 400)
    }

    const stripe = new Stripe(await stripeNyckeln(), { apiVersion: '2025-08-27.basil' })

    const kunder = await stripe.customers.list({ email: user.email, limit: 1 })
    const customerId = kunder.data[0]?.id

    // MOMSEN.
    //
    // Priset ar satt exklusive moms overallt i appen, precis som ar brukligt
    // mot foretagskunder, men kassan drog forst 299 kronor rakt av utan att
    // lagga pa nagot. Kunden betalade alltsa mindre an hon lovats, sagaren
    // fick 239 kronor netto i stallet for 299, och pa fakturan fanns ingen
    // momsrad att gora avdrag pa. Ingen hade markt det forran bokforingen.
    //
    // Stripe Tax kraver uppsattning i dashboarden. En vanlig skattesats gor
    // samma sak har och nu: kassan visar "Moms 25%" som egen rad och kvittot
    // blir ett underlag kunden kan anvanda.
    const satser = await stripe.taxRates.list({ active: true, limit: 100 })
    const moms =
      satser.data.find(
        (s) =>
          s.percentage === 25 &&
          s.inclusive === false &&
          s.country === 'SE' &&
          s.display_name === 'Moms',
      ) ??
      (await stripe.taxRates.create({
        display_name: 'Moms',
        description: 'Svensk mervärdesskatt 25 procent',
        percentage: 25,
        inclusive: false,
        country: 'SE',
      }))

    const origin = req.headers.get('origin') || 'https://piches.essensiadesign.se'
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''

    // Aktiveringen går via en egen funktion som hämtar sessionen från Stripe
    // med service-role, i stället för att hänga på att en webhook-hemlighet
    // någonsin blir konfigurerad. Samma val som Studio L.A och Learnnd.
    const successUrl = `${supabaseUrl}/functions/v1/piches-checkout-success?session_id={CHECKOUT_SESSION_ID}&redirect=${encodeURIComponent(`${origin}/?prenumeration=klar`)}`

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'sek',
          unit_amount: plan.amountOre,
          recurring: { interval: 'month' },
          product_data: { name: `Piches ${plan.label}`, description: plan.beskrivning },
        },
        quantity: 1,
        tax_rates: [moms.id],
      }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
      success_url: successUrl,
      cancel_url: `${origin}/konto`,
      metadata: { user_id: user.id, tier },
      subscription_data: { metadata: { user_id: user.id, tier } },
    })

    return json({ url: session.url })
  } catch (error) {
    console.error('piches-create-checkout error:', error)
    await larmaFelkanal(error, 'piches-create-checkout')
    return json({ error: 'Kunde inte starta betalningen. Försök igen.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
