import Link from "next/link";

// Pont entre l'analyse gratuite et la création de compte (Slice 4) : deux
// écrans successifs bâtis sur la même forme — titre centré, liste en
// italique, un seul bouton qui avance. Le dossier `_components` est privé
// (préfixe `_`), donc jamais routé.
export function MotivationScreen({
  title,
  points,
  cta,
  href,
  back,
}: {
  title: string;
  points: string[];
  cta: string;
  href: string;
  back: { label: string; href: string };
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-16 text-center text-slate-100">
      <div className="pointer-events-none absolute top-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative max-w-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-blue-400">GG Dashboard</p>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>

        <ul className="mt-10 flex flex-col gap-5">
          {points.map((point) => (
            <li key={point} className="text-lg italic text-slate-300">
              {point}
            </li>
          ))}
        </ul>

        <Link
          href={href}
          className="mt-12 inline-block rounded-full bg-blue-600 px-10 py-3 font-semibold text-white transition hover:bg-blue-500"
        >
          {cta}
        </Link>

        <p className="mt-6">
          <Link href={back.href} className="text-sm text-slate-500 underline hover:text-slate-300">
            {back.label}
          </Link>
        </p>
      </div>
    </main>
  );
}
