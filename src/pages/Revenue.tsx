import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useStats } from "@/hooks/useStats";
import { useLicenses } from "@/hooks/useLicenses";
import { useBrands } from "@/hooks/useBrands";
import { useEconomy } from "@/hooks/useEconomy";
import { rightsRevenueByBrand } from "@/lib/rights";
import { days, formatDateFull, formatMoney, plural } from "@/lib/format";
import { Badge, Button, Card, Empty, Icon, Loading, PageHeader, Stat } from "@/components/ui";

export default function Revenue() {
  const { data, isLoading, error } = useStats();
  const { data: licenses } = useLicenses();
  const { data: brands } = useBrands();
  const economy = useEconomy();

  const brandName = (id: string) => brands?.find((b) => b.id === id)?.name ?? "Okänt varumärke";

  // Totalen maste summeras FORE kapningen, annars visar rubriken bara de sex
  // storsta kundernas licensintakter men presenterar det som hela summan.
  const rightsAll = useMemo(() => {
    if (!licenses || !brands) return [];
    const map = rightsRevenueByBrand(licenses);
    return [...map.entries()]
      .map(([brandId, total]) => ({ name: brandName(brandId), total }))
      .sort((a, b) => b.total - a.total);
    // brandName lases ur brands, som redan star i beroendelistan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenses, brands]);

  if (isLoading) return <Loading />;
  if (error || !data) return <p className="text-body-md text-error">Kunde inte hämta statistik.</p>;

  const months = economy.revenueByMonth;
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const rightsByBrand = rightsAll.slice(0, 6);
  const rightsTotal = rightsAll.reduce((sum, b) => sum + b.total, 0);
  const maxBrand = Math.max(1, ...rightsByBrand.map((b) => b.total));
  const conc = economy.concentration;
  const maxBrandWon = Math.max(1, ...economy.byBrand.map((b) => b.won));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Intäkter"
        subtitle="Vad som är vunnet, vad som faktiskt kommit in, och vad varje kund lämnar kvar när kostnaderna är betalda."
      />

      {/* Pengaflödet, i den ordning pengarna faktiskt rör sig ---------------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Vunnet, ej fakturerat"
          value={economy.money.contracted > 0 ? formatMoney(economy.money.contracted) : "–"}
          sub="du har rätt till det"
          icon="handshake"
        />
        <Stat
          label="Fakturerat, väntar"
          value={economy.money.outstanding > 0 ? formatMoney(economy.money.outstanding) : "–"}
          sub={
            economy.avgDaysToPayment !== null
              ? `betalas i snitt på ${days(Math.round(economy.avgDaysToPayment))}`
              : "inte betalt än"
          }
          icon="schedule"
        />
        <Stat
          label="Förfallet"
          value={economy.money.overdue > 0 ? formatMoney(economy.money.overdue) : "–"}
          sub={economy.overdue.length > 0 ? plural(economy.overdue.length, "faktura", "fakturor") : "inget sent"}
          icon="warning"
          tone={economy.money.overdue > 0 ? "danger" : undefined}
        />
        <Stat
          label="Inbetalt"
          value={economy.money.paid > 0 ? formatMoney(economy.money.paid) : "–"}
          sub="på kontot"
          icon="account_balance"
          tone={economy.money.paid > 0 ? "primary" : undefined}
        />
      </div>

      {/* Sena betalningar ---------------------------------------------------- */}
      {economy.overdue.length > 0 && (
        <Card className="border-l-2 border-l-error">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-error-container text-on-error-container">
              <Icon name="running_with_errors" />
            </div>
            <div>
              <h2 className="text-headline-sm text-on-surface">Sena betalningar</h2>
              <p className="text-body-md text-on-surface-variant">
                Pengar du redan har tjänat men inte fått.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {economy.overdue.map(({ pitch, daysLate }) => (
              <li key={pitch.id}>
                <Link
                  to={`/uppdrag/${pitch.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-container"
                >
                  <div className="min-w-0">
                    <p className="text-body-md text-on-surface">{brandName(pitch.brand_id)}</p>
                    <p className="text-xs text-on-surface-variant">
                      {pitch.invoice_number ? `Faktura ${pitch.invoice_number}, ` : ""}
                      förföll {formatDateFull(pitch.due_on)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-mono-data text-on-surface">
                      {formatMoney(pitch.value_sek)}
                    </span>
                    <Badge tone="danger">{days(daysLate)} sen</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Koncentrationsrisken ------------------------------------------------ */}
      {conc && conc.share >= 0.4 && conc.brands > 1 && (
        <Card>
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand/40 text-[#7a6434]">
              <Icon name="pie_chart" />
            </div>
            <div>
              <h2 className="text-headline-sm text-on-surface">
                {Math.round(conc.share * 100)} procent av allt kommer från{" "}
                {brandName(conc.brandId)}
              </h2>
              <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
                Det är {formatMoney(conc.amount)} av {formatMoney(conc.total)} fördelat på{" "}
                {plural(conc.brands, "kund", "kunder")}. Tappar du den kunden försvinner alltså större delen av
                omsättningen på en gång, så det kan vara värt att lägga pitchtid på ett par nya
                innan det händer.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Pitchstatistik ------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Uppdrag ute"
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
        <h2 className="mb-1 text-headline-sm">Intäkt per månad</h2>
        <p className="mb-6 text-body-md text-on-surface-variant">
          Bokförd på när affären vanns, inte på när pitchen skickades.
        </p>
        <div className="flex h-44 gap-3">
          {months.map((m) => (
            // h-full + justify-end: staplarnas höjd anges i procent, och en
            // procentandel löser bara ut mot en förälder med satt höjd. Utan
            // h-full här kollapsar varje stapel till 0, osynlig men fortfarande
            // i DOM:en — precis det som hände innan den här raden fanns.
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
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
        {months.every((m) => m.total === 0) && (
          <p className="mt-4 text-body-md text-on-surface-variant">
            Inga vunna uppdrag med belopp än.
          </p>
        )}
      </Card>

      {/* Lönsamhet per kund -------------------------------------------------- */}
      <Card>
        <div className="mb-6">
          <h2 className="text-headline-sm">Vad varje kund är värd</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Omsättningen säger inte vilka kunder som faktiskt är bra, det gör timpenningen, och den
            syns först när du fyllt i hur många timmar uppdraget tog.
          </p>
        </div>

        {economy.byBrand.length === 0 ? (
          <Empty
            icon="query_stats"
            title="Inga vunna uppdrag än"
            hint="När du vunnit ditt första uppdrag räknas lönsamheten ut här."
          />
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/40 text-left">
                  <Th>Varumärke</Th>
                  <Th right>Vunnet</Th>
                  <Th right>Inbetalt</Th>
                  <Th right>Timmar</Th>
                  <Th right>Per timme</Th>
                  <Th right>Rundor</Th>
                </tr>
              </thead>
              <tbody>
                {economy.byBrand.map((row) => (
                  <tr key={row.brandId} className="border-b border-outline-variant/20">
                    <td className="py-3 pr-3">
                      <Link
                        to={`/varumarken/${row.brandId}`}
                        className="text-body-md text-on-surface hover:underline"
                      >
                        {brandName(row.brandId)}
                      </Link>
                      <div className="mt-1.5 h-1 w-full max-w-32 overflow-hidden rounded-full bg-surface-container-highest">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(row.won / maxBrandWon) * 100}%` }}
                        />
                      </div>
                    </td>
                    <Td>{formatMoney(row.won)}</Td>
                    <Td muted={row.paid < row.won}>{formatMoney(row.paid)}</Td>
                    <Td muted={row.hours === 0}>{row.hours > 0 ? `${row.hours} h` : "–"}</Td>
                    <Td>
                      {row.hourlyRate === null ? (
                        <span className="text-on-surface-variant/60">–</span>
                      ) : (
                        formatMoney(Math.round(row.hourlyRate))
                      )}
                    </Td>
                    <Td muted={row.revisionRounds === 0}>{row.revisionRounds}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

        {rightsByBrand.length === 0 ? (
          <Empty
            icon="gavel"
            title="Inga licensintäkter registrerade"
            hint="Sätt ett belopp på licenserna, så syns fördelningen här."
            action={
              <Link to="/rattigheter">
                <Button>Till rättigheterna</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-4">
            {rightsByBrand.map((b) => (
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
        Alla belopp är exklusive moms. Bokföring och fakturering sköts i ditt bokföringssystem,
        och själva bokföringen sköts i ditt bokföringssystem, här räknar vi bara på vad affärerna gav.
      </p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={
        right
          ? "pb-3 pl-3 text-right text-label-caps uppercase text-on-surface-variant"
          : "pb-3 pr-3 text-left text-label-caps uppercase text-on-surface-variant"
      }
    >
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      className={
        muted
          ? "py-3 pl-3 text-right font-mono text-mono-data text-on-surface-variant/60"
          : "py-3 pl-3 text-right font-mono text-mono-data text-on-surface"
      }
    >
      {children}
    </td>
  );
}
