import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import type { Settings as SettingsRow } from "@/types/db";
import { Button, Card, Field, Input, Loading, PageHeader } from "@/components/ui";

type NumericKey = Exclude<keyof SettingsRow, "user_id" | "updated_at">;

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
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState<Partial<SettingsRow>>({});

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  if (isLoading || !settings) return <Loading />;

  const num = (key: NumericKey) => Number(draft[key] ?? settings[key]);
  const set = (key: NumericKey, value: number) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inställningar"
        subtitle="Din prislista styr prisförslagen. Justera i takt med vad marknaden faktiskt betalar."
      />

      <Card className="space-y-5">
        <h2 className="text-headline-sm">Grundpriser</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {RATES.map((r) => (
            <Field key={r.key} label={r.label} hint={r.hint}>
              <Input
                type="number"
                min={0}
                value={num(r.key)}
                onChange={(e) => set(r.key, Number(e.target.value))}
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
                onChange={(e) => set(u.key, Number(e.target.value))}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card className="space-y-5">
        <h2 className="text-headline-sm">Bevakning</h2>
        <Field
          label="Varna så här många dagar innan en licens går ut"
          hint="Styr utgångsradarn och notisbrickan."
        >
          <Input
            type="number"
            min={1}
            max={365}
            className="sm:w-48"
            value={num("renewal_lead_days")}
            onChange={(e) => set("renewal_lead_days", Number(e.target.value))}
          />
        </Field>
      </Card>

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
