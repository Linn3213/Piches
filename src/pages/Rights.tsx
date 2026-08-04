import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBrands } from "@/hooks/useBrands";
import { useDeliverables } from "@/hooks/useDeliverables";
import { useExpiryRadar, useLicenses } from "@/hooks/useLicenses";
import { useSettings } from "@/hooks/useSettings";
import { CHANNEL_LABEL, TERRITORY_LABEL, type License } from "@/types/db";
import { daysUntilExpiry, exclusivityConflicts, parseDate } from "@/lib/rights";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge, Card, Empty, Icon, Input, Loading, PageHeader, Stat } from "@/components/ui";

/**
 * Rättighetsvyn. Det här är det ingen annan creator-app gör: den behandlar
 * varje leverans som en licens med en klocka, inte som en avklarad uppgift.
 */
export default function Rights() {
  const { data: radar, isLoading } = useExpiryRadar();
  const { data: licenses } = useLicenses();
  const { data: brands } = useBrands();
  const { data: deliverables } = useDeliverables();
  const { data: settings } = useSettings();
  const [checkCategory, setCheckCategory] = useState("");

  const brandName = (id: string) => brands?.find((b) => b.id === id)?.name ?? "Okänt varumärke";
  const deliverableTitle = (id: string | null) =>
    id ? (deliverables?.find((d) => d.id === id)?.title ?? "Leverabel") : "Hela uppdraget";

  const conflicts = useMemo(() => {
    if (!licenses || !checkCategory.trim()) return [];
    return exclusivityConflicts(licenses, checkCategory, new Date());
  }, [licenses, checkCategory]);

  const lockedValue = useMemo(
    () => (radar?.expiring ?? []).reduce((sum, l) => sum + (l.fee_sek ?? 0), 0),
    [radar],
  );

  if (isLoading || !radar) return <Loading />;

  const hasAnything = (licenses?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Rättigheter"
        subtitle={`Varje licens har en klocka. Bevakningsfönster: ${radar.leadDays} dagar.`}
      />

      {!hasAnything ? (
        <Empty
          icon="gavel"
          title="Inga licenser registrerade än"
          hint="Registrera rättigheterna på ett uppdrag så börjar klockan ticka, och du får en påminnelse innan de går ut."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label="Går ut snart"
              value={String(radar.expiring.length)}
              sub={`inom ${radar.leadDays} dagar`}
              icon="alarm"
              tone={radar.expiring.length > 0 ? "danger" : undefined}
            />
            <Stat
              label="Värde att förnya"
              value={lockedValue > 0 ? formatMoney(lockedValue) : "–"}
              sub="senast fakturerat för dessa"
              icon="autorenew"
            />
            <Stat
              label="Utgångna"
              value={String(radar.lapsed.length)}
              sub="aldrig förnyade"
              icon="history"
            />
            <Stat
              label="Fritt att sälja igen"
              value={String(radar.relicensable.length)}
              sub="material utan bindning"
              icon="inventory_2"
              tone={radar.relicensable.length > 0 ? "primary" : undefined}
            />
          </div>

          {/* Utgångsradarn */}
          <section className="space-y-4">
            <SectionTitle
              icon="alarm"
              title="Går ut snart"
              hint="Ditt bästa säljläge. Hör av dig innan de tvingas ta ner annonsen."
            />
            {radar.expiring.length === 0 ? (
              <Card className="text-body-md text-on-surface-variant">
                Inget går ut inom {radar.leadDays} dagar.
              </Card>
            ) : (
              <ul className="space-y-3">
                {radar.expiring.map((l) => (
                  <LicenseRow
                    key={l.id}
                    license={l}
                    brand={brandName(l.brand_id)}
                    asset={deliverableTitle(l.deliverable_id)}
                    urgent
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Exklusivitetsvakten */}
          <section className="space-y-4">
            <SectionTitle
              icon="shield"
              title="Exklusivitetskoll"
              hint="Innan du tackar ja: kolla att du inte är bunden till en konkurrent."
            />
            <Card className="space-y-4">
              <Input
                value={checkCategory}
                onChange={(e) => setCheckCategory(e.target.value)}
                placeholder="Skriv bransch, t.ex. hudvård"
              />
              {checkCategory.trim() === "" ? (
                <p className="text-body-md text-on-surface-variant">
                  Skriv in branschen för det uppdrag du överväger.
                </p>
              ) : conflicts.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-primary-container/50 px-4 py-3 text-on-primary-container">
                  <Icon name="check_circle" filled />
                  <span className="text-body-md">
                    Fritt fram. Ingen aktiv exklusivitet inom {checkCategory.trim()}.
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {conflicts.map((c) => (
                    <div
                      key={c.license.id}
                      className="flex items-start gap-3 rounded-lg bg-error-container px-4 py-3 text-on-error-container"
                    >
                      <Icon name="warning" filled />
                      <div>
                        <p className="text-body-md font-semibold">
                          Bunden till {brandName(c.license.brand_id)}
                        </p>
                        <p className="mt-0.5 text-body-md">
                          Exklusivitet inom {c.category} till {formatDate(c.endsOn)} — {c.daysLeft}{" "}
                          dagar kvar. Att tacka ja nu bryter avtalet.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          {/* Återlicensierbart lager */}
          {radar.relicensable.length > 0 && (
            <section className="space-y-4">
              <SectionTitle
                icon="inventory_2"
                title="Fritt att sälja igen"
                hint="Färdigt material utan bindning. Ren marginal, ingen ny produktion."
              />
              <ul className="grid gap-3 sm:grid-cols-2">
                {radar.relicensable.map(({ deliverableId, licenses: ls }) => (
                  <Card key={deliverableId} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-headline-sm">{deliverableTitle(deliverableId)}</p>
                      <p className="mt-1 text-body-md text-on-surface-variant">
                        Såld till {brandName(ls[0].brand_id)}, licensen slut{" "}
                        {ls[0].ends_on ? formatDate(ls[0].ends_on) : ""}
                      </p>
                    </div>
                    <Badge tone="primary">Fri</Badge>
                  </Card>
                ))}
              </ul>
            </section>
          )}

          {/* Redan utgångna */}
          {radar.lapsed.length > 0 && (
            <section className="space-y-4">
              <SectionTitle
                icon="history"
                title="Utgångna utan förnyelse"
                hint="Missade förnyelser. Det går fortfarande att höra av sig."
              />
              <ul className="space-y-3">
                {radar.lapsed.slice(0, 8).map((l) => (
                  <LicenseRow
                    key={l.id}
                    license={l}
                    brand={brandName(l.brand_id)}
                    asset={deliverableTitle(l.deliverable_id)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {settings && (
        <p className="text-center text-xs text-on-surface-variant/70">
          Justera bevakningsfönstret under{" "}
          <Link to="/installningar" className="underline">
            Inställningar
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-container text-primary">
        <Icon name={icon} />
      </div>
      <div>
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
        <p className="text-body-md text-on-surface-variant">{hint}</p>
      </div>
    </div>
  );
}

function LicenseRow({
  license,
  brand,
  asset,
  urgent,
}: {
  license: License;
  brand: string;
  asset: string;
  urgent?: boolean;
}) {
  const days = daysUntilExpiry(license, new Date());
  return (
    <li>
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-headline-sm text-on-surface">{brand}</p>
            {license.exclusive_category && (
              <Badge tone="warn">
                <Icon name="lock" size={13} /> {license.exclusive_category}
              </Badge>
            )}
          </div>
          <p className="mt-1 truncate text-body-md text-on-surface-variant">{asset}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {license.channels.map((c) => (
              <Badge key={c}>{CHANNEL_LABEL[c] ?? c}</Badge>
            ))}
            <Badge>{TERRITORY_LABEL[license.territory]}</Badge>
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          {days === null ? (
            <Badge tone="info">Evig</Badge>
          ) : days < 0 ? (
            <Badge tone="neutral">Utgick {formatDate(license.ends_on)}</Badge>
          ) : (
            <Badge tone={urgent ? "danger" : "neutral"}>
              <Icon name="schedule" size={13} />
              {days} dagar kvar
            </Badge>
          )}
          {license.fee_sek !== null && (
            <p className="mt-2 font-mono text-mono-data text-on-surface-variant">
              {formatMoney(license.fee_sek)}
            </p>
          )}
          {license.ends_on && days !== null && days >= 0 && (
            <p className="mt-1 font-mono text-[11px] text-on-surface-variant/70">
              t.o.m. {parseDate(license.ends_on).toLocaleDateString("sv-SE")}
            </p>
          )}
        </div>
      </Card>
    </li>
  );
}
