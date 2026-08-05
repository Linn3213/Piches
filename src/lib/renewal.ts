import type { Brand, License, Pitch } from "@/types/db";
import { daysUntilExpiry, parseDate } from "@/lib/rights";
import type { PitchStatus } from "@/types/db";

/**
 * Förnyelsemotorn.
 *
 * Utgångsradarn i rights.ts hittar licenserna som snart tar slut. Den här
 * modulen gör något av dem, vilket är hela skillnaden mellan en påminnelse
 * och en intäkt.
 *
 * Läget är ovanligt bra och används nästan aldrig: varumärket har materialet
 * i drift, känner till siffrorna det gav, och står inför att tvingas ta ner
 * annonsen. Det är enda gången på hela året du säljer till någon som redan
 * vet exakt vad du är värd, och därför den enda gången ett prispåslag
 * faktiskt går att motivera utan att argumentera.
 */

/**
 * En licens är omhändertagen så snart det finns en förnyelseaffär som lever
 * eller redan vunnits.
 *
 * Tidigare räknades bara LEVANDE affärer, och eftersom "betalt" ligger bland
 * de avslutade blev logiken baklänges: i samma sekund som förnyelsen
 * markerades betald dök den gamla licensen upp igen under "Att förnya" med
 * texten "redan utgången", och låg sedan kvar för alltid. Ju färdigare affären
 * var, desto mer tjatade listan.
 *
 * Bara ett misslyckat försök släpper licensen tillbaka till kön.
 */
const MISSLYCKAT: PitchStatus[] = ["forlorad", "ingen_respons"];

export function isAlreadyHandled(license: License, pitches: Pitch[]): boolean {
  return pitches.some(
    (p) => p.renewed_from_license_id === license.id && !MISSLYCKAT.includes(p.status),
  );
}

/**
 * Förnyelsen prissätts från vad kunden senast betalade, med ett påslag som
 * speglar att materialet nu är beprövat. Påslaget är ett förslag att justera,
 * aldrig en automatisk höjning: sista ordet är alltid ditt.
 */
export function suggestedRenewalFee(license: License, upliftPct: number): number | null {
  if (license.fee_sek === null) return null;
  return Math.round(license.fee_sek * (1 + upliftPct / 100));
}

export type RenewalProposal = {
  license: License;
  brandId: string;
  brandName: string;
  daysLeft: number | null;
  /** Redan utgången, alltså förlorad intäkt som fortfarande går att rädda. */
  lapsed: boolean;
  previousFee: number | null;
  suggestedFee: number | null;
  subject: string;
  observation: string;
};

/**
 * Datumet skrivs alltid med årtal. En licens spänner nästan alltid över ett
 * årsskifte, och "går ut 1 september" är obegripligt i ett mejl som ska
 * övertyga någon om att agera nu snarare än om ett år.
 */
function endsOnText(license: License): string {
  if (!license.ends_on) return "";
  return parseDate(license.ends_on).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Texten som följer med förnyelseaffären in i pipelinen. Den är skriven för
 * att gå att skicka nästan som den är, med den konkreta observationen först,
 * eftersom en förnyelsepitch som låter som ett mallutskick tappar precis den
 * fördel läget gav.
 */
export function buildRenewalProposal(
  license: License,
  brand: Brand | undefined,
  today: Date,
  upliftPct: number,
): RenewalProposal {
  const daysLeft = daysUntilExpiry(license, today);
  const lapsed = daysLeft !== null && daysLeft < 0;
  const name = brand?.name ?? "Varumärket";
  const when = endsOnText(license);

  const observation = lapsed
    ? `Licensen på materialet vi gjorde ihop gick ut ${when}, vilket betyder att ${name} inte längre får använda det i sina kanaler. Om det fortfarande presterar hör jag gärna av mig om att förlänga, så slipper ni ta ner något som fungerar.`
    : `Licensen på materialet vi gjorde ihop går ut ${when}, och därefter måste ${name} sluta använda det. Presterar det fortfarande vill jag hellre förlänga i tid än att ni tvingas ta ner en annons som levererar.`;

  return {
    license,
    brandId: license.brand_id,
    brandName: name,
    daysLeft,
    lapsed,
    previousFee: license.fee_sek,
    suggestedFee: suggestedRenewalFee(license, upliftPct),
    subject: lapsed ? `Förlängning av utgången licens` : `Förlängning av licensen som går ut ${when}`,
    observation,
  };
}

/**
 * Alla förnyelselägen värda att agera på just nu: det som snart går ut först,
 * därefter det som redan runnit ut. Licenser med en pågående förnyelseaffär
 * filtreras bort, så att listan aldrig tjatar om något som redan är i rullning.
 */
export function renewalQueue(
  expiring: License[],
  lapsed: License[],
  pitches: Pitch[],
  brands: Brand[],
  today: Date,
  upliftPct: number,
): RenewalProposal[] {
  const byId = new Map(brands.map((b) => [b.id, b]));
  return [...expiring, ...lapsed]
    .filter((l) => !isAlreadyHandled(l, pitches))
    .map((l) => buildRenewalProposal(l, byId.get(l.brand_id), today, upliftPct));
}
