# Piches auth-mejl i det delade Supabase-projektet

Piches använder `signInWithOtp`. Mejlet ska i första hand innehålla en klickbar
verifieringslänk och dessutom en sexsiffrig reservkod som kan anges i appen.

## Lokal källkod

Den senaste säkra versionen av den globala hooken ligger i Studio L.A-repots
funktionsmapp:

`C:\Users\linn_\OneDrive\Claude\studiola\supabase\functions\auth-email-hook\`

Den versionen verifierar Supabases Standard Webhooks-signatur, skickar MIME-delar
som base64 och har separata grenar för de andra apparna. Deploya inte den äldre
kopian under `tva-spar-versioner/.../supabase-shared/`; den saknar dessa
säkerhets- och leveransfixar.

Piches-grenen är additiv och väljs när `redirect_to` eller `site_url` innehåller
`piches`. `index.ts` importerar den testade kontraktsmodulen `piches-email.ts`;
båda filerna måste därför följa med vid deploy. Modulen bygger
verifieringslänken från hook-payloadens `token_hash`, `email_action_type` och
`redirect_to`, visar samtidigt hook-payloadens kod och avvisar relativa eller
främmande redirect-adresser. Om `token_hash` saknas stoppas utskicket eftersom
länken är huvudvägen.

## Det som måste göras i Supabase Dashboard

Projekt: det delade projektet som Piches redan använder.

1. Öppna **Edge Functions → auth-email-hook** och deploya hela den uppdaterade
   funktionsmappen från Studio L.A-repot. Minst `index.ts` och
   `piches-email.ts` måste finnas i samma deploy; deploya inte en fristående
   kopia av bara `index.ts`.
2. Kontrollera att function-secreten `SEND_EMAIL_HOOK_SECRET` finns. Värdet ska
   vara hemligheten från **Authentication → Hooks → Send Email**. Kopiera inte
   värdet till repot eller denna fil.
3. Om Piches har en egen, av Hostinger godkänd avsändaradress eller alias, lägg
   den som function-secret `PICHES_SENDER_EMAIL`. Värdet kan vara en bar
   mejladress eller `Piches <mejladress>`. Om secreten saknas används den
   befintliga SMTP-adressen med visningsnamnet **Piches**; lägg aldrig in en
   påhittad eller obehörig avsändaradress eftersom SMTP-servern då kan avvisa
   utskicket.
4. Kontrollera under **Authentication → Hooks** att **Send Email** pekar på
   HTTP-funktionen `auth-email-hook`.
5. Behåll alla befintliga redirect-rader. Bekräfta att dessa finns för de byggen
   som faktiskt ska användas:
   - `https://piches.essensiadesign.se/**`
   - `https://essensiadesign.se/piches/**`
   - `https://linnartistry.se/piches/**`
6. Skicka en ny inloggningslänk från Piches och verifiera ett riktigt mottaget
   mejl: Piches som avsändare/varumärke, ämnesrad med "inloggningslänk", knappen
   **Öppna Piches**, en sexsiffrig reservkod och återkomst till samma
   Piches-adress som startade flödet.

En lyckad funktionslogg eller HTTP 200 bevisar inte att mejlet kom fram. Flödet
är klart först när ett skarpt mejl har mottagits och länken har skapat en session.
