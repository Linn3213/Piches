import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAccess, useStartTrial, useSubscription } from "@/hooks/useSubscription";
import { TIERS, TRIAL_DAYS } from "@/lib/access";
import { days, formatMoney } from "@/lib/format";
import { Button, Card, Icon, Loading } from "@/components/ui";

/**
 * Spärren mellan inloggning och app.
 *
 * Två regler styr utseendet. Den som inte betalar ska mötas av ett erbjudande
 * och inte av en trasig app, eftersom en tom vy utan förklaring läser som ett
 * fel och inte som ett val. Och den som är mitt i provperioden ska aldrig
 * hindras, bara påminnas, och först den sista veckan.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { access, isLoading, error } = useAccess();
  const { data: sub } = useSubscription();
  const startTrial = useStartTrial();
  const plats = useLocation();

  // Konto-sidan måste alltid vara nåbar, annars kan den som är utelåst inte
  // betala sig in igen.
  if (plats.pathname === "/konto") return <>{children}</>;

  if (error) {
    return (
      <p className="text-body-md text-error">
        Vi nådde inte servern just nu, prova att ladda om sidan.
      </p>
    );
  }
  if (isLoading) return <Loading />;

  if (access.allowed) {
    return (
      <>
        {access.shouldNudge && <Paminnelse dagarKvar={access.trialDaysLeft} />}
        {children}
      </>
    );
  }

  // Ingen rad alls: hon har aldrig startat något. Erbjud provperioden.
  if (access.state === "ingen" && !sub) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-container text-on-primary-container">
          <Icon name="rocket_launch" size={26} />
        </div>
        <h1 className="mt-4 text-headline-lg text-on-surface">Prova Piches i {days(TRIAL_DAYS)}</h1>
        <p className="mx-auto mt-3 max-w-prose text-body-md text-on-surface-variant">
          Inget kort, ingen bindning. Lägg in ditt senaste uppdrag och registrera rättigheterna, så
          ser du direkt när licensen går ut och vad förnyelsen är värd.
        </p>
        <Button
          className="mt-6"
          disabled={startTrial.isPending}
          onClick={() => startTrial.mutate()}
        >
          {startTrial.isPending ? "Startar..." : "Starta provperioden"}
        </Button>
        {startTrial.isError && (
          <p className="mt-4 text-body-md text-error" role="alert">
            Det gick inte att starta provperioden. Ladda om sidan och försök igen.
          </p>
        )}
      </Card>
    );
  }

  // Provperioden slut, eller betalningen slutade fungera.
  const slutfordProv = access.state === "provperiod_slut";
  return (
    <Card className="mx-auto max-w-xl text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={slutfordProv ? "hourglass_bottom" : "credit_card_off"} size={26} />
      </div>
      <h1 className="mt-4 text-headline-lg text-on-surface">
        {slutfordProv ? "Provperioden är slut" : "Prenumerationen är pausad"}
      </h1>
      <p className="mx-auto mt-3 max-w-prose text-body-md text-on-surface-variant">
        {slutfordProv
          ? "Allt du lagt in finns kvar och väntar. Välj en nivå så öppnas det igen direkt."
          : "Betalningen gick inte igenom. Uppdatera den så öppnas kontot igen på en gång, allt ditt material ligger orört."}
      </p>
      <p className="mt-4 text-body-md text-on-surface-variant">
        Från {formatMoney(TIERS[0].priceSek)} i månaden, exklusive moms.
      </p>
      <Link to="/konto">
        <Button className="mt-6">Välj nivå</Button>
      </Link>
    </Card>
  );
}

/** Påminner utan att stå i vägen. Aldrig en spärr, bara en rad. */
function Paminnelse({ dagarKvar }: { dagarKvar: number | null }) {
  return (
    <Link to="/konto" className="mb-6 block">
      <Card className="border-l-2 border-l-primary transition-colors hover:bg-surface-container-low">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-md text-on-surface">
            {dagarKvar === null
              ? "Din prenumeration är uppsagd och löper ut vid periodens slut."
              : dagarKvar === 0
                ? "Sista dagen av provperioden idag."
                : `${days(dagarKvar)} kvar av provperioden.`}
          </p>
          <span className="text-label-caps uppercase text-primary">Välj nivå</span>
        </div>
      </Card>
    </Link>
  );
}
