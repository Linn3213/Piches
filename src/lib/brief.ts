import type { Channel, DeliverableFormat, Territory } from "@/types/db";

/**
 * Brief-läsaren.
 *
 * En förfrågan kommer nästan alltid som löpande text i ett mejl eller ett DM,
 * och det som avgör vad uppdraget är värt ligger utspritt i den texten:
 * antal filmer, hur länge de får användas, om de ska köra annonser, om du
 * binds mot konkurrenter. Att läsa av det för hand är både långsamt och den
 * vanligaste anledningen till att ett uppdrag prissätts för lågt, eftersom
 * rättigheterna glöms bort och bara produktionen räknas.
 *
 * Modulen läser texten och plockar ut det den känner igen. Den gissar aldrig
 * i det tysta: det som inte hittas hamnar i `missing`, och formuleringar som
 * är dyrare än de låter hamnar i `flags`. Allt är rena funktioner på en sträng
 * så att de går att testa, och gränssnittet visar alltid resultatet för
 * granskning innan något sparas.
 *
 * Implementationen är avsiktligt regelbaserad och kostar ingenting att köra.
 * Vill man senare lägga en språkmodell ovanpå är sömmen `extractBrief`, som
 * bara behöver returnera samma form.
 */

export type BriefFlag = {
  /** Formuleringen i kundens text som utlöste varningen. */
  match: string;
  /** Vad den betyder, och varför den påverkar priset. */
  why: string;
  severity: "hog" | "medel";
};

export type BriefExtraction = {
  deliverables: { format: DeliverableFormat; quantity: number }[];
  channels: Channel[];
  territory: Territory | null;
  durationMonths: number | null;
  perpetual: boolean;
  exclusiveCategory: string | null;
  includesRawFiles: boolean;
  budgetSek: number | null;
  deadline: string | null;
  rush: boolean;
  /** Det som behövs för ett pris men inte gick att läsa ut. */
  missing: string[];
  flags: BriefFlag[];
};

const SIFFERORD: Record<string, number> = {
  en: 1, ett: 1, två: 2, tva: 2, tre: 3, fyra: 4, fem: 5, sex: 6,
  sju: 7, åtta: 8, atta: 8, nio: 9, tio: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10,
};

/** "3" eller "tre" till ett tal. Okänt ord ger null. */
function tolkaAntal(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n > 0 && n <= 999 ? n : null;
  }
  return SIFFERORD[t] ?? null;
}

const FORMAT_ORD: { format: DeliverableFormat; ord: string[] }[] = [
  { format: "reel", ord: ["reel", "reels"] },
  { format: "tiktok", ord: ["tiktok", "tiktoks", "tik tok"] },
  { format: "story", ord: ["story", "stories", "storys"] },
  { format: "foto", ord: ["foto", "foton", "bild", "bilder", "photo", "photos", "still", "stills"] },
  { format: "ugc_ad", ord: ["ugc-annons", "ugc annons", "ugc-video", "ugc video", "ugc-ad", "ugc ad", "ugc"] },
  { format: "video", ord: ["video", "videos", "videor", "film", "filmer", "klipp"] },
];

/**
 * Hittar mönster som "3 videos", "tre reels", "2 st TikTok". Antalet står i
 * praktiken alltid före formatet i både svenska och engelska briefer.
 */
export function extractDeliverables(text: string): { format: DeliverableFormat; quantity: number }[] {
  const t = text.toLowerCase();
  const funna = new Map<DeliverableFormat, number>();

  for (const { format, ord } of FORMAT_ORD) {
    for (const o of ord) {
      // "3 videos", "tre st videos", "3st video"
      const re = new RegExp(
        `(\\d+|${Object.keys(SIFFERORD).join("|")})\\s*(?:st\\.?|stycken|x)?\\s*${o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "g",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        const antal = tolkaAntal(m[1]);
        if (antal === null) continue;
        // Storsta trafften vinner: "3 videos" och senare "videos" ska inte
        // bli 4, och ett format ska inte raknas dubbelt via tva synonymer.
        funna.set(format, Math.max(funna.get(format) ?? 0, antal));
      }
    }
  }

  // ugc_ad och video overlappar i text ("3 UGC-videos"). Har bada trippat pa
  // samma antal ar det nastan alltid samma sak, och da vinner den mer
  // specifika tolkningen.
  if (funna.has("ugc_ad") && funna.get("ugc_ad") === funna.get("video")) {
    funna.delete("video");
  }

  return [...funna.entries()].map(([format, quantity]) => ({ format, quantity }));
}

const KANAL_ORD: { channel: Channel; ord: string[] }[] = [
  { channel: "paid_social", ord: ["paid social", "betald annonsering", "betalda annonser", "meta ads", "facebook ads", "instagram ads", "tiktok ads", "annonsering", "ads", "paid media", "performance"] },
  { channel: "whitelisting", ord: ["whitelisting", "whitelist", "spark ads", "sparkads", "partnership ads", "branded content ads"] },
  { channel: "organic_brand", ord: ["egna kanaler", "våra kanaler", "vara kanaler", "brand channels", "organic", "organiskt", "repost", "reposta", "dela på", "our channels"] },
  { channel: "website", ord: ["hemsida", "webbplats", "webshop", "e-handel", "produktsida", "produktsidor", "website", "landing page", "nyhetsbrev", "newsletter"] },
  { channel: "organic_creator", ord: ["din kanal", "dina kanaler", "ditt konto", "your channel", "your account", "på din profil"] },
];

export function extractChannels(text: string): Channel[] {
  const t = text.toLowerCase();
  const funna: Channel[] = [];
  for (const { channel, ord } of KANAL_ORD) {
    if (ord.some((o) => t.includes(o))) funna.push(channel);
  }
  return funna;
}

const TERRITORY_ORD: { territory: Territory; ord: string[] }[] = [
  { territory: "global", ord: ["globalt", "global", "worldwide", "hela världen", "alla marknader", "all markets"] },
  { territory: "eu", ord: [" eu ", "europa", "europe", "eu-marknaden"] },
  { territory: "norden", ord: ["norden", "nordisk", "nordics", "nordic", "skandinavien", "scandinavia"] },
  { territory: "se", ord: ["sverige", "svenska marknaden", "sweden"] },
];

export function extractTerritory(text: string): Territory | null {
  const t = ` ${text.toLowerCase()} `;
  for (const { territory, ord } of TERRITORY_ORD) {
    if (ord.some((o) => t.includes(o))) return territory;
  }
  return null;
}

/** "6 månader", "ett år", "12 months", "6 mån". */
export function extractDuration(text: string): { months: number | null; perpetual: boolean } {
  const t = text.toLowerCase();

  const evigt = [
    "i all framtid", "all framtid", "obegränsad tid", "obegransad tid", "för alltid",
    "for alltid", "evig", "evigt", "perpetual", "in perpetuity", "forever",
    "unlimited time", "buyout", "full buyout", "total buyout",
  ];
  if (evigt.some((o) => t.includes(o))) return { months: null, perpetual: true };

  const arMatch = t.match(new RegExp(`(\\d+|${Object.keys(SIFFERORD).join("|")})\\s*(?:år|ar|years?)\\b`));
  if (arMatch) {
    const n = tolkaAntal(arMatch[1]);
    if (n !== null) return { months: n * 12, perpetual: false };
  }

  const manMatch = t.match(
    new RegExp(`(\\d+|${Object.keys(SIFFERORD).join("|")})\\s*(?:månader|manader|månad|manad|mån\\.?|man\\.?|months?)\\b`),
  );
  if (manMatch) {
    const n = tolkaAntal(manMatch[1]);
    if (n !== null) return { months: n, perpetual: false };
  }

  return { months: null, perpetual: false };
}

/** Branschen kunden vill binda upp, om den nämns i samma mening som exklusivitet. */
export function extractExclusivity(text: string): string | null {
  const t = text.toLowerCase();
  if (!/exklusiv|exclusiv|konkurrent|competitor/.test(t)) return null;

  const branscher = [
    "hudvård", "hudvard", "skincare", "makeup", "smink", "hår", "har", "haircare",
    "kosttillskott", "supplements", "träning", "traning", "fitness", "mode", "fashion",
    "inredning", "interior", "mat", "food", "dryck", "beverage", "teknik", "tech",
    "resor", "travel", "bil", "automotive", "finans", "finance", "skönhet", "skonhet", "beauty",
  ];
  for (const b of branscher) {
    if (t.includes(b)) return b;
  }
  // Exklusivitet namns men inte vilken bransch. Markera att den behover fyllas i.
  return "";
}

export function extractBudget(text: string): number | null {
  const t = text.toLowerCase().replace(/ /g, " ");
  // "15 000 kr", "15.000 SEK", "15000:-", "budget: 15000".
  // Ordgränsen sätts bara efter bokstavssuffixen: ":-" slutar på ett
  // icke-ordtecken, och ett \b efter det kan aldrig matcha i slutet av en
  // sträng, vilket tyst gjorde att "12 500:-" inte hittades alls.
  const re = /(\d[\d\s.,]{2,})\s*(?::-|kr\b|sek\b|kronor\b)/g;
  const belopp: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const n = Number(m[1].replace(/[\s.]/g, "").replace(",", "."));
    if (Number.isFinite(n) && n >= 100 && n <= 10_000_000) belopp.push(n);
  }
  if (belopp.length === 0) return null;
  // Hogsta beloppet ar nastan alltid totalbudgeten snarare an en delpost.
  return Math.max(...belopp);
}

/** ISO-datum eller "senast 12 september". Returnerar YYYY-MM-DD. */
export function extractDeadline(text: string, today: Date): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const manader = [
    "januari", "februari", "mars", "april", "maj", "juni",
    "juli", "augusti", "september", "oktober", "november", "december",
  ];
  const re = new RegExp(`\\b(\\d{1,2})\\s*(?:\\.|:e)?\\s*(${manader.join("|")})\\b`, "i");
  const m = text.toLowerCase().match(re);
  if (!m) return null;

  const dag = Number(m[1]);
  const manadIndex = manader.indexOf(m[2]);
  if (dag < 1 || dag > 31 || manadIndex < 0) return null;

  // Ar utelamnas nastan alltid. Ett datum som redan passerat avser nasta ar.
  let ar = today.getFullYear();
  const kandidat = new Date(ar, manadIndex, dag);
  if (kandidat < new Date(today.getFullYear(), today.getMonth(), today.getDate())) ar += 1;

  return `${ar}-${String(manadIndex + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

const FLAGGOR: { ord: string[]; why: string; severity: "hog" | "medel" }[] = [
  {
    ord: ["i all framtid", "obegränsad tid", "obegransad tid", "perpetual", "in perpetuity", "för alltid", "for alltid", "forever"],
    why: "De ber om en evig licens. Materialet kan då aldrig säljas igen, så det bör kosta väsentligt mer än en tidsbegränsad licens.",
    severity: "hog",
  },
  {
    ord: ["buyout", "full buyout", "total buyout", "köper rättigheterna", "koper rattigheterna", "all rights"],
    why: "Buyout betyder i praktiken evig licens i alla kanaler. Kontrollera exakt vad som ingår innan du sätter ett pris.",
    severity: "hog",
  },
  {
    ord: ["whitelisting", "spark ads", "partnership ads", "branded content ads"],
    why: "Annonsen går från ditt eget konto, alltså lånar de din trovärdighet och din publik. Det är ett eget påslag utöver annonsrätten.",
    severity: "hog",
  },
  {
    ord: ["exklusiv", "exclusiv", "inte jobba med konkurrent", "no competitors"],
    why: "Du binds från att ta uppdrag i samma bransch under perioden, alltså tackar du nej till intäkter du inte kan räkna på i förväg.",
    severity: "hog",
  },
  {
    ord: ["obegränsat antal revideringar", "obegransat antal revideringar", "unlimited revisions", "tills vi är nöjda", "tills vi ar nojda", "until we are happy"],
    why: "Utan tak på revisionsrundor kan tiden växa fritt efter att priset är satt. Sätt ett tak, till exempel två rundor.",
    severity: "hog",
  },
  {
    ord: ["råmaterial", "ramaterial", "raw files", "råfiler", "rafiler", "source files", "projektfiler"],
    why: "Får de råmaterialet kan de klippa om det till nya annonser utan dig. Det är ett eget påslag.",
    severity: "medel",
  },
  {
    ord: ["alla kanaler", "all channels", "samtliga kanaler", "överallt", "overallt", "wherever"],
    why: "Formuleringen är obegränsad. Räkna upp kanalerna i avtalet i stället, annars gäller den bredaste tolkningen.",
    severity: "medel",
  },
  {
    ord: ["asap", "snarast", "omgående", "omgaende", "brådskande", "bradskande", "i veckan", "urgent", "rush"],
    why: "Kort varsel tränger undan annat arbete och motiverar ett expresstillägg.",
    severity: "medel",
  },
  {
    ord: [
      "gratis produkt", "mot produkt", "mot produkter", "in exchange for product",
      "gifting", "produkt som ersättning", "produkt som ersattning",
      "produkter som ersättning", "produkter som ersattning", "som ersättning",
    ],
    why: "Ersättning i produkter är fortfarande skattepliktig intäkt, och täcker sällan din nedlagda tid. Räkna om den till kronor.",
    severity: "hog",
  },
  {
    ord: ["förlängning", "forlangning", "option", "möjlighet att förlänga", "mojlighet att forlanga", "extend"],
    why: "De vill kunna förlänga senare. Sätt priset för förlängningen redan nu, annars förhandlas det när du står svagare.",
    severity: "medel",
  },
];

export function extractFlags(text: string): BriefFlag[] {
  const t = text.toLowerCase();
  const funna: BriefFlag[] = [];
  for (const f of FLAGGOR) {
    const traff = f.ord.find((o) => t.includes(o));
    if (traff) funna.push({ match: traff, why: f.why, severity: f.severity });
  }
  return funna;
}

/**
 * Läser hela briefen. Allt som inte gick att läsa ut listas i `missing`,
 * eftersom en tyst gissning är farligare än ett tomt fält: priset bygger på
 * de här uppgifterna, och saknas de ska du fylla i dem själv.
 */
export function extractBrief(text: string, today: Date): BriefExtraction {
  const deliverables = extractDeliverables(text);
  const channels = extractChannels(text);
  const territory = extractTerritory(text);
  const { months, perpetual } = extractDuration(text);
  const exclusiveCategory = extractExclusivity(text);
  const flags = extractFlags(text);
  const includesRawFiles = /råmaterial|ramaterial|raw files|råfiler|rafiler|source files|projektfiler/i.test(text);
  const budgetSek = extractBudget(text);
  const deadline = extractDeadline(text, today);
  const rush = flags.some((f) => f.why.includes("expresstillägg"));

  const missing: string[] = [];
  if (deliverables.length === 0) missing.push("Vad som ska levereras");
  if (channels.length === 0) missing.push("Var materialet får användas");
  if (!perpetual && months === null) missing.push("Hur länge licensen gäller");
  if (territory === null) missing.push("Vilken marknad");
  if (budgetSek === null) missing.push("Budget");
  if (exclusiveCategory === "") missing.push("Vilken bransch exklusiviteten gäller");

  return {
    deliverables,
    channels,
    territory,
    durationMonths: months,
    perpetual,
    exclusiveCategory: exclusiveCategory || null,
    includesRawFiles,
    budgetSek,
    deadline,
    rush,
    missing,
    flags,
  };
}
