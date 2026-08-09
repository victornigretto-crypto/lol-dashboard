import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountByRiotId,
  getMatch,
  getMatchIds,
  getRankedEntriesByPuuid,
  mapWithConcurrency,
} from "@/lib/riot/client";
import { laneLabel, parseRiotId, QUEUE_SOLOQ } from "@/lib/riot/transform";

const ROLE_SAMPLE_SIZE = 20; // fenêtre de SoloQ récentes utilisée pour déduire le rôle principal
const CONCURRENCY = 15; // appels Riot en parallèle, reste sous la limite de la dev key (20 req/s)

// Déduit le rôle principal d'un puuid : la lane la plus fréquente sur ses
// dernières SoloQ, égalité tranchée par la plus récente. `getMatchIds` (start=0)
// renvoie les matchs du plus récent au plus ancien, donc l'ordre des tableaux
// ci-dessous reflète déjà la récence.
async function resolvePrimaryRole(puuid: string): Promise<string | null> {
  const matchIds = await getMatchIds(puuid, { count: ROLE_SAMPLE_SIZE, queue: QUEUE_SOLOQ });
  if (matchIds.length === 0) return null;

  const matches = await mapWithConcurrency(matchIds, CONCURRENCY, (matchId) => getMatch(matchId));

  const roles = matches
    .map((match) => match.info.participants.find((p) => p.puuid === puuid))
    .map((participant) => (participant ? laneLabel(participant) : ""))
    .filter((role) => role !== "");
  if (roles.length === 0) return null;

  const counts = new Map<string, number>();
  for (const role of roles) counts.set(role, (counts.get(role) ?? 0) + 1);

  const bestCount = Math.max(...counts.values());
  const tied = new Set([...counts.entries()].filter(([, count]) => count === bestCount).map(([role]) => role));

  // Un seul gagnant, ou plusieurs ex-aequo : dans les deux cas, le premier
  // rôle rencontré dans `roles` (= le plus récent) qui fait partie des
  // gagnants est la bonne réponse.
  return roles.find((role) => tied.has(role)) ?? null;
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
  if (!parsed) {
    return NextResponse.json({ error: "Format attendu : Pseudo#TAG" }, { status: 400 });
  }

  try {
    const account = await getAccountByRiotId(parsed.gameName, parsed.tagLine);
    const [primaryRole, rankEntries] = await Promise.all([
      resolvePrimaryRole(account.puuid),
      getRankedEntriesByPuuid(account.puuid).catch(() => []),
    ]);

    const riotId = `${account.gameName}#${account.tagLine}`;
    const { error } = await supabase.from("profiles").upsert(
      { user_id: user.id, puuid: account.puuid, riot_id: riotId, primary_role: primaryRole },
      { onConflict: "user_id" }
    );
    if (error) {
      console.error("Liaison du compte impossible", error);
      return NextResponse.json({ error: "Sauvegarde impossible." }, { status: 500 });
    }

    const soloq = rankEntries.find((entry) => entry.queueType === "RANKED_SOLO_5x5") ?? null;

    return NextResponse.json({
      puuid: account.puuid,
      riotId,
      primaryRole,
      rank: soloq
        ? { tier: soloq.tier, rank: soloq.rank, leaguePoints: soloq.leaguePoints, wins: soloq.wins, losses: soloq.losses }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
