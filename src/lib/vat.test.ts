import { describe, expect, it } from "vitest";
import { applyVat, determineVat, isEuCountry, looksLikeVatNumber } from "@/lib/vat";

const svensk = {
  sellerVatRegistered: true,
  customerCountry: "SE",
  customerIsCompany: true,
  customerVatNumber: "SE556677889901",
};

describe("landkoder", () => {
  it("känner igen EU-länder oavsett skiftläge", () => {
    expect(isEuCountry("de")).toBe(true);
    expect(isEuCountry("SE")).toBe(true);
    expect(isEuCountry(" fi ")).toBe(true);
  });

  it("håller Norge, Storbritannien och USA utanför", () => {
    expect(isEuCountry("NO")).toBe(false);
    expect(isEuCountry("GB")).toBe(false);
    expect(isEuCountry("US")).toBe(false);
  });
});

describe("momsnummer", () => {
  it("godtar ett nummer som börjar med rätt landskod", () => {
    expect(looksLikeVatNumber("DE123456789", "DE")).toBe(true);
    expect(looksLikeVatNumber("de 123 456 789", "DE")).toBe(true);
  });

  it("underkänner fel landskod, för kort nummer och tomt fält", () => {
    expect(looksLikeVatNumber("SE123456789", "DE")).toBe(false);
    expect(looksLikeVatNumber("DE123", "DE")).toBe(false);
    expect(looksLikeVatNumber(null, "DE")).toBe(false);
    expect(looksLikeVatNumber("", "DE")).toBe(false);
  });
});

describe("svensk kund", () => {
  it("ger vanlig svensk moms utan särskild fakturatext", () => {
    const t = determineVat(svensk);
    expect(t.kind).toBe("svensk_moms");
    expect(t.rate).toBe(25);
    expect(t.invoiceNote).toBeNull();
    expect(t.warning).toBeNull();
  });

  it("ger svensk moms även till en svensk privatperson", () => {
    const t = determineVat({ ...svensk, customerIsCompany: false, customerVatNumber: null });
    expect(t.rate).toBe(25);
  });
});

describe("företag i annat EU-land", () => {
  it("ger omvänd betalningsskyldighet och noll moms", () => {
    const t = determineVat({
      sellerVatRegistered: true,
      customerCountry: "DE",
      customerIsCompany: true,
      customerVatNumber: "DE123456789",
    });
    expect(t.kind).toBe("omvand_betalningsskyldighet");
    expect(t.rate).toBe(0);
    expect(t.invoiceNote).toContain("Omvänd betalningsskyldighet");
    expect(t.warning).toBeNull();
  });

  it("varnar när momsnumret saknas, eftersom svensk moms då gäller i stället", () => {
    const t = determineVat({
      sellerVatRegistered: true,
      customerCountry: "DE",
      customerIsCompany: true,
      customerVatNumber: null,
    });
    expect(t.kind).toBe("omvand_betalningsskyldighet");
    expect(t.warning).toContain("Momsnumret");
  });

  it("behandlar en privatperson i EU som en svensk kund", () => {
    const t = determineVat({
      sellerVatRegistered: true,
      customerCountry: "FI",
      customerIsCompany: false,
      customerVatNumber: null,
    });
    expect(t.kind).toBe("svensk_moms");
    expect(t.rate).toBe(25);
  });
});

describe("kund utanför EU", () => {
  it("ger noll moms med hänvisning på fakturan", () => {
    const t = determineVat({
      sellerVatRegistered: true,
      customerCountry: "US",
      customerIsCompany: true,
      customerVatNumber: null,
    });
    expect(t.kind).toBe("utanfor_eu");
    expect(t.rate).toBe(0);
    expect(t.invoiceNote).toContain("utanför EU");
  });

  it("behandlar Norge och Storbritannien som utanför EU", () => {
    for (const land of ["NO", "GB"]) {
      expect(
        determineVat({
          sellerVatRegistered: true,
          customerCountry: land,
          customerIsCompany: true,
          customerVatNumber: null,
        }).kind,
      ).toBe("utanfor_eu");
    }
  });
});

describe("inte momsregistrerad", () => {
  it("lägger aldrig på moms, oavsett var kunden finns", () => {
    for (const land of ["SE", "DE", "US"]) {
      const t = determineVat({
        sellerVatRegistered: false,
        customerCountry: land,
        customerIsCompany: true,
        customerVatNumber: null,
      });
      expect(t.kind).toBe("ej_momsregistrerad");
      expect(t.rate).toBe(0);
    }
  });

  it("går före allt annat, även omvänd betalningsskyldighet", () => {
    const t = determineVat({
      sellerVatRegistered: false,
      customerCountry: "DE",
      customerIsCompany: true,
      customerVatNumber: "DE123456789",
    });
    expect(t.kind).toBe("ej_momsregistrerad");
  });
});

describe("beloppen", () => {
  it("lägger på 25 procent och summerar rätt", () => {
    const r = applyVat(20000, determineVat(svensk));
    expect(r.net).toBe(20000);
    expect(r.vat).toBe(5000);
    expect(r.gross).toBe(25000);
  });

  it("lämnar beloppet orört när momsen är noll", () => {
    const t = determineVat({
      sellerVatRegistered: true,
      customerCountry: "DE",
      customerIsCompany: true,
      customerVatNumber: "DE123456789",
    });
    const r = applyVat(20000, t);
    expect(r.vat).toBe(0);
    expect(r.gross).toBe(20000);
  });

  it("avrundar ören i stället för att slarva bort dem", () => {
    const r = applyVat(1333.33, determineVat(svensk));
    expect(r.vat).toBeCloseTo(333.33, 2);
  });
});
