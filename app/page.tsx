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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dashboard League of Legends</p>
          <h1 className="mt-4 text-4xl font-semibold">Suivi de mes games</h1>
          <p className="mt-2 max-w-2xl text-slate-400">Première version : données codées en dur pour apprendre React et Next.js.</p>
        </header>

        <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/80 p-4">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300 text-xs">
                <th className="w-10 px-2 py-3 text-center">Game</th>
                <th className="w-20 px-2 py-3">Lane</th>
                <th className="px-3 py-3">Champion</th>
                <th className="px-3 py-3">Matchup</th>
                <th className="w-16 px-2 py-3">V/D</th>
                <th className="w-20 px-2 py-3">Csà20mins</th>
                <th className="w-24 px-2 py-3"><div className="whitespace-normal">Mort par<br/>10mins</div></th>
                <th className="px-3 py-3">Erreur en phase de Lane</th>
                <th className="px-3 py-3">Erreur de macro</th>
                <th className="px-3 py-3">Erreur en fight</th>
                <th className="min-w-[20rem] px-3 py-3">Résumé</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id} className="border-b border-slate-800 hover:bg-slate-800/50 align-top">
                  <td className="w-12 px-4 py-4 text-slate-100 align-top">{game.id}</td>
                  <td className="w-20 px-4 py-4 text-slate-100 align-top">{game.lane}</td>
                  <td className="px-4 py-4 text-slate-100 align-top">{game.champion}</td>
                  <td className="px-4 py-4 text-slate-100 align-top">{game.matchup}</td>
                  <td className="w-20 px-4 py-4 text-slate-100 align-top">{game.result}</td>
                  <td className="w-24 px-4 py-4 text-slate-100 align-top">{game.cs20}</td>
                  <td className="w-28 px-4 py-4 text-slate-100 align-top">{game.deaths10}</td>
                  <td className="min-w-[18rem] px-4 py-4 align-top">
                    {game.errorLane.map((text, index) => (
                      <textarea
                        key={index}
                        rows={index === game.errorLane.length - 1 ? 1 : 1}
                        className="mb-2 w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                        value={text}
                        onChange={(e) => updateGame(game.id, "errorLane", e.target.value, index)}
                        placeholder={index === 0 ? "Erreur en lane..." : "Nouvelle erreur en lane..."}
                      />
                    ))}
                  </td>
                  <td className="min-w-[18rem] px-4 py-4 align-top">
                    {game.errorMacro.map((text, index) => (
                      <textarea
                        key={index}
                        rows={1}
                        className="mb-2 w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                        value={text}
                        onChange={(e) => updateGame(game.id, "errorMacro", e.target.value, index)}
                        placeholder={index === 0 ? "Erreur de macro..." : "Nouvelle erreur de macro..."}
                      />
                    ))}
                  </td>
                  <td className="min-w-[18rem] px-4 py-4 align-top">
                    {game.errorFight.map((text, index) => (
                      <textarea
                        key={index}
                        rows={1}
                        className="mb-2 w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                        value={text}
                        onChange={(e) => updateGame(game.id, "errorFight", e.target.value, index)}
                        placeholder={index === 0 ? "Erreur en fight..." : "Nouvelle erreur en fight..."}
                      />
                    ))}
                  </td>
                  <td className="min-w-[24rem] px-4 py-4 align-top">
                    <textarea
                      rows={3}
                      className="h-full min-h-[5rem] w-full resize-y rounded border border-slate-700 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
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
