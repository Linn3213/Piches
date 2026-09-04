/**
 * En månad ur en påhittad kreatörs liv.
 *
 * En ny användare mötte en helt tom app: noll uppdrag, noll licenser, noll av
 * allting. För att se vad produkten gör måste hon först knappa in ett
 * varumärke, ett uppdrag, en leverans OCH en licens, alltså en kvart av
 * inmatning innan något syns. Ingen gör det på ett verktyg hon ännu inte vet
 * om hon vill ha, och det är därför en provperiod tar slut utan att någon
 * förstått vad hon provade.
 *
 * Exemplen är byggda för att varje motor ska ha något att visa på en gång:
 * en licens som går ut om nio dagar (radarn och förnyelsekön), en som redan
 * gått ut och aldrig förnyats (missad intäkt), en obetald faktura, ett uppdrag
 * i varje läge i pipen, och tillräckligt med timmar och kostnader för att
 * lönsamhetsmotorn ska hitta riktiga läckor.
 *
 * DATUMEN ÄR RELATIVA till dagen de skapas, så exemplet ser lika färskt ut i
 * december som idag. Ett hårdkodat datum hade gjort att radarn visade noll för
 * alla som provade appen efter en viss dag, alltså precis den funktion som
 * skulle demonstreras.
 *
 * Namnen är påhittade och medvetet blandade. Inget av dem är ett riktigt
 * företag eller en riktig person.
 */

export type ExempelVarumarke = {
  nyckel: string;
  name: string;
  contact_name: string;
  contact_email: string;
  tier: 1 | 2 | 3;
  status: string;
  observation: string;
  instagram: string;
};

export type ExempelUppdrag = {
  nyckel: string;
  varumarke: string;
  status: string;
  subject: string;
  value_sek: number;
  /** Dagar sedan uppdraget skickades. */
  skickatFor: number;
  vunnetFor?: number;
  fakturanummer?: string;
  fakturaFor?: number;
  forfallerOm?: number;
  betaldFor?: number;
  kostnad?: number;
  timmar?: number;
  revideringar?: number;
};

export type ExempelLeverans = {
  nyckel: string;
  uppdrag: string;
  title: string;
  format: string;
  quantity: number;
  levereratFor?: number;
};

export type ExempelLicens = {
  uppdrag: string;
  channels: string[];
  territory: string;
  startadeFor: number;
  /** Positivt = slutar om så många dagar. Negativt = gick ut för så många dagar sedan. */
  slutarOm: number;
  exclusive_category?: string;
  fee_sek: number;
};

export type ExempelUppgift = {
  varumarke: string;
  title: string;
  /** Positivt = förfaller om så många dagar. Negativt = är redan försenad. */
  forfallerOm: number;
};

export const EXEMPEL_VARUMARKEN: ExempelVarumarke[] = [
  {
    nyckel: "nordkust",
    name: "Nordkust Skincare",
    contact_name: "Amira Haddad",
    contact_email: "amira@nordkust.example",
    tier: 1,
    status: "vunnen",
    observation: "Lanserar en ny serumserie och har inget rörligt material alls.",
    instagram: "@nordkustskincare",
  },
  {
    nyckel: "stellar",
    name: "Stellar Studio",
    contact_name: "Nadia Okafor",
    contact_email: "nadia@stellarstudio.example",
    tier: 1,
    status: "vunnen",
    observation: "Återkommande kund sedan i våras, brukar förlänga.",
    instagram: "@stellarstudio",
  },
  {
    nyckel: "vinterbo",
    name: "Vinterbo Beauty",
    contact_name: "Tomas Lindqvist",
    contact_email: "tomas@vinterbo.example",
    tier: 2,
    status: "offert",
    observation: "Kör bara stillbilder i flödet medan konkurrenterna kör reels.",
    instagram: "@vinterbobeauty",
  },
  {
    nyckel: "orkla",
    name: "Orkla Wellness",
    contact_name: "Jonas Berg",
    contact_email: "jonas@orklawellness.example",
    tier: 3,
    status: "svarat",
    observation: "Frågade om whitelisting redan i första mejlet.",
    instagram: "@orklawellness",
  },
  {
    nyckel: "sagaform",
    name: "Sagaform Home",
    contact_name: "Priya Nair",
    contact_email: "priya@sagaform.example",
    tier: 2,
    status: "pitchad",
    observation: "Julkampanjen brukar dra igång i oktober.",
    instagram: "@sagaformhome",
  },
];

export const EXEMPEL_UPPDRAG: ExempelUppdrag[] = [
  {
    nyckel: "serum",
    varumarke: "nordkust",
    status: "fakturerat",
    subject: "Tre reels för serumlanseringen",
    value_sek: 18000,
    skickatFor: 38,
    vunnetFor: 31,
    fakturanummer: "2026-15",
    fakturaFor: 12,
    forfallerOm: 18,
    kostnad: 900,
    timmar: 14,
    revideringar: 1,
  },
  {
    nyckel: "sommar",
    varumarke: "stellar",
    status: "betalt",
    subject: "Sommarkampanj, fyra filmer",
    value_sek: 24000,
    skickatFor: 75,
    vunnetFor: 68,
    fakturanummer: "2026-12",
    fakturaFor: 52,
    forfallerOm: -22,
    betaldFor: 19,
    kostnad: 1400,
    timmar: 21,
    revideringar: 2,
  },
  {
    nyckel: "host",
    varumarke: "stellar",
    status: "produktion",
    subject: "Höstens produktbilder",
    value_sek: 9500,
    skickatFor: 9,
    vunnetFor: 4,
    kostnad: 0,
    timmar: 3,
  },
  {
    nyckel: "reels",
    varumarke: "vinterbo",
    status: "offert",
    subject: "Reels till hudvårdsrutinen",
    value_sek: 14000,
    skickatFor: 5,
  },
  {
    nyckel: "kosttillskott",
    varumarke: "orkla",
    status: "svarat",
    subject: "UGC till kosttillskottslanseringen",
    value_sek: 21000,
    skickatFor: 11,
  },
  {
    nyckel: "jul",
    varumarke: "sagaform",
    status: "skickad",
    subject: "Julkampanj, sex filmer",
    value_sek: 27000,
    skickatFor: 2,
  },
];

export const EXEMPEL_LEVERANSER: ExempelLeverans[] = [
  {
    nyckel: "serum-reel",
    uppdrag: "serum",
    title: "Serumrutin, morgon",
    format: "reel",
    quantity: 3,
    levereratFor: 26,
  },
  {
    nyckel: "sommar-film",
    uppdrag: "sommar",
    title: "Sommarkampanj, huvudfilm",
    format: "video",
    quantity: 4,
    levereratFor: 60,
  },
  {
    nyckel: "host-foto",
    uppdrag: "host",
    title: "Produktbilder höst",
    format: "foto",
    quantity: 12,
  },
];

export const EXEMPEL_LICENSER: ExempelLicens[] = [
  {
    // Den här är hela poängen: nio dagar kvar, alltså mitt i radarns fönster.
    uppdrag: "serum",
    channels: ["organic_brand", "paid_social"],
    territory: "se",
    startadeFor: 26,
    slutarOm: 9,
    exclusive_category: "Hudvård",
    fee_sek: 11000,
  },
  {
    // Redan utgången och aldrig förnyad. Det är den missade intäkten.
    uppdrag: "sommar",
    channels: ["organic_creator", "organic_brand"],
    territory: "norden",
    startadeFor: 60,
    slutarOm: -21,
    fee_sek: 9000,
  },
];

export const EXEMPEL_UPPGIFTER: ExempelUppgift[] = [
  { varumarke: "orkla", title: "Skicka offert på kosttillskotten", forfallerOm: 1 },
  { varumarke: "sagaform", title: "Följ upp julkampanjen", forfallerOm: 3 },
  { varumarke: "vinterbo", title: "Ring Tomas om reels-offerten", forfallerOm: -1 },
];

/** Ett datum så många dagar från idag, som datumsträng. */
export function dagFran(idag: Date, dagar: number): string {
  const d = new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() + dagar);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Samma sak fast som tidsstämpel, för kolumner som vill ha klockslag. */
export function stampelFran(idag: Date, dagar: number): string {
  const d = new Date(idag.getTime() + dagar * 86400000);
  return d.toISOString();
}

/** Hur många kronor exemplet är värt totalt, för texten som beskriver det. */
export function exempletsVarde(): number {
  return EXEMPEL_UPPDRAG.reduce((n, u) => n + u.value_sek, 0);
}
