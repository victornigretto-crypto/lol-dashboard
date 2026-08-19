"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FARM_LANES, performanceBanners, sortBanners, type Banner } from "@/lib/banners";
import {
  dominantRole,
  FALLBACK_CONTENT,
  getContent,
  thresholdsOf,
  tierFromRiotTier,
  type Role,
  type TierContent,
  type TierThresholds,
} from "@/lib/content";
import { championIconUrl, useDdragonVersion } from "@/lib/ddragon";
import { rememberRiotId } from "@/lib/pendingRiotId";
import { EARLIEST_GAME_ISO, estRemake, sampleForAnalysis, sampleForDisplay } from "@/lib/sample";
import { rankEmblemUrl, rankLabel } from "@/lib/riot/rank";
import { formatDuration, formatGameDate, parseRiotId } from "@/lib/riot/transform";
import { AnalysisPanel } from "./_components/AnalysisPanel";
import { LoadingDots } from "./_components/LoadingDots";
import { StatCells } from "./_components/StatCells";

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
  deaths: number | null;
  deaths_last5: number | null;
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

// Les seuils de couleur, eux, ne dépendent que du palier : pas besoin de
// connaître le rôle pour les résoudre.
function resolveThresholds(rank: Rank | null): TierThresholds | null {
  return thresholdsOf(tierFromRiotTier(rank?.tier));
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "soloq", label: "SoloQ uniquement" },
  { key: "all", label: "Normal & Classés" },
  { key: "ranked", label: "Flex & Solo duo" },
];

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

// Le plancher d'analyse, écrit tel qu'un joueur le lit. Dérivé de la constante
// partagée : la date ne doit exister qu'à un seul endroit (lib/sample).
const PLANCHER_LISIBLE = new Date(EARLIEST_GAME_ISO).toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const ROLE_LABELS: Record<Role, string> = {
  mid: "Mid",
  top: "Top",
  jungle: "Jungle",
  adc: "ADC",
  support: "Support",
};

// Le pont vers l'inscription, seul et même appel à l'action de la page
// publique. Défini une fois et utilisé aux deux endroits (écran de recherche
// et écran de résultat) : deux copies finiraient par diverger de texte ou de
// style, comme l'avaient fait les bandeaux d'analyse avant d'être regroupés
// dans lib/banners. Le texte n'est volontairement PAS un paramètre — il est le
// même partout, et un paramètre finirait par porter deux formulations.
//
// Pilule bleu vif pleine largeur, dans l'esprit du bandeau d'op.gg : c'est le
// seul élément massivement coloré de la page, donc le seul qui se lise comme
// une action et non comme un panneau d'information (les panneaux, eux, restent
// en bleu translucide sur fond ardoise).
// Pas de flèche : le libellé dit déjà l'action, et la pilule bleue dit déjà
// qu'on clique. `size` reste le seul paramètre — l'accueil s'aligne sur le
// champ de recherche, l'écran de résultat prend toute la largeur.
function AnalyzeErrorsBanner({ size = "normal" }: { size?: "normal" | "large" }) {
  return (
    <Link
      href="/login"
      className={
        "flex w-full items-center justify-center rounded-full bg-blue-500 text-center font-semibold text-white transition hover:bg-blue-400 " +
        (size === "large" ? "px-8 py-4 text-base sm:text-lg" : "px-6 py-3 text-sm sm:text-base")
      }
    >
      Me connecter pour analyser ma progression
    </Link>
  );
}

function winrateBanner(games: RiotGame[]): Banner | null {
  if (games.length === 0) return null;
  const wins = games.filter((g) => g.result === "Victoire").length;
  const winrate = (wins / games.length) * 100;
  const detail = `${Math.round(winrate)}% WR sur tes ${games.length} dernières SoloQ`;
  // Sous 50 %, ce bandeau ne dit RIEN. Les deux verdicts négatifs — « Alerte
  // LooserQ, fais une pause » (sous 37 %) et « Winrate légèrement négatif »
  // (sous 50 %) — ont été retirés le 2026-08-18 à la demande de Victor.
  //
  // La raison tient au reste du panneau : un winrate bas est un RÉSULTAT, pas
  // une cause, et il ne dit à personne quoi corriger. Les bandeaux de farm, de
  // morts et de rôles, eux, désignent un geste précis. Doubler ceux-là d'un
  // constat décourageant sur lequel le joueur n'a pas de prise n'apportait rien.
  // Le winrate ne se signale donc plus que quand il est bon.
  if (winrate < 50) return null;
  // Les deux zones vertes du winrate se distinguent maintenant à l'œil : le
  // vert pâle pour "ça monte", le vert foncé pour le smurf.
  if (winrate < 62) return { id: "winrate", severity: "good", text: "Bon winrate : Continues comme ça", detail };
  return { id: "winrate", severity: "great", text: "Es-tu un smurf ?", detail };
}

// Les bandeaux de farm, de morts, de rôles et de pool de champions vivent dans
// lib/banners : ils sont partagés avec /suivi et se jugent sur les mêmes seuils
// de palier que les couleurs du tableau. L'ancien `championDiversityBanner`
// local (5 champions tous rôles confondus, sans palier) y a été absorbé par
// `championPoolBanner`, qui compte par rôle et par palier.

function isTilted(games: RiotGame[]): boolean {
  return games.some((g) => g.queue === "SoloQ" && FARM_LANES.has(g.lane) && g.deaths10 >= 4);
}

function GameRow({
  game,
  thresholds,
  content,
  ddragonVersion,
}: {
  game: RiotGame;
  thresholds: TierThresholds | null;
  content: TierContent;
  ddragonVersion: string | null;
}) {
  const win = game.result.toLowerCase().startsWith("v");
  // Une partie de moins de 5 minutes n'a pas eu lieu : ni victoire, ni défaite.
  // Le verdict de Riot est bien "Défaite", mais l'afficher ferait porter au
  // joueur un résultat que l'analyse, elle, ne compte pas.
  const remake = estRemake(game);
  const icon = championIconUrl(ddragonVersion, game.champion);
  const opponentIcon = championIconUrl(ddragonVersion, game.matchup);

  return (
    <div
      className={
        "flex items-center gap-3 rounded-xl border-l-4 bg-slate-900/80 px-4 py-3 " +
        (remake ? "border-slate-600" : win ? "border-green-500" : "border-red-500")
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
          {[game.lane, game.queue, formatDuration(game.game_duration_seconds)].filter(Boolean).join(" · ")}
        </p>
      </div>

      <p
        className={
          "w-16 text-center text-sm font-semibold " +
          (remake ? "text-slate-400" : win ? "text-green-400" : "text-red-400")
        }
      >
        {remake ? "Remake" : win ? "Victoire" : "Défaite"}
      </p>
      <StatCells game={game} thresholds={thresholds} content={content} hideOnMobile />
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
  const [tiltAlert, setTiltAlert] = useState(false);

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
    setTiltAlert(false);
    setAnalyzeError(null);
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

    const thresholds = resolveThresholds(initial.rank);
    // Le bandeau des rôles ne dépend pas des seuils mais du PALIER lui-même :
    // il ne s'affiche plus à partir d'émeraude.
    const tier = tierFromRiotTier(initial.rank?.tier);

    const onFail = (err: unknown) => {
      setAnalyzeError(err instanceof Error ? err.message : "Analyse impossible (réseau).");
    };

    const soloqTask = Promise.resolve(initial).then((data) => {
      // Winrate : les 20 dernières parties, point. Aucun filtre de rôle — il
      // mesure un résultat de file, pas l'exécution d'une lane.
      const banner = winrateBanner(sampleForAnalysis(data.games));
      if (banner) setBanners((prev) => sortBanners([...prev, banner]));
    }, onFail);

    const rankedTask = fetchGames(riotId, "ranked").then((data) => {
      const sample = sampleForAnalysis(data.games);
      // Le rôle vient de l'échantillon analysé, pas de la totalité des games
      // rapatriées : c'est bien le rôle des parties qu'on juge.
      const role = dominantRole(sample.map((g) => g.lane));
      const extra = performanceBanners(sample, thresholds, role, tier);
      if (extra.length > 0) setBanners((prev) => sortBanners([...prev, ...extra]));
      setTiltAlert(isTilted(sample));
    }, onFail);

    await Promise.allSettled([soloqTask, rankedTask]);
    setAnalyzing(false);
  };

  // Les parties affichées sont EXACTEMENT celles qui servent à l'analyse : plus
  // de repli « plus de 2 mois », plus de game masquée dont dépendrait un
  // bandeau. Ce que le joueur voit est ce qui a été jugé.
  // DEUX listes, et il ne faut pas les confondre :
  //   - `displayedGames` : les 20 dernières parties, REMAKES COMPRIS. Un remake
  //     occupe une place dans l'historique, on veut le voir.
  //   - `analysedGames`  : les 20 dernières VRAIES parties. Un remake n'y prend
  //     aucune place, donc l'analyse va chercher un peu plus loin en arrière.
  // Conséquence assumée : les deux listes ne se recouvrent pas exactement dès
  // qu'il y a un remake dans la fenêtre.
  const displayedGames = sampleForDisplay(games);
  const analysedGames = sampleForAnalysis(games);
  const content = resolveContent(analysedGames, rank);
  const thresholds = resolveThresholds(rank);
  // Le rôle affiché vient des games analysées, pas d'un `primary_role` en
  // base : un compte public n'en a pas.
  const dominant = dominantRole(analysedGames.map((g) => g.lane));
  const roleLabel = dominant ? ROLE_LABELS[dominant] : null;

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
          <p className="relative mt-3 text-lg text-slate-400">Analyse de ton profil League of Legends</p>

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

          {/* Remplace l'ancien « Déjà un compte ? Connecte-toi » : on ne
              propose plus une formalité de compte, on nomme ce que le compte
              apporte. La destination reste la même. */}
          {/* Aligné sur la largeur du champ de recherche, juste en dessous. */}
          <div className="relative mt-8 w-full max-w-xl">
            <AnalyzeErrorsBanner />
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pb-16">
          {/* Même disposition que le cockpit connecté (/suivi) : bandeau
              d'identité en haut, « Sur quoi progresser » en pleine largeur,
              puis l'analyse à gauche et l'historique à droite. Les deux écrans
              montrent la même chose ; ils ne doivent pas la ranger
              différemment. */}
          <header className="mb-6 pt-4">
            <div className="mb-3">
              <button
                onClick={handleNewSearch}
                className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Nouvelle recherche
              </button>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-[0.3em] text-blue-400">GG Dashboard</p>
                  <h1 className="mt-3 text-3xl font-semibold break-words">
                    {account.gameName}
                    <span className="text-slate-500">#{account.tagLine}</span>
                  </h1>
                  {/* Ici le rôle se déduit des games analysées : un compte
                      public n'a pas de `primary_role` en base. */}
                  <p className="mt-1 text-slate-400">
                    {roleLabel ? `Rôle principal : ${roleLabel}` : "Rôle principal en cours de détection"}
                  </p>
                </div>

                {/* Emblème, palier, LP empilés — la disposition du client LoL. */}
                {rank ? (
                  <div className="flex shrink-0 flex-col items-center">
                    <img
                      src={rankEmblemUrl(rank.tier)}
                      alt={rank.tier}
                      className="h-20 w-20 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <p className="mt-1 text-lg font-semibold">{rankLabel(rank.tier, rank.rank)}</p>
                    <p className="text-sm text-slate-400">{rank.leaguePoints} LP</p>
                  </div>
                ) : (
                  <p className="shrink-0 text-slate-400">Non classé en SoloQ</p>
                )}
              </div>
            </div>
          </header>

          {/* Visible même sans contenu écrit : on le dit franchement plutôt
              que de faire disparaître le bloc (même choix que /suivi et
              /onboarding). */}
          <div className="mb-6 rounded-2xl border border-blue-500/40 bg-blue-500/10 p-5">
            <h2 className="text-lg font-semibold text-blue-200">Sur quoi progresser</h2>
            {content.inDevelopment ? (
              <p className="mt-2 italic text-slate-400">
                Pas encore développé pour ce palier et ce rôle.
              </p>
            ) : (
              <>
                <p className="mt-2 text-slate-200">{content.focusIntro}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {content.focusPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-0.5 shrink-0 text-blue-400">→</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Entre le quoi-travailler et l'historique : c'est là que le
              visiteur vient de voir ses erreurs sans pouvoir les noter. Pleine
              largeur du cockpit et plus grand qu'à l'accueil — ici l'analyse a
              déjà été livrée, c'est le moment où l'appel à l'action pèse le
              plus. */}
          <div className="mb-6">
            <AnalyzeErrorsBanner size="large" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
            <AnalysisPanel banners={banners} loading={analyzing} error={analyzeError} />

            <div className="flex min-w-0 flex-col">
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
                    {displayedGames.map((game) => (
                      <GameRow key={game.riot_match_id} game={game} thresholds={thresholds} content={content} ddragonVersion={ddragonVersion} />
                    ))}
                    {/* Le filtre a bien ramené des parties, mais toutes sont
                        antérieures au plancher. Le dire, plutôt que de laisser
                        une liste vide sans explication. */}
                    {displayedGames.length === 0 && (
                      <p className="text-center text-slate-400">
                        Aucune partie depuis le {PLANCHER_LISIBLE} pour ce filtre.
                      </p>
                    )}
                  </>
                )}
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
