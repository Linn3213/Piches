import type { Brand, Pitch, Settings } from "@/types/db";
import { economyByBrand, isPaid, isWon, overdueInvoices } from "@/lib/economy";
import { isAlreadyHandled } from "@/lib/renewal";
import { plural } from "@/lib/format";
import { daysBetween, parseDate } from "@/lib/rights";
import type { License } from "@/types/db";
import { licenseState } from "@/lib/rights";

/**
 * Lönsamhetsmotorn.
 *
 * Omsättning säger ingenting om hur en verksamhet mår. Två creators som
 * fakturerar lika mycket kan ha helt olika liv, och skillnaden syns först när
 * man delar intäkten med nedlagd tid.
 *
 * Modulen letar därför inte efter "hur mycket drog jag in" utan efter var
 * pengarna läcker ut, och sätter en siffra på varje läcka. En läcka utan
 * belopp går att skjuta upp i evighet; en läcka som säger "det här kostar dig
 * 14 000 kronor" gör det inte.
 *
 * Allt är rena funktioner på data appen redan har.
 */

export type LeakKind =
  | "under_maltimpenning"
  | "revisionstung"
  | "sen_betalning"
  | "saknad_licens"
  | "outnyttjad_fornyelse"
  | "beroende_av_en_kund"
  | "gratisarbete";

export type Leak = {
  kind: LeakKind;
  title: string;
  /** Vad läckan kostar, i kronor. Null när den inte går att sätta ett pris på. */
  amountSek: number | null;
  why: string;
  action: string;
  severity: "hog" | "medel";
};

const kr = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;

/**
 * Timpenningen är motorns nav. Ligger en kund under målet betalar du i
 * praktiken för att få jobba, och det syns aldrig i en omsättningssiffra.
 */
export function findLeaks({
  pitches,
  brands,
  licenses,
  settings,
  today,
}: {
  pitches: Pitch[];
  brands: Brand[];
  licenses: License[];
  settings: Settings;
  today: Date;
}): Leak[] {
  const leaks: Leak[] = [];
  const namn = (id: string) => brands.find((b) => b.id === id)?.name ?? "Okänd kund";
  const mal = settings.target_hourly_rate;
  const perBrand = economyByBrand(pitches);

  // 1. Kunder under maltimpenningen. Skillnaden mot malet ar vad du forlorar
  //    pa att fortsatta ta uppdraget till samma pris.
  for (const row of perBrand) {
    if (row.hourlyRate === null || row.hours <= 0) continue;
    if (row.hourlyRate >= mal) continue;
    const tappat = (mal - row.hourlyRate) * row.hours;
    if (tappat < 500) continue;
    leaks.push({
      kind: "under_maltimpenning",
      title: `${namn(row.brandId)} ger ${kr(row.hourlyRate)} i timmen`,
      amountSek: tappat,
      why: `Ditt mål är ${kr(mal)} i timmen, och på ${row.hours} nedlagda timmar blir mellanskillnaden ${kr(tappat)}. Fakturan såg bra ut, men tiden åt upp den.`,
      action:
        row.revisionRounds > 2
          ? "Höj priset vid nästa uppdrag och sätt ett tak på antalet revisionsrundor i offerten."
          : "Höj priset vid nästa uppdrag, eller korta ner vad som ingår så att timmarna minskar.",
      severity: tappat > mal * 5 ? "hog" : "medel",
    });
  }

  // 2. Revisionstunga kunder. Varje extra runda ar tid du inte fakturerat.
  for (const row of perBrand) {
    // extraRevisions raknas per affar. Tre affarer med en runda var ar helt
    // normalt och ska inte larma, medan en affar med fyra rundor ska.
    if (row.extraRevisions < 2) continue;
    const extra = row.extraRevisions;
    const kostnad = row.hourlyRate !== null ? extra * 2 * row.hourlyRate : null;
    leaks.push({
      kind: "revisionstung",
      title: `${namn(row.brandId)} har begärt ${plural(row.extraRevisions, "extra revisionsrunda", "extra revisionsrundor")}`,
      amountSek: kostnad,
      why: kostnad
        ? `Räknat på ungefär två timmar per runda är det ${kr(kostnad)} i arbete du inte fått betalt för.`
        : "Rundorna är arbete du inte fakturerat, men utan nedlagda timmar går kostnaden inte att räkna ut.",
      action:
        "Skriv in i offerten att två rundor ingår och att fler debiteras per timme. Det brukar räcka för att antalet ska sjunka av sig självt.",
      severity: "medel",
    });
  }

  // 3. Sena betalningar. Pengar du redan tjanat men inte har.
  const sena = overdueInvoices(pitches, today);
  if (sena.length > 0) {
    const summa = sena.reduce((s, r) => s + (r.pitch.value_sek ?? 0), 0);
    const varst = sena[0];
    leaks.push({
      kind: "sen_betalning",
      title: `${kr(summa)} ligger obetalt över förfallodagen`,
      amountSek: summa,
      why: `Värst är ${namn(varst.pitch.brand_id)} som är ${varst.daysLate} dagar sen. Det är arbete du redan gjort och redan betalat kostnaderna för.`,
      action:
        "Skicka en påminnelse idag. Sätt kortare betalningsvillkor eller delbetalning i förskott för kunder som återkommande drar över.",
      severity: "hog",
    });
  }

  // 4. Levererat utan registrerad licens. Da tickar ingen klocka, och
  //    fornyelsen kommer aldrig upp overhuvudtaget.
  const medLicens = new Set(licenses.map((l) => l.pitch_id));
  const utanLicens = pitches.filter(
    (p) => ["levererat", "fakturerat", "betalt"].includes(p.status) && !medLicens.has(p.id),
  );
  if (utanLicens.length > 0) {
    const underlag = utanLicens.reduce((s, p) => s + (p.value_sek ?? 0), 0);
    leaks.push({
      kind: "saknad_licens",
      title: `${utanLicens.length === 1 ? "Ett levererat uppdrag" : `${utanLicens.length} levererade uppdrag`} saknar registrerade rättigheter`,
      amountSek: null,
      why: `Uppdragen är värda ${kr(underlag)} tillsammans, men utan en licens vet appen inte när kunden måste sluta använda materialet. Då kommer förnyelsen aldrig upp, och det är den intäkten som brukar försvinna utan att någon märker det.`,
      action: "Registrera rättigheterna på uppdragen, så börjar klockan ticka.",
      severity: "hog",
    });
  }

  // 5. Utgangna licenser som aldrig fornyats.
  // Redan omhandertagna licenser ska inte tjata har heller. Utan guarden
  // sager Lonsamhet "skapa fornyelserna" och Rattigheter visar en tom lista,
  // eftersom fornyelsekon filtrerar korrekt men den har inte gjorde det.
  const utgangna = licenses.filter(
    (l) =>
      licenseState(l, today, settings.renewal_lead_days) === "utgangen" &&
      !isAlreadyHandled(l, pitches),
  );
  if (utgangna.length > 0) {
    const varde = utgangna.reduce((s, l) => s + (l.fee_sek ?? 0), 0);
    if (varde > 0) {
      leaks.push({
        kind: "outnyttjad_fornyelse",
        title: `${kr(varde)} i licensintäkt har runnit ut utan att förnyas`,
        amountSek: varde,
        why: "Kunderna betalade det här en gång för material de inte längre får använda. Det är den enklaste försäljningen du har, eftersom de redan vet vad det var värt.",
        action: "Gå till Rättigheter och skapa förnyelserna. Texten är redan skriven.",
        severity: "hog",
      });
    }
  }

  // 6. Beroende av en enda kund.
  const total = perBrand.reduce((s, r) => s + r.won, 0);
  if (perBrand.length > 1 && total > 0) {
    const storst = perBrand[0];
    const andel = storst.won / total;
    if (andel >= 0.5) {
      leaks.push({
        kind: "beroende_av_en_kund",
        title: `${Math.round(andel * 100)} procent av allt kommer från ${namn(storst.brandId)}`,
        // Inget belopp. Det har ar en RISK, inte en kostnad, och tidigare stod
        // kundens hela omsattning under rubriken "Kostar dig" i rott.
        amountSek: null,
        why: "Tappar du den kunden försvinner större delen av omsättningen samma månad, och att bygga upp en ersättare tar månader.",
        action: "Lägg undan tid varje vecka för att pitcha nya kunder, även när det är fullt upp.",
        severity: andel >= 0.65 ? "hog" : "medel",
      });
    }
  }

  // 7. Gratisarbete. Vunna affarer utan belopp.
  const utanBelopp = pitches.filter(
    (p) => ["vunnen", "produktion", "levererat"].includes(p.status) && (p.value_sek ?? 0) === 0,
  );
  if (utanBelopp.length > 0) {
    const timmar = utanBelopp.reduce((s, p) => s + (p.hours_spent ?? 0), 0);
    leaks.push({
      kind: "gratisarbete",
      title: `${utanBelopp.length === 1 ? "Ett uppdrag" : `${utanBelopp.length} uppdrag`} saknar ordervärde`,
      amountSek: timmar > 0 ? timmar * mal : null,
      why:
        timmar > 0
          ? `Det ligger ${timmar} timmar på dem, vilket motsvarar ${kr(timmar * mal)} av din tid utan att något är fakturerat.`
          : "Antingen är beloppet inte ifyllt, eller så gör du jobbet gratis. Båda gör att intäktssiffrorna ljuger.",
      action: "Fyll i ordervärdet, eller ta bort uppdraget om det aldrig blev något.",
      severity: "medel",
    });
  }

  const ordning = { hog: 0, medel: 1 } as const;
  return leaks.sort((a, b) => {
    const s = ordning[a.severity] - ordning[b.severity];
    return s !== 0 ? s : (b.amountSek ?? 0) - (a.amountSek ?? 0);
  });
}

/** Din faktiska timpenning över alla vunna affärer där tid är ifylld. */
export function actualHourlyRate(pitches: Pitch[]): number | null {
  // isWon-filtret ar inte valfritt. En forlorad offert pa 100 000 kr som tog
  // tre timmar gjorde annars att timpenningen sag ut att vara 9 000 kr, och
  // den siffran styr bade malet och varje produktjamforelse.
  const med = pitches.filter(
    (p) => isWon(p) && (p.hours_spent ?? 0) > 0 && p.value_sek !== null,
  );
  if (med.length === 0) return null;
  const timmar = med.reduce((s, p) => s + (p.hours_spent ?? 0), 0);
  const vinst = med.reduce((s, p) => s + (p.value_sek ?? 0) - (p.production_cost_sek ?? 0), 0);
  return timmar > 0 ? vinst / timmar : null;
}

export type MonthlyGoal = {
  target: number;
  /** Inbetalt den senaste hela månaden. */
  current: number;
  gap: number;
  /** Hur många uppdrag till som krävs, med ditt snittordervärde. */
  dealsNeeded: number | null;
  /** Hur många timmar det motsvarar med din faktiska timpenning. */
  hoursNeeded: number | null;
  /** Räcker tiden i en månad till? */
  feasible: boolean | null;
};

/**
 * Vägen till målet, i uppdrag och timmar i stället för i procent. Skillnaden
 * mellan "du ligger 40 procent under" och "det är fyra uppdrag till, alltså
 * 36 timmar" är att bara det andra går att planera in i en vecka.
 */
export function monthlyGoal(
  pitches: Pitch[],
  settings: Settings,
  today: Date,
  hoursAvailablePerMonth = 120,
): MonthlyGoal {
  const target = settings.target_monthly_revenue;

  const forraManaden = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const current = pitches
    .filter((p) => {
      if (!isPaid(p) || !p.paid_on) return false;
      const d = parseDate(p.paid_on);
      return d.getFullYear() === forraManaden.getFullYear() && d.getMonth() === forraManaden.getMonth();
    })
    .reduce((s, p) => s + (p.value_sek ?? 0), 0);

  const gap = Math.max(0, target - current);

  // Variabeln het redan "vunna" men filtrerade inte pa status, sa en forlorad
  // storoffert drog upp snittet och halverade antalet uppdrag som kravdes.
  const vunna = pitches.filter(
    (p) => isWon(p) && p.value_sek !== null && (p.value_sek ?? 0) > 0,
  );
  const snitt =
    vunna.length > 0 ? vunna.reduce((s, p) => s + (p.value_sek ?? 0), 0) / vunna.length : null;
  const timpenning = actualHourlyRate(pitches);

  const dealsNeeded = snitt && snitt > 0 ? Math.ceil(gap / snitt) : null;
  const hoursNeeded = timpenning && timpenning > 0 ? gap / timpenning : null;

  return {
    target,
    current,
    gap,
    dealsNeeded,
    hoursNeeded,
    feasible: hoursNeeded === null ? null : hoursNeeded <= hoursAvailablePerMonth,
  };
}

/** Dagar mellan faktura och betalning, per kund. Avslöjar vilka som drar ut. */
export function slowPayers(
  pitches: Pitch[],
  brands: Brand[],
): { brandId: string; name: string; avgDays: number; deals: number }[] {
  const map = new Map<string, number[]>();
  for (const p of pitches) {
    if (!p.invoiced_on || !p.paid_on) continue;
    const dagar = daysBetween(parseDate(p.invoiced_on), parseDate(p.paid_on));
    map.set(p.brand_id, [...(map.get(p.brand_id) ?? []), dagar]);
  }
  return [...map.entries()]
    .map(([brandId, dagar]) => ({
      brandId,
      name: brands.find((b) => b.id === brandId)?.name ?? "Okänd kund",
      avgDays: dagar.reduce((a, b) => a + b, 0) / dagar.length,
      deals: dagar.length,
    }))
    .sort((a, b) => b.avgDays - a.avgDays);
}
