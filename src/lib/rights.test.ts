import { describe, expect, it } from "vitest";
import type { License } from "@/types/db";
import {
  daysUntilExpiry,
  exclusivityConflicts,
  expiringLicenses,
  isRelicensable,
  lapsedLicenses,
  licenseState,
} from "@/lib/rights";

const TODAY = new Date(2026, 7, 4); // 4 aug 2026

function license(over: Partial<License> = {}): License {
  return {
    id: "l1",
    user_id: "u1",
    pitch_id: "p1",
    brand_id: "b1",
    deliverable_id: "d1",
    channels: ["paid_social"],
    territory: "se",
    starts_on: "2026-05-01",
    ends_on: "2026-08-20",
    perpetual: false,
    exclusive_category: null,
    exclusivity_ends_on: null,
    includes_raw_files: false,
    fee_sek: 10000,
    notes: null,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("licenseState", () => {
  it("flaggar licens som går ut inom bevakningsfönstret", () => {
    expect(licenseState(license({ ends_on: "2026-08-20" }), TODAY, 30)).toBe("utgar_snart");
  });

  it("håller licens aktiv när slutdatumet ligger bortom fönstret", () => {
    expect(licenseState(license({ ends_on: "2026-12-01" }), TODAY, 30)).toBe("aktiv");
  });

  it("markerar passerat slutdatum som utgånget", () => {
    expect(licenseState(license({ ends_on: "2026-07-01" }), TODAY, 30)).toBe("utgangen");
  });

  it("behandlar sista giltiga dagen som ännu inte utgången", () => {
    expect(licenseState(license({ ends_on: "2026-08-04" }), TODAY, 30)).toBe("utgar_snart");
  });

  it("särskiljer eviga licenser", () => {
    expect(licenseState(license({ perpetual: true, ends_on: null }), TODAY, 30)).toBe("evig");
  });

  it("känner igen licens som ännu inte startat", () => {
    expect(
      licenseState(license({ starts_on: "2026-09-01", ends_on: "2026-12-01" }), TODAY, 30),
    ).toBe("kommande");
  });
});

describe("expiringLicenses", () => {
  it("sorterar närmast förfall först och utelämnar övriga", () => {
    const list = [
      license({ id: "sent", ends_on: "2026-08-28" }),
      license({ id: "langt_bort", ends_on: "2027-01-01" }),
      license({ id: "snart", ends_on: "2026-08-10" }),
      license({ id: "redan_ute", ends_on: "2026-06-01" }),
    ];
    expect(expiringLicenses(list, TODAY, 30).map((l) => l.id)).toEqual(["snart", "sent"]);
  });
});

describe("lapsedLicenses", () => {
  it("plockar ut licenser som redan gått ut", () => {
    const list = [
      license({ id: "aktiv", ends_on: "2026-12-01" }),
      license({ id: "ute", ends_on: "2026-06-01" }),
    ];
    expect(lapsedLicenses(list, TODAY, 30).map((l) => l.id)).toEqual(["ute"]);
  });
});

describe("exclusivityConflicts", () => {
  const skincare = license({
    id: "verso",
    brand_id: "verso",
    exclusive_category: "hudvård",
    exclusivity_ends_on: "2026-09-12",
  });

  it("varnar när ett nytt uppdrag krockar med levande exklusivitet", () => {
    const hits = exclusivityConflicts([skincare], "hudvård", TODAY);
    expect(hits).toHaveLength(1);
    expect(hits[0].daysLeft).toBe(39);
  });

  it("bryr sig inte om versaler eller mellanslag i branschnamnet", () => {
    expect(exclusivityConflicts([skincare], "  Hudvård ", TODAY)).toHaveLength(1);
  });

  it("släpper igenom en annan bransch", () => {
    expect(exclusivityConflicts([skincare], "hårvård", TODAY)).toHaveLength(0);
  });

  it("släpper igenom när exklusiviteten redan löpt ut", () => {
    const gammal = license({
      exclusive_category: "hudvård",
      exclusivity_ends_on: "2026-07-01",
    });
    expect(exclusivityConflicts([gammal], "hudvård", TODAY)).toHaveLength(0);
  });

  it("räknar inte varumärket mot sig självt vid förnyelse", () => {
    expect(exclusivityConflicts([skincare], "hudvård", TODAY, "verso")).toHaveLength(0);
  });
});

describe("isRelicensable", () => {
  it("frigör material när alla licenser gått ut och ingen exklusivitet lever", () => {
    const list = [license({ ends_on: "2026-06-01" }), license({ ends_on: "2026-07-01" })];
    expect(isRelicensable(list, TODAY, 30)).toBe(true);
  });

  it("håller kvar materialet om någon licens fortfarande är aktiv", () => {
    const list = [license({ ends_on: "2026-06-01" }), license({ ends_on: "2026-12-01" })];
    expect(isRelicensable(list, TODAY, 30)).toBe(false);
  });

  it("håller kvar materialet om exklusiviteten lever kvar efter licensen", () => {
    const list = [
      license({
        ends_on: "2026-06-01",
        exclusive_category: "hudvård",
        exclusivity_ends_on: "2026-10-01",
      }),
    ];
    expect(isRelicensable(list, TODAY, 30)).toBe(false);
  });

  it("räknar material utan licenser som icke återlicensierbart", () => {
    expect(isRelicensable([], TODAY, 30)).toBe(false);
  });
});

describe("daysUntilExpiry", () => {
  it("returnerar null för evig licens", () => {
    expect(daysUntilExpiry(license({ perpetual: true, ends_on: null }), TODAY)).toBeNull();
  });

  it("räknar negativt för passerat datum", () => {
    expect(daysUntilExpiry(license({ ends_on: "2026-08-01" }), TODAY)).toBe(-3);
  });
});
