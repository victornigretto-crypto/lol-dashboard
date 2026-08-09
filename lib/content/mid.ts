// Bibliothèque de contenu pédagogique pour le rôle Mid, par palier de rang.
// Seuls les paliers Iron→Emerald sont couverts pour l'instant (les rangs les
// plus fréquents chez les joueurs qu'on coache) ; Diamant et au-dessus, ainsi
// que les autres rôles (Top/Jungle/Bot/Support), affichent "en développement"
// tant que leur contenu n'a pas été écrit.

export type MidTier = "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD";

export const MID_TIERS: MidTier[] = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD"];

// Seuils de CS/min utilisés pour situer une performance par rapport à son
// propre palier plutôt que sur une échelle unique valable pour tout le monde.
export type CsPerMinThresholds = {
  poor: number; // en dessous : franchement à la traîne pour ce palier
  average: number; // au-dessus : dans la moyenne du palier
  good: number; // au-dessus : au-dessus du lot pour ce palier
};

export type MidTierContent = {
  tier: MidTier;
  // Texte court expliquant sur quoi se concentrer en priorité à ce palier.
  focus: string;
  // KPI à surligner dans l'analyse pour ce palier.
  kpis: string[];
  // Les 3 questions posées au joueur pour remplir error_lane/error_macro/error_fight.
  questions: {
    lane: string;
    macro: string;
    fight: string;
  };
  csPerMin: CsPerMinThresholds;
};

const MID_CONTENT: Record<MidTier, MidTierContent> = {
  IRON: {
    tier: "IRON",
    focus:
      "La base avant tout : apprends à last-hit proprement et à rester en vie. Le reste (macro, roams) ne sert à rien si tu meurs pour rien en lane.",
    kpis: ["CS/min avant 20", "Morts/10min", "Victoire/Défaite"],
    questions: {
      lane: "Combien de sbires as-tu manqués parce que tu étais occupé à harass/regarder la minimap ?",
      macro: "As-tu quitté ta lane avant d'avoir un plan clair (objectif visible, allié ping, etc.) ?",
      fight: "Es-tu mort en allant chercher un kill qui n'était pas nécessaire ?",
    },
    csPerMin: { poor: 4, average: 5, good: 6 },
  },
  BRONZE: {
    tier: "BRONZE",
    focus:
      "Le farm commence à être correct : le prochain palier, c'est arrêter de mourir en solo sans raison et commencer à regarder ce qui se passe ailleurs sur la carte.",
    kpis: ["CS/min avant 20", "Morts/10min", "Diversité de champions"],
    questions: {
      lane: "As-tu perdu du CS en repoussant ta wave au mauvais moment (avant un reset, avant une roam ennemie) ?",
      macro: "As-tu regardé le score des autres lanes avant de décider de roam ou de push ?",
      fight: "Le fight que tu as perdu, est-ce que tu avais l'avantage de sorts/summoners avant de t'engager ?",
    },
    csPerMin: { poor: 4.5, average: 5.5, good: 6.5 },
  },
  SILVER: {
    tier: "SILVER",
    focus:
      "Ton farm est stable, mais tu perds encore des games sur des décisions de macro : freeze/push mal choisis, roams qui arrivent trop tard ou trop tôt.",
    kpis: ["CS/min avant 20", "CS/min après 20", "Morts/10min"],
    questions: {
      lane: "As-tu correctement lu le state de lane (freeze/push/slow push) avant d'agir ?",
      macro: "Ta roam a-t-elle changé quelque chose (kill, objectif, tempo), ou as-tu juste perdu du CS pour rien ?",
      fight: "As-tu vérifié la vision/les cooldowns adverses avant de t'engager dans ce fight ?",
    },
    csPerMin: { poor: 5, average: 6, good: 7 },
  },
  GOLD: {
    tier: "GOLD",
    focus:
      "Tu maîtrises les fondamentaux : le vrai levier de progression maintenant, c'est le mid-jungle synergy et la conversion des avantages en objectifs.",
    kpis: ["CS/min après 20", "Morts/10min", "Winrate"],
    questions: {
      lane: "As-tu communiqué/joué avec ton jungler (invade, gank, contre-gank) plutôt que jouer ta lane isolée ?",
      macro: "Ton avantage en lane s'est-il traduit en objectif (tour, dragon, herald) dans les 2 minutes qui ont suivi ?",
      fight: "As-tu forcé un fight alors que ton équipe n'était pas groupée/prête ?",
    },
    csPerMin: { poor: 5.5, average: 6.5, good: 7.5 },
  },
  PLATINUM: {
    tier: "PLATINUM",
    focus:
      "Le mécanique est solide : ce qui te bloque, c'est la prise de décision en late game (teamfights, split push, quand jouer safe vs. all-in).",
    kpis: ["CS/min après 20", "Deaths en late game", "Diversité de champions"],
    questions: {
      lane: "As-tu adapté ton item build/rune en fonction du matchup et de la comp adverse ?",
      macro: "As-tu correctement évalué si c'était le moment de grouper ou de split push ?",
      fight: "Dans le teamfight décisif, as-tu joué ton rôle (peel, dive carry, poke) ou as-tu improvisé ?",
    },
    csPerMin: { poor: 6, average: 7, good: 8 },
  },
  EMERALD: {
    tier: "EMERALD",
    focus:
      "Tu es proche du niveau où les détails font la différence : macro d'équipe, vision autour des objectifs, et consistance sur plusieurs games d'affilée.",
    kpis: ["CS/min après 20", "Vision autour des objectifs", "Winrate sur les 10 dernières"],
    questions: {
      lane: "Ton pick de champion correspondait-il à ce que ta comp d'équipe avait besoin (dégâts, engage, peel) ?",
      macro: "As-tu posé/nettoyé la vision autour des objectifs avant qu'ils ne spawn ?",
      fight: "As-tu tilté après une mort et pris une décision impulsive juste après ?",
    },
    csPerMin: { poor: 6.5, average: 7.5, good: 8.5 },
  },
};

// Renvoie le contenu pour un palier donné, ou null si ce palier n'est pas
// encore couvert (Diamant+, ou toute valeur inconnue) : à afficher comme
// "en développement" côté UI.
export function getMidTierContent(tier: string): MidTierContent | null {
  const normalized = tier.toUpperCase();
  if ((MID_TIERS as string[]).includes(normalized)) {
    return MID_CONTENT[normalized as MidTier];
  }
  return null;
}
