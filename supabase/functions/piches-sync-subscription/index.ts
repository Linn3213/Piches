import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import Stripe from 'https://esm.sh/stripe@18.5.0'

/**
 * Sanningen hämtas från Stripe, en kund i taget.
 *
 * Utan det här står raden kvar som "aktiv" för evigt: den som sagt upp sig
 * eller vars kort slutat fungera behåller full tillgång, och ingen märker
 * något eftersom appen ser precis likadan ut. Det är den tystaste sortens
 * intäktsläcka som finns.
 *
 * Valet att synka per kund vid inloggning, i stället för en nattlig körning
 * över alla, är medvetet. Ett schemalagt jobb som slutar fungera gör det utan
 * att säga till, och då är felet osynligt tills någon råkar titta. Det här
 * körs exakt när det spelar roll, alltså när kunden faktiskt öppnar appen, och
 * misslyckas det syns det direkt i samma svar.
 *
 * Vid fel öppnas dörren, den stängs inte. En betalande kund som blir utelåst
 * av ett nätverksfel är dyrare än en uppsagd kund som får några dagar extra.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Stripes ord för verkligheten, översatt till appens fyra lägen. */
function tillStatus(stripeStatus: string, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd && (stripeStatus === 'active' || stripeStatus === 'trialing')) {
    return 'uppsagd'
  }
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'aktiv'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'forfallen'
    case 'canceled':
    case 'incomplete_expired':
      return 'uppsagd'
    default:
      return 'forfallen'
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
    if (authError || !user) return json({ error: 'Ogiltig token' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: rad } = await supabase
      .from('piches_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Provperioder och konton som öppnats för hand finns inte hos Stripe och
    // ska aldrig röras här.
    if (!rad?.stripe_subscription_id) return json({ subscription: rad ?? null })

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    })
    const abonnemang = await stripe.subscriptions.retrieve(rad.stripe_subscription_id)

    const periodSlut = (abonnemang as unknown as { current_period_end?: number }).current_period_end
    const nivaFranStripe = abonnemang.metadata?.tier
    const { data: uppdaterad } = await supabase
      .from('piches_subscriptions')
      .update({
        status: tillStatus(abonnemang.status, abonnemang.cancel_at_period_end === true),
        tier: nivaFranStripe === 'studio' || nivaFranStripe === 'solo' ? nivaFranStripe : rad.tier,
        current_period_end: periodSlut ? new Date(periodSlut * 1000).toISOString() : rad.current_period_end,
      })
      .eq('user_id', user.id)
      .select()
      .single()

    return json({ subscription: uppdaterad ?? rad })
  } catch (error) {
    console.error('piches-sync-subscription error:', error)
    return json({ error: 'Kunde inte hämta status från Stripe.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
