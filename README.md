# Piches

Röst-först pipeline för UGC-uppdrag: leads, pitchar, uppföljning, statistik.
Vecka 1 ur scope-dokumentet (`docs/scope-arkitektur-v1.md`) plus statistikvyn
och uppgiftslistan. Röstdelen (vecka 2) och Stripe-fakturor är inte byggda.

## Backend: det DELADE Supabase-projektet

Piches ligger i samma Supabase-projekt som Studio L.A, DayliLife, Planexr,
Contista, Essensia, Learnnd, Clostie och Optionsmorgon — precis som alla
andra appar. **Inget eget projekt.**

| | |
|---|---|
| Projekt-ref | `mhswnvzpqekdcdjxxrmm` |
| URL | `https://mhswnvzpqekdcdjxxrmm.supabase.co` |
| Tabeller | `piches_brands`, `piches_pitches`, `piches_activities`, `piches_tasks` |

Läs skill `supabase-delad-infra` innan du rör något i backend. Kortversionen
av reglerna, som den här appen följer:

- **Alla tabeller prefixas `piches_*`.** Ingen delad affärsdata mellan produkter.
- **Ingen egen `profiles`-tabell och ingen trigger på `auth.users`.** De är
  globala. En egen trigger där slår mot inloggningen i *alla* appar i projektet.
- Även hjälpfunktionen heter `piches_touch_updated_at`, så att den inte skriver
  över en funktion en annan produkt äger.
- RLS `auth.uid() = user_id` på varenda tabell.

Auth-mejl (magic link) går via projektets befintliga Hostinger-SMTP och
`auth-email-hook` — därför fungerar utskicken här utan att något nytt behöver
konfigureras.

## Kom igång lokalt

```
npm install
cp .env.example .env.local   # fyll i värdena för det delade projektet
npm run dev
```

Migrationen i `supabase/migrations/` är redan applicerad mot det delade
projektet. Kör den bara om du sätter upp en helt ny miljö.

## Datamodell

- **piches_brands** — leads/varumärken. `tier` (1–3), `status` i pipelinen
  (ny → researchad → pitchad → svarat → offert → vunnen/förlorad/vilande).
- **piches_pitches** — varje utskick mot ett brand, med kanal, belopp och status.
  En pitch med status `skickad` flyttar automatiskt sitt brand till `pitchad`.
- **piches_activities** — logg över statusbyten och pitchar. Underlaget för
  statistikvyn.
- **piches_tasks** — fristående uppgifter, kopplade eller ej till ett brand.

## Sidor

- **Pipeline** — aktiva varumärken grupperade per status.
- **Varumärken** — full lista, sök/filter, ny/redigera.
- **Varumärke → detalj** — brand-info, pitchregistrering, statushistorik.
- **Uppgifter** — fristående att-göra-lista, valfritt kopplad till ett brand.
- **Statistik** — pitchar ute (totalt + senaste 30 dagarna), svarsfrekvens,
  antal vunna, snittordervärde bland vunna, intäkt per månad (senaste 6).

## Drift

Deployad på Vercel (`piches.vercel.app`), kopplad till det här repot — pushar
till `main` deployar automatiskt. Env-variablerna sätts i Vercel under
Settings → Environment Variables. Notera att Vite bakar in `VITE_`-variabler
**vid bygget**, inte vid körning: ändrar du dem måste du deploya om för att
de ska slå igenom.

Saknas variablerna visar appen ett tydligt felmeddelande i stället för en
blank sida (`src/components/ErrorBoundary.tsx`).

## Vad som INTE är byggt än (med flit)

Röststyrning (PWA + IndexedDB-kö + Whisper + Haiku-intents), Stripe-fakturor,
Gmail-outreach, Fortnox-koppling. Se `docs/scope-arkitektur-v1.md` — memot
rekommenderar att skicka 20 pitchar manuellt innan mer kod skrivs.
