# UGC-AFFÄRSAPPEN — scope, arkitektur, v1
**1 aug 2026. Juridiska uppgifter verifierade mot Skatteverket, BFN och Fortnox (2026).**

---

## 0. VAD DU FAKTISKT BESKREV

Kontakt · leads · projekt · planering · fakturering · betalning · kvitton · statistik · multi-tenant · automatisk outreach · röststyrning.

Det är en **vertikal affärsplattform för frilansare**. Den finns redan: HoneyBook, Dubsado, Bonsai, Moxie internationellt. I Sverige gör Fortnox, Bokio och Spiris fakturerings- och bokföringsdelen.

Att bygga hela den listan är 12–24 månaders arbete för ett team. Du är en person, mitt i en filmningssprint, med hudterapeutprogrammet igång 10 aug.

**Men slutsatsen är inte "gör inte det". Den är: bygg bara de tre bitar som ingen annan gör.**

### Din wedge — de enda tre delarna som är dina
1. **Röst-först.** Ingen av konkurrenterna låter dig driva verksamheten under en promenad. Det här är den enda funktionen jag ser som faktiskt är differentierande.
2. **UGC-specifik pipeline.** Rättigheter, användningsperiod, revisionsrundor, spec-videos, whitelisting. HoneyBook vet inte vad annonsrättigheter är.
3. **Svensk + nischad.** Fortnox-koppling, moms, svenska varumärken som leadkälla.

Allt annat på din lista är hygien. Hygien ska integreras, inte byggas.

---

## 1. BYGG VS INTEGRERA

| Funktion | Beslut | Varför |
|---|---|---|
| Leads, kontakter, pipeline | **BYGG** | Kärnan. Ingen gör detta UGC-specifikt. |
| Projekt, brief, manus, leverans | **BYGG** | UGC-specifikt arbetsflöde. |
| Rättighetsspårning | **BYGG** | Finns inte någon annanstans. Här ligger dina pengar. |
| Röststyrning | **BYGG** | Din wedge. |
| Statistik | **BYGG** | Läser din egen data, trivialt. |
| Fakturering + betalning | **INTEGRERA (Stripe)** | Stripe Invoicing gör fakturan, betalningen och påminnelsen. |
| Bokföring + kvittoarkiv | **INTEGRERA (Fortnox/Bokio)** | Se avsnitt 2. Bygg aldrig detta. |
| Mejlutskick | **INTEGRERA (Gmail OAuth)** | Se avsnitt 3. |
| Inspelning/klippning | **INTEGRERA (Descript)** | Du har redan flödet. |
| Kalender | **INTEGRERA (Google Calendar)** | Löst problem. |

---

## 2. BYGG INTE FAKTURERING OCH KVITTOARKIV

Det här är den viktigaste tekniska begränsningen i hela dokumentet, och den är juridisk.

**Bokföringslagen kräver att räkenskapsinformation sparas i minst sju år** efter utgången av det kalenderår då räkenskapsåret avslutades. Kravet gäller inte bara fakturorna och kvittona — även *systemet som krävs för att presentera informationen* räknas in. Informationen ska vara lättåtkomlig under hela perioden, även om tjänsteleverantören byts ut.

Och avgörande: **ansvaret ligger alltid hos det bokföringsskyldiga företaget**, inte hos systemleverantören. Alltså hos varje användare.

Vad det betyder om du bygger det själv:

- Du binder dig att hålla appen levande i sju år för varje användare som lägger in ett kvitto. Stänger du ner har hundra frilansare ett lagproblem.
- Överföringen till digital form får inte innebära risk för att informationen förändras eller försvinner. Det är ett faktiskt tekniskt krav på din lagring, inte en formulering.
- Ligger lagringen utanför EU tillkommer ytterligare krav, och Skatteverket ska kunna få omedelbar elektronisk åtkomst.

> ⚠️ Jag har verifierat kraven ovan mot Skatteverket, BFN och Fortnox, men jag är inte jurist. Innan du släpper in externa användare på något som rör bokföring: stäm av med Andreea på AMVA. En timme där sparar dig från ett strukturellt fel.

**Rätt design:** appen skapar fakturan via Stripe och skickar kvitto-/fakturametadata vidare till Fortnox eller Bokio. Din app äger *affärslogiken*. Bokföringssystemet äger *arkivet och ansvaret*. Du sparar bara en länk och ett referensnummer.

Det gör också säljet enklare — "kopplar mot din befintliga bokföring" är ett bättre argument än "byt bokföringsprogram till mig".

---

## 3. AUTOMATISK KONTAKT — den version som inte bränner allt

Du vill ha "automatiskt kontakt med leads". Fullt automatiserat kallmejl är fel bygge av två skäl:

**Domänbränning.** Skickar appen mejl från din egen infrastruktur åt hundra kreatörer hamnar allt i skräpposten inom en månad. Ett enda klagomål drabbar alla användare.

**Regelverket.** B2B-mejl till företag har andra regler än till privatpersoner, men det finns fortfarande krav på identifiering, avregistrering och laglig grund. Verifiera med Andreea eller IMY innan du bygger utskick åt andra.

### Rätt arkitektur
Varje användare kopplar **sin egen Gmail via OAuth**. Appen skickar från deras adress, deras domän, deras rykte. Ingen delad infrastruktur. Detta är inte en kompromiss — det är också det enda som ger bra leveransbarhet.

### "Automatiskt" betyder: AI skriver, du godkänner
```
Appen bevakar → hittar signal (ny produktlansering, ny annons)
   → Claude skriver pitchen med din kontext
   → notis: "Pitch till Verso klar. Godkänn?"
   → du säger "godkänn" på promenaden
   → skickas från din Gmail
   → uppföljning 1 och 2 schemaläggs automatiskt
```

Ett tryck, eller ett ord. Det är den automation du faktiskt vill ha. Full autopilot ger generiska mejl som inte konverterar — hela poängen med din pitch är den specifika observationen.

---

## 4. RÖSTSTYRNING — arkitektur

Detta är din wedge. Bygg det ordentligt.

### Flöde
```
PWA, mikrofonknapp (eller lurarnas knapp)
  → MediaRecorder spelar in
  → kö i IndexedDB (funkar utan täckning på promenaden)
  → Supabase Edge Function
  → Whisper, svensk transkribering
  → Claude Haiku → strukturerad JSON-intent
  → skrivning mot databasen
  → uppläst bekräftelse via SpeechSynthesis (gratis, inbyggt)
```

### Intents v1 (håll listan kort)
| Du säger | Appen gör |
|---|---|
| "Lägg till Verso Skincare som lead, nivå ett" | `brands` insert |
| "Jag pitchade Estelle och Thild idag" | `pitches` status → pitchad, bokar uppföljningar |
| "Maria Åkerberg svarade, vill ha offert" | status → svarat, skapar offertuppgift |
| "Skicka faktura till Lyko, fjortontusenfemhundra" | Stripe-fakturautkast |
| "Vad har jag i pipeline?" | uppläst sammanfattning |
| "Påminn mig att följa upp Verso på torsdag" | uppgift + notis |

### Varför denna stack
- **PWA, inte native.** Installeras från webben, ingen App Store-granskning, du deployar som vanligt på Hostinger. Räcker till allt utom bakgrundsinspelning.
- **Kö i IndexedDB** är inte valfritt. Halva poängen är att det ska funka utan täckning.
- **Haiku för intent-parsning**, inte Opus. Det är klassificering, inte resonemang. Kostnaden per röstkommando ska ligga i ören.
- **Bekräftelse uppläst.** Du ser inte skärmen när du går. Skriver appen fel och du inte hör det, förlorar du förtroendet för hela funktionen direkt.

---

## 5. V1 — tre veckor, du som enda användare

Multi-tenant-schemat från förra dokumentet gäller. Bygg för dig, designa för tusen.

**Vecka 1 — stomme**
Schema + RLS · auth · leads och pipeline · manuell inmatning · lista och detaljvy

**Vecka 2 — röst**
PWA-skal · röstinspelning + kö · transkribering · intent-parsning · uppläst bekräftelse · de sex intents ovan

**Vecka 3 — pengar**
Paket och offerter · Stripe-fakturor · statuslogik · statistikvy: pitchar ut, svarsfrekvens, snittordervärde, intäkt per månad

**Utanför v1, med flit:** projektplanering, filhantering, Fortnox-koppling, kundportal, andra användare, automatisk outreach.

Det svåraste är inte att bygga mycket. Det är att inte bygga det du inte behöver ännu.

---

## 6. EFTER V1

| Version | Innehåll | Trigger |
|---|---|---|
| v1.1 | Gmail OAuth, pitchmallar, uppföljningsautomatik | Du skickar 10 pitchar/vecka manuellt |
| v1.2 | Projektvy, brief, manus, leveransgodkännande | 3+ samtidiga uppdrag |
| v1.3 | Fortnox/Bokio-koppling | Andreea klagar på underlagen |
| v2.0 | Andra användare, abonnemang | Någon frågar om de får använda den |

Notera sista raden. **Ingen extern användare förrän någon ber om det.** Det var precis det steget Studio L.A hoppade över.

---

## 7. UTMANINGEN

Du har byggt Studio L.A, Contista, Planexr, Learnnd, Daylilife, PosterMama. Det här blir app nummer sju. Studio L.A har fortfarande noll externa betalande användare — flaskhalsen var trafik, inte teknik.

Det här bygget är motiverat **bara om det gör att du säljer mer UGC**. Det är inte motiverat som produkt än, eftersom du inte har en enda UGC-kund.

**Testet:** om du inte har skickat 20 pitchar innan du börjar koda, bygger du appen för att slippa sälja. Kod är roligare än att bli ignorerad av marknadschefer. Det är den fällan jag ser här.

**Ordningen som fungerar:**
1. Filma spec-videos under kursfilmningen 1–10 aug
2. Skicka 20 pitchar manuellt, i ett kalkylblad
3. Landa 2 kunder
4. **Då** bygg v1 — nu vet du exakt vilka fält som behövs, för du har känt saknaden

Ett kalkylblad räcker till 20 pitchar. Det räcker inte till 200. Bygg när det gör ont, inte innan.

Vill du bygga ändå nu: gör vecka 2, röstdelen, först. Den är din faktiska innovation och den kan du använda även utan resten.
