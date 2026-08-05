/**
 * Momsen.
 *
 * Det här är den del inget av de internationella creator-verktygen gör, och
 * den som gör mest skada när den blir fel: fakturerar du 25 procent moms till
 * ett tyskt bolag har du tagit betalt för en skatt du sedan ska betala in,
 * och missar du att skriva ut omvänd betalningsskyldighet är fakturan
 * formellt ofullständig.
 *
 * Modulen FÖRESLÅR en behandling och skriver ut varför. Den bestämmer inte.
 * Sista ordet är alltid ditt, och för udda fall ska du fråga din redovisning.
 */

/** EU utom Sverige. Sverige hanteras för sig eftersom svensk moms gäller där. */
export const EU_COUNTRIES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
] as const;

export const STANDARD_VAT_RATE = 25;

export function isEuCountry(country: string): boolean {
  return (EU_COUNTRIES as readonly string[]).includes(country.trim().toUpperCase());
}

export type VatTreatmentKind =
  | "svensk_moms"
  | "omvand_betalningsskyldighet"
  | "utanfor_eu"
  | "ej_momsregistrerad";

export type VatTreatment = {
  kind: VatTreatmentKind;
  /** Procentsats att lägga på. Noll betyder att ingen moms ska debiteras. */
  rate: number;
  /** Kort etikett för gränssnittet. */
  label: string;
  /**
   * Texten som MÅSTE stå på fakturan när momsen inte är svensk. Null när
   * vanlig svensk moms gäller och ingen särskild hänvisning behövs.
   */
  invoiceNote: string | null;
  /** Varför det blev så här, i klartext. */
  reason: string;
  /** Något behöver kontrolleras innan fakturan skickas. */
  warning: string | null;
};

export type VatInput = {
  /** Är du momsregistrerad? Under omsättningsgränsen behöver du inte vara det. */
  sellerVatRegistered: boolean;
  /** Kundens land som tvåbokstavskod, till exempel SE eller DE. */
  customerCountry: string;
  /** Företag eller privatperson. */
  customerIsCompany: boolean;
  /** Kundens momsregistreringsnummer, om det finns. */
  customerVatNumber: string | null;
};

/**
 * Ett giltigt EU-momsnummer inleds med landskoden och följs av tecken enligt
 * landets eget format. Kontrollen här är avsiktligt grov: den fångar tomma
 * fält, uppenbart för korta nummer och fel landskod, alltså de fel som
 * faktiskt uppstår när man skriver av från ett mejl. Den säger ingenting om
 * numret är registrerat, det kan bara VIES svara på.
 */
export function looksLikeVatNumber(vat: string | null, country: string): boolean {
  if (!vat) return false;
  const clean = vat.replace(/[\s.-]/g, "").toUpperCase();
  const cc = country.trim().toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{6,14}$/.test(clean)) return false;
  return clean.startsWith(cc);
}

export function determineVat(input: VatInput): VatTreatment {
  const country = input.customerCountry.trim().toUpperCase();

  // 1. Inte momsregistrerad. Da laggs aldrig moms pa, oavsett kund.
  if (!input.sellerVatRegistered) {
    return {
      kind: "ej_momsregistrerad",
      rate: 0,
      label: "Ingen moms",
      invoiceNote: "Ej momsregistrerad.",
      reason:
        "Du har angett att du inte är momsregistrerad, och då ska ingen moms debiteras på fakturan.",
      warning:
        "Passerar du omsättningsgränsen under året behöver du registrera dig, och då ändras det här.",
    };
  }

  // 2. Svensk kund. Vanlig svensk moms, oavsett foretag eller privatperson.
  if (country === "SE") {
    return {
      kind: "svensk_moms",
      rate: STANDARD_VAT_RATE,
      label: `Svensk moms ${STANDARD_VAT_RATE} %`,
      invoiceNote: null,
      reason: "Kunden finns i Sverige, så vanlig svensk moms gäller.",
      warning: null,
    };
  }

  // 3. Foretag i ovriga EU med momsnummer. Kopplaren redovisar momsen sjalv.
  if (isEuCountry(country) && input.customerIsCompany) {
    const validVat = looksLikeVatNumber(input.customerVatNumber, country);
    return {
      kind: "omvand_betalningsskyldighet",
      rate: 0,
      label: "Omvänd betalningsskyldighet",
      invoiceNote: "Omvänd betalningsskyldighet. Reverse charge.",
      reason:
        "Kunden är ett företag i ett annat EU-land, så köparen redovisar momsen i sitt eget land i stället för du.",
      warning: validVat
        ? null
        : "Momsnumret saknas eller ser inte rätt ut. Utan ett giltigt nummer ska du debitera svensk moms i stället, så kontrollera det innan du skickar.",
    };
  }

  // 4. Privatperson i ovriga EU. Da ar det fortfarande svensk moms.
  if (isEuCountry(country) && !input.customerIsCompany) {
    return {
      kind: "svensk_moms",
      rate: STANDARD_VAT_RATE,
      label: `Svensk moms ${STANDARD_VAT_RATE} %`,
      invoiceNote: null,
      reason:
        "Kunden är en privatperson inom EU, och då gäller svensk moms precis som för en svensk kund.",
      warning:
        "Säljer du mycket till privatpersoner i andra EU-länder finns tröskelregler som kan ändra det här. Stäm av med din redovisning.",
    };
  }

  // 5. Utanfor EU. Tjansten omsatts utomlands.
  return {
    kind: "utanfor_eu",
    rate: 0,
    label: "Utanför EU",
    invoiceNote: "Omsättning utanför EU. Outside the scope of EU VAT.",
    reason: "Kunden finns utanför EU, så svensk moms ska inte debiteras.",
    warning:
      "Kontrollera att kunden verkligen är ett företag utanför EU, och spara underlaget som visar det.",
  };
}

export type VatLines = {
  net: number;
  vat: number;
  gross: number;
  rate: number;
};

/** Belopp anges alltid exklusive moms i appen, så momsen läggs på här. */
export function applyVat(netAmount: number, treatment: VatTreatment): VatLines {
  const vat = Math.round(netAmount * treatment.rate) / 100;
  return {
    net: netAmount,
    vat,
    gross: netAmount + vat,
    rate: treatment.rate,
  };
}
