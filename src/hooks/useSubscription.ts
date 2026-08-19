import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { behoverStripeSynk, evaluateAccess, type Access, type Tier } from "@/lib/access";
import type { Subscription } from "@/types/db";

/**
 * Anropar en av appens egna funktioner med den inloggades token.
 *
 * Felen namnges med serverns egen text i stället för ett allmänt "försök
 * igen". Ett tyst fel här betyder att någon som VILL betala inte kan, och det
 * syns aldrig i någon statistik.
 */
async function anropaFunktion<T>(namn: string, kropp?: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Du behöver vara inloggad.");

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${namn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(kropp ?? {}),
  });

  const svar = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(svar.error || "Något gick fel. Försök igen om en stund.");
  return svar as T;
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async (): Promise<Subscription | null> => {
      const { data, error } = await supabase
        .from("piches_subscriptions")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      const rad = (data as Subscription | null) ?? null;

      // Har den betalda perioden tagit slut vet bara Stripe om förnyelsen gick
      // igenom. Vi frågar HÄR, före åtkomstbeslutet, så att beslutet aldrig
      // fattas på en rad vi vet är gammal.
      if (!behoverStripeSynk(rad, new Date())) return rad;
      try {
        const svar = await anropaFunktion<{ subscription: Subscription | null }>(
          "piches-sync-subscription",
        );
        return svar.subscription ?? rad;
      } catch {
        // Nås inte Stripe behåller vi det vi har. Att låsa ute en betalande
        // kund för ett nätverksfel kostar mer än några extra dagar åt någon
        // som sagt upp sig.
        return rad;
      }
    },
    staleTime: 60_000,
  });
}

/** Åtkomstbeslutet, härlett ur raden. Sanningen bor i lib/access.ts. */
export function useAccess(): { access: Access; isLoading: boolean; error: unknown } {
  const { data, isLoading, error } = useSubscription();
  const access = useMemo(() => evaluateAccess(data ?? null, new Date()), [data]);
  return { access, isLoading, error };
}

/**
 * Startar provperioden. Raden skapas av användaren själv, men RLS tillåter
 * bara status "provperiod" med högst fjorton dagar och utan Stripe-koppling,
 * så det går inte att ge sig själv ett abonnemang från webbläsarkonsolen.
 *
 * SLUTDATUMET SKICKAS INTE MED. Det sätts av databasen.
 *
 * Förut räknade den här raden ut datumet med webbläsarens lokala klocka, och
 * RLS jämförde mot serverns current_date, som är UTC. Mellan midnatt och två
 * på natten svensk sommartid hade webbläsaren bytt dygn medan servern låg kvar
 * på gårdagen, datumet blev en dag för långt fram och registreringen svarade
 * 403. Alltså två timmar varje natt då ingen ny kund kunde komma in, utan att
 * det syntes någonstans, eftersom både bygget och testerna är gröna dygnet
 * runt. Med serverns default finns det inte längre två klockor att vara oense
 * om.
 */
export function useStartTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Subscription> => {
      const { data, error } = await supabase
        .from("piches_subscriptions")
        .insert({
          tier: "solo",
          status: "provperiod",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Subscription;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscription"] }),
  });
}

/** Skickar iväg till Stripe. Returnerar aldrig, sidan byts ut. */
export function useStartCheckout() {
  return useMutation({
    mutationFn: async (tier: Tier) => {
      const svar = await anropaFunktion<{ url: string }>("piches-create-checkout", { tier });
      if (!svar.url) throw new Error("Kunde inte öppna betalningen just nu.");
      window.location.href = svar.url;
      return svar.url;
    },
  });
}

/**
 * Öppnar Stripes egen kundportal, där kunden byter kort, ser sina kvitton och
 * säger upp själv. Utan den går varje sådan sak via ett mejl till Linn.
 */
export function useOpenPortal() {
  return useMutation({
    mutationFn: async () => {
      const svar = await anropaFunktion<{ url: string }>("piches-create-portal-session");
      if (!svar.url) throw new Error("Kunde inte öppna betalningssidan just nu.");
      window.location.href = svar.url;
      return svar.url;
    },
  });
}
