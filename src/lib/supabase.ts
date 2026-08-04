import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Klienten skapas forst vid forsta faktiska anvandning, inte vid modul-import.
// Anledningen: skapas den vid import (som tidigare) kraschar hela skript-
// evalueringen innan React ens hinner montera nagot — ErrorBoundaryn nedanfor
// fangar aldrig det, sidan blir bara blank. Med lazy-init sker ett eventuellt
// fel forst inuti en React-effekt, dar ErrorBoundaryn faktiskt kan visa det.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Saknar VITE_SUPABASE_URL eller VITE_SUPABASE_PUBLISHABLE_KEY. Lokalt: kopiera .env.example till .env.local. På Vercel: lägg till dem under Settings → Environment Variables och deploya om (Vite bakar in dem vid bygget, inte vid körning).",
    );
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient();
    const value = Reflect.get(real, prop);
    // Metoder maste bindas till den riktiga klienten — annars blir "this"
    // vart proxy-objekt istallet nar de anropas som supabase.from(...).
    return typeof value === "function" ? value.bind(real) : value;
  },
});
