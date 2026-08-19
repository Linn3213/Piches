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
    const periodSlut =
      typeof subscription === 'object' && subscription && 'current_period_end' in subscription
        ? new Date((subscription as { current_period_end: number }).current_period_end * 1000).toISOString()
        : null

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
    return tillbaka('prenumeration=fel')
  }
})
