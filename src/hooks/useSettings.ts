import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, type Settings } from "@/types/db";

/**
 * Prislistan. Raden skapas lat vid första inloggningen — det slipper vi
 * göra med en trigger på auth.users, som är förbjuden i det delade projektet.
 */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from("piches_settings").select("*").maybeSingle();
      if (error) throw error;
      if (data) return data as Settings;

      const { data: created, error: insertError } = await supabase
        .from("piches_settings")
        .insert(DEFAULT_SETTINGS)
        .select()
        .single();
      if (insertError) throw insertError;
      return created as Settings;
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { data: existing } = await supabase.from("piches_settings").select("user_id").maybeSingle();
      if (!existing) throw new Error("Prislistan är inte skapad än.");

      const { data, error } = await supabase
        .from("piches_settings")
        .update(patch)
        .eq("user_id", existing.user_id)
        .select()
        .single();
      if (error) throw error;
      return data as Settings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
    },
  });
}
