"use client";
import React, { useState } from "react";

type Game = {
  id: number;
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

const initialGames: Game[] = [
  { id: 1, lane: "Mid", champion: "Galio", matchup: "Zoe", result: "Défaite", cs20: 138, deaths10: 1, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 2, lane: "Top", champion: "Garen", matchup: "Darius", result: "Victoire", cs20: 145, deaths10: 0.8, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 3, lane: "Mid", champion: "Malzahar", matchup: "Annie", result: "Victoire", cs20: 151, deaths10: 1.2, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 4, lane: "Mid", champion: "Twisted Fate", matchup: "Zed", result: "Défaite", cs20: 120, deaths10: 2.1, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 5, lane: "Bot", champion: "Ashe", matchup: "Lucian", result: "Victoire", cs20: 160, deaths10: 0.9, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 6, lane: "Jungle", champion: "Lee Sin", matchup: "Elise", result: "Défaite", cs20: 85, deaths10: 1.8, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 7, lane: "Mid", champion: "Ryze", matchup: "Akali", result: "Défaite", cs20: 145, deaths10: 2.3, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 8, lane: "Support", champion: "Leona", matchup: "Nautilus", result: "Victoire", cs20: 30, deaths10: 0.5, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 9, lane: "Mid", champion: "Azir", matchup: "Kassadin", result: "Défaite", cs20: 152, deaths10: 1.0, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
  { id: 10, lane: "Top", champion: "Fiora", matchup: "Ornn", result: "Victoire", cs20: 170, deaths10: 0.7, errorLane: [""], errorMacro: [""], errorFight: [""], summary: "" },
];

export default function Home() {
  const [games, setGames] = useState<Game[]>(() =>
    initialGames.map((g) => ({
      ...g,
      errorLane: Array.isArray(g.errorLane) ? g.errorLane : [String(g.errorLane ?? "")],
      errorMacro: Array.isArray(g.errorMacro) ? g.errorMacro : [String(g.errorMacro ?? "")],
      errorFight: Array.isArray(g.errorFight) ? g.errorFight : [String(g.errorFight ?? "")],
    }))
  );

  const updateGame = (
    id: number,
    field: keyof Game,
    value: string | number,
    index?: number
  ) => {
    setGames((prev) =>
      prev.map((game) => {
        if (game.id !== id) return game;

        if (field === "summary") {
          return { ...game, summary: String(value) };
        }

        // Ensure we operate on an array
        const current = Array.isArray(game[field]) ? (game[field] as string[]) : [String(game[field] ?? "")];
        const list = [...current];

        if (typeof index === "number") {
          list[index] = String(value);
          // if user typed into the last field, add a new empty one
          if (String(value) !== "" && index === list.length - 1) {
            list.push("");
          }
        } else {
          // no index -> write first element
          list[0] = String(value);
          if (String(value) !== "" && list.length === 1) list.push("");
        }

        return { ...game, [field]: list };
      })
    );
  };

  const getResultClass = (result: string) => {
    if (String(result).toLowerCase().startsWith("v")) return "bg-green-600 text-white";
    return "bg-red-600 text-white";
  };

  const getCsClass = (cs: number) => {
    if (cs < 100) return "bg-red-400 text-white";
    if (cs < 120) return "bg-red-600 text-white";
    if (cs < 140) return "bg-yellow-500 text-black";
    if (cs < 160) return "bg-green-200 text-slate-900";
    if (cs < 180) return "bg-green-400 text-white";
    return "bg-green-600 text-white";
  };

  const getDeathsClass = (d: number) => {
    if (d === 0) return "bg-green-600 text-white";
    if (d > 2) return "bg-red-300 text-black";
    if (d > 1.5) return "bg-red-600 text-white";
    if (d > 1.25) return "bg-red-400 text-white";
    if (d >= 1 && d <= 1.25) return "bg-yellow-500 text-black";
    if (d >= 0.5 && d < 1) return "bg-green-200 text-slate-900";
    if (d > 0 && d < 0.5) return "bg-green-400 text-white";
    return "bg-green-600 text-white";
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <section className="mx-auto max-w-full">
        <header className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/90 p-4 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dashboard League of Legends</p>
          <h1 className="mt-4 text-4xl font-semibold">Suivi de mes games</h1>
          <p className="mt-2 max-w-2xl text-slate-400">Première version : données codées en dur pour apprendre React et Next.js.</p>
        </header>

        <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/80 p-2">
          <table className="min-w-full table-fixed border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300 text-xs">
                <th className="w-8 px-2 py-2 text-center">Game</th>
                <th className="w-16 px-2 py-2">Lane</th>
                <th className="w-28 px-2 py-2">Champion</th>
                <th className="w-28 px-2 py-2">Matchup</th>
                <th className="w-8 px-2 py-2 text-center">V/D</th>
                <th className="w-20 px-2 py-2">Csà20mins</th>
                <th className="w-20 px-2 py-2 text-center"><div className="whitespace-normal">Mort<br/>10m</div></th>
                <th className="w-48 px-2 py-2">Erreur Lane</th>
                <th className="w-48 px-2 py-2">Erreur Macro</th>
                <th className="w-48 px-2 py-2">Erreur Fight</th>
                <th className="w-64 px-2 py-2">Résumé</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id} className="border-b border-slate-800 hover:bg-slate-800/50 align-top">
                  <td className="w-8 px-2 py-3 text-slate-100 text-center">{game.id}</td>
                  <td className="w-16 px-2 py-3 text-slate-100">{game.lane}</td>
                  <td className="w-28 px-2 py-3 text-slate-100">{game.champion}</td>
                  <td className="w-28 px-2 py-3 text-slate-100">{game.matchup}</td>
                  <td className="w-8 px-2 py-3 text-center">
                    <span className={getResultClass(game.result) + " inline-block rounded px-1 py-0.5 text-xs"}>
                      {String(game.result).charAt(0).toUpperCase()}
                    </span>
                  </td>
                  <td className="w-20 px-2 py-3 text-center">
                    <span className={getCsClass(game.cs20) + " inline-block rounded px-2 py-0.5 text-xs"}>{game.cs20}</span>
                  </td>
                  <td className="w-20 px-2 py-3 text-center">
                    <span className={getDeathsClass(game.deaths10) + " inline-block rounded px-2 py-0.5 text-xs"}>{game.deaths10}</span>
                  </td>
                  <td className="w-48 px-2 py-3 align-top">
                    {game.errorLane.map((text, index) => (
                      <textarea
                        key={index}
                        rows={1}
                        className="mb-1 h-auto w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                        value={text}
                        onChange={(e) => updateGame(game.id, "errorLane", e.target.value, index)}
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
                        onChange={(e) => updateGame(game.id, "errorMacro", e.target.value, index)}
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
                        onChange={(e) => updateGame(game.id, "errorFight", e.target.value, index)}
                        placeholder={index === 0 ? "Erreur en fight..." : "Nouvelle erreur..."}
                      />
                    ))}
                  </td>
                  <td className="w-64 px-2 py-3 align-top">
                    <textarea
                      rows={3}
                      className="h-full w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                      value={game.summary}
                      onChange={(e) => updateGame(game.id, "summary", e.target.value)}
                      placeholder="Résumé / conclusion"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
