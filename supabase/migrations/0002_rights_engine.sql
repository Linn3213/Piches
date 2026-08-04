-- Piches rättighetsmotor. Det som skiljer appen från Deelo/Beacons/MySocial:
-- de behandlar en affär som klar när fakturan är betald. Ett UGC-uppdrag är
-- i själva verket en TIDSBEGRÄNSAD LICENS. Tre saker faller mellan stolarna
-- hos alla andra, och det är dem den här modellen fångar:
--   1. licensen löper ut  -> bästa säljläget för förnyelse
--   2. exklusivitet krockar med ett nytt uppdrag -> avtalsbrott i blindo
--   3. materialet återgår -> fritt att licensiera om
-- Samma modell driver prissättningen, eftersom priset ÄR rättigheterna.
--
-- Delade projektet: allt prefixas piches_*, ingen trigger på auth.users,
-- RLS auth.uid() = user_id. Se skill supabase-delad-infra.

-- Leverabler: varje enskild sak som produceras i ett uppdrag ---------------

create table public.piches_deliverables (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  pitch_id    uuid not null references public.piches_pitches on delete cascade,
  brand_id    uuid not null references public.piches_brands on delete cascade,
  title       text not null,
  format      text not null default 'video'
                check (format in ('video','foto','story','reel','tiktok','ugc_ad','annat')),
  quantity    smallint not null default 1 check (quantity > 0),
  delivered_at timestamptz,
  approved_at  timestamptz,
  asset_url   text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index piches_deliverables_user_idx on public.piches_deliverables (user_id);
create index piches_deliverables_pitch_idx on public.piches_deliverables (pitch_id);

-- Licenser: de faktiska rättigheterna, med klocka -------------------------
-- En licens kan gälla en enskild leverabel eller hela uppdraget
-- (deliverable_id null = hela uppdraget).

create table public.piches_licenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  pitch_id    uuid not null references public.piches_pitches on delete cascade,
  brand_id    uuid not null references public.piches_brands on delete cascade,
  deliverable_id uuid references public.piches_deliverables on delete cascade,

  -- Var får materialet användas. Fler kanaler = högre pris.
  channels    text[] not null default '{organic_creator}',
  territory   text not null default 'se'
                check (territory in ('se','norden','eu','global')),

  -- Klockan. perpetual = evig licens, da ar ends_on null.
  starts_on   date not null default current_date,
  ends_on     date,
  perpetual   boolean not null default false,

  -- Exklusivitet loper ofta langre an sjalva anvandningsratten.
  exclusive_category text,
  exclusivity_ends_on date,

  includes_raw_files boolean not null default false,
  fee_sek     numeric(12,2),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- En licens har antingen ett slutdatum eller ar evig, aldrig bada eller ingen.
  constraint piches_licenses_clock_ck
    check ((perpetual and ends_on is null) or (not perpetual and ends_on is not null)),
  constraint piches_licenses_window_ck
    check (ends_on is null or ends_on >= starts_on)
);

create index piches_licenses_user_idx on public.piches_licenses (user_id);
create index piches_licenses_expiry_idx on public.piches_licenses (user_id, ends_on)
  where ends_on is not null;
create index piches_licenses_exclusivity_idx on public.piches_licenses (user_id, exclusive_category, exclusivity_ends_on)
  where exclusive_category is not null;
create index piches_licenses_brand_idx on public.piches_licenses (brand_id);

-- Prislista: underlaget for den forklarande prissattningen -----------------
-- Procentsatserna ar startvarden, inte sanningar. Anvandaren justerar dem
-- i Installningar allt eftersom hon lar sig vad marknaden betalar.

create table public.piches_settings (
  user_id     uuid primary key default auth.uid() references auth.users on delete cascade,
  base_video_rate  numeric(12,2) not null default 4000,
  base_photo_rate  numeric(12,2) not null default 1500,
  base_story_rate  numeric(12,2) not null default 1000,

  brand_organic_uplift_pct  numeric(6,2) not null default 20,
  paid_social_uplift_pct    numeric(6,2) not null default 60,
  whitelisting_uplift_pct   numeric(6,2) not null default 40,
  website_uplift_pct        numeric(6,2) not null default 15,
  exclusivity_uplift_pct    numeric(6,2) not null default 35,
  raw_files_uplift_pct      numeric(6,2) not null default 20,
  perpetuity_uplift_pct     numeric(6,2) not null default 150,
  territory_global_uplift_pct numeric(6,2) not null default 30,
  rush_fee_pct              numeric(6,2) not null default 25,

  -- Hur manga dagar innan utgang som varningen ska dyka upp.
  renewal_lead_days smallint not null default 30,
  updated_at  timestamptz not null default now()
);

-- updated_at ---------------------------------------------------------------

create trigger piches_deliverables_touch_updated_at
  before update on public.piches_deliverables
  for each row execute function public.piches_touch_updated_at();

create trigger piches_licenses_touch_updated_at
  before update on public.piches_licenses
  for each row execute function public.piches_touch_updated_at();

create trigger piches_settings_touch_updated_at
  before update on public.piches_settings
  for each row execute function public.piches_touch_updated_at();

-- RLS ----------------------------------------------------------------------

alter table public.piches_deliverables enable row level security;
alter table public.piches_licenses     enable row level security;
alter table public.piches_settings     enable row level security;

create policy "piches leverabler las"    on public.piches_deliverables for select using (auth.uid() = user_id);
create policy "piches leverabler skapa"  on public.piches_deliverables for insert with check (auth.uid() = user_id);
create policy "piches leverabler andra"  on public.piches_deliverables for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "piches leverabler radera" on public.piches_deliverables for delete using (auth.uid() = user_id);

create policy "piches licenser las"    on public.piches_licenses for select using (auth.uid() = user_id);
create policy "piches licenser skapa"  on public.piches_licenses for insert with check (auth.uid() = user_id);
create policy "piches licenser andra"  on public.piches_licenses for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "piches licenser radera" on public.piches_licenses for delete using (auth.uid() = user_id);

create policy "piches installningar las"   on public.piches_settings for select using (auth.uid() = user_id);
create policy "piches installningar skapa" on public.piches_settings for insert with check (auth.uid() = user_id);
create policy "piches installningar andra" on public.piches_settings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
