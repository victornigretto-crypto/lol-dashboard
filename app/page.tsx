"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { csClass, deathsClass } from "@/lib/stats";
import { rankEmblemUrl, rankLabel } from "@/lib/riot/rank";

type RiotGame = {
  riot_match_id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  cs20: number;
  deaths10: number;
  queue: string;
};

type Rank = {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

type Filter = "soloq" | "ranked" | "all";

type Severity = "red" | "yellow" | "green";
type Banner = { severity: Severity; text: string };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "soloq", label: "SoloQ uniquement" },
  { key: "all", label: "Normal & Classés" },
  { key: "ranked", label: "Flex & Solo duo" },
];

const SEVERITY_ORDER: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };
const SEVERITY_CLASS: Record<Severity, string> = {
  red: "bg-red-600 text-white",
  yellow: "bg-yellow-500 text-black",
  green: "bg-green-600 text-white",
};
const FARM_LANES = new Set(["Top", "Mid", "Bot"]);

async function fetchGames(riotId: string, filter: Filter) {
  const res = await fetch("/api/riot/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ riotId, filter }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Requête impossible.");
  return body as { account: { gameName: string; tagLine: string }; games: RiotGame[]; rank: Rank | null };
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [account, setAccount] = useState<{ gameName: string; tagLine: string } | null>(null);
  const [rank, setRank] = useState<Rank | null>(null);
  const [filter, setFilter] = useState<Filter>("soloq");
  const [games, setGames] = useState<RiotGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ddragonVersion, setDdragonVersion] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [tiltAlert, setTiltAlert] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [supabase]);

  useEffect(() => {
    fetch("https://ddragon.leagueoflegends.com/api/versions.json")
      .then((r) => r.json())
      .then((versions: string[]) => setDdragonVersion(versions[0] ?? null))
      .catch(() => setDdragonVersion(null));
  }, []);

  const search = async (riotId: string, chosenFilter: Filter): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchGames(riotId, chosenFilter);
      setAccount(body.account);
      setGames(body.games);
      setRank(body.rank);
      setFilter(chosenFilter);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible (réseau).");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameName.trim() || !tagLine.trim()) return;
    const riotId = `${gameName.trim()}#${tagLine.trim()}`;
    const ok = await search(riotId, "soloq");
    if (ok) handleAnalyze(riotId);
  };

  const handleFilterChange = (nextFilter: Filter) => {
    if (!account || loading) return;
    search(`${account.gameName}#${account.tagLine}`, nextFilter);
  };

  const handleNewSearch = () => {
    setAccount(null);
    setGames([]);
    setRank(null);
    setError(null);
    setGameName("");
    setTagLine("");
    setBanners([]);
    setTiltAlert(false);
    setAnalyzeError(null);
  };

  const handleAnalyze = async (riotId: string) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setBanners([]);
    setTiltAlert(false);
    try {
      const [allData, soloqData] = await Promise.all([fetchGames(riotId, "all"), fetchGames(riotId, "soloq")]);

      const next: Banner[] = [];

      const distinctChampions = new Set(allData.games.map((g) => g.champion)).size;
      if (distinctChampions >= 5) next.push({ severity: "red", text: "Trop de champion" });
      else if (distinctChampions >= 4) next.push({ severity: "yellow", text: "Un peu trop de champions" });

      const avgDeaths10 = allData.games.length
        ? allData.games.reduce((sum, g) => sum + g.deaths10, 0) / allData.games.length
        : 0;
      if (avgDeaths10 > 2) next.push({ severity: "red", text: "Beaucoup trop de morts" });
      else if (avgDeaths10 > 1.75) next.push({ severity: "yellow", text: "Trop de morts" });

      const farmGames = allData.games.filter((g) => FARM_LANES.has(g.lane));
      if (farmGames.length > 0) {
        const avgCs20 = farmGames.reduce((sum, g) => sum + g.cs20, 0) / farmGames.length;
        if (avgCs20 < 130) next.push({ severity: "red", text: "Gros manque de farm !" });
        else if (avgCs20 < 140) next.push({ severity: "yellow", text: "Manque de farm" });
      }

      const tilted = allData.games.some(
        (g) => g.queue === "SoloQ" && FARM_LANES.has(g.lane) && g.deaths10 >= 4
      );
      setTiltAlert(tilted);

      if (soloqData.games.length > 0) {
        const wins = soloqData.games.filter((g) => g.result === "Victoire").length;
        const winrate = (wins / soloqData.games.length) * 100;
        if (winrate < 37) next.push({ severity: "red", text: "Alerte LooserQ : fais une pause de tes soloQ" });
        else if (winrate < 50) next.push({ severity: "yellow", text: "Winrate légèrement négatif: Attention !" });
        else if (winrate < 62) next.push({ severity: "green", text: "Winrate positif : continues comme ça" });
        else next.push({ severity: "green", text: "Tu es en train de smurf !" });
      }

      next.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      setBanners(next);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analyse impossible (réseau).");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isWin = (result: string) => result.toLowerCase().startsWith("v");

  const championIconUrl = (champion: string) =>
    ddragonVersion ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champion}.png` : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {tiltAlert && (
        <div className="bg-red-600 py-4 text-center text-xl font-extrabold tracking-wide text-white sm:text-2xl">
          ES-TU TILTÉ BÉBOU?!!
        </div>
      )}

      <div className="flex items-center justify-end gap-3 p-4 text-sm text-slate-400">
        {userEmail && <span className="hidden sm:inline">{userEmail}</span>}
        <Link href="/suivi" className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800">
          Mon suivi
        </Link>
        <button onClick={handleLogout} className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800">
          Se déconnecter
        </button>
      </div>

      {!account ? (
        <div className="flex flex-col items-center justify-center px-4 pt-20 pb-32 text-center">
          <h1 className="text-5xl font-bold tracking-tight">SoloQ Dashboard</h1>
          <p className="mt-3 text-lg text-slate-400">Analyse ton profil</p>

          <form onSubmit={handleSubmit} className="mt-10 flex w-full max-w-xl items-center gap-2">
            <div className="flex flex-1 items-center rounded-full border border-slate-700 bg-slate-900 px-5 py-3 focus-within:border-blue-500">
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Pseudo"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none"
              />
              <span className="px-1 text-lg text-slate-500">#</span>
              <input
                type="text"
                value={tagLine}
                onChange={(e) => setTagLine(e.target.value)}
                placeholder="TAG"
                className="w-20 bg-transparent text-slate-100 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !gameName.trim() || !tagLine.trim()}
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "..." : "GO"}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pb-16">
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold">
                {account.gameName}
                <span className="text-slate-500">#{account.tagLine}</span>
              </h1>
              <button
                onClick={handleNewSearch}
                className="mt-2 text-sm text-slate-400 underline hover:text-slate-200"
              >
                Nouvelle recherche
              </button>
            </div>

            <div className="flex flex-col items-center">
              {rank ? (
                <>
                  <img
                    src={rankEmblemUrl(rank.tier)}
                    alt={rank.tier}
                    className="h-24 w-24"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <p className="mt-1 text-2xl font-bold">{rankLabel(rank.tier, rank.rank)}</p>
                  <p className="text-slate-400">{rank.leaguePoints} LP</p>
                </>
              ) : (
                <p className="text-slate-400">Non classé en SoloQ</p>
              )}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <h2 className="text-lg font-semibold text-slate-200">Analyse</h2>
              {analyzing ? (
                <p className="mt-3 text-sm text-slate-400">Analyse en cours...</p>
              ) : analyzeError ? (
                <p className="mt-3 text-sm text-red-400">{analyzeError}</p>
              ) : banners.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  {banners.map((b, i) => (
                    <div
                      key={i}
                      className={"rounded-lg px-3 py-2 text-sm font-semibold " + SEVERITY_CLASS[b.severity]}
                    >
                      {b.text}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Rien à signaler.</p>
              )}
            </aside>

            <div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => handleFilterChange(f.key)}
                    disabled={loading}
                    className={
                      "rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 " +
                      (filter === f.key
                        ? "bg-blue-600 text-white"
                        : "border border-slate-700 text-slate-300 hover:bg-slate-800")
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

              <div className="mt-4 flex flex-col gap-2">
                {loading ? (
                  <p className="text-center text-slate-400">Chargement des games...</p>
                ) : games.length === 0 ? (
                  <p className="text-center text-slate-400">Aucune game trouvée pour ce filtre.</p>
                ) : (
                  games.map((game) => {
                    const win = isWin(game.result);
                    const icon = championIconUrl(game.champion);
                    return (
                      <div
                        key={game.riot_match_id}
                        className={
                          "flex items-center gap-4 rounded-xl border-l-4 bg-slate-900/80 px-4 py-3 " +
                          (win ? "border-green-500" : "border-red-500")
                        }
                      >
                        {icon && (
                          <img
                            src={icon}
                            alt={game.champion}
                            className="h-10 w-10 shrink-0 rounded-full bg-slate-800"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{game.champion}</p>
                          <p className="text-xs text-slate-400">
                            {game.lane} · {game.queue}
                          </p>
                        </div>
                        <p className={"w-16 text-center text-sm font-semibold " + (win ? "text-green-400" : "text-red-400")}>
                          {win ? "Victoire" : "Défaite"}
                        </p>
                        <div className={"hidden w-16 rounded px-1 py-0.5 text-center text-sm sm:block " + csClass(game.cs20)}>
                          <p className="text-[10px] opacity-80">CS@20</p>
                          <p>{game.cs20}</p>
                        </div>
                        <div className={"hidden w-20 rounded px-1 py-0.5 text-center text-sm sm:block " + deathsClass(game.deaths10)}>
                          <p className="text-[10px] opacity-80">Morts/10m</p>
                          <p>{game.deaths10}</p>
                        </div>
                        <div className="hidden w-24 text-right text-sm text-slate-400 md:block">
                          <p className="text-slate-500">Matchup</p>
                          <p className="truncate">{game.matchup || "—"}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
