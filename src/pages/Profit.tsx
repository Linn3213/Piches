import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBrands } from "@/hooks/useBrands";
import { usePitches } from "@/hooks/usePitches";
import { useLicenses } from "@/hooks/useLicenses";
import { useSettings } from "@/hooks/useSettings";
import { useCreateProduct, useDeleteProduct, useProducts, useUpdateProduct } from "@/hooks/useProducts";
import { actualHourlyRate, findLeaks, monthlyGoal, slowPayers, type Leak } from "@/lib/profit";
import {
  CONVERSION_BENCHMARKS,
  forecastFromProduct,
  forecastProduct,
  suggestProducts,
  type ProductTemplate,
} from "@/lib/product";
import { days, formatMoney, plural } from "@/lib/format";
import {
  PRODUCT_KIND_LABEL,
  PRODUCT_STATUS_LABEL,
  type Product,
  type ProductStatus,
} from "@/types/db";
import {
  Badge, Button, Card, Empty, Field, Icon, Input, Loading, Modal, PageHeader, Select, Stat,
} from "@/components/ui";

/**
 * Lönsamhetssidan.
 *
 * Alla andra vyer i appen svarar på vad som händer. Den här svarar på om det
 * går bra, vilket är en annan fråga: omsättning kan växa samtidigt som du
 * tjänar mindre per timme, och då är tillväxten en försämring.
 *
 * Sidan gör tre saker. Den letar upp var pengarna läcker och sätter en siffra
 * på varje läcka, den räknar vägen till månadsmålet i uppdrag och timmar i
 * stället för i procent, och den räknar på digitala produkter mot vad samma
 * tid hade gett som vanliga uppdrag.
 */
export default function Profit() {
  const { data: pitches, isLoading } = usePitches();
  const { data: brands } = useBrands();
  const { data: licenses } = useLicenses();
  const { data: settings } = useSettings();
  const { data: products } = useProducts();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();

  const [raknarePa, setRaknarePa] = useState<ProductTemplate | null>(null);

  const timpenning = useMemo(() => actualHourlyRate(pitches ?? []), [pitches]);

  const leaks = useMemo(() => {
    if (!settings) return [];
    return findLeaks({
      pitches: pitches ?? [],
      brands: brands ?? [],
      licenses: licenses ?? [],
      settings,
      today: new Date(),
    });
  }, [pitches, brands, licenses, settings]);

  const mal = useMemo(
    () => (settings ? monthlyGoal(pitches ?? [], settings, new Date()) : null),
    [pitches, settings],
  );

  const langsamma = useMemo(
    () => slowPayers(pitches ?? [], brands ?? []).filter((r) => r.avgDays > 30),
    [pitches, brands],
  );

  const forslag = useMemo(
    () => (settings ? suggestProducts(settings, timpenning) : []),
    [settings, timpenning],
  );

  if (isLoading || !settings || !mal) return <Loading />;

  const laktSumma = leaks.reduce((s, l) => s + (l.amountSek ?? 0), 0);
  const harPublik = Math.max(settings.audience_size, settings.email_list_size) > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lönsamhet"
        subtitle="Omsättning säger inte om det går bra. Timpenningen gör det, och den visar var pengarna läcker ut."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Din timpenning"
          value={timpenning === null ? "–" : formatMoney(Math.round(timpenning))}
          sub={`målet är ${formatMoney(settings.target_hourly_rate)}`}
          icon="schedule"
          tone={timpenning !== null && timpenning < settings.target_hourly_rate ? "danger" : "primary"}
        />
        <Stat
          label="Läcker just nu"
          value={laktSumma > 0 ? formatMoney(laktSumma) : "–"}
          sub={leaks.length > 0 ? plural(leaks.length, "läcka hittad", "läckor hittade") : "inget hittat"}
          icon="water_drop"
          tone={laktSumma > 0 ? "danger" : undefined}
        />
        <Stat
          label="Kvar, mot förra månaden"
          value={mal.gap > 0 ? formatMoney(mal.gap) : "nått"}
          sub={
            mal.dealsNeeded !== null && mal.gap > 0
              ? `ungefär ${plural(mal.dealsNeeded, "uppdrag", "uppdrag")} till`
              : `målet är ${formatMoney(mal.target)}`
          }
          icon="flag"
        />
        <Stat
          label="Produkter"
          value={String(products?.length ?? 0)}
          sub="som säljer utan din tid"
          icon="inventory_2"
          tone={(products?.length ?? 0) > 0 ? "primary" : undefined}
        />
      </div>

      {/* Läckorna ---------------------------------------------------------- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-headline-sm text-on-surface">Var pengarna tar vägen</h2>
          <p className="max-w-prose text-body-md text-on-surface-variant">
            Varje rad har ett belopp, eftersom en läcka utan siffra går att skjuta upp hur länge
            som helst.
          </p>
        </div>

        {leaks.length === 0 ? (
          <Empty
            icon="check_circle"
            title="Inget läcker just nu"
            hint="Ingen kund ligger under din måltimpenning, inga fakturor är sena och alla leveranser har registrerade rättigheter."
          />
        ) : (
          <ul className="space-y-3">
            {leaks.map((l, i) => (
              <li key={`${l.kind}-${i}`}>
                <LeakCard leak={l} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Vägen till målet -------------------------------------------------- */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-headline-sm text-on-surface">Vägen till målet</h2>
          <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
            Räknat på förra hela månadens inbetalningar, ditt snittordervärde och din faktiska
            timpenning.
          </p>
        </div>

        {mal.gap === 0 ? (
          <p className="text-body-md text-on-surface">
            Du ligger på {formatMoney(mal.current)} mot målet {formatMoney(mal.target)}, alltså är
            målet nått. Höj det, eller lägg tiden på en produkt i stället.
          </p>
        ) : (
          <>
            <div className="h-3 overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (mal.current / mal.target) * 100)}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <p className="text-label-caps uppercase text-on-surface-variant">Inne</p>
                <p className="mt-1 font-mono text-2xl text-on-surface">{formatMoney(mal.current)}</p>
              </div>
              <div>
                <p className="text-label-caps uppercase text-on-surface-variant">Kvar</p>
                <p className="mt-1 font-mono text-2xl text-on-surface">{formatMoney(mal.gap)}</p>
              </div>
              {mal.dealsNeeded !== null && (
                <div>
                  <p className="text-label-caps uppercase text-on-surface-variant">Uppdrag till</p>
                  <p className="mt-1 font-mono text-2xl text-on-surface">{mal.dealsNeeded}</p>
                </div>
              )}
              {mal.hoursNeeded !== null && (
                <div>
                  <p className="text-label-caps uppercase text-on-surface-variant">Timmar</p>
                  <p className="mt-1 font-mono text-2xl text-on-surface">
                    {Math.round(mal.hoursNeeded)}
                  </p>
                </div>
              )}
            </div>
            {mal.feasible === false && (
              <p className="max-w-prose text-body-md text-error">
                Gapet motsvarar fler timmar än en månad rymmer. Det går alltså inte att jobba ikapp,
                utan priset behöver upp eller så behöver en del av intäkten komma från något som
                inte kostar din tid.
              </p>
            )}
          </>
        )}
      </Card>

      {langsamma.length > 0 && (
        <Card>
          <h2 className="text-headline-sm text-on-surface">Kunder som drar ut på betalningen</h2>
          <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
            Din betalningsfrist är {days(settings.payment_terms_days)}. De här tar längre tid, och
            varje extra vecka är pengar du redan tjänat men inte kan använda.
          </p>
          <ul className="mt-4 space-y-2">
            {langsamma.map((r) => (
              <li key={r.brandId} className="flex items-center justify-between gap-3">
                <Link to={`/varumarken/${r.brandId}`} className="text-body-md text-on-surface hover:underline">
                  {r.name}
                </Link>
                <Badge tone={r.avgDays > 60 ? "danger" : "warn"}>
                  {days(Math.round(r.avgDays))} i snitt
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Produktmotorn ------------------------------------------------------ */}
      <section className="space-y-4">
        <div>
          <h2 className="text-headline-sm text-on-surface">Sälj något som inte kostar din tid</h2>
          <p className="max-w-prose text-body-md text-on-surface-variant">
            Ett uppdrag betalas en gång. En produkt betalas varje gång någon köper den, och det är
            hela skillnaden mellan att sälja timmar och att bygga något som säljer medan du gör
            annat.
          </p>
        </div>

        {!harPublik ? (
          <Empty
            icon="groups"
            title="Fyll i hur många som ser dig"
            hint="Utan publik går det inte att räkna på hur många som skulle köpa. Ange antal följare och hur många som står på din lista under Inställningar."
            action={
              <Link to="/installningar">
                <Button>Till inställningar</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {forslag.slice(0, 4).map((s) => (
                <Card key={s.template.kind} className="flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-headline-sm text-on-surface">{s.template.label}</p>
                      {s.forecast.beatsFreelance && (
                        <Badge tone="primary">Slår dina uppdrag</Badge>
                      )}
                    </div>
                    <p className="mt-2 max-w-prose text-body-md text-on-surface-variant">
                      {s.reason}
                    </p>
                    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                      <div>
                        <dt className="text-xs text-on-surface-variant">Pris</dt>
                        <dd className="font-mono text-mono-data text-on-surface">
                          {formatMoney(s.suggestedPrice)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-on-surface-variant">På ett år</dt>
                        <dd className="font-mono text-mono-data text-on-surface">
                          {formatMoney(Math.round(s.forecast.net))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-on-surface-variant">Per timme</dt>
                        <dd className="font-mono text-mono-data text-on-surface">
                          {s.forecast.hourlyRate === null
                            ? "–"
                            : formatMoney(Math.round(s.forecast.hourlyRate))}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <Button variant="ghost" onClick={() => setRaknarePa(s.template)}>
                    Räkna på den
                  </Button>
                </Card>
              ))}
            </div>

            <p className="text-xs text-on-surface-variant/70">
              Siffrorna bygger på en publik om{" "}
              {Math.max(settings.audience_size, settings.email_list_size).toLocaleString("sv-SE")}{" "}
              och vad som är vanligt i branschen. De är utgångspunkter att justera så fort du har
              egna utfall.
            </p>
          </>
        )}

        {(products?.length ?? 0) > 0 && (
          <ul className="space-y-3">
            {(products ?? []).map((p) => (
              <li key={p.id}>
                <ProductRow
                  product={p}
                  forecast={forecastFromProduct(p, settings, timpenning)}
                  onUpdate={(patch) => updateProduct.mutate({ id: p.id, patch })}
                  onDelete={() => {
                    if (confirm(`Ta bort ${p.name}?`)) deleteProduct.mutate(p.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={raknarePa !== null}
        title={raknarePa ? `Räkna på ${raknarePa.label.toLowerCase()}` : ""}
        wide
        onClose={() => setRaknarePa(null)}
      >
        {raknarePa && settings && (
          <ProductCalculator
            template={raknarePa}
            settings={settings}
            actualHourly={timpenning}
            busy={createProduct.isPending}
            onSave={(draft) =>
              createProduct.mutate(draft, { onSuccess: () => setRaknarePa(null) })
            }
          />
        )}
      </Modal>
    </div>
  );
}

function LeakCard({ leak }: { leak: Leak }) {
  return (
    <Card className={leak.severity === "hog" ? "border-l-2 border-l-error" : ""}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-headline-sm text-on-surface">{leak.title}</p>
          <p className="mt-1.5 max-w-prose text-body-md text-on-surface-variant">{leak.why}</p>
          <p className="mt-2.5 flex items-start gap-2 max-w-prose text-body-md text-on-surface">
            <Icon name="arrow_forward" size={16} className="mt-0.5 shrink-0 text-primary" />
            {leak.action}
          </p>
        </div>
        {leak.amountSek !== null && (
          <div className="shrink-0 sm:text-right">
            <p className="text-label-caps uppercase text-on-surface-variant">Kostar dig</p>
            <p className="mt-1 font-mono text-2xl text-error">
              {formatMoney(Math.round(leak.amountSek))}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function ProductRow({
  product,
  forecast,
  onDelete,
  onUpdate,
}: {
  product: Product;
  forecast: ReturnType<typeof forecastFromProduct>;
  onDelete: () => void;
  onUpdate: (patch: { status?: ProductStatus; units_sold?: number; revenue_sek?: number }) => void;
}) {
  const [oppen, setOppen] = useState(false);
  const [salda, setSalda] = useState(String(product.units_sold || ""));
  const [intakt, setIntakt] = useState(String(product.revenue_sek || ""));

  // Utfallet slår alltid uppskattningen. Fram tills det finns är prognosen
  // det bästa vi har, men den ska aldrig konkurrera med en verklig siffra.
  const harUtfall = product.units_sold > 0 || product.revenue_sek > 0;

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-headline-sm text-on-surface">{product.name}</p>
            <Badge>{PRODUCT_KIND_LABEL[product.kind]}</Badge>
          </div>
          <p className="mt-1.5 text-body-md text-on-surface-variant">
            {formatMoney(product.price_sek)}
            {product.recurring ? " per månad" : " per köp"},{" "}
            {plural(product.build_hours, "timme", "timmar")} att bygga
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-4 sm:flex-col sm:items-end">
          <div className="sm:text-right">
            <p className="text-label-caps uppercase text-on-surface-variant">
              {harUtfall ? "Hittills" : "Uppskattat på ett år"}
            </p>
            <p className="font-mono text-xl text-on-surface">
              {harUtfall ? formatMoney(product.revenue_sek) : formatMoney(Math.round(forecast.net))}
            </p>
            {harUtfall && (
              <p className="font-mono text-[11px] text-on-surface-variant">
                {plural(product.units_sold, "såld", "sålda")}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setOppen((v) => !v)}
              aria-label="Ändra produkten"
              className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <Icon name={oppen ? "expand_less" : "edit"} size={18} />
            </button>
            <button
              onClick={onDelete}
              aria-label="Ta bort produkten"
              className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
            >
              <Icon name="delete" size={18} />
            </button>
          </div>
        </div>
      </div>

      {oppen && (
        <div className="grid gap-3 border-t border-outline-variant/30 pt-4 sm:grid-cols-3">
          <Field label="Var den står">
            <Select
              value={product.status}
              onChange={(e) => onUpdate({ status: e.target.value as ProductStatus })}
            >
              {(Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PRODUCT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Antal sålda" hint="Verkligt utfall slår uppskattningen.">
            <Input
              inputMode="numeric"
              value={salda}
              onChange={(e) => setSalda(e.target.value)}
              onBlur={() => {
                const n = Number(salda.replace(/\s/g, ""));
                if (!Number.isNaN(n) && n >= 0 && n !== product.units_sold) {
                  onUpdate({ units_sold: n });
                }
              }}
            />
          </Field>
          <Field label="Intäkt hittills, kronor">
            <Input
              inputMode="decimal"
              value={intakt}
              onChange={(e) => setIntakt(e.target.value)}
              onBlur={() => {
                const n = Number(intakt.replace(/\s/g, "").replace(",", "."));
                if (!Number.isNaN(n) && n >= 0 && n !== product.revenue_sek) {
                  onUpdate({ revenue_sek: n });
                }
              }}
            />
          </Field>
        </div>
      )}
    </Card>
  );
}

/**
 * Räknaren. Poängen är inte intäktssiffran utan jämförelsen: vad samma tid
 * hade gett som vanliga uppdrag. Ligger produkten under det är den fel sak
 * att bygga just nu, hur rolig den än verkar.
 */
function ProductCalculator({
  template,
  settings,
  actualHourly,
  busy,
  onSave,
}: {
  template: ProductTemplate;
  settings: import("@/types/db").Settings;
  actualHourly: number | null;
  busy: boolean;
  onSave: (draft: import("@/hooks/useProducts").ProductDraft) => void;
}) {
  const publik = Math.max(settings.audience_size, settings.email_list_size);
  const [namn, setNamn] = useState("");
  const [pris, setPris] = useState(Math.round((template.price[0] + template.price[1]) / 2));
  const [timmar, setTimmar] = useState(Math.round((template.buildHours[0] + template.buildHours[1]) / 2));
  const [manadstimmar, setManadstimmar] = useState(template.monthlyHours);
  const [konvertering, setKonvertering] = useState(
    settings.email_list_size >= settings.audience_size && settings.email_list_size > 0 ? 3 : 1.5,
  );

  const prognos = forecastProduct(
    {
      price: pris,
      buildHours: timmar,
      monthlyHours: manadstimmar,
      buildCost: 0,
      monthlyCost: 0,
      conversionPct: konvertering,
      recurring: template.recurring,
      audience: publik,
    },
    settings,
    actualHourly,
  );

  const jamforelse = actualHourly ?? settings.target_hourly_rate;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pris, kronor" hint={`Vanligt spann: ${template.price[0]} till ${template.price[1]}.`}>
          <Input type="number" min={0} step={50} value={pris} onChange={(e) => setPris(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Timmar att bygga" hint={`Vanligt: ${template.buildHours[0]} till ${template.buildHours[1]}.`}>
          <Input type="number" min={0} value={timmar} onChange={(e) => setTimmar(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Timmar per månad efteråt" hint="Support, uppdateringar, frågor.">
          <Input type="number" min={0} value={manadstimmar} onChange={(e) => setManadstimmar(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Andel som köper, %" hint={`Räknat på ${publik.toLocaleString("sv-SE")} personer.`}>
          <Select value={konvertering} onChange={(e) => setKonvertering(Number(e.target.value))}>
            {CONVERSION_BENCHMARKS.map((b) => (
              <option key={b.pct} value={b.pct}>
                {b.pct} %, {b.label.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Card className="space-y-4 border border-primary/30 bg-primary-container/30">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <div>
            <p className="text-label-caps uppercase text-on-primary-container">Köpare</p>
            <p className="mt-1 font-mono text-2xl text-on-primary-container">{prognos.buyers}</p>
          </div>
          <div>
            <p className="text-label-caps uppercase text-on-primary-container">På ett år</p>
            <p className="mt-1 font-mono text-2xl text-on-primary-container">
              {formatMoney(Math.round(prognos.net))}
            </p>
          </div>
          <div>
            <p className="text-label-caps uppercase text-on-primary-container">Per timme</p>
            <p className="mt-1 font-mono text-2xl text-on-primary-container">
              {prognos.hourlyRate === null ? "–" : formatMoney(Math.round(prognos.hourlyRate))}
            </p>
          </div>
          {prognos.breakEvenUnits !== null && (
            <div>
              <p className="text-label-caps uppercase text-on-primary-container">
                Sålda för att gå jämnt ut
              </p>
              <p className="mt-1 font-mono text-2xl text-on-primary-container">
                {prognos.breakEvenUnits}
              </p>
            </div>
          )}
        </div>

        <p className="max-w-prose text-body-md text-on-primary-container">
          {prognos.beatsFreelance
            ? `Samma ${timmar} timmar som uppdrag hade gett ungefär ${formatMoney(Math.round(timmar * jamforelse))}. Produkten ger mer, och fortsätter dessutom sälja efter att den är byggd.`
            : `Samma ${timmar} timmar som uppdrag hade gett ungefär ${formatMoney(Math.round(timmar * jamforelse))}, alltså mer än produkten. Höj priset, nå fler, eller bygg något som tar färre timmar först.`}
        </p>
      </Card>

      <Field label="Namn på produkten">
        <Input
          value={namn}
          onChange={(e) => setNamn(e.target.value)}
          placeholder="Kom igång med UGC på 30 dagar"
        />
      </Field>

      <Button
        className="w-full"
        disabled={busy || !namn.trim()}
        onClick={() =>
          onSave({
            name: namn.trim(),
            kind: template.kind,
            status: "ide",
            price_sek: pris,
            build_hours: timmar,
            monthly_hours: manadstimmar,
            conversion_pct: konvertering,
            recurring: template.recurring,
          })
        }
      >
        {busy ? "Sparar..." : "Spara som idé"}
      </Button>
    </div>
  );
}

