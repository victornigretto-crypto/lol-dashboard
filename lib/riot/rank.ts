const NO_DIVISION_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export function tierLabel(tier: string): string {
  const label = tier.charAt(0) + tier.slice(1).toLowerCase();
  return label;
}

export function rankLabel(tier: string, rank: string): string {
  if (NO_DIVISION_TIERS.has(tier)) return tierLabel(tier);
  return `${tierLabel(tier)} ${rank}`;
}

// Emblèmes de rang : assets locaux dans public/ranks (pas d'API officielle
// équivalente à Data Dragon pour ces images).
export function rankEmblemUrl(tier: string): string {
  return `/ranks/${tier.toLowerCase()}.png`;
}
