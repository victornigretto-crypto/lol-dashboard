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
  deathsInLastMinutes,
  deathsPer10Min,
  findOpponent,
  isAllowedQueue,
  laneLabel,
  parseRiotId,
  queueLabel,
  totalCs,
  QUEUE_SOLOQ,
} from "@/lib/riot/transform";
import { readMatchFacts, writeMatchFacts, type MatchFacts } from "@/lib/riot/matchCache";

const TARGET_COUNT = 20;
const PAGE_SIZE = 20;
const MAX_SCAN = 60; // borne de sécurité pour le filtre "all" (évite de scanner à l'infini un joueur qui ne fait que de l'ARAM)
const CONCURRENCY = 15; // appels Riot en parallèle, reste sous la limite de la dev key (20 req/s)

// Fenêtre de fin de partie dont les morts sont pondérées à l'affichage
// (cf. lib/stats). On stocke le FAIT BRUT — combien de morts dans les 5
// dernières minutes — et pas le résultat de la pondération : la règle de
// pondération peut changer, l'historique des morts, non.
const LATE_DEATHS_WINDOW_MIN = 5;

type Filter = "soloq" | "ranked" | "all";

// La forme des lignes renvoyées au navigateur est celle du cache partagé :
// une seule définition (cf. lib/riot/matchCache.ts), donc aucune divergence
// possible entre ce qu'on cache et ce qu'on affiche.
type Row = MatchFacts;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Construit les lignes d'affichage pour une liste de matchIds, en réutilisant
// le cache partagé (une game finie ne change jamais) et en n'appelant l'API
// Riot que pour les matchs réellement inconnus, en parallèle.
//
// Le cache est lu par (riot_match_id, puuid) dans `match_facts`, PAS dans
// `games` : les faits d'une partie terminée sont publics et identiques pour
// tout le monde, alors que `games` est la vue personnelle d'un user. Lire dans
// `games` réservait donc le cache aux seuls utilisateurs connectés analysant
// leur propre compte — c'est-à-dire que l'analyse gratuite, le parcours de
// chaque visiteur, ne cachait rien du tout et retéléchargeait 20 parties à
// chaque fois.
//
// `persist` reste l'invariant anti-pollution et ne gouverne plus que `games` :
// on n'écrit dans les games d'un user que si le puuid analysé est bien son
// compte lié. Le cache partagé, lui, n'appartient à personne — l'alimenter
// depuis l'analyse d'un inconnu est sans risque et profite à tous.
async function buildRowsForMatchIds(
  matchIds: string[],
  puuid: string,
  userId: string | null,
  supabase: SupabaseServerClient,
  persist: boolean
): Promise<Row[]> {
  if (matchIds.length === 0) return [];

  const cacheMap = await readMatchFacts(matchIds, puuid);

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
      deaths: participant.deaths,
      deaths_last5: deathsInLastMinutes(
        timeline,
        participant.participantId,
        match.info.gameDuration,
        LATE_DEATHS_WINDOW_MIN
      ),
    };
  });

  const newRows = freshRows.filter((row): row is Row => row !== null);

  for (const row of newRows) cacheMap.set(row.riot_match_id, row);

  const rows = matchIds.map((id) => cacheMap.get(id)).filter((row): row is Row => row !== undefined);

  await Promise.all([
    // Le cache partagé ne reçoit que ce qui vient d'être téléchargé : le reste
    // en sort déjà.
    writeMatchFacts(newRows, puuid),

    // `games`, lui, reçoit TOUTES les lignes affichées et pas seulement les
    // nouvelles. C'est la conséquence directe du cache partagé : une partie
    // servie depuis `match_facts` n'est jamais retéléchargée, donc si on
    // n'écrivait que `newRows`, elle n'atterrirait jamais dans les games du
    // joueur — et /suivi, qui lit `games` en direct pour les notes, afficherait
    // un cockpit vide. L'upsert est idempotent : le recoût est nul.
    //
    // `ignoreDuplicates: false` : une ligne déjà présente doit être MISE À JOUR,
    // sinon une game importée avant la Slice 3 garderait ses colonnes nulles à
    // vie. Seules les colonnes du payload sont réécrites — les trois listes
    // d'erreurs et le résumé, saisis par le joueur dans /suivi, n'y sont pas et
    // sont donc préservés.
    (async () => {
      if (!persist || rows.length === 0) return;
      const { error } = await supabase
        .from("games")
        .upsert(
          rows.map((row) => ({ ...row, user_id: userId, puuid })),
          { onConflict: "user_id,riot_match_id", ignoreDuplicates: false }
        );
      if (error) {
        console.error("Sauvegarde de l'import impossible", error);
      }
    })(),
  ]);

  return rows;
}

// Rassemble les lignes à afficher selon le filtre, en ne demandant à Riot que
// ce qui est nécessaire.
// - soloq / ranked : Riot filtre déjà côté serveur (queue / type), une seule
//   page suffit, aucun appel gaspillé.
// - all : aucun filtre Riot ne garantit d'exclure l'ARAM proprement, il faut
//   donc scanner et trier nous-mêmes sur queueId. On avance page par page et
//   on s'arrête dès qu'on a le compte, au lieu de construire les MAX_SCAN
//   candidats pour n'en garder que TARGET_COUNT : chaque match jeté coûterait
//   deux appels Riot (match + timeline) et ferait sauter le quota de la dev
//   key (100 req / 2 min), d'où des minutes d'attente en backoff 429.
async function collectRows(
  puuid: string,
  filter: Filter,
  userId: string | null,
  supabase: SupabaseServerClient,
  persist: boolean
): Promise<Row[]> {
  const build = (ids: string[]) => buildRowsForMatchIds(ids, puuid, userId, supabase, persist);

  if (filter === "soloq") {
    return build(await getMatchIds(puuid, { count: TARGET_COUNT, queue: QUEUE_SOLOQ }));
  }
  if (filter === "ranked") {
    return build(await getMatchIds(puuid, { count: TARGET_COUNT, type: "ranked" }));
  }

  const rows: Row[] = [];
  for (let start = 0; start < MAX_SCAN && rows.length < TARGET_COUNT; start += PAGE_SIZE) {
    const page = await getMatchIds(puuid, { start, count: PAGE_SIZE });
    rows.push(...(await build(page)));
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
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

    const [rows, rankEntries] = await Promise.all([
      collectRows(account.puuid, filter, user?.id ?? null, supabase, persist),
      getRankedEntriesByPuuid(account.puuid).catch(() => []),
    ]);

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
