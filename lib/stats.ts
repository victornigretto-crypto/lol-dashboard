// Chemin de lecture partagé entre / (analyse publique) et /suivi (cockpit) :
// dérivation du CS/min et du rythme de morts à partir des faits bruts
// stockés, et codes couleur.
//
// Les couleurs sont RELATIVES au palier (lib/content/thresholds), jamais à une
// échelle absolue : 132 CS à 20 min, c'est bon en Iron et faible en Émeraude.
import { csPerMin } from "@/lib/riot/transform";
import type { FieldKey, StatKey, StatThreshold, TierContent } from "@/lib/content";

// Champs bruts tels que stockés en base / renvoyés par /api/riot/import.
// Aucune colonne dérivée : tout ce qui suit est calculé à la lecture.
export type CsSource = {
  cs20: number | null;
  cs_final: number | null;
  game_duration_seconds: number | null;
};

export type CsMetrics = {
  perMinPre20: number | null;
  perMinPost20: number | null;
};

const PRE20_WINDOW_MIN = 20;

// En dessous de 25 min, le "après 20 min" reposerait sur quelques minutes de
// jeu à peine : trop peu pour juger un side lane. On n'affiche alors rien
// plutôt qu'une valeur qui varierait du simple au double sur deux vagues.
const POST20_MIN_DURATION_MIN = 25;

// Riot renvoie `gameDuration` en secondes, mais quelques vieux matchs le
// donnent en millisecondes. Une partie de plus de ~2h47 étant impossible,
// au-delà de ce seuil la valeur est forcément en ms.
const MS_THRESHOLD_SECONDS = 10000;

export function durationMinutes(rawDuration: number | null): number | null {
  if (rawDuration == null || rawDuration <= 0) return null;
  const seconds = rawDuration > MS_THRESHOLD_SECONDS ? rawDuration / 1000 : rawDuration;
  return seconds / 60;
}

// Unique implémentation du CS/min avant / après 20 min. Les deux pages
// passent par ici : ne pas recalculer ça ailleurs.
export function csMetrics(game: CsSource): CsMetrics {
  const { cs20, cs_final } = game;
  const minutes = durationMinutes(game.game_duration_seconds);

  // Une game qui s'arrête avant 20 min n'a pas laissé 20 minutes pour farmer :
  // diviser par la fenêtre pleine sous-estimerait le CS/min (113 CS en 15,4 min,
  // c'est 7.3 CS/min, pas 5.7). Durée inconnue — games importées avant que la
  // colonne existe — : impossible de savoir, on garde la fenêtre pleine.
  const pre20Minutes =
    minutes !== null && minutes < PRE20_WINDOW_MIN ? minutes : PRE20_WINDOW_MIN;
  const perMinPre20 = cs20 === null ? null : csPerMin(cs20, pre20Minutes);

  const hasPost20 =
    cs20 !== null && cs_final !== null && minutes !== null && minutes >= POST20_MIN_DURATION_MIN;

  return {
    perMinPre20,
    perMinPost20: hasPost20 ? csPerMin(cs_final - cs20, minutes - PRE20_WINDOW_MIN) : null,
  };
}

// --- Morts ---------------------------------------------------------------

// `deaths10` est le rythme AFFICHÉ, tel que calculé à l'import : morts totales
// ramenées à 10 minutes. `deaths` et `deaths_last5` sont les faits bruts qui
// permettent d'en dériver le rythme PONDÉRÉ, celui qui donne la couleur.
// Les deux dernières sont nulles pour les games importées avant leur colonne.
export type DeathsSource = {
  deaths10: number;
  deaths: number | null;
  deaths_last5: number | null;
  game_duration_seconds: number | null;
};

// Au-delà de 30 min, une mort dans les 5 dernières minutes ne compte qu'à
// moitié : à ce stade la partie se joue en fights groupés, mourir y est
// souvent le prix d'un objectif, pas une faute de lane.
//
// La FENÊTRE (5 min) n'est pas ici : elle est appliquée à l'import, qui
// remplit `deaths_last5` (cf. LATE_DEATHS_WINDOW_MIN dans la route d'import).
// Ce module ne décide que du POIDS et du seuil de durée.
const LATE_GAME_MIN = 30;
const LATE_WEIGHT = 0.5;

// Au-delà de cette durée, l'écart entre le chiffre affiché et le chiffre qui
// donne la couleur devient assez visible pour mériter une explication : la
// valeur passe en pointillé avec une infobulle.
const DEATHS_EXPLAIN_MIN = 34;

// Rythme de morts servant à la COULEUR. Le chiffre affiché, lui, reste
// `game.deaths10` : on ne change pas le compteur, seulement le jugement.
// Sans les faits bruts (game importée avant les colonnes `deaths`), on
// retombe sur le rythme brut — même comportement qu'avant, zéro régression.
export function weightedDeaths10(game: DeathsSource): number {
  const minutes = durationMinutes(game.game_duration_seconds);
  if (
    minutes === null ||
    minutes <= LATE_GAME_MIN ||
    game.deaths == null ||
    game.deaths_last5 == null
  ) {
    return game.deaths10;
  }
  const adjusted = game.deaths - LATE_WEIGHT * game.deaths_last5;
  return Math.round((adjusted * 10) / minutes * 10) / 10;
}

// Vrai quand la pondération a réellement été appliquée ET que la partie est
// assez longue pour que l'écart se voie : c'est la condition du pointillé.
// On exige les faits bruts, sinon le pointillé annoncerait un calcul qui n'a
// pas eu lieu.
export function explainsDeaths(game: DeathsSource): boolean {
  const minutes = durationMinutes(game.game_duration_seconds);
  return (
    minutes !== null &&
    minutes > DEATHS_EXPLAIN_MIN &&
    game.deaths != null &&
    game.deaths_last5 != null
  );
}

export const DEATHS_EXPLANATION =
  "Le chiffre affiché compte toutes tes morts. La couleur, elle, ne compte " +
  "qu'à moitié les morts des 5 dernières minutes : sur une partie de plus de " +
  "30 minutes, mourir en fight d'objectif n'est pas la même faute que mourir en lane.";

// --- Moyennes ------------------------------------------------------------

// Moyenne d'une stat sur un échantillon, en ignorant les games où la valeur
// n'est pas calculable (post-20 d'une game trop courte, games importées avant
// que cs_final soit stocké...).
export function averageCsPerMin(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return null;
  return Math.round((known.reduce((sum, v) => sum + v, 0) / known.length) * 10) / 10;
}

// --- Couleurs ------------------------------------------------------------

// Jugement d'une valeur face aux seuils de son palier. "unknown" = valeur ou
// seuils inconnus : on ne dit rien plutôt que de dire faux. Les couleurs ET
// les bandeaux d'analyse dérivent tous de ces deux fonctions : un seul
// endroit fixe les règles de comparaison.
export type Band = "good" | "warn" | "bad" | "unknown";

// Farm : plus grand = mieux.
export function csBand(value: number | null, threshold: StatThreshold | null): Band {
  if (value === null || threshold === null) return "unknown";
  if (value >= threshold.green) return "good";
  if (value >= threshold.yellow) return "warn";
  return "bad";
}

// Morts : logique inversée, plus petit = mieux.
export function deathsBand(value: number | null, threshold: StatThreshold | null): Band {
  if (value === null || threshold === null) return "unknown";
  if (value <= threshold.green) return "good";
  if (value <= threshold.yellow) return "warn";
  return "bad";
}

const BAND_CLASS: Record<Band, string> = {
  good: "bg-green-600 text-white",
  warn: "bg-yellow-500 text-black",
  bad: "bg-red-600 text-white",
  unknown: "bg-slate-800 text-slate-300",
};

export function bandClass(band: Band): string {
  return BAND_CLASS[band];
}

export function csClass(value: number | null, threshold: StatThreshold | null): string {
  return bandClass(csBand(value, threshold));
}

export function deathsClass(value: number | null, threshold: StatThreshold | null): string {
  return bandClass(deathsBand(value, threshold));
}

// Deux rendus, définis dans app/globals.css, concaténés à une classe de
// couleur d'où l'espace initial :
//   - OUTLINE : contour bleu FIXE, pour les en-têtes de colonne. Constant,
//     il ne doit pas bouger — sinon la moitié du tableau clignoterait en
//     permanence et l'alerte réelle passerait inaperçue.
//   - BLINK : contour CLIGNOTANT, réservé aux cellules en alerte.
// Les deux dessinent leur liseré en `inset` : à l'extérieur, il est recouvert
// par les cellules voisines et n'apparaît pas du tout (vérifié 2026-08-16).
const OUTLINE_CLASS = " stat-outline";
const BLINK_CLASS = " animate-stat-blink";

export function highlightClass(content: TierContent, stat: StatKey): string {
  return content.highlightStats.includes(stat) ? OUTLINE_CLASS : "";
}

// Même surbrillance, appliquée cette fois à une colonne de QUESTIONS : à
// partir d'argent, plusieurs paliers demandent de se concentrer sur une
// question à remplir plutôt que sur une valeur chiffrée. Même classe donc même
// animation — un second effet visuel pour dire la même chose serait une
// divergence de plus à maintenir.
export function highlightFieldClass(content: TierContent, field: FieldKey): string {
  return content.highlightFields.includes(field) ? OUTLINE_CLASS : "";
}

// Deux signaux différents, portés par le même clignotement mais pas au même
// endroit :
//   - l'EN-TÊTE dit ce que ce palier doit travailler (highlightStats /
//     highlightFields) — constant, indépendant des games ;
//   - la CELLULE n'alerte que si les DEUX conditions sont réunies : le palier
//     demande de surveiller cette stat, ET la valeur est rouge.
//
// Le croisement est le point important. Sur le seul rouge, un joueur platine
// verrait clignoter son CS avant 20 min alors que son palier lui demande de
// travailler le side lane : l'alerte désignerait la mauvaise chose. Sur le
// seul palier, une case verte clignoterait, ce qui se lit comme un problème
// là où il n'y en a pas.
export function alertClass(content: TierContent, stat: StatKey, band: Band): string {
  return content.highlightStats.includes(stat) && band === "bad" ? BLINK_CLASS : "";
}
