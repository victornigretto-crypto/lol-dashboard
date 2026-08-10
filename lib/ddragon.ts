"use client";
import { useEffect, useState } from "react";

// Icônes de champion : Data Dragon expose un CDN versionné, et la liste des
// versions doit être lue au chargement (la plus récente est en tête).
// Partagé par / (analyse publique) et /suivi (cockpit) : une seule source.
const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";

export function useDdragonVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(VERSIONS_URL)
      .then((r) => r.json())
      .then((versions: string[]) => {
        if (active) setVersion(versions[0] ?? null);
      })
      .catch(() => {
        if (active) setVersion(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return version;
}

// `null` tant que la version n'est pas connue, ou si la game n'a pas de
// champion adverse identifié : l'appelant n'affiche alors pas d'image.
export function championIconUrl(version: string | null, champion: string): string | null {
  if (!version || !champion) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion}.png`;
}
