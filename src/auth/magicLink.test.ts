import { describe, expect, it } from "vitest";
import {
  authCallbackError,
  authRedirectUrl,
  emailOtpVerification,
  INVALID_AUTH_LINK_MESSAGE,
  verifyEmailOtp,
} from "@/auth/magicLink";

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

describe("authCallbackError", () => {
  it("visar en tydlig state för en utgången eller återanvänd magic link", () => {
    const result = authCallbackError(
      "https://piches.essensiadesign.se/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );

    expect(result).toBe(INVALID_AUTH_LINK_MESSAGE);
  });

  it("hanterar återanvänd länk även när felet ligger i query-parametrar", () => {
    const result = authCallbackError(
      "https://piches.essensiadesign.se/?error=access_denied&error_description=Link+has+already+been+used",
    );

    expect(result).toBe(INVALID_AUTH_LINK_MESSAGE);
  });

  it("visar inget fel för en callback utan authfel", () => {
    expect(authCallbackError("https://piches.essensiadesign.se/#access_token=ok"))
      .toBeNull();
  });
});

describe("emailOtpVerification", () => {
  it("bygger Supabases OTP-payload med trimmad mejl och sexsiffrig kod", () => {
    expect(emailOtpVerification("  linn@example.com ", " 123456 ")).toEqual({
      email: "linn@example.com",
      token: "123456",
      type: "email",
    });
  });

  it.each(["12345", "1234567", "12A456", ""]) (
    "avvisar ogiltig OTP %j",
    (code) => {
      expect(() => emailOtpVerification("linn@example.com", code)).toThrow(
        "E-postkoden måste bestå av exakt sex siffror.",
      );
    },
  );

  it("anropar Supabase verifyOtp med email-kontraktet", async () => {
    let received: unknown;
    const client = {
      async verifyOtp(payload: unknown) {
        received = payload;
        return { error: null };
      },
    };

    const result = await verifyEmailOtp(client, "linn@example.com", "654321");

    expect(result.error).toBeNull();
    expect(received).toEqual({
      email: "linn@example.com",
      token: "654321",
      type: "email",
    });
  });
});
