import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountByRiotId,
  getMatch,
  getMatchIds,
  getMatchTimeline,
  getRankedEntriesByPuuid,
  mapWithConcurrency,
} from "@/lib/riot/client";
import {
  csAtMinute,
  deathsPer10Min,
  findOpponent,
  isAllowedQueue,
  laneLabel,
  parseRiotId,
  queueLabel,
  totalCs,
  QUEUE_SOLOQ,
} from "@/lib/riot/transform";

const TARGET_COUNT = 20;
const PAGE_SIZE = 20;
const MAX_SCAN = 60; // borne de sécurité pour le filtre "all" (évite de scanner à l'infini un joueur qui ne fait que de l'ARAM)
const CONCURRENCY = 15; // appels Riot en parallèle, reste sous la limite de la dev key (20 req/s)

type Filter = "soloq" | "ranked" | "all";

type Row = {
  riot_match_id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  cs20: number;
  deaths10: number;
  queue: string;
  played_at: string;
  // Nullable : les games déjà en cache avant la Slice 3 n'ont pas ces
  // colonnes tant qu'elles ne sont pas réimportées (cf. buildRowsForMatchIds).
  cs_final: number | null;
  game_duration_seconds: number | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Récupère les identifiants de matchs candidats selon le filtre choisi.
// - soloq / ranked : Riot filtre déjà côté serveur (queue / type), pas de gaspillage d'appels.
// - all : aucun filtre Riot ne garantit d'exclure l'ARAM proprement, donc on
//   scanne une fenêtre de matchs récents et on filtrera nous-mêmes sur queueId.
async function collectCandidateMatchIds(puuid: string, filter: Filter): Promise<string[]> {
  if (filter === "soloq") {
    return getMatchIds(puuid, { count: TARGET_COUNT, queue: QUEUE_SOLOQ });
  }
  if (filter === "ranked") {
    return getMatchIds(puuid, { count: TARGET_COUNT, type: "ranked" });
  }

  const ids: string[] = [];
  for (let start = 0; start < MAX_SCAN; start += PAGE_SIZE) {
    const page = await getMatchIds(puuid, { start, count: PAGE_SIZE });
    ids.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return ids;
}

// Construit les lignes d'affichage pour une liste de matchIds, en réutilisant
// tout ce qui est déjà en base (une game finie ne change jamais) et en
// n'appelant l'API Riot que pour les matchs réellement inconnus, en parallèle.
//
// `persist` doit être false quand le puuid analysé n'est pas le compte Riot
// lié à ce user (cf. garde-fou anti-pollution dans POST) : on saute alors le
// cache ET l'upsert, pour ne jamais lire ni écrire dans les games d'un autre
// compte. L'aperçu reste éphémère, jamais stocké.
async function buildRowsForMatchIds(
  matchIds: string[],
  puuid: string,
  userId: string | null,
  supabase: SupabaseServerClient,
  persist: boolean
): Promise<Row[]> {
  if (matchIds.length === 0) return [];

  const cacheMap = new Map<string, Row>();

  if (persist) {
    const { data: cached } = await supabase
      .from("games")
      .select("riot_match_id, lane, champion, matchup, result, cs20, deaths10, queue, played_at, cs_final, game_duration_seconds")
      .eq("user_id", userId)
      .in("riot_match_id", matchIds);

    for (const row of cached ?? []) {
      if (row.riot_match_id && row.queue && row.played_at) {
        cacheMap.set(row.riot_match_id, row as Row);
      }
    }
  }

  const missingIds = matchIds.filter((id) => !cacheMap.has(id));

  const freshRows = await mapWithConcurrency(missingIds, CONCURRENCY, async (matchId): Promise<Row | null> => {
    const match = await getMatch(matchId);
    if (!isAllowedQueue(match.info.queueId)) return null;

    // On identifie le joueur par puuid directement dans info.participants,
    // sans supposer que cet ordre correspond à celui de metadata.participants :
    // toute divergence entraînerait un mauvais champion/CS/morts attribués.
    const participant = match.info.participants.find((p) => p.puuid === puuid);
    if (!participant) return null;
    const opponent = findOpponent(match, participant);
    const timeline = await getMatchTimeline(matchId);

    return {
      riot_match_id: matchId,
      lane: laneLabel(participant),
      champion: participant.championName,
      matchup: opponent?.championName ?? "",
      result: participant.win ? "Victoire" : "Défaite",
      cs20: Math.round(csAtMinute(timeline, participant.participantId, 20)),
      deaths10: deathsPer10Min(participant.deaths, match.info.gameDuration),
      queue: queueLabel(match.info.queueId),
      played_at: new Date(match.info.gameCreation).toISOString(),
      cs_final: totalCs(participant),
      game_duration_seconds: match.info.gameDuration,
    };
  });

  const newRows = freshRows.filter((row): row is Row => row !== null);

  if (persist && newRows.length > 0) {
    const { error } = await supabase
      .from("games")
      .upsert(
        newRows.map((row) => ({ ...row, user_id: userId })),
        { onConflict: "user_id,riot_match_id", ignoreDuplicates: true }
      );
    if (error) {
      console.error("Sauvegarde de l'import impossible", error);
    }
  }

  for (const row of newRows) cacheMap.set(row.riot_match_id, row);

  return matchIds.map((id) => cacheMap.get(id)).filter((row): row is Row => row !== undefined);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json().catch(() => null);
  const parsed = typeof body?.riotId === "string" ? parseRiotId(body.riotId) : null;
  const filter: Filter = body?.filter === "ranked" || body?.filter === "all" ? body.filter : "soloq";
  if (!parsed) {
    return NextResponse.json({ error: "Format attendu : Pseudo#TAG" }, { status: 400 });
  }

  try {
    const account = await getAccountByRiotId(parsed.gameName, parsed.tagLine);

    // Invariant anti-pollution : les games en base pour ce user ne doivent
    // provenir que de SON compte Riot lié. Si l'analyse porte sur un autre
    // puuid (pas encore lié, ou recherche curieuse d'un autre compte), les
    // lignes restent un aperçu éphémère, jamais écrites dans `games`. Un
    // visiteur non connecté (analyse publique gratuite, Slice 4) n'a de
    // toute façon aucun endroit où persister : toujours éphémère.
    const persist = await (async () => {
      if (!user) return false;
      const { data: profile } = await supabase
        .from("profiles")
        .select("puuid")
        .eq("user_id", user.id)
        .maybeSingle();
      return profile?.puuid === account.puuid;
    })();

    const [candidateIds, rankEntries] = await Promise.all([
      collectCandidateMatchIds(account.puuid, filter),
      getRankedEntriesByPuuid(account.puuid).catch(() => []),
    ]);

    const rows = await buildRowsForMatchIds(candidateIds, account.puuid, user?.id ?? null, supabase, persist);
    const games = rows.slice(0, TARGET_COUNT);

    const soloq = rankEntries.find((entry) => entry.queueType === "RANKED_SOLO_5x5") ?? null;

    return NextResponse.json({
      account: { gameName: account.gameName, tagLine: account.tagLine },
      games,
      rank: soloq
        ? {
            tier: soloq.tier,
            rank: soloq.rank,
            leaguePoints: soloq.leaguePoints,
            wins: soloq.wins,
            losses: soloq.losses,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
