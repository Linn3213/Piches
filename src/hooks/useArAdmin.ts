import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Är den inloggade administratör?
 *
 * Används bara för att avgöra om menyvalet ska synas. Själva skyddet ligger i
 * databasen, så en användare som gissar adressen får ändå ingenting. Att dölja
 * en flik är bekvämlighet, inte säkerhet, och de två får aldrig blandas ihop.
 */
export function useArAdmin() {
  return useQuery({
    queryKey: ["ar-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("piches_ar_admin");
      if (error) return false;
      return data === true;
    },
    staleTime: 5 * 60_000,
  });
}
