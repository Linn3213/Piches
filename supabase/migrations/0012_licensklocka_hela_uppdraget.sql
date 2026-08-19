-- Licensklockan startade aldrig för en licens som gäller HELA uppdraget.
--
-- Triggern letade bara efter licenser knutna till just den leverans som
-- markerades levererad. Men licensformuläret föreslår "Hela uppdraget", och det
-- är vad de flesta väljer, särskilt den som registrerar rättigheterna innan hon
-- lagt upp de enskilda filmerna. För dem stod klockan kvar på det datum som
-- råkade stå i formuläret, alltså oftast den dag uppdraget skrevs in och inte
-- den dag materialet gick iväg.
--
-- Konsekvensen är exakt det appen finns för att förhindra: utgångsdatumet blir
-- fel, radarn larmar vid fel tidpunkt och förnyelsen sker mot fel datum. Och
-- ingenting såg trasigt ut, för licensen fanns ju där med ett datum.
--
-- Klockan startar vid FÖRSTA leveransen i uppdraget, inte den sista. En regel
-- som väntar på att allt är levererat slutar tyst att fungera så fort någon
-- glömmer bocka av en enda rad, och tyst är det värsta ett sådant här system
-- kan vara. Datumet går fortfarande att ändra för hand när avtalet säger något
-- annat.
create or replace function public.piches_starta_licensklockan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nytt_start date := (new.delivered_at at time zone 'Europe/Stockholm')::date;
  forsta_leveransen boolean;
begin
  if new.delivered_at is null or old.delivered_at is not null then
    return new;
  end if;

  -- 1. Licenser knutna till just den här leveransen.
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

  -- 2. Licenser som gäller hela uppdraget. Bara vid den första leveransen, så
  --    att klockan inte flyttas fram varje gång en till film bockas av.
  if new.pitch_id is not null then
    select not exists (
      select 1 from public.piches_deliverables d
      where d.pitch_id = new.pitch_id
        and d.user_id = new.user_id
        and d.id <> new.id
        and d.delivered_at is not null
    ) into forsta_leveransen;

    if forsta_leveransen then
      update public.piches_licenses l
      set starts_on = nytt_start,
          ends_on = case when l.ends_on is null then null
                         else l.ends_on + (nytt_start - l.starts_on) end,
          exclusivity_ends_on = case when l.exclusivity_ends_on is null then null
                                     else l.exclusivity_ends_on + (nytt_start - l.starts_on) end,
          updated_at = now()
      where l.pitch_id = new.pitch_id
        and l.user_id = new.user_id
        and l.deliverable_id is null
        and l.starts_on <= nytt_start;
    end if;
  end if;

  return new;
end;
$$;
