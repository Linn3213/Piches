-- Löftet som bara hålls om hon öppnar appen.
--
-- Hela produktens kärna är att ingen förlängning ska hinna rinna ut obemärkt,
-- men utgångsradarn har bara funnits INNE i appen. Den som glömde att logga in
-- missade därmed precis det hon betalade för att slippa missa, och då är det
-- inte kunden som gjort fel utan vi som byggt ett löfte vi inte kan hålla.
--
-- Här ligger bokföringen över vad som faktiskt skickats, så att ingen får samma
-- påminnelse två gånger, och en logg över varje körning så att ett utskick som
-- slutar fungera går att se utan att någon råkar titta.

create table if not exists public.piches_radar_utskick (
  user_id    uuid not null references auth.users on delete cascade,
  license_id uuid not null references public.piches_licenses on delete cascade,
  -- 'lead' = första varningen vid inställd framförhållning.
  -- 'sista_veckan' = sista knuffen innan licensen faktiskt tar slut.
  sort       text not null check (sort in ('lead','sista_veckan')),
  skickat_at timestamptz not null default now(),
  primary key (user_id, license_id, sort)
);

alter table public.piches_radar_utskick enable row level security;

drop policy if exists "piches radarutskick las" on public.piches_radar_utskick;
create policy "piches radarutskick las" on public.piches_radar_utskick
  for select using (auth.uid() = user_id);

-- Körningsloggen. Ett schemalagt jobb som slutar fungera gör det TYST, och då
-- är felet osynligt tills någon råkar titta. Den här raden är det enda stället
-- där "utskicket kördes aldrig" går att skilja från "det fanns inget att
-- skicka".
create table if not exists public.piches_radar_korningar (
  id          bigint generated always as identity primary key,
  kord_at     timestamptz not null default now(),
  hittade     integer not null default 0,
  skickade    integer not null default 0,
  misslyckade integer not null default 0,
  fel         text
);

alter table public.piches_radar_korningar enable row level security;
-- Ingen policy alls: bara service-role kommer åt loggen.

-- På som standard. En creator som köpt en app för att slippa missa förlängningar
-- har inte bett om tystnad, men hon ska kunna välja den.
alter table public.piches_settings
  add column if not exists email_radar boolean not null default true;

-- Cron-jobbet ligger i 0011_radar_mail_cron.sql.
