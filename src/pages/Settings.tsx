import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import type { Settings as SettingsRow } from "@/types/db";
import { Button, Card, Checkbox, Field, Input, Loading, PageHeader } from "@/components/ui";
import { Uttag } from "@/components/Uttag";

// Bara de falt som faktiskt ar tal. Tidigare tog den har typen med aven
// text- och boolean-falten, vilket gjorde att Number() kunde slappas los pa
// ett organisationsnummer.
type NumericKey = {
  [K in keyof SettingsRow]: SettingsRow[K] extends number ? K : never;
}[keyof SettingsRow];

const RATES: { key: NumericKey; label: string; hint: string }[] = [
  { key: "base_video_rate", label: "Video, per styck", hint: "Reel, TikTok och UGC-annons räknas som video" },
  { key: "base_photo_rate", label: "Foto, per styck", hint: "" },
  { key: "base_story_rate", label: "Story, per styck", hint: "" },
];

const UPLIFTS: { key: NumericKey; label: string; hint: string }[] = [
  { key: "brand_organic_uplift_pct", label: "Varumärkets egna kanaler, %", hint: "De får publicera i sina flöden" },
  { key: "paid_social_uplift_pct", label: "Betald annonsering, %", hint: "Skalas dessutom med licenslängden" },
  { key: "whitelisting_uplift_pct", label: "Whitelisting, %", hint: "Annonsen går från ditt konto" },
  { key: "website_uplift_pct", label: "Webb och e-handel, %", hint: "" },
  { key: "exclusivity_uplift_pct", label: "Branschexklusivitet, %", hint: "Du tackar nej till konkurrenter" },
  { key: "raw_files_uplift_pct", label: "Råmaterial, %", hint: "" },
  { key: "perpetuity_uplift_pct", label: "Evig licens, %", hint: "Materialet kan aldrig säljas om" },
  { key: "territory_global_uplift_pct", label: "Global användning, %", hint: "" },
  { key: "rush_fee_pct", label: "Expressleverans, %", hint: "" },
];

export default function Settings() {
  const { data: settings, isLoading, error } = useSettings();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState<Partial<SettingsRow>>({});

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  if (error) return <p className="text-body-md text-error">Vi nådde inte servern just nu, prova att ladda om sidan.</p>;
  if (isLoading || !settings) return <Loading />;

  const num = (key: NumericKey) => Number(draft[key] ?? settings[key]);
  const set = (key: NumericKey, value: number) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  // Texter och kryssrutor delar samma utkast, men far egna hjalpare eftersom
  // Number() pa ett organisationsnummer hade gett NaN.
  type TextKey = {
    [K in keyof SettingsRow]: SettingsRow[K] extends string | null ? K : never;
  }[keyof SettingsRow];
  type BoolKey = {
    [K in keyof SettingsRow]: SettingsRow[K] extends boolean ? K : never;
  }[keyof SettingsRow];

  const txt = (key: TextKey) => String(draft[key] ?? settings[key] ?? "");
  const setText = (key: TextKey, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value.trim() === "" ? null : value }));
  const bool = (key: BoolKey) => Boolean(draft[key] ?? settings[key]);
  const setBool = (key: BoolKey, value: boolean) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inställningar"
        subtitle="Din prislista styr prisförslagen. Justera i takt med vad marknaden faktiskt betalar."
      />

      <Card className="space-y-5">
        <div>
          <h2 className="text-headline-sm">Ditt företag</h2>
          <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
            Uppgifterna hamnar på fakturor och avtal. Utan organisationsnummer och en betalväg är
            fakturan inte komplett, och då dröjer betalningen.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Företagsnamn">
            <Input
              value={txt("company_name")}
              onChange={(e) => setText("company_name", e.target.value)}
              placeholder="Ditt AB eller enskild firma"
            />
          </Field>
          <Field label="Organisationsnummer">
            <Input
              value={txt("company_orgnr")}
              onChange={(e) => setText("company_orgnr", e.target.value)}
              placeholder="556677-8899"
            />
          </Field>
          <Field label="Momsregistreringsnummer" hint="Vanligtvis SE + orgnr utan bindestreck + 01.">
            <Input
              value={txt("company_vat_nr")}
              onChange={(e) => setText("company_vat_nr", e.target.value)}
              placeholder="SE556677889901"
            />
          </Field>
          <Field label="Mejladress på fakturan">
            <Input
              type="email"
              value={txt("company_email")}
              onChange={(e) => setText("company_email", e.target.value)}
              placeholder="info@essensiadesign.se"
            />
          </Field>
          <Field label="Adress">
            <Input
              value={txt("company_address")}
              onChange={(e) => setText("company_address", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Postnummer">
              <Input value={txt("company_zip")} onChange={(e) => setText("company_zip", e.target.value)} />
            </Field>
            <Field label="Ort">
              <Input value={txt("company_city")} onChange={(e) => setText("company_city", e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox
            label="Godkänd för F-skatt"
            checked={bool("has_f_skatt")}
            onChange={(v) => setBool("has_f_skatt", v)}
          />
          <Checkbox
            label="Momsregistrerad"
            checked={bool("vat_registered")}
            onChange={(v) => setBool("vat_registered", v)}
          />
        </div>
        {!bool("vat_registered") && (
          <p className="text-body-md text-on-surface-variant">
            Ingen moms läggs på fakturorna så länge den här är avstängd. Passerar du
            omsättningsgränsen under året behöver du registrera dig och slå på den igen.
          </p>
        )}
      </Card>

      <Card className="space-y-5">
        <div>
          <h2 className="text-headline-sm">Betalning och fakturanummer</h2>
          <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
            Minst en betalväg behövs. Har du utländska kunder krävs dessutom IBAN och BIC.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bankgiro">
            <Input value={txt("payment_bankgiro")} onChange={(e) => setText("payment_bankgiro", e.target.value)} placeholder="123-4567" />
          </Field>
          <Field label="Swish">
            <Input value={txt("payment_swish")} onChange={(e) => setText("payment_swish", e.target.value)} />
          </Field>
          <Field label="IBAN">
            <Input value={txt("payment_iban")} onChange={(e) => setText("payment_iban", e.target.value)} />
          </Field>
          <Field label="BIC">
            <Input value={txt("payment_bic")} onChange={(e) => setText("payment_bic", e.target.value)} />
          </Field>
          <Field label="Betalningsvillkor, dagar">
            <Input
              type="number"
              min={0}
              max={365}
              value={num("payment_terms_days")}
              onChange={(e) =>
                set("payment_terms_days", Math.min(365, Math.max(0, Number(e.target.value) || 0)))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nummerprefix" hint="Frivilligt.">
              <Input value={txt("invoice_prefix")} onChange={(e) => setText("invoice_prefix", e.target.value)} placeholder="2026-" />
            </Field>
            <Field label="Nästa nummer" hint="Serien måste vara obruten.">
              <Input
                type="number"
                min={1}
                value={num("invoice_next_number")}
                onChange={(e) => set("invoice_next_number", Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="space-y-5">
        <div>
          <h2 className="text-headline-sm">Dina mål</h2>
          <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
            Utan ett mål går det bara att se hur stor en affär var, aldrig om den var bra. De här
            siffrorna är vad Lönsamhet räknar emot.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Vad en timme av din tid ska vara värd"
            hint="Allt under det är en förlustaffär, även när fakturan ser bra ut."
          >
            <Input
              type="number"
              min={0}
              step={50}
              value={num("target_hourly_rate")}
              onChange={(e) => set("target_hourly_rate", Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="Vad du vill dra in per månad">
            <Input
              type="number"
              min={0}
              step={1000}
              value={num("target_monthly_revenue")}
              onChange={(e) =>
                set("target_monthly_revenue", Math.max(0, Number(e.target.value) || 0))
              }
            />
          </Field>
          <Field label="Hur många som följer dig" hint="Underlaget för att räkna på en produkt.">
            <Input
              type="number"
              min={0}
              value={num("audience_size")}
              onChange={(e) => set("audience_size", Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field
            label="Hur många som står på din lista"
            hint="En lista säljer betydligt bättre än ett flöde, så den räknas för sig."
          >
            <Input
              type="number"
              min={0}
              value={num("email_list_size")}
              onChange={(e) => set("email_list_size", Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5">
        <h2 className="text-headline-sm">Grundpriser</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {RATES.map((r) => (
            <Field key={r.key} label={r.label} hint={r.hint}>
              <Input
                type="number"
                min={0}
                value={num(r.key)}
                onChange={(e) => set(r.key, Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card className="space-y-5">
        <div>
          <h2 className="text-headline-sm">Påslag för rättigheter</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Räknas på produktionskostnaden, var för sig, så att varje rad går att motivera.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {UPLIFTS.map((u) => (
            <Field key={u.key} label={u.label} hint={u.hint}>
              <Input
                type="number"
                min={0}
                value={num(u.key)}
                onChange={(e) => set(u.key, Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card className="space-y-5">
        <div>
          <h2 className="text-headline-sm">Bevakning och förnyelse</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Styr när en licens dyker upp på radarn, och vad appen föreslår att du tar för att
            förlänga den.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Varna så här många dagar innan en licens går ut"
            hint="Styr när licensen dyker upp på Rättigheter och när siffran syns i menyn."
          >
            <Input
              type="number"
              min={1}
              max={365}
              value={num("renewal_lead_days")}
              onChange={(e) =>
                // Aldrig noll. Ett tomt falt gav 0 dagars bevakning, alltsa
                // tystnade utgangsradarn helt utan att nagot sades.
                set("renewal_lead_days", Math.min(365, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </Field>
          <Field
            label="Påslag på förnyelser, %"
            hint="Materialet är beprövat vid det laget, så förlängningen är sällan värd mindre än originalet."
          >
            <Input
              type="number"
              min={0}
              max={500}
              value={num("renewal_uplift_pct")}
              onChange={(e) => set("renewal_uplift_pct", Number(e.target.value))}
            />
          </Field>
        </div>

        {/* Utgangsradarn finns nu ocksa utanfor appen. Utan mejlet halls loftet
            bara for den som kommer ihag att logga in, alltsa precis den som
            inte behovde paminnelsen. Pa som standard, men aldrig utan en vag
            att stanga av. */}
        <div className="mt-6 border-t border-outline-variant/40 pt-6">
          <Checkbox
            label="Mejla mig när en licens snart går ut"
            checked={draft.email_radar !== false}
            onChange={(v) => setBool("email_radar", v)}
          />
          <p className="mt-2 text-body-md text-on-surface-variant">
            Du får ett mejl när framförhållningen ovan slår till, och ett sista under den
            avslutande veckan. Aldrig fler än så per licens.
          </p>
        </div>
      </Card>

      <Uttag />

      <div className="flex items-center gap-3">
        <Button
          onClick={() => update.mutate(draft)}
          disabled={update.isPending}
        >
          {update.isPending ? "Sparar..." : "Spara"}
        </Button>
        {update.isSuccess && !update.isPending && (
          <span className="text-body-md text-primary">Sparat.</span>
        )}
        {update.isError && <span className="text-body-md text-error">Kunde inte spara.</span>}
      </div>
    </div>
  );
}
