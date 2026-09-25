# Fortsätt Piches i ny chatt

Klistra in allt nedanför linjen.

---

Vi fortsätter på **Piches**, min UGC-app. Läs det här först, verifiera sedan själv innan du tror på något av det, för mycket har byggts av olika sessioner och verkligheten hinner gå isär från anteckningarna.

## Börja med

1. Kör `Skill(arbetsdisciplin)`. Det är mina hårda arbetsregler och de gäller före allt annat i den här texten.
2. Läs minnet `project_piches` och `reference_piches_deploy`.
3. Kolla `git log --oneline -10` i `C:\Users\linn_\OneDrive\Claude\Piches`. Flera sessioner och Cowork skriver i samma repo, och edge-funktioner har ändrats direkt i produktion utan att repot vetat om det. **Läs alltid den skarpa versionen av en edge-funktion med `get_edge_function` innan du deployar om den**, annars backar du tyst någon annans fix.

## Vad appen är

Piches håller reda på rättigheterna i UGC-uppdrag. Varje uppdrag är egentligen en licens med en klocka i: varumärket får använda materialet i tolv månader, i vissa kanaler, i ett visst land, ibland med exklusivitet. När klockan går ut måste de sluta använda det eller betala för en förlängning. Ingen håller reda på den klockan, den ligger i en gammal mejltråd, och det är hela produktens existensberättigande.

Live på **piches.essensiadesign.se**. Repo `Linn3213/Piches`. Deploy med `npm run deploy`, som bygger, förrenderar, laddar upp via Hostingers API och verifierar att rätt byggstämpel ligger live.

Backend: det **delade** Supabase-projektet `mhswnvzpqekdcdjxxrmm`, tabeller med prefix `piches_`. Samma projekt som Studio L.A, Planexr och Learnnd, så rör aldrig globala auth-inställningar utan att tänka på de andra.

## Vad som är byggt och bevisat

Hela affärskedjan går runt utan handpåläggning: landningssida, självbetjänad registrering, fjorton dagars provperiod utan kort, Stripe-kassa med 25 procent moms som egen rad, Stripes kundportal för kort och uppsägning, och status som hämtas från Stripe när den betalda perioden tagit slut.

Produkten själv: rättighetsmotor med utgångsradar och exklusivitetsvakt, prisräknare, fakturaunderlag med svensk moms, lönsamhetsmotor, brief-läsare, dataexport.

Dessutom: exempeldata som användaren själv slår på och tar bort, adminvy på `/konton` där jag ser alla som registrerat sig, samtyckesruta vid registrering, förrendering så att sidan syns för AI och sökmotorer, och en felkanal dit betalfunktionerna larmar.

## Vad jag vet är oklart eller ogjort

Verifiera de här innan du gör något åt dem, de kan ha ändrats sedan 8 september.

- **`MAILERLITE_API_KEY` var inte satt** som edge-hemlighet, så ingen registrering har någonsin hamnat på maillistan. Grupperna och fälten finns redan i MailerLite. Studio L.A:s `newsletter-signup` läser samma namn och **hoppar tyst över** när den saknas, så inte heller den har lagt någon på listan.
- **Gränssnittet ska göras om.** Jag tycker det är för tekniskt, stelt och ologiskt. Briefen ligger i `docs/designbrief.md`. Kärnan: tio destinationer för en enmansverksamhet är för många och flera överlappar, estetiken är instrumentpanel snarare än medhjälpare.
- **Ingen publik demo.** Den som står utanför kan inte klicka runt utan att skapa konto, vilket gör appen svår att länka i en story.
- **Ingen delningsbild** (og:image, 1200x630). Den ska göras i Canva, inte av dig.
- **Ingen välkomstsekvens.** Det finns tre transaktionsmejl och licensradarn, men inget onboardingflöde. Det bygger jag hellre i MailerLite än i kod.
- **Stripe-kontot heter LinnArtistry**, så en Piches-kund ser det namnet i kassan.
- Oprövade flöden: brief-importeraren, prisräknaren från början till slut, uppgiftssidan, varumärkessidan, att skapa en förnyelse, och radera-flödena.

## Fällor som redan kostat tid här

- **Kassan stängdes i två och en halv timme** när sandlådeströmbrytaren stod på utan att testnyckeln fanns. Regeln nu: saknas testnyckeln kör apparna vidare skarpt och säger till, i stället för att stoppa köpet. Bryt aldrig ett sälj för att skydda mig från ett testköp.
- **Klientklockan mot RLS.** Datum som räknas ut i webbläsaren och kontrolleras mot serverns `current_date` går sönder mellan midnatt och klockan två. Det gjorde att ingen kunde starta en provperiod två timmar varje natt, helt osynligt.
- **SECURITY DEFINER-vyer.** Två sådana lät vem som helst på internet läsa och skriva hela varumärkeskatalogen. Använd en funktion som kontrollerar vem som frågar, aldrig en vy.
- **Förrendera bara roten.** En mapp per sida ger omdirigering till adress med avslutande snedstreck och har redan tyst tagit ner en inloggning i ett annat projekt.
- **Playwright är låst till 1.60.0** med flit, för att återanvända den webbläsare som redan finns. C: har legat på 98 procent. Uppgradera inte utan att kolla diskutrymmet först.
- **SMTP-hemligheterna heter `HOSTINGER_SMTP_USER` och `HOSTINGER_SMTP_PASSWORD`** i det här projektet, inte `SMTP_USERNAME`.

## Hur jag vill att du jobbar

Fixa, rapportera inte bara. Om du hittar något trasigt så laga det, jag behöver inte tillfrågas först. Invänd aldrig att jag borde skaffa kunder innan jag bygger klart, det är avvisat.

Testa skarpt i produktion med ett riktigt konto och städa bort testdatan efteråt. Ett grönt bygge och gröna tester bevisar ingenting om användaren. Säg rakt ut vad som är bevisat och vad som inte är det, ett ärligt hål är alltid billigare än ett falskt "klart".

Commita och pusha löpande, med commit-meddelanden som förklarar varför och inte bara vad.

Svensk copy, inga tankstreck, inga tvillingmeningar, klarspråk utan jargong.

## Vad jag vill att du gör nu

Säg till mig vad du tycker är rätt att ta först av det som är ogjort, med en mening om varför. Sedan kör du det.
