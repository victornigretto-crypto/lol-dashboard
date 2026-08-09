// Codes couleur partagés entre /suivi (tableau d'analyse) et / (accueil).

import { getMidTierContent, type CsPerMinThresholds } from "@/lib/content/mid";

// Seuils par défaut quand on n'a pas de contenu par palier pour ce rôle/rang
// (tout sauf Mid Iron→Emerald pour l'instant) : mieux qu'une absence de
// couleur, même si moins précis qu'un seuil calibré par palier.
const DEFAULT_CS_PER_MIN_THRESHOLDS: CsPerMinThresholds = { poor: 5, average: 6.5, good: 8 };

// Renvoie les seuils CS/min calibrés pour ce rôle+palier, ou les seuils par
// défaut si ce couple n'est pas encore couvert par lib/content.
export function csPerMinThresholdsFor(lane: string, tier: string | null): CsPerMinThresholds {
  if (lane === "Mid" && tier) {
    const content = getMidTierContent(tier);
    if (content) return content.csPerMin;
  }
  return DEFAULT_CS_PER_MIN_THRESHOLDS;
}

export function csPerMinClass(csPerMinValue: number, thresholds: CsPerMinThresholds): string {
  if (csPerMinValue < thresholds.poor) return "bg-red-600 text-white";
  if (csPerMinValue < thresholds.average) return "bg-yellow-500 text-black";
  if (csPerMinValue < thresholds.good) return "bg-green-200 text-slate-900";
  return "bg-green-400 text-white";
}

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
