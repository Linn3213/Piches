import { describe, expect, it } from "vitest";
import type { Brand, Deliverable, License, Pitch, Settings } from "@/types/db";
import { DEFAULT_SETTINGS } from "@/types/db";
import { addDays, buildInvoice, buildInvoiceLines, formatInvoiceNumber } from "@/lib/invoice";

const IDAG = new Date(2026, 7, 5);

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  user_id: "u",
  updated_at: "2026-08-05T00:00:00Z",
  onboarded_at: "2026-08-01T00:00:00Z",
  company_name: "Linn Lundholm AB",
  company_orgnr: "556677-8899",
  company_vat_nr: "SE556677889901",
  company_address: "Storgatan 1",
  company_zip: "111 22",
  company_city: "Stockholm",
  company_email: "info@essensiadesign.se",
  company_phone: null,
  has_f_skatt: true,
  vat_registered: true,
  payment_bankgiro: "123-4567",
  payment_iban: null,
  payment_bic: null,
  payment_swish: null,
  payment_terms_days: 30,
  invoice_prefix: "2026-",
  invoice_next_number: 42,
};

function brand(over: Partial<Brand> = {}): Brand {
  return {
    id: "b1", user_id: "u", name: "Verso Skincare", website: null, instagram: null,
    contact_name: null, contact_email: "ida@verso.se", tier: 1, status: "vunnen",
    source: null, observation: null, notes: null, next_action_at: null,
    org_nr: "556000-1111", vat_nr: "SE556000111101", address: "Testgatan 2",
    zip: "222 33", city: "Göteborg", country: "SE", is_company: true,
    invoice_reference: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function deal(over: Partial<Pitch> = {}): Pitch {
  return {
    id: "p1", user_id: "u", brand_id: "b1", status: "levererat", channel: "mejl",
    subject: "UGC-paket för serumlanseringen", body: null, observation: null,
    value_sek: 30000, sent_at: null, replied_at: null, follow_up_1_at: null,
    follow_up_2_at: null, won_at: null, invoice_number: null, invoiced_on: null,
    due_on: null, paid_on: null, production_cost_sek: null, hours_spent: null,
    revision_rounds: 0, renewed_from_license_id: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function license(over: Partial<License> = {}): License {
  return {
    id: "l1", user_id: "u", pitch_id: "p1", brand_id: "b1", deliverable_id: null,
    channels: ["organic_brand", "paid_social"], territory: "norden",
    starts_on: "2026-08-01", ends_on: "2027-02-01", perpetual: false,
    exclusive_category: null, exclusivity_ends_on: null, includes_raw_files: false,
    fee_sek: 12000, notes: null,
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

const deliverables: Deliverable[] = [
  {
    id: "d1", user_id: "u", pitch_id: "p1", brand_id: "b1", title: "Unboxning",
    format: "video", quantity: 3, delivered_at: null, approved_at: null,
    asset_url: null, hook: null, script: null, notes: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("datum och nummer", () => {
  it("räknar förfallodag från fakturadatum", () => {
    expect(addDays("2026-08-05", 30)).toBe("2026-09-04");
  });

  it("klarar månadsskifte", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("sätter ihop fakturanummer med prefix", () => {
    expect(formatInvoiceNumber(settings)).toBe("2026-42");
    expect(formatInvoiceNumber({ ...settings, invoice_prefix: null })).toBe("42");
  });
});

describe("fakturarader", () => {
  it("delar upp produktion och rättigheter var för sig", () => {
    const lines = buildInvoiceLines(deal(), deliverables, [license()]);
    expect(lines).toHaveLength(2);
    expect(lines[0].amount).toBe(18000); // 30000 - 12000
    expect(lines[1].amount).toBe(12000);
    expect(lines[1].description).toContain("Nyttjanderätt");
  });

  it("skriver ut vad rättigheterna faktiskt omfattar", () => {
    const lines = buildInvoiceLines(deal(), deliverables, [license()]);
    expect(lines[1].detail).toContain("Betald annonsering");
    expect(lines[1].detail).toContain("Norden");
    expect(lines[1].detail).toContain("2027-02-01");
  });

  it("specificerar leverablerna på produktionsraden", () => {
    const lines = buildInvoiceLines(deal(), deliverables, [license()]);
    expect(lines[0].detail).toBe("3 video");
  });

  it("lägger allt på en rad när licensen saknar pris, i stället för att hitta på", () => {
    const lines = buildInvoiceLines(deal(), deliverables, [license({ fee_sek: null })]);
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(30000);
  });

  it("hittar inte på en uppdelning när licensen kostar mer än affären", () => {
    const lines = buildInvoiceLines(deal({ value_sek: 10000 }), deliverables, [license()]);
    expect(lines[0].amount).toBe(10000);
  });

  it("skriver utan tidsbegränsning för en evig licens", () => {
    const lines = buildInvoiceLines(deal(), deliverables, [
      license({ perpetual: true, ends_on: null }),
    ]);
    expect(lines[1].detail).toContain("utan tidsbegränsning");
  });
});

describe("hela fakturan", () => {
  it("lägger på svensk moms för en svensk kund", () => {
    const inv = buildInvoice({ deal: deal(), brand: brand(), deliverables, licenses: [license()], settings, today: IDAG });
    expect(inv.totals.net).toBe(30000);
    expect(inv.totals.vat).toBe(7500);
    expect(inv.totals.gross).toBe(37500);
    expect(inv.vat.invoiceNote).toBeNull();
  });

  it("växlar till omvänd betalningsskyldighet för ett tyskt bolag", () => {
    const inv = buildInvoice({
      deal: deal(),
      brand: brand({ country: "DE", vat_nr: "DE123456789" }),
      deliverables, licenses: [license()], settings, today: IDAG,
    });
    expect(inv.totals.vat).toBe(0);
    expect(inv.totals.gross).toBe(30000);
    expect(inv.vat.invoiceNote).toContain("Omvänd betalningsskyldighet");
  });

  it("sätter förfallodag efter betalningsvillkoret", () => {
    const inv = buildInvoice({ deal: deal(), brand: brand(), deliverables, licenses: [license()], settings, today: IDAG });
    expect(inv.issuedOn).toBe("2026-08-05");
    expect(inv.dueOn).toBe("2026-09-04");
  });

  it("respekterar datum som redan satts på affären", () => {
    const inv = buildInvoice({
      deal: deal({ invoiced_on: "2026-07-01", due_on: "2026-07-15" }),
      brand: brand(), deliverables, licenses: [license()], settings, today: IDAG,
    });
    expect(inv.issuedOn).toBe("2026-07-01");
    expect(inv.dueOn).toBe("2026-07-15");
  });
});

describe("brister som stoppar fakturan", () => {
  it("är tyst när allt är ifyllt", () => {
    const inv = buildInvoice({ deal: deal(), brand: brand(), deliverables, licenses: [license()], settings, today: IDAG });
    expect(inv.problems).toHaveLength(0);
  });

  it("påpekar saknat organisationsnummer och betalväg", () => {
    const inv = buildInvoice({
      deal: deal(), brand: brand(), deliverables, licenses: [license()],
      settings: { ...settings, company_orgnr: null, payment_bankgiro: null },
      today: IDAG,
    });
    expect(inv.problems.some((p) => p.includes("organisationsnummer"))).toBe(true);
    expect(inv.problems.some((p) => p.includes("betalväg"))).toBe(true);
  });

  it("kräver momsnummer på kunden vid omvänd betalningsskyldighet", () => {
    const inv = buildInvoice({
      deal: deal(), brand: brand({ country: "DE", vat_nr: null }),
      deliverables, licenses: [license()], settings, today: IDAG,
    });
    expect(inv.problems.some((p) => p.includes("momsnummer"))).toBe(true);
  });

  it("kräver IBAN för utländsk kund", () => {
    const inv = buildInvoice({
      deal: deal(), brand: brand({ country: "DE", vat_nr: "DE123456789" }),
      deliverables, licenses: [license()], settings, today: IDAG,
    });
    expect(inv.problems.some((p) => p.includes("IBAN"))).toBe(true);
  });

  it("påpekar att det inte finns något att fakturera", () => {
    const inv = buildInvoice({
      deal: deal({ value_sek: null }), brand: brand(), deliverables,
      licenses: [license({ fee_sek: null })], settings, today: IDAG,
    });
    expect(inv.problems.some((p) => p.includes("inget belopp"))).toBe(true);
  });
});
