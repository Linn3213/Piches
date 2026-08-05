import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    setBusy(false);
    // Tekniska fel far aldrig na anvandaren rakt av.
    if (authError) setError("Det gick inte att skicka länken. Kontrollera adressen och försök igen.");
    else setSent(true);
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
              Vi skickade en inloggningslänk till {email}. Länken gäller en kort stund, så använd den direkt.
            </p>
            <button
              onClick={() => setSent(false)}
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
            {error && <p className="text-body-md text-error">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Skickar..." : "Skicka inloggningslänk"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
