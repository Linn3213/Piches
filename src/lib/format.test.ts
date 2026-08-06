import { describe, expect, it } from "vitest";
import { days, formatDate, formatDateFull, formatMoney, plural, relativeDays } from "@/lib/format";

/**
 * format.ts syns i varenda vy, så ett fel här märks överallt samtidigt. Den
 * var otestad fram till nu, trots att både årtalsbuggen och "1 dagar" bodde
 * precis här.
 */

describe("böjning", () => {
  it("böjer singular och plural rätt", () => {
    expect(plural(1, "faktura", "fakturor")).toBe("1 faktura");
    expect(plural(2, "faktura", "fakturor")).toBe("2 fakturor");
    expect(days(1)).toBe("1 dag");
    expect(days(30)).toBe("30 dagar");
  });

  it("behandlar noll som plural, vilket är rätt på svenska", () => {
    expect(days(0)).toBe("0 dagar");
    expect(plural(0, "kund", "kunder")).toBe("0 kunder");
  });

  it("böjer även negativa tal begripligt", () => {
    // Anvands for forsenade dagar, dar tecknet redan hanterats av anroparen.
    expect(days(-1)).toBe("-1 dagar");
  });
});

describe("datum", () => {
  it("tar alltid med årtalet i det bindande formatet", () => {
    // Hela poangen: en tolvmanaderslicens fran 5 aug 2026 slutar 2027, och
    // utan artal las den som idag.
    const text = formatDateFull("2027-08-05");
    expect(text).toContain("2027");
    expect(text).toContain("aug");
  });

  it("utelämnar årtalet i det korta formatet, som bara används för nuet", () => {
    expect(formatDateFull("2026-08-05")).not.toBe(formatDate("2026-08-05"));
    expect(formatDate("2026-08-05")).not.toContain("2026");
  });

  it("ger tom sträng för null i stället för texten null", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDateFull(null)).toBe("");
  });

  it("tolkar datum lokalt, så att rätt dag visas i Sverige", () => {
    // Rakt new Date("2026-08-05") ar UTC-midnatt. Med positiv offset ger det
    // fortfarande ratt dag har, men testet lases in sa att en framtida
    // andring till negativ offset syns.
    expect(formatDateFull("2026-08-05")).toContain("5");
  });
});

describe("relativa dagar", () => {
  const idag = new Date();
  const om = (d: number) =>
    new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() + d).toISOString();

  it("skriver ut de nära dagarna med ord", () => {
    expect(relativeDays(om(0))).toBe("idag");
    expect(relativeDays(om(1))).toBe("imorgon");
    expect(relativeDays(om(-1))).toBe("igår");
  });

  it("böjer dagformen även i relativ text", () => {
    expect(relativeDays(om(2))).toBe("om 2 dagar");
    expect(relativeDays(om(-2))).toBe("2 dagar sedan");
  });

  it("ger tom sträng för null", () => {
    expect(relativeDays(null)).toBe("");
  });
});

describe("pengar", () => {
  it("visar hela kronor utan decimaler", () => {
    expect(formatMoney(24000)).toMatch(/24\s?000/);
    expect(formatMoney(24000)).toContain("kr");
  });

  it("avrundar i stället för att visa ören", () => {
    expect(formatMoney(1499.6)).not.toContain(",");
  });

  it("klarar noll och negativa belopp", () => {
    expect(formatMoney(0)).toContain("0");
    expect(formatMoney(-500)).toContain("500");
  });

  it("ger tom sträng för null, aldrig NaN", () => {
    expect(formatMoney(null)).toBe("");
  });
});
