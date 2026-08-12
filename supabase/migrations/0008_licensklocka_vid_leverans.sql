-- Licensklockan startar nu nar materialet levereras.
--
-- Rattighetsmotorn ar hela Piches USP: den haller reda pa nar ett varumarkes
-- ratt att anvanda materialet borjar och slutar. Men starts_on defaultade till
-- dagens datum vid inmatning och sattes sedan FOR HAND, alltsa var hela motorn
-- beroende av att nagon kom ihag att andra datumet den dag leveransen gick
-- ivag.
--
-- Ett glomt datum kostar pengar at bada hall: satts det for tidigt jagas en
-- fornyelse innan kunden ens borjat anvanda materialet, satts det for sent
-- anvander varumarket materialet gratis efter att licensen gatt ut.
--
-- FORSTA VERSIONEN AV VILLKORET VAR FEL och testet fangade det: den jamforde
-- starts_on mot radens skapandedatum i svensk tid, och gick sonder direkt
-- eftersom raden skapades 23:37 UTC, alltsa efter midnatt svensk tid. En regel
-- som slutar fungera runt midnatt ar fel regel aven nar den ser smart ut.
--
-- Regeln nu ar forutsagbar och gar att forklara for en kund: klockan startar
-- nar materialet levereras, UTOM nar nagon medvetet satt ett startdatum i
-- framtiden, till exempel for en kampanj som drar igang senare.
create or replace function public.piches_starta_licensklockan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nytt_start date := (new.delivered_at at time zone 'Europe/Stockholm')::date;
begin
  if new.delivered_at is null or old.delivered_at is not null then
    return new;
  end if;

  update public.piches_licenses l
  set starts_on = nytt_start,
      ends_on = case when l.ends_on is null then null
                     else l.ends_on + (nytt_start - l.starts_on) end,
      exclusivity_ends_on = case when l.exclusivity_ends_on is null then null
                                 else l.exclusivity_ends_on + (nytt_start - l.starts_on) end,
      updated_at = now()
  where l.deliverable_id = new.id
    and l.user_id = new.user_id
    and l.starts_on <= nytt_start;

  return new;
end;
$$;

drop trigger if exists piches_licens_klocka_vid_leverans on public.piches_deliverables;

create trigger piches_licens_klocka_vid_leverans
  after update of delivered_at on public.piches_deliverables
  for each row
  execute function public.piches_starta_licensklockan();
