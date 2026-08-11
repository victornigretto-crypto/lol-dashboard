// Les bandeaux d'analyse affichés à gauche du tableau, sur / (analyse
// gratuite) comme sur /suivi (cockpit). Un bandeau = un constat court, une
// couleur, et un détail chiffré qui se déplie au clic.
//
// Ces trois-là se calculent à partir d'une moyenne sur l'échantillon de games
// et des seuils du palier : mêmes seuils que les couleurs du tableau
// (lib/content/thresholds), donc un bandeau vert ne peut pas contredire une
// colonne rouge.
import {
  averageCsPerMin,
  csBand,
  csMetrics,
  deathsBand,
  weightedDeaths10,
  type Band,
  type CsSource,
  type DeathsSource,
} from "@/lib/stats";
import { roleFromLane, type Role, type TierThresholds } from "@/lib/content";

export type Severity = "green" | "yellow" | "red";

export type Banner = { id: string; severity: Severity; text: string; detail: string };

// Ordre d'affichage demandé : le vert d'abord, le rouge en dernier.
const SEVERITY_ORDER: Record<Severity, number> = { green: 0, yellow: 1, red: 2 };

export const SEVERITY_CLASS: Record<Severity, string> = {
  green: "bg-green-600 text-white",
  yellow: "bg-yellow-500 text-black",
  red: "bg-red-600 text-white",
};

// `sort` est stable en JS : à sévérité égale, les bandeaux gardent leur ordre
// d'ajout, y compris quand /suivi et / les alimentent en plusieurs fois.
export function sortBanners(list: Banner[]): Banner[] {
  return [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// Seules les lanes où le farm est un vrai indicateur. Un jungler ou un
// support n'a pas à être jugé sur son CS/min.
export const FARM_LANES = new Set(["Top", "Mid", "Bot"]);

const BAND_TO_SEVERITY: Record<Exclude<Band, "unknown">, Severity> = {
  good: "green",
  warn: "yellow",
  bad: "red",
};

// Une game telle qu'attendue par ces bandeaux : le sous-ensemble commun aux
// deux pages (RiotGame côté /, Game côté /suivi). `queue` est nullable parce
// que /suivi le lit en base, où d'anciennes lignes peuvent l'avoir vide.
export type BannerGame = CsSource &
  DeathsSource & { lane: string; champion: string; queue: string | null };

function farmGames(games: BannerGame[]): BannerGame[] {
  return games.filter((g) => FARM_LANES.has(g.lane));
}

// Les bandeaux "rôles" et "champions" se jugent sur la SoloQ seule : c'est la
// file où la spécialisation compte, et c'est la demande explicite. Les autres
// bandeaux, eux, restent calculés sur tout l'échantillon affiché.
function soloqGames(games: BannerGame[]): BannerGame[] {
  return games.filter((g) => g.queue === "SoloQ");
}

const ROLE_LABEL: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "Adc",
  support: "Support",
};

// Ordre du plus haut au plus bas de la carte, pour que le détail se lise
// toujours pareil quel que soit l'ordre des games.
const ROLE_ORDER: Role[] = ["top", "jungle", "mid", "adc", "support"];

function plural(count: number): string {
  return count > 1 ? "s" : "";
}

export function farmPre20Banner(games: BannerGame[], thresholds: TierThresholds | null): Banner | null {
  if (thresholds === null) return null;
  const sample = farmGames(games);
  const avg = averageCsPerMin(sample.map((g) => csMetrics(g).perMinPre20));
  if (avg === null) return null;

  const band = csBand(avg, thresholds.csPre20);
  if (band === "unknown") return null;

  const text = { good: "Bon farm en lane", warn: "Peut mieux farm en lane", bad: "Manque de farm en lane" }[
    band
  ];
  return {
    id: "farm-pre20",
    severity: BAND_TO_SEVERITY[band],
    text,
    detail: `${avg} CS/min avant 20 min en moyenne (Top/Mid/Bot, ${sample.length} game${plural(sample.length)}) — objectif du palier : ${thresholds.csPre20.green}`,
  };
}

export function farmPost20Banner(games: BannerGame[], thresholds: TierThresholds | null): Banner | null {
  if (thresholds === null) return null;
  const sample = farmGames(games);
  // `perMinPost20` est nul sous 25 min de partie : ces games sortent d'elles-
  // mêmes de la moyenne. Si aucune ne dure assez, pas de bandeau du tout.
  const values = sample.map((g) => csMetrics(g).perMinPost20);
  const counted = values.filter((v) => v !== null).length;
  const avg = averageCsPerMin(values);
  if (avg === null) return null;

  const band = csBand(avg, thresholds.csPost20);
  if (band === "unknown") return null;

  const text = { good: "Bon side laner", warn: "Peux mieux side lane", bad: "Tu ne side-lane pas assez" }[
    band
  ];
  return {
    id: "farm-post20",
    severity: BAND_TO_SEVERITY[band],
    text,
    detail: `${avg} CS/min après 20 min en moyenne (Top/Mid/Bot, ${counted} game${plural(counted)} de plus de 25 min) — objectif du palier : ${thresholds.csPost20.green}`,
  };
}

export function deathsBanner(games: BannerGame[], thresholds: TierThresholds | null): Banner | null {
  if (thresholds === null || games.length === 0) return null;

  // Même rythme pondéré que la couleur de la colonne "Morts/10m" : les morts
  // des 5 dernières minutes d'une partie de plus de 30 min comptent à moitié.
  const avg =
    Math.round((games.reduce((sum, g) => sum + weightedDeaths10(g), 0) / games.length) * 10) / 10;

  const band = deathsBand(avg, thresholds.deaths10);
  // Le jaune ne dit rien d'actionnable ici : on n'affiche pas de bandeau
  // "moyen" sur les morts (demande explicite).
  if (band !== "good" && band !== "bad") return null;

  return {
    id: "deaths",
    severity: BAND_TO_SEVERITY[band],
    text: band === "good" ? "Joueur safe" : "Trop de morts",
    detail: `${avg} morts/10 min en moyenne sur ${games.length} game${plural(games.length)} — objectif du palier : ${thresholds.deaths10.green} ou moins`,
  };
}

// Un joueur qui touche à 4 rôles ou plus ne construit d'automatismes nulle
// part. Seul bandeau du lot à ne PAS dépendre du palier : la règle est la même
// pour tout le monde, donc il s'affiche aussi pour un compte non classé.
export function rolesBanner(games: BannerGame[]): Banner | null {
  const sample = soloqGames(games);
  const played = new Set(
    sample.map((g) => roleFromLane(g.lane)).filter((r): r is Role => r !== null)
  );
  if (played.size < 4) return null;

  const named = ROLE_ORDER.filter((r) => played.has(r)).map((r) => ROLE_LABEL[r]);
  return {
    id: "roles",
    severity: "red",
    text: "Tu joues trop de rôle !!!",
    detail: `${played.size} rôles différents sur tes ${sample.length} dernières SoloQ (${named.join(", ")})`,
  };
}

// Le pool de champions se compte PAR RÔLE, pas sur l'ensemble des games : un
// joueur avec 3 champions en mid et 3 en top reste concentré sur chacun de ses
// rôles — c'est le bandeau "rôles" ci-dessus qui doit lui parler, pas celui-ci.
// Le rôle retenu pour le détail est le plus chargé, celui qui a déclenché.
export function championPoolBanner(
  games: BannerGame[],
  thresholds: TierThresholds | null
): Banner | null {
  if (thresholds === null) return null;
  const sample = soloqGames(games);
  const max = thresholds.maxChampions;

  const pools = new Map<Role, Set<string>>();
  for (const game of sample) {
    const role = roleFromLane(game.lane);
    if (role === null) continue;
    const pool = pools.get(role) ?? new Set<string>();
    pool.add(game.champion);
    pools.set(role, pool);
  }

  let worst: { role: Role; count: number } | null = null;
  for (const role of ROLE_ORDER) {
    const count = pools.get(role)?.size ?? 0;
    // Comparaison stricte : le seuil est un nombre toléré, pas un plafond
    // interdit (3 champions en iron ne dit rien, 4 déclenche).
    if (count > max && (worst === null || count > worst.count)) worst = { role, count };
  }
  if (worst === null) return null;

  return {
    id: "champion-pool",
    // Le texte est un conseil constant ("3 max"), volontairement indépendant du
    // seuil qui a déclenché : le seuil du palier, lui, est dans le détail.
    severity: "red",
    text: "Tu joues trop de champion !\nConcentre toi sur 1-2 champions, 3 max pour progresser",
    detail: `${worst.count} champions différents en ${ROLE_LABEL[worst.role]} sur tes ${sample.length} dernières SoloQ — ton palier en tolère ${max} par rôle`,
  };
}

// Les bandeaux partagés par / et /suivi, dans l'ordre d'affichage. Les pages y
// ajoutent leurs bandeaux propres (winrate côté /).
export function performanceBanners(games: BannerGame[], thresholds: TierThresholds | null): Banner[] {
  return sortBanners(
    [
      farmPre20Banner(games, thresholds),
      farmPost20Banner(games, thresholds),
      deathsBanner(games, thresholds),
      rolesBanner(games),
      championPoolBanner(games, thresholds),
    ].filter((b): b is Banner => b !== null)
  );
}
