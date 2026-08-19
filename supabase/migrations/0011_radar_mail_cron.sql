-- Schemat för radarmailet.
--
-- Hemligheten kopieras från den projektgemensamma cron-hemligheten till ett
-- namn som säger vad den används till här. Värdet skrivs aldrig ut någonstans,
-- det läses direkt ur valvet och läggs tillbaka i valvet.
do $$
declare
  v text;
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'piches_cron_secret') then
    select decrypted_secret into v from vault.decrypted_secrets where name = 'learnnd_cron_secret';
    if v is null then
      raise exception 'Ingen cron-hemlighet i valvet att utgå från';
    end if;
    perform vault.create_secret(
      v,
      'piches_cron_secret',
      'Samma värde som edge-funktionernas CRON_SECRET. Piches radarmail skickar den som x-cron-secret.'
    );
  end if;
end $$;

-- Klockan är UTC. 06:00 UTC blir 08:00 svensk sommartid och 07:00 vintertid,
-- och för ett dagligt mejl spelar den timmen ingen roll. Att INTE ha två jobb
-- för sommar och vinter är ett medvetet val: dubbla jobb är precis det som
-- gjorde att en annan app tyst slutade köra halva året.
select cron.unschedule('piches-radar-mail-daily')
where exists (select 1 from cron.job where jobname = 'piches-radar-mail-daily');

select cron.schedule(
  'piches-radar-mail-daily',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://mhswnvzpqekdcdjxxrmm.supabase.co/functions/v1/piches-radar-mail',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'piches_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
