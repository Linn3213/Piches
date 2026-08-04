import type { License } from "@/types/db";

/**
 * Rättighetsmotorn — appens faktiska särdrag.
 *
 * Alla andra verktyg (Deelo, Beacons, MySocial, Passionfroot) betraktar
 * en affär som avslutad när fakturan är betald. Men en UGC-affär är en
 * licens med en klocka. Tre saker faller mellan stolarna hos dem, och det
 * är precis dem funktionerna här fångar:
 *
 *   1. licensen löper ut   -> ditt bästa säljläge, ingen påminner dig
 *   2. exklusivitet krockar -> du bryter ett avtal utan att veta om det
 *   3. materialet återgår   -> gammalt innehåll blir fritt att sälja igen
 *
 * Allt är rena funktioner på datum, utan sidoeffekter, så att de går att
 * testa och resonera om. Dagens datum skickas alltid in.
 */

export const DAY_MS = 86_400_000;

/** Datumsträngar från Postgres är "YYYY-MM-DD" — tolka dem lokalt, inte i UTC. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

export type LicenseState = "kommande" | "aktiv" | "utgar_snart" | "utgangen" | "evig";

export function licenseState(license: License, today: Date, leadDays: number): LicenseState {
  if (license.perpetual) return "evig";
  const starts = parseDate(license.starts_on);
  if (daysBetween(today, starts) > 0) return "kommande";
  if (!license.ends_on) return "aktiv";

  const daysLeft = daysBetween(today, parseDate(license.ends_on));
  if (daysLeft < 0) return "utgangen";
  if (daysLeft <= leadDays) return "utgar_snart";
  return "aktiv";
}

export function daysUntilExpiry(license: License, today: Date): number | null {
  if (license.perpetual || !license.ends_on) return null;
  return daysBetween(today, parseDate(license.ends_on));
}

/**
 * Utgångsradarn. Licenser som snart tar slut, närmast först.
 * Det här är listan som ska generera förnyelseintäkter.
 */
export function expiringLicenses(
  licenses: License[],
  today: Date,
  leadDays: number,
): License[] {
  return licenses
    .filter((l) => licenseState(l, today, leadDays) === "utgar_snart")
    .sort((a, b) => (daysUntilExpiry(a, today) ?? 0) - (daysUntilExpiry(b, today) ?? 0));
}

/** Licenser som redan gått ut men aldrig förnyats — missade intäkter. */
export function lapsedLicenses(licenses: License[], today: Date, leadDays: number): License[] {
  return licenses
    .filter((l) => licenseState(l, today, leadDays) === "utgangen")
    .sort((a, b) => (daysUntilExpiry(b, today) ?? 0) - (daysUntilExpiry(a, today) ?? 0));
}

/**
 * Exklusivitetsvakten.
 *
 * Innan du tackar ja till ett nytt uppdrag i en bransch: finns det en
 * levande exklusivitet mot någon annan? Det här är den kontroll ingen
 * annan app gör, och den som faktiskt kan rädda dig från ett avtalsbrott.
 */
export type ExclusivityConflict = {
  license: License;
  category: string;
  endsOn: string;
  daysLeft: number;
};

export function exclusivityConflicts(
  licenses: License[],
  category: string,
  startingOn: Date,
  excludeBrandId?: string,
): ExclusivityConflict[] {
  const needle = category.trim().toLowerCase();
  if (!needle) return [];

  return licenses
    .filter((l) => {
      if (!l.exclusive_category || !l.exclusivity_ends_on) return false;
      if (excludeBrandId && l.brand_id === excludeBrandId) return false;
      if (l.exclusive_category.trim().toLowerCase() !== needle) return false;
      // Krock bara om exklusiviteten fortfarande gäller när det nya jobbet startar.
      return daysBetween(startingOn, parseDate(l.exclusivity_ends_on)) >= 0;
    })
    .map((l) => ({
      license: l,
      category: l.exclusive_category as string,
      endsOn: l.exclusivity_ends_on as string,
      daysLeft: daysBetween(startingOn, parseDate(l.exclusivity_ends_on as string)),
    }))
    .sort((a, b) => b.daysLeft - a.daysLeft);
}

/**
 * Återlicensierbart lager: leverabler vars licenser alla gått ut och som
 * inte längre är låsta av exklusivitet. Färdigt material som får säljas
 * igen — ren marginal, ingen ny produktion.
 */
export function isRelicensable(
  licensesForDeliverable: License[],
  today: Date,
  leadDays: number,
): boolean {
  if (licensesForDeliverable.length === 0) return false;

  const allExpired = licensesForDeliverable.every(
    (l) => licenseState(l, today, leadDays) === "utgangen",
  );
  if (!allExpired) return false;

  // Exklusiviteten kan leva kvar efter att användningsrätten löpt ut.
  const stillExclusive = licensesForDeliverable.some(
    (l) =>
      l.exclusivity_ends_on !== null &&
      daysBetween(today, parseDate(l.exclusivity_ends_on)) >= 0,
  );
  return !stillExclusive;
}

/** Summan av rättighetsintäkter per varumärke — vem betalar faktiskt för licenser. */
export function rightsRevenueByBrand(licenses: License[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of licenses) {
    if (l.fee_sek === null) continue;
    out.set(l.brand_id, (out.get(l.brand_id) ?? 0) + l.fee_sek);
  }
  return out;
}
