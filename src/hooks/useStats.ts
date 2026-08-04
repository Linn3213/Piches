import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Pitch } from "@/types/db";

export type MonthlyRevenue = { month: string; label: string; total: number };

export type Stats = {
  pitchesSent: number;
  pitchesSentLast30d: number;
  responded: number;
  responseRate: number | null;
  won: number;
  avgWonValue: number | null;
  revenueByMonth: MonthlyRevenue[];
};

// "svarat" ar det formella statusnamnet, men en pitch som gatt till offert,
// vunnen eller forlorad har uppenbarligen ocksa fatt svar.
const RESPONDED_STATUSES: Pitch["status"][] = ["svarat", "offert", "vunnen", "forlorad"];

const monthFmt = new Intl.DateTimeFormat("sv-SE", { month: "short", year: "2-digit" });

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async (): Promise<Stats> => {
      const { data, error } = await supabase
        .from("pitches")
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
      const responseRate = pitchesSent > 0 ? responded / pitchesSent : null;

      const won = pitches.filter((p) => p.status === "vunnen");
      const wonValues = won.map((p) => p.value_sek).filter((v): v is number => v !== null);
      const avgWonValue =
        wonValues.length > 0 ? wonValues.reduce((a, b) => a + b, 0) / wonValues.length : null;

      // De senaste 6 manaderna, aldsta forst, aven om nagon manad ar tom.
      const months: MonthlyRevenue[] = [];
      const cursor = new Date();
      cursor.setDate(1);
      for (let i = 5; i >= 0; i--) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.push({ month: key, label: monthFmt.format(d), total: 0 });
      }
      for (const p of won) {
        if (!p.sent_at || p.value_sek === null) continue;
        const d = new Date(p.sent_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const bucket = months.find((m) => m.month === key);
        if (bucket) bucket.total += p.value_sek;
      }

      return {
        pitchesSent,
        pitchesSentLast30d,
        responded,
        responseRate,
        won: won.length,
        avgWonValue,
        revenueByMonth: months,
      };
    },
  });
}
