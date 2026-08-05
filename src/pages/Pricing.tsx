import { useMemo, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { computePrice, type PricingInput } from "@/lib/pricing";
import {
  CHANNEL_LABEL,
  FORMAT_LABEL,
  TERRITORY_LABEL,
  type Channel,
  type DeliverableFormat,
  type Territory,
} from "@/types/db";
import { formatMoney } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Icon,
  Input,
  Loading,
  PageHeader,
  Select,
} from "@/components/ui";

const FORMATS: DeliverableFormat[] = ["video", "reel", "tiktok", "ugc_ad", "foto", "story"];
const CHANNELS: Channel[] = [
  "organic_creator",
  "organic_brand",
  "paid_social",
  "whitelisting",
  "website",
];

/**
 * Prisräknaren. Poängen är inte siffran utan uppdelningen: du ser exakt
 * hur mycket av priset som är produktion och hur mycket som är rättigheter,
 * så att du kan motivera det för kunden i stället för att gissa.
 */
export default function Pricing() {
  const { data: settings, isLoading } = useSettings();

  const [rows, setRows] = useState<{ format: DeliverableFormat; quantity: number }[]>([
    { format: "video", quantity: 1 },
  ]);
  const [channels, setChannels] = useState<Channel[]>(["organic_creator"]);
  const [territory, setTerritory] = useState<Territory>("se");
  const [months, setMonths] = useState(3);
  const [perpetual, setPerpetual] = useState(false);
  const [exclusive, setExclusive] = useState(false);
  const [rawFiles, setRawFiles] = useState(false);
  const [rush, setRush] = useState(false);

  const input: PricingInput = useMemo(
    () => ({
      deliverables: rows,
      channels,
      territory,
      durationMonths: perpetual ? null : months,
      exclusiveCategory: exclusive,
      includesRawFiles: rawFiles,
      rush,
    }),
    [rows, channels, territory, months, perpetual, exclusive, rawFiles, rush],
  );

  const result = useMemo(
    () => (settings ? computePrice(input, settings) : null),
    [input, settings],
  );

  if (isLoading || !settings || !result) return <Loading />;

  const rightsShare =
    result.total > 0 ? Math.round(((result.total - result.base) / result.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Prisräknare"
        subtitle="Priset är rättigheterna och inte bara produktionen, och här ser du exakt hur mycket av summan som är vad."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Underlag */}
        <div className="space-y-5 lg:col-span-3">
          <Card className="space-y-4">
            <h2 className="text-headline-sm">Det du levererar</h2>
            {rows.map((row, i) => (
              <div key={i} className="flex gap-3">
                <Select
                  className="flex-1"
                  value={row.format}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, j) =>
                        j === i ? { ...r, format: e.target.value as DeliverableFormat } : r,
                      ),
                    )
                  }
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABEL[f]}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={row.quantity}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, j) =>
                        j === i ? { ...r, quantity: Math.max(1, Number(e.target.value)) } : r,
                      ),
                    )
                  }
                />
                {rows.length > 1 && (
                  <button
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Ta bort rad"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
                  >
                    <Icon name="close" />
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              onClick={() => setRows((prev) => [...prev, { format: "foto", quantity: 1 }])}
            >
              <Icon name="add" size={18} /> Lägg till
            </Button>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-headline-sm">Var får materialet användas</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map((c) => (
                <Checkbox
                  key={c}
                  label={CHANNEL_LABEL[c]}
                  checked={channels.includes(c)}
                  onChange={(on) =>
                    setChannels((prev) => (on ? [...prev, c] : prev.filter((x) => x !== c)))
                  }
                />
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marknad">
                <Select value={territory} onChange={(e) => setTerritory(e.target.value as Territory)}>
                  {(Object.keys(TERRITORY_LABEL) as Territory[]).map((t) => (
                    <option key={t} value={t}>
                      {TERRITORY_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Licenslängd, månader">
                <Input
                  type="number"
                  min={1}
                  value={months}
                  disabled={perpetual}
                  onChange={(e) => setMonths(Math.max(1, Number(e.target.value)))}
                />
              </Field>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="Evig licens" checked={perpetual} onChange={setPerpetual} />
              <Checkbox label="Branschexklusivitet" checked={exclusive} onChange={setExclusive} />
              <Checkbox label="Råmaterial ingår" checked={rawFiles} onChange={setRawFiles} />
              <Checkbox label="Expressleverans" checked={rush} onChange={setRush} />
            </div>
          </Card>
        </div>

        {/* Uträkningen */}
        <div className="lg:col-span-2">
          <Card className="glass sticky top-6 space-y-5 border-l-2 border-l-primary">
            <div className="flex items-center gap-2 text-primary">
              <Icon name="calculate" />
              <h2 className="text-label-caps uppercase">Så räknar vi</h2>
            </div>

            <ul className="space-y-3">
              {result.lines.map((line, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body-md font-semibold text-on-surface">{line.label}</p>
                    <p className="text-xs text-on-surface-variant">{line.detail}</p>
                  </div>
                  <span className="shrink-0 font-mono text-mono-data text-on-surface">
                    {formatMoney(Math.round(line.amount))}
                  </span>
                </li>
              ))}
            </ul>

            <div className="rounded-lg bg-primary-container/40 p-4">
              <div className="flex items-end justify-between">
                <span className="text-label-caps uppercase text-on-primary-container">
                  Föreslaget pris
                </span>
                <span className="font-mono text-2xl font-medium text-primary">
                  {formatMoney(result.total)}
                </span>
              </div>
              {result.total > 0 && (
                <p className="mt-2 text-xs text-on-primary-container/80">
                  {rightsShare}% av priset är rättigheter, inte produktion.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {perpetual && <Badge tone="warn">Du kan aldrig sälja om materialet</Badge>}
              {exclusive && <Badge tone="warn">Du tackar nej till konkurrenter</Badge>}
            </div>

            <p className="text-xs text-on-surface-variant/70">
              Procentsatserna kommer från din egen prislista och är startvärden att justera när du
              lärt dig vad marknaden betalar.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
