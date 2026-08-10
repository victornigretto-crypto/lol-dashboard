"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  averageCsPerMin,
  csMetrics,
  csPerMinBand,
  csPerMinClass,
  deaths10Band,
  deaths10Class,
  highlightClass,
  targetsOf,
  type Targets,
} from "@/lib/stats";
import {
  dominantRole,
  FALLBACK_CONTENT,
  getContent,
  tierFromRiotTier,
  type TierContent,
} from "@/lib/content";
import { championIconUrl, useDdragonVersion } from "@/lib/ddragon";
import { rememberRiotId } from "@/lib/pendingRiotId";
import { rankEmblemUrl, rankLabel } from "@/lib/riot/rank";
import { formatGameDate, parseRiotId } from "@/lib/riot/transform";

type RiotGame = {
  riot_match_id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  cs20: number;
  deaths10: number;
  queue: string;
  played_at: string;
  cs_final: number | null;
  game_duration_seconds: number | null;
};

type Rank = {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

type Filter = "soloq" | "ranked" | "all";

type SearchResult = {
  account: { gameName: string; tagLine: string };
  games: RiotGame[];
  rank: Rank | null;
};

// Le compte analysé n'a pas de profil en base (analyse éphémère) : son rôle
// se déduit de la lane la plus jouée sur les games récupérées, et son palier
// du tier league-v4 renvoyé par l'import. Rôle indéterminable : contenu de
// repli, donc ni cible ni surlignage.
function resolveContent(games: RiotGame[], rank: Rank | null): TierContent {
  const role = dominantRole(games.map((g) => g.lane));
  if (!role) return FALLBACK_CONTENT;
  return getContent(role, tierFromRiotTier(rank?.tier));
}

type Severity = "red" | "yellow" | "green";
type Banner = { id: string; severity: Severity; text: string; detail: string };

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

async function fetchGames(riotId: string, filter: Filter): Promise<SearchResult> {
  const res = await fetch("/api/riot/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ riotId, filter }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Requête impossible.");
  return body as SearchResult;
}

function sortBanners(list: Banner[]): Banner[] {
  return [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// Une game est "récente" si elle date de moins de 2 mois : au-delà, elle est
// repliée dans l'UI et exclue des moyennes d'analyse.
function isRecent(playedAt: string): boolean {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 2);
  return new Date(playedAt) >= cutoff;
}

function filterRecent(games: RiotGame[]): RiotGame[] {
  return games.filter((g) => isRecent(g.played_at));
}

function winrateBanner(games: RiotGame[]): Banner | null {
  if (games.length === 0) return null;
  const wins = games.filter((g) => g.result === "Victoire").length;
  const winrate = (wins / games.length) * 100;
  const detail = `${Math.round(winrate)}% WR sur tes ${games.length} dernières SoloQ`;
  if (winrate < 37) return { id: "winrate", severity: "red", text: "Alerte LooserQ : fais une pause de tes soloQ", detail };
  if (winrate < 50) return { id: "winrate", severity: "yellow", text: "Winrate légèrement négatif: Attention !", detail };
  if (winrate < 62) return { id: "winrate", severity: "green", text: "Winrate positif : continues comme ça", detail };
  return { id: "winrate", severity: "green", text: "Tu es en train de smurf !", detail };
}

function championDiversityBanner(games: RiotGame[]): Banner | null {
  const distinct = new Set(games.map((g) => g.champion)).size;
  const detail = `${distinct} champions différents sur tes ${games.length} dernières classées`;
  if (distinct >= 5) return { id: "champions", severity: "red", text: "Trop de champion", detail };
  if (distinct >= 4) return { id: "champions", severity: "yellow", text: "Un peu trop de champions", detail };
  return null;
}

// Comme les couleurs du tableau, ces deux bannières se jugent par rapport à
// la cible du palier et non sur une échelle absolue : sans cible connue
// (palier sans contenu), on ne dit rien plutôt que de dire faux.
function deathsBanner(games: RiotGame[], targets: Targets): Banner | null {
  if (games.length === 0 || targets.deaths10 === null) return null;
  const avg = games.reduce((sum, g) => sum + g.deaths10, 0) / games.length;
  const detail = `${avg.toFixed(1)} morts/10min en moyenne sur tes ${games.length} dernières classées (cible du palier : ${targets.deaths10})`;
  const band = deaths10Band(avg, targets.deaths10);
  if (band === "bad") return { id: "deaths", severity: "red", text: "Beaucoup trop de morts", detail };
  if (band === "warn") return { id: "deaths", severity: "yellow", text: "Trop de morts", detail };
  return null;
}

function farmBanner(games: RiotGame[], targets: Targets): Banner | null {
  const farmGames = games.filter((g) => FARM_LANES.has(g.lane));
  if (farmGames.length === 0 || targets.csPerMin === null) return null;
  const avg = averageCsPerMin(farmGames.map((g) => csMetrics(g).perMinPre20));
  if (avg === null) return null;
  const detail = `${avg} CS/min avant 20 min en moyenne (Top/Mid/Bot, ${farmGames.length} game${farmGames.length > 1 ? "s" : ""}) — cible du palier : ${targets.csPerMin}`;
  const band = csPerMinBand(avg, targets.csPerMin);
  if (band === "bad") return { id: "farm", severity: "red", text: "Gros manque de farm !", detail };
  if (band === "warn") return { id: "farm", severity: "yellow", text: "Manque de farm", detail };
  return null;
}

function isTilted(games: RiotGame[]): boolean {
  return games.some((g) => g.queue === "SoloQ" && FARM_LANES.has(g.lane) && g.deaths10 >= 4);
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
    </span>
  );
}

function GameRow({
  game,
  targets,
  content,
  ddragonVersion,
}: {
  game: RiotGame;
  targets: Targets;
  content: TierContent;
  ddragonVersion: string | null;
}) {
  const win = game.result.toLowerCase().startsWith("v");
  const icon = championIconUrl(ddragonVersion, game.champion);
  const opponentIcon = championIconUrl(ddragonVersion, game.matchup);
  const { perMinPre20, perMinPost20 } = csMetrics(game);

  return (
    <div
      className={
        "flex items-center gap-3 rounded-xl border-l-4 bg-slate-900/80 px-4 py-3 " +
        (win ? "border-green-500" : "border-red-500")
      }
    >
      <p className="w-12 shrink-0 text-center text-[11px] text-slate-500">{formatGameDate(game.played_at)}</p>

      <div className="flex shrink-0 items-center gap-1.5">
        {icon && (
          <img
            src={icon}
            alt={game.champion}
            className="h-10 w-10 rounded-full bg-slate-800"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        {opponentIcon && (
          <>
            <span className="text-[10px] font-extrabold text-red-500">VS</span>
            <img
              src={opponentIcon}
              alt={game.matchup}
              className="h-10 w-10 rounded-full bg-slate-800"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{game.champion}</p>
        <p className="text-xs text-slate-400">
          {game.lane} · {game.queue}
        </p>
      </div>

      <p className={"w-16 text-center text-sm font-semibold " + (win ? "text-green-400" : "text-red-400")}>
        {win ? "Victoire" : "Défaite"}
      </p>
      <div
        className={
          "hidden w-20 rounded px-1 py-0.5 text-center text-sm sm:block " +
          csPerMinClass(perMinPre20, targets.csPerMin) +
          highlightClass(content, "csPre20")
        }
      >
        <p className="text-[10px] leading-tight opacity-80">CS/min à 20min</p>
        <p>{perMinPre20 ?? "—"}</p>
      </div>
      <div
        className={
          "hidden w-20 rounded px-1 py-0.5 text-center text-sm sm:block " +
          csPerMinClass(perMinPost20, targets.csPerMin) +
          highlightClass(content, "csPost20")
        }
      >
        <p className="text-[10px] leading-tight opacity-80">CS/min après 20min</p>
        <p>{perMinPost20 ?? "—"}</p>
      </div>
      <div
        className={
          "hidden w-20 rounded px-1 py-0.5 text-center text-sm sm:block " +
          deaths10Class(game.deaths10, targets.deaths10) +
          highlightClass(content, "deaths10")
        }
      >
        <p className="text-[10px] leading-tight opacity-80">Morts/10m</p>
        <p>{game.deaths10}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [riotIdInput, setRiotIdInput] = useState("");
  const [account, setAccount] = useState<{ gameName: string; tagLine: string } | null>(null);
  const [rank, setRank] = useState<Rank | null>(null);
  const [filter, setFilter] = useState<Filter>("soloq");
  const [games, setGames] = useState<RiotGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ddragonVersion = useDdragonVersion();

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [expandedBanners, setExpandedBanners] = useState<Set<string>>(new Set());
  const [tiltAlert, setTiltAlert] = useState(false);
  const [showOlder, setShowOlder] = useState(false);

  // Porte d'entrée unique (Slice 4) : "/" est la page publique d'analyse
  // gratuite. Un user déjà connecté n'a rien à y faire — il atterrit direct
  // sur son cockpit (ou sur l'onboarding s'il n'a pas encore lié son compte
  // Riot). `checkingSession` évite un flash de la page marketing pendant la
  // vérification.
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setCheckingSession(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      router.replace(profile?.onboarded_at ? "/suivi" : "/onboarding");
    })();
    return () => {
      active = false;
    };
  }, [supabase, router]);

  const search = async (riotId: string, chosenFilter: Filter): Promise<SearchResult | null> => {
    setLoading(true);
    setError(null);
    setShowOlder(false);
    try {
      const body = await fetchGames(riotId, chosenFilter);
      setAccount(body.account);
      setGames(body.games);
      setRank(body.rank);
      setFilter(chosenFilter);
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible (réseau).");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseRiotId(riotIdInput);
    if (!parsed) {
      setError("Format attendu : Pseudo#TAG");
      return;
    }
    const riotId = `${parsed.gameName}#${parsed.tagLine}`;
    // Mémorisé dès la saisie : si le visiteur va au bout du pont et crée un
    // compte, l'onboarding liera ce Riot ID sans le lui redemander.
    rememberRiotId(riotId);
    // La recherche initiale est déjà filtrée sur "soloq" : on réutilise son
    // résultat (games ET rang) pour le winrate et les cibles de palier au
    // lieu de le redemander à l'API.
    const initial = await search(riotId, "soloq");
    if (initial) handleAnalyze(riotId, initial);
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
    setRiotIdInput("");
    setBanners([]);
    setExpandedBanners(new Set());
    setTiltAlert(false);
    setAnalyzeError(null);
    setShowOlder(false);
  };

  const toggleBanner = (id: string) => {
    setExpandedBanners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Deux jeux de données indépendants, traités en parallèle : le winrate
  // (soloq) s'affiche dès qu'il est prêt, sans attendre le reste. "ranked"
  // (SoloQ + Flex) sert de base pour les autres règles : filtré côté Riot,
  // donc rapide — contrairement à "all" qui doit scanner et jeter les ARAM
  // une par une. Dans les deux cas, seules les games de moins de 2 mois
  // entrent dans les moyennes. Les games soloq déjà chargées par la recherche
  // sont réutilisées au lieu de refaire l'appel ; leur rang sert aussi à
  // résoudre les cibles de palier des bannières farm / morts.
  const handleAnalyze = async (riotId: string, initial: SearchResult) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setBanners([]);
    setTiltAlert(false);

    const targets = targetsOf(resolveContent(initial.games, initial.rank));

    const onFail = (err: unknown) => {
      setAnalyzeError(err instanceof Error ? err.message : "Analyse impossible (réseau).");
    };

    const soloqTask = Promise.resolve(initial).then((data) => {
      const recent = filterRecent(data.games);
      const banner = winrateBanner(recent);
      if (banner) setBanners((prev) => sortBanners([...prev, banner]));
    }, onFail);

    const rankedTask = fetchGames(riotId, "ranked").then((data) => {
      const recent = filterRecent(data.games);
      const extra = [
        championDiversityBanner(recent),
        deathsBanner(recent, targets),
        farmBanner(recent, targets),
      ].filter((b): b is Banner => b !== null);
      if (extra.length > 0) setBanners((prev) => sortBanners([...prev, ...extra]));
      setTiltAlert(isTilted(recent));
    }, onFail);

    await Promise.allSettled([soloqTask, rankedTask]);
    setAnalyzing(false);
  };

  const recentGames = games.filter((g) => isRecent(g.played_at));
  const olderGames = games.filter((g) => !isRecent(g.played_at));
  const content = resolveContent(games, rank);
  const targets = targetsOf(content);

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <LoadingDots />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {tiltAlert && (
        <div className="bg-red-600 py-4 text-center text-xl font-extrabold tracking-wide text-white sm:text-2xl">
          ES-TU TILTÉ BÉBOU?!!
        </div>
      )}

      {!account ? (
        <div className="relative flex flex-col items-center justify-center overflow-hidden px-4 pt-20 pb-32 text-center">
          <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />
          <h1 className="relative text-5xl font-bold tracking-tight">GG Dashboard</h1>
          <p className="relative mt-3 text-lg text-slate-400">Analyse gratuite de ton profil League of Legends</p>

          <form onSubmit={handleSubmit} className="relative mt-10 flex w-full max-w-xl items-center gap-2">
            <input
              type="text"
              value={riotIdInput}
              onChange={(e) => setRiotIdInput(e.target.value)}
              placeholder="Pseudo#TAG"
              autoFocus
              className="min-w-0 flex-1 rounded-full border border-slate-700 bg-slate-900 px-5 py-3 text-slate-100 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !riotIdInput.trim()}
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "..." : "GO"}
            </button>
          </form>

          {error && <p className="relative mt-4 text-sm text-red-400">{error}</p>}

          <p className="relative mt-6 text-xs text-slate-500">
            Déjà un compte ?{" "}
            <Link href="/login" className="underline hover:text-slate-300">
              Connecte-toi
            </Link>
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pb-16">
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center md:text-left">
                <h1 className="text-2xl font-bold break-words">
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

              <aside className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
                  Analyse
                  {analyzing && <LoadingDots />}
                </h2>
                {banners.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {banners.map((b) => {
                      const expanded = expandedBanners.has(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => toggleBanner(b.id)}
                          className={
                            "w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition " +
                            SEVERITY_CLASS[b.severity]
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{b.text}</span>
                            <span className={"text-xs transition-transform " + (expanded ? "rotate-180" : "")}>
                              ▾
                            </span>
                          </div>
                          {expanded && <p className="mt-1 text-xs font-normal opacity-90">{b.detail}</p>}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {analyzeError && <p className="mt-3 text-sm text-red-400">{analyzeError}</p>}
                {!analyzing && !analyzeError && banners.length === 0 && (
                  <p className="mt-3 text-sm text-slate-400">Rien à signaler.</p>
                )}
              </aside>

              {!content.inDevelopment && (
                <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                  <h2 className="text-lg font-semibold text-slate-200">Sur quoi progresser</h2>
                  <p className="mt-2 text-sm text-slate-300">{content.focusIntro}</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {content.focusPoints.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 shrink-0 text-blue-400">→</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex min-h-[172px] flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                {rank ? (
                  <>
                    <img
                      src={rankEmblemUrl(rank.tier)}
                      alt={rank.tier}
                      className="h-20 w-20 object-contain"
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
                    <>
                      {recentGames.map((game) => (
                        <GameRow key={game.riot_match_id} game={game} targets={targets} content={content} ddragonVersion={ddragonVersion} />
                      ))}
                      {recentGames.length === 0 && olderGames.length > 0 && (
                        <p className="text-center text-slate-400">Aucune game de moins de 2 mois pour ce filtre.</p>
                      )}
                      {olderGames.length > 0 && (
                        <button
                          onClick={() => setShowOlder((v) => !v)}
                          className="mt-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                        >
                          {showOlder
                            ? "Masquer les parties datant de plus de 2 mois"
                            : `Voir les parties datant de plus de 2 mois (${olderGames.length})`}
                        </button>
                      )}
                      {showOlder &&
                        olderGames.map((game) => (
                          <GameRow key={game.riot_match_id} game={game} targets={targets} content={content} ddragonVersion={ddragonVersion} />
                        ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pont vers le compte : proposé seulement une fois la valeur
              livrée, jamais avant l'analyse. */}
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-8 text-center">
            <p className="text-lg font-semibold text-slate-100">
              Ton analyse s&apos;arrête là. Ta progression, non.
            </p>
            <Link
              href="/decouvrir"
              className="rounded-full bg-blue-600 px-8 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Je veux progresser →
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
