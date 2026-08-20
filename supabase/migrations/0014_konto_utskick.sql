-- Provperioden tog slut i tystnad.
--
-- Appen påminner i sista veckan, men bara för den som RÅKADE öppna appen just
-- då. Den som provade i två dagar, tyckte om det och sedan hade en full vecka
-- hörde aldrig något mer och försvann utan att någon visste om det. Samma sak
-- när ett kort slutar fungera: prenumerationen faller till förfallen och kunden
-- märker det först nästa gång hon loggar in, vilket kan dröja veckor.
--
-- Bokföringen över vad som skickats ligger här, så att ingen får samma mejl två
-- gånger. En påminnelse som upprepas blir en anledning att sluta läsa dem.
create table if not exists public.piches_konto_utskick (
  user_id    uuid not null references auth.users on delete cascade,
  -- 'prov_3_dagar'       tre dagar kvar av provperioden
  -- 'prov_sista_dagen'   sista dagen
  -- 'betalning_stoppade' kortet slutade fungera
  sort       text not null check (sort in ('prov_3_dagar','prov_sista_dagen','betalning_stoppade')),
  skickat_at timestamptz not null default now(),
  primary key (user_id, sort)
);

alter table public.piches_konto_utskick enable row level security;

drop policy if exists "piches kontoutskick las" on public.piches_konto_utskick;
create policy "piches kontoutskick las" on public.piches_konto_utskick
  for select using (auth.uid() = user_id);

-- Körningsloggen får egna kolumner för kontomejlen, så att "inga licenser att
-- påminna om" inte döljer "inga kontomejl gick iväg heller".
alter table public.piches_radar_korningar
  add column if not exists konto_hittade integer not null default 0,
  add column if not exists konto_skickade integer not null default 0;
