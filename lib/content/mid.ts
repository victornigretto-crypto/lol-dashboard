import type { Role, Tier, TierContent } from "./types";

// Contenu servi dès qu'un couple (rôle, palier) n'est pas encore écrit :
// libellés génériques, aucune cible, donc aucune couleur ni surlignage.
export const FALLBACK_CONTENT: TierContent = {
  inDevelopment: true,
  focusIntro: "En cours de développement",
  focusPoints: [],
  highlightStats: [],
  highlightFields: [],
  bucketThemes: {},
  fieldQuestions: { lane: "Erreur en lane", fight: "Erreur en fight", macro: "Erreur de macro" },
};

const MID_CONTENT: Partial<Record<Tier, TierContent>> = {
  iron: {
    inDevelopment: false,
    focusIntro:
      "En Iron, tu dois te concentrer sur la qualité de tes clics, ton farm et la maîtrise de ton champion. De plus, tu ne dois jamais feed ton adversaire.",
    focusPoints: [
      "La qualité de tes clics : beaucoup de joueurs Iron respectent mal la distance de sécurité à garder avec le vis-à-vis.",
      "Le farm : Tu dois viser plus de 7 CS/min, et ce, toute la partie.",
      "Taper la tour : Si la tour adverse n'est pas défendue, prends-la",
      "Les morts : tu dois mourir peu. Vise 1 mort toutes les 10 minutes",
    ],
    highlightStats: ["csPre20", "csPost20", "deaths10"],
    highlightFields: [],
    bucketThemes: { lane: "Placements & clics" },
    fieldQuestions: {
      lane: "Quelle est la raison de ta mort en lane ?",
      fight: "Quelle est la raison de tes morts en fights ?",
      macro: "As-tu cassé une tour non défendue ?",
    },
  },
  bronze: {
    inDevelopment: false,
    focusIntro:
      "En bronze, tu dois te concentrer sur ton farm, le fait de détruire des tours et la qualité de tes combos. De plus, tu ne dois jamais feed ton adversaire.",
    focusPoints: [
      "Le farm : Tu dois viser plus de 7.5 CS/min",
      "Les morts : Tu dois viser 1 mort par 10 minutes",
      "Les combos : Regarde un guide sur ton champion, vérifie sur le replay que tu fais bien tes combos",
    ],
    highlightStats: ["csPre20", "csPost20", "deaths10"],
    highlightFields: [],
    bucketThemes: { lane: "Qualité des combos" },
    fieldQuestions: {
      lane: "As-tu raté des combos ? Quelle est la raison de tes morts en lane ?",
      fight: "Quelle est la raison de tes morts en fights ?",
      macro: "As-tu cassé des tours ? Ou Aram mid ?",
    },
  },
  silver: {
    inDevelopment: false,
    focusIntro:
      "En silver, tu dois comprendre comment fonctionne le champion adverse et ne plus te faire avoir par son style de jeu. Tu dois aussi commencer à contester les objectifs",
    focusPoints: [
      "Le farm : Tu dois viser plus de 7.5 CS/min",
      "Les morts : Tu ne dois pas te faire avoir en lane par le champion adverse",
      "Les objectifs : À partir de 8 minutes, tu dois contester les objectifs",
    ],
    highlightStats: ["deaths10", "csPost20"],
    highlightFields: ["lane"],
    bucketThemes: { lane: "Morts ou combos ratés", macro: "Objectifs non joués" },
    fieldQuestions: {
      lane: "Quelle est la cause de tes morts en lane ?",
      fight: "As-tu été mort alors qu'un objectif était en train de spawn ?",
      macro: "As-tu oublié de jouer un objectif ?",
    },
  },
  gold: {
    inDevelopment: false,
    focusIntro:
      "En gold, tu dois apprendre à jouer avec ton jungler mais également jouer en fonction du jungler adverse. Tu dois aussi commencer à side-lane",
    focusPoints: [
      "Jungle tracking : Tu dois savoir quel est le pathing du jungler adverse",
      "2vs2 mid-jungle : Tu dois savoir où est ton jungler et le complémenter",
      "Side lane : Après 15 mins, tu dois jouer en side lane.",
      "Objectifs : Tu dois jouer tous les objectifs",
    ],
    highlightStats: ["deaths10", "csPost20"],
    highlightFields: ["lane"],
    bucketThemes: { macro: "Objectifs non joués" },
    fieldQuestions: {
      lane: "Es-tu mort d'un gank ? Pourquoi ?",
      fight: "As-tu été mort sur un timing objectif ?",
      macro: "As-tu side lane après 15 min ?",
    },
  },
  platinum: {
    inDevelopment: false,
    focusIntro:
      "En platine, tu dois jouer chaque game avec un plan sur comment trade et comment gérer tes waves. Tu dois aussi apprendre à side lane en fonction de l'objectif à jouer",
    focusPoints: [
      "Trading : Tu dois comprendre le pattern de trading de ton matchup",
      "Wave Management : Tu dois toujours jouer avec un plan de wave management",
      "Side lane : Tu dois contester la wave mid avant le prochain objectif, et être positionné dessus en avance",
    ],
    highlightStats: ["csPost20"],
    highlightFields: ["lane", "macro"],
    bucketThemes: {
      lane: "Faute de trading / Wave management",
      fight: "Mort sur un timing objectif",
      macro: "Objectifs non gagnés",
    },
    fieldQuestions: {
      lane: "Pourquoi tu t'es fait out trade ?",
      fight: "Comment es-tu mort en fight ?",
      macro: "As-tu contesté la wave mid AVANT les objectifs ?",
    },
  },
  emerald: {
    inDevelopment: false,
    focusIntro:
      "En Émeraude, tu dois te concentrer sur ta macro et ton fighting : ta compréhension du jeu doit aller plus loin que ta lane.",
    focusPoints: [
      "Macro early game : Tu dois adapter ton agressivité en lane en fonction du scaling des équipes",
      "Macro mid game : Tu dois toujours jouer sur ton strong side, et éviter le weak side",
      "Macro end game : Tu dois jamais te faire catch après 30mins, et ne pas donner de baron",
    ],
    highlightStats: [],
    highlightFields: ["lane", "macro", "fight"],
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

// Les paliers au-dessus d'émeraude n'ont pas de contenu écrit : ils
// EMPRUNTENT celui d'émeraude, exactement comme les seuils de couleur le font
// déjà (lib/content/thresholds.ts). Décision de Victor du 2026-08-13.
const CONTENT_TIER: Partial<Record<Tier, Tier>> = {
  diamond: "emerald",
  master: "emerald",
  grandmaster: "emerald",
  challenger: "emerald",
};

// Un contenu emprunté — palier au-dessus d'émeraude, ou rôle autre que mid —
// sert bien ses questions d'erreurs et sa surbrillance, mais reste marqué
// `inDevelopment: true` : les recommandations, elles, ne sont pas transposables
// telles quelles, et les pages affichent un avertissement franc à leur place.
// Un palier sans contenu du tout (unranked) retombe sur le générique.
export function getContent(role: Role, tier: Tier): TierContent {
  const source = CONTENT_TIER[tier] ?? tier;
  const written = MID_CONTENT[source];
  if (!written) return FALLBACK_CONTENT;
  if (role === "mid" && source === tier) return written;
  return { ...written, inDevelopment: true };
}
