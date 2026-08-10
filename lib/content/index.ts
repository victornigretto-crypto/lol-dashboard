// Point d'entrée unique du contenu pédagogique : les pages importent
// toujours "@/lib/content", jamais un fichier de palier directement.
import type { Role } from "./types";

export * from "./types";
export { FALLBACK_CONTENT, getContent, tierFromRiotTier } from "./mid";

// `laneLabel` (lib/riot/transform) et `profiles.primary_role` stockent des
// libellés d'affichage ("Mid", "Bot"...). Le contenu, lui, est indexé par
// `Role`. Cette table fait le pont dans les deux sens de casse, et accepte
// aussi les positions brutes de Riot (MIDDLE / BOTTOM / UTILITY) au cas où.
const LANE_TO_ROLE: Record<string, Role> = {
  top: "top",
  jungle: "jungle",
  mid: "mid",
  middle: "mid",
  bot: "adc",
  bottom: "adc",
  adc: "adc",
  support: "support",
  utility: "support",
};

export function roleFromLane(lane: string | null | undefined): Role | null {
  if (!lane) return null;
  return LANE_TO_ROLE[lane.trim().toLowerCase()] ?? null;
}

// Rôle dominant d'un échantillon de games : sert à cibler le contenu d'un
// compte analysé publiquement, qui n'a pas de `primary_role` en base.
// Égalité tranchée par la première occurrence, donc par la game la plus
// récente (l'API Riot renvoie les matchs du plus récent au plus ancien).
export function dominantRole(lanes: (string | null | undefined)[]): Role | null {
  const roles = lanes.map(roleFromLane).filter((r): r is Role => r !== null);
  if (roles.length === 0) return null;

  const counts = new Map<Role, number>();
  for (const role of roles) counts.set(role, (counts.get(role) ?? 0) + 1);

  const best = Math.max(...counts.values());
  return roles.find((role) => counts.get(role) === best) ?? null;
}
