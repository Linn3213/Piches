import type { Subscription, SubscriptionStatus } from "@/types/db";
import { daysBetween, parseDate } from "@/lib/rights";

/**
 * Vem som får vara inne, och varför.
 *
 * Det här är den enda modul i appen som avgör om någon får använda den. Den är
 * medvetet en ren funktion på en rad ur databasen, eftersom ett åtkomstbeslut
 * som ligger utspritt i sju komponenter förr eller senare säger olika saker på
 * olika sidor, och då är det alltid den generösaste varianten som vinner.
 *
 * Provperioden kräver inget kort. En creator vill se sina egna licenser ticka
 * innan hon betalar för att slippa missa dem, och ett kortkrav i det läget
 * stoppar fler än det kvalificerar.
 */

export type AccessState =
  | "provperiod"
  | "provperiod_slut"
  | "aktiv"
  | "forfallen"
  | "uppsagd_men_kvar"
  | "ingen";

export type Access = {
  state: AccessState;
  /** Får hon använda appen just nu? */
  allowed: boolean;
  /** Dagar kvar av provperioden, null när det inte är en provperiod. */
  trialDaysLeft: number | null;
  /** Sant när det är dags att be om betalning, utan att låsa henne ute än. */
  shouldNudge: boolean;
};

export function evaluateAccess(
  sub: Subscription | null,
  today: Date,
): Access {
  if (!sub) {
    return { state: "ingen", allowed: false, trialDaysLeft: null, shouldNudge: false };
  }

  // Ett konto Linn öppnat för hand faktureras utanför appen och ska aldrig
  // låsas ute för att Stripe inte känner till det.
  if (sub.granted_by_owner) {
    return { state: "aktiv", allowed: true, trialDaysLeft: null, shouldNudge: false };
  }

  if (sub.status === "aktiv") {
    return { state: "aktiv", allowed: true, trialDaysLeft: null, shouldNudge: false };
  }

  // Uppsagd men betald period kvar: hon behåller allt till periodens slut.
  // Att stänga av direkt vore att ta betalt för tid hon inte får använda.
  if (sub.status === "uppsagd") {
    const kvar = sub.current_period_end
      ? daysBetween(today, new Date(sub.current_period_end))
      : -1;
    return kvar >= 0
      ? { state: "uppsagd_men_kvar", allowed: true, trialDaysLeft: null, shouldNudge: true }
      : { state: "forfallen", allowed: false, trialDaysLeft: null, shouldNudge: true };
  }

  if (sub.status === "forfallen") {
    return { state: "forfallen", allowed: false, trialDaysLeft: null, shouldNudge: true };
  }

  // Provperiod.
  if (!sub.trial_ends_on) {
    return { state: "provperiod_slut", allowed: false, trialDaysLeft: 0, shouldNudge: true };
  }
  const kvar = daysBetween(today, parseDate(sub.trial_ends_on));
  if (kvar < 0) {
    return { state: "provperiod_slut", allowed: false, trialDaysLeft: 0, shouldNudge: true };
  }
  return {
    state: "provperiod",
    allowed: true,
    trialDaysLeft: kvar,
    // Sista veckan är när det är rimligt att påminna, inte dag ett.
    shouldNudge: kvar <= 7,
  };
}

export const TRIAL_DAYS = 14;

/** Slutdatum för en ny provperiod, som datumsträng. */
export function trialEndsOn(today: Date, days = TRIAL_DAYS): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Tier = "solo" | "studio";

export type TierPlan = {
  tier: Tier;
  label: string;
  /** Pris per månad i kronor, exklusive moms. */
  priceSek: number;
  /** Vad nivån faktiskt ger, aldrig något appen inte gör. */
  includes: string[];
  fits: string;
};

/**
 * Två nivåer, inte fem. Fler nivåer än produkten faktiskt skiljer på blir
 * löften som inte går att hålla, och det märks första gången någon frågar vad
 * skillnaden är.
 */
export const TIERS: TierPlan[] = [
  {
    tier: "solo",
    label: "Solo",
    priceSek: 299,
    includes: [
      "Rättighetsmotorn med utgångsradar och exklusivitetsvakt",
      "Uppdrag hela vägen från förfrågan till betald faktura",
      "Prisräknare som visar vad rättigheterna är värda",
      "Fakturaunderlag med svensk moms",
    ],
    fits: "Du kör själv och vill sluta tappa förnyelser.",
  },
  {
    tier: "studio",
    label: "Studio",
    priceSek: 899,
    includes: [
      "Allt i Solo",
      "Lönsamhetsmotorn som visar var pengarna läcker",
      "Produktmotorn som räknar på digitala produkter",
      "Brief-läsaren som plockar isär kundens förfrågan",
    ],
    fits: "Du lever på det här och vill veta vad varje kund faktiskt ger.",
  },
];

export function tierPlan(tier: Tier): TierPlan {
  return TIERS.find((t) => t.tier === tier) ?? TIERS[0];
}

/**
 * Stripes ord för verkligheten, översatt till appens fyra lägen.
 *
 * SPEGLAS i supabase/functions/piches-sync-subscription. Den kopian körs i
 * Deno och kan inte importera härifrån, men det är den här versionen som är
 * testad och som gäller när de säger olika.
 */
export function stripeStatusTillStatus(
  stripeStatus: string,
  cancelAtPeriodEnd: boolean,
): SubscriptionStatus {
  // Uppsagd men inte utgången: hon har betalat perioden och behåller den.
  if (cancelAtPeriodEnd && (stripeStatus === "active" || stripeStatus === "trialing")) {
    return "uppsagd";
  }
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "aktiv";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "forfallen";
    case "canceled":
    case "incomplete_expired":
      return "uppsagd";
    default:
      // Ett läge vi inte känner igen är inte ett skäl att ge bort produkten,
      // men kunden möts av en sida som säger vad som hänt och hur hon fixar det.
      return "forfallen";
  }
}

/**
 * Är raden gammal nog att behöva kollas mot Stripe?
 *
 * Bara rader med ett riktigt abonnemang bakom sig, och bara när perioden de
 * betalat för faktiskt tagit slut. Då har antingen en förnyelse gått igenom
 * (och datumet flyttas fram) eller så har den inte gjort det, och det är
 * precis det vi behöver veta. Provperioder och konton som öppnats för hand
 * finns inte hos Stripe och frågas aldrig efter.
 */
export function behoverStripeSynk(sub: Subscription | null, now: Date): boolean {
  if (!sub?.stripe_subscription_id) return false;
  if (!sub.current_period_end) return true;
  return new Date(sub.current_period_end).getTime() <= now.getTime();
}
