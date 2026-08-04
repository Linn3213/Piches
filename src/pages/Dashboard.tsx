import { Link } from "react-router-dom";
import { useBrands } from "@/hooks/useBrands";
import { useExpiryRadar } from "@/hooks/useLicenses";
import { useTasks } from "@/hooks/useTasks";
import { useStats } from "@/hooks/useStats";
import { daysUntilExpiry } from "@/lib/rights";
import { formatMoney, relativeDays } from "@/lib/format";
import { Badge, Card, Empty, Icon, Loading, Stat } from "@/components/ui";

type Action = {
  id: string;
  title: string;
  context: string;
  href: string;
  icon: string;
  urgency: "hog" | "medel" | "lag";
  meta: string;
};

/**
 * "Idag ska du:" — samma tanke som Stitch-skissen, men matad med riktig
 * data. Prioriteringen är medvetet enkel och förklarlig: utgående licenser
 * först, för det är de som faktiskt kostar pengar att missa.
 */
export default function Dashboard() {
  const { data: radar, isLoading: radarLoading } = useExpiryRadar();
  const { data: brands } = useBrands();
  const { data: tasks } = useTasks();
  const { data: stats } = useStats();

  if (radarLoading) return <Loading />;

  const brandName = (id: string) => brands?.find((b) => b.id === id)?.name ?? "Okänt varumärke";
  const today = new Date();
  const actions: Action[] = [];

  for (const l of radar?.expiring ?? []) {
    const days = daysUntilExpiry(l, today) ?? 0;
    actions.push({
      id: `lic-${l.id}`,
      title: `Förnya licensen med ${brandName(l.brand_id)}`,
      context: l.fee_sek ? `Senast ${formatMoney(l.fee_sek)}` : "Licens löper ut",
      href: "/rattigheter",
      icon: "autorenew",
      urgency: days <= 7 ? "hog" : "medel",
      meta: days <= 0 ? "går ut idag" : `${days} dagar kvar`,
    });
  }

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

  for (const b of (brands ?? []).filter((b) => b.status === "svarat")) {
    actions.push({
      id: `brand-${b.id}`,
      title: `Skicka offert till ${b.name}`,
      context: "Har svarat, väntar på dig",
      href: `/varumarken/${b.id}`,
      icon: "mail",
      urgency: "medel",
      meta: "svarat",
    });
  }

  const order = { hog: 0, medel: 1, lag: 2 } as const;
  actions.sort((a, b) => order[a.urgency] - order[b.urgency]);

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

      {actions.length === 0 ? (
        <Empty
          icon="self_improvement"
          title="Inget som brinner"
          hint="Inga licenser går ut, inga förfallna uppgifter och inga obesvarade varumärken."
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

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Pitchar ute"
          value={String(stats?.pitchesSent ?? 0)}
          sub={`${stats?.pitchesSentLast30d ?? 0} senaste 30 dagarna`}
          icon="send"
        />
        <Stat
          label="Svarsfrekvens"
          value={
            stats?.responseRate === null || stats?.responseRate === undefined
              ? "–"
              : `${Math.round(stats.responseRate * 100)}%`
          }
          icon="forum"
        />
        <Stat
          label="Går ut snart"
          value={String(radar?.expiring.length ?? 0)}
          sub="licenser att förnya"
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
