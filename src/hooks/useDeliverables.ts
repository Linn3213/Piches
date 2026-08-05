import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Deliverable, DeliverableFormat } from "@/types/db";

export type DeliverableDraft = {
  pitch_id: string;
  brand_id: string;
  title: string;
  format: DeliverableFormat;
  quantity: number;
  hook?: string | null;
  script?: string | null;
  asset_url?: string | null;
  notes?: string | null;
};

export function useDeliverables(pitchId?: string) {
  return useQuery({
    queryKey: ["deliverables", pitchId ?? "alla"],
    queryFn: async (): Promise<Deliverable[]> => {
      let q = supabase
        .from("piches_deliverables")
        .select("*")
        .order("created_at", { ascending: false });
      if (pitchId) q = q.eq("pitch_id", pitchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Deliverable[];
    },
  });
}

export function useCreateDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: DeliverableDraft) => {
      const { data, error } = await supabase
        .from("piches_deliverables")
        .insert(draft)
        .select()
        .single();
      if (error) throw error;
      return data as Deliverable;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliverables"] });
      qc.invalidateQueries({ queryKey: ["expiry-radar"] });
    },
  });
}

export function useUpdateDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Deliverable> }) => {
      const { data, error } = await supabase
        .from("piches_deliverables")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Deliverable;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliverables"] });
      qc.invalidateQueries({ queryKey: ["expiry-radar"] });
    },
  });
}

export function useDeleteDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("piches_deliverables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliverables"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
    },
  });
}
