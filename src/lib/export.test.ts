import { describe, expect, it } from "vitest";
import type { Brand, Deliverable, License, Pitch } from "@/types/db";
import {
  alltSomJson,
  csvFalt,
  filnamn,
  licenserSomCsv,
  tillCsv,
  uppdragSomCsv,
  type Underlag,
} from "@/lib/export";

const brand = { id: "b1", name: "Nordkust Skincare" } as Brand;

const pitch = {
  id: "p1",
  brand_id: "b1",
  subject: "Tre reels; höstkampanj",
  status: "vunnen",
  value_sek: 12000,
  sent_at: "2026-08-01T10:00:00Z",
  won_at: "2026-08-05T10:00:00Z",
  invoice_number: "2026-42",
  invoiced_on: "2026-08-20",
  due_on: "2026-09-19",
  paid_on: null,
  production_cost_sek: 500,
  hours_spent: 12,
  created_at: "2026-08-01T10:00:00Z",
} as Pitch;

const deliverable = {
  id: "d1",
  pitch_id: "p1",
  brand_id: "b1",
  title: 'Reel med "hooken"',
  format: "reel",
  quantity: 3,
} as Deliverable;

const license = {
  id: "l1",
  brand_id: "b1",
  pitch_id: "p1",
  deliverable_id: null,
  channels: ["paid_social", "organic_brand"],
  territory: "se",
  starts_on: "2026-08-20",
  ends_on: "2027-08-20",
  perpetual: false,
  exclusive_category: "Hudvård",
  exclusivity_ends_on: "2027-02-20",
  includes_raw_files: false,
  fee_sek: 8000,
} as unknown as License;

const underlag: Underlag = {
  brands: [brand],
  pitches: [pitch],
  deliverables: [deliverable],
  licenses: [license],
  products: [],
  settings: null,
};

describe("csv-fält", () => {
  it("lämnar vanlig text orörd", () => {
    expect(csvFalt("Nordkust")).toBe("Nordkust");
    expect(csvFalt(8000)).toBe("8000");
  });

  it("tomt för null och undefined, inte texten null", () => {
    // "null" i en cell ser ut som data och hamnar i kundens kalkylark.
    expect(csvFalt(null)).toBe("");
    expect(csvFalt(undefined)).toBe("");
  });

  it("omsluter fält med semikolon, annars glider hela raden ett steg", () => {
    expect(csvFalt("Tre reels; höstkampanj")).toBe('"Tre reels; höstkampanj"');
  });

  it("dubblar citattecken i stället för att bryta filen", () => {
    expect(csvFalt('Reel med "hooken"')).toBe('"Reel med ""hooken"""');
  });

  it("omsluter radbrytningar, ett radbyte i en anteckning förstör annars filen", () => {
    expect(csvFalt("rad ett\nrad två")).toBe('"rad ett\nrad två"');
  });
});

describe("csv-dokumentet", () => {
  it("börjar med BOM så att svensk Excel visar å ä ö", () => {
    expect(tillCsv([{ a: "å" }], ["a"]).startsWith("﻿")).toBe(true);
  });

  it("skiljer kolumner med semikolon och rader med CRLF", () => {
    const csv = tillCsv([{ a: 1, b: 2 }], ["a", "b"]);
    expect(csv).toContain("a;b\r\n1;2");
  });
});

describe("licenser som kalkylark", () => {
  const csv = licenserSomCsv(underlag);

  it("skriver varumärkets namn och inte ett id", () => {
    expect(csv).toContain("Nordkust Skincare");
    expect(csv).not.toContain("b1");
  });

  it("översätter kanaler och marknad till svenska", () => {
    expect(csv).toContain("Betald annonsering");
    expect(csv).toContain("Sverige");
  });

  it("säger Hela uppdraget när licensen inte hänger på ett enskilt material", () => {
    expect(csv).toContain("Hela uppdraget");
  });

  it("har med datumen, det är dem hela filen finns för", () => {
    expect(csv).toContain("2026-08-20");
    expect(csv).toContain("2027-08-20");
    expect(csv).toContain("2027-02-20");
  });

  it("lämnar slutdatum tomt för en evig licens i stället för att hitta på ett", () => {
    const evig = licenserSomCsv({
      ...underlag,
      licenses: [{ ...license, perpetual: true, ends_on: null } as unknown as License],
    });
    const rad = evig.trim().split("\r\n")[1];
    expect(rad).toContain(";ja;");
  });
});

describe("uppdrag som kalkylark", () => {
  const csv = uppdragSomCsv(underlag);

  it("tar med pengarna och datumen som fakturan bygger på", () => {
    expect(csv).toContain("12000");
    expect(csv).toContain("2026-08-20");
    expect(csv).toContain("2026-09-19");
  });

  it("klipper tidsstämplar till datum, ingen vill läsa T10:00:00Z", () => {
    expect(csv).toContain("2026-08-05");
    expect(csv).not.toContain("T10:00:00Z");
  });

  it("räknar upp materialet i klartext", () => {
    expect(csv).toContain("3 Reel");
  });
});

describe("hela uttaget som json", () => {
  it("har med varje del, så att ingenting tyst faller bort", () => {
    const json = JSON.parse(alltSomJson(underlag, "2026-08-20T10:00:00Z"));
    expect(Object.keys(json)).toEqual([
      "format",
      "uttaget",
      "varumarken",
      "uppdrag",
      "material",
      "licenser",
      "produkter",
      "installningar",
    ]);
    expect(json.licenser).toHaveLength(1);
    expect(json.uppdrag[0].value_sek).toBe(12000);
  });
});

describe("filnamn", () => {
  it("har datum, så att två uttag inte skriver över varandra", () => {
    expect(filnamn("licenser", new Date(2026, 7, 20), "csv")).toBe("piches-licenser-2026-08-20.csv");
  });
});
