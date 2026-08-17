// Quelles parties entrent dans l'analyse. La règle vit ICI et nulle part
// ailleurs : `/` et `/suivi` la partagent, et une règle recopiée à deux
// endroits finit toujours par n'être plus la même (même raison que les
// bandeaux, cf. lib/banners).
//
// L'ancienne règle « moins de 2 mois » a été retirée le 2026-08-17, à la
// demande de Victor : un joueur qui joue peu se retrouvait analysé sur trois
// parties, parfois sur aucune. On prend désormais les 20 dernières quelle que
// soit leur date, avec un plancher dur au 18 janvier 2026 — plus tôt, ce n'est
// plus le même patch ni le même méta, et une moyenne qui les mélange ne dit
// rien d'utile sur le joueur d'aujourd'hui.

export const SAMPLE_SIZE = 20;

/** Plancher fixé par Victor : aucune partie antérieure n'est analysée. */
export const EARLIEST_GAME_ISO = "2026-01-18T00:00:00.000Z";

const EARLIEST_MS = Date.parse(EARLIEST_GAME_ISO);

// Une partie plus courte que ça n'est pas une partie : c'est un remake ou une
// déconnexion. Elle ne compte pour RIEN — ni winrate, ni farm, ni morts, ni
// rôles, ni pool de champions (demande de Victor du 2026-08-18). D'où sa place
// ici plutôt que dans tel ou tel bandeau : ce module est le seul passage
// obligé, tout ce qui en sort est déjà propre.
//
// La borne est stricte : « moins de 5 minutes » exclut 4:59 et garde 5:00.
export const MIN_DURATION_SECONDS = 300;

type Analysable = {
  played_at: string | null;
  game_duration_seconds: number | null;
};

/**
 * Les parties retenues pour l'analyse : les `SAMPLE_SIZE` plus récentes, jamais
 * antérieures au plancher.
 */
export function sampleForAnalysis<T extends Analysable>(games: T[]): T[] {
  return (
    games
      // Les remakes sont retirés AVANT le découpage à 20 : ils ne consomment
      // donc aucune place, et l'échantillon se complète avec la partie
      // suivante. « Ne compter pour rien » va jusque-là.
      //
      // Durée inconnue : écartée aussi. On ne peut pas affirmer qu'elle a duré
      // cinq minutes, et une ligne trop incomplète pour être datée l'est trop
      // pour être jugée. Sans effet sur les données actuelles — les seules
      // lignes sans durée sont exactement celles sans date, déjà exclues.
      .filter((g) => g.game_duration_seconds !== null && g.game_duration_seconds >= MIN_DURATION_SECONDS)
      // Une partie sans date est écartée : impossible de la situer par rapport
      // au plancher, ni de savoir si elle fait partie des 20 dernières. Une
      // date illisible donne `NaN`, que la comparaison rejette aussi — c'est
      // voulu, on n'analyse pas ce qu'on ne sait pas dater. C'était déjà son
      // sort sous la règle des 2 mois.
      .filter((g): g is T & { played_at: string } => {
        return g.played_at !== null && Date.parse(g.played_at) >= EARLIEST_MS;
      })
      // Trier AVANT de couper : ni l'ordre de l'API Riot ni celui de la base ne
      // sont garantis à cet endroit, et découper une liste mal triée jetterait
      // des parties récentes en gardant des vieilles. `filter` a déjà produit un
      // nouveau tableau, donc ce tri ne touche pas celui de l'appelant.
      .sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at))
      .slice(0, SAMPLE_SIZE)
  );
}
