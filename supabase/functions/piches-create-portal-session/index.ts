import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import Stripe from 'https://esm.sh/stripe@18.5.0'

/**
 * Kundens egen dörr ut.
 *
 * Utan den här funktionen går varje uppsägning, varje byte av kort och varje
 * kvittofråga via ett mejl som en människa måste läsa och svara på. Det är
 * hanterbart för fem kunder och omöjligt för trehundra, och det är antalet
 * kunder som är hela poängen med att appen ska bära sig själv.
 *
 * Att säga upp ska vara lika enkelt som att börja. En uppsägning som kräver
 * mejl blir en dålig recension, inte en behållen kund.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Kundnumret hämtas ur DATABASEN och aldrig ur anropet. Skickades det in
    // utifrån kunde vem som helst som gissat ett kundnummer öppna någon annans
    // fakturor och kortuppgifter.
    if (!rad?.stripe_customer_id) {
      return json({ error: 'Du har ingen betalning att hantera än.' }, 400)
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    })
    const origin = req.headers.get('origin') || 'https://piches.essensiadesign.se'
    const session = await stripe.billingPortal.sessions.create({
      customer: rad.stripe_customer_id,
      return_url: `${origin}/konto`,
    })

    return json({ url: session.url })
  } catch (error) {
    console.error('piches-create-portal-session error:', error)
    return json({ error: 'Kunde inte öppna betalningssidan just nu.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
