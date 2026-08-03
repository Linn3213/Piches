# Piches

Röst-först pipeline för UGC-uppdrag: leads, pitchar, uppföljning. Vecka 1-stommen
ur scope-dokumentet (schema + RLS, auth, leads/pipeline, manuell inmatning,
lista + detaljvy). Röstdelen (vecka 2) och fakturering (vecka 3) är inte byggda.

## Var koden ligger just nu

Den här mappen ligger tillfälligt inuti Learnnd-repot
(`remix-of-hudterapeutens-l-rlingsguide`), på branchen
`claude/ugc-app-scope-architecture-9powlp`. Det är inte den slutgiltiga
platsen — Piches ska ha ett eget repo. Anledningen till att den hamnade här:
Claude Code-sessionen som byggde den kunde skriva till det befintliga
Learnnd-repot, men GitHub-integrationen tillät inte att skapa ett nytt repo
(`Linn3213/Piches` gav 403 på både `POST /user/repos` och forks-API:et).

**Så fort `Linn3213/Piches` finns på GitHub**, kör:

```
piches/scripts/lyft-till-eget-repo.sh
```

från roten av Learnnd-repot. Det flyttar hela mappen (med git-historik) till
det nya repot och tar bort den härifrån.

## Kom igång lokalt

```
npm install
cp .env.example .env.local   # fyll i Supabase-URL och publishable key
npm run dev
```

Kör `supabase/migrations/0001_init.sql` mot ett Supabase-projekt innan du
loggar in första gången — RLS är på från start, så utan migrationen finns
inga tabeller att skriva till.

Inloggning är magic link (Supabase `signInWithOtp`), inget lösenord i v1.

## Datamodell

- **brands** — leads/varumärken. `tier` (1–3), `status` i pipelinen
  (ny → researchad → pitchad → svarat → offert → vunnen/förlorad/vilande).
- **pitches** — varje utskick mot ett brand, med kanal, belopp och status.
  En pitch med status `skickad` flyttar automatiskt sitt brand till `pitchad`.
- **activities** — logg över statusbyten och pitchar, en per brand. Det här är
  underlaget för statistikvyn i vecka 3 (skickas inte, ej byggd än).
- **tasks** — fristående uppgifter, kopplade eller ej till ett brand.

Allt är scopat på `user_id = auth.uid()` via RLS — byggt för en användare,
designat för att bära fler utan schemaändring.

## Vad som INTE är byggt än (med flit)

Röststyrning (PWA + IndexedDB-kö + Whisper + Haiku-intents), Stripe-fakturor,
statistikvy, Gmail-outreach, Fortnox-koppling. Se scope-dokumentet för
ordningen — memot rekommenderar att skicka 20 pitchar manuellt innan mer kod
skrivs.
