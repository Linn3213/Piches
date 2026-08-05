-- Första gången. Utan det här landar en ny användare på en tom Idag-vy där
-- varje flik är tom och knappen för nytt uppdrag är utgråad, eftersom den
-- kräver ett varumärke som ligger undanstoppat i sekundärmenyn.
--
-- Stämpeln ligger i databasen och inte i webbläsarens lagring, så att guiden
-- inte dyker upp igen bara för att hon loggar in från telefonen.
alter table public.piches_settings
  add column if not exists onboarded_at timestamptz;
