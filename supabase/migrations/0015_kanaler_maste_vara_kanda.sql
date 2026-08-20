-- Kanalerna kunde vara vad som helst.
--
-- Kolumnen är en textarray utan begränsning, så en felstavad eller föråldrad
-- nyckel gick rakt in i databasen. Den syntes sedan som rå text på FAKTURAN
-- kunden får, i stället för "Betald annonsering", eftersom översättningen
-- faller tillbaka på nyckeln när den inte känner igen den. Upptäckt när en
-- provrad med 'brand_organic' i stället för 'organic_brand' dök upp i klartext
-- i ett fakturaunderlag.
--
-- Att falla tillbaka på nyckeln är fortfarande rätt i koden, för en tom cell
-- vore sämre. Men det ska inte kunna hända, och det är databasens jobb att se
-- till.
alter table public.piches_licenses
  drop constraint if exists piches_licenses_channels_check;

alter table public.piches_licenses
  add constraint piches_licenses_channels_check
  check (
    channels <@ array['organic_creator','organic_brand','paid_social','whitelisting','website']::text[]
  );
