import Link from "next/link";

// Page de motivation 2/2 (Slice 4) : le "comment ça marche" concret, avant
// de pousser vers l'inscription elle-même (compte créé APRÈS la valeur,
// jamais avant).
export default function RejoindrePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-16 text-center text-slate-100">
      <div className="max-w-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-blue-400">GG Dashboard</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Comment ça marche</h1>
        <p className="mt-6 text-lg text-slate-300">
          Trois étapes, deux minutes, aucune carte bancaire.
        </p>

        <ol className="mt-8 flex flex-col gap-3 text-left text-slate-300">
          <li className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <span className="font-bold text-blue-400">1</span>
            <span>Tu crées ton compte avec ton email.</span>
          </li>
          <li className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <span className="font-bold text-blue-400">2</span>
            <span>Tu lies ton compte Riot une seule fois — plus besoin de le retaper ensuite.</span>
          </li>
          <li className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <span className="font-bold text-blue-400">3</span>
            <span>Ton cockpit se remplit automatiquement à chaque game, prêt à être annoté.</span>
          </li>
        </ol>

        <Link
          href="/login?mode=signup"
          className="mt-10 inline-block rounded-full bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-500"
        >
          Créer mon compte
        </Link>
        <p className="mt-4">
          <Link href="/decouvrir" className="text-sm text-slate-500 underline hover:text-slate-300">
            Retour
          </Link>
        </p>
      </div>
    </main>
  );
}
