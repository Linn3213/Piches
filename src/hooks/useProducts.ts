import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Product, ProductKind, ProductStatus } from "@/types/db";

export type ProductDraft = {
  name: string;
  kind: ProductKind;
  status?: ProductStatus;
  price_sek: number;
  build_hours: number;
  monthly_hours?: number;
  build_cost_sek?: number;
  monthly_cost_sek?: number;
  conversion_pct: number;
  recurring?: boolean;
  notes?: string | null;
  units_sold?: number;
  revenue_sek?: number;
};

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("piches_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: ProductDraft): Promise<Product> => {
      const { data, error } = await supabase
        .from("piches_products")
        .insert(draft)
        .select()
        .single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProductDraft> }) => {
      const { data, error } = await supabase
        .from("piches_products")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("piches_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}
