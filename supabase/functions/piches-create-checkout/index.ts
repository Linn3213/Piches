import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import Stripe from 'https://esm.sh/stripe@18.5.0'

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

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    })

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
