"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { csClass, deathsClass } from "@/lib/stats";

type Game = {
  id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  cs20: number;
  deaths10: number;
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
  error_lane: string[];
  error_macro: string[];
  error_fight: string[];
  summary: string;
};

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
  errorLane: toDisplayList(row.error_lane),
  errorMacro: toDisplayList(row.error_macro),
  errorFight: toDisplayList(row.error_fight),
  summary: row.summary,
});

const toUpdatePayload = (game: Game) => ({
  lane: game.lane,
  champion: game.champion,
  matchup: game.matchup,
  result: game.result,
  cs20: game.cs20,
  deaths10: game.deaths10,
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

      const { data, error } = await supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: true });

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

  const updateField = (
    id: string,
    field: "lane" | "champion" | "matchup" | "result" | "summary",
    value: string
  ) => {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
    scheduleSave(id);
  };

  const updateNumberField = (id: string, field: "cs20" | "deaths10", value: number) => {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
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

  const addGame = async () => {
    const { data, error } = await supabase
      .from("games")
      .insert({})
      .select()
      .single();
    if (error) {
      console.error("Impossible de créer la game", error);
      return;
    }
    setGames((prev) => [...prev, fromRow(data as GameRow)]);
  };

  const deleteGame = async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      saveTimers.current.delete(id);
    }
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) {
      console.error("Impossible de supprimer la game", error);
      return;
    }
    setGames((prev) => prev.filter((g) => g.id !== id));
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
                ← SoloQ Dashboard
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
                    <th className="w-20 px-2 py-2">Csà20mins</th>
                    <th className="w-20 px-2 py-2 text-center"><div className="whitespace-normal">Mort<br/>10m</div></th>
                    <th className="w-48 px-2 py-2">Erreur Lane</th>
                    <th className="w-48 px-2 py-2">Erreur Macro</th>
                    <th className="w-48 px-2 py-2">Erreur Fight</th>
                    <th className="w-64 px-2 py-2">Résumé</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {games.map((game, gameIndex) => (
                    <tr key={game.id} className="border-b border-slate-800 hover:bg-slate-800/50 align-top">
                      <td className="w-8 px-2 py-3 text-slate-100 text-center">{gameIndex + 1}</td>
                      <td className="w-20 px-2 py-3">
                        <input
                          type="text"
                          value={game.lane}
                          onChange={(e) => updateField(game.id, "lane", e.target.value)}
                          className="w-full rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                        />
                      </td>
                      <td className="w-28 px-2 py-3">
                        <input
                          type="text"
                          value={game.champion}
                          onChange={(e) => updateField(game.id, "champion", e.target.value)}
                          className="w-full rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                        />
                      </td>
                      <td className="w-28 px-2 py-3">
                        <input
                          type="text"
                          value={game.matchup}
                          onChange={(e) => updateField(game.id, "matchup", e.target.value)}
                          className="w-full rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                        />
                      </td>
                      <td className="w-8 px-2 py-3 text-center">
                        <select
                          value={game.result}
                          onChange={(e) => updateField(game.id, "result", e.target.value)}
                          className={getResultClass(game.result) + " rounded px-1 py-0.5 text-xs"}
                        >
                          <option value="Victoire">V</option>
                          <option value="Défaite">D</option>
                        </select>
                      </td>
                      <td className="w-20 px-2 py-3 text-center">
                        <input
                          type="number"
                          value={game.cs20}
                          onChange={(e) => updateNumberField(game.id, "cs20", Number(e.target.value))}
                          className={csClass(game.cs20) + " w-full rounded px-2 py-0.5 text-xs text-center"}
                        />
                      </td>
                      <td className="w-20 px-2 py-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={game.deaths10}
                          onChange={(e) => updateNumberField(game.id, "deaths10", Number(e.target.value))}
                          className={deathsClass(game.deaths10) + " w-full rounded px-2 py-0.5 text-xs text-center"}
                        />
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
                          onChange={(e) => updateField(game.id, "summary", e.target.value)}
                          placeholder="Résumé / conclusion"
                        />
                      </td>
                      <td className="w-8 px-2 py-3 text-center align-top">
                        <button
                          onClick={() => deleteGame(game.id)}
                          className="text-slate-500 hover:text-red-400"
                          title="Supprimer cette game"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {games.length === 0 && (
                <p className="p-4 text-center text-slate-400">
                  Aucune game enregistrée. Ajoute ta première game !
                </p>
              )}
            </div>

            <button
              onClick={addGame}
              className="mt-3 rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
            >
              + Ajouter une game
            </button>
          </>
        )}
      </section>
    </main>
  );
}
