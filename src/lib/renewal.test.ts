import { describe, expect, it } from "vitest";
import type { Brand, License, Pitch, PitchStatus } from "@/types/db";
import {
  buildRenewalProposal,
  isAlreadyHandled,
  renewalQueue,
  suggestedRenewalFee,
} from "@/lib/renewal";

const TODAY = new Date(2026, 7, 5); // 5 aug 2026

function license(over: Partial<License> = {}): License {
  return {
    id: "lic-1",
    user_id: "u",
    pitch_id: "p-1",
    brand_id: "verso",
    deliverable_id: null,
    channels: ["paid_social"],
    territory: "se",
    starts_on: "2025-09-01",
    ends_on: "2026-09-01",
    perpetual: false,
    exclusive_category: null,
    exclusivity_ends_on: null,
    includes_raw_files: false,
    fee_sek: 20000,
    notes: null,
    created_at: "2025-09-01T00:00:00Z",
    updated_at: "2025-09-01T00:00:00Z",
    ...over,
  };
}

function pitch(status: PitchStatus, renewedFrom: string | null): Pitch {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u",
    brand_id: "verso",
    status,
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
    renewed_from_license_id: renewedFrom,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const brand: Brand = {
  id: "verso",
  user_id: "u",
  name: "Verso Skincare",
  website: null,
  instagram: null,
  contact_name: null,
  contact_email: null,
  tier: 1,
  status: "vunnen",
  source: null,
  observation: null,
  notes: null,
  next_action_at: null,
  org_nr: null,
  vat_nr: null,
  address: null,
  zip: null,
  city: null,
  country: "SE",
  is_company: true,
  invoice_reference: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("förnyelsepris", () => {
  it("lägger på påslaget på vad kunden senast betalade", () => {
    expect(suggestedRenewalFee(license({ fee_sek: 20000 }), 15)).toBe(23000);
  });

  it("föreslår samma pris när påslaget är noll", () => {
    expect(suggestedRenewalFee(license({ fee_sek: 20000 }), 0)).toBe(20000);
  });

  it("ger null när det inte finns något tidigare pris att utgå från", () => {
    expect(suggestedRenewalFee(license({ fee_sek: null }), 15)).toBeNull();
  });
});

describe("förnyelseförslag", () => {
  it("skriver texten runt utgångsdatumet, inte runt en mall", () => {
    const p = buildRenewalProposal(license(), brand, TODAY, 15);
    expect(p.observation).toContain("1 september");
    expect(p.observation).toContain("Verso Skincare");
    expect(p.lapsed).toBe(false);
    expect(p.daysLeft).toBe(27);
  });

  it("tar alltid med årtalet, eftersom licenser spänner över årsskiften", () => {
    // En licens som slutar 1 sep 2026 far inte sta som bara "1 september" i
    // ett mejl som ska fa nagon att agera nu i stallet for om ett ar.
    const p = buildRenewalProposal(license(), brand, TODAY, 15);
    expect(p.observation).toContain("2026");
    expect(p.subject).toContain("2026");
  });

  it("byter ton när licensen redan gått ut", () => {
    const p = buildRenewalProposal(license({ ends_on: "2026-07-01" }), brand, TODAY, 15);
    expect(p.lapsed).toBe(true);
    expect(p.observation).toContain("gick ut");
    expect(p.observation).toContain("inte längre får använda");
  });

  it("klarar sig utan varumärkespost utan att krascha", () => {
    const p = buildRenewalProposal(license(), undefined, TODAY, 15);
    expect(p.brandName).toBe("Varumärket");
  });

  it("tar med förra priset så att förhandlingen har ett golv", () => {
    const p = buildRenewalProposal(license({ fee_sek: 18000 }), brand, TODAY, 20);
    expect(p.previousFee).toBe(18000);
    expect(p.suggestedFee).toBe(21600);
  });
});

describe("förnyelsekön", () => {
  it("tystnar för licenser som redan har en pågående förnyelseaffär", () => {
    const l = license();
    expect(isAlreadyHandled(l, [pitch("skickad", "lic-1")])).toBe(true);
    expect(isAlreadyHandled(l, [pitch("skickad", "annan-licens")])).toBe(false);
  });

  it("tar upp licensen igen om förnyelseförsöket förlorades", () => {
    const l = license();
    expect(isAlreadyHandled(l, [pitch("forlorad", "lic-1")])).toBe(false);
    expect(isAlreadyHandled(l, [pitch("betalt", "lic-1")])).toBe(false);
  });

  it("sätter det som snart går ut före det som redan runnit ut", () => {
    const snart = license({ id: "snart", ends_on: "2026-08-20" });
    const utgangen = license({ id: "utgangen", ends_on: "2026-06-01" });
    const queue = renewalQueue([snart], [utgangen], [], [brand], TODAY, 15);
    expect(queue.map((p) => p.license.id)).toEqual(["snart", "utgangen"]);
  });

  it("filtrerar bort omhändertagna licenser ur kön", () => {
    const l = license();
    expect(renewalQueue([l], [], [pitch("offert", "lic-1")], [brand], TODAY, 15)).toHaveLength(0);
  });
});
