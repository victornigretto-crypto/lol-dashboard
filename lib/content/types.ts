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
  csPerMinTarget: number | null; // cible "bon" CS/min, sert à la couleur (Slice 3)
  deaths10Target: number | null; // cible "bon" morts/10, sert à la couleur (Slice 3)
}
