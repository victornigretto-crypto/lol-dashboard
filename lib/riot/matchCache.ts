import { createAdminClient } from "@/lib/supabase/admin";

// Faits extraits d'une partie pour UN joueur. C'est aussi la forme exacte des
// lignes renvoyees au navigateur par /api/riot/import : une seule definition,
// pour que le cache et l'affichage ne puissent pas diverger.
//
// Que des faits bruts, jamais un calcul : les CS/min, la ponderation des morts
// et les couleurs se calculent a la lecture (cf. lib/stats.ts). Une regle qui
// change ne doit jamais obliger a purger le cache.
export type MatchFacts = {
  riot_match_id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  cs20: number;
  deaths10: number;
  queue: string;
  played_at: string;
  // Nullable en base (colonnes ajoutees apres coup), mais une ligne a qui il
  // en manque une est consideree comme absente du cache : cf. `isComplete`.
  cs_final: number | null;
  game_duration_seconds: number | null;
  deaths: number | null;
  deaths_last5: number | null;
};

const COLUMNS =
  "riot_match_id, lane, champion, matchup, result, cs20, deaths10, queue, played_at, cs_final, game_duration_seconds, deaths, deaths_last5";

// Une ligne n'est reutilisable que si elle est COMPLETE. Sans `cs_final` ni
// duree, `csMetrics` ne peut pas calculer le CS/min apres 20 min et affiche
// "—" ; sans `deaths` / `deaths_last5`, la ponderation des morts de fin de
// partie n'a pas lieu. La traiter comme absente la fait retelecharger une
// fois, puis se reparer.
export function isComplete(row: Partial<MatchFacts>): boolean {
  return Boolean(
    row.riot_match_id &&
      row.queue &&
      row.played_at &&
      row.cs_final !== null &&
      row.cs_final !== undefined &&
      row.game_duration_seconds !== null &&
      row.game_duration_seconds !== undefined &&
      row.deaths !== null &&
      row.deaths !== undefined &&
      row.deaths_last5 !== null &&
      row.deaths_last5 !== undefined
  );
}

// Lit le cache partage. Ne leve jamais : une panne du cache doit degrader vers
// "on redemande a Riot", pas casser la recherche.
export async function readMatchFacts(
  matchIds: string[],
  puuid: string
): Promise<Map<string, MatchFacts>> {
  const found = new Map<string, MatchFacts>();
  if (matchIds.length === 0) return found;

  const admin = createAdminClient();
  if (!admin) return found;

  const { data, error } = await admin
    .from("match_facts")
    .select(COLUMNS)
    .eq("puuid", puuid)
    .in("riot_match_id", matchIds);

  if (error) {
    console.error("Lecture du cache de parties impossible", error);
    return found;
  }

  for (const row of (data ?? []) as MatchFacts[]) {
    if (isComplete(row)) found.set(row.riot_match_id, normalize(row));
  }

  return found;
}

// Postgres rend un `timestamptz` en "...+00:00", la construite a partir de
// Riot est un `toISOString()` en "...Z". Meme instant, chaine differente :
// sans ca, la MEME partie sort avec deux `played_at` distincts selon que le
// cache a repondu ou non. Rien ne casse aujourd'hui (`new Date()` parse les
// deux), mais un cache dont la sortie depend de son propre etat n'est plus
// transparent -- et la prochaine comparaison de chaines, cle React ou
// deduplication sur ce champ echouerait une fois sur deux, sans rien dans les
// logs. Verifie le 2026-08-16 : c'etait le seul ecart entre les deux chemins.
function normalize(row: MatchFacts): MatchFacts {
  return { ...row, played_at: new Date(row.played_at).toISOString() };
}

// Ecrit dans le cache partage. Ne leve jamais non plus : si l'ecriture echoue,
// la recherche en cours a deja ses donnees, seule la suivante repayera les
// appels Riot.
export async function writeMatchFacts(rows: MatchFacts[], puuid: string): Promise<void> {
  if (rows.length === 0) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin
    .from("match_facts")
    .upsert(
      rows.map((row) => ({ ...row, puuid })),
      { onConflict: "riot_match_id,puuid", ignoreDuplicates: false }
    );

  if (error) {
    console.error("Ecriture du cache de parties impossible", error);
  }
}
