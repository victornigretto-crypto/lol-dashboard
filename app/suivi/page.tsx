"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  csMetrics,
  csPerMinClass,
  deaths10Class,
  highlightClass,
  targetsOf,
  type Targets,
} from "@/lib/stats";
import {
  FALLBACK_CONTENT,
  getContent,
  roleFromLane,
  tierFromRiotTier,
  type TierContent,
} from "@/lib/content";
import { championIconUrl, useDdragonVersion } from "@/lib/ddragon";
import { rankEmblemUrl, rankLabel } from "@/lib/riot/rank";
import { formatGameDate, parseRiotId } from "@/lib/riot/transform";

// Les champs venant de l'import Riot sont en lecture seule ici : seuls les
// trois listes d'erreurs et le résumé sont saisis par le joueur (Slice 4).
type Game = {
  id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  queue: string | null;
  played_at: string | null;
  cs20: number;
  deaths10: number;
  cs_final: number | null;
  game_duration_seconds: number | null;
  errorLane: string[];
  errorMacro: string[];
  errorFight: string[];
  summary: string;
};

type GameRow = Omit<Game, "errorLane" | "errorMacro" | "errorFight"> & {
  error_lane: string[];
  error_macro: string[];
  error_fight: string[];
};

type Rank = { tier: string; rank: string; leaguePoints: number } | null;

// Les listes d'erreurs sont stockées en base sans case vide ; l'UI ajoute
// toujours un champ vide en fin de liste pour permettre d'en saisir une nouvelle.
const toDisplayList = (values: string[]): string[] => (values.length ? [...values, ""] : [""]);

const toStoredList = (values: string[]): string[] =>
  values.map((v) => v.trim()).filter((v) => v !== "");

const fromRow = (row: GameRow): Game => ({
  ...row,
  errorLane: toDisplayList(row.error_lane),
  errorMacro: toDisplayList(row.error_macro),
  errorFight: toDisplayList(row.error_fight),
});

// Seuls les champs réellement saisis par le joueur repartent en base : tout
// le reste vient de l'import Riot et ne doit jamais être réécrit d'ici.
const toUpdatePayload = (game: Game) => ({
  error_lane: toStoredList(game.errorLane),
  error_macro: toStoredList(game.errorMacro),
  error_fight: toStoredList(game.errorFight),
  summary: game.summary,
});

const SAVE_DELAY_MS = 600;

type ErrorField = "errorLane" | "errorMacro" | "errorFight";

export default function SuiviPage() {
  const router = useRouter();
  const supabase = createClient();
  const ddragonVersion = useDdragonVersion();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [rank, setRank] = useState<Rank>(null);
  const [riotId, setRiotId] = useState<string | null>(null);
  const [primaryRole, setPrimaryRole] = useState<string | null>(null);
  const [content, setContent] = useState<TierContent>(FALLBACK_CONTENT);

  // Changement de compte Riot. `reloadKey` relance l'effet de chargement au
  // lieu de dupliquer sa logique : il garde ainsi son propre garde-fou
  // `active` et l'ordre import -> lecture des games.
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchInput, setSwitchInput] = useState("");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const gamesRef = useRef<Game[]>([]);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUserEmail(user?.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("puuid, riot_id, primary_role, former_rank")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      if (!active) return;
      setPrimaryRole(profile?.primary_role ?? null);
      setRiotId(profile?.riot_id ?? null);

      // Un seul appel sert deux besoins : il importe (et persiste) les games
      // manquantes de CE compte lié, et renvoie le rang league-v4 dont on a
      // besoin pour cibler les couleurs. L'échec n'est pas bloquant : le
      // cockpit s'affiche avec ce qui est déjà en base, sans couleurs.
      let currentRank: Rank = null;
      if (profile?.riot_id) {
        try {
          const res = await fetch("/api/riot/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ riotId: profile.riot_id, filter: "soloq" }),
          });
          if (res.ok) currentRank = ((await res.json()).rank ?? null) as Rank;
        } catch {
          // hors ligne / API Riot indisponible : on continue sur le cache.
        }
      }
      if (!active) return;
      setRank(currentRank);

      // Le palier de référence est le rang SoloQ courant ; à défaut (non
      // classé), l'ancien rang saisi à l'onboarding.
      const role = roleFromLane(profile?.primary_role);
      if (role) {
        setContent(getContent(role, tierFromRiotTier(currentRank?.tier ?? profile?.former_rank)));
      }

      // Le cockpit ne montre QUE les games du compte Riot actuellement lié.
      // `user_id` seul ne suffit pas : relier un autre Riot ID écrase
      // profiles.puuid mais laissait les anciennes games en base, et le cockpit
      // affichait alors un mélange des deux comptes. Le filtre reste la
      // deuxième barrière même si `handleSwitchProfile` efface déjà tout ce qui
      // n'appartient pas au compte courant.
      if (profile?.puuid) {
        const { data, error } = await supabase
          .from("games")
          .select("*")
          .eq("puuid", profile.puuid)
          .order("played_at", { ascending: false, nullsFirst: false });

        if (!active) return;
        if (error) {
          console.error("Impossible de charger les games", error);
        } else {
          setGames((data as GameRow[]).map(fromRow));
        }
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase, reloadKey]);

  const scheduleSave = (id: string) => {
    const timers = saveTimers.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);

    timers.set(
      id,
      setTimeout(async () => {
        timers.delete(id);
        const game = gamesRef.current.find((g) => g.id === id);
        if (!game) return;
        const { error } = await supabase.from("games").update(toUpdatePayload(game)).eq("id", id);
        if (error) console.error("Sauvegarde impossible", error);
      }, SAVE_DELAY_MS)
    );
  };

  const updateSummary = (id: string, value: string) => {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, summary: value } : g)));
    scheduleSave(id);
  };

  const updateErrorList = (id: string, field: ErrorField, value: string, index: number) => {
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const list = [...g[field]];
        list[index] = value;
        if (value !== "" && index === list.length - 1) list.push("");
        return { ...g, [field]: list };
      })
    );
    scheduleSave(id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Changement de compte Riot. La liaison passe par la route de l'onboarding
  // (elle réécrit puuid / riot_id / primary_role) ; `onboarded_at` reste posé,
  // donc pas de re-onboarding.
  //
  // La suppression est VOLONTAIREMENT définitive et couvre tout ce qui
  // n'appartient pas au nouveau compte : l'ancien compte lié, mais aussi les
  // games héritées d'avant la colonne `puuid`, qui ne sont attribuables à aucun
  // compte et sont précisément la cause du mélange. Les notes écrites à la main
  // partent avec — c'est le sens de l'avertissement affiché avant de valider.
  //
  // On lie AVANT de supprimer : si le Riot ID est faux ou l'API Riot injoignable,
  // rien n'est effacé.
  const handleSwitchProfile = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseRiotId(switchInput);
    if (!parsed) {
      setSwitchError("Format attendu : Pseudo#TAG");
      return;
    }
    setSwitching(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/profile/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotId: `${parsed.gameName}#${parsed.tagLine}` }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Liaison impossible.");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      // Garde-fou : sans puuid exploitable, le filtre "tout sauf lui" viserait
      // la totalité des games. On préfère ne rien supprimer.
      if (user && typeof body.puuid === "string" && body.puuid !== "") {
        const { error } = await supabase
          .from("games")
          .delete()
          .eq("user_id", user.id)
          .or(`puuid.is.null,puuid.neq.${body.puuid}`);
        if (error) console.error("Suppression de l'ancien profil impossible", error);
      }

      setGames([]);
      setRank(null);
      setContent(FALLBACK_CONTENT);
      setSwitchOpen(false);
      setSwitchInput("");
      setLoading(true);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "Changement impossible (réseau).");
    } finally {
      setSwitching(false);
    }
  };

  const targets: Targets = targetsOf(content);
  const parsedRiotId = riotId ? parseRiotId(riotId) : null;

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <section className="mx-auto max-w-5xl">
        <header className="mb-6">
          {/* Hors du cadre : ce qui concerne le COMPTE GG DASHBOARD (email,
              déconnexion) et le choix du compte Riot analysé. Le cadre, lui, ne
              parle que du profil LoL affiché — d'où la séparation. */}
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <button
              onClick={() => {
                setSwitchOpen((open) => !open);
                setSwitchError(null);
              }}
              className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Changer de profil
            </button>

            <div className="flex flex-col items-end gap-2 text-sm text-slate-400">
              {userEmail && <span>{userEmail}</span>}
              <button
                onClick={handleLogout}
                className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
              >
                Se déconnecter
              </button>
            </div>
          </div>

          {switchOpen && (
            <form
              onSubmit={handleSwitchProfile}
              className="mb-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4"
            >
              <p className="text-sm font-semibold text-red-200">
                Changer de profil supprime définitivement tes données
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Les games et les notes {riotId ? "de " : "du compte actuel"}
                {riotId && <span className="font-semibold text-slate-100">{riotId}</span>} seront
                effacées. Cette action est irréversible.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={switchInput}
                  onChange={(e) => setSwitchInput(e.target.value)}
                  placeholder="Pseudo#TAG"
                  autoFocus
                  className="min-w-0 flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={switching || !switchInput.trim()}
                  className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {switching ? "..." : "Changer et supprimer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSwitchOpen(false);
                    setSwitchInput("");
                    setSwitchError(null);
                  }}
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </button>
              </div>

              {switchError && <p className="mt-2 text-sm text-red-400">{switchError}</p>}
            </form>
          )}

          <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <Link href="/" className="text-sm uppercase tracking-[0.3em] text-blue-400 hover:text-blue-300">
                  GG Dashboard
                </Link>
                <h1 className="mt-3 text-3xl font-semibold break-words">
                  {parsedRiotId ? (
                    <>
                      {parsedRiotId.gameName}
                      <span className="text-slate-500">#{parsedRiotId.tagLine}</span>
                    </>
                  ) : (
                    "Mon suivi"
                  )}
                </h1>
                <p className="mt-1 text-slate-400">
                  {primaryRole ? `Rôle principal : ${primaryRole}` : "Rôle principal en cours de détection"}
                </p>
              </div>

              {/* Emblème, palier, LP empilés — la disposition du client LoL. */}
              {rank && (
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
              )}
            </div>
          </div>
        </header>

        {!content.inDevelopment && (
          <div className="mb-6 rounded-2xl border border-blue-500/40 bg-blue-500/10 p-5">
            <h2 className="text-lg font-semibold text-blue-200">Sur quoi progresser</h2>
            <p className="mt-2 text-slate-200">{content.focusIntro}</p>
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

        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : games.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-center text-slate-400">
            Aucune game pour l&apos;instant. Joue une SoloQ : elle apparaîtra ici automatiquement.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                targets={targets}
                content={content}
                ddragonVersion={ddragonVersion}
                onErrorChange={updateErrorList}
                onSummaryChange={updateSummary}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function GameCard({
  game,
  targets,
  content,
  ddragonVersion,
  onErrorChange,
  onSummaryChange,
}: {
  game: Game;
  targets: Targets;
  content: TierContent;
  ddragonVersion: string | null;
  onErrorChange: (id: string, field: ErrorField, value: string, index: number) => void;
  onSummaryChange: (id: string, value: string) => void;
}) {
  const win = game.result.toLowerCase().startsWith("v");
  const icon = championIconUrl(ddragonVersion, game.champion);
  const opponentIcon = championIconUrl(ddragonVersion, game.matchup);
  const { perMinPre20, perMinPost20 } = csMetrics(game);

  return (
    <article
      className={
        "rounded-2xl border-l-4 border border-slate-700 bg-slate-900/80 p-4 " +
        (win ? "border-l-green-500" : "border-l-red-500")
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex shrink-0 items-center gap-1.5">
          {icon && (
            <img
              src={icon}
              alt={game.champion}
              className="h-11 w-11 rounded-full bg-slate-800"
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
                className="h-11 w-11 rounded-full bg-slate-800"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {game.champion}
            {game.matchup && <span className="text-slate-500"> vs {game.matchup}</span>}
          </p>
          <p className="text-xs text-slate-400">
            {[formatGameDate(game.played_at), game.lane, game.queue].filter(Boolean).join(" · ")}
          </p>
        </div>

        <p className={"w-20 text-center text-sm font-semibold " + (win ? "text-green-400" : "text-red-400")}>
          {win ? "Victoire" : "Défaite"}
        </p>

        <div
          className={
            "w-20 rounded px-1 py-0.5 text-center text-sm " +
            csPerMinClass(perMinPre20, targets.csPerMin) +
            highlightClass(content, "csPre20")
          }
        >
          <p className="text-[10px] leading-tight opacity-80">CS/min à 20min</p>
          <p>{perMinPre20 ?? "—"}</p>
        </div>
        <div
          className={
            "w-20 rounded px-1 py-0.5 text-center text-sm " +
            csPerMinClass(perMinPost20, targets.csPerMin) +
            highlightClass(content, "csPost20")
          }
        >
          <p className="text-[10px] leading-tight opacity-80">CS/min après 20min</p>
          <p>{perMinPost20 ?? "—"}</p>
        </div>
        <div
          className={
            "w-20 rounded px-1 py-0.5 text-center text-sm " +
            deaths10Class(game.deaths10, targets.deaths10) +
            highlightClass(content, "deaths10")
          }
        >
          <p className="text-[10px] leading-tight opacity-80">Morts/10m</p>
          <p>{game.deaths10}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <ErrorBucket
          label={content.fieldQuestions.lane}
          values={game.errorLane}
          onChange={(value, index) => onErrorChange(game.id, "errorLane", value, index)}
        />
        <ErrorBucket
          label={content.fieldQuestions.macro}
          values={game.errorMacro}
          onChange={(value, index) => onErrorChange(game.id, "errorMacro", value, index)}
        />
        <ErrorBucket
          label={content.fieldQuestions.fight}
          values={game.errorFight}
          onChange={(value, index) => onErrorChange(game.id, "errorFight", value, index)}
        />
      </div>

      <label className="mt-4 block text-xs font-medium text-slate-400">
        Résumé / conclusion
        <textarea
          rows={2}
          className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
          value={game.summary}
          onChange={(e) => onSummaryChange(game.id, e.target.value)}
        />
      </label>
    </article>
  );
}

// Une question du palier (lib/content) + sa liste de réponses libres. La
// dernière case est toujours vide : la remplir en crée une nouvelle.
function ErrorBucket({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (value: string, index: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      {values.map((text, index) => (
        <textarea
          key={index}
          rows={1}
          className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
          value={text}
          onChange={(e) => onChange(e.target.value, index)}
          placeholder={index === 0 ? "Ta réponse..." : "Autre chose ?"}
        />
      ))}
    </div>
  );
}
