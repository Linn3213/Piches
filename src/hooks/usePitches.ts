import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Pitch, PitchChannel, PitchStatus } from "@/types/db";

export type PitchDraft = {
  brand_id: string;
  status?: PitchStatus;
  channel?: PitchChannel;
  subject?: string | null;
  observation?: string | null;
  body?: string | null;
  value_sek?: number | null;
  sent_at?: string | null;
};

export function usePitches(brandId?: string) {
  return useQuery({
    queryKey: ["pitches", brandId ?? "alla"],
    queryFn: async (): Promise<Pitch[]> => {
      let q = supabase.from("pitches").select("*").order("created_at", { ascending: false });
      if (brandId) q = q.eq("brand_id", brandId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Pitch[];
    },
  });
}

export function useCreatePitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: PitchDraft): Promise<Pitch> => {
      const { data, error } = await supabase.from("pitches").insert(draft).select().single();
      if (error) throw error;
      const pitch = data as Pitch;

      await supabase.from("activities").insert({
        brand_id: pitch.brand_id,
        pitch_id: pitch.id,
        kind: "pitch",
        body: pitch.status === "skickad" ? "Pitch skickad" : "Pitchutkast skapat",
      });

      // En skickad pitch flyttar automatiskt varumarket framat i pipelinen.
      if (pitch.status === "skickad") {
        await supabase.from("brands").update({ status: "pitchad" }).eq("id", pitch.brand_id);
      }

      return pitch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitches"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdatePitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PitchDraft> }): Promise<Pitch> => {
      const { data, error } = await supabase
        .from("pitches")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Pitch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitches"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
