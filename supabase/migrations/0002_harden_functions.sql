-- Tapper till tva varningar fran Supabase security advisor efter 0001_init.sql:
-- 1. touch_updated_at hade ett muterbart search_path.
-- 2. handle_new_user (SECURITY DEFINER) gick att anropa direkt via
--    /rest/v1/rpc/handle_new_user av anon och authenticated. Den ska bara
--    kunna kallas av triggern, inte fran klienten.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
