-- Piches i det DELADE Supabase-projektet (Studio LA: mhswnvzpqekdcdjxxrmm).
-- Applicerad 2026-08-04. Se skill `supabase-delad-infra` innan du rör något här.
--
-- Praxis som gäller i det delade projektet:
--   * alla tabeller prefixas piches_* (som learnnd_*, studiola_*, planexr_*)
--   * INGEN egen profiles-tabell och INGEN trigger på auth.users — de är
--     globala och delas av Studio L.A, DayliLife, Planexr, Contista,
--     Essensia, Learnnd, Clostie och Optionsmorgon. En egen trigger där
--     hade slagit mot inloggningen i samtliga.
--   * även hjälpfunktionen prefixas, så att den inte skriver över en
--     funktion som en annan produkt redan äger.
--   * RLS auth.uid() = user_id på allt.

create extension if not exists pgcrypto;

create table public.piches_brands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  website     text,
  instagram   text,
  contact_name  text,
  contact_email text,
  -- Niva 1 = drommkund, 3 = langskott.
  tier        smallint not null default 2 check (tier between 1 and 3),
  status      text not null default 'ny'
                check (status in ('ny','researchad','pitchad','svarat','offert','vunnen','forlorad','vilande')),
  source      text,
  -- Den specifika observationen som pitchen ska bygga pa.
  observation text,
  notes       text,
  next_action_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index piches_brands_user_status_idx on public.piches_brands (user_id, status);
create index piches_brands_next_action_idx on public.piches_brands (user_id, next_action_at)
  where next_action_at is not null;

create table public.piches_pitches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  brand_id    uuid not null references public.piches_brands on delete cascade,
  status      text not null default 'utkast'
                check (status in ('utkast','skickad','svarat','offert','vunnen','forlorad','ingen_respons')),
  channel     text not null default 'mejl'
                check (channel in ('mejl','instagram','linkedin','annat')),
  subject     text,
  body        text,
  observation text,
  value_sek   numeric(12,2),
  sent_at     timestamptz,
  replied_at  timestamptz,
  follow_up_1_at timestamptz,
  follow_up_2_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index piches_pitches_user_status_idx on public.piches_pitches (user_id, status);
create index piches_pitches_brand_idx on public.piches_pitches (brand_id, created_at desc);

-- Handelselogg. Statistikvyn laser den har tabellen.
create table public.piches_activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  brand_id    uuid references public.piches_brands on delete cascade,
  pitch_id    uuid references public.piches_pitches on delete cascade,
  kind        text not null default 'note'
                check (kind in ('note','status','pitch','svar','system')),
  body        text,
  occurred_at timestamptz not null default now()
);

create index piches_activities_user_time_idx on public.piches_activities (user_id, occurred_at desc);
create index piches_activities_brand_idx on public.piches_activities (brand_id, occurred_at desc);

create table public.piches_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  brand_id    uuid references public.piches_brands on delete set null,
  title       text not null,
  due_at      timestamptz,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index piches_tasks_user_due_idx on public.piches_tasks (user_id, due_at) where done_at is null;

-- Prefixad hjalpfunktion, sa att inget annat projekt paverkas.
create or replace function public.piches_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger piches_brands_touch_updated_at
  before update on public.piches_brands
  for each row execute function public.piches_touch_updated_at();

create trigger piches_pitches_touch_updated_at
  before update on public.piches_pitches
  for each row execute function public.piches_touch_updated_at();

-- RLS
alter table public.piches_brands     enable row level security;
alter table public.piches_pitches    enable row level security;
alter table public.piches_activities enable row level security;
alter table public.piches_tasks      enable row level security;

create policy "piches varumarken las"    on public.piches_brands for select using (auth.uid() = user_id);
create policy "piches varumarken skapa"  on public.piches_brands for insert with check (auth.uid() = user_id);
create policy "piches varumarken andra"  on public.piches_brands for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "piches varumarken radera" on public.piches_brands for delete using (auth.uid() = user_id);

create policy "piches pitchar las"    on public.piches_pitches for select using (auth.uid() = user_id);
create policy "piches pitchar skapa"  on public.piches_pitches for insert with check (auth.uid() = user_id);
create policy "piches pitchar andra"  on public.piches_pitches for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "piches pitchar radera" on public.piches_pitches for delete using (auth.uid() = user_id);

create policy "piches handelser las"    on public.piches_activities for select using (auth.uid() = user_id);
create policy "piches handelser skapa"  on public.piches_activities for insert with check (auth.uid() = user_id);
create policy "piches handelser radera" on public.piches_activities for delete using (auth.uid() = user_id);

create policy "piches uppgifter las"    on public.piches_tasks for select using (auth.uid() = user_id);
create policy "piches uppgifter skapa"  on public.piches_tasks for insert with check (auth.uid() = user_id);
create policy "piches uppgifter andra"  on public.piches_tasks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "piches uppgifter radera" on public.piches_tasks for delete using (auth.uid() = user_id);
