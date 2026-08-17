"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Bouton de retour utilisateur. Le composant est défini UNE fois — libellé,
// fenêtre, envoi, tout est ici — mais il s'affiche de deux façons :
//
//   "fixed"  : pastille flottante en haut à droite de l'écran. C'est ce que
//              pose le layout racine, donc le comportement par défaut partout.
//   "inline" : bouton ordinaire, posé dans le flux par la page elle-même.
//              /suivi l'utilise pour l'aligner à côté de « Se déconnecter » :
//              son coin haut droit est déjà occupé, et la version flottante y
//              recouvrait tantôt l'email, tantôt la carte de profil.
//
// La page qui pose un exemplaire "inline" doit être listée dans
// PAGES_INLINE ci-dessous, sinon les deux s'afficheraient en même temps.
type Variante = "fixed" | "inline";

// Chemins qui posent eux-mêmes leur bouton : la version flottante s'y efface.
const PAGES_INLINE = ["/suivi"];

type TypeRetour = "bug" | "suggestion";

// idle : formulaire ouvert · sending : envoi en cours · sent : confirmation
// affichée. L'échec ne sort pas de l'état "idle" : le formulaire reste rempli,
// pour que l'utilisateur n'ait pas à tout réécrire.
type Etat = "idle" | "sending" | "sent";

function IconeBug({ className }: { className?: string }) {
  // SVG en ligne : aucune librairie d'icônes pour un seul pictogramme.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 2l1.5 2.5M16 2l-1.5 2.5" />
      <rect x="7" y="6" width="10" height="13" rx="5" />
      <path d="M12 10v6M7 11H3M7 15H4M7 19l-3 2M17 11h4M17 15h3M17 19l3 2" />
    </svg>
  );
}

export function FeedbackButton({ variant = "fixed" }: { variant?: Variante }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState<TypeRetour>("bug");
  const [message, setMessage] = useState("");
  // Le honeypot : jamais rempli par un humain, puisqu'il est hors écran.
  const [website, setWebsite] = useState("");
  const [etat, setEtat] = useState<Etat>("idle");
  const [erreur, setErreur] = useState<string | null>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);

  // Échap ferme, comme n'importe quelle boîte de dialogue. L'écouteur est posé
  // sur le document et non sur le panneau : le focus peut être n'importe où.
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  useEffect(() => {
    if (ouvert && etat === "idle") champRef.current?.focus();
  }, [ouvert, etat]);

  function fermer() {
    setOuvert(false);
    // On rend le formulaire vierge APRÈS la fermeture, et seulement si l'envoi
    // a abouti : refermer par erreur ne doit pas effacer ce qui a été écrit.
    setEtat((precedent) => {
      if (precedent === "sent") {
        setMessage("");
        setType("bug");
      }
      return "idle";
    });
    setErreur(null);
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim() === "" || etat === "sending") return;

    setEtat("sending");
    setErreur(null);
    try {
      const reponse = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, website }),
      });
      const data = await reponse.json().catch(() => null);
      if (!reponse.ok) {
        // Le serveur ne renvoie jamais de détail technique ; s'il n'a rien dit,
        // on met une phrase neutre plutôt que de laisser l'écran muet.
        setErreur(data?.error ?? "L'envoi n'a pas pu aboutir. Réessaie dans un moment.");
        setEtat("idle");
        return;
      }
      setEtat("sent");
    } catch {
      setErreur("L'envoi n'a pas pu aboutir. Vérifie ta connexion et réessaie.");
      setEtat("idle");
    }
  }

  const choix = (valeur: TypeRetour, libelle: string) => (
    <button
      type="button"
      onClick={() => setType(valeur)}
      aria-pressed={type === valeur}
      className={
        "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition " +
        (type === valeur
          ? "border-blue-500 bg-blue-500/15 text-blue-200"
          : "border-slate-700 text-slate-300 hover:border-slate-500")
      }
    >
      {libelle}
    </button>
  );

  // La page pose son propre exemplaire : la pastille flottante s'efface, sinon
  // les deux coexisteraient. Le test vient APRÈS tous les hooks — les appeler
  // conditionnellement casserait React.
  if (variant === "fixed" && PAGES_INLINE.some((p) => chemin?.startsWith(p))) {
    return null;
  }

  // "inline" reprend EXACTEMENT les classes du bouton « Se déconnecter » de
  // /suivi : mêmes bordure, rayon, marges internes. Ils doivent se lire comme
  // une paire, pas comme deux boutons qui se ressemblent à peu près. La taille
  // et la couleur du texte viennent du bloc parent, ce qui les aligne d'office.
  // `whitespace-nowrap` : sans lui le libellé se replie dès que la place manque.
  const classes =
    variant === "inline"
      ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
      : // Flottant : simplement en haut à droite de l'ÉCRAN. z-50 le met
        // au-dessus de tout, y compris un en-tête de tableau collant (z-10).
        "fixed right-4 top-4 z-50 flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-600 bg-slate-900/90 px-3.5 py-2 text-sm font-semibold text-slate-200 shadow-lg backdrop-blur transition hover:border-slate-400 hover:text-white";

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={classes}>
        <IconeBug className={variant === "inline" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        Rapporter un problème
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={fermer}
          role="dialog"
          aria-modal="true"
          aria-label="Rapporter un problème"
        >
          {/* Le clic sur le fond ferme ; celui sur le panneau ne doit pas
              remonter jusqu'à lui, sinon écrire dans le champ refermerait la
              fenêtre. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            {etat === "sent" ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-700 text-2xl text-white">
                  ✓
                </div>
                <h2 className="mt-3 text-lg font-semibold text-slate-100">Message envoyé</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Merci — c&apos;est lu, et ça sert vraiment.
                </p>
                <button
                  type="button"
                  onClick={fermer}
                  className="mt-5 w-full rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={envoyer}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                    <IconeBug className="h-5 w-5 text-slate-400" />
                    Rapporter un problème
                  </h2>
                  <button
                    type="button"
                    onClick={fermer}
                    aria-label="Fermer"
                    className="-mr-1 -mt-1 rounded px-2 text-xl leading-none text-slate-500 hover:text-slate-200"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 flex gap-2">
                  {choix("bug", "Rapporter un bug")}
                  {choix("suggestion", "Suggérer une amélioration")}
                </div>

                <textarea
                  ref={champRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder={
                    type === "bug"
                      ? "Ce que tu faisais, et ce qui s'est passé..."
                      : "Ce que tu aimerais voir changer..."
                  }
                  className="mt-3 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                />

                {/* Honeypot. `aria-hidden` + tabIndex -1 : ni lu par un lecteur
                    d'écran, ni atteignable au clavier. Positionné hors écran
                    plutôt qu'en `display:none`, que certains robots détectent. */}
                <div className="pointer-events-none absolute left-[-9999px] top-0" aria-hidden="true">
                  <label>
                    Ne remplis pas ce champ
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>
                </div>

                {erreur && <p className="mt-2 text-sm text-red-400">{erreur}</p>}

                <button
                  type="submit"
                  disabled={message.trim() === "" || etat === "sending"}
                  className="mt-4 w-full rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {etat === "sending" ? "Envoi..." : "Envoyer"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
