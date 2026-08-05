import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Pitch } from "@/types/db";
import { RESPONDED_STATUSES, WON_STATUSES } from "@/types/db";

export type Stats = {
  pitchesSent: number;
  pitchesSentLast30d: number;
  responded: number;
  responseRate: number | null;
  won: number;
  avgWonValue: number | null;
};

/**
 * Pitchstatistiken. Definitionen av vunnet och besvarat kommer från
 * types/db.ts, så att den inte hinner glida isär från resten av appen: en
 * affär i produktion är lika vunnen som en betald, och en förlorad affär har
 * uppenbarligen också fått svar.
 *
 * Pengarna räknas inte här utan i lib/economy.ts, som utgår från hela
 * pitchlistan i stället för ett bantat urval.
 */
export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async (): Promise<Stats> => {
      const { data, error } = await supabase
        .from("piches_pitches")
        .select("status, sent_at, value_sek")
        .not("sent_at", "is", null);
      if (error) throw error;
      const pitches = data as Pick<Pitch, "status" | "sent_at" | "value_sek">[];

      const pitchesSent = pitches.length;
      const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
      const pitchesSentLast30d = pitches.filter(
        (p) => p.sent_at && new Date(p.sent_at).getTime() >= thirtyDaysAgo,
      ).length;

      const responded = pitches.filter((p) => RESPONDED_STATUSES.includes(p.status)).length;
      const won = pitches.filter((p) => WON_STATUSES.includes(p.status));
      const wonValues = won.map((p) => p.value_sek).filter((v): v is number => v !== null);

      return {
        pitchesSent,
        pitchesSentLast30d,
        responded,
        responseRate: pitchesSent > 0 ? responded / pitchesSent : null,
        won: won.length,
        avgWonValue:
          wonValues.length > 0 ? wonValues.reduce((a, b) => a + b, 0) / wonValues.length : null,
      };
    },
  });
}
