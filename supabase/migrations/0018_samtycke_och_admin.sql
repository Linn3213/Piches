-- SAMTYCKE OCH ADMINVY.
--
-- 1. Ingen hade någonsin sagt ja till att få mejl. Appen skickar redan
--    kontomejl, vilket är tillåtet eftersom de handlar om tjänsten hon köpt,
--    men allt som liknar nyhetsbrev eller marknadsföring kräver ett aktivt ja.
--    Utan det får hon varken skicka det eller lägga någon på en maillista.
--
-- 2. Linn hade ingen väg att se vilka som skapat konto. auth.users går inte att
--    läsa från klienten, och det ska den inte heller, så det behövs en väg som
--    kontrollerar VEM som frågar innan den svarar.
alter table public.piches_subscriptions
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_at timestamptz,
  add column if not exists mailerlite_synced_at timestamptz;

create table if not exists public.piches_admins (
  user_id  uuid primary key references auth.users on delete cascade,
  tillagd  timestamptz not null default now(),
  notering text
);
alter table public.piches_admins enable row level security;
revoke all on table public.piches_admins from anon, authenticated;

insert into public.piches_admins (user_id, notering)
select id, 'Ägare' from auth.users
where email in ('linnlundholm95@gmail.com', 'linn.lundholm95@gmail.com')
on conflict (user_id) do nothing;

-- Adminvyn som en FUNKTION, inte som en vy.
--
-- En SECURITY DEFINER-vy går förbi RLS för alla som får läsa den, vilket redan
-- en gång i det här projektet lät vem som helst på internet läsa och skriva
-- hela varumärkeskatalogen. En funktion kan däremot kontrollera vem som frågar
-- innan den svarar, och det är hela skillnaden.
create or replace function public.piches_admin_konton()
returns table (
  user_id uuid, email text, skapad timestamptz, senast_inloggad timestamptz,
  status text, niva text, provperiod_slutar date, oppnad_for_hand boolean,
  samtycke boolean, samtycke_at timestamptz, pa_maillista boolean,
  antal_uppdrag bigint, antal_licenser bigint
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.piches_admins a where a.user_id = auth.uid()) then
    raise exception 'Endast för administratör';
  end if;

  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at,
    coalesce(s.status, 'inget konto'), coalesce(s.tier, '-'),
    s.trial_ends_on, coalesce(s.granted_by_owner, false),
    coalesce(s.marketing_consent, false), s.consent_at,
    s.mailerlite_synced_at is not null,
    (select count(*) from public.piches_pitches p where p.user_id = u.id and not p.is_example),
    (select count(*) from public.piches_licenses l where l.user_id = u.id and not l.is_example)
  from auth.users u
  join public.piches_subscriptions s on s.user_id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.piches_admin_konton() from public, anon;
grant execute on function public.piches_admin_konton() to authenticated;

create or replace function public.piches_ar_admin()
returns boolean language sql security definer set search_path = ''
as $$ select exists (select 1 from public.piches_admins a where a.user_id = auth.uid()); $$;

revoke all on function public.piches_ar_admin() from public, anon;
grant execute on function public.piches_ar_admin() to authenticated;
