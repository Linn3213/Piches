import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Channel, License, Territory } from "@/types/db";
import {
  exclusivityConflicts,
  expiringLicenses,
  isRelicensable,
  lapsedLicenses,
  type ExclusivityConflict,
} from "@/lib/rights";
import { useSettings } from "@/hooks/useSettings";

export type LicenseDraft = {
  pitch_id: string;
  brand_id: string;
  deliverable_id?: string | null;
  channels: Channel[];
  territory: Territory;
  starts_on: string;
  ends_on: string | null;
  perpetual: boolean;
  exclusive_category?: string | null;
  exclusivity_ends_on?: string | null;
  includes_raw_files: boolean;
  fee_sek?: number | null;
  notes?: string | null;
};

export function useLicenses(brandId?: string) {
  return useQuery({
    queryKey: ["licenses", brandId ?? "alla"],
    queryFn: async (): Promise<License[]> => {
      let q = supabase.from("piches_licenses").select("*").order("ends_on", { ascending: true });
      if (brandId) q = q.eq("brand_id", brandId);
      const { data, error } = await q;
      if (error) throw error;
      return data as License[];
    },
  });
}

export function useCreateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: LicenseDraft) => {
      const { data, error } = await supabase.from("piches_licenses").insert(draft).select().single();
      if (error) throw error;

      await supabase.from("piches_activities").insert({
        brand_id: draft.brand_id,
        pitch_id: draft.pitch_id,
        kind: "system",
        body: draft.perpetual
          ? "Evig licens registrerad"
          : `Licens registrerad, löper ut ${draft.ends_on}`,
      });

      return data as License;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useDeleteLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("piches_licenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["licenses"] }),
  });
}

/**
 * Utgångsradarn — appens hjärta. Räknar ut vad som snart löper ut, vad
 * som redan runnit ut oförnyat, och vilket material som är fritt att sälja
 * igen. Allt härleds ur licensdatumen, ingenting lagras dubbelt.
 */
export function useExpiryRadar() {
  const { data: licenses } = useLicenses();
  const { data: settings } = useSettings();

  return useQuery({
    queryKey: ["expiry-radar", licenses?.length ?? 0, settings?.renewal_lead_days ?? 30],
    enabled: Boolean(licenses && settings),
    queryFn: async () => {
      const all = licenses ?? [];
      const lead = settings?.renewal_lead_days ?? 30;
      const today = new Date();

      const byDeliverable = new Map<string, License[]>();
      for (const l of all) {
        if (!l.deliverable_id) continue;
        const list = byDeliverable.get(l.deliverable_id) ?? [];
        list.push(l);
        byDeliverable.set(l.deliverable_id, list);
      }

      const relicensable = [...byDeliverable.entries()]
        .filter(([, list]) => isRelicensable(list, today, lead))
        .map(([deliverableId, list]) => ({ deliverableId, licenses: list }));

      return {
        expiring: expiringLicenses(all, today, lead),
        lapsed: lapsedLicenses(all, today, lead),
        relicensable,
        leadDays: lead,
      };
    },
  });
}

/** Exklusivitetsvakten, för formuläret där ett nytt uppdrag skapas. */
export function useExclusivityGuard(
  category: string,
  startingOn: string,
  excludeBrandId?: string,
): ExclusivityConflict[] {
  const { data: licenses } = useLicenses();
  if (!licenses || !category.trim()) return [];
  const start = startingOn ? new Date(startingOn) : new Date();
  return exclusivityConflicts(licenses, category, start, excludeBrandId);
}
