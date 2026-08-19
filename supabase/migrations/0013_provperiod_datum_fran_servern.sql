-- Provperioden gick inte att starta mellan midnatt och klockan två på natten.
--
-- Klienten räknade ut slutdatumet med webbläsarens LOKALA klocka och skickade
-- det med i raden. RLS jämförde mot serverns current_date, som är UTC. Mellan
-- 00:00 och 02:00 svensk sommartid hade webbläsaren redan bytt dygn medan
-- servern låg kvar på gårdagen, så datumet blev en dag för långt fram och hela
-- registreringen svarade 403 utan att någon förstod varför.
--
-- Två timmar varje natt då ingen ny kund kunde komma in, och det syns inte i
-- någon logg eftersom både bygget och testerna är gröna dygnet runt.
--
-- Rätt lösning är inte att göra regeln slappare utan att ta bort frågan: nu
-- sätter SERVERN datumet, och klienten skickar det inte längre. Då finns det
-- inga två klockor att vara oense om.
alter table public.piches_subscriptions
  alter column trial_ends_on set default (current_date + 14);
