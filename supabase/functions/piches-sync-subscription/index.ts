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

    const stripe = new Stripe(await stripeNyckeln(), { apiVersion: '2025-08-27.basil' })
    const abonnemang = await stripe.subscriptions.retrieve(rad.stripe_subscription_id)

    // Samma sak har: faltet ligger antingen pa roten eller pa forsta raden,
    // beroende pa API-version. Las bada, sa slipper vi en tyst null som far
    // appen att fraga Stripe vid varje sidladdning for evigt.
    const o = abonnemang as unknown as {
      current_period_end?: number
      items?: { data?: { current_period_end?: number }[] }
    }
    const periodSlut = o.current_period_end ?? o.items?.data?.[0]?.current_period_end
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
