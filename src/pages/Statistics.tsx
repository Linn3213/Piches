import { useStats } from "@/hooks/useStats";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";

export default function Statistics() {
  const { data, isLoading, error } = useStats();

  if (isLoading) return <p className="text-sm text-ink/50">Laddar...</p>;
  if (error || !data) return <p className="text-sm text-clay">Kunde inte hämta statistik.</p>;

  const maxMonth = Math.max(1, ...data.revenueByMonth.map((m) => m.total));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Statistik</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pitchar ute" value={String(data.pitchesSent)} sub={`${data.pitchesSentLast30d} senaste 30 dagarna`} />
        <Stat
          label="Svarsfrekvens"
          value={data.responseRate === null ? "–" : `${Math.round(data.responseRate * 100)}%`}
          sub={`${data.responded} av ${data.pitchesSent}`}
        />
        <Stat label="Vunna" value={String(data.won)} />
        <Stat
          label="Snittordervärde"
          value={data.avgWonValue === null ? "–" : formatMoney(data.avgWonValue)}
          sub="bland vunna"
        />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-medium text-ink/70">Intäkt per månad</h2>
        <div className="flex items-end gap-3" style={{ height: 140 }}>
          {data.revenueByMonth.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] text-ink/45">
                {m.total > 0 ? formatMoney(m.total) : ""}
              </span>
              <div
                className="w-full rounded-t-md bg-clay/70"
                style={{ height: Math.max(2, (m.total / maxMonth) * 96) }}
              />
              <span className="text-xs text-ink/50">{m.label}</span>
            </div>
          ))}
        </div>
        {data.revenueByMonth.every((m) => m.total === 0) && (
          <p className="mt-3 text-sm text-ink/40">Inga vunna affärer med belopp än.</p>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink/40">{sub}</p>}
    </Card>
  );
}
