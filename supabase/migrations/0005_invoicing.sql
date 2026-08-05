-- Underlaget för avtal och fakturor.
--
-- Ett avtal och en faktura kräver samma sak: vem säljer, vem köper, och under
-- vilka villkor. Uppgifterna ligger därför på avsändaren (settings) och på
-- mottagaren (brands), inte på varje enskild affär, eftersom de är desamma
-- gång efter gång och att skriva in dem varje gång är precis det som gör att
-- man i stället gör fakturan i ett ordbehandlingsprogram.

alter table public.piches_settings
  add column if not exists company_name    text,
  add column if not exists company_orgnr   text,
  add column if not exists company_vat_nr  text,
  add column if not exists company_address text,
  add column if not exists company_zip     text,
  add column if not exists company_city    text,
  add column if not exists company_email   text,
  add column if not exists company_phone   text,
  -- F-skatt ska anges på fakturan och är en av de vanligaste bristerna.
  add column if not exists has_f_skatt     boolean not null default true,
  -- Under omsättningsgränsen behöver man inte vara momsregistrerad, och då
  -- ska ingen moms läggas på. Att tvinga fram 25 % vore direkt fel.
  add column if not exists vat_registered  boolean not null default true,
  add column if not exists payment_bankgiro text,
  add column if not exists payment_iban     text,
  add column if not exists payment_bic      text,
  add column if not exists payment_swish    text,
  add column if not exists payment_terms_days smallint not null default 30,
  -- Fakturanummer måste löpa i obruten nummerserie.
  add column if not exists invoice_prefix      text,
  add column if not exists invoice_next_number integer not null default 1;

alter table public.piches_settings drop constraint if exists piches_settings_terms_ck;
alter table public.piches_settings
  add constraint piches_settings_terms_ck check (payment_terms_days between 0 and 365);

alter table public.piches_settings drop constraint if exists piches_settings_invoice_no_ck;
alter table public.piches_settings
  add constraint piches_settings_invoice_no_ck check (invoice_next_number > 0);

-- Mottagaren. Landet styr momsen, och momsnumret avgör om en EU-kund ska
-- faktureras med omvänd betalningsskyldighet i stället för svensk moms.
alter table public.piches_brands
  add column if not exists org_nr     text,
  add column if not exists vat_nr     text,
  add column if not exists address    text,
  add column if not exists zip        text,
  add column if not exists city       text,
  add column if not exists country    text not null default 'SE',
  add column if not exists is_company boolean not null default true,
  add column if not exists invoice_reference text;

alter table public.piches_brands drop constraint if exists piches_brands_country_ck;
alter table public.piches_brands
  add constraint piches_brands_country_ck check (country ~ '^[A-Z]{2}$');
