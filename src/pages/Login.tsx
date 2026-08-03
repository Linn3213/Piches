import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, Input } from "@/components/ui";

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
        <h1 className="text-2xl font-semibold">Piches</h1>
        <p className="mt-1 text-sm text-ink/50">Pipeline för UGC-uppdrag</p>

        {sent ? (
          <div className="mt-8 rounded-2xl border border-line bg-white p-4 text-sm">
            <p className="font-medium">Kolla mejlen.</p>
            <p className="mt-1 text-ink/60">
              Vi skickade en inloggningslänk till {email}. Länken gäller i en timme.
            </p>
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
            {error && <p className="text-sm text-clay">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Skickar..." : "Skicka inloggningslänk"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
