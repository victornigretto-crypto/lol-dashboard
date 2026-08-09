import Link from "next/link";

// Page de motivation 1/2 (Slice 4) : pont entre l'analyse gratuite et
// l'inscription. Explique CE QUE le compte apporte, avant de demander quoi
// que ce soit — la création de compte n'arrive qu'après (page suivante).
export default function DecouvrirPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-16 text-center text-slate-100">
      <div className="max-w-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-blue-400">GG Dashboard</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Ton analyse ne s&apos;arrête pas là</h1>
        <p className="mt-6 text-lg text-slate-300">
          Ce que tu viens de voir, c&apos;est un instantané. Avec un compte gratuit, tu gardes l&apos;historique
          de tes games, tu suis ton évolution palier par palier, et tu notes ce que tu dois travailler après
          chaque partie — sans jamais retaper ton pseudo.
        </p>
        <ul className="mt-8 flex flex-col gap-3 text-left text-slate-300">
          <li className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <span className="text-blue-400">✓</span>
            <span>Un cockpit personnel qui garde toutes tes games, importées automatiquement.</span>
          </li>
          <li className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <span className="text-blue-400">✓</span>
            <span>Des seuils de performance calibrés sur ton propre palier, pas une moyenne générale.</span>
          </li>
          <li className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <span className="text-blue-400">✓</span>
            <span>Un espace pour noter tes erreurs de lane, de macro et de fight, game après game.</span>
          </li>
        </ul>

        <Link
          href="/rejoindre"
          className="mt-10 inline-block rounded-full bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-500"
        >
          Continuer
        </Link>
        <p className="mt-4">
          <Link href="/" className="text-sm text-slate-500 underline hover:text-slate-300">
            Retour à l&apos;analyse
          </Link>
        </p>
      </div>
    </main>
  );
}
