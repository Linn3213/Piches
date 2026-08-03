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

export type PitchStatus =
  | "utkast"
  | "skickad"
  | "svarat"
  | "offert"
  | "vunnen"
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
  value_sek: number | null;
  sent_at: string | null;
  replied_at: string | null;
  follow_up_1_at: string | null;
  follow_up_2_at: string | null;
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
  forlorad: "Förlorad",
  ingen_respons: "Ingen respons",
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
