import type { Channel, DeliverableFormat, Settings, Territory } from "@/types/db";

/**
 * Prissättningsmotorn.
 *
 * Poängen: priset på ett UGC-uppdrag ÄR rättigheterna. Produktionen är
 * ofta den minsta posten. Motorn räknar därför upp en baskostnad med
 * påslag per rättighet, och returnerar varje rad med en förklaring så att
 * du kan motivera siffran för kunden i stället för att gissa.
 *
 * Procentsatserna kommer från användarens egen prislista (piches_settings),
 * inte från konstanter här. De är startvärden att justera, inte sanningar.
 */

export type PricingInput = {
  deliverables: { format: DeliverableFormat; quantity: number }[];
  channels: Channel[];
  territory: Territory;
  /** null = evig licens */
  durationMonths: number | null;
  exclusiveCategory: boolean;
  includesRawFiles: boolean;
  rush: boolean;
};

export type PricingLine = {
  label: string;
  amount: number;
  detail: string;
  kind: "base" | "rights" | "extra";
};

export type PricingResult = {
  lines: PricingLine[];
  base: number;
  total: number;
};

function baseRate(format: DeliverableFormat, s: Settings): number {
  switch (format) {
    case "foto":
      return s.base_photo_rate;
    case "story":
      return s.base_story_rate;
    // Video, reel, tiktok och ugc_ad är alla rörligt och prissätts lika.
    default:
      return s.base_video_rate;
  }
}

/**
 * Längre licens kostar mer, men inte linjärt — en 12-månaderslicens är
 * inte 12 gånger dyrare än en månad. Vi skalar med kvadratroten, vilket
 * ger en rimlig kurva: 1 mån = 1.0x, 3 mån ≈ 1.7x, 12 mån ≈ 3.5x.
 */
export function durationFactor(months: number): number {
  if (months <= 1) return 1;
  return Math.sqrt(months);
}

export function computePrice(input: PricingInput, s: Settings): PricingResult {
  const lines: PricingLine[] = [];

  const base = input.deliverables.reduce(
    (sum, d) => sum + baseRate(d.format, s) * d.quantity,
    0,
  );

  if (base > 0) {
    const spec = input.deliverables
      .map((d) => `${d.quantity}x ${d.format}`)
      .join(", ");
    lines.push({
      kind: "base",
      label: "Produktion",
      amount: base,
      detail: spec || "Inga leverabler valda",
    });
  }

  // Rättigheter räknas alltid på produktionskostnaden, inte på varandra,
  // så att påslagen går att läsa av var för sig.
  const pct = (p: number) => (base * p) / 100;

  if (input.channels.includes("organic_brand")) {
    lines.push({
      kind: "rights",
      label: "Varumärkets egna kanaler",
      amount: pct(s.brand_organic_uplift_pct),
      detail: `+${s.brand_organic_uplift_pct}% — de får publicera i egna flöden`,
    });
  }

  if (input.channels.includes("paid_social")) {
    const months = input.durationMonths;
    const factor = months === null ? 1 : durationFactor(months);
    const amount = pct(s.paid_social_uplift_pct) * factor;
    lines.push({
      kind: "rights",
      label: "Betald annonsering",
      amount,
      detail:
        months === null
          ? `+${s.paid_social_uplift_pct}% — annonsrätt`
          : `+${s.paid_social_uplift_pct}% × ${factor.toFixed(1)} för ${months} mån`,
    });
  }

  if (input.channels.includes("whitelisting")) {
    lines.push({
      kind: "rights",
      label: "Whitelisting / Spark Ads",
      amount: pct(s.whitelisting_uplift_pct),
      detail: `+${s.whitelisting_uplift_pct}% — annonsen går från ditt konto`,
    });
  }

  if (input.channels.includes("website")) {
    lines.push({
      kind: "rights",
      label: "Webb och e-handel",
      amount: pct(s.website_uplift_pct),
      detail: `+${s.website_uplift_pct}% — produktsidor, nyhetsbrev`,
    });
  }

  if (input.territory === "global") {
    lines.push({
      kind: "rights",
      label: "Global användning",
      amount: pct(s.territory_global_uplift_pct),
      detail: `+${s.territory_global_uplift_pct}% — utanför Norden och EU`,
    });
  }

  if (input.durationMonths === null) {
    lines.push({
      kind: "rights",
      label: "Evig licens",
      amount: pct(s.perpetuity_uplift_pct),
      detail: `+${s.perpetuity_uplift_pct}% — du kan aldrig sälja om materialet`,
    });
  }

  if (input.exclusiveCategory) {
    lines.push({
      kind: "rights",
      label: "Branschexklusivitet",
      amount: pct(s.exclusivity_uplift_pct),
      detail: `+${s.exclusivity_uplift_pct}% — du tackar nej till konkurrenter`,
    });
  }

  if (input.includesRawFiles) {
    lines.push({
      kind: "extra",
      label: "Råmaterial",
      amount: pct(s.raw_files_uplift_pct),
      detail: `+${s.raw_files_uplift_pct}% — de får klippa om själva`,
    });
  }

  if (input.rush) {
    lines.push({
      kind: "extra",
      label: "Expressleverans",
      amount: pct(s.rush_fee_pct),
      detail: `+${s.rush_fee_pct}% — kortare produktionstid`,
    });
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { lines, base, total: Math.round(total) };
}
