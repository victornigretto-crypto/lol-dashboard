const games = [
  {
    id: 1,
    lane: "Mid",
    champion: "Galio",
    matchup: "Zoe",
    result: "Défaite",
    cs20: 138,
    deaths10: 1,
  },
  {
    id: 2,
    lane: "Top",
    champion: "Garen",
    matchup: "Darius",
    result: "Victoire",
    cs20: 145,
    deaths10: 0.8,
  },
  {
    id: 3,
    lane: "Mid",
    champion: "Malzahar",
    matchup: "Annie",
    result: "Victoire",
    cs20: 151,
    deaths10: 1.2,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dashboard League of Legends</p>
          <h1 className="mt-4 text-4xl font-semibold">Suivi de mes games</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Première version : données codées en dur pour apprendre React et Next.js.
          </p>
        </header>

        <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/80 p-4">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="px-4 py-3">Game</th>
                <th className="px-4 py-3">Lane</th>
                <th className="px-4 py-3">Champion</th>
                <th className="px-4 py-3">Matchup</th>
                <th className="px-4 py-3">V/D</th>
                <th className="px-4 py-3">CS/20mins</th>
                <th className="px-4 py-3">Morts/10mins</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-4 text-slate-100">{game.id}</td>
                  <td className="px-4 py-4 text-slate-100">{game.lane}</td>
                  <td className="px-4 py-4 text-slate-100">{game.champion}</td>
                  <td className="px-4 py-4 text-slate-100">{game.matchup}</td>
                  <td className="px-4 py-4 text-slate-100">{game.result}</td>
                  <td className="px-4 py-4 text-slate-100">{game.cs20}</td>
                  <td className="px-4 py-4 text-slate-100">{game.deaths10}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
