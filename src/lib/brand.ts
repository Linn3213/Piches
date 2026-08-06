/**
 * TRE LAGER, EN KODBAS.
 *
 * standalone   = Piches egen identitet (sagegrönt, Syne). Default, rörs aldrig.
 * essensia     = pålagt skin, skogsgrön/linne, för app.essensiadesign.se
 * linnartistry = pålagt skin, cream/espresso, för app.linnartistry.se
 *
 * Skinnen är ADDITIVA. Standalone-värdena i index.css är Piches ursprungliga
 * hex-koder, verbatim, och får aldrig ändras för att en skin ska bli snyggare.
 */

export type Brand = "standalone" | "essensia" | "linnartistry";

function resolveBrand(): Brand {
  const raw = import.meta.env.VITE_BRAND as string | undefined;
  if (raw === "essensia" || raw === "linnartistry") return raw;
  return "standalone";
}

export const BRAND: Brand = resolveBrand();
export const isStandalone = BRAND === "standalone";
export const isEssensia = BRAND === "essensia";
export const isLinnArtistry = BRAND === "linnartistry";

/** Standalone har ingen avsändarrad — appen står för sig själv. */
export const BRAND_LABEL: string | null = isLinnArtistry
  ? "En del av LinnArtistry"
  : isEssensia
    ? "En del av Essensia Design"
    : null;

export const BRAND_COMPANY: string | null = isLinnArtistry
  ? "LinnArtistry"
  : isEssensia
    ? "Essensia Design"
    : null;
