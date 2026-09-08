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

    const stripe = new Stripe(await stripeNyckeln(), { apiVersion: '2025-08-27.basil' })
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
