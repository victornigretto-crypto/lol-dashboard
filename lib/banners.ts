// Les bandeaux d'analyse affichés à gauche du tableau, sur / (analyse
// gratuite) comme sur /suivi (cockpit). Un bandeau = un constat court, une
// couleur, et un détail chiffré qui se déplie au clic.
//
// Les trois bandeaux chiffrés se calculent à partir d'une moyenne sur
// l'échantillon de games et des seuils du palier : mêmes seuils que les
// couleurs du tableau (lib/content/thresholds), donc un bandeau vert ne peut
// pas contredire une colonne rouge.
import {
  averageCsPerMin,
  bandClass,
  csBand,
  csMetrics,
  deathsBand,
  weightedDeaths10,
  type Band,
  type CsSource,
  type DeathsSource,
} from "@/lib/stats";
import { roleFromLane, type Role, type TierThresholds } from "@/lib/content";

// La sévérité d'un bandeau EST la bande de la stat qui l'a produit, moins le
// cas "inconnu" (qui ne produit aucun bandeau : on ne dit rien plutôt que de
// dire faux). Les deux notions ont divergé un temps sous deux noms différents,
// avec deux tables de couleurs à maintenir en parallèle — un même vert écrit à
// deux endroits finit toujours par n'être plus le même.
export type Severity = Exclude<Band, "unknown">;

export type Banner = {
  id: string;
  severity: Severity;
  text: string;
  detail: string;
  // Épinglé en tête, AVANT le tri par sévérité. Réservé au constat qui prime
  // sur tout le reste : jouer trop de rôles rend les autres mesures peu
  // pertinentes, puisqu'elles moyennent des lanes qui n'ont rien à voir.
  // Sans ça, un bandeau rouge finit en bas de liste, derrière les verts.
  pinned?: boolean;
};

// Ordre d'affichage demandé : le meilleur d'abord, le rouge en dernier.
const SEVERITY_ORDER: Record<Severity, number> = { great: 0, good: 1, warn: 2, bad: 3 };

// -1 passe devant `great` (0), donc devant tout le reste.
const PINNED_ORDER = -1;

function displayOrder(b: Banner): number {
  return b.pinned ? PINNED_ORDER : SEVERITY_ORDER[b.severity];
}

// Rigoureusement les couleurs du tableau (lib/stats -> BAND_CLASS).
export const SEVERITY_CLASS: Record<Severity, string> = {
  great: bandClass("great"),
  good: bandClass("good"),
  warn: bandClass("warn"),
  bad: bandClass("bad"),
};

// `sort` est stable en JS : à sévérité égale, les bandeaux gardent leur ordre
// d'ajout, y compris quand /suivi et / les alimentent en plusieurs fois.
export function sortBanners(list: Banner[]): Banner[] {
  return [...list].sort((a, b) => displayOrder(a) - displayOrder(b));
}

// Seules les lanes où le farm est un vrai indicateur. Un jungler ou un
// support n'a pas à être jugé sur son CS/min.
export const FARM_LANES = new Set(["Top", "Mid", "Bot"]);

// Le verdict qui suit la mesure dans le détail, commun aux trois bandeaux
// chiffrés. L'objectif cité est TOUJOURS le seuil vert pâle : c'est le niveau
// attendu au palier, pas l'excellence — donner le vert foncé comme cible
// rendrait la marche infranchissable pour celui qui est en rouge.
function verdict(band: Severity, goal: string): string {
  switch (band) {
    case "bad":
      return `insuffisant pour ton rank, tu dois viser ${goal}`;
    case "warn":
      return `faible pour ton rank, tu dois viser ${goal}`;
    case "good":
      return "correct pour ton rank";
    case "great":
      return "excellent pour ton rank";
  }
}

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

// Fenêtre de référence du farm d'avant-20 : le calcul se fait en CS/min (seule
// forme qui normalise les games écourtées, cf. csMetrics), l'affichage se fait
// en CS TOTAUX, qui est le chiffre qu'un joueur lit en jeu. Le seuil affiché
// subit donc la même conversion, sans quoi la phrase comparerait deux unités.
const PRE20_WINDOW_MIN = 20;

export function farmPre20Banner(games: BannerGame[], thresholds: TierThresholds | null): Banner | null {
  if (thresholds === null) return null;
  const sample = farmGames(games);
  const avg = averageCsPerMin(sample.map((g) => csMetrics(g).perMinPre20));
  if (avg === null) return null;

  const band = csBand(avg, thresholds.csPre20);
  if (band === "unknown") return null;

  const text = {
    great: "Très bon farm en lane",
    good: "Bon farm en lane",
    warn: "Manque de farm en lane",
    bad: "Gros manque de farm en lane",
  }[band];

  const totalCs = Math.round(avg * PRE20_WINDOW_MIN);
  const goal = Math.round(thresholds.csPre20.good * PRE20_WINDOW_MIN);
  return {
    id: "farm-pre20",
    severity: band,
    text,
    detail: `${totalCs} CS à 20 mins en moyenne — ${verdict(band, `au moins ${goal}`)}`,
  };
}

export function farmPost20Banner(games: BannerGame[], thresholds: TierThresholds | null): Banner | null {
  if (thresholds === null) return null;
  const sample = farmGames(games);
  // `perMinPost20` est nul sous 25 min de partie : ces games sortent d'elles-
  // mêmes de la moyenne. Si aucune ne dure assez, pas de bandeau du tout.
  const avg = averageCsPerMin(sample.map((g) => csMetrics(g).perMinPost20));
  if (avg === null) return null;

  const band = csBand(avg, thresholds.csPost20);
  if (band === "unknown") return null;

  const text = {
    great: "Très bon side laner",
    good: "Bon side laner",
    warn: "Peux mieux side lane",
    bad: "Tu ne side-lane pas assez",
  }[band];

  return {
    id: "farm-post20",
    severity: band,
    text,
    detail: `${avg} CS/min après 20mins en moyenne — ${verdict(band, `au moins ${thresholds.csPost20.good}`)}`,
  };
}

export function deathsBanner(games: BannerGame[], thresholds: TierThresholds | null): Banner | null {
  if (thresholds === null || games.length === 0) return null;

  // Même rythme pondéré que la couleur de la colonne "Morts/10m" : les morts
  // des 5 dernières minutes d'une partie de plus de 30 min comptent à moitié.
  const avg =
    Math.round((games.reduce((sum, g) => sum + weightedDeaths10(g), 0) / games.length) * 10) / 10;

  const band = deathsBand(avg, thresholds.deaths10);
  if (band === "unknown") return null;

  const text = {
    great: "Joueur intuable",
    good: "Joueur safe",
    warn: "Un peu trop de morts",
    bad: "Beaucoup trop de morts",
  }[band];

  // Seul verdict à s'inverser : sur les morts, progresser c'est descendre.
  // "viser au moins 1 mort" dirait exactement le contraire de l'objectif.
  return {
    id: "deaths",
    severity: band,
    text,
    detail: `${avg} morts/10mins en moyenne — ${verdict(band, `moins de ${thresholds.deaths10.good}`)}`,
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
    severity: "bad",
    // En tête de liste quoi qu'il arrive. La raison a changé le 2026-08-17 :
    // les bandeaux de stats ne moyennent plus des lanes différentes, ils sont
    // filtrés sur le rôle principal. Mais éparpiller ses games reste le
    // problème numéro un — et c'est désormais AUSSI ce qui vide l'échantillon
    // analysé, puisque seules les parties du rôle principal y entrent.
    pinned: true,
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
    severity: "bad",
    text: "Tu joues trop de champions !",
    detail: `Tu as joué ${worst.count} champions sur tes ${sample.length} dernières parties. Concentres toi sur moins de ${max} champion${plural(max)} pour progresser`,
  };
}

// Les parties jouées dans un rôle donné. Rôle inconnu — compte public sans
// rôle dominant, profil sans `primary_role` — : on ne filtre pas, mieux vaut
// une moyenne tous rôles confondus que pas de bandeau du tout.
function roleGames(games: BannerGame[], role: Role | null): BannerGame[] {
  if (role === null) return games;
  return games.filter((g) => roleFromLane(g.lane) === role);
}

// Les bandeaux partagés par / et /suivi, dans l'ordre d'affichage. Les pages y
// ajoutent leurs bandeaux propres (winrate côté /).
//
// `role` est le rôle principal du joueur. Les bandeaux de STATS ne jugent que
// les parties de ce rôle (demande de Victor du 2026-08-17) : un mid qui dépanne
// au support ne doit pas voir son farm de mid moyenné avec des games de
// support, où les attentes n'ont rien à voir.
//
// Les deux derniers, en revanche, restent sur TOUT l'échantillon, et ce n'est
// pas un oubli :
//   - "trop de rôles" compte justement les rôles — le filtrer par rôle le
//     rendrait incapable de se déclencher, un seul rôle survivant par
//     construction ;
//   - le pool de champions se compte déjà par rôle en interne, et a besoin de
//     voir les autres rôles pour désigner le plus chargé.
export function performanceBanners(
  games: BannerGame[],
  thresholds: TierThresholds | null,
  role: Role | null
): Banner[] {
  const stats = roleGames(games, role);
  return sortBanners(
    [
      farmPre20Banner(stats, thresholds),
      farmPost20Banner(stats, thresholds),
      deathsBanner(stats, thresholds),
      rolesBanner(games),
      championPoolBanner(games, thresholds),
    ].filter((b): b is Banner => b !== null)
  );
}
