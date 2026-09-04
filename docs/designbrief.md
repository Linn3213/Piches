# Designbrief för Claude Design: gör om Piches gränssnitt

Klistra in allt nedanför linjen.

---

Du ska göra om gränssnittet för en befintlig, fungerande svensk webbapp som heter **Piches**. Koden fungerar och all logik finns. Det som inte fungerar är hur den ser ut och hur den hänger ihop. Ägaren beskriver den som **för teknisk, för stel och ologisk**, och hon har rätt.

## Vad produkten gör

Piches håller reda på **rättigheterna** i uppdrag där en kreatör gör innehåll åt ett varumärke. Kärnan är att varje uppdrag egentligen är en licens med en klocka i: varumärket får använda materialet i tolv månader, i vissa kanaler, i ett visst land, och ibland med löfte om att kreatören inte jobbar med en konkurrent under tiden. När klockan går ut måste varumärket sluta använda materialet, eller betala för en förlängning.

Ingen håller reda på den klockan idag. Den finns i en gammal mejltråd. Appen finns för att kreatören ska få veta i god tid, och kunna skicka en förlängning i stället för att upptäcka i efterhand att en annons rullat gratis i ett halvår.

## Vem som använder den, och i vilket läge

En svensk kreatör som gör mellan tre och tio betalda varumärkessamarbeten i månaden. Hon driver enskild firma eller ett litet aktiebolag. Hon är **inte** ekonom, inte projektledare och inte van vid affärssystem. Hon är kreativ och tycker att administration är det tråkigaste hon vet.

Hon öppnar appen i två lägen:

1. **Två minuter på morgonen, på mobilen**, ofta i en soffa eller i en bil. Hon vill veta en enda sak: vad behöver jag göra idag.
2. **En halvtimme i månaden, på datorn.** Då fakturerar hon, skickar förlängningar och tittar på vad hon egentligen tjänade.

Det andra läget är sällsynt. Det första är varje dag. Designen ska optimeras för det första.

## Vad som är fel idag

**Det ser ut som en instrumentpanel för en analytiker.** Versaler i alla etiketter, sifferrader i monospace, täta statistikkort med fyra nyckeltal i rad, gråa boxar. Det signalerar kontrollrum, inte medhjälpare. Hon får en känsla av att hon ska analysera något, när det hon vill är att bli itutad vad som ska göras.

**Navigationen har tio destinationer** för en person som driver en enmansverksamhet: Idag, Uppdrag, Rättigheter, Pris, Intäkter, Lönsamhet, Varumärken, Uppgifter, Inställningar, Konto. Flera överlappar. Rättigheter är egentligen en vy av data som redan finns inuti uppdragen. Intäkter och Lönsamhet svarar på nästan samma fråga. Uppgifter dyker redan upp på Idag. **Jag tror att den riktiga informationsarkitekturen är tre eller fyra ställen, inte tio, men jag vill att du föreslår den, inte att du tar min gissning för given.**

**Språket lutar åt jargong.** Ord som utgångsradar, rättighetsmotor och leverabler är begripliga för den som byggt appen men inte för den som ska använda den.

**Tomma lägen bär hela produkten.** En ny användare har ingenting inne, och då är varje sida en tom ruta. Det finns nu en funktion som fyller appen med exempeldata, men de tomma lägena behöver ändå bära mening i sig.

## Uppdraget

Gör om gränssnittet så att det känns som **en lugn, kompetent medhjälpare som säger en sak i taget**, inte som ett system som redovisar tillstånd. Det ska kännas varmt, tydligt och lätt, utan att bli barnsligt eller pastellsött. Hon jobbar med skönhet och design och har hög smak, så det får gärna vara vackert.

Leverera i den här ordningen:

1. **Ny informationsarkitektur.** Vilka ställen ska finnas, vad heter de, vad bor var, och varför. Motivera varje sammanslagning och varje sak du behåller separat. Säg också vad du tar bort.
2. **Tre skärmar helt färdiga**, i både mobil (390 px) och desktop: startsidan, vyn där licenserna och deras förnyelser bor, och ett enskilt uppdrag från förfrågan till betald faktura.
3. **En komponentinventering:** knappar, kort, listrader, statusmarkeringar, formulärfält, tomma lägen, laddningslägen. Med regler för när varje sak används.
4. **Copy för allt du designar**, på svenska. Skriv den riktiga texten, inte platshållare.

## Skärmarna som finns idag, och vad de måste klara

**Idag.** En lista över vad som behöver göras, sorterad efter vad som kostar mest att skjuta upp: licenser som snart går ut, uppdrag där kunden svarat och väntar, obetalda fakturor som förfallit, egna påminnelser. Plus fyra siffror: väntar på betalning, uppdrag ute, går ut snart, fritt att sälja igen.

**Licenserna.** Den viktigaste vyn, och produktens hela existensberättigande. Varje licens har ett slutdatum, vilka kanaler och vilket land den gäller, om det finns ett exklusivitetslöfte, och vad den betalade. De som snart går ut visas med ett färdigt förlängningspris och ett färdigskrivet meddelande att skicka till kunden. De som redan gått ut ligger kvar, för de är fortfarande värda pengar. Här finns också en kontroll: skriv in en bransch och få veta om du är bunden till en konkurrent innan du tackar ja.

**Uppdragen.** En affär rör sig genom lägena utkast, skickad, svarat, offert ute, vunnen, produktion, levererat, fakturerat, betalt. Idag visas det som en tavla med en kolumn per läge, vilket är nio kolumner och känns som ett projektverktyg.

**Ett enskilt uppdrag.** Innehåller tre delar: vad som ska levereras, vilka rättigheter som säljs, och pengarna (ordervärde, faktura, kostnader, nedlagda timmar, antal ändringsrundor, och vad som blir kvar). Härifrån tas ett fakturaunderlag fram med svensk moms.

**Prisräknaren.** Hon väljer vad hon ska leverera och vilka rättigheter kunden köper, och får ett prisförslag med en rad per påslag, så hon ser att priset är rättigheterna och inte bara filmandet.

**Lönsamheten.** Vad hon faktiskt får per timme, var pengarna läcker med kronbelopp per läcka, och hur många uppdrag som är kvar till månadens mål.

**Varumärkena, uppgifterna, inställningarna, kontot.** Stödytor.

## Hårda ramar

- **Bygget är React med Tailwind.** Leverera det du kan som HTML eller React med Tailwind-klasser, inte som bildfiler.
- **Måste fungera från 320 pixlars bredd.** Mobilen är huvudfallet. Ingenting får ligga i sidled utanför skärmen och ingen etikett får kapas.
- **Färgerna byts ut av tre olika varumärken.** Appen säljs både i egen skepnad och som pålagt skin hos två andra företag, där hela paletten byts via CSS-variabler. Designa därför i semantiska roller (primär, yta, kant, text, fara) och aldrig i hårdkodade hexkoder. Om en design bara ser bra ut i just den här paletten är den fel byggd.
- **Egen palett idag:** primär `#3f694e`, primär behållare `#c0efd0`, bakgrund `#fbf9f6`, text `#191c1a`, sekundär text `#404943`, kanter `#bfc9c0`, plus accenterna salvia `#8fa08a`, terrakotta `#d68a73`, sand `#d8c29d`, skog `#4a6b47`. Rubrikfont Syne, siffror JetBrains Mono. Du får föreslå ändringar, men motivera dem.
- **All text måste klara WCAG AA i både ljust och mörkt läge**, alltså 4,5 till 1 för brödtext. Ange kontrastkvoten för varje färgpar du hittar på.
- **Inga blinkande, pulserande eller glödande effekter någonstans.** Det är ett permanent förbud, inte en smaksak.
- **Datamodellen ändras inte.** Du får flytta, slå ihop och byta namn på ytor, men fälten är låsta.

## Språkregler för all copy du skriver

- Svenska, korta och vardagliga ord. Ingen jargong och inga engelska låneord där ett svenskt finns.
- **Inga tankstreck.** Skriv om med kommatecken eller punkt.
- **Inga tvillingmeningar** av typen "Inte X. Utan Y." Skriv hellre en längre sammanhängande mening.
- Förklara aldrig samma sak två gånger på samma skärm.
- Emojis bara om de betyder något på riktigt, annars inga alls.
- Fiktiva namn i exempel ska vara påhittade och internationellt blandade.
- Datum som binder någon till något skrivs alltid ut med årtal.

## Så vill jag ha svaret

Börja med informationsarkitekturen och **vänta på ett godkännande innan du designar skärmarna**, eftersom allt annat hänger på den. Motivera varje val med hur det påverkar de två minuterna på morgonen, inte med vad som är snyggt.

Om något i briefen är otydligt eller om du tycker att en av mina slutsatser är fel, säg det innan du börjar.
