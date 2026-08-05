const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
});

const dateWithYearFmt = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const moneyFmt = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
});

/** Kort datum utan årtal. Bara för saker som självklart hör till nuet. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return dateFmt.format(new Date(iso));
}

/**
 * Datum med årtal. Används för allt som binder dig: licensens start och slut,
 * exklusiviteten, fakturans förfallodag.
 *
 * Anledningen till att det behöver vara en egen funktion: en tolvmånaderslicens
 * som börjar den 5 augusti slutar den 5 augusti NÄSTA år, och utan årtal i
 * texten går det inte att skilja från idag. Det är precis den förväxlingen som
 * gör att någon tror att licensen redan gått ut, eller tvärtom att den har ett
 * år kvar när den går ut om en vecka.
 */
export function formatDateFull(iso: string | null): string {
  if (!iso) return "";
  return dateWithYearFmt.format(new Date(iso));
}

export function formatMoney(value: number | null): string {
  if (value === null) return "";
  return moneyFmt.format(value);
}

/**
 * "1 faktura" men "2 fakturor". Utan den här blir det "1 fakturor" överallt
 * där en siffra möter ett substantiv, och det läser som maskin snarare än
 * som någon som skrivit texten själv.
 */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "1 dag" eller "5 dagar". Räknas oftast i den här appen. */
export function days(count: number): string {
  return plural(count, "dag", "dagar");
}

/** "3 dagar sedan", "om 2 dagar", "idag". Kort nog for att rymmas i en lista. */
export function relativeDays(iso: string | null): string {
  if (!iso) return "";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (days === 0) return "idag";
  if (days === 1) return "imorgon";
  if (days === -1) return "igår";
  return days > 0 ? `om ${plural(days, "dag", "dagar")}` : `${plural(Math.abs(days), "dag", "dagar")} sedan`;
}
