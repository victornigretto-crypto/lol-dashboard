// Chemin de lecture partagé entre / (analyse publique) et /suivi (cockpit) :
// dérivation du CS/min à partir des faits bruts stockés, et codes couleur.
//
// Les couleurs sont RELATIVES à la cible du palier (lib/content), jamais à une
// échelle absolue : 132 CS à 20 min, c'est bon en Iron et faible en Émeraude.
import { csPerMin } from "@/lib/riot/transform";
import type { StatKey, TierContent } from "@/lib/content";

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

// Riot renvoie `gameDuration` en secondes, mais quelques vieux matchs le
// donnent en millisecondes. Une partie de plus de ~2h47 étant impossible,
// au-delà de ce seuil la valeur est forcément en ms.
const MS_THRESHOLD_SECONDS = 10000;

function durationMinutes(rawDuration: number | null): number | null {
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

  // Le post-20 n'existe que si la game a dépassé 20 min et qu'on connaît le
  // CS de fin : sinon la valeur reste inconnue, jamais approximée à 0.
  const hasPost20 = cs20 !== null && cs_final !== null && minutes !== null && minutes > PRE20_WINDOW_MIN;

  return {
    perMinPre20,
    perMinPost20: hasPost20 ? csPerMin(cs_final - cs20, minutes - PRE20_WINDOW_MIN) : null,
  };
}

// Moyenne d'un CS/min sur un échantillon, en ignorant les games où la valeur
// n'est pas calculable (post-20 d'une game qui s'arrête avant 20 min, games
// importées avant que cs_final soit stocké...).
export function averageCsPerMin(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return null;
  return Math.round((known.reduce((sum, v) => sum + v, 0) / known.length) * 10) / 10;
}

// Jugement d'une valeur face à la cible de son palier. "unknown" = valeur ou
// cible inconnue : on ne dit rien plutôt que de dire faux. Les couleurs ET
// les bannières d'analyse dérivent toutes de ces deux fonctions : un seul
// endroit fixe les seuils.
export type Band = "good" | "warn" | "bad" | "unknown";

// Farm : plus grand = mieux.
//   >= cible          -> good
//   >= 85 % de cible  -> warn
//   sinon             -> bad
const CS_WARN_RATIO = 0.85;

export function csPerMinBand(value: number | null, target: number | null): Band {
  if (value === null || target === null || target <= 0) return "unknown";
  if (value >= target) return "good";
  if (value >= target * CS_WARN_RATIO) return "warn";
  return "bad";
}

// Morts : logique inversée, plus petit = mieux.
//   <= cible           -> good
//   <= 115 % de cible  -> warn
//   sinon              -> bad
const DEATHS_WARN_RATIO = 1.15;

export function deaths10Band(value: number | null, target: number | null): Band {
  if (value === null || target === null || target <= 0) return "unknown";
  if (value <= target) return "good";
  if (value <= target * DEATHS_WARN_RATIO) return "warn";
  return "bad";
}

const BAND_CLASS: Record<Band, string> = {
  good: "bg-green-600 text-white",
  warn: "bg-yellow-500 text-black",
  bad: "bg-red-600 text-white",
  unknown: "bg-slate-800 text-slate-300",
};

function bandClass(band: Band): string {
  return BAND_CLASS[band];
}

export function csPerMinClass(value: number | null, target: number | null): string {
  return bandClass(csPerMinBand(value, target));
}

export function deaths10Class(value: number | null, target: number | null): string {
  return bandClass(deaths10Band(value, target));
}

// Cibles de performance du palier, extraites du contenu. `null` = palier ou
// rôle sans contenu écrit : ni couleur, ni jugement.
export type Targets = { csPerMin: number | null; deaths10: number | null };

export function targetsOf(content: TierContent): Targets {
  return { csPerMin: content.csPerMinTarget, deaths10: content.deaths10Target };
}

// Une stat mise en avant par le contenu du palier reçoit un liseré : c'est
// celle sur laquelle ce palier doit se concentrer en priorité. Concaténé à
// une classe de couleur, d'où l'espace initial.
const HIGHLIGHT_RING = " ring-2 ring-blue-400";

export function highlightClass(content: TierContent, stat: StatKey): string {
  return content.highlightStats.includes(stat) ? HIGHLIGHT_RING : "";
}
