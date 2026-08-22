-- Vem som helst på internet kunde läsa OCH SKRIVA hela varumärkeskatalogen.
--
-- De två vyerna skapades utan security_invoker, vilket gör dem SECURITY
-- DEFINER: de kör med ägarens rättigheter och går därmed helt förbi RLS på
-- tabellen under. Rollen anon hade dessutom fått samtliga rättigheter på dem.
--
-- Uppmätt skarpt som rollen anon, alltså med den publika nyckel som ligger i
-- appens JavaScript och som per definition är offentlig:
--   läs tabellen direkt  ->  0 rader    (RLS gjorde sitt jobb)
--   läs via vyn          ->  113 rader  (inklusive contact_email)
--   UPDATE via vyn       ->  113 rader ändrade
--
-- Alltså kunde en helt oinloggad person både skrapa hela katalogen med
-- kontaktuppgifter och avaktivera eller förstöra varenda rad i den. Katalogen
-- är dessutom en av produktens egna tillgångar.
--
-- Vyerna används inte av appen alls, bara av nattkörningen som redan går med
-- service-role. Därför: security_invoker på, och alla rättigheter borttagna
-- från anon och authenticated.

create or replace view public.piches_directory_health
with (security_invoker = true) as
select
  d.id, d.name, d.country, d.pr_route, d.verification_level, d.contact_email,
  d.domain_ok, d.mx_ok, d.consecutive_failures, d.last_checked_at, d.is_active,
  (select count(*) from public.piches_directory_findings f
    where f.directory_id = d.id and f.status = 'pending') as pending_findings
from public.piches_brand_directory d;

create or replace view public.piches_directory_health_report
with (security_invoker = true) as
select c.checked_at, d.name, d.country, d.verification_level, c.action, c.detail
from public.piches_directory_checks c
join public.piches_brand_directory d on d.id = c.directory_id
where c.action <> 'ok'
order by c.checked_at desc;

revoke all on public.piches_directory_health from anon, authenticated;
revoke all on public.piches_directory_health_report from anon, authenticated;

-- Triggerfunktionen för licensklockan låg öppen som RPC för både anon och
-- inloggade. Den är SECURITY DEFINER och har ingenting att göra utanför sin
-- trigger. Provat efteråt: en inloggad användare som markerar leverans får
-- fortfarande klockan startad, eftersom Postgres inte kräver EXECUTE för
-- triggerfunktioner.
revoke all on function public.piches_starta_licensklockan() from anon, authenticated, public;
