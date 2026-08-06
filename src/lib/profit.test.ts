import { describe, expect, it } from "vitest";
import type { Brand, License, Pitch, PitchStatus, Settings } from "@/types/db";
import { DEFAULT_SETTINGS } from "@/types/db";
import { actualHourlyRate, findLeaks, monthlyGoal, slowPayers } from "@/lib/profit";
import { forecastProduct, suggestProducts } from "@/lib/product";
import { economyByBrand } from "@/lib/economy";

const IDAG = new Date(2026, 7, 5); // 5 aug 2026

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  user_id: "u",
  updated_at: "2026-08-05T00:00:00Z",
  target_hourly_rate: 1200,
  target_monthly_revenue: 50000,
  audience_size: 12000,
  email_list_size: 800,
};

function pitch(over: Partial<Pitch> & { status: PitchStatus }): Pitch {
  return {
    id: Math.random().toString(36).slice(2), user_id: "u", brand_id: "b1",
    channel: "mejl", subject: null, body: null, observation: null, value_sek: null,
    sent_at: null, replied_at: null, follow_up_1_at: null, follow_up_2_at: null,
    won_at: null, invoice_number: null, invoiced_on: null, due_on: null, paid_on: null,
    production_cost_sek: null, hours_spent: null, revision_rounds: 0,
    renewed_from_license_id: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const brands: Brand[] = [
  { id: "b1", user_id: "u", name: "Verso", website: null, instagram: null, contact_name: null, contact_email: null, tier: 1, status: "vunnen", source: null, observation: null, notes: null, next_action_at: null, org_nr: null, vat_nr: null, address: null, zip: null, city: null, country: "SE", is_company: true, invoice_reference: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  { id: "b2", user_id: "u", name: "Lyko", website: null, instagram: null, contact_name: null, contact_email: null, tier: 2, status: "vunnen", source: null, observation: null, notes: null, next_action_at: null, org_nr: null, vat_nr: null, address: null, zip: null, city: null, country: "SE", is_company: true, invoice_reference: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
];

function license(over: Partial<License> = {}): License {
  return {
    id: "l1", user_id: "u", pitch_id: "p1", brand_id: "b1", deliverable_id: null,
    channels: ["paid_social"], territory: "se", starts_on: "2025-01-01",
    ends_on: "2026-01-01", perpetual: false, exclusive_category: null,
    exclusivity_ends_on: null, includes_raw_files: false, fee_sek: 15000, notes: null,
    created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z",
    ...over,
  };
}

describe("faktisk timpenning", () => {
  it("räknar vinst delat med nedlagd tid", () => {
    const r = actualHourlyRate([
      pitch({ status: "betalt", value_sek: 20000, production_cost_sek: 2000, hours_spent: 10 }),
      pitch({ status: "betalt", value_sek: 10000, hours_spent: 5 }),
    ]);
    // (18000 + 10000) / 15
    expect(r).toBeCloseTo(1866.67, 1);
  });

  it("ger null när ingen tid är ifylld, i stället för att låtsas", () => {
    expect(actualHourlyRate([pitch({ status: "betalt", value_sek: 20000 })])).toBeNull();
    expect(actualHourlyRate([])).toBeNull();
  });
});

describe("läckor", () => {
  it("hittar kunder under måltimpenningen och sätter pris på skillnaden", () => {
    const leaks = findLeaks({
      pitches: [pitch({ status: "betalt", brand_id: "b1", value_sek: 10000, hours_spent: 20 })],
      brands, licenses: [], settings, today: IDAG,
    });
    const l = leaks.find((x) => x.kind === "under_maltimpenning");
    expect(l).toBeDefined();
    // 500 kr/h mot mal 1200 pa 20 timmar = 14 000 kr
    expect(l!.amountSek).toBe(14000);
    expect(l!.title).toContain("Verso");
  });

  it("är tyst om kunden ligger över målet", () => {
    const leaks = findLeaks({
      pitches: [pitch({ status: "betalt", brand_id: "b1", value_sek: 40000, hours_spent: 10 })],
      brands, licenses: [], settings, today: IDAG,
    });
    expect(leaks.some((x) => x.kind === "under_maltimpenning")).toBe(false);
  });

  it("flaggar levererat utan registrerade rättigheter", () => {
    const leaks = findLeaks({
      pitches: [pitch({ id: "p9", status: "levererat", value_sek: 25000 })],
      brands, licenses: [], settings, today: IDAG,
    });
    const l = leaks.find((x) => x.kind === "saknad_licens");
    expect(l).toBeDefined();
    expect(l!.severity).toBe("hog");
  });

  it("tystnar när licensen finns", () => {
    const leaks = findLeaks({
      pitches: [pitch({ id: "p9", status: "levererat", value_sek: 25000 })],
      brands, licenses: [license({ pitch_id: "p9" })], settings, today: IDAG,
    });
    expect(leaks.some((x) => x.kind === "saknad_licens")).toBe(false);
  });

  it("räknar ihop utgångna licenser som aldrig förnyats", () => {
    const leaks = findLeaks({
      pitches: [], brands,
      licenses: [license({ fee_sek: 15000 }), license({ id: "l2", fee_sek: 9000 })],
      settings, today: IDAG,
    });
    const l = leaks.find((x) => x.kind === "outnyttjad_fornyelse");
    expect(l!.amountSek).toBe(24000);
  });

  it("varnar för beroende av en enda kund", () => {
    const leaks = findLeaks({
      pitches: [
        pitch({ status: "betalt", brand_id: "b1", value_sek: 80000 }),
        pitch({ status: "betalt", brand_id: "b2", value_sek: 20000 }),
      ],
      brands, licenses: [], settings, today: IDAG,
    });
    const l = leaks.find((x) => x.kind === "beroende_av_en_kund");
    expect(l!.title).toContain("80 procent");
    expect(l!.severity).toBe("hog");
  });

  it("flaggar sena betalningar med värsta kunden namngiven", () => {
    const leaks = findLeaks({
      pitches: [pitch({ status: "fakturerat", brand_id: "b1", value_sek: 24000, invoiced_on: "2026-06-01", due_on: "2026-07-01" })],
      brands, licenses: [], settings, today: IDAG,
    });
    const l = leaks.find((x) => x.kind === "sen_betalning");
    expect(l!.amountSek).toBe(24000);
    expect(l!.why).toContain("Verso");
  });

  it("sätter allvarligast först", () => {
    const leaks = findLeaks({
      pitches: [
        pitch({ id: "p9", status: "levererat", value_sek: 25000 }),
        pitch({ status: "betalt", brand_id: "b2", value_sek: 10000, hours_spent: 20, revision_rounds: 4 }),
      ],
      brands, licenses: [], settings, today: IDAG,
    });
    expect(leaks[0].severity).toBe("hog");
  });

  it("är helt tyst för en verksamhet utan problem", () => {
    const leaks = findLeaks({
      pitches: [pitch({ id: "p9", status: "betalt", brand_id: "b1", value_sek: 40000, hours_spent: 10, paid_on: "2026-07-01", invoiced_on: "2026-06-20" })],
      brands, licenses: [license({ pitch_id: "p9", ends_on: "2027-01-01" })], settings, today: IDAG,
    });
    expect(leaks).toHaveLength(0);
  });
});

describe("månadsmålet", () => {
  it("räknar gapet i uppdrag och timmar, inte i procent", () => {
    const g = monthlyGoal(
      [
        pitch({ status: "betalt", value_sek: 20000, hours_spent: 10, paid_on: "2026-07-15" }),
        pitch({ status: "betalt", value_sek: 20000, hours_spent: 10 }),
      ],
      settings, IDAG,
    );
    expect(g.current).toBe(20000);
    expect(g.gap).toBe(30000);
    expect(g.dealsNeeded).toBe(2); // snitt 20 000
    expect(g.hoursNeeded).toBeGreaterThan(0);
  });

  it("säger att målet är nått när det är nått", () => {
    const g = monthlyGoal(
      [pitch({ status: "betalt", value_sek: 60000, paid_on: "2026-07-10" })],
      settings, IDAG,
    );
    expect(g.gap).toBe(0);
  });

  it("flaggar när gapet inte ryms på en månad", () => {
    const g = monthlyGoal(
      [pitch({ status: "betalt", value_sek: 1000, hours_spent: 10, paid_on: "2026-07-10" })],
      { ...settings, target_monthly_revenue: 500000 }, IDAG, 120,
    );
    expect(g.feasible).toBe(false);
  });
});

describe("långsamma betalare", () => {
  it("rangordnar efter snittid från faktura till betalning", () => {
    const rows = slowPayers(
      [
        pitch({ status: "betalt", brand_id: "b1", invoiced_on: "2026-06-01", paid_on: "2026-07-15" }),
        pitch({ status: "betalt", brand_id: "b2", invoiced_on: "2026-06-01", paid_on: "2026-06-10" }),
      ],
      brands,
    );
    expect(rows[0].name).toBe("Verso");
    expect(rows[0].avgDays).toBe(44);
    expect(rows[1].avgDays).toBe(9);
  });
});

describe("produktprognos", () => {
  const bas = {
    price: 1995, buildHours: 40, monthlyHours: 2, buildCost: 0, monthlyCost: 0,
    conversionPct: 1.5, recurring: false, audience: 12000,
  };

  it("räknar köpare ur publik och konvertering", () => {
    const f = forecastProduct(bas, settings, 1400);
    expect(f.buyers).toBe(180); // 12000 * 1.5%
    expect(f.revenue).toBe(180 * 1995);
  });

  it("räknar timpenningen på hela nedlagda tiden, inte bara bygget", () => {
    const f = forecastProduct(bas, settings, 1400);
    expect(f.hours).toBe(40 + 2 * 12);
    expect(f.hourlyRate).toBeCloseTo(f.net / 64, 2);
  });

  it("räknar in ALL egen tid i nollpunkten, inte bara bygget", () => {
    const f = forecastProduct({ ...bas, buildCost: 5000 }, settings, 1400);
    // Timmarna ar 40 bygg + 2/man * 12 = 64, prissatta till den FAKTISKA
    // timpenningen 1400 (samma som alternativkostnaden anvander), plus 5000
    // i utlagg. Tidigare raknades bara byggtiden, sa en produkt med tung
    // lopande skotsel sag billigare ut an den var.
    expect(f.breakEvenUnits).toBe(Math.ceil((5000 + 64 * 1400) / 1995));
  });

  it("jämför mot vad samma tid gett som uppdrag", () => {
    const f = forecastProduct(bas, settings, 1400);
    expect(f.opportunityCostSek).toBe(40 * 1400);
    expect(f.beatsFreelance).toBe(true);
  });

  it("säger ifrån när produkten är sämre än att ta uppdrag", () => {
    const f = forecastProduct({ ...bas, price: 149, conversionPct: 0.2 }, settings, 1400);
    expect(f.beatsFreelance).toBe(false);
  });

  it("räknar avhopp på löpande produkter i stället för evig intäkt", () => {
    const utan = forecastProduct({ ...bas, price: 299, recurring: true, monthlyChurnPct: 0 }, settings, 1400);
    const med = forecastProduct({ ...bas, price: 299, recurring: true, monthlyChurnPct: 8 }, settings, 1400);
    expect(med.revenue).toBeLessThan(utan.revenue);
    expect(utan.revenue).toBeCloseTo(180 * 299 * 12, 0);
  });

  it("ger noll köpare utan publik, inte ett påhittat tal", () => {
    expect(forecastProduct({ ...bas, audience: 0 }, settings, 1400).buyers).toBe(0);
  });
});

describe("produktförslag", () => {
  it("rangordnar efter timpenning, inte efter intäkt", () => {
    const s = suggestProducts(settings, 1400);
    expect(s.length).toBeGreaterThan(0);
    for (let i = 1; i < s.length; i++) {
      expect(s[i - 1].forecast.hourlyRate ?? 0).toBeGreaterThanOrEqual(s[i].forecast.hourlyRate ?? 0);
    }
  });

  it("ger inga förslag utan publik att räkna på", () => {
    expect(suggestProducts({ ...settings, audience_size: 0, email_list_size: 0 }, 1400)).toHaveLength(0);
  });

  it("räknar på högre konvertering när listan är större än flödet", () => {
    const listbaserad = suggestProducts({ ...settings, audience_size: 100, email_list_size: 5000 }, 1400);
    expect(listbaserad[0].forecast.buyers).toBeGreaterThan(0);
  });
});


describe("fynd ur granskningen, som tidigare gav fel siffror", () => {
  it("räknar inte förlorade affärer i timpenningen", () => {
    // En forlorad offert pa 100 000 kr som tog tre timmar gjorde att
    // timpenningen sag ut att vara 9 000 kr i stallet for 1 800.
    const r = actualHourlyRate([
      pitch({ status: "betalt", value_sek: 20000, production_cost_sek: 2000, hours_spent: 10 }),
      pitch({ status: "forlorad", value_sek: 100000, hours_spent: 3 }),
    ]);
    expect(r).toBe(1800);
  });

  it("räknar inte förlorade affärer i snittordervärdet", () => {
    // Annars halverades antalet uppdrag som kravdes, och ju fler stora
    // offerter hon forlorade desto lattare sag malet ut.
    const g = monthlyGoal(
      [
        pitch({ status: "betalt", value_sek: 20000, paid_on: "2026-07-15" }),
        pitch({ status: "forlorad", value_sek: 100000 }),
      ],
      settings,
      IDAG,
    );
    expect(g.gap).toBe(30000);
    expect(g.dealsNeeded).toBe(2);
  });

  it("blandar inte affärer med och utan ifyllda timmar i timpenningen", () => {
    const rows = economyByBrand([
      pitch({ brand_id: "b1", status: "betalt", value_sek: 10000, hours_spent: 20 }),
      pitch({ brand_id: "b1", status: "betalt", value_sek: 30000 }),
    ]);
    // Bara den matta affaren far rakna: 10 000 / 20 h = 500 kr/h.
    // Tidigare blev det (10000 + 30000) / 20 = 2 000 kr/h, och lackan tystnade.
    expect(rows[0].hourlyRate).toBe(500);
  });

  it("larmar inte om tre affärer med en revisionsrunda var", () => {
    const leaks = findLeaks({
      pitches: [
        pitch({ brand_id: "b1", status: "betalt", value_sek: 30000, hours_spent: 10, revision_rounds: 1 }),
        pitch({ brand_id: "b1", status: "betalt", value_sek: 30000, hours_spent: 10, revision_rounds: 1 }),
        pitch({ brand_id: "b1", status: "betalt", value_sek: 30000, hours_spent: 10, revision_rounds: 1 }),
      ],
      brands, licenses: [], settings, today: IDAG,
    });
    expect(leaks.some((l) => l.kind === "revisionstung")).toBe(false);
  });

  it("larmar när EN affär dragit över med flera rundor", () => {
    const leaks = findLeaks({
      pitches: [pitch({ brand_id: "b1", status: "betalt", value_sek: 30000, hours_spent: 10, revision_rounds: 4 })],
      brands, licenses: [], settings, today: IDAG,
    });
    const l = leaks.find((x) => x.kind === "revisionstung");
    expect(l).toBeDefined();
    // 3 extra rundor a 2 timmar, till 3 000 kr/h.
    expect(l!.amountSek).toBe(3 * 2 * 3000);
  });

  it("tjatar inte om en licens som redan förnyats", () => {
    const leaks = findLeaks({
      pitches: [pitch({ status: "betalt", value_sek: 18000, renewed_from_license_id: "l1" })],
      brands,
      licenses: [license({ id: "l1", fee_sek: 15000 })],
      settings, today: IDAG,
    });
    expect(leaks.some((l) => l.kind === "outnyttjad_fornyelse")).toBe(false);
  });

  it("sätter inget kronbelopp på koncentrationsrisken", () => {
    // Kundens omsattning ar inte en kostnad, och stod tidigare i rott under
    // rubriken "Kostar dig".
    const leaks = findLeaks({
      pitches: [
        pitch({ brand_id: "b1", status: "betalt", value_sek: 80000 }),
        pitch({ brand_id: "b2", status: "betalt", value_sek: 20000 }),
      ],
      brands, licenses: [], settings, today: IDAG,
    });
    const l = leaks.find((x) => x.kind === "beroende_av_en_kund");
    expect(l).toBeDefined();
    expect(l!.amountSek).toBeNull();
  });

  it("räknar leveranstiden på det som levereras personligen", () => {
    // Radgivning pastod 101 000 kr i timmen for att de 180 leveranstimmarna
    // inte fanns i modellen.
    const forslag = suggestProducts(settings, 1400);
    const radgivning = forslag.find((s) => s.template.kind === "konsultation");
    expect(radgivning).toBeDefined();
    expect(radgivning!.forecast.hourlyRate).toBeLessThan(10000);
    expect(radgivning!.forecast.hours).toBeGreaterThan(radgivning!.template.buildHours[0]);
  });

  it("låter aldrig en negativ timpenning bli jämförelse", () => {
    // Ett uppdrag dar inkopen sprack gav -1 500 kr/h, och da slog VARJE
    // tankbar produkt "dina uppdrag".
    const daligt = actualHourlyRate([
      pitch({ status: "vunnen", value_sek: 5000, production_cost_sek: 20000, hours_spent: 10 }),
    ]);
    expect(daligt).toBe(-1500);

    const f = forecastProduct(
      { price: 100, buildHours: 40, monthlyHours: 0, buildCost: 0, monthlyCost: 0,
        conversionPct: 0.01, recurring: false, audience: 100 },
      settings,
      daligt,
    );
    // Jamforelsen faller tillbaka pa malet 1 200, inte pa -1 500.
    expect(f.opportunityCostSek).toBe(40 * 1200);
    expect(f.beatsFreelance).toBe(false);
  });
});
