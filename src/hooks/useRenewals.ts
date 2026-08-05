import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useBrands } from "@/hooks/useBrands";
import { useExpiryRadar } from "@/hooks/useLicenses";
import { usePitches } from "@/hooks/usePitches";
import { useSettings } from "@/hooks/useSettings";
import { renewalQueue, type RenewalProposal } from "@/lib/renewal";
import type { Pitch } from "@/types/db";

/**
 * Förnyelsekön: licenserna som snart går ut eller redan runnit ut, omgjorda
 * till konkreta affärsförslag med pris och färdig text. Det som redan har en
 * pågående förnyelseaffär filtreras bort, så att listan inte tjatar.
 */
export function useRenewalQueue(): RenewalProposal[] {
  const { data: radar } = useExpiryRadar();
  const { data: pitches } = usePitches();
  const { data: brands } = useBrands();
  const { data: settings } = useSettings();

  return useMemo(() => {
    if (!radar) return [];
    return renewalQueue(
      radar.expiring,
      radar.lapsed,
      pitches ?? [],
      brands ?? [],
      new Date(),
      settings?.renewal_uplift_pct ?? 15,
    );
  }, [radar, pitches, brands, settings?.renewal_uplift_pct]);
}

/**
 * Ett klick från "licensen går ut" till en riktig affär i pipelinen, med
 * pris, text och koppling tillbaka till licensen den föddes ur. Det är hela
 * poängen med utgångsradarn: en påminnelse som inte går att agera på är bara
 * ännu en notis att svepa bort.
 */
export function useStartRenewal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: RenewalProposal): Promise<Pitch> => {
      const { data, error } = await supabase
        .from("piches_pitches")
        .insert({
          brand_id: proposal.brandId,
          status: "utkast",
          channel: "mejl",
          subject: proposal.subject,
          observation: proposal.observation,
          value_sek: proposal.suggestedFee,
          renewed_from_license_id: proposal.license.id,
        })
        .select()
        .single();
      if (error) throw error;
      const pitch = data as Pitch;

      await supabase.from("piches_activities").insert({
        brand_id: proposal.brandId,
        pitch_id: pitch.id,
        kind: "system",
        body: proposal.lapsed
          ? "Förnyelse påbörjad för en licens som redan gått ut"
          : "Förnyelse påbörjad innan licensen går ut",
      });

      return pitch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitches"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
