"use client";

// Le Riot ID saisi pour l'analyse gratuite doit survivre à la création de
// compte pour être lié automatiquement ensuite, sans que le joueur le
// retape. localStorage (et pas sessionStorage) parce que le lien de
// confirmation d'email s'ouvre souvent dans un autre onglet.
//
// Les accès sont protégés : localStorage lève en navigation privée stricte
// ou si le stockage est désactivé. Dans ce cas on perd juste le pré-remplissage,
// l'onboarding redemande le Riot ID à la main.
const KEY = "gg:pendingRiotId";

export function rememberRiotId(riotId: string): void {
  try {
    localStorage.setItem(KEY, riotId);
  } catch {
    // stockage indisponible : sans effet, l'onboarding a un formulaire manuel.
  }
}

export function readPendingRiotId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingRiotId(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // idem : rien à nettoyer si le stockage n'est pas accessible.
  }
}
