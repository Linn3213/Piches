import { Link } from "react-router-dom";
import { useBrands } from "@/hooks/useBrands";
import { useExpiryRadar, useLicenses } from "@/hooks/useLicenses";
import { useRenewalQueue } from "@/hooks/useRenewals";
import { useEconomy } from "@/hooks/useEconomy";
import { usePitches } from "@/hooks/usePitches";
import { useTasks } from "@/hooks/useTasks";
import { useStats } from "@/hooks/useStats";
import { days, formatMoney, plural, relativeDays } from "@/lib/format";
import { Badge, Button, Card, Empty, Icon, Loading, Stat } from "@/components/ui";
import { Onboarding } from "@/components/Onboarding";
import { WON_STATUSES } from "@/types/db";

type Urgency = "hog" | "medel" | "lag";

type Action = {
  id: string;
  title: string;
  context: string;
  href: string;
  icon: string;
  urgency: Urgency;
  meta: string;
};

/**
 * "Idag ska du:" med riktig data bakom.
 *
 * Prioriteringen är medvetet enkel och går att förklara: pengar som redan är
 * intjänade men inte inbetalda ligger överst, därefter licenser på väg att gå
 * ut, sedan levererat material utan registrerade rättigheter, och sist det
 * vanliga uppföljningsarbetet. Ordningen följer alltså hur dyrt det är att
 * missa saken, inte hur nyligen den dök upp.
 */
export default function Dashboard() {
  const { data: radar, isLoading: radarLoading, error: radarError } = useExpiryRadar();
  const { data: licenses } = useLicenses();
  const { data: brands } = useBrands();
  const { data: pitches } = usePitches();
  const { data: tasks } = useTasks();
  const { data: stats } = useStats();
  const renewals = useRenewalQueue();
  const economy = useEconomy();

  // Utan det har sa sidan "Inget som brinner" nar sanningen var att vi inte
  // nadde servern, vilket ar det farligaste beskedet appen kan ge.
  if (radarError) return <p className="text-body-md text-error">Vi nådde inte servern just nu, prova att ladda om sidan.</p>;
  if (radarLoading) return <Loading />;

  const brandName = (id: string) => brands?.find((b) => b.id === id)?.name ?? "Okänt varumärke";
  const today = new Date();
  const actions: Action[] = [];

  // 1. Sena fakturor. Redan tjanade pengar som inte kommit in.
  for (const { pitch, daysLate } of economy.overdue) {
    actions.push({
      id: `sen-${pitch.id}`,
      title: `Påminn ${brandName(pitch.brand_id)} om fakturan`,
      context: `${formatMoney(pitch.value_sek)} som du redan tjänat`,
      href: `/uppdrag/${pitch.id}`,
      icon: "running_with_errors",
      urgency: "hog",
      meta: `${days(daysLate)} sen`,
    });
  }

  // 2. Licenser att forlanga, med fardigt forslag bakom knappen.
  for (const r of renewals) {
    actions.push({
      id: `forny-${r.license.id}`,
      title: `Förläng licensen med ${r.brandName}`,
      context:
        r.suggestedFee !== null
          ? `Föreslå ${formatMoney(r.suggestedFee)}`
          : "Sätt ett pris på förlängningen",
      href: "/rattigheter",
      icon: "autorenew",
      urgency: r.lapsed || (r.daysLeft ?? 99) <= 7 ? "hog" : "medel",
      meta: r.lapsed ? "redan utgången" : `${days(r.daysLeft ?? 0)} kvar`,
    });
  }

  // 3. Levererat utan licens. Klockan startade aldrig, och da kommer
  //    forlangningen aldrig upp pa radarn overhuvudtaget.
  const pitchesWithLicense = new Set((licenses ?? []).map((l) => l.pitch_id));
  for (const p of pitches ?? []) {
    if (!["levererat", "fakturerat", "betalt"].includes(p.status)) continue;
    if (pitchesWithLicense.has(p.id)) continue;
    actions.push({
      id: `licens-${p.id}`,
      title: `Registrera rättigheterna för ${brandName(p.brand_id)}`,
      context: "Levererat men ingen licens, alltså tickar ingen klocka",
      href: `/uppdrag/${p.id}`,
      icon: "gavel",
      urgency: "medel",
      meta: "saknas",
    });
  }

  // 4. Fakturor att skicka pa levererade uppdrag.
  for (const p of (pitches ?? []).filter((p) => p.status === "levererat")) {
    actions.push({
      id: `fakturera-${p.id}`,
      title: `Fakturera ${brandName(p.brand_id)}`,
      context: p.value_sek !== null ? formatMoney(p.value_sek) : "Levererat och klart",
      href: `/uppdrag/${p.id}`,
      icon: "receipt_long",
      urgency: "medel",
      meta: "levererat",
    });
  }

  // 5. Vanliga uppgifter.
  for (const t of (tasks ?? []).filter((t) => !t.done_at && t.due_at)) {
    const overdue = new Date(t.due_at as string) < today;
    actions.push({
      id: `task-${t.id}`,
      title: t.title,
      context: t.brand_id ? brandName(t.brand_id) : "Uppgift",
      href: "/uppgifter",
      icon: "task_alt",
      urgency: overdue ? "hog" : "lag",
      meta: relativeDays(t.due_at),
    });
  }

  // 6. Uppdrag dar de svarat och vantar pa dig.
  for (const p of (pitches ?? []).filter((p) => p.status === "svarat")) {
    actions.push({
      id: `offert-${p.id}`,
      title: `Skicka offert till ${brandName(p.brand_id)}`,
      context: "De har svarat och väntar på dig",
      href: `/uppdrag/${p.id}`,
      icon: "mail",
      urgency: "medel",
      meta: "svarat",
    });
  }

  const order: Record<Urgency, number> = { hog: 0, medel: 1, lag: 2 };
  actions.sort((a, b) => order[a.urgency] - order[b.urgency]);

  const wonCount = (pitches ?? []).filter((p) => WON_STATUSES.includes(p.status)).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-label-caps uppercase text-on-surface-variant">
          {today.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-headline-lg text-on-background">
          <Icon name="bolt" filled className="text-primary" size={30} />
          Idag ska du:
        </h1>
      </div>

      <Onboarding />

      {actions.length === 0 ? (
        <Empty
          icon="self_improvement"
          title="Inget som brinner"
          hint={
            wonCount === 0
              ? "Inga sena fakturor och inga licenser på väg ut, så det är ett bra läge att lägga tid på nya kunder."
              : "Inga sena fakturor, inga licenser på väg ut och inga förfallna uppgifter."
          }
          action={
            <Link to="/uppdrag">
              <Button>Lägg upp ett nytt uppdrag</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {actions.slice(0, 8).map((a) => (
            <li key={a.id}>
              <Link to={a.href} className="block">
                <Card
                  className={
                    a.urgency === "hog"
                      ? "border-l-2 border-l-error transition-colors hover:bg-surface-container-low"
                      : "transition-colors hover:bg-surface-container-low"
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-outline-variant/40 bg-surface-container text-on-surface-variant">
                        <Icon name={a.icon} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-headline-sm text-on-surface">{a.title}</p>
                        <p className="mt-0.5 truncate text-body-md text-on-surface-variant">
                          {a.context}
                        </p>
                      </div>
                    </div>
                    <Badge tone={a.urgency === "hog" ? "danger" : "neutral"}>{a.meta}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {actions.length > 8 && (
        <p className="text-center text-body-md text-on-surface-variant">
          Och {plural(actions.length - 8, "sak", "saker")} till, som inte brådskar lika mycket.
        </p>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Väntar på betalning"
          value={economy.money.outstanding > 0 ? formatMoney(economy.money.outstanding) : "–"}
          sub={economy.overdue.length > 0 ? `${plural(economy.overdue.length, "är redan sen", "är redan sena")}` : "inget sent"}
          icon="schedule"
          tone={economy.money.overdue > 0 ? "danger" : undefined}
        />
        <Stat
          label="Uppdrag ute"
          value={String(stats?.pitchesSent ?? 0)}
          sub={`${stats?.pitchesSentLast30d ?? 0} senaste 30 dagarna`}
          icon="send"
        />
        <Stat
          label="Går ut snart"
          value={String(radar?.expiring.length ?? 0)}
          sub="licenser att förlänga"
          icon="alarm"
          tone={(radar?.expiring.length ?? 0) > 0 ? "danger" : undefined}
        />
        <Stat
          label="Fritt att sälja igen"
          value={String(radar?.relicensable.length ?? 0)}
          sub="färdigt material"
          icon="inventory_2"
          tone={(radar?.relicensable.length ?? 0) > 0 ? "primary" : undefined}
        />
      </section>
    </div>
  );
}
