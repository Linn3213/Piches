import type { Pitch } from "@/types/db";
import { WON_STATUSES } from "@/types/db";
import { daysBetween, parseDate } from "@/lib/rights";

/**
 * Pengarna, ärligt räknade.
 *
 * En creator ser nästan alltid omsättning och nästan aldrig lönsamhet. Det
 * är därför hon kan ha en kund som betalar bra och ändå gå back på den:
 * fyra revisionsrundor, inköpt redigering och tre veckors väntan syns
 * ingenstans i ett vanligt CRM.
 *
 * Modulen räknar därför tre saker som faktiskt styr besluten:
 *   1. vad som är kontrakterat, fakturerat och verkligen inbetalt
 *   2. vad varje affär gav per nedlagd timme
 *   3. hur stor del av omsättningen som hänger på en enda kund
 *
 * Rena funktioner på pitch-poster. Dagens datum skickas alltid in.
 */

/** Belopp exklusive moms, som allt annat i appen. */
export function isWon(p: Pitch): boolean {
  return WON_STATUSES.includes(p.status);
}

export function isInvoiced(p: Pitch): boolean {
  return p.invoiced_on !== null;
}

export function isPaid(p: Pitch): boolean {
  return p.paid_on !== null;
}

/**
 * Vinst före skatt på en enskild affär: ordervärdet minus det du köpte in.
 * Din egen tid är medvetet inte en kostnad här — den syns i stället som
 * timpenning, eftersom det är den siffran som går att jämföra mellan kunder.
 */
export function dealProfit(p: Pitch): number | null {
  if (p.value_sek === null) return null;
  return p.value_sek - (p.production_cost_sek ?? 0);
}

/**
 * Vad affären gav dig per timme. Det enda måttet som avslöjar vilka kunder
 * som är värda att behålla: en affär på 20 000 kronor som tog 40 timmar är
 * sämre än en på 8 000 som tog 5.
 */
export function dealHourlyRate(p: Pitch): number | null {
  const profit = dealProfit(p);
  if (profit === null || !p.hours_spent || p.hours_spent <= 0) return null;
  return profit / p.hours_spent;
}

export type MoneyPipeline = {
  /** Vunnet men ännu inte fakturerat. Pengar du har rätt till. */
  contracted: number;
  /** Fakturerat och fortfarande obetalt. Pengar på väg. */
  outstanding: number;
  /** Faktiskt inbetalt. */
  paid: number;
  /** Del av outstanding som passerat förfallodagen. */
  overdue: number;
};

export function moneyPipeline(pitches: Pitch[], today: Date): MoneyPipeline {
  let contracted = 0;
  let outstanding = 0;
  let paid = 0;
  let overdue = 0;

  for (const p of pitches) {
    const value = p.value_sek ?? 0;
    if (!isWon(p)) continue;

    if (isPaid(p)) {
      paid += value;
    } else if (isInvoiced(p)) {
      outstanding += value;
      if (p.due_on && daysBetween(today, parseDate(p.due_on)) < 0) overdue += value;
    } else {
      contracted += value;
    }
  }

  return { contracted, outstanding, paid, overdue };
}

export type OverdueInvoice = {
  pitch: Pitch;
  daysLate: number;
};

/**
 * Fakturor som passerat förfallodagen, mest försenade först. Sena
 * betalningar är den vanligaste dolda kostnaden i creator-verksamhet, och
 * de syns aldrig förrän någon räknar dagarna.
 */
export function overdueInvoices(pitches: Pitch[], today: Date): OverdueInvoice[] {
  return pitches
    .filter((p) => isInvoiced(p) && !isPaid(p) && p.due_on !== null)
    .map((p) => ({ pitch: p, daysLate: -daysBetween(today, parseDate(p.due_on as string)) }))
    .filter((r) => r.daysLate > 0)
    .sort((a, b) => b.daysLate - a.daysLate);
}

/** Fakturor som förfaller inom valt antal dagar, men inte är sena än. */
export function invoicesDueSoon(pitches: Pitch[], today: Date, withinDays: number): Pitch[] {
  return pitches
    .filter((p) => {
      if (!isInvoiced(p) || isPaid(p) || !p.due_on) return false;
      const left = daysBetween(today, parseDate(p.due_on));
      return left >= 0 && left <= withinDays;
    })
    .sort(
      (a, b) =>
        daysBetween(today, parseDate(a.due_on as string)) -
        daysBetween(today, parseDate(b.due_on as string)),
    );
}

/** Hur lång tid det faktiskt tar innan kunden betalar, i snitt. */
export function averageDaysToPayment(pitches: Pitch[]): number | null {
  const spans = pitches
    .filter((p) => p.invoiced_on && p.paid_on)
    .map((p) => daysBetween(parseDate(p.invoiced_on as string), parseDate(p.paid_on as string)));
  if (spans.length === 0) return null;
  return spans.reduce((a, b) => a + b, 0) / spans.length;
}

export type BrandEconomy = {
  brandId: string;
  deals: number;
  /** Summa ordervärde på vunna affärer, oavsett om de betalats. */
  won: number;
  paid: number;
  cost: number;
  hours: number;
  profit: number;
  /** null när timmarna inte är ifyllda, aldrig 0 — noll timmar vore en lögn. */
  hourlyRate: number | null;
  revisionRounds: number;
};

export function economyByBrand(pitches: Pitch[]): BrandEconomy[] {
  const map = new Map<string, BrandEconomy>();

  for (const p of pitches) {
    if (!isWon(p)) continue;
    const row =
      map.get(p.brand_id) ??
      ({
        brandId: p.brand_id,
        deals: 0,
        won: 0,
        paid: 0,
        cost: 0,
        hours: 0,
        profit: 0,
        hourlyRate: null,
        revisionRounds: 0,
      } satisfies BrandEconomy);

    row.deals += 1;
    row.won += p.value_sek ?? 0;
    if (isPaid(p)) row.paid += p.value_sek ?? 0;
    row.cost += p.production_cost_sek ?? 0;
    row.hours += p.hours_spent ?? 0;
    row.profit += dealProfit(p) ?? 0;
    row.revisionRounds += p.revision_rounds ?? 0;

    map.set(p.brand_id, row);
  }

  for (const row of map.values()) {
    row.hourlyRate = row.hours > 0 ? row.profit / row.hours : null;
  }

  return [...map.values()].sort((a, b) => b.won - a.won);
}

export type Concentration = {
  brandId: string;
  share: number;
  amount: number;
  total: number;
  brands: number;
};

/**
 * Koncentrationsrisken. Att 60 procent av omsättningen kommer från en enda
 * kund är inte en framgång, det är en uppsägning som väntar. Den siffran
 * finns i datan men ingen räknar den frivilligt.
 */
export function revenueConcentration(pitches: Pitch[]): Concentration | null {
  const rows = economyByBrand(pitches);
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, r) => sum + r.won, 0);
  if (total <= 0) return null;

  const top = rows[0];
  return {
    brandId: top.brandId,
    amount: top.won,
    share: top.won / total,
    total,
    brands: rows.length,
  };
}

export type MonthlyRevenue = { month: string; label: string; total: number };

const monthFmt = new Intl.DateTimeFormat("sv-SE", { month: "short", year: "2-digit" });

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Intäkt per månad, bokförd på när affären VANNS, inte när pitchen skickades.
 * Skillnaden är inte kosmetisk: en pitch skickad i mars som landar i juni är
 * en juniintäkt, och bokförs den i mars ser våren ut att gå bättre än den gör.
 */
export function revenueByMonth(pitches: Pitch[], today: Date, months = 6): MonthlyRevenue[] {
  const buckets: MonthlyRevenue[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets.push({ month: monthKey(d), label: monthFmt.format(d), total: 0 });
  }

  for (const p of pitches) {
    if (!isWon(p) || p.value_sek === null) continue;
    const stamp = p.won_at ?? p.paid_on ?? p.sent_at;
    if (!stamp) continue;
    const bucket = buckets.find((b) => b.month === monthKey(new Date(stamp)));
    if (bucket) bucket.total += p.value_sek;
  }

  return buckets;
}
