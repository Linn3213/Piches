import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { TIERS, TRIAL_DAYS } from "@/lib/access";
import {
  authCallbackError,
  authLoginUrl,
  authRedirectUrl,
  verifyEmailOtp,
} from "@/auth/magicLink";

export default function Login() {
  const { session, loading } = useAuth();
  const [initialAuthError] = useState(() => authCallbackError(window.location.href));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [kanSkapaKonto, setKanSkapaKonto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialAuthError);

  useEffect(() => {
    if (!initialAuthError) return;

    // Ta bort Supabases authfel ur adressfältet så att en omladdning inte ser ut
    // som ett nytt misslyckat försök. Inga tokens eller feltexter sparas.
    window.history.replaceState(
      {},
      "",
      authLoginUrl(window.location.origin, import.meta.env.BASE_URL),
    );
  }, [initialAuthError]);

  if (!loading && session) return <Navigate to="/" replace />;

  /**
   * Ett enda fält, två utfall.
   *
   * Tidigare var registreringen helt stängd och varje nytt konto öppnades för
   * hand. Det höll för de tre första kunderna och blev sedan taket för hela
   * affären, eftersom arbetet växte linjärt med antalet kunder.
   *
   * Nu görs ett försök att logga in UTAN att skapa konto. Svarar servern att
   * kontot saknas erbjuds registrering i stället, med ett andra klick. Det gör
   * att ingen främling råkar skriva en rad i auth-poolen bara genom att skriva
   * fel adress, samtidigt som den som verkligen vill prova tar sig in själv.
   */
  async function skicka(skapaKonto: boolean) {
    setBusy(true);
    setError(null);
    setKanSkapaKonto(false);

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: authRedirectUrl(window.location.origin, import.meta.env.BASE_URL),
          shouldCreateUser: skapaKonto,
        },
      });

      // Tekniska fel får aldrig nå användaren rakt av, men de får heller inte
      // kollapsa till ett svar som pekar åt fel håll. Tidigare svarade appen
      // "kontrollera adressen" även när adressen var helt rätt och det enda
      // som saknades var ett konto, så den som skrivit rätt satt och skrev om
      // samma mejladress om och om igen utan att något ändrades.
      if (authError) {
        const kod = (authError as { code?: string }).code;
        if (kod === "otp_disabled") {
          setKanSkapaKonto(true);
          setError(null);
        } else if (authError.status === 429 || kod === "over_email_send_rate_limit") {
          setError("Du har begärt flera länkar på kort tid. Vänta en stund och försök igen.");
        } else {
          setError("Det gick inte att skicka länken. Kontrollera adressen och försök igen.");
        }
      } else {
        setSent(true);
      }
    } catch {
      setError("Det gick inte att skicka länken. Försök igen om en stund.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifyBusy(true);
    setError(null);

    try {
      const { error: verifyError } = await verifyEmailOtp(supabase.auth, email, code);

      if (verifyError) {
        setError("Koden är fel eller har gått ut. Kontrollera mejlet eller be om en ny kod.");
        return;
      }

      window.location.assign(authRedirectUrl(window.location.origin, import.meta.env.BASE_URL));
    } catch {
      setError("Det gick inte att verifiera koden. Försök igen om en stund.");
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm">
        <Logo size={56} />
        <h1 className="mt-5 text-headline-lg text-on-surface">Piches</h1>
        <p className="mt-2 text-body-lg text-on-surface-variant">
          Varje uppdrag är en licens med en klocka, och appen håller reda på den så att ingen förnyelse hinner rinna ut.
        </p>

        {sent ? (
          <div className="mt-8 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5">
            <p className="text-headline-sm">Kolla mejlen.</p>
            <p className="mt-2 text-body-md text-on-surface-variant">
              Vi skickade en inloggningslänk och en sexsiffrig reservkod till {email}. Använd någon av dem direkt.
            </p>
            <form onSubmit={verifyCode} className="mt-5 space-y-3">
              <Field label="Sexsiffrig kod">
                <Input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  aria-describedby={error ? "login-code-error" : undefined}
                />
              </Field>
              {error && (
                <p id="login-code-error" className="text-body-md text-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={verifyBusy || code.length !== 6} className="w-full">
                {verifyBusy ? "Verifierar..." : "Logga in med koden"}
              </Button>
            </form>
            <button
              onClick={() => {
                setSent(false);
                setCode("");
                setError(null);
              }}
              className="mt-4 text-body-md text-on-surface-variant underline transition-colors hover:text-on-surface"
            >
              Skicka till en annan adress
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void skicka(false);
            }}
            className="mt-8 space-y-4"
          >
            <Field label="Mejladress">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@exempel.se"
              />
            </Field>
            {error && (
              <p className="text-body-md text-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Skickar..." : "Skicka inloggningslänk"}
            </Button>
          </form>
        )}

        {/* Den som skrivit en adress utan konto möts inte längre av ett nej.
            Texten säger rakt ut vad som händer, för ett klick som tyst skapar
            ett konto åt någon som bara stavat fel är värre än ett extra steg. */}
        {!sent && kanSkapaKonto && (
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary-container/30 p-5">
            <p className="text-title-md text-on-surface">Det finns inget konto på {email} än.</p>
            <p className="mt-1.5 text-body-md text-on-surface-variant">
              Du kan skapa ett nu och köra {TRIAL_DAYS} dagar utan att betala, utan kort och utan
              att binda upp dig. Är adressen felstavad ändrar du den bara och försöker igen.
            </p>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void skicka(true)}
              className="mt-4 w-full"
            >
              {busy ? "Skapar konto..." : `Skapa konto och kör ${TRIAL_DAYS} dagar gratis`}
            </Button>
          </div>
        )}

        {/* PRISERNA STÅR I src/lib/access.ts, ingen annanstans.
            En siffra som lever på två ställen hinner alltid bli två olika
            siffror, och den kunden som såg det lägre priset har rätt. */}
        <div className="mt-10 border-t border-outline-variant/40 pt-6">
          <p className="text-label-caps uppercase text-on-surface-variant">
            {TRIAL_DAYS} dagar gratis, sedan
          </p>
          <div className="mt-3 space-y-3">
            {TIERS.map((plan) => (
              <div
                key={plan.tier}
                className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-title-md text-on-surface">{plan.label}</p>
                  <p className="font-mono text-title-md text-primary">
                    {plan.priceSek} kr/mån
                  </p>
                </div>
                <p className="mt-1 text-body-md text-on-surface-variant">{plan.fits}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-body-md text-on-surface-variant">
            Priserna är exklusive moms och du säger upp när du vill. En enda licens som hinner löpa
            ut obemärkt kostar oftast mer än ett helt år av det här.
          </p>
        </div>
      </div>
    </div>
  );
}
