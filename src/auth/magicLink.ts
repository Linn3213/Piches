/**
 * Supabase måste skicka tillbaka användaren till appens faktiska basväg.
 * Standalone ligger på domänroten, medan de brandade byggena ligger under
 * /piches/. Att bara använda window.location.origin tappar undermappen.
 */
export function authRedirectUrl(origin: string, baseUrl: string): string {
  const appOrigin = new URL(origin).origin;
  const redirect = new URL(baseUrl, `${appOrigin}/`);

  // BASE_URL är byggkonfiguration, men auth-redirects ska ändå aldrig kunna
  // flytta en session till en annan origin om konfigurationen blir fel.
  if (redirect.origin !== appOrigin) {
    throw new Error("Auth-redirecten måste stanna på appens origin.");
  }

  redirect.search = "";
  redirect.hash = "";
  return redirect.toString();
}

export const INVALID_AUTH_LINK_MESSAGE =
  "Länken är ogiltig, har gått ut eller har redan använts. Be om en ny inloggningslänk.";

const authParam = (url: URL, key: string): string | null => {
  const fromQuery = url.searchParams.get(key);
  if (fromQuery) return fromQuery;
  return new URLSearchParams(url.hash.replace(/^#/, "")).get(key);
};

/**
 * Supabase returnerar förbrukade och utgångna magic links som access_denied,
 * vanligtvis med error_code=otp_expired. Båda ska ge samma säkra användarstate.
 */
export function authCallbackError(currentUrl: string): string | null {
  const url = new URL(currentUrl);
  const error = authParam(url, "error")?.toLowerCase() ?? "";
  const errorCode = authParam(url, "error_code")?.toLowerCase() ?? "";
  const description = authParam(url, "error_description")?.toLowerCase() ?? "";

  const invalidOrUsed =
    error === "access_denied" ||
    errorCode === "otp_expired" ||
    /invalid|expired|already (?:been )?used|ogiltig|utgången|använd/.test(description);

  return invalidOrUsed ? INVALID_AUTH_LINK_MESSAGE : null;
}

export interface EmailOtpVerification {
  email: string;
  token: string;
  type: "email";
}

export interface EmailOtpClient {
  verifyOtp(payload: EmailOtpVerification): Promise<{ error: unknown }>;
}

/** Exakt payload för Supabases sexsiffriga e-post-OTP. */
export function emailOtpVerification(email: string, code: string): EmailOtpVerification {
  const token = code.trim();
  if (!/^\d{6}$/.test(token)) {
    throw new Error("E-postkoden måste bestå av exakt sex siffror.");
  }

  return {
    email: email.trim(),
    token,
    type: "email",
  };
}

/** Kör OTP-inloggningen via en injicerad Supabase-kompatibel authklient. */
export function verifyEmailOtp(client: EmailOtpClient, email: string, code: string) {
  return client.verifyOtp(emailOtpVerification(email, code));
}
