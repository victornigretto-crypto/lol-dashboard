// Client serveur pour l'API Riot Games. RIOT_API_KEY n'est jamais exposée au
// navigateur : ce module ne doit être importé que depuis du code serveur
// (route handlers, server components).

// Match-V5 / Account-V1 sont routés par continent, League-V4 (classement)
// est routé par plateforme (le serveur de jeu, ex: euw1).
const REGIONAL_HOST = "europe.api.riotgames.com";
const PLATFORM_HOST = "euw1.api.riotgames.com";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 5;

async function riotFetch<T>(host: string, path: string, attempt = 0): Promise<T> {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    throw new Error("RIOT_API_KEY manquante dans .env.local");
  }

  const res = await fetch(`https://${host}${path}`, {
    headers: { "X-Riot-Token": apiKey },
    cache: "no-store",
  });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(
        "Riot API surchargée (quota de la dev key atteint). Attends une minute ou deux avant de réessayer."
      );
    }
    const retryAfter = Number(res.headers.get("retry-after") ?? "1");
    // + un peu d'aléatoire pour éviter que les appels en parallèle ne
    // resynchronisent leurs retries et ne recréent le même pic de requêtes.
    await sleep((retryAfter + 0.5 + Math.random()) * 1000);
    return riotFetch<T>(host, path, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Riot API ${res.status} sur ${path}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export type RiotAccount = { puuid: string; gameName: string; tagLine: string };

export function getAccountByRiotId(gameName: string, tagLine: string) {
  return riotFetch<RiotAccount>(
    REGIONAL_HOST,
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
}

export type MatchIdsOptions = {
  start?: number;
  count?: number;
  queue?: number;
  type?: "ranked" | "normal" | "tourney" | "tutorial";
};

export function getMatchIds(puuid: string, opts: MatchIdsOptions = {}) {
  const params = new URLSearchParams();
  params.set("start", String(opts.start ?? 0));
  params.set("count", String(opts.count ?? 20));
  if (opts.queue) params.set("queue", String(opts.queue));
  if (opts.type) params.set("type", opts.type);
  return riotFetch<string[]>(REGIONAL_HOST, `/lol/match/v5/matches/by-puuid/${puuid}/ids?${params.toString()}`);
}

export type MatchParticipant = {
  puuid: string;
  participantId: number;
  championName: string;
  teamId: number;
  teamPosition: string;
  individualPosition: string;
  win: boolean;
  deaths: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
};

export type MatchDto = {
  metadata: { matchId: string; participants: string[] };
  info: { gameCreation: number; gameDuration: number; queueId: number; participants: MatchParticipant[] };
};

export function getMatch(matchId: string) {
  return riotFetch<MatchDto>(REGIONAL_HOST, `/lol/match/v5/matches/${matchId}`);
}

export type MatchTimelineDto = {
  info: {
    frames: Array<{
      timestamp: number;
      participantFrames: Record<string, { minionsKilled: number; jungleMinionsKilled: number }>;
    }>;
  };
};

export function getMatchTimeline(matchId: string) {
  return riotFetch<MatchTimelineDto>(REGIONAL_HOST, `/lol/match/v5/matches/${matchId}/timeline`);
}

export type RankedEntry = {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

export function getRankedEntriesByPuuid(puuid: string) {
  return riotFetch<RankedEntry[]>(PLATFORM_HOST, `/lol/league/v4/entries/by-puuid/${puuid}`);
}

// Exécute `fn` sur chaque item avec au plus `concurrency` appels en vol
// simultanément, pour rester sous la limite de la dev key (20 req/s,
// 100 req/2min) tout en allant plus vite qu'un enchaînement strictement
// séquentiel.
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
