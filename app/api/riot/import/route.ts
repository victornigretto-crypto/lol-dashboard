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
  queueLabel,
  QUEUE_SOLOQ,
} from "@/lib/riot/transform";

const TARGET_COUNT = 20;
const PAGE_SIZE = 20;
const MAX_SCAN = 60; // borne de sécurité pour le filtre "all" (évite de scanner à l'infini un joueur qui ne fait que de l'ARAM)
const CONCURRENCY = 8; // appels Riot en parallèle, reste sous la limite de la dev key (20 req/s)

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
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function parseRiotId(raw: string): { gameName: string; tagLine: string } | null {
  const trimmed = raw.trim();
  const hashIndex = trimmed.lastIndexOf("#");
  if (hashIndex <= 0 || hashIndex === trimmed.length - 1) return null;
  return { gameName: trimmed.slice(0, hashIndex), tagLine: trimmed.slice(hashIndex + 1) };
}

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
async function buildRowsForMatchIds(
  matchIds: string[],
  puuid: string,
  userId: string,
  supabase: SupabaseServerClient
): Promise<Row[]> {
  if (matchIds.length === 0) return [];

  const { data: cached } = await supabase
    .from("games")
    .select("riot_match_id, lane, champion, matchup, result, cs20, deaths10, queue")
    .eq("user_id", userId)
    .in("riot_match_id", matchIds);

  const cacheMap = new Map<string, Row>();
  for (const row of cached ?? []) {
    if (row.riot_match_id && row.queue) {
      cacheMap.set(row.riot_match_id, row as Row);
    }
  }

  const missingIds = matchIds.filter((id) => !cacheMap.has(id));

  const freshRows = await mapWithConcurrency(missingIds, CONCURRENCY, async (matchId): Promise<Row | null> => {
    const match = await getMatch(matchId);
    if (!isAllowedQueue(match.info.queueId)) return null;

    const participantIndex = match.metadata.participants.indexOf(puuid);
    if (participantIndex === -1) return null;
    const participant = match.info.participants[participantIndex];
    const opponent = findOpponent(match, participant);
    const timeline = await getMatchTimeline(matchId);

    return {
      riot_match_id: matchId,
      lane: laneLabel(participant),
      champion: participant.championName,
      matchup: opponent?.championName ?? "",
      result: participant.win ? "Victoire" : "Défaite",
      cs20: Math.round(csAtMinute(timeline, participantIndex + 1, 20)),
      deaths10: deathsPer10Min(participant.deaths, match.info.gameDuration),
      queue: queueLabel(match.info.queueId),
    };
  });

  const newRows = freshRows.filter((row): row is Row => row !== null);

  if (newRows.length > 0) {
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
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = typeof body?.riotId === "string" ? parseRiotId(body.riotId) : null;
  const filter: Filter = body?.filter === "ranked" || body?.filter === "all" ? body.filter : "soloq";
  if (!parsed) {
    return NextResponse.json({ error: "Format attendu : Pseudo#TAG" }, { status: 400 });
  }

  try {
    const account = await getAccountByRiotId(parsed.gameName, parsed.tagLine);

    const [candidateIds, rankEntries] = await Promise.all([
      collectCandidateMatchIds(account.puuid, filter),
      getRankedEntriesByPuuid(account.puuid).catch(() => []),
    ]);

    const rows = await buildRowsForMatchIds(candidateIds, account.puuid, user.id, supabase);
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
