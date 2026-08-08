import { describe, expect, it } from "vitest";
import { authRedirectUrl } from "@/auth/magicLink";

describe("authRedirectUrl", () => {
  it("behåller standalone-appen på domänroten", () => {
    expect(authRedirectUrl("https://piches.essensiadesign.se", "/")).toBe(
      "https://piches.essensiadesign.se/",
    );
  });

  it("behåller den brandade appens undermapp", () => {
    expect(authRedirectUrl("https://essensiadesign.se", "/piches/")).toBe(
      "https://essensiadesign.se/piches/",
    );
  });

  it("avvisar en basadress på en annan origin", () => {
    expect(() => authRedirectUrl("https://piches.essensiadesign.se", "https://example.com/"))
      .toThrow("Auth-redirecten måste stanna på appens origin.");
  });
});
