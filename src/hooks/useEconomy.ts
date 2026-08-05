import { useMemo } from "react";
import { usePitches } from "@/hooks/usePitches";
import {
  averageDaysToPayment,
  economyByBrand,
  invoicesDueSoon,
  moneyPipeline,
  overdueInvoices,
  revenueByMonth,
  revenueConcentration,
  type BrandEconomy,
  type Concentration,
  type MonthlyRevenue,
  type MoneyPipeline,
  type OverdueInvoice,
} from "@/lib/economy";
import type { Pitch } from "@/types/db";

export type Economy = {
  money: MoneyPipeline;
  overdue: OverdueInvoice[];
  dueSoon: Pitch[];
  byBrand: BrandEconomy[];
  concentration: Concentration | null;
  avgDaysToPayment: number | null;
  revenueByMonth: MonthlyRevenue[];
  isLoading: boolean;
};

/**
 * All ekonomi räknas i webbläsaren ur pitcharna som redan hämtats. Det håller
 * en enda sanning om vad en vunnen affär är, i stället för att duplicera den
 * regeln i en databasvy som sedan glider isär från koden.
 */
export function useEconomy(): Economy {
  const { data: pitches, isLoading } = usePitches();

  return useMemo(() => {
    const all = pitches ?? [];
    const today = new Date();
    return {
      money: moneyPipeline(all, today),
      overdue: overdueInvoices(all, today),
      dueSoon: invoicesDueSoon(all, today, 14),
      byBrand: economyByBrand(all),
      concentration: revenueConcentration(all),
      avgDaysToPayment: averageDaysToPayment(all),
      revenueByMonth: revenueByMonth(all, today, 6),
      isLoading,
    };
  }, [pitches, isLoading]);
}
