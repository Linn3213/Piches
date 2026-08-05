import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBrands, useCreateBrand } from "@/hooks/useBrands";
import { useCreatePitch } from "@/hooks/usePitches";
import { useCreateDeliverable } from "@/hooks/useDeliverables";
import { useExclusivityGuard } from "@/hooks/useLicenses";
import { useSettings } from "@/hooks/useSettings";
import { extractBrief } from "@/lib/brief";
import { computePrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import { CHANNEL_LABEL, FORMAT_LABEL, TERRITORY_LABEL } from "@/types/db";
import { Badge, Button, Card, Field, Icon, Input, Select, Textarea } from "@/components/ui";

/**
 * Brief-läsaren.
 *
 * Klistra in förfrågan som den kom, så plockas leverabler, rättigheter,
 * budget och deadline ut, och priset räknas på det innan du svarar. Poängen
 * är inte att spara inskrivningstid utan att rättigheterna aldrig ska hinna
 * falla bort ur kalkylen, eftersom det är där pengarna finns och det är den
 * posten som glöms när man prissätter i huvudet.
 *
 * Ingenting sparas förrän du tryckt på knappen. Det som inte gick att läsa ut
 * listas öppet i stället för att gissas fram.
 */
export function BriefImport({ onClose }: { onClose: () => void }) {
  const { data: brands } = useBrands();
  const { data: settings } = useSettings();
  const createBrand = useCreateBrand();
  const createPitch = useCreatePitch();
  const createDeliverable = useCreateDeliverable();
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [brandId, setBrandId] = useState("");
  const [nyttVarumarke, setNyttVarumarke] = useState("");
  const [busy, setBusy] = useState(false);

  const brief = useMemo(() => (text.trim() ? extractBrief(text, new Date()) : null), [text]);

  const konflikter = useExclusivityGuard(
    brief?.exclusiveCategory ?? "",
    new Date().toISOString().slice(0, 10),
    brandId || undefined,
  );

  const pris = useMemo(() => {
    if (!brief || !settings || brief.deliverables.length === 0) return null;
    return computePrice(
      {
        deliverables: brief.deliverables,
        channels: brief.channels,
        territory: brief.territory ?? "se",
        durationMonths: brief.perpetual ? null : brief.durationMonths,
        exclusiveCategory: Boolean(brief.exclusiveCategory),
        includesRawFiles: brief.includesRawFiles,
        rush: brief.rush,
      },
      settings,
    );
  }, [brief, settings]);

  const budgetGap =
    pris && brief?.budgetSek !== null && brief?.budgetSek !== undefined
      ? brief.budgetSek - pris.total
      : null;

  async function skapa() {
    if (!brief) return;
    setBusy(true);
    try {
      let malBrandId = brandId;
      if (!malBrandId) {
        const namn = nyttVarumarke.trim();
        if (!namn) return;
        const b = await createBrand.mutateAsync({ name: namn, status: "svarat" });
        malBrandId = b.id;
      }

      const pitch = await createPitch.mutateAsync({
        brand_id: malBrandId,
        status: "svarat",
        channel: "mejl",
        subject: "Förfrågan",
        observation: text.trim().slice(0, 2000),
        value_sek: pris?.total ?? brief.budgetSek ?? null,
        sent_at: null,
      });

      for (const d of brief.deliverables) {
        await createDeliverable.mutateAsync({
          pitch_id: pitch.id,
          brand_id: malBrandId,
          title: `${d.quantity} ${FORMAT_LABEL[d.format].toLowerCase()}`,
          format: d.format,
          quantity: d.quantity,
        });
      }

      onClose();
      navigate(`/uppdrag/${pitch.id}`);
    } finally {
      setBusy(false);
    }
  }

  const kanSkapa = Boolean(brief) && (brandId !== "" || nyttVarumarke.trim() !== "");

  return (
    <div className="space-y-5">
      <Field
        label="Klistra in förfrågan"
        hint="Hela mejlet eller meddelandet som det kom. Ingenting sparas förrän du väljer att skapa uppdraget."
      >
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-40"
          placeholder="Hej! Vi lanserar vår nya serie i höst och tänker oss 3 videos som vi kan använda i våra egna kanaler och för annonsering i Norden under 6 månader..."
        />
      </Field>

      {brief && (
        <>
          {konflikter.length > 0 && (
            <div className="space-y-2">
              {konflikter.map((c) => (
                <div
                  key={c.license.id}
                  className="flex items-start gap-3 rounded-lg bg-error-container px-4 py-3 text-on-error-container"
                >
                  <Icon name="warning" filled size={18} />
                  <p className="text-body-md">
                    Du är redan bunden inom {c.category} i {c.daysLeft} dagar till. Tackar du ja till
                    det här bryter du det avtalet.
                  </p>
                </div>
              ))}
            </div>
          )}

          <Card className="space-y-4">
            <p className="text-label-caps uppercase text-on-surface-variant">Det här står i texten</p>

            <div className="flex flex-wrap gap-1.5">
              {brief.deliverables.map((d) => (
                <Badge key={d.format} tone="primary">
                  {d.quantity} {FORMAT_LABEL[d.format]}
                </Badge>
              ))}
              {brief.channels.map((c) => (
                <Badge key={c}>{CHANNEL_LABEL[c]}</Badge>
              ))}
              {brief.territory && <Badge>{TERRITORY_LABEL[brief.territory]}</Badge>}
              {brief.perpetual ? (
                <Badge tone="danger">Evig licens</Badge>
              ) : brief.durationMonths ? (
                <Badge>{brief.durationMonths} mån</Badge>
              ) : null}
              {brief.exclusiveCategory && (
                <Badge tone="warn">Exklusivt inom {brief.exclusiveCategory}</Badge>
              )}
              {brief.includesRawFiles && <Badge>Råmaterial</Badge>}
              {brief.deadline && <Badge>Deadline {brief.deadline}</Badge>}
              {brief.budgetSek !== null && (
                <Badge tone="info">Budget {formatMoney(brief.budgetSek)}</Badge>
              )}
            </div>

            {brief.missing.length > 0 && (
              <div>
                <p className="text-body-md text-on-surface-variant">
                  Det här stod inte i texten, och du behöver fråga eller fylla i det själv:
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {brief.missing.map((m) => (
                    <li key={m}>
                      <Badge tone="neutral">{m}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {brief.flags.length > 0 && (
            <Card className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="flag" size={18} className="text-primary" />
                <p className="text-label-caps uppercase text-on-surface-variant">
                  Värt att läsa en gång till
                </p>
              </div>
              <ul className="space-y-2.5">
                {brief.flags.map((f) => (
                  <li key={f.match} className="flex gap-3">
                    <span
                      className={
                        f.severity === "hog"
                          ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-error"
                          : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sand"
                      }
                    />
                    <p className="text-body-md text-on-surface-variant">
                      <span className="text-on-surface">{f.match}</span> {f.why}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {pris && pris.total > 0 && (
            <Card className="space-y-3 border border-primary/30 bg-primary-container/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-label-caps uppercase text-on-primary-container">
                    Prislistan säger
                  </p>
                  <p className="mt-1 font-mono text-3xl text-on-primary-container">
                    {formatMoney(pris.total)}
                  </p>
                  <p className="mt-1 text-body-md text-on-primary-container/85">
                    Varav {formatMoney(Math.round(pris.total - pris.base))} för rättigheterna.
                  </p>
                </div>
                {budgetGap !== null && (
                  <div className="shrink-0 text-right">
                    <p className="text-label-caps uppercase text-on-primary-container">
                      Mot deras budget
                    </p>
                    <p
                      className={
                        budgetGap < 0
                          ? "mt-1 font-mono text-2xl text-error"
                          : "mt-1 font-mono text-2xl text-on-primary-container"
                      }
                    >
                      {budgetGap >= 0 ? "+" : ""}
                      {formatMoney(budgetGap)}
                    </p>
                  </div>
                )}
              </div>
              {budgetGap !== null && budgetGap < 0 && (
                <p className="text-body-md text-on-primary-container">
                  Deras budget ligger under vad rättigheterna är värda enligt din prislista. Antingen
                  förhandlar du priset uppåt, eller så skalar du ner rättigheterna, till exempel
                  kortare licenstid eller utan annonsering.
                </p>
              )}
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Koppla till varumärke">
              <Select
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  if (e.target.value) setNyttVarumarke("");
                }}
              >
                <option value="">Nytt varumärke</option>
                {(brands ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            {!brandId && (
              <Field label="Namn på varumärket">
                <Input
                  value={nyttVarumarke}
                  onChange={(e) => setNyttVarumarke(e.target.value)}
                  placeholder="Verso Skincare"
                />
              </Field>
            )}
          </div>

          <Button onClick={skapa} disabled={!kanSkapa || busy} className="w-full">
            {busy ? "Skapar..." : "Skapa uppdrag av förfrågan"}
          </Button>
        </>
      )}
    </div>
  );
}
