import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAccess,
  useOpenPortal,
  useStartCheckout,
  useSubscription,
} from "@/hooks/useSubscription";
import { TIERS, type Tier } from "@/lib/access";
import { days, formatDateFull, formatMoney } from "@/lib/format";
import { Badge, Button, Card, Icon, Loading, PageHeader } from "@/components/ui";

/**
 * Konto och betalning.
 *
 * Sidan är medvetet inte en prislista utan ett beslutsunderlag. En creator
 * köper inte ett verktyg, hon köper att slippa missa en förnyelse, och därför
 * står jämförelsen mot vad EN missad licens kostar bredvid själva priset.
 */
export default function Konto() {
  const { data: sub, isLoading, error } = useSubscription();
  const { access } = useAccess();
  const checkout = useStartCheckout();
  const portal = useOpenPortal();
  const [params] = useSearchParams();
  const qc = useQueryClient();

  const utfall = params.get("prenumeration");

  // Kommer hon tillbaka från Stripe är raden nyss skriven av success-funktionen,
  // så den cachade statusen är gammal.
  useEffect(() => {
    if (utfall) qc.invalidateQueries({ queryKey: ["subscription"] });
  }, [utfall, qc]);

  if (error) {
    return (
      <p className="text-body-md text-error">
        Vi nådde inte servern just nu, prova att ladda om sidan.
      </p>
    );
  }
  if (isLoading) return <Loading />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Konto"
        subtitle="Vad du betalar för, och vad som händer härnäst."
      />

      {utfall === "klar" && (
        <Card className="border-l-2 border-l-primary">
          <p className="text-headline-sm text-on-surface">Tack, betalningen gick igenom</p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Kontot är öppet och kvittot ligger i mejlen.
          </p>
        </Card>
      )}
      {utfall && utfall !== "klar" && (
        <Card className="border-l-2 border-l-error">
          <p className="text-headline-sm text-on-surface">Betalningen slutfördes inte</p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Ingenting har dragits. Prova igen nedan, eller hör av dig om det strular.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-label-caps uppercase text-on-surface-variant">Just nu</p>
            <p className="mt-1 text-headline-sm text-on-surface">
              {access.state === "provperiod" && "Provperiod"}
              {access.state === "provperiod_slut" && "Provperioden är slut"}
              {access.state === "aktiv" && "Aktiv prenumeration"}
              {access.state === "uppsagd_men_kvar" && "Uppsagd, men aktiv perioden ut"}
              {access.state === "forfallen" && "Betalningen slutade fungera"}
              {access.state === "ingen" && "Inget abonnemang"}
            </p>
            {access.state === "provperiod" && access.trialDaysLeft !== null && (
              <p className="mt-1 text-body-md text-on-surface-variant">
                {access.trialDaysLeft === 0
                  ? "Sista dagen idag."
                  : `${days(access.trialDaysLeft)} kvar.`}
              </p>
            )}
            {sub?.current_period_end && access.state !== "provperiod" && (
              <p className="mt-1 text-body-md text-on-surface-variant">
                Perioden löper till {formatDateFull(sub.current_period_end)}.
              </p>
            )}
            {sub?.granted_by_owner && (
              <p className="mt-1 text-body-md text-on-surface-variant">
                Kontot faktureras utanför appen.
              </p>
            )}
          </div>
          <Badge tone={access.allowed ? "primary" : "danger"}>
            {access.allowed ? "Öppet" : "Låst"}
          </Badge>
        </div>
      </Card>

      {!sub?.granted_by_owner && access.state !== "aktiv" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-headline-sm text-on-surface">Välj nivå</h2>
            <p className="max-w-prose text-body-md text-on-surface-variant">
              En enda licens som hinner löpa ut obemärkt kostar oftast mer än ett helt år av
              verktyget, och det är precis den sortens miss rättighetsmotorn finns för att stoppa.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {TIERS.map((plan) => (
              <Card key={plan.tier} className="flex flex-col justify-between gap-5">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-headline-sm text-on-surface">{plan.label}</p>
                    <p className="font-mono text-2xl text-on-surface">
                      {formatMoney(plan.priceSek)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    per månad, exklusive moms
                  </p>
                  <p className="mt-3 text-body-md text-on-surface-variant">{plan.fits}</p>
                  <ul className="mt-4 space-y-2">
                    {plan.includes.map((rad) => (
                      <li key={rad} className="flex items-start gap-2 text-body-md text-on-surface">
                        <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" />
                        {rad}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  disabled={checkout.isPending}
                  onClick={() => checkout.mutate(plan.tier as Tier)}
                >
                  {checkout.isPending ? "Öppnar betalningen..." : `Välj ${plan.label}`}
                </Button>
              </Card>
            ))}
          </div>

          {checkout.isError && (
            <p className="text-body-md text-error" role="alert">
              {(checkout.error as Error).message}
            </p>
          )}

          <p className="text-xs text-on-surface-variant">
            Betalning sker hos Stripe, vi lagrar aldrig kortuppgifter. Du kan säga upp när du vill
            och behåller tillgången perioden ut.
          </p>
        </section>
      )}

      {/* Kunden sköter kort, kvitton och uppsägning själv.
          Att behöva mejla för att säga upp är den sortens friktion som blir en
          dålig recension i stället för en behållen kund, och för oss är det
          arbete som växer med varje ny kund. */}
      {sub?.stripe_customer_id && !sub?.granted_by_owner && (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-title-md text-on-surface">Hantera betalningen</p>
            <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
              Byt kort, hämta kvitton, byt nivå eller säg upp. Säger du upp behåller du allt
              perioden ut, och materialet ligger kvar även efteråt.
            </p>
          </div>
          <Button
            variant="ghost"
            disabled={portal.isPending}
            onClick={() => portal.mutate()}
          >
            {portal.isPending ? "Öppnar..." : "Öppna"}
          </Button>
          {portal.isError && (
            <p className="w-full text-body-md text-error" role="alert">
              {(portal.error as Error).message}
            </p>
          )}
        </Card>
      )}

      {sub?.granted_by_owner && (
        <Card>
          <p className="text-body-md text-on-surface-variant">
            Kontot är öppnat för hand och faktureras utanför appen. Hör av dig till{" "}
            <a className="underline" href="mailto:info@essensiadesign.se">
              info@essensiadesign.se
            </a>{" "}
            om något ska ändras.
          </p>
        </Card>
      )}
    </div>
  );
}
