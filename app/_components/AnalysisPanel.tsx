"use client";
import { useState } from "react";
import { SEVERITY_CLASS, type Banner } from "@/lib/banners";
import { LoadingDots } from "./LoadingDots";

// Le panneau d'analyse affiché à gauche du tableau des games, identique sur /
// (analyse gratuite) et /suivi (cockpit). Les bandeaux arrivent après le reste
// de la page : tant qu'ils se calculent, le panneau montre les points de
// chargement plutôt que "Rien à signaler", qui serait un faux négatif.
//
// L'état déplié vit ici et pas dans les pages : c'est un détail d'affichage,
// aucune des deux pages n'a besoin de le connaître.
export function AnalysisPanel({
  banners,
  loading,
  error,
}: {
  banners: Banner[];
  loading: boolean;
  error?: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
        Analyse
        {loading && <LoadingDots />}
      </h2>

      {banners.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {banners.map((b) => {
            const open = expanded.has(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggle(b.id)}
                className={
                  "w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition " +
                  SEVERITY_CLASS[b.severity]
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{b.text}</span>
                  <span className={"text-xs transition-transform " + (open ? "rotate-180" : "")}>▾</span>
                </div>
                {open && <p className="mt-1 text-xs font-normal opacity-90">{b.detail}</p>}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {!loading && !error && banners.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">Rien à signaler.</p>
      )}
    </aside>
  );
}
