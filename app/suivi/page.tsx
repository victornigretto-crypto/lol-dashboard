"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { csMetrics, csPerMinClass, deaths10Class } from "@/lib/stats";
import { getContent, roleFromLane, tierFromRiotTier } from "@/lib/content";

type Game = {
  id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  cs20: number;
  deaths10: number;
  cs_final: number | null;
  game_duration_seconds: number | null;
  errorLane: string[];
  errorMacro: string[];
  errorFight: string[];
  summary: string;
};

type GameRow = {
  id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  cs20: number;
  deaths10: number;
  cs_final: number | null;
  game_duration_seconds: number | null;
  error_lane: string[];
  error_macro: string[];
  error_fight: string[];
  summary: string;
};

type Rank = { tier: string; rank: string; leaguePoints: number } | null;

// Cibles de performance du palier du joueur (lib/content). `null` = rôle ou
// palier sans contenu défini : aucune couleur, plutôt qu'une fausse couleur.
type Targets = { csPerMin: number | null; deaths10: number | null };

const NO_TARGETS: Targets = { csPerMin: null, deaths10: null };

// Les listes d'erreurs sont stockées en base sans case vide ; l'UI ajoute
// toujours un champ vide en fin de liste pour permettre d'en saisir une nouvelle.
const toDisplayList = (values: string[]): string[] =>
  values.length ? [...values, ""] : [""];

const toStoredList = (values: string[]): string[] =>
  values.map((v) => v.trim()).filter((v) => v !== "");

const fromRow = (row: GameRow): Game => ({
  id: row.id,
  lane: row.lane,
  champion: row.champion,
  matchup: row.matchup,
  result: row.result,
  cs20: row.cs20,
  deaths10: row.deaths10,
  cs_final: row.cs_final,
  game_duration_seconds: row.game_duration_seconds,
  errorLane: toDisplayList(row.error_lane),
  errorMacro: toDisplayList(row.error_macro),
  errorFight: toDisplayList(row.error_fight),
  summary: row.summary,
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

export default function SuiviPage() {
  const router = useRouter();
  const supabase = createClient();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [targets, setTargets] = useState<Targets>(NO_TARGETS);

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
        .select("riot_id, primary_role, former_rank")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      if (!active) return;

      // Un seul appel sert deux besoins : il importe (et persiste) les games
      // manquantes de CE compte lié, et renvoie le rang league-v4 dont on a
      // besoin pour cibler les couleurs. L'échec n'est pas bloquant : le
      // cockpit s'affiche avec ce qui est déjà en base, sans couleurs.
      let rank: Rank = null;
      if (profile?.riot_id) {
        try {
          const res = await fetch("/api/riot/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ riotId: profile.riot_id, filter: "soloq" }),
          });
          if (res.ok) rank = ((await res.json()).rank ?? null) as Rank;
        } catch {
          // hors ligne / API Riot indisponible : on continue sur le cache.
        }
      }
      if (!active) return;

      // Le palier de référence est le rang SoloQ courant ; à défaut (non
      // classé), l'ancien rang saisi à l'onboarding.
      const role = roleFromLane(profile?.primary_role);
      if (role) {
        const content = getContent(role, tierFromRiotTier(rank?.tier ?? profile?.former_rank));
        setTargets({ csPerMin: content.csPerMinTarget, deaths10: content.deaths10Target });
      }

      const { data, error } = await supabase
        .from("games")
        .select("*")
        .order("played_at", { ascending: false, nullsFirst: false });

      if (!active) return;
      if (error) {
        console.error("Impossible de charger les games", error);
      } else {
        setGames((data as GameRow[]).map(fromRow));
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

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
        const { error } = await supabase
          .from("games")
          .update(toUpdatePayload(game))
          .eq("id", id);
        if (error) console.error("Sauvegarde impossible", error);
      }, SAVE_DELAY_MS)
    );
  };

  // Le résumé est le seul champ texte libre hors listes d'erreurs ; lane,
  // champion, matchup, résultat et stats viennent de l'import et ne sont plus
  // éditables (Slice 4).
  const updateSummary = (id: string, value: string) => {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, summary: value } : g)));
    scheduleSave(id);
  };

  const updateErrorList = (
    id: string,
    field: "errorLane" | "errorMacro" | "errorFight",
    value: string,
    index: number
  ) => {
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

  const getResultClass = (result: string) => {
    if (String(result).toLowerCase().startsWith("v")) return "bg-green-600 text-white";
    return "bg-red-600 text-white";
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <section className="mx-auto max-w-full">
        <header className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/90 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/" className="text-sm uppercase tracking-[0.3em] text-slate-400 hover:text-slate-200">
                ← GG Dashboard
              </Link>
              <h1 className="mt-4 text-4xl font-semibold">Suivi de mes games</h1>
              <p className="mt-2 max-w-2xl text-slate-400">
                Données stockées sur Supabase, propres à ton compte.
              </p>
            </div>
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
        </header>

        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/80 p-2">
              <table className="min-w-full table-fixed border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-300 text-xs">
                    <th className="w-8 px-2 py-2 text-center">Game</th>
                    <th className="w-20 px-2 py-2">Lane</th>
                    <th className="w-28 px-2 py-2">Champion</th>
                    <th className="w-28 px-2 py-2">Matchup</th>
                    <th className="w-8 px-2 py-2 text-center">V/D</th>
                    <th className="w-20 px-2 py-2 text-center"><div className="whitespace-normal">CS/min<br/>à 20min</div></th>
                    <th className="w-20 px-2 py-2 text-center"><div className="whitespace-normal">CS/min<br/>après 20min</div></th>
                    <th className="w-20 px-2 py-2 text-center"><div className="whitespace-normal">Mort<br/>10m</div></th>
                    <th className="w-48 px-2 py-2">Erreur Lane</th>
                    <th className="w-48 px-2 py-2">Erreur Macro</th>
                    <th className="w-48 px-2 py-2">Erreur Fight</th>
                    <th className="w-64 px-2 py-2">Résumé</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game, gameIndex) => {
                    const { perMinPre20, perMinPost20 } = csMetrics(game);
                    return (
                    <tr key={game.id} className="border-b border-slate-800 hover:bg-slate-800/50 align-top">
                      <td className="w-8 px-2 py-3 text-slate-100 text-center">{gameIndex + 1}</td>
                      <td className="w-20 px-2 py-3 text-slate-200">{game.lane}</td>
                      <td className="w-28 px-2 py-3 text-slate-200">{game.champion}</td>
                      <td className="w-28 px-2 py-3 text-slate-200">{game.matchup}</td>
                      <td className="w-8 px-2 py-3 text-center">
                        <span className={getResultClass(game.result) + " rounded px-1.5 py-0.5 text-xs"}>
                          {game.result.toLowerCase().startsWith("v") ? "V" : "D"}
                        </span>
                      </td>
                      <td className="w-20 px-2 py-3 text-center">
                        <span
                          className={
                            csPerMinClass(perMinPre20, targets.csPerMin) + " block rounded px-2 py-0.5 text-xs"
                          }
                        >
                          {perMinPre20 ?? "—"}
                        </span>
                      </td>
                      <td className="w-20 px-2 py-3 text-center">
                        <span
                          className={
                            csPerMinClass(perMinPost20, targets.csPerMin) + " block rounded px-2 py-0.5 text-xs"
                          }
                        >
                          {perMinPost20 ?? "—"}
                        </span>
                      </td>
                      <td className="w-20 px-2 py-3 text-center">
                        <span
                          className={
                            deaths10Class(game.deaths10, targets.deaths10) + " block rounded px-2 py-0.5 text-xs"
                          }
                        >
                          {game.deaths10}
                        </span>
                      </td>
                      <td className="w-48 px-2 py-3 align-top">
                        {game.errorLane.map((text, index) => (
                          <textarea
                            key={index}
                            rows={1}
                            className="mb-1 h-auto w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                            value={text}
                            onChange={(e) => updateErrorList(game.id, "errorLane", e.target.value, index)}
                            placeholder={index === 0 ? "Erreur en lane..." : "Nouvelle erreur..."}
                          />
                        ))}
                      </td>
                      <td className="w-48 px-2 py-3 align-top">
                        {game.errorMacro.map((text, index) => (
                          <textarea
                            key={index}
                            rows={1}
                            className="mb-1 h-auto w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                            value={text}
                            onChange={(e) => updateErrorList(game.id, "errorMacro", e.target.value, index)}
                            placeholder={index === 0 ? "Erreur de macro..." : "Nouvelle erreur..."}
                          />
                        ))}
                      </td>
                      <td className="w-48 px-2 py-3 align-top">
                        {game.errorFight.map((text, index) => (
                          <textarea
                            key={index}
                            rows={1}
                            className="mb-1 h-auto w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                            value={text}
                            onChange={(e) => updateErrorList(game.id, "errorFight", e.target.value, index)}
                            placeholder={index === 0 ? "Erreur en fight..." : "Nouvelle erreur..."}
                          />
                        ))}
                      </td>
                      <td className="w-64 px-2 py-3 align-top">
                        <textarea
                          rows={3}
                          className="h-full w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                          value={game.summary}
                          onChange={(e) => updateSummary(game.id, e.target.value)}
                          placeholder="Résumé / conclusion"
                        />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {games.length === 0 && (
                <p className="p-4 text-center text-slate-400">
                  Aucune game pour l&apos;instant. Joue une SoloQ : elle apparaîtra ici automatiquement.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
