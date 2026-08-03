import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Brand, BrandStatus } from "@/types/db";

export type BrandDraft = {
  name: string;
  website?: string | null;
  instagram?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  tier?: 1 | 2 | 3;
  status?: BrandStatus;
  source?: string | null;
  observation?: string | null;
  notes?: string | null;
  next_action_at?: string | null;
};

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Brand[];
    },
  });
}

export function useBrand(id: string | undefined) {
  return useQuery({
    queryKey: ["brands", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Brand> => {
      const { data, error } = await supabase.from("brands").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Brand;
    },
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: BrandDraft): Promise<Brand> => {
      const { data, error } = await supabase.from("brands").insert(draft).select().single();
      if (error) throw error;

      await supabase.from("activities").insert({
        brand_id: (data as Brand).id,
        kind: "system",
        body: `Lade till ${draft.name} som lead`,
      });

      return data as Brand;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BrandDraft> }): Promise<Brand> => {
      const { data, error } = await supabase
        .from("brands")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // Statusbyten loggas, resten inte. Statistiken i vecka 3 laser loggen.
      if (patch.status) {
        await supabase.from("activities").insert({
          brand_id: id,
          kind: "status",
          body: `Status: ${patch.status}`,
        });
      }

      return data as Brand;
    },
    onSuccess: (brand) => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["brands", brand.id] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });
}
