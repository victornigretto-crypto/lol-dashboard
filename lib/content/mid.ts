import type { Role, Tier, TierContent } from "./types";

// Contenu servi dès qu'un couple (rôle, palier) n'est pas encore écrit :
// libellés génériques, aucune cible, donc aucune couleur ni surlignage.
export const FALLBACK_CONTENT: TierContent = {
  inDevelopment: true,
  focusIntro: "En cours de développement",
  focusPoints: [],
  highlightStats: [],
  bucketThemes: {},
  fieldQuestions: { lane: "Erreur en lane", fight: "Erreur en fight", macro: "Erreur de macro" },
};

const MID_CONTENT: Partial<Record<Tier, TierContent>> = {
  iron: {
    inDevelopment: false,
    focusIntro: "En tant que joueur Iron, il faut que tu te concentres sur les points suivants :",
    focusPoints: [
      "La qualité de tes clics : beaucoup de joueurs Iron respectent mal la distance de sécurité à garder avec le vis-à-vis.",
      "Le farm : tu dois viser plus de 7 CS/min, et ce toute la partie.",
      "Les morts : tu dois mourir peu ! Push les waves, tape les tours, tout en protégeant ta vie.",
    ],
    highlightStats: ["csPre20", "csPost20", "deaths10"],
    bucketThemes: { lane: "Placements & clics" },
    fieldQuestions: {
      lane: "Comment et pourquoi es-tu mort en lane ?",
      fight: "Comment et pourquoi es-tu mort en fight ?",
      macro: "As-tu détruit des tours ? Ou Aram mid ?",
    },
  },
  bronze: {
    inDevelopment: false,
    focusIntro:
      "En bronze, beaucoup de joueurs pensent que ce qui leur fait défaut, ce sont des concepts avancés, alors que souvent les bases ne sont pas maîtrisées :",
    focusPoints: [
      "Tu dois viser plus de 7.5 CS/min lors de toutes les phases de la partie.",
      "Tu dois mourir peu, ne jamais feed ton adversaire.",
      "Tu dois maîtriser les combos de ton champion : regarde un guide YouTube de ton champion et vérifie sur tes replays si tu fais les combos correctement.",
    ],
    highlightStats: ["csPre20", "csPost20", "deaths10"],
    bucketThemes: { lane: "Qualité des combos" },
    fieldQuestions: {
      lane: "As-tu réussi tes combos ?",
      fight: "Pourquoi et comment es-tu mort en fight ?",
      macro: "As-tu cassé des tours ? Ou Aram mid ?",
    },
  },
  silver: {
    inDevelopment: false,
    focusIntro: "En silver, il faut que tu commences à avoir une notion des matchups et de la macro :",
    focusPoints: [
      "Tu ne dois plus rater de combos.",
      "Tu dois connaître le champion adverse et ne plus te laisser surprendre par son combo ou ses power spikes.",
      "Tu dois commencer à jouer les objectifs.",
    ],
    highlightStats: ["deaths10"],
    bucketThemes: { lane: "Morts ou combos ratés", macro: "Objectifs non joués" },
    fieldQuestions: {
      lane: "Es-tu mort en lane ? Pourquoi ?",
      fight: "As-tu été pris sur un timing d'objectif ? Pourquoi ?",
      macro: "As-tu oublié de jouer un objectif ? Lequel ?",
    },
  },
  gold: {
    inDevelopment: false,
    focusIntro: "En gold, il faut que tu apprennes le 2v2 mid-jungle et que tu joues tous les objectifs :",
    focusPoints: [
      "Tu ne dois plus faire de morts inutiles.",
      "Tu dois contester tous les objectifs en pushant ta lane avant.",
      "Tu dois jouer sur le side de ton jungler et t'adapter à ses plays.",
      "Tu dois side lane après 14 min et maintenir un farm haut en mid/end game.",
    ],
    highlightStats: ["deaths10", "csPost20"],
    bucketThemes: { macro: "Objectifs non joués" },
    fieldQuestions: {
      lane: "Es-tu mort en lane ? Pourquoi ?",
      fight: "As-tu contesté les objectifs ?",
      macro: "As-tu side lane après 14 min ?",
    },
  },
  platinum: {
    inDevelopment: false,
    focusIntro: "En platine, tu dois parfaire ton trading et ton wave management :",
    focusPoints: [
      "Analyse les patterns de trading pendant la champ select.",
      "Ta connaissance des matchups doit s'affiner : tu ne dois plus taper les waves sans réfléchir.",
      "Réfléchis toujours avant de taper la wave : tu dois avoir une stratégie de wave management.",
      "Conteste tous les objectifs.",
    ],
    highlightStats: [],
    bucketThemes: {
      lane: "Faute de trading / Wave management",
      fight: "Mort sur un timing objectif",
      macro: "Objectifs non gagnés",
    },
    fieldQuestions: {
      lane: "As-tu loupé un trade ? As-tu maîtrisé ton wave management ?",
      fight: "Comment et pourquoi es-tu mort en fight ?",
      macro: "Pourquoi as-tu loupé tes objectifs ?",
    },
  },
  emerald: {
    inDevelopment: false,
    focusIntro:
      "L'émeraude est la ligue de la macro et du fighting : ta compréhension du jeu doit aller plus loin que ta lane.",
    focusPoints: [
      "Joue ta game en fonction du scaling : si ta team scale, ralentis la partie ; sinon, accélère-la.",
      "Joue toujours sur ton side qui gagne, ward-le et fight dessus.",
      "Conteste la mid wave avant les objectifs et place-toi bien pour le fight.",
      "Ne sabote plus de game : réfléchis au prochain objectif avant de perdre.",
    ],
    highlightStats: [],
    bucketThemes: {
      lane: "Mort d'un gank ou play weak side",
      fight: "Mauvais placement ou absence",
      macro: "Game throw",
    },
    fieldQuestions: {
      lane: "Es-tu mort d'un gank ? Pourquoi ?",
      fight: "Comment es-tu mort en fight ?",
      macro: "As-tu throw ta game, ou failli la throw ? Comment ?",
    },
  },
};

// Paliers classés, du plus bas au plus haut. Source unique : sert à la fois
// de table de conversion pour `tierFromRiotTier` et d'ordre d'affichage
// (pyramide de l'onboarding, voisins n-1 / n+1).
export const RANKED_TIERS: Tier[] = [
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "emerald",
  "diamond",
  "master",
  "grandmaster",
  "challenger",
];

// Convertit le tier brut de league-v4 (IRON, BRONZE, ... ; null/absent =
// non classé) vers le type Tier utilisé par le contenu. Pas de mapping
// existant dans lib/riot/rank.ts (uniquement des helpers de libellé/emblème),
// donc défini ici plutôt que dupliqué.
export function tierFromRiotTier(rawTier: string | null | undefined): Tier {
  if (!rawTier) return "unranked";
  const normalized = rawTier.toLowerCase();
  return (RANKED_TIERS as string[]).includes(normalized) ? (normalized as Tier) : "unranked";
}

export function getContent(role: Role, tier: Tier): TierContent {
  if (role !== "mid") return FALLBACK_CONTENT;
  return MID_CONTENT[tier] ?? FALLBACK_CONTENT;
}
