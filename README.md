# Piches

Röst-först pipeline för UGC-uppdrag: leads, pitchar, uppföljning, statistik.
Vecka 1 ur scope-dokumentet (`docs/scope-arkitektur-v1.md`) — plus statistikvyn
och uppgiftslistan från vecka 3, eftersom de bara läser appens egen data och
inte kräver någon extern integration. Röstdelen (vecka 2) och Stripe-fakturor
(resten av vecka 3) är inte byggda.

## Status

Kopplad mot ett riktigt Supabase-projekt (`Piches`, region `eu-north-1`,
org `Linn3213's Org`). Schema, RLS och två säkerhetsfixar från Supabase egen
advisor är applicerade och verifierade — noll varningar kvar. Bygget är
verifierat rent (`npm run typecheck`, `npm run build`) och inloggningssidan
är testad end-to-end i en riktig webbläsare mot det levande projektet.

Ett steg gick INTE att verifiera härifrån: sandboxens nätverkspolicy blockerar
utgående anrop till projektets egna `*.supabase.co`-adress (`403` från
egress-policyn, bekräftat — inte en kod- eller konfigurationsbugg). Så
`signInWithOtp`-anropet i sig, alltså att en riktig magic link faktiskt
skickas och landar i inkorgen, är overifierat från den här miljön. Testa det
själv med `npm run dev` lokalt eller från den driftsatta sajten — där finns
ingen sådan spärr.

## Kom igång lokalt

```
npm install
cp .env.example .env.local   # fyll i Supabase-URL och publishable key, se nedan
npm run dev
```

Riktiga uppgifter för det befintliga Piches-projektet:

```
VITE_SUPABASE_URL=https://gdxmraminmdentuvupzl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_iAtnMwm07PeSa4o6bArCrQ_OxTL8gXO
```

(Publishable/anon-nyckeln är säker att ha i klientkod — den är gjord för det.
RLS är det som faktiskt skyddar datan.) Migrationerna i
`supabase/migrations/` är redan körda mot det här projektet; kör dem bara om
du pekar om appen mot ett nytt/tomt projekt.

Inloggning är magic link (Supabase `signInWithOtp`), inget lösenord i v1.

## Datamodell

- **brands** — leads/varumärken. `tier` (1–3), `status` i pipelinen
  (ny → researchad → pitchad → svarat → offert → vunnen/förlorad/vilande).
- **pitches** — varje utskick mot ett brand, med kanal, belopp och status.
  En pitch med status `skickad` flyttar automatiskt sitt brand till `pitchad`.
- **activities** — logg över statusbyten och pitchar, en per brand. Underlaget
  för statistikvyn.
- **tasks** — fristående uppgifter, kopplade eller ej till ett brand.

Allt är scopat på `user_id = auth.uid()` via RLS — byggt för en användare,
designat för att bära fler utan schemaändring.

## Sidor

- **Pipeline** — aktiva varumärken grupperade per status.
- **Varumärken** — full lista, sök/filter, ny/redigera.
- **Varumärke → detalj** — brand-info, pitchregistrering, statushistorik.
- **Uppgifter** — fristående att-göra-lista, valfritt kopplad till ett brand.
- **Statistik** — pitchar ute (totalt + senaste 30 dagarna), svarsfrekvens,
  antal vunna, snittordervärde bland vunna, intäkt per månad (senaste 6).

## Vad som INTE är byggt än (med flit)

Röststyrning (PWA + IndexedDB-kö + Whisper + Haiku-intents), Stripe-fakturor,
Gmail-outreach, Fortnox-koppling. Se `docs/scope-arkitektur-v1.md` för
ordningen — memot rekommenderar att skicka 20 pitchar manuellt innan mer kod
skrivs.
