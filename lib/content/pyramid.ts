import type { Tier } from "./types";

// Pyramide des fondamentaux mid, du bas (base) vers le haut (avancé).
// L'ordre du tableau EST l'ordre d'affichage : index 0 = fondation.
export const MID_PYRAMID: string[] = [
  "Qualité des clics & connaissances de base",
  "La règle du jeu : farm > objectifs > kills",
  "Comprendre ton champion : combo / identité",
  "Comprendre le champion adverse : menace, identité",
  "Protéger sa vie",
  "Jouer les objectifs / jouer avec son jungler",
  "Side lane",
  "Trading",
  "Wave management",
  "Macro mid-game / end-game",
  "Win-conditions",
  "Matchups",
  "Compos / Teamfight",
  "Advanced trading",
];

// TODO Victor : le mapping précis niveau <-> rang n'est pas défini. Ce qui
// suit est un PREMIER JET, déduit des focusPoints déjà écrits dans mid.ts
// (ex. Iron parle de clics, farm et morts -> niveaux 0, 1 et 4). Tout
// l'ajustement se fait ici et nulle part ailleurs : un seul objet, un
// tableau d'indices de MID_PYRAMID par palier.
export const TIER_PYRAMID_LEVELS: Record<Tier, number[]> = {
  iron: [0, 1, 4],
  bronze: [1, 2, 4],
  silver: [2, 3, 5],
  gold: [5, 6],
  platinum: [7, 8],
  emerald: [9, 10],
  diamond: [11],
  master: [12],
  grandmaster: [13],
  challenger: [13],
  unranked: [],
};
