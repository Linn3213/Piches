import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Activity } from "@/types/db";

export function useActivities(brandId: string | undefined) {
  return useQuery({
    queryKey: ["activities", brandId],
    enabled: Boolean(brandId),
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("brand_id", brandId!)
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Activity[];
    },
  });
}
