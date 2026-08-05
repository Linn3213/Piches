import { describe, expect, it } from "vitest";
import {
  extractBrief,
  extractBudget,
  extractChannels,
  extractDeadline,
  extractDeliverables,
  extractDuration,
  extractExclusivity,
  extractFlags,
  extractTerritory,
} from "@/lib/brief";

const IDAG = new Date(2026, 7, 5); // 5 aug 2026

// En brief av det slag som faktiskt landar i inkorgen.
const SKARP_BRIEF = `Hej!

Vi på Verso Skincare lanserar vår nya serumlinje i höst och skulle gärna vilja
jobba med dig. Vi tänker oss 3 videos och 2 foton som vi kan använda i våra
egna kanaler samt för betald annonsering på Meta i Norden under 6 månader.

Vi vill gärna även ha råmaterialet. Deadline för leverans är 12 september.
Budget är 25 000 kr. Vi ber också om exklusivitet inom hudvård under perioden.

Hör av dig!`;

describe("leverabler", () => {
  it("läser antal och format ur löpande text", () => {
    const d = extractDeliverables("Vi tänker oss 3 videos och 2 foton");
    expect(d).toContainEqual({ format: "video", quantity: 3 });
    expect(d).toContainEqual({ format: "foto", quantity: 2 });
  });

  it("förstår skrivna siffror på svenska och engelska", () => {
    expect(extractDeliverables("tre reels")).toContainEqual({ format: "reel", quantity: 3 });
    expect(extractDeliverables("two TikToks")).toContainEqual({ format: "tiktok", quantity: 2 });
  });

  it("klarar 'st' och 'x' mellan antal och format", () => {
    expect(extractDeliverables("2 st videos")).toContainEqual({ format: "video", quantity: 2 });
    expect(extractDeliverables("4x reels")).toContainEqual({ format: "reel", quantity: 4 });
  });

  it("dubbelräknar inte samma sak via två synonymer", () => {
    const d = extractDeliverables("3 videos, alltså 3 filmer");
    expect(d.filter((x) => x.format === "video")).toHaveLength(1);
    expect(d.find((x) => x.format === "video")!.quantity).toBe(3);
  });

  it("låter den mer specifika tolkningen vinna över den allmänna", () => {
    const d = extractDeliverables("3 UGC-videos");
    expect(d.some((x) => x.format === "ugc_ad")).toBe(true);
    expect(d.some((x) => x.format === "video")).toBe(false);
  });

  it("hittar ingenting i en text utan leverabler", () => {
    expect(extractDeliverables("Hej, vi vill samarbeta!")).toHaveLength(0);
  });
});

describe("kanaler", () => {
  it("känner igen betald annonsering i flera formuleringar", () => {
    expect(extractChannels("vi kör Meta ads")).toContain("paid_social");
    expect(extractChannels("för betald annonsering")).toContain("paid_social");
  });

  it("skiljer whitelisting från vanlig annonsering", () => {
    const c = extractChannels("vi vill köra spark ads från ditt konto");
    expect(c).toContain("whitelisting");
  });

  it("hittar varumärkets egna kanaler", () => {
    expect(extractChannels("i våra egna kanaler")).toContain("organic_brand");
  });

  it("hittar webb och nyhetsbrev", () => {
    expect(extractChannels("på vår hemsida och i nyhetsbrev")).toContain("website");
  });
});

describe("marknad", () => {
  it("läser ut marknaden", () => {
    expect(extractTerritory("i Norden")).toBe("norden");
    expect(extractTerritory("globalt")).toBe("global");
    expect(extractTerritory("bara i Sverige")).toBe("se");
  });

  it("låter global vinna när flera nämns, eftersom den är vidast", () => {
    expect(extractTerritory("Sverige och globalt")).toBe("global");
  });

  it("ger null när marknaden inte nämns", () => {
    expect(extractTerritory("3 videos till kampanjen")).toBeNull();
  });
});

describe("licenslängd", () => {
  it("läser månader och år", () => {
    expect(extractDuration("under 6 månader")).toEqual({ months: 6, perpetual: false });
    expect(extractDuration("i 2 år")).toEqual({ months: 24, perpetual: false });
    expect(extractDuration("ett år")).toEqual({ months: 12, perpetual: false });
  });

  it("känner igen evig licens i flera formuleringar", () => {
    for (const t of ["i all framtid", "perpetual usage", "full buyout", "för alltid"]) {
      expect(extractDuration(t).perpetual).toBe(true);
    }
  });

  it("låter evig licens gå före en angiven längd", () => {
    expect(extractDuration("6 månader, sedan i all framtid").perpetual).toBe(true);
  });
});

describe("exklusivitet", () => {
  it("hittar branschen när den nämns", () => {
    expect(extractExclusivity("exklusivitet inom hudvård")).toBe("hudvård");
  });

  it("returnerar tom sträng när exklusivitet nämns utan bransch", () => {
    expect(extractExclusivity("vi vill ha exklusivitet under perioden")).toBe("");
  });

  it("ger null när exklusivitet inte nämns alls", () => {
    expect(extractExclusivity("3 videos i 6 månader")).toBeNull();
  });
});

describe("budget", () => {
  it("läser belopp med mellanslag och olika suffix", () => {
    expect(extractBudget("Budget är 25 000 kr")).toBe(25000);
    expect(extractBudget("15000 SEK")).toBe(15000);
    expect(extractBudget("12 500:-")).toBe(12500);
  });

  it("väljer det högsta beloppet, eftersom delposter annars vinner", () => {
    expect(extractBudget("2 000 kr per film, totalt 8 000 kr")).toBe(8000);
  });

  it("ger null när ingen budget nämns", () => {
    expect(extractBudget("Vi återkommer om budget")).toBeNull();
  });
});

describe("deadline", () => {
  it("läser svenskt datum utan årtal och antar rätt år", () => {
    expect(extractDeadline("senast 12 september", IDAG)).toBe("2026-09-12");
  });

  it("lägger datum som redan passerat på nästa år", () => {
    expect(extractDeadline("senast 3 mars", IDAG)).toBe("2027-03-03");
  });

  it("läser ISO-datum rakt av", () => {
    expect(extractDeadline("deadline 2026-10-01", IDAG)).toBe("2026-10-01");
  });

  it("ger null utan datum", () => {
    expect(extractDeadline("så snart som möjligt", IDAG)).toBeNull();
  });
});

describe("varningsflaggor", () => {
  it("varnar för evig licens", () => {
    const f = extractFlags("materialet får användas i all framtid");
    expect(f.some((x) => x.severity === "hog" && x.why.includes("aldrig säljas igen"))).toBe(true);
  });

  it("varnar för whitelisting", () => {
    expect(extractFlags("vi kör spark ads").some((x) => x.why.includes("ditt eget konto"))).toBe(true);
  });

  it("varnar för obegränsade revideringar", () => {
    expect(
      extractFlags("vi kör tills vi är nöjda").some((x) => x.why.includes("tak på revisionsrundor")),
    ).toBe(true);
  });

  it("varnar för ersättning i produkter", () => {
    expect(
      extractFlags("du får produkter som ersättning").some((x) => x.why.includes("skattepliktig")),
    ).toBe(true);
  });

  it("är tyst för en brief utan fällor", () => {
    expect(extractFlags("Vi vill ha 2 videos till vår kampanj.")).toHaveLength(0);
  });
});

describe("hela briefen", () => {
  const r = extractBrief(SKARP_BRIEF, IDAG);

  it("plockar ut leverablerna", () => {
    expect(r.deliverables).toContainEqual({ format: "video", quantity: 3 });
    expect(r.deliverables).toContainEqual({ format: "foto", quantity: 2 });
  });

  it("plockar ut rättigheterna", () => {
    expect(r.channels).toContain("organic_brand");
    expect(r.channels).toContain("paid_social");
    expect(r.territory).toBe("norden");
    expect(r.durationMonths).toBe(6);
    expect(r.includesRawFiles).toBe(true);
    expect(r.exclusiveCategory).toBe("hudvård");
  });

  it("plockar ut pengar och deadline", () => {
    expect(r.budgetSek).toBe(25000);
    expect(r.deadline).toBe("2026-09-12");
  });

  it("hittar inget att sakna när briefen är komplett", () => {
    expect(r.missing).toHaveLength(0);
  });

  it("flaggar exklusiviteten och råmaterialet", () => {
    expect(r.flags.some((f) => f.why.includes("samma bransch"))).toBe(true);
    expect(r.flags.some((f) => f.why.includes("klippa om"))).toBe(true);
  });

  it("listar det som saknas i en mager brief i stället för att gissa", () => {
    const tunn = extractBrief("Hej! Vi vill gärna samarbeta med dig, hör av dig.", IDAG);
    expect(tunn.missing).toContain("Vad som ska levereras");
    expect(tunn.missing).toContain("Budget");
    expect(tunn.deliverables).toHaveLength(0);
    expect(tunn.durationMonths).toBeNull();
  });
});
