-- Piches v1, vecka 1: stomme
-- Multi-tenant fran dag ett. Varje rad agas av en anvandare, RLS slapper bara igenom agaren.
-- Kolumnvarden halls ASCII-rena (svarat, forlorad) for att slippa encoding-strul.
-- Svenska etiketter bor i UI:t, inte i databasen.

create extension if not exists pgcrypto;

-- Profiler -------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

-- Varumarken (leads) ---------------------------------------------------------

create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  website     text,
  instagram   text,
  contact_name  text,
  contact_email text,
  -- Niva 1 = drommkund, 3 = langskott. Rostkommandot "niva ett" mappar hit.
  tier        smallint not null default 2 check (tier between 1 and 3),
  status      text not null default 'ny'
                check (status in ('ny','researchad','pitchad','svarat','offert','vunnen','forlorad','vilande')),
  source      text,
  -- Den specifika observationen som pitchen ska bygga pa. Utan den blir mejlet generiskt.
  observation text,
  notes       text,
  next_action_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index brands_user_status_idx on public.brands (user_id, status);
create index brands_next_action_idx on public.brands (user_id, next_action_at) where next_action_at is not null;

-- Pitchar --------------------------------------------------------------------

create table public.pitches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  brand_id    uuid not null references public.brands on delete cascade,
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

create index pitches_user_status_idx on public.pitches (user_id, status);
create index pitches_brand_idx on public.pitches (brand_id, created_at desc);

-- Handelselogg ---------------------------------------------------------------
-- Statistiken i vecka 3 laser den har tabellen. Skriv hit vid varje statusbyte.

create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  brand_id    uuid references public.brands on delete cascade,
  pitch_id    uuid references public.pitches on delete cascade,
  kind        text not null default 'note'
                check (kind in ('note','status','pitch','svar','system')),
  body        text,
  occurred_at timestamptz not null default now()
);

create index activities_user_time_idx on public.activities (user_id, occurred_at desc);
create index activities_brand_idx on public.activities (brand_id, occurred_at desc);

-- Uppgifter ------------------------------------------------------------------

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  brand_id    uuid references public.brands on delete set null,
  title       text not null,
  due_at      timestamptz,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index tasks_user_due_idx on public.tasks (user_id, due_at) where done_at is null;

-- updated_at -----------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brands_touch_updated_at
  before update on public.brands
  for each row execute function public.touch_updated_at();

create trigger pitches_touch_updated_at
  before update on public.pitches
  for each row execute function public.touch_updated_at();

-- Profil skapas automatiskt vid registrering ---------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS ------------------------------------------------------------------------
-- Byggt for dig, designat for tusen: ingen fraga far korsa en anvandargrans.

alter table public.profiles   enable row level security;
alter table public.brands     enable row level security;
alter table public.pitches    enable row level security;
alter table public.activities enable row level security;
alter table public.tasks      enable row level security;

create policy "egen profil, las"    on public.profiles for select using (auth.uid() = id);
create policy "egen profil, uppdatera" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "egna varumarken, las"     on public.brands for select using (auth.uid() = user_id);
create policy "egna varumarken, skapa"   on public.brands for insert with check (auth.uid() = user_id);
create policy "egna varumarken, andra"   on public.brands for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "egna varumarken, radera"  on public.brands for delete using (auth.uid() = user_id);

create policy "egna pitchar, las"    on public.pitches for select using (auth.uid() = user_id);
create policy "egna pitchar, skapa"  on public.pitches for insert with check (auth.uid() = user_id);
create policy "egna pitchar, andra"  on public.pitches for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "egna pitchar, radera" on public.pitches for delete using (auth.uid() = user_id);

create policy "egna handelser, las"    on public.activities for select using (auth.uid() = user_id);
create policy "egna handelser, skapa"  on public.activities for insert with check (auth.uid() = user_id);
create policy "egna handelser, radera" on public.activities for delete using (auth.uid() = user_id);

create policy "egna uppgifter, las"    on public.tasks for select using (auth.uid() = user_id);
create policy "egna uppgifter, skapa"  on public.tasks for insert with check (auth.uid() = user_id);
create policy "egna uppgifter, andra"  on public.tasks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "egna uppgifter, radera" on public.tasks for delete using (auth.uid() = user_id);
