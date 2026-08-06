-- Statusen och datumen får aldrig säga emot varandra, och guiden ska gå att
-- slutföra även för den vars priser råkar vara exakt startvärdena.
--
-- Triggern i 0003 hade hela sin kropp inuti "if status ändrats", så en
-- uppdatering som bara rörde paid_on lämnade raden i ett omöjligt tillstånd:
-- status 'betalt' men paid_on null. Kanbankortet låg då kvar i kolumnen Betalt
-- medan Inbetalt visade noll, beloppet flyttades till utestående, och
-- Lönsamhet hittade en påhittad läcka om en försenad betalning som i själva
-- verket redan var betald.

create or replace function public.piches_status_follows_dates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.paid_on is null and old.paid_on is not null and new.status = 'betalt' then
    new.status = case when new.invoiced_on is not null then 'fakturerat' else 'levererat' end;
  end if;

  if new.invoiced_on is null and old.invoiced_on is not null
     and new.status in ('fakturerat','betalt') then
    new.status = 'levererat';
    new.paid_on = null;
  end if;

  return new;
end;
$$;

drop trigger if exists piches_pitches_status_follows_dates on public.piches_pitches;
create trigger piches_pitches_status_follows_dates
  before update on public.piches_pitches
  for each row execute function public.piches_status_follows_dates();

-- Komigång-guiden bockade av prissteget genom att jämföra mot startvärdena.
-- Den vars riktiga priser råkade vara exakt 4000/1500/1000 kunde därför aldrig
-- få steget avbockat, och då dök knappen som avslutar guiden aldrig upp.
alter table public.piches_settings
  add column if not exists rates_set_at timestamptz;
