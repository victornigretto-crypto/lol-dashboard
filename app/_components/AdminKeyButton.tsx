"use client";
import { useEffect, useState } from "react";
import { estAdmin } from "@/lib/admin";

// Écran d'administration de la clé Riot, réservé au compte administrateur.
//
// Le composant ne rend RIEN pour les autres — mais ce masquage n'est qu'un
// confort d'interface : le vrai contrôle est dans app/api/admin/riot-key,
// qui refuse en 403 sur l'email de la session. Il ne faut jamais raisonner
// « le bouton est caché donc c'est protégé ».
//
// La clé en clair ne descend jamais jusqu'ici : l'API n'en renvoie qu'un aperçu
// masqué. On peut donc la remplacer, jamais la relire.
//
// Pourquoi cet écran existe : la dev key Riot EXPIRE TOUTES LES 24 H. Jusqu'ici
// la remplacer voulait dire éditer .env.local sur la machine qui sert l'app.

type Source = "base" | "environnement" | "absente";
type Etat = {
  source: Source;
  apercu: string | null;
  modifieLe: string | null;
  stockagePret: boolean;
};

const LIBELLE_SOURCE: Record<Source, string> = {
  base: "enregistrée dans l'application",
  environnement: "lue dans .env.local",
  absente: "aucune clé configurée",
};

export function AdminKeyButton({ email }: { email: string | null }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [valeur, setValeur] = useState("");
  const [enregistre, setEnregistre] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const autorise = estAdmin(email);

  // L'état n'est demandé qu'à l'ouverture : inutile d'interroger le serveur à
  // chaque affichage de /suivi pour un panneau qui ne sera pas ouvert.
  useEffect(() => {
    if (!ouvert || !autorise) return;
    let annule = false;
    setErreur(null);
    fetch("/api/admin/riot-key")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Etat) => {
        if (!annule) setEtat(data);
      })
      .catch(() => {
        if (!annule) setErreur("Impossible de lire l'état de la clé.");
      });
    return () => {
      annule = true;
    };
  }, [ouvert, autorise]);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  function fermer() {
    setOuvert(false);
    setValeur("");
    setEnregistre(false);
    setErreur(null);
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (valeur.trim() === "" || occupe) return;

    setOccupe(true);
    setErreur(null);
    setEnregistre(false);
    try {
      const reponse = await fetch("/api/admin/riot-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: valeur }),
      });
      const data = await reponse.json().catch(() => null);
      if (!reponse.ok) {
        setErreur(data?.error ?? "Enregistrement impossible.");
      } else {
        // Le champ est vidé aussitôt : laisser un secret en clair dans un input
        // le rend visible à quiconque passe derrière l'écran.
        setEtat(data as Etat);
        setValeur("");
        setEnregistre(true);
      }
    } catch {
      setErreur("Enregistrement impossible. Vérifie ta connexion.");
    } finally {
      setOccupe(false);
    }
  }

  if (!autorise) return null;

  return (
    <>
      {/* Mêmes classes que « Se déconnecter » et « Rapporter un problème » :
          les trois forment une rangée cohérente en haut à droite de /suivi. */}
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path d="M14 7a4 4 0 1 0-3.6 4L13 13.4V16h2.5v2.5H18l3-3-7-7z" />
        </svg>
        Clé Riot
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={fermer}
          role="dialog"
          aria-modal="true"
          aria-label="Clé Riot"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">Clé API Riot</h2>
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="-mr-1 -mt-1 rounded px-2 text-xl leading-none text-slate-500 hover:text-slate-200"
              >
                ×
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm">
              {etat === null ? (
                <p className="text-slate-500">Lecture...</p>
              ) : (
                <>
                  <p className="text-slate-300">
                    Clé actuelle :{" "}
                    <span className="font-mono text-slate-100">{etat.apercu ?? "—"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {LIBELLE_SOURCE[etat.source]}
                    {etat.modifieLe &&
                      ` · modifiée le ${new Date(etat.modifieLe).toLocaleDateString("fr-FR")}`}
                  </p>
                </>
              )}
            </div>

            {/* Annoncé AVANT la saisie : découvrir au moment d'enregistrer que
                le stockage n'existe pas fait perdre la clé qu'on vient de
                coller, et n'indique pas quoi faire. */}
            {etat !== null && !etat.stockagePret && (
              <div className="mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2.5 text-sm">
                <p className="font-semibold text-yellow-200">Stockage pas encore en place</p>
                <p className="mt-1 text-slate-300">
                  La table <code className="font-mono">app_settings</code> n&apos;existe pas dans
                  cette base : l&apos;enregistrement échouera. Lance{" "}
                  <code className="font-mono">supabase/migrations/20260817_app_settings.sql</code>{" "}
                  dans Supabase → SQL Editor, puis rouvre cette fenêtre.
                </p>
              </div>
            )}

            <form onSubmit={enregistrer}>
              <label htmlFor="cle-riot" className="mt-4 block text-sm text-slate-300">
                Nouvelle clé
              </label>
              <input
                id="cle-riot"
                type="password"
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                placeholder="RGAPI-..."
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Elle remplace celle de <code className="font-mono">.env.local</code> dès
                l&apos;enregistrement. Une clé posée ici ne peut plus être relue, seulement
                remplacée.
              </p>

              {erreur && <p className="mt-2 text-sm text-red-400">{erreur}</p>}
              {enregistre && (
                <p className="mt-2 text-sm text-green-400">Clé enregistrée.</p>
              )}

              <button
                type="submit"
                disabled={valeur.trim() === "" || occupe}
                className="mt-4 w-full rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {occupe ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
