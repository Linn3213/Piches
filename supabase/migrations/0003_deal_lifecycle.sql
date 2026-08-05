-- Affären hela vägen: från vunnen till betald, och vidare till förnyelse.
--
-- Bakgrunden: 0001 och 0002 byggde två halvor som aldrig möttes. Pipelinen
-- slutade vid 'vunnen', och licenserna i 0002 låg som fristående poster utan
-- något som skapade dem. Rättighetsmotorn kunde alltså aldrig få data, och
-- utgångsradarn kunde per definition aldrig visa något.
--
-- Den här migrationen kopplar ihop dem:
--   vunnen -> produktion -> levererat -> fakturerat -> betalt -> förnyelse
--
-- Leveransen är det som startar licensklockan. Förnyelsen pekar tillbaka på
-- licensen som gick ut, så att kedjan går att följa bakåt: det här är
-- förnyelse två av Verso, och den kom från licensen som slutade i mars.

-- Affärens livscykel efter vunnen -----------------------------------------

alter table public.piches_pitches drop constraint if exists piches_pitches_status_check;

alter table public.piches_pitches add constraint piches_pitches_status_check
  check (status in (
    'utkast','skickad','svarat','offert','ingen_respons','forlorad',
    'vunnen','produktion','levererat','fakturerat','betalt'
  ));

alter table public.piches_brands drop constraint if exists piches_brands_status_check;

alter table public.piches_brands add constraint piches_brands_status_check
  check (status in ('ny','researchad','pitchad','svarat','offert','vunnen','forlorad','vilande'));

-- Pengarna ----------------------------------------------------------------
-- Alla belopp är exklusive moms. Appen äger affärslogiken, bokföringen äger
-- arkivet och ansvaret (se docs/scope-arkitektur-v1.md, avsnitt 2) — därför
-- lagras här bara det som behövs för att veta vad som är ute och vad som
-- faktiskt kommit in, aldrig verifikat eller kvitton.

alter table public.piches_pitches
  add column if not exists won_at            timestamptz,
  add column if not exists invoice_number    text,
  add column if not exists invoiced_on       date,
  add column if not exists due_on            date,
  add column if not exists paid_on           date,
  -- Vad affären kostade dig: köpta tjänster, resor, rekvisita, redigering.
  add column if not exists production_cost_sek numeric(12,2),
  -- Din egen tid. Utan den går timpenningen inte att räkna, och timpenningen
  -- är det enda mått som avslöjar vilka kunder som faktiskt är värda att ha.
  add column if not exists hours_spent       numeric(6,2),
  add column if not exists revision_rounds   smallint not null default 0,
  -- Förnyelsekedjan: den här affären föddes ur en licens som löpte ut.
  add column if not exists renewed_from_license_id uuid
    references public.piches_licenses on delete set null;

alter table public.piches_pitches
  drop constraint if exists piches_pitches_revisions_ck;
alter table public.piches_pitches
  add constraint piches_pitches_revisions_ck check (revision_rounds >= 0);

alter table public.piches_pitches
  drop constraint if exists piches_pitches_due_ck;
alter table public.piches_pitches
  add constraint piches_pitches_due_ck
  check (due_on is null or invoiced_on is null or due_on >= invoiced_on);

create index if not exists piches_pitches_unpaid_idx
  on public.piches_pitches (user_id, due_on)
  where invoiced_on is not null and paid_on is null;

create index if not exists piches_pitches_renewal_idx
  on public.piches_pitches (renewed_from_license_id)
  where renewed_from_license_id is not null;

-- Förnyelsepåslaget --------------------------------------------------------
-- När en licens går ut säljer du till någon som redan vet exakt vad
-- materialet är värt. Det är enda gången på året ett påslag går att motivera
-- utan att argumentera, så det förtjänar en egen inställning.

alter table public.piches_settings
  add column if not exists renewal_uplift_pct numeric(6,2) not null default 15;

-- Produktionen ------------------------------------------------------------
-- Hooken är inte en anteckning i UGC, den är produkten. Första sekunden
-- avgör om annonsen presterar, så den förtjänar ett eget fält som går att
-- söka i och återanvända, inte en rad i en klumpig anteckningsruta.

alter table public.piches_deliverables
  add column if not exists hook   text,
  add column if not exists script text;

-- Datumstämplar som inte går att glömma ------------------------------------
-- Statusbyten sker från flera ställen i appen (kanban, affärsvy, snabbknapp).
-- Läggs stämplingen i UI:t hamnar den förr eller senare fel på ett av dem,
-- och då ljuger både utgångsradarn och intäktsstatistiken. Därför i databasen.

create or replace function public.piches_stamp_pitch_dates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'vunnen' and new.won_at is null then
      new.won_at = now();
    end if;

    if new.status = 'fakturerat' and new.invoiced_on is null then
      new.invoiced_on = current_date;
    end if;

    if new.status = 'betalt' and new.paid_on is null then
      new.paid_on = current_date;
    end if;

    -- En affär som når betalt utan att ha passerat de tidigare stegen ska
    -- ändå räknas som vunnen i statistiken.
    if new.status in ('produktion','levererat','fakturerat','betalt')
       and new.won_at is null then
      new.won_at = now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists piches_pitches_stamp_dates on public.piches_pitches;
create trigger piches_pitches_stamp_dates
  before update on public.piches_pitches
  for each row execute function public.piches_stamp_pitch_dates();
