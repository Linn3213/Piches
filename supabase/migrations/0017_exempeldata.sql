-- En ny användare mötte en helt tom app.
--
-- Provperioden startade, hon kom in, och såg noll uppdrag, noll licenser, noll
-- av allting. För att se vad produkten överhuvudtaget gör måste hon först
-- knappa in ett varumärke, ett uppdrag, en leverans OCH en licens, alltså en
-- kvart av inmatning innan något syns. Ingen gör det på ett verktyg hon ännu
-- inte vet om hon vill ha, och därför tog provperioderna slut utan att någon
-- förstått vad hon provade.
--
-- Lösningen är exempeldata som hon själv slår på och själv tar bort. Den får
-- ALDRIG smyga in: raderna märks här, de är märkta i gränssnittet varje gång
-- de syns, och de går bort med ett klick. Det är skillnaden mot att skriva
-- påhittade siffror i någons riktiga konto, vilket aldrig är okej.
alter table public.piches_brands       add column if not exists is_example boolean not null default false;
alter table public.piches_pitches      add column if not exists is_example boolean not null default false;
alter table public.piches_deliverables add column if not exists is_example boolean not null default false;
alter table public.piches_licenses     add column if not exists is_example boolean not null default false;
alter table public.piches_tasks        add column if not exists is_example boolean not null default false;

-- Att hitta och ta bort exemplen ska vara snabbt även när kontot vuxit.
create index if not exists piches_brands_example_idx  on public.piches_brands (user_id) where is_example;
create index if not exists piches_pitches_example_idx on public.piches_pitches (user_id) where is_example;
