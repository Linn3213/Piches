# Piches

Affärssystem för UGC-kreatörer, byggt runt en vinkel ingen konkurrent har:
**varje uppdrag är en licens med en klocka, inte en avklarad uppgift.**

## Vinkeln: rättighetsmotorn

Deelo, Beacons, MySocial och Passionfroot betraktar alla en affär som klar
när fakturan är betald. Men i UGC säljer du användningsrätt under en
begränsad tid, och tre saker faller därför mellan stolarna hos dem:

1. **Licensen löper ut.** Varumärket måste sluta annonsera. Det är ditt bästa
   säljläge på hela året, och ingen app påminner dig. Piches har en
   utgångsradar med justerbart bevakningsfönster.
2. **Exklusiviteten krockar.** Du tackar ja till ett hudvårdsuppdrag utan att
   minnas att ett annat varumärke har branschexklusivitet till i höst.
   Piches varnar innan du bryter avtalet.
3. **Materialet återgår.** När licensen gått ut och exklusiviteten släppt är
   den färdiga videon fri att sälja igen. Ren marginal, ingen ny produktion.
   Piches listar lagret.

Samma modell driver prissättningen: priset **är** rättigheterna. Prisräknaren
visar hur stor del som är produktion och hur stor del som är licens, rad för
rad med en motivering, så att du kan försvara siffran i förhandling.

Logiken ligger i `src/lib/rights.ts` och `src/lib/pricing.ts` som rena
funktioner, täckta av 29 tester (`npx vitest run`).

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
- **piches_deliverables** — varje enskild sak som produceras i ett uppdrag.
- **piches_licenses** — rättigheterna med klocka: kanaler, marknad, start och
  slut, evig eller ej, branschexklusivitet, råmaterial och licensavgift.
- **piches_settings** — din prislista. Styr prisförslagen och bevakningsfönstret.

## Sidor

- **Idag** — prioriterad dagslista ur riktig data. Utgående licenser först,
  eftersom de kostar mest att missa.
- **Uppdrag** — pipeline per status, med antal registrerade licenser per kund.
- **Rättigheter** — utgångsradar, exklusivitetsvakt och lager fritt att sälja igen.
- **Pris** — förklarande prisräknare byggd på rättighetsmodellen.
- **Intäkter** — pitchar ute, svarsfrekvens, vunna, snittordervärde, intäkt per
  månad och rättighetsintäkter per varumärke.
- **Varumärken / detalj** — lista, sök, filter, pitchregistrering, historik.
- **Uppgifter** — fristående att-göra-lista.
- **Inställningar** — prislista och bevakningsfönster.

Formspråket följer Stitch-skisserna: Syne, JetBrains Mono för siffror,
sagegrönt mot varmt off-white, mjuka radier och Material Symbols.

## Drift

Sajten är `piches.essensiadesign.se` på Hostinger. Deploy är **manuell
filuppladdning** via Hostingers File Manager, aldrig git-auto-deploy — se
skill `hostinger-deploy` för det exakta flödet.

```
npm run build
cd dist && zip -r ../piches-dist.zip . -x ".*" && cd ..
```

Ladda upp zippen i sajtens webroot, extrahera med overwrite, ta bort zippen.

Notera att Vite bakar in `VITE_`-variabler **vid bygget**, inte vid körning:
värdena i `.env.local` är de som hamnar i bundlen. Ändrar du dem måste du
bygga om och ladda upp på nytt.

Saknas variablerna visar appen ett tydligt felmeddelande i stället för en
blank sida (`src/components/ErrorBoundary.tsx`).

## Vad som INTE är byggt än (med flit)

Röststyrning (PWA + IndexedDB-kö + Whisper + Haiku-intents), Stripe-fakturor,
Gmail-outreach, Fortnox-koppling, AI-coach, kontrakt med e-signering och
marknadsplats. Se `docs/scope-arkitektur-v1.md` för ordningen.
