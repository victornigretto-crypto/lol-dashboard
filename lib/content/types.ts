export type Role = "mid" | "top" | "jungle" | "adc" | "support";

export type Tier =
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "emerald"
  | "diamond"
  | "master"
  | "grandmaster"
  | "challenger"
  | "unranked";

export type StatKey = "csPre20" | "csPost20" | "deaths10";

export interface TierContent {
  inDevelopment: boolean;
  focusIntro: string;
  focusPoints: string[];
  highlightStats: StatKey[];
  bucketThemes: { lane?: string; fight?: string; macro?: string };
  fieldQuestions: { lane: string; fight: string; macro: string };
}

// Les cibles chiffrées ne vivent plus ici : elles sont dans
// `lib/content/thresholds.ts`, indexées par palier et non par (rôle, palier),
// avec des seuils distincts avant / après 20 min.
