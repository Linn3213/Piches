import { describe, expect, it } from "vitest";
import type { Subscription } from "@/types/db";
import {
  behoverStripeSynk,
  evaluateAccess,
  stripeStatusTillStatus,
  TIERS,
  tierPlan,
  trialEndsOn,
} from "@/lib/access";

const IDAG = new Date(2026, 7, 17); // 17 aug 2026

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    user_id: "u",
    tier: "solo",
    status: "provperiod",
    trial_ends_on: "2026-08-31",
    current_period_end: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    granted_by_owner: false,
    created_at: "2026-08-17T00:00:00Z",
    updated_at: "2026-08-17T00:00:00Z",
    ...over,
  };
}

describe("åtkomst", () => {
  it("släpper in under provperioden och räknar dagarna", () => {
    const a = evaluateAccess(sub({ trial_ends_on: "2026-08-31" }), IDAG);
    expect(a.allowed).toBe(true);
    expect(a.state).toBe("provperiod");
    expect(a.trialDaysLeft).toBe(14);
  });

  it("låser ute dagen efter att provperioden gått ut", () => {
    const a = evaluateAccess(sub({ trial_ends_on: "2026-08-16" }), IDAG);
    expect(a.allowed).toBe(false);
    expect(a.state).toBe("provperiod_slut");
  });

  it("släpper in sista dagen av provperioden, inte bara fram till dagen innan", () => {
    const a = evaluateAccess(sub({ trial_ends_on: "2026-08-17" }), IDAG);
    expect(a.allowed).toBe(true);
    expect(a.trialDaysLeft).toBe(0);
  });

  it("påminner först sista veckan, inte dag ett", () => {
    expect(evaluateAccess(sub({ trial_ends_on: "2026-08-31" }), IDAG).shouldNudge).toBe(false);
    expect(evaluateAccess(sub({ trial_ends_on: "2026-08-22" }), IDAG).shouldNudge).toBe(true);
  });

  it("släpper in den som betalar", () => {
    const a = evaluateAccess(sub({ status: "aktiv", trial_ends_on: null }), IDAG);
    expect(a.allowed).toBe(true);
    expect(a.state).toBe("aktiv");
  });

  it("låser ute den vars betalning slutat fungera", () => {
    expect(evaluateAccess(sub({ status: "forfallen" }), IDAG).allowed).toBe(false);
  });

  it("låter den som sagt upp behålla tiden hon redan betalat för", () => {
    const a = evaluateAccess(
      sub({ status: "uppsagd", current_period_end: "2026-09-15T00:00:00Z" }),
      IDAG,
    );
    expect(a.allowed).toBe(true);
    expect(a.state).toBe("uppsagd_men_kvar");
    expect(a.shouldNudge).toBe(true);
  });

  it("stänger av först när den uppsagda perioden faktiskt tagit slut", () => {
    const a = evaluateAccess(
      sub({ status: "uppsagd", current_period_end: "2026-08-01T00:00:00Z" }),
      IDAG,
    );
    expect(a.allowed).toBe(false);
    expect(a.state).toBe("forfallen");
  });

  it("släpper alltid in ett konto som öppnats för hand", () => {
    // Manuellt fakturerad kund far aldrig lasas ute for att Stripe inte
    // kanner till henne.
    const a = evaluateAccess(
      sub({ granted_by_owner: true, status: "provperiod", trial_ends_on: "2020-01-01" }),
      IDAG,
    );
    expect(a.allowed).toBe(true);
    expect(a.state).toBe("aktiv");
  });

  it("nekar när det inte finns någon rad alls", () => {
    const a = evaluateAccess(null, IDAG);
    expect(a.allowed).toBe(false);
    expect(a.state).toBe("ingen");
  });

  it("nekar en provperiod utan slutdatum, i stället för att gälla för alltid", () => {
    const a = evaluateAccess(sub({ trial_ends_on: null }), IDAG);
    expect(a.allowed).toBe(false);
  });
});

describe("provperiodens längd", () => {
  it("räknar fjorton dagar framåt", () => {
    expect(trialEndsOn(IDAG)).toBe("2026-08-31");
  });

  it("klarar månadsskifte", () => {
    expect(trialEndsOn(new Date(2026, 7, 25))).toBe("2026-09-08");
  });
});

describe("nivåerna", () => {
  it("lovar bara sådant appen faktiskt gör", () => {
    for (const t of TIERS) {
      expect(t.includes.length).toBeGreaterThan(0);
      expect(t.priceSek).toBeGreaterThan(0);
    }
  });

  it("faller tillbaka på Solo för en okänd nivå", () => {
    expect(tierPlan("solo").tier).toBe("solo");
    expect(tierPlan("studio").priceSek).toBe(899);
  });
});

describe("stripeStatusTillStatus", () => {
  it("aktiv och trialing ger tillgang", () => {
    expect(stripeStatusTillStatus("active", false)).toBe("aktiv");
    expect(stripeStatusTillStatus("trialing", false)).toBe("aktiv");
  });

  it("uppsagd men inte slut behaller perioden, inte statusen aktiv", () => {
    // Det HAR hant hos andra att uppsagd rakade mappas till aktiv, och da
    // fornyades aldrig nagot medan kunden trodde hon sagt upp.
    expect(stripeStatusTillStatus("active", true)).toBe("uppsagd");
    expect(stripeStatusTillStatus("trialing", true)).toBe("uppsagd");
  });

  it("misslyckad betalning later inte kunden fortsatta gratis", () => {
    expect(stripeStatusTillStatus("past_due", false)).toBe("forfallen");
    expect(stripeStatusTillStatus("unpaid", false)).toBe("forfallen");
    expect(stripeStatusTillStatus("incomplete", false)).toBe("forfallen");
  });

  it("avslutad prenumeration blir uppsagd", () => {
    expect(stripeStatusTillStatus("canceled", false)).toBe("uppsagd");
    expect(stripeStatusTillStatus("incomplete_expired", false)).toBe("uppsagd");
  });

  it("ett okant lage ger inte bort produkten", () => {
    expect(stripeStatusTillStatus("nagot_stripe_hittat_pa", false)).toBe("forfallen");
  });
});

describe("behoverStripeSynk", () => {
  const bas = {
    user_id: "u",
    tier: "solo",
    status: "aktiv",
    trial_ends_on: null,
    granted_by_owner: false,
    stripe_customer_id: "cus_1",
    stripe_subscription_id: "sub_1",
    current_period_end: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as unknown as Subscription;

  const nu = new Date("2026-08-19T12:00:00Z");

  it("provperiod fragar aldrig Stripe", () => {
    expect(
      behoverStripeSynk({ ...bas, stripe_subscription_id: null, status: "provperiod" }, nu),
    ).toBe(false);
  });

  it("ingen rad alls fragar aldrig Stripe", () => {
    expect(behoverStripeSynk(null, nu)).toBe(false);
  });

  it("betald period som loper fragar inte i onodan", () => {
    expect(
      behoverStripeSynk({ ...bas, current_period_end: "2026-09-19T12:00:00Z" }, nu),
    ).toBe(false);
  });

  it("period som tagit slut MASTE kollas, annars gar churn obemarkt", () => {
    expect(
      behoverStripeSynk({ ...bas, current_period_end: "2026-08-19T11:59:00Z" }, nu),
    ).toBe(true);
  });

  it("Stripe-abonnemang utan periodslut kollas ocksa", () => {
    expect(behoverStripeSynk({ ...bas, current_period_end: null }, nu)).toBe(true);
  });
});
