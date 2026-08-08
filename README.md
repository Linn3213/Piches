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

Logiken ligger i `src/lib/rights.ts`, `src/lib/pricing.ts`,
`src/lib/economy.ts` och `src/lib/renewal.ts` som rena funktioner, täckta av 63
tester (`npx vitest run`).

Utöver rättigheterna räknar `economy.ts` det som annars aldrig blir uträknat:
vad varje affär gav per nedlagd timme, vad som är fakturerat men obetalt, hur
länge kunderna faktiskt dröjer, och hur stor del av omsättningen som hänger på
en enda kund.

## Backend: det DELADE Supabase-projektet

Piches ligger i samma Supabase-projekt som Studio L.A, DayliLife, Planexr,
Contista, Essensia, Learnnd, Clostie och Optionsmorgon — precis som alla
andra appar. **Inget eget projekt.**

| | |
|---|---|
| Projekt-ref | `mhswnvzpqekdcdjxxrmm` |
| URL | `https://mhswnvzpqekdcdjxxrmm.supabase.co` |
| Tabeller | `piches_brands`, `piches_pitches`, `piches_activities`, `piches_tasks`, `piches_deliverables`, `piches_licenses`, `piches_settings` |

Läs skill `supabase-delad-infra` innan du rör något i backend. Kortversionen
av reglerna, som den här appen följer:

- **Alla tabeller prefixas `piches_*`.** Ingen delad affärsdata mellan produkter.
- **Ingen egen `profiles`-tabell och ingen trigger på `auth.users`.** De är
  globala. En egen trigger där slår mot inloggningen i *alla* appar i projektet.
- Även hjälpfunktionen heter `piches_touch_updated_at`, så att den inte skriver
  över en funktion en annan produkt äger.
- RLS `auth.uid() = user_id` på varenda tabell.

Auth-mejl går via projektets befintliga Hostinger-SMTP och den delade
`auth-email-hook`. Hooken måste ha en egen Piches-gren; annars faller utskicket
tillbaka till Studio L.A:s mall. Piches tar emot både den primära
inloggningslänken och en sexsiffrig reservkod.
Se `docs/auth-mejl-piches.md` för den lokala källan och dashboardkontrollen.

## Kom igång lokalt

```
npm install
cp .env.example .env.local   # fyll i värdena för det delade projektet
npm run dev
```

Migrationen i `supabase/migrations/` är redan applicerad mot det delade
projektet. Kör den bara om du sätter upp en helt ny miljö.

## Datamodell

- **piches_brands** — kunder och leads. `tier` (1 till 3) plus en status som
  speglar den affär som kommit längst, så att en återkommande kund aldrig
  hoppar tillbaka till att se ut som ett kallt lead.
- **piches_pitches** — **affären**, inte bara utskicket. Den föds som ett utkast
  och lever hela vägen: utkast → skickad → svarat → offert → vunnen →
  produktion → levererat → fakturerat → betalt. Här ligger även fakturanummer,
  förfallodag, inköpta kostnader, nedlagd tid, revisionsrundor och kopplingen
  bakåt till licensen en förnyelse föddes ur.
- **piches_activities** — logg över statusbyten och pitchar.
- **piches_tasks** — fristående uppgifter, kopplade eller ej till ett varumärke.
- **piches_deliverables** — varje enskild sak som produceras, med hook och manus.
- **piches_licenses** — rättigheterna med klocka: kanaler, marknad, start och
  slut, evig eller ej, branschexklusivitet, råmaterial och licensavgift.
- **piches_settings** — din prislista, bevakningsfönstret och förnyelsepåslaget.

Datumen för vunnet, fakturerat och betalt stämplas av en databastrigger vid
statusbyte. Statusen ändras från flera ställen i appen, och läggs stämplingen i
gränssnittet hamnar den förr eller senare fel på ett av dem. Då ljuger både
utgångsradarn och intäktsstatistiken.

## Affärsloopen

Poängen med hela modellen är att loopen sluter sig:

```
pitch → vunnen → leverabler → levererat → licensen börjar ticka
                                              ↓
   ny affär ← förnyelseförslag ← utgångsradarn ← fakturerat → betalt
```

Leveransen är det som startar klockan. När klockan närmar sig noll blir
licensen ett färdigt affärsförslag med pris och text, och det förslaget blir en
ny affär som pekar tillbaka på licensen den kom ur. Det är den delen ingen
konkurrent har, eftersom de alla betraktar affären som klar när fakturan är
betald.

## Sidor

- **Idag** — prioriterad dagslista ur riktig data, sorterad efter hur dyrt det
  är att missa saken: sena fakturor först, sedan licenser på väg ut, sedan
  levererat material som saknar registrerade rättigheter.
- **Uppdrag** — kanban över affärer, inte över varumärken, så att en förnyelse
  och ett nytt uppdrag mot samma kund kan ligga på brädet samtidigt. Avslutade
  affärer lämnar brädet men går att fälla ut.
- **Uppdrag / detalj** — arbetsytan: leverabler, rättigheter, faktura, kostnader
  och tid, med vinst och timpenning uträknade.
- **Rättigheter** — förnyelsekön, utgångsradar, exklusivitetsvakt och lager
  fritt att sälja igen.
- **Pris** — förklarande prisräknare byggd på rättighetsmodellen.
- **Intäkter** — pengaflödet (vunnet, utestående, förfallet, inbetalt), sena
  betalningar, koncentrationsrisk, lönsamhet per kund och rättighetsintäkter.
- **Varumärken / detalj** — lista, sök, filter, pitchregistrering, historik.
- **Uppgifter** — fristående att-göra-lista.
- **Inställningar** — prislista, bevakningsfönster och förnyelsepåslag.

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

Fakturan skapas alltså fortfarande i bokföringsprogrammet. Appen sparar bara
numret och datumen, eftersom bokföringslagens sjuårskrav och ansvaret för
arkivet ligger hos den bokföringsskyldiga och inte hos en plattform. Det är ett
medvetet vägval, inte en lucka.
