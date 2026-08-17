// Seuils de couleur par palier, sur QUATRE bandes : rouge, jaune, vert pâle,
// vert foncé.
//
// C'est la SOURCE UNIQUE des couleurs du tableau et des bandeaux d'analyse.
//
// Deux différences de fond avec l'ancien système :
//  - les seuils dépendent du PALIER SEUL, plus du rôle. Un joueur top ou
//    support a donc des couleurs, alors que tout ce qui n'était pas mid restait
//    gris faute de contenu écrit.
//  - `unranked` n'a volontairement pas de seuils : sans palier connu, on ne
//    dit rien plutôt que de dire faux (cf. MEMOIRE.md, choix structurants).
import type { Tier } from "./types";

// Trois points de coupure, donc quatre bandes. Le sens de comparaison dépend
// de la stat (cf. lib/stats) :
//  - farm, plus grand = mieux : `great` <= `good` <= `warn`, et le rouge est
//    tout ce qui passe sous `warn` ;
//  - morts, plus petit = mieux : `great` <= `good` <= `warn`, et le rouge est
//    tout ce qui dépasse `warn`.
//
// L'ordre numérique des trois champs est donc le même dans les deux cas —
// c'est le SENS de la comparaison qui s'inverse, pas la table. Les bornes sont
// inclusives du côté le plus favorable : `great` est atteint À la valeur.
export type StatThreshold = {
  /** Vert foncé — le niveau qu'on qualifie d'excellent pour ce palier. */
  great: number;
  /** Vert pâle — le niveau attendu, celui qu'on donne comme objectif. */
  good: number;
  /** Jaune — en dessous (ou au-dessus pour les morts), c'est rouge. */
  warn: number;
};

export type TierThresholds = {
  csPre20: StatThreshold;
  csPost20: StatThreshold;
  deaths10: StatThreshold;
  // Nombre de champions TOLÉRÉ sur un même rôle, au-delà duquel le bandeau
  // "trop de champions" passe au rouge. C'est un maximum inclusif : la
  // comparaison est stricte (3 champions en iron = rien, 4 = rouge).
  // Pas de bande intermédiaire ici — la demande ne prévoit que l'alerte.
  maxChampions: number;
};

// Émeraude sert de référence à tout ce qui est au-dessus (diamond -> challenger) :
// décision de Victor, faute de seuils propres à ces paliers.
const EMERALD: TierThresholds = {
  csPre20: { great: 8.5, good: 7.5, warn: 6.5 },
  csPost20: { great: 8.0, good: 7.0, warn: 6.0 },
  // Le vert pâle descend jusqu'à 0.5, où le vert foncé prend le relais : les
  // deux bandes se touchent, aucun rythme n'est sans couleur. La grille de
  // départ décrivait le vert pâle comme "entre 1.75 et 1", ce qui laissait la
  // zone 0.5 - 1 sans bande ; Victor l'a tranché en faveur du vert pâle.
  // Platine règle le même problème dans l'autre sens, en remontant son vert
  // foncé à 1.0.
  deaths10: { great: 0.5, good: 1.75, warn: 2.5 },
  maxChampions: 5,
};

export const TIER_THRESHOLDS: Partial<Record<Tier, TierThresholds>> = {
  iron: {
    csPre20: { great: 7.5, good: 6.0, warn: 5.5 },
    csPost20: { great: 7.0, good: 6.0, warn: 5.0 },
    deaths10: { great: 1.0, good: 2.0, warn: 3.0 },
    maxChampions: 3,
  },
  bronze: {
    csPre20: { great: 7.5, good: 7.0, warn: 6.0 },
    csPost20: { great: 7.0, good: 6.0, warn: 5.0 },
    deaths10: { great: 1.0, good: 2.0, warn: 3.0 },
    maxChampions: 3,
  },
  silver: {
    csPre20: { great: 7.5, good: 7.0, warn: 6.5 },
    csPost20: { great: 7.5, good: 6.5, warn: 6.0 },
    deaths10: { great: 1.0, good: 2.0, warn: 2.5 },
    maxChampions: 4,
  },
  gold: {
    csPre20: { great: 8.0, good: 7.0, warn: 6.5 },
    csPost20: { great: 7.5, good: 6.5, warn: 6.0 },
    deaths10: { great: 1.0, good: 2.0, warn: 2.5 },
    maxChampions: 4,
  },
  platinum: {
    csPre20: { great: 8.5, good: 7.0, warn: 6.5 },
    // Platine -> challenger partagent le même farm après 20 min.
    csPost20: { great: 8.0, good: 7.0, warn: 6.0 },
    // Vert foncé remonté de 0.5 à 1.0 pour combler la zone que la grille
    // laissait sans bande : le vert pâle commençant à 1, un rythme entre 0.5
    // et 1 n'appartenait à rien. Émeraude et au-dessus gardent 0.5, et donc
    // gardent ce trou (comblé en vert pâle, faute de mieux).
    deaths10: { great: 1.0, good: 2.0, warn: 2.5 },
    maxChampions: 5,
  },
  emerald: EMERALD,
  diamond: EMERALD,
  master: EMERALD,
  grandmaster: EMERALD,
  challenger: EMERALD,
};

// `null` = palier sans seuils (non classé) : ni couleur, ni bandeau.
export function thresholdsOf(tier: Tier): TierThresholds | null {
  return TIER_THRESHOLDS[tier] ?? null;
}
