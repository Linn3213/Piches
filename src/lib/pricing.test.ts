import { describe, expect, it } from "vitest";
import { computePrice, durationFactor, type PricingInput } from "@/lib/pricing";
import { DEFAULT_SETTINGS, type Settings } from "@/types/db";

const S: Settings = { ...DEFAULT_SETTINGS, user_id: "u1", updated_at: "" };

function input(over: Partial<PricingInput> = {}): PricingInput {
  return {
    deliverables: [{ format: "video", quantity: 1 }],
    channels: ["organic_creator"],
    territory: "se",
    durationMonths: 1,
    exclusiveCategory: false,
    includesRawFiles: false,
    rush: false,
    ...over,
  };
}

describe("computePrice", () => {
  it("tar bara produktionskostnad när inga extra rättigheter ingår", () => {
    const r = computePrice(input(), S);
    expect(r.base).toBe(4000);
    expect(r.total).toBe(4000);
    expect(r.lines).toHaveLength(1);
  });

  it("summerar leverabler av olika format", () => {
    const r = computePrice(
      input({ deliverables: [{ format: "video", quantity: 2 }, { format: "foto", quantity: 3 }] }),
      S,
    );
    expect(r.base).toBe(2 * 4000 + 3 * 1500);
  });

  it("lägger på annonsrätt beräknad på produktionen", () => {
    const r = computePrice(input({ channels: ["organic_creator", "paid_social"] }), S);
    // 4000 bas + 60% av 4000 vid 1 månad (faktor 1.0)
    expect(r.total).toBe(6400);
  });

  it("skalar annonsrätten med licenslängden", () => {
    const kort = computePrice(input({ channels: ["paid_social"], durationMonths: 1 }), S);
    const lang = computePrice(input({ channels: ["paid_social"], durationMonths: 12 }), S);
    expect(lang.total).toBeGreaterThan(kort.total);
    // 4000 + 2400 * sqrt(12) ≈ 4000 + 8314
    expect(lang.total).toBe(Math.round(4000 + 2400 * Math.sqrt(12)));
  });

  it("prissätter evig licens högst av alla varianter", () => {
    const evig = computePrice(input({ durationMonths: null }), S);
    const arslicens = computePrice(input({ durationMonths: 12 }), S);
    expect(evig.total).toBeGreaterThan(arslicens.total);
    expect(evig.lines.some((l) => l.label === "Evig licens")).toBe(true);
  });

  it("tar betalt för exklusivitet", () => {
    const r = computePrice(input({ exclusiveCategory: true }), S);
    expect(r.total).toBe(4000 + 1400);
  });

  it("staplar flera rättigheter var för sig så att raderna går att läsa", () => {
    const r = computePrice(
      input({
        channels: ["organic_brand", "paid_social", "whitelisting", "website"],
        territory: "global",
        exclusiveCategory: true,
        includesRawFiles: true,
        rush: true,
      }),
      S,
    );
    const labels = r.lines.map((l) => l.label);
    expect(labels).toContain("Varumärkets egna kanaler");
    expect(labels).toContain("Whitelisting / Spark Ads");
    expect(labels).toContain("Global användning");
    expect(labels).toContain("Råmaterial");
    expect(labels).toContain("Expressleverans");
    // Varje rad ska ha en förklaring, annars går priset inte att motivera.
    expect(r.lines.every((l) => l.detail.length > 0)).toBe(true);
  });

  it("klarar tomt underlag utan att krascha", () => {
    const r = computePrice(input({ deliverables: [] }), S);
    expect(r.total).toBe(0);
  });
});

describe("durationFactor", () => {
  it("är neutral vid en månad eller kortare", () => {
    expect(durationFactor(1)).toBe(1);
    expect(durationFactor(0)).toBe(1);
  });

  it("växer långsammare än linjärt", () => {
    // 12 månader ska kosta klart mer än 1, men långt ifrån 12 gånger.
    expect(durationFactor(12)).toBeCloseTo(3.46, 1);
    expect(durationFactor(12)).toBeLessThan(12);
  });
});
