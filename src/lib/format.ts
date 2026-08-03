const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
});

const moneyFmt = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
});

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return dateFmt.format(new Date(iso));
}

export function formatMoney(value: number | null): string {
  if (value === null) return "";
  return moneyFmt.format(value);
}

/** "3 dagar sedan", "om 2 dagar", "idag". Kort nog for att rymmas i en lista. */
export function relativeDays(iso: string | null): string {
  if (!iso) return "";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (days === 0) return "idag";
  if (days === 1) return "imorgon";
  if (days === -1) return "igår";
  return days > 0 ? `om ${days} dagar` : `${Math.abs(days)} dagar sedan`;
}
