import { useMemo } from "react";
import { useStats } from "@/hooks/useStats";
import { useLicenses } from "@/hooks/useLicenses";
import { useBrands } from "@/hooks/useBrands";
import { rightsRevenueByBrand } from "@/lib/rights";
import { formatMoney } from "@/lib/format";
import { Card, Empty, Icon, Loading, PageHeader, Stat } from "@/components/ui";

export default function Revenue() {
  const { data, isLoading, error } = useStats();
  const { data: licenses } = useLicenses();
  const { data: brands } = useBrands();

  const byBrand = useMemo(() => {
    if (!licenses || !brands) return [];
    const map = rightsRevenueByBrand(licenses);
    return [...map.entries()]
      .map(([brandId, total]) => ({
        name: brands.find((b) => b.id === brandId)?.name ?? "Okänt",
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [licenses, brands]);

  if (isLoading) return <Loading />;
  if (error || !data) return <p className="text-body-md text-error">Kunde inte hämta statistik.</p>;

  const maxMonth = Math.max(1, ...data.revenueByMonth.map((m) => m.total));
  const rightsTotal = byBrand.reduce((sum, b) => sum + b.total, 0);
  const maxBrand = Math.max(1, ...byBrand.map((b) => b.total));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Intäkter"
        subtitle="Vad du fakturerar, och hur stor del som faktiskt kommer från rättigheter."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Pitchar ute"
          value={String(data.pitchesSent)}
          sub={`${data.pitchesSentLast30d} senaste 30 dagarna`}
          icon="send"
        />
        <Stat
          label="Svarsfrekvens"
          value={data.responseRate === null ? "–" : `${Math.round(data.responseRate * 100)}%`}
          sub={`${data.responded} av ${data.pitchesSent}`}
          icon="forum"
        />
        <Stat label="Vunna" value={String(data.won)} icon="emoji_events" tone="primary" />
        <Stat
          label="Snittordervärde"
          value={data.avgWonValue === null ? "–" : formatMoney(data.avgWonValue)}
          sub="bland vunna"
          icon="payments"
        />
      </div>

      <Card>
        <h2 className="mb-6 text-headline-sm">Intäkt per månad</h2>
        <div className="flex h-44 items-end gap-3">
          {data.revenueByMonth.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-[11px] text-on-surface-variant">
                {m.total > 0 ? formatMoney(m.total) : ""}
              </span>
              <div
                className="w-full rounded-t-full bg-sage transition-all hover:bg-primary"
                style={{ height: `${Math.max(2, (m.total / maxMonth) * 100)}%` }}
              />
              <span className="text-xs text-on-surface-variant">{m.label}</span>
            </div>
          ))}
        </div>
        {data.revenueByMonth.every((m) => m.total === 0) && (
          <p className="mt-4 text-body-md text-on-surface-variant">
            Inga vunna affärer med belopp än.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-headline-sm">Rättighetsintäkter per varumärke</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Vad varje kund betalat för licenser, inte för produktionen.
            </p>
          </div>
          {rightsTotal > 0 && (
            <span className="shrink-0 font-mono text-headline-sm text-primary">
              {formatMoney(rightsTotal)}
            </span>
          )}
        </div>

        {byBrand.length === 0 ? (
          <Empty
            icon="gavel"
            title="Inga licensintäkter registrerade"
            hint="Sätt ett belopp på licenserna så syns fördelningen här."
          />
        ) : (
          <ul className="space-y-4">
            {byBrand.map((b) => (
              <li key={b.name}>
                <div className="mb-1.5 flex items-center justify-between text-body-md">
                  <span className="text-on-surface">{b.name}</span>
                  <span className="font-mono text-mono-data text-on-surface-variant">
                    {formatMoney(b.total)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(b.total / maxBrand) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-on-surface-variant/70">
        <Icon name="info" size={14} />
        Bokföring och fakturering sköts i ditt bokföringssystem. Piches äger affärslogiken, inte
        arkivet.
      </p>
    </div>
  );
}
