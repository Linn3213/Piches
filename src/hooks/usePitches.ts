import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Pitch, PitchChannel, PitchStatus } from "@/types/db";
import { PITCH_STATUS_LABEL, WON_STATUSES } from "@/types/db";

export type PitchDraft = {
  brand_id: string;
  status?: PitchStatus;
  channel?: PitchChannel;
  subject?: string | null;
  observation?: string | null;
  body?: string | null;
  value_sek?: number | null;
  sent_at?: string | null;
  // Affären efter vunnen. Datumen stämplas av databasen vid statusbyte,
  // men går att skriva över här när något registreras i efterhand.
  invoice_number?: string | null;
  invoiced_on?: string | null;
  due_on?: string | null;
  paid_on?: string | null;
  production_cost_sek?: number | null;
  hours_spent?: number | null;
  revision_rounds?: number;
  renewed_from_license_id?: string | null;
};

export function usePitches(brandId?: string) {
  return useQuery({
    queryKey: ["pitches", brandId ?? "alla"],
    queryFn: async (): Promise<Pitch[]> => {
      let q = supabase.from("piches_pitches").select("*").order("created_at", { ascending: false });
      if (brandId) q = q.eq("brand_id", brandId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Pitch[];
    },
  });
}

/** En enskild affär, för arbetsytan där den faktiskt utförs. */
export function usePitch(id: string | undefined) {
  return useQuery({
    queryKey: ["pitch", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Pitch> => {
      const { data, error } = await supabase
        .from("piches_pitches")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Pitch;
    },
  });
}

/**
 * Varumärkets status speglar den affär som kommit längst. En kund som redan
 * levererat en gång ska inte hoppa tillbaka till "pitchad" bara för att en ny
 * pitch skickas, och en vunnen kund ska inte se ut som ett kallt lead.
 */
async function syncBrandStatus(brandId: string) {
  const { data } = await supabase.from("piches_pitches").select("status").eq("brand_id", brandId);
  const statuses = (data ?? []).map((r) => r.status as PitchStatus);
  if (statuses.length === 0) return;

  let brandStatus: string;
  if (statuses.some((s) => WON_STATUSES.includes(s))) brandStatus = "vunnen";
  else if (statuses.includes("offert")) brandStatus = "offert";
  else if (statuses.includes("svarat")) brandStatus = "svarat";
  else if (statuses.includes("skickad")) brandStatus = "pitchad";
  else if (statuses.every((s) => s === "forlorad" || s === "ingen_respons")) brandStatus = "vilande";
  else return; // bara utkast kvar, lat varumarket ligga dar det ar

  await supabase.from("piches_brands").update({ status: brandStatus }).eq("id", brandId);
}

export function useCreatePitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: PitchDraft): Promise<Pitch> => {
      const { data, error } = await supabase.from("piches_pitches").insert(draft).select().single();
      if (error) throw error;
      const pitch = data as Pitch;

      await supabase.from("piches_activities").insert({
        brand_id: pitch.brand_id,
        pitch_id: pitch.id,
        kind: "pitch",
        body: pitch.renewed_from_license_id
          ? "Förnyelseaffär skapad ur en licens som löper ut"
          : pitch.status === "skickad"
            ? "Pitch skickad"
            : "Pitchutkast skapat",
      });

      await syncBrandStatus(pitch.brand_id);
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

export function useUpdatePitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<PitchDraft>;
    }): Promise<Pitch> => {
      const { data, error } = await supabase
        .from("piches_pitches")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const pitch = data as Pitch;

      if (patch.status) {
        await supabase.from("piches_activities").insert({
          brand_id: pitch.brand_id,
          pitch_id: pitch.id,
          kind: "status",
          body: `Affären flyttades till ${PITCH_STATUS_LABEL[patch.status]}`,
        });
        await syncBrandStatus(pitch.brand_id);
      }

      return pitch;
    },
    onSuccess: (pitch) => {
      qc.invalidateQueries({ queryKey: ["pitches"] });
      qc.invalidateQueries({ queryKey: ["pitch", pitch.id] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useDeletePitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("piches_pitches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitches"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["deliverables"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
