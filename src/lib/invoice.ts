import type { Brand, Deliverable, License, Pitch, Settings } from "@/types/db";
import { CHANNEL_LABEL, FORMAT_LABEL, TERRITORY_LABEL } from "@/types/db";
import { applyVat, determineVat, type VatLines, type VatTreatment } from "@/lib/vat";
import { parseDate } from "@/lib/rights";

/**
 * Fakturaunderlaget.
 *
 * Appen skapar dokumentet, inte arkivet. Bokföringslagens krav på sju års
 * bevarande ligger på den bokföringsskyldiga, alltså på användaren och hennes
 * bokföringssystem, och därför sparas här bara numret, datumen och beloppen.
 * Se docs/scope-arkitektur-v1.md avsnitt 2.
 *
 * Det som gör fakturan värd att generera härifrån snarare än i ett
 * ordbehandlingsprogram är att den kan beskriva vad som faktiskt såldes: inte
 * bara "UGC-samarbete" utan produktionen för sig och rättigheterna för sig,
 * med kanaler, marknad och licenstid utskrivna. Det är samma uppdelning som
 * priset byggdes på, och den gör fakturan svår att ifrågasätta.
 */

export type InvoiceLine = {
  description: string;
  detail: string | null;
  amount: number;
};

export type InvoiceParty = {
  name: string;
  orgNr: string | null;
  vatNr: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string;
  email: string | null;
};

export type Invoice = {
  number: string;
  issuedOn: string;
  dueOn: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  buyerReference: string | null;
  lines: InvoiceLine[];
  vat: VatTreatment;
  totals: VatLines;
  hasFSkatt: boolean;
  payment: {
    bankgiro: string | null;
    iban: string | null;
    bic: string | null;
    swish: string | null;
    termsDays: number;
  };
  /** Det som måste åtgärdas innan fakturan går att skicka. */
  problems: string[];
};

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function formatInvoiceNumber(settings: Settings): string {
  const prefix = settings.invoice_prefix?.trim();
  const n = String(settings.invoice_next_number);
  return prefix ? `${prefix}${n}` : n;
}

function licenseSummary(license: License): string {
  const kanaler = license.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(", ");
  const marknad = TERRITORY_LABEL[license.territory];
  const tid = license.perpetual
    ? "utan tidsbegränsning"
    : license.ends_on
      ? `till och med ${license.ends_on}`
      : "";
  const delar = [kanaler, marknad, tid].filter(Boolean);
  return delar.join(", ");
}

/**
 * Bygger raderna. Produktionen och rättigheterna hålls isär, eftersom det är
 * den uppdelningen som förklarar priset: en licens som kostar mer än filmen
 * ser orimlig ut tills man ser att den täcker annonsering i tolv månader.
 */
export function buildInvoiceLines(
  deal: Pitch,
  deliverables: Deliverable[],
  licenses: License[],
): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  const licensSumma = licenses.reduce((sum, l) => sum + (l.fee_sek ?? 0), 0);
  const total = deal.value_sek ?? 0;

  // Ar licenserna prissatta var for sig blir uppdelningen exakt. Annars
  // redovisas hela beloppet pa en rad, hellre an att hitta pa en fordelning.
  const produktion = licensSumma > 0 && licensSumma <= total ? total - licensSumma : total;

  if (produktion > 0) {
    const spec = deliverables.length
      ? deliverables
          .map((d) => `${d.quantity} ${FORMAT_LABEL[d.format].toLowerCase()}`)
          .join(", ")
      : null;
    lines.push({
      description: deal.subject?.trim() || "Produktion av innehåll",
      detail: spec,
      amount: produktion,
    });
  }

  for (const l of licenses) {
    if (l.fee_sek === null || l.fee_sek <= 0) continue;
    lines.push({
      description: "Nyttjanderätt till materialet",
      detail: licenseSummary(l),
      amount: l.fee_sek,
    });
  }

  return lines;
}

export function buildInvoice({
  deal,
  brand,
  deliverables,
  licenses,
  settings,
  today,
}: {
  deal: Pitch;
  brand: Brand;
  deliverables: Deliverable[];
  licenses: License[];
  settings: Settings;
  today: Date;
}): Invoice {
  const issuedOn =
    deal.invoiced_on ??
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;

  const vat = determineVat({
    sellerVatRegistered: settings.vat_registered,
    customerCountry: brand.country,
    customerIsCompany: brand.is_company,
    customerVatNumber: brand.vat_nr,
  });

  const lines = buildInvoiceLines(deal, deliverables, licenses);
  const net = lines.reduce((sum, l) => sum + l.amount, 0);
  const totals = applyVat(net, vat);

  // Det som gor att fakturan inte gar att skicka, eller inte ar formellt
  // komplett. Bristerna listas i stallet for att tyst utelamnas, eftersom en
  // faktura utan organisationsnummer eller betalvag inte blir betald.
  const problems: string[] = [];
  if (!settings.company_name?.trim()) problems.push("Ditt företagsnamn saknas.");
  if (!settings.company_orgnr?.trim()) problems.push("Ditt organisationsnummer saknas.");
  if (settings.vat_registered && !settings.company_vat_nr?.trim())
    problems.push("Ditt momsregistreringsnummer saknas, och det krävs när du är momsregistrerad.");
  if (
    !settings.payment_bankgiro?.trim() &&
    !settings.payment_iban?.trim() &&
    !settings.payment_swish?.trim()
  )
    problems.push("Ingen betalväg är ifylld, så kunden har ingenting att betala till.");
  if (!brand.name.trim()) problems.push("Kundens namn saknas.");
  if (brand.country !== "SE" && !settings.payment_iban?.trim())
    problems.push("Utländsk kund behöver IBAN och BIC för att kunna betala.");
  if (vat.kind === "omvand_betalningsskyldighet" && !brand.vat_nr?.trim())
    problems.push("Kundens momsnummer saknas, och det måste stå på fakturan vid omvänd betalningsskyldighet.");
  if (lines.length === 0) problems.push("Det finns inget belopp att fakturera.");

  return {
    number: deal.invoice_number?.trim() || formatInvoiceNumber(settings),
    issuedOn,
    dueOn: deal.due_on ?? addDays(issuedOn, settings.payment_terms_days),
    seller: {
      name: settings.company_name ?? "",
      orgNr: settings.company_orgnr,
      vatNr: settings.company_vat_nr,
      address: settings.company_address,
      zip: settings.company_zip,
      city: settings.company_city,
      country: "SE",
      email: settings.company_email,
    },
    buyer: {
      name: brand.name,
      orgNr: brand.org_nr,
      vatNr: brand.vat_nr,
      address: brand.address,
      zip: brand.zip,
      city: brand.city,
      country: brand.country,
      email: brand.contact_email,
    },
    buyerReference: brand.invoice_reference,
    lines,
    vat,
    totals,
    hasFSkatt: settings.has_f_skatt,
    payment: {
      bankgiro: settings.payment_bankgiro,
      iban: settings.payment_iban,
      bic: settings.payment_bic,
      swish: settings.payment_swish,
      termsDays: settings.payment_terms_days,
    },
    problems,
  };
}
