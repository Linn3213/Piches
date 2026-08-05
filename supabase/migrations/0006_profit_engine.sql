-- Lönsamhetsmotorn och digitala produkter.
--
-- Omsättning säger ingenting om hur en verksamhet mår. Två creators som
-- fakturerar lika mycket kan ha helt olika liv, och skillnaden syns först när
-- man delar intäkten med nedlagd tid. Måtten kräver därför att man först säger
-- vad man siktar på.

alter table public.piches_settings
  add column if not exists target_hourly_rate numeric(12,2) not null default 1200,
  add column if not exists target_monthly_revenue numeric(12,2) not null default 50000,
  add column if not exists audience_size integer not null default 0,
  add column if not exists email_list_size integer not null default 0;

alter table public.piches_settings drop constraint if exists piches_settings_targets_ck;
alter table public.piches_settings
  add constraint piches_settings_targets_ck
  check (target_hourly_rate >= 0 and target_monthly_revenue >= 0
         and audience_size >= 0 and email_list_size >= 0);

-- En UGC-affär betalas en gång, en produkt varje gång någon köper den.
create table if not exists public.piches_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  kind        text not null default 'kurs'
                check (kind in ('mall','guide','minikurs','kurs','medlemskap','konsultation','workshop','annat')),
  status      text not null default 'ide'
                check (status in ('ide','byggs','lanserad','vilande')),
  price_sek   numeric(12,2) not null default 0 check (price_sek >= 0),
  build_hours numeric(8,2) not null default 0 check (build_hours >= 0),
  monthly_hours numeric(8,2) not null default 0 check (monthly_hours >= 0),
  build_cost_sek   numeric(12,2) not null default 0 check (build_cost_sek >= 0),
  monthly_cost_sek numeric(12,2) not null default 0 check (monthly_cost_sek >= 0),
  conversion_pct numeric(6,3) not null default 1 check (conversion_pct >= 0 and conversion_pct <= 100),
  recurring   boolean not null default false,
  notes       text,
  units_sold  integer not null default 0 check (units_sold >= 0),
  revenue_sek numeric(12,2) not null default 0 check (revenue_sek >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists piches_products_user_idx on public.piches_products (user_id, status);

drop trigger if exists piches_products_touch_updated_at on public.piches_products;
create trigger piches_products_touch_updated_at
  before update on public.piches_products
  for each row execute function public.piches_touch_updated_at();

alter table public.piches_products enable row level security;

drop policy if exists "piches produkter las"    on public.piches_products;
drop policy if exists "piches produkter skapa"  on public.piches_products;
drop policy if exists "piches produkter andra"  on public.piches_products;
drop policy if exists "piches produkter radera" on public.piches_products;

create policy "piches produkter las"    on public.piches_products for select using (auth.uid() = user_id);
create policy "piches produkter skapa"  on public.piches_products for insert with check (auth.uid() = user_id);
create policy "piches produkter andra"  on public.piches_products for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "piches produkter radera" on public.piches_products for delete using (auth.uid() = user_id);

-- Komigång-guiden.
alter table public.piches_settings
  add column if not exists onboarded_at timestamptz;

-- Datumstämplar även vid INSERT. Triggern i 0003 satt bara på update, men
-- formuläret låter en affär skapas direkt som "betalt", och då sparades raden
-- utan paid_on. Kortet låg i kolumnen Betalt medan Inbetalt visade noll.
create or replace function public.piches_stamp_pitch_dates_ins()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('vunnen','produktion','levererat','fakturerat','betalt')
     and new.won_at is null then
    new.won_at = now();
  end if;
  if new.status in ('fakturerat','betalt') and new.invoiced_on is null then
    new.invoiced_on = current_date;
  end if;
  if new.status = 'betalt' and new.paid_on is null then
    new.paid_on = current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists piches_pitches_stamp_dates_insert on public.piches_pitches;
create trigger piches_pitches_stamp_dates_insert
  before insert on public.piches_pitches
  for each row execute function public.piches_stamp_pitch_dates_ins();
