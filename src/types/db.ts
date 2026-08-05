// Speglar supabase/migrations/0001_init.sql.
// Databasen lagrar ASCII-varden, UI:t oversatter till svenska etiketter.

export type BrandStatus =
  | "ny"
  | "researchad"
  | "pitchad"
  | "svarat"
  | "offert"
  | "vunnen"
  | "forlorad"
  | "vilande";

/**
 * Affärens livscykel. Pitchen ÄR affären: den föds som ett utkast och lever
 * hela vägen till betald och förnyad. Stegen efter "vunnen" är det som gör
 * att rättighetsmotorn får data, eftersom det är leveransen som startar
 * licensklockan.
 */
export type PitchStatus =
  | "utkast"
  | "skickad"
  | "svarat"
  | "offert"
  | "vunnen"
  | "produktion"
  | "levererat"
  | "fakturerat"
  | "betalt"
  | "forlorad"
  | "ingen_respons";

export type PitchChannel = "mejl" | "instagram" | "linkedin" | "annat";

export type ActivityKind = "note" | "status" | "pitch" | "svar" | "system";

export type Brand = {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  instagram: string | null;
  contact_name: string | null;
  contact_email: string | null;
  tier: 1 | 2 | 3;
  status: BrandStatus;
  source: string | null;
  observation: string | null;
  notes: string | null;
  next_action_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Pitch = {
  id: string;
  user_id: string;
  brand_id: string;
  status: PitchStatus;
  channel: PitchChannel;
  subject: string | null;
  body: string | null;
  observation: string | null;
  /** Ordervärde exklusive moms. */
  value_sek: number | null;
  sent_at: string | null;
  replied_at: string | null;
  follow_up_1_at: string | null;
  follow_up_2_at: string | null;
  // Affären efter vunnen (0003_deal_lifecycle.sql). Datumen stämplas av en
  // databastrigger vid statusbyte, så de kan inte glömmas bort i UI:t.
  won_at: string | null;
  invoice_number: string | null;
  invoiced_on: string | null;
  due_on: string | null;
  paid_on: string | null;
  /** Vad affären kostade dig i pengar: köpta tjänster, resor, rekvisita. */
  production_cost_sek: number | null;
  /** Din egen nedlagda tid. Utan den går timpenningen inte att räkna. */
  hours_spent: number | null;
  revision_rounds: number;
  /** Föddes den här affären ur en licens som löpte ut? */
  renewed_from_license_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  user_id: string;
  brand_id: string | null;
  pitch_id: string | null;
  kind: ActivityKind;
  body: string | null;
  occurred_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  brand_id: string | null;
  title: string;
  due_at: string | null;
  done_at: string | null;
  created_at: string;
};

// Ordningen har ar pipelinens ordning i UI:t.
export const BRAND_STATUSES: BrandStatus[] = [
  "ny",
  "researchad",
  "pitchad",
  "svarat",
  "offert",
  "vunnen",
  "forlorad",
  "vilande",
];

export const BRAND_STATUS_LABEL: Record<BrandStatus, string> = {
  ny: "Ny",
  researchad: "Researchad",
  pitchad: "Pitchad",
  svarat: "Svarat",
  offert: "Offert ute",
  vunnen: "Vunnen",
  forlorad: "Förlorad",
  vilande: "Vilande",
};

export const PITCH_STATUS_LABEL: Record<PitchStatus, string> = {
  utkast: "Utkast",
  skickad: "Skickad",
  svarat: "Svarat",
  offert: "Offert ute",
  vunnen: "Vunnen",
  produktion: "Produktion",
  levererat: "Levererat",
  fakturerat: "Fakturerat",
  betalt: "Betalt",
  forlorad: "Förlorad",
  ingen_respons: "Ingen respons",
};

/** Kanbanens kolumner, i den ordning affären faktiskt rör sig. */
export const DEAL_PIPELINE: PitchStatus[] = [
  "utkast",
  "skickad",
  "svarat",
  "offert",
  "vunnen",
  "produktion",
  "levererat",
  "fakturerat",
  "betalt",
];

/** Affären lever och kan fortfarande bli pengar. */
export const OPEN_STATUSES: PitchStatus[] = [
  "utkast",
  "skickad",
  "svarat",
  "offert",
  "vunnen",
  "produktion",
  "levererat",
  "fakturerat",
];

/** Affären är avslutad, oavsett hur den slutade. */
export const CLOSED_STATUSES: PitchStatus[] = ["betalt", "forlorad", "ingen_respons"];

/** Affären är vunnen, alltså intäkt (kontrakterad, om än inte betald än). */
export const WON_STATUSES: PitchStatus[] = [
  "vunnen",
  "produktion",
  "levererat",
  "fakturerat",
  "betalt",
];

/** Motparten har hört av sig. Underlaget för svarsfrekvensen. */
export const RESPONDED_STATUSES: PitchStatus[] = [
  "svarat",
  "offert",
  "forlorad",
  ...WON_STATUSES,
];

export const STATUS_HINT: Partial<Record<PitchStatus, string>> = {
  vunnen: "Lägg upp leverablerna och registrera rättigheterna.",
  produktion: "Materialet spelas in och klipps.",
  levererat: "Levererat till kund. Nu tickar licensklockan.",
  fakturerat: "Fakturan är skickad, pengarna har inte kommit än.",
  betalt: "Klar. Licensen bevakas tills den går ut.",
};

export const PITCH_CHANNEL_LABEL: Record<PitchChannel, string> = {
  mejl: "Mejl",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  annat: "Annat",
};

export const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: "Nivå 1",
  2: "Nivå 2",
  3: "Nivå 3",
};

// --- Rättighetsmotorn (0002_rights_engine.sql) ----------------------------

export type DeliverableFormat =
  | "video"
  | "foto"
  | "story"
  | "reel"
  | "tiktok"
  | "ugc_ad"
  | "annat";

export type Channel =
  | "organic_creator"
  | "organic_brand"
  | "paid_social"
  | "whitelisting"
  | "website";

export type Territory = "se" | "norden" | "eu" | "global";

export type Deliverable = {
  id: string;
  user_id: string;
  pitch_id: string;
  brand_id: string;
  title: string;
  format: DeliverableFormat;
  quantity: number;
  delivered_at: string | null;
  approved_at: string | null;
  asset_url: string | null;
  /** Första sekunden. I UGC är hooken inte en anteckning, den är produkten. */
  hook: string | null;
  script: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type License = {
  id: string;
  user_id: string;
  pitch_id: string;
  brand_id: string;
  deliverable_id: string | null;
  channels: Channel[];
  territory: Territory;
  starts_on: string;
  ends_on: string | null;
  perpetual: boolean;
  exclusive_category: string | null;
  exclusivity_ends_on: string | null;
  includes_raw_files: boolean;
  fee_sek: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Settings = {
  user_id: string;
  base_video_rate: number;
  base_photo_rate: number;
  base_story_rate: number;
  brand_organic_uplift_pct: number;
  paid_social_uplift_pct: number;
  whitelisting_uplift_pct: number;
  website_uplift_pct: number;
  exclusivity_uplift_pct: number;
  raw_files_uplift_pct: number;
  perpetuity_uplift_pct: number;
  territory_global_uplift_pct: number;
  rush_fee_pct: number;
  renewal_lead_days: number;
  /** Påslag på förnyelser, eftersom materialet då är beprövat. */
  renewal_uplift_pct: number;
  /** Satt när komigång-guiden är avklarad eller bortvald. */
  onboarded_at: string | null;
  updated_at: string;
};

export const DEFAULT_SETTINGS: Omit<Settings, "user_id" | "updated_at"> = {
  base_video_rate: 4000,
  base_photo_rate: 1500,
  base_story_rate: 1000,
  brand_organic_uplift_pct: 20,
  paid_social_uplift_pct: 60,
  whitelisting_uplift_pct: 40,
  website_uplift_pct: 15,
  exclusivity_uplift_pct: 35,
  raw_files_uplift_pct: 20,
  perpetuity_uplift_pct: 150,
  territory_global_uplift_pct: 30,
  rush_fee_pct: 25,
  renewal_lead_days: 30,
  renewal_uplift_pct: 15,
  onboarded_at: null,
};

export const FORMAT_LABEL: Record<DeliverableFormat, string> = {
  video: "Video",
  foto: "Foto",
  story: "Story",
  reel: "Reel",
  tiktok: "TikTok",
  ugc_ad: "UGC-annons",
  annat: "Annat",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  organic_creator: "Mina egna kanaler",
  organic_brand: "Varumärkets kanaler",
  paid_social: "Betald annonsering",
  whitelisting: "Whitelisting / Spark Ads",
  website: "Webb och e-handel",
};

export const TERRITORY_LABEL: Record<Territory, string> = {
  se: "Sverige",
  norden: "Norden",
  eu: "EU",
  global: "Globalt",
};
