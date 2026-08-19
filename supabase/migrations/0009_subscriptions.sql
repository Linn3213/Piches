-- Vägen från noll kronor till en affär som går att skala.
--
-- Fram till nu öppnades varje konto för hand och varje faktura skrevs för
-- hand. Det håller för de tre första kunderna och tar sedan slut, inte för att
-- produkten är dålig utan för att arbetet växer linjärt med antalet kunder.
-- Taket satt alltså i processen, inte i priset.
--
-- Raden här är sanningen om vem som får vara inne. Provperioden är gratis och
-- kräver inget kort, eftersom en creator vill se sina egna licenser ticka
-- innan hon betalar för att slippa missa dem.

create table if not exists public.piches_subscriptions (
  user_id     uuid primary key default auth.uid() references auth.users on delete cascade,
  tier        text not null default 'solo' check (tier in ('solo','studio')),
  -- provperiod: gratis och utan kort. aktiv: betalar. forfallen: betalningen
  -- slutade fungera. uppsagd: hon har sagt upp men perioden löper ut.
  status      text not null default 'provperiod'
                check (status in ('provperiod','aktiv','forfallen','uppsagd')),
  trial_ends_on date,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  -- Satt när Linn öppnat kontot för hand, så att en manuellt fakturerad kund
  -- aldrig blir utelåst av att Stripe inte känner till henne.
  granted_by_owner boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists piches_subscriptions_stripe_idx
  on public.piches_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

drop trigger if exists piches_subscriptions_touch_updated_at on public.piches_subscriptions;
create trigger piches_subscriptions_touch_updated_at
  before update on public.piches_subscriptions
  for each row execute function public.piches_touch_updated_at();

alter table public.piches_subscriptions enable row level security;

-- Hon får LÄSA sin egen rad och skapa sin provperiod, men aldrig ändra den.
-- Utan den spärren kunde vem som helst sätta status till 'aktiv' från
-- webbläsarkonsolen och använda produkten gratis för alltid. Statusbyten sker
-- bara via edge-funktioner med service-role.
drop policy if exists "piches abonnemang las"   on public.piches_subscriptions;
drop policy if exists "piches abonnemang skapa" on public.piches_subscriptions;

create policy "piches abonnemang las" on public.piches_subscriptions
  for select using (auth.uid() = user_id);

create policy "piches abonnemang skapa" on public.piches_subscriptions
  for insert with check (
    auth.uid() = user_id
    and status = 'provperiod'
    and granted_by_owner = false
    and stripe_subscription_id is null
    -- Provperioden får aldrig sättas längre än fjorton dagar av klienten.
    and trial_ends_on is not null
    and trial_ends_on <= (current_date + 14)
  );
