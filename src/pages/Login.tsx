import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: authRedirectUrl(window.location.origin, import.meta.env.BASE_URL),
          /* Piches är ett internt verktyg för en enda användare, inte en
             tjänst med öppen registrering. Utan den här raden skapade varje
             främling som hittade adressen ett konto i auth-poolen som DELAS
             med Studio L.A, Planexr och Learnnd. RLS hindrade dem från att se
             data, men dörren stod öppen och rader skrevs i auth.users. */
          shouldCreateUser: false,
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
          setError(
            "Det finns inget konto för den adressen. Piches öppnas med en inbjudan, så hör av dig så lägger vi upp dig.",
          );
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
          <form onSubmit={submit} className="mt-8 space-y-4">
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

        {/* Vag in for den som INTE har ett konto.
            Registreringen ar stangd med flit: Piches delar auth-pool med
            Studio L.A, Planexr och Learnnd, sa en oppen dorr har skulle lata
            vem som helst skapa rader i den poolen. Men utan nagon vag alls kan
            produkten heller aldrig saljas, for den som hittar hit och blir
            intresserad mots bara av en inloggning hon inte kan anvanda.
            Intresseanmalan gar till samma lead-flode som ovriga, och Linn
            oppnar kontot for hand. */}
        {/* PRIS plus vag in.
            Utan en siffra kan Piches inte saljas till nagon, aven om produkten
            ar fardig: den som blir intresserad vet inte om den kostar 99 eller
            9 000 och hor darfor aldrig av sig. Kortbetalning finns inte an, men
            den behovs heller inte for de forsta kunderna, precis som for
            Planexr: Linn satter upp kontot och fakturerar.
            ANDRA SIFFRAN HAR, det ar enda stallet den star. */}
        <div className="mt-10 border-t border-outline-variant/40 pt-6">
          <p className="text-title-md text-on-surface">299 kr i månaden</p>
          <p className="mt-1.5 text-body-md text-on-surface-variant">
            Exklusive moms, faktureras kvartalsvis, och du kan säga upp när du vill. En enda licens
            som hinner löpa ut obemärkt kostar oftast mer än ett helt år av det här.
          </p>
          <p className="mt-4 text-body-md text-on-surface-variant">
            Piches öppnas för en kreatör i taget, så att varje uppsättning blir rätt från början.{" "}
            <a
              href="mailto:info@essensiadesign.se?subject=Jag%20vill%20prova%20Piches&body=Hej!%20Jag%20jobbar%20med%20UGC%20och%20vill%20g%C3%A4rna%20prova%20Piches.%20H%C3%A4r%20%C3%A4r%20lite%20om%20mig%3A%0A%0A"
              className="underline transition-colors hover:text-on-surface"
            >
              Skriv en rad så hör jag av mig.
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
