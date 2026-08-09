// Codes couleur partagés entre /suivi (tableau d'analyse) et / (accueil).
// csPerMinClass (relatif à une cible de palier, cf. lib/content) arrive avec
// la Slice 3 du script détaillé — pas encore câblé ici.

export function csClass(cs: number): string {
  if (cs < 100) return "bg-red-400 text-white";
  if (cs < 120) return "bg-red-600 text-white";
  if (cs < 140) return "bg-yellow-500 text-black";
  if (cs < 160) return "bg-green-200 text-slate-900";
  if (cs < 180) return "bg-green-400 text-white";
  return "bg-green-600 text-white";
}

export function deathsClass(d: number): string {
  if (d === 0) return "bg-green-600 text-white";
  if (d > 2) return "bg-red-300 text-black";
  if (d > 1.5) return "bg-red-600 text-white";
  if (d > 1.25) return "bg-red-400 text-white";
  if (d >= 1 && d <= 1.25) return "bg-yellow-500 text-black";
  if (d >= 0.5 && d < 1) return "bg-green-200 text-slate-900";
  if (d > 0 && d < 0.5) return "bg-green-400 text-white";
  return "bg-green-600 text-white";
}
