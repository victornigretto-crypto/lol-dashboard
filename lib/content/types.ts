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

// Les trois champs de réponse d'une game, désignés par la même clé que dans
// `fieldQuestions` : c'est ce qui permet de mettre un CHAMP en avant, et plus
// seulement une stat chiffrée. Certains paliers demandent de se concentrer sur
// une question (« pourquoi tu t'es fait out trade ») plutôt que sur un nombre.
export type FieldKey = "lane" | "fight" | "macro";

export interface TierContent {
  inDevelopment: boolean;
  focusIntro: string;
  focusPoints: string[];
  highlightStats: StatKey[];
  // Même surbrillance clignotante que `highlightStats`, appliquée aux cellules
  // de questions du cockpit. Vide pour les paliers qui ne visent que des stats.
  highlightFields: FieldKey[];
  bucketThemes: { lane?: string; fight?: string; macro?: string };
  fieldQuestions: { lane: string; fight: string; macro: string };
}

// Les cibles chiffrées ne vivent plus ici : elles sont dans
// `lib/content/thresholds.ts`, indexées par palier et non par (rôle, palier),
// avec des seuils distincts avant / après 20 min.
