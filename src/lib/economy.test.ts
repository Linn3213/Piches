import { describe, expect, it } from "vitest";
import type { Pitch, PitchStatus } from "@/types/db";
import {
  averageDaysToPayment,
  dealHourlyRate,
  dealProfit,
  economyByBrand,
  invoicesDueSoon,
  moneyPipeline,
  overdueInvoices,
  revenueByMonth,
  revenueConcentration,
} from "@/lib/economy";

const TODAY = new Date(2026, 7, 5); // 5 aug 2026

function pitch(over: Partial<Pitch> & { status: PitchStatus }): Pitch {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u",
    brand_id: "verso",
    channel: "mejl",
    subject: null,
    body: null,
    observation: null,
    value_sek: null,
    sent_at: null,
    replied_at: null,
    follow_up_1_at: null,
    follow_up_2_at: null,
    won_at: null,
    invoice_number: null,
    invoiced_on: null,
    due_on: null,
    paid_on: null,
    production_cost_sek: null,
    hours_spent: null,
    revision_rounds: 0,
    renewed_from_license_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("vinst per affär", () => {
  it("drar av inköpta kostnader men inte egen tid", () => {
    const p = pitch({ status: "betalt", value_sek: 20000, production_cost_sek: 5000, hours_spent: 10 });
    expect(dealProfit(p)).toBe(15000);
  });

  it("behandlar saknad kostnad som noll, inte som okänd", () => {
    expect(dealProfit(pitch({ status: "vunnen", value_sek: 8000 }))).toBe(8000);
  });

  it("ger null när ordervärdet saknas, i stället för att gissa noll", () => {
    expect(dealProfit(pitch({ status: "vunnen" }))).toBeNull();
  });
});

describe("timpenning", () => {
  it("räknar vinst delat med nedlagd tid", () => {
    const p = pitch({ status: "betalt", value_sek: 20000, production_cost_sek: 5000, hours_spent: 10 });
    expect(dealHourlyRate(p)).toBe(1500);
  });

  it("avslöjar att den stora affären var den sämre", () => {
    const stor = pitch({ status: "betalt", value_sek: 20000, hours_spent: 40 });
    const liten = pitch({ status: "betalt", value_sek: 8000, hours_spent: 5 });
    expect(dealHourlyRate(stor)!).toBeLessThan(dealHourlyRate(liten)!);
  });

  it("ger null i stället för oändlighet när timmarna saknas", () => {
    expect(dealHourlyRate(pitch({ status: "betalt", value_sek: 9000 }))).toBeNull();
    expect(dealHourlyRate(pitch({ status: "betalt", value_sek: 9000, hours_spent: 0 }))).toBeNull();
  });
});

describe("pengaflödet", () => {
  const pitches = [
    pitch({ status: "vunnen", value_sek: 10000 }),
    pitch({ status: "produktion", value_sek: 5000 }),
    pitch({ status: "fakturerat", value_sek: 20000, invoiced_on: "2026-07-01", due_on: "2026-07-31" }),
    pitch({ status: "fakturerat", value_sek: 7000, invoiced_on: "2026-08-01", due_on: "2026-08-31" }),
    pitch({ status: "betalt", value_sek: 30000, invoiced_on: "2026-06-01", paid_on: "2026-06-20" }),
    pitch({ status: "forlorad", value_sek: 99000 }),
  ];

  it("skiljer kontrakterat, utestående och inbetalt", () => {
    const m = moneyPipeline(pitches, TODAY);
    expect(m.contracted).toBe(15000);
    expect(m.outstanding).toBe(27000);
    expect(m.paid).toBe(30000);
  });

  it("räknar bara förfallna fakturor som förfallna", () => {
    expect(moneyPipeline(pitches, TODAY).overdue).toBe(20000);
  });

  it("räknar aldrig in förlorade affärer", () => {
    const m = moneyPipeline(pitches, TODAY);
    expect(m.contracted + m.outstanding + m.paid).toBe(72000);
  });
});

describe("sena fakturor", () => {
  it("listar mest försenad först och räknar dagarna", () => {
    const sen = pitch({ status: "fakturerat", value_sek: 1, invoiced_on: "2026-06-01", due_on: "2026-07-01" });
    const senare = pitch({ status: "fakturerat", value_sek: 1, invoiced_on: "2026-07-01", due_on: "2026-07-30" });
    const rows = overdueInvoices([senare, sen], TODAY);
    expect(rows.map((r) => r.daysLate)).toEqual([35, 6]);
  });

  it("räknar inte en faktura som förfaller idag som sen", () => {
    const idag = pitch({ status: "fakturerat", value_sek: 1, invoiced_on: "2026-07-01", due_on: "2026-08-05" });
    expect(overdueInvoices([idag], TODAY)).toHaveLength(0);
    expect(invoicesDueSoon([idag], TODAY, 7)).toHaveLength(1);
  });

  it("betalda fakturor är aldrig sena", () => {
    const betald = pitch({
      status: "betalt",
      value_sek: 1,
      invoiced_on: "2026-05-01",
      due_on: "2026-05-31",
      paid_on: "2026-08-01",
    });
    expect(overdueInvoices([betald], TODAY)).toHaveLength(0);
  });

  it("räknar snittiden från faktura till betalning", () => {
    const a = pitch({ status: "betalt", invoiced_on: "2026-06-01", paid_on: "2026-06-21" });
    const b = pitch({ status: "betalt", invoiced_on: "2026-07-01", paid_on: "2026-07-11" });
    expect(averageDaysToPayment([a, b])).toBe(15);
    expect(averageDaysToPayment([])).toBeNull();
  });
});

describe("ekonomi per varumärke", () => {
  const pitches = [
    pitch({ brand_id: "verso", status: "betalt", value_sek: 30000, production_cost_sek: 5000, hours_spent: 20, paid_on: "2026-06-01" }),
    pitch({ brand_id: "verso", status: "vunnen", value_sek: 10000, hours_spent: 5, revision_rounds: 3 }),
    pitch({ brand_id: "lyko", status: "betalt", value_sek: 12000, hours_spent: 4, paid_on: "2026-07-01" }),
    pitch({ brand_id: "lyko", status: "forlorad", value_sek: 50000 }),
  ];

  it("summerar per varumärke och sorterar störst först", () => {
    const rows = economyByBrand(pitches);
    expect(rows.map((r) => r.brandId)).toEqual(["verso", "lyko"]);
    expect(rows[0].won).toBe(40000);
    expect(rows[0].deals).toBe(2);
  });

  it("skiljer vunnet från faktiskt inbetalt", () => {
    const verso = economyByBrand(pitches)[0];
    expect(verso.won).toBe(40000);
    expect(verso.paid).toBe(30000);
  });

  it("räknar timpenning på vinsten, inte på omsättningen", () => {
    const verso = economyByBrand(pitches)[0];
    // (30000 - 5000) + 10000 = 35000 vinst pa 25 timmar
    expect(verso.hourlyRate).toBe(1400);
  });

  it("summerar revisionsrundor, så att kunder som drar över syns", () => {
    expect(economyByBrand(pitches)[0].revisionRounds).toBe(3);
  });

  it("håller förlorade affärer utanför", () => {
    const lyko = economyByBrand(pitches)[1];
    expect(lyko.won).toBe(12000);
  });
});

describe("koncentrationsrisk", () => {
  it("räknar hur stor del som hänger på största kunden", () => {
    const c = revenueConcentration([
      pitch({ brand_id: "verso", status: "betalt", value_sek: 60000 }),
      pitch({ brand_id: "lyko", status: "betalt", value_sek: 40000 }),
    ]);
    expect(c!.brandId).toBe("verso");
    expect(c!.share).toBeCloseTo(0.6);
    expect(c!.brands).toBe(2);
  });

  it("ger null när det inte finns någon vunnen affär att räkna på", () => {
    expect(revenueConcentration([])).toBeNull();
    expect(revenueConcentration([pitch({ status: "skickad", value_sek: 5000 })])).toBeNull();
  });
});

describe("intäkt per månad", () => {
  it("bokför affären på när den vanns, inte på när pitchen skickades", () => {
    const p = pitch({
      status: "betalt",
      value_sek: 25000,
      sent_at: "2026-03-10T09:00:00Z",
      won_at: "2026-06-14T09:00:00Z",
    });
    const months = revenueByMonth([p], TODAY, 6);
    const juni = months.find((m) => m.month === "2026-06");
    const mars = months.find((m) => m.month === "2026-03");
    expect(juni!.total).toBe(25000);
    expect(mars?.total ?? 0).toBe(0);
  });

  it("ger alltid lika många månader, även tomma", () => {
    expect(revenueByMonth([], TODAY, 6)).toHaveLength(6);
  });
});
