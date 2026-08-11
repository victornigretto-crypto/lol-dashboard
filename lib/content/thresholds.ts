// Seuils de couleur vert / jaune / rouge, par palier.
//
// C'est la SOURCE UNIQUE des couleurs du tableau et des bandeaux d'analyse.
// Elle remplace l'ancien système (une cible unique par palier dans
// `lib/content/mid.ts`, dont le seuil jaune était déduit par un ratio de 85 %
// ou 115 %) : les seuils sont désormais posés à la main, palier par palier,
// et le CS/min a des seuils DIFFÉRENTS avant et après 20 min.
//
// Deux différences de fond avec l'ancien système :
//  - les seuils dépendent du PALIER SEUL, plus du rôle. Un joueur top ou
//    support a donc maintenant des couleurs, alors que tout ce qui n'était pas
//    mid restait gris faute de contenu écrit.
//  - `unranked` n'a volontairement pas de seuils : sans palier connu, on ne
//    dit rien plutôt que de dire faux (cf. MEMOIRE.md, choix structurants).
import type { Tier } from "./types";

// Un seuil se lit toujours "vert à partir de / jaune à partir de", le rouge
// étant tout le reste. Le sens de comparaison dépend de la stat : plus grand
// est mieux pour le farm, plus petit est mieux pour les morts (cf. lib/stats).
export type StatThreshold = { green: number; yellow: number };

export type TierThresholds = {
  csPre20: StatThreshold;
  csPost20: StatThreshold;
  deaths10: StatThreshold;
  // Nombre de champions TOLÉRÉ sur un même rôle, au-delà duquel le bandeau
  // "trop de champion" passe au rouge. C'est un maximum inclusif : la
  // comparaison est stricte (3 champions en iron = rien, 4 = rouge).
  // Pas de seuil vert ni jaune ici — la demande ne prévoit que l'alerte.
  maxChampions: number;
};

// Les paliers dont le CS/min avant 20 min n'a pas été recalibré gardent
// exactement leur comportement d'avant : l'ancienne cible devient le seuil
// vert, et le seuil jaune reprend la valeur que le ratio de 85 % produisait
// (7.5 -> 6.375, 8.0 -> 6.8). Aucune game ne change de couleur sur ces paliers.
const CS_PRE20_UNCHANGED_75: StatThreshold = { green: 7.5, yellow: 6.375 };
const CS_PRE20_UNCHANGED_80: StatThreshold = { green: 8.0, yellow: 6.8 };

// Émeraude sert de référence à tout ce qui est au-dessus (diamond -> challenger) :
// décision de Victor, faute de seuils propres à ces paliers.
const EMERALD: TierThresholds = {
  csPre20: { green: 8.3, yellow: 7.0 },
  csPost20: { green: 7.5, yellow: 6.0 },
  deaths10: { green: 1.0, yellow: 1.51 },
  maxChampions: 5,
};

export const TIER_THRESHOLDS: Partial<Record<Tier, TierThresholds>> = {
  iron: {
    csPre20: { green: 7.0, yellow: 5.5 },
    csPost20: { green: 6.0, yellow: 5.0 },
    deaths10: { green: 1.0, yellow: 2.0 },
    maxChampions: 3,
  },
  bronze: {
    csPre20: CS_PRE20_UNCHANGED_75,
    csPost20: { green: 6.0, yellow: 5.0 },
    deaths10: { green: 1.0, yellow: 2.0 },
    maxChampions: 3,
  },
  silver: {
    csPre20: CS_PRE20_UNCHANGED_75,
    csPost20: { green: 6.5, yellow: 5.0 },
    deaths10: { green: 1.0, yellow: 1.75 },
    maxChampions: 4,
  },
  gold: {
    csPre20: CS_PRE20_UNCHANGED_80,
    csPost20: { green: 7.0, yellow: 5.5 },
    deaths10: { green: 1.0, yellow: 1.51 },
    maxChampions: 4,
  },
  platinum: {
    csPre20: CS_PRE20_UNCHANGED_80,
    csPost20: { green: 7.5, yellow: 6.0 },
    deaths10: { green: 1.0, yellow: 1.51 },
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
