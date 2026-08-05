import { useMemo, useState } from "react";
import type { LicenseDraft } from "@/hooks/useLicenses";
import { useExclusivityGuard } from "@/hooks/useLicenses";
import { useSettings } from "@/hooks/useSettings";
import { computePrice } from "@/lib/pricing";
import { days, formatDateFull, formatMoney, plural } from "@/lib/format";
import type { Channel, Deliverable, License, Territory } from "@/types/db";
import { CHANNEL_LABEL, TERRITORY_LABEL } from "@/types/db";
import { Badge, Button, Checkbox, Field, Icon, Input, Select, Textarea } from "@/components/ui";

const CHANNELS: Channel[] = [
  "organic_creator",
  "organic_brand",
  "paid_social",
  "whitelisting",
  "website",
];

const TERRITORIES: Territory[] = ["se", "norden", "eu", "global"];

/** Vanliga licenslängder, så att det normala fallet blir ett klick. */
const PRESETS = [3, 6, 12, 24];

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d);
  // Den 31 januari plus en månad finns inte, och blir då 3 mars om man inte
  // hejdar den. Sista dagen i målmånaden är det svaret alla faktiskt menar.
  if (date.getDate() !== d) date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(
    1,
    Math.round((b.getTime() - a.getTime()) / (30.44 * 86_400_000)),
  );
}

/**
 * Rättighetsformuläret. Det här är formuläret hela appen står och faller med:
 * utan det kan utgångsradarn, exklusivitetsvakten och lagret aldrig få data,
 * och då är rättighetsmotorn bara en tom vy.
 *
 * Två saker sker medan du fyller i. Prislistan räknar löpande vad de valda
 * rättigheterna är värda, så att avgiften inte blir en gissning. Och väljer du
 * en bransch där någon annan redan har exklusivitet säger formuläret ifrån
 * direkt, i stället för att låta dig upptäcka det när avtalet redan är brutet.
 */
export function LicenseForm({
  pitchId,
  brandId,
  deliverables,
  initial,
  busy,
  onSubmit,
}: {
  pitchId: string;
  brandId: string;
  deliverables: Deliverable[];
  initial?: License;
  busy: boolean;
  onSubmit: (draft: LicenseDraft) => void;
}) {
  const { data: settings } = useSettings();
  const today = new Date().toISOString().slice(0, 10);

  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? today);
  const [perpetual, setPerpetual] = useState(initial?.perpetual ?? false);
  const [months, setMonths] = useState(() =>
    initial?.ends_on ? monthsBetween(initial.starts_on, initial.ends_on) : 12,
  );
  const [channels, setChannels] = useState<Channel[]>(
    initial?.channels ?? ["organic_creator", "organic_brand"],
  );
  const [territory, setTerritory] = useState<Territory>(initial?.territory ?? "se");
  const [deliverableId, setDeliverableId] = useState<string>(initial?.deliverable_id ?? "");
  const [exclusiveCategory, setExclusiveCategory] = useState(initial?.exclusive_category ?? "");
  const [exclusivityEndsOn, setExclusivityEndsOn] = useState(initial?.exclusivity_ends_on ?? "");
  const [includesRawFiles, setIncludesRawFiles] = useState(initial?.includes_raw_files ?? false);
  const [fee, setFee] = useState<number | null>(initial?.fee_sek ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const endsOn = perpetual ? null : addMonths(startsOn, months);

  // Exklusivitetsvakten: har nagon ANNAN kund redan bundit upp branschen?
  const conflicts = useExclusivityGuard(exclusiveCategory, startsOn, brandId);

  const suggestion = useMemo(() => {
    if (!settings) return null;
    const chosen = deliverableId
      ? deliverables.filter((d) => d.id === deliverableId)
      : deliverables;
    if (chosen.length === 0) return null;

    return computePrice(
      {
        deliverables: chosen.map((d) => ({ format: d.format, quantity: d.quantity })),
        channels,
        territory,
        durationMonths: perpetual ? null : months,
        exclusiveCategory: exclusiveCategory.trim() !== "",
        includesRawFiles,
        rush: false,
      },
      settings,
    );
  }, [
    settings,
    deliverables,
    deliverableId,
    channels,
    territory,
    perpetual,
    months,
    exclusiveCategory,
    includesRawFiles,
  ]);

  function toggleChannel(c: Channel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          pitch_id: pitchId,
          brand_id: brandId,
          deliverable_id: deliverableId || null,
          channels,
          territory,
          starts_on: startsOn,
          ends_on: endsOn,
          perpetual,
          exclusive_category: exclusiveCategory.trim() || null,
          exclusivity_ends_on: exclusiveCategory.trim() ? exclusivityEndsOn || endsOn : null,
          includes_raw_files: includesRawFiles,
          fee_sek: fee,
          notes: notes.trim() || null,
        });
      }}
    >
      {deliverables.length > 0 && (
        <Field
          label="Vad licensen gäller"
          hint="Lämna på hela uppdraget om rättigheterna är desamma för allt du levererar."
        >
          <Select value={deliverableId} onChange={(e) => setDeliverableId(e.target.value)}>
            <option value="">Hela uppdraget</option>
            {deliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">
          Var får materialet användas
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <Checkbox
              key={c}
              label={CHANNEL_LABEL[c]}
              checked={channels.includes(c)}
              onChange={() => toggleChannel(c)}
            />
          ))}
        </div>
      </fieldset>

      <Field label="Marknad">
        <Select value={territory} onChange={(e) => setTerritory(e.target.value as Territory)}>
          {TERRITORIES.map((t) => (
            <option key={t} value={t}>
              {TERRITORY_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
        <div className="flex items-center gap-2 text-on-surface">
          <Icon name="schedule" size={18} className="text-primary" />
          <span className="text-label-caps uppercase">Klockan</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Startar">
            <Input
              type="date"
              required
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
            />
          </Field>
          {!perpetual && (
            <Field label="Antal månader">
              <Input
                type="number"
                min={1}
                max={240}
                required
                value={months}
                onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
          )}
        </div>

        {!perpetual && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={
                  months === m
                    ? "rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary"
                    : "rounded-full border border-outline-variant/60 px-4 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
                }
              >
                {m} mån
              </button>
            ))}
          </div>
        )}

        <Checkbox
          label="Evig licens, de får använda materialet för alltid"
          checked={perpetual}
          onChange={setPerpetual}
        />

        <p className="text-body-md text-on-surface-variant">
          {perpetual ? (
            <>
              Då tickar ingen klocka alls, materialet kan aldrig säljas igen, och avgiften behöver
              täcka det du ger bort för alltid.
            </>
          ) : (
            <>
              Går ut <strong className="text-on-surface">{formatDateFull(endsOn)}</strong>, och då
              hamnar den på utgångsradarn {days(settings?.renewal_lead_days ?? 30)} i förväg.
            </>
          )}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
        <div className="flex items-center gap-2 text-on-surface">
          <Icon name="shield" size={18} className="text-primary" />
          <span className="text-label-caps uppercase">Exklusivitet</span>
        </div>

        <Field
          label="Bransch du lovar att avstå"
          hint="Lämna tomt om du får jobba med konkurrenter under tiden."
        >
          <Input
            value={exclusiveCategory}
            onChange={(e) => setExclusiveCategory(e.target.value)}
            placeholder="hudvård"
          />
        </Field>

        {exclusiveCategory.trim() !== "" && (
          <Field
            label="Exklusiviteten gäller till"
            hint="Ofta längre än själva användningsrätten. Lämnas den tom används licensens slutdatum."
          >
            <Input
              type="date"
              value={exclusivityEndsOn}
              onChange={(e) => setExclusivityEndsOn(e.target.value)}
            />
          </Field>
        )}

        {conflicts.length > 0 && (
          <div className="space-y-2">
            {conflicts.map((c) => (
              <div
                key={c.license.id}
                className="flex items-start gap-3 rounded-lg bg-error-container px-4 py-3 text-on-error-container"
              >
                <Icon name="warning" filled size={18} />
                <p className="text-body-md">
                  Du är redan bunden inom {c.category} till {formatDateFull(c.endsOn)}, alltså{" "}
                  {days(c.daysLeft)} till. Registrerar du den här också lovar du samma sak till två
                  kunder samtidigt.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Checkbox
        label="Råmaterialet ingår, de får klippa om själva"
        checked={includesRawFiles}
        onChange={setIncludesRawFiles}
      />

      <Field label="Licensavgift, kronor exklusive moms">
        <Input
          type="number"
          min={0}
          step={100}
          value={fee ?? ""}
          onChange={(e) => setFee(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="0"
        />
      </Field>

      {suggestion && suggestion.total > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary-container/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label-caps uppercase text-on-primary-container">
                Prislistan säger
              </p>
              <p className="mt-1 font-mono text-2xl text-on-primary-container">
                {formatMoney(suggestion.total)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0"
              onClick={() => setFee(suggestion.total)}
            >
              Använd
            </Button>
          </div>
          <ul className="mt-3 space-y-1">
            {suggestion.lines.map((l) => (
              <li
                key={l.label}
                className="flex justify-between gap-3 text-body-md text-on-primary-container/90"
              >
                <span>{l.label}</span>
                <span className="font-mono">{formatMoney(Math.round(l.amount))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-on-primary-container/80">
            Av det är {formatMoney(Math.round(suggestion.total - suggestion.base))} betalt för
            rättigheterna, inte för produktionen.
          </p>
        </div>
      )}

      <Field label="Anteckning">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Får inte användas i kampanjer riktade mot minderåriga"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2 text-body-md text-on-surface-variant">
        <Badge tone={perpetual ? "info" : "neutral"}>
          {perpetual ? "Evig" : `${months} mån`}
        </Badge>
        <Badge>{TERRITORY_LABEL[territory]}</Badge>
        {channels.length > 0 && <Badge>{plural(channels.length, "kanal", "kanaler")}</Badge>}
        {exclusiveCategory.trim() && <Badge tone="warn">Exklusivt</Badge>}
      </div>

      <Button type="submit" disabled={busy || channels.length === 0} className="w-full">
        {busy ? "Sparar..." : initial ? "Spara ändringen" : "Registrera rättigheterna"}
      </Button>
      {channels.length === 0 && (
        <p className="text-center text-xs text-error">
          Välj minst en kanal, annars finns det ingen rättighet att bevaka.
        </p>
      )}
    </form>
  );
}
