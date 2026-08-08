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
