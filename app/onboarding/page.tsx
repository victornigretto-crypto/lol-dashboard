"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseRiotId } from "@/lib/riot/transform";
import { clearPendingRiotId, readPendingRiotId } from "@/lib/pendingRiotId";
import { rankEmblemUrl, rankLabel, tierLabel } from "@/lib/riot/rank";
import {
  FALLBACK_CONTENT,
  getContent,
  MID_PYRAMID,
  RANKED_TIERS,
  roleFromLane,
  TIER_PYRAMID_LEVELS,
  tierFromRiotTier,
  type Tier,
  type TierContent,
} from "@/lib/content";

// Rôles proposés pour le rôle secondaire. Mêmes libellés que `primary_role`
// (issu de laneLabel), pour que roleFromLane sache les relire.
const ROLE_OPTIONS = ["Top", "Jungle", "Mid", "Bot", "Support"];

// Durée au bout de laquelle l'écran de focus s'efface tout seul ; un clic
// fait la même chose immédiatement.
const FOCUS_AUTO_ADVANCE_MS = 6000;

type Rank = { tier: string; rank: string; leaguePoints: number } | null;
type LinkResult = { puuid: string; riotId: string; primaryRole: string | null; rank: Rank };

// L'onboarding se joue en deux temps : d'abord l'identité du joueur (rang,
// rôles, pyramide), puis le focus de son palier qui s'efface pour laisser
// place au cockpit.
type Phase = "identity" | "focus";

async function linkAccount(riotId: string): Promise<LinkResult> {
  const res = await fetch("/api/profile/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ riotId }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Liaison impossible.");
  return body as LinkResult;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [riotIdInput, setRiotIdInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linked, setLinked] = useState<LinkResult | null>(null);

  const [phase, setPhase] = useState<Phase>("identity");
  const [secondaryRole, setSecondaryRole] = useState("");
  const [formerRank, setFormerRank] = useState("");
  const [saving, setSaving] = useState(false);

  // L'animation d'entrée ne joue qu'au tout premier affichage (mount) ; comme
  // `onboarded_at` empêche de revenir ici, elle n'est de toute façon vue
  // qu'une fois.
  const [revealed, setRevealed] = useState(false);
  const hasAnimated = useRef(false);

  // Porte de la Slice 5 : un profil déjà onboardé n'a plus rien à faire ici.
  // Le compte se crée APRÈS l'analyse gratuite (Slice 4), donc le Riot ID a
  // déjà été saisi : on le lie automatiquement, sans le redemander. Le
  // formulaire manuel ne sert que de repli (analyse sautée, stockage local
  // indisponible, liaison en échec).
  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) {
        setLoadingProfile(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("riot_id, onboarded_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;

      if (profile?.onboarded_at) {
        router.replace("/suivi");
        return;
      }

      const pending = readPendingRiotId();
      const known = profile?.riot_id ?? pending;
      if (known) setRiotIdInput(known);

      if (!profile?.riot_id && pending) {
        try {
          const result = await linkAccount(pending);
          if (!active) return;
          clearPendingRiotId();
          setLinked(result);
        } catch {
          // Le formulaire manuel prend le relais, pré-rempli avec `pending`.
        }
      }
      if (!active) return;
      setLoadingProfile(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase, router]);

  useEffect(() => {
    if (!linked || hasAnimated.current) return;
    hasAnimated.current = true;
    const timer = setTimeout(() => setRevealed(true), 50);
    return () => clearTimeout(timer);
  }, [linked]);

  const handleLink = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseRiotId(riotIdInput);
    if (!parsed) {
      setLinkError("Format attendu : Pseudo#TAG");
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      const result = await linkAccount(`${parsed.gameName}#${parsed.tagLine}`);
      clearPendingRiotId();
      setLinked(result);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Liaison impossible (réseau).");
    } finally {
      setLinking(false);
    }
  };

  // Marque l'onboarding comme joué : c'est ce qui garantit qu'il ne sera plus
  // jamais réaffiché, y compris après reconnexion. Le clic et l'expiration du
  // délai mènent tous deux ici : `finishing` évite le double enregistrement.
  const finishing = useRef(false);
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({
          secondary_role: secondaryRole || null,
          // Renseigné seulement si le joueur n'a pas de rang SoloQ courant :
          // c'est alors ce palier qui sert de référence à tout le contenu.
          former_rank: linked?.rank ? null : formerRank || null,
          onboarded_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }
    router.replace("/suivi");
  }, [supabase, router, secondaryRole, formerRank, linked]);

  if (loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Chargement...</p>
      </main>
    );
  }

  if (!linked) {
    return (
      <main className="flex min-h-screen flex-col items-center bg-slate-950 px-4 py-16 text-slate-100">
        <div className="w-full max-w-lg text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-400">Bienvenue sur GG Dashboard</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Lie ton compte Riot</h1>
          <p className="mt-3 text-slate-400">
            Une seule fois : ton cockpit se remplira ensuite automatiquement à chaque game.
          </p>

          <form onSubmit={handleLink} className="mt-8 flex w-full items-center gap-2">
            <input
              type="text"
              value={riotIdInput}
              onChange={(e) => setRiotIdInput(e.target.value)}
              placeholder="Pseudo#TAG"
              autoFocus
              className="min-w-0 flex-1 rounded-full border border-slate-700 bg-slate-900 px-5 py-3 text-slate-100 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={linking || !riotIdInput.trim()}
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {linking ? "..." : "Lier"}
            </button>
          </form>
          {linkError && <p className="mt-4 text-sm text-red-400">{linkError}</p>}
        </div>
      </main>
    );
  }

  // Palier de référence : le rang SoloQ courant, sinon l'ancien rang que le
  // joueur vient de déclarer. `unranked` tant qu'aucun des deux n'est connu.
  const referenceTier: Tier = linked.rank
    ? tierFromRiotTier(linked.rank.tier)
    : tierFromRiotTier(formerRank || null);

  const role = roleFromLane(linked.primaryRole);
  const content = role ? getContent(role, referenceTier) : FALLBACK_CONTENT;

  // Non classé et sans ancien rang déclaré : rien de personnalisé à montrer.
  const needsFormerRank = !linked.rank;
  const hasReference = referenceTier !== "unranked";

  if (phase === "focus") {
    return <FocusScreen content={content} onDone={finish} saving={saving} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-950 px-4 py-16 text-slate-100">
      <div
        className={
          "w-full max-w-xl text-center transition-all duration-700 " +
          (revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")
        }
      >
        <p className="text-sm uppercase tracking-[0.3em] text-blue-400">Bienvenue sur GG Dashboard</p>

        <p className="mt-10 text-slate-400">Tu es :</p>
        {linked.rank ? (
          <div className="mt-2 flex flex-col items-center">
            <img
              src={rankEmblemUrl(linked.rank.tier)}
              alt={linked.rank.tier}
              className="h-24 w-24 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <p className="mt-1 text-3xl font-bold">{rankLabel(linked.rank.tier, linked.rank.rank)}</p>
            <p className="text-slate-400">{linked.rank.leaguePoints} LP</p>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-2xl font-bold">Non classé en SoloQ</p>
            <label className="mt-4 block text-left text-sm text-slate-400">
              Ton dernier rang connu (saison précédente, ou une estimation) :
              <select
                value={formerRank}
                onChange={(e) => setFormerRank(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="">Aucun</option>
                {RANKED_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {tierLabel(t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <p className="mt-10 text-slate-400">Ton rôle principal est :</p>
        <p className="mt-1 text-2xl font-bold">{linked.primaryRole ?? "Non déterminé"}</p>

        <label className="mx-auto mt-8 block max-w-xs text-left text-sm text-slate-400">
          Tu as un rôle secondaire ?
          <select
            value={secondaryRole}
            onChange={(e) => setSecondaryRole(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          >
            <option value="">Aucun</option>
            {ROLE_OPTIONS.filter((r) => r !== linked.primaryRole).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {needsFormerRank && !hasReference ? (
          <p className="mt-10 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
            Sans rang de référence, le contenu personnalisé par palier est en cours de développement pour
            toi — ton cockpit fonctionne quand même normalement.
          </p>
        ) : (
          <Pyramid tier={referenceTier} revealed={revealed} />
        )}

        <button
          onClick={() => setPhase("focus")}
          className="mt-10 rounded-full bg-blue-600 px-8 py-3 font-semibold hover:bg-blue-500"
        >
          Continuer
        </button>
      </div>
    </main>
  );
}

// Dernier écran : les focusPoints du palier. Il s'efface au clic, ou tout
// seul au bout de quelques secondes, pour enchaîner sur le cockpit.
function FocusScreen({
  content,
  onDone,
  saving,
}: {
  content: TierContent;
  onDone: () => void;
  saving: boolean;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, FOCUS_AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <main
      onClick={onDone}
      className="flex min-h-screen cursor-pointer flex-col items-center justify-center bg-slate-950 px-4 py-16 text-center text-slate-100"
    >
      <div className="max-w-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-blue-400">Ton plan de progression</p>

        {content.inDevelopment ? (
          // Palier sans référence, rôle hors mid, ou palier pas encore écrit :
          // on le dit franchement plutôt que d'afficher un écran vide.
          <>
            <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">En cours de développement</h1>
            <p className="mt-6 text-lg italic text-slate-300">
              Le contenu personnalisé de ton palier n&apos;est pas encore écrit — ton cockpit fonctionne
              normalement en attendant.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{content.focusIntro}</h1>
            <ul className="mt-10 flex flex-col gap-5">
              {content.focusPoints.map((point) => (
                <li key={point} className="text-lg italic text-slate-300">
                  {point}
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-12 text-sm text-slate-500">
          {saving ? "Ouverture de ton cockpit..." : "Clique pour continuer"}
        </p>
      </div>
    </main>
  );
}

// Pyramide des fondamentaux, affichée bas -> haut. La bande du palier du
// joueur est mise en avant ; celles des paliers voisins (n-1 / n+1) le sont
// plus discrètement, pour montrer d'où il vient et où il va.
function Pyramid({ tier, revealed }: { tier: Tier; revealed: boolean }) {
  const tierIndex = RANKED_TIERS.indexOf(tier);
  const current = new Set(TIER_PYRAMID_LEVELS[tier]);
  const neighbours = new Set(
    [tierIndex - 1, tierIndex + 1]
      .filter((i) => i >= 0 && i < RANKED_TIERS.length)
      .flatMap((i) => TIER_PYRAMID_LEVELS[RANKED_TIERS[i]])
  );

  return (
    <div className="mt-10">
      <p className="text-sm text-slate-400">Les fondamentaux, de la base au sommet :</p>
      <div className="mt-4 flex flex-col-reverse items-stretch gap-1">
        {MID_PYRAMID.map((level, index) => {
          const isCurrent = current.has(index);
          const isNeighbour = !isCurrent && neighbours.has(index);

          return (
            <div
              key={level}
              className={
                "rounded-lg px-3 py-2 text-sm transition-all duration-500 " +
                (isCurrent
                  ? "border border-blue-400 bg-blue-500/20 font-semibold text-blue-100"
                  : isNeighbour
                    ? "border border-slate-600 bg-slate-900/80 text-slate-300"
                    : "text-slate-600") +
                " " +
                (revealed ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0")
              }
              style={{ transitionDelay: revealed ? `${(MID_PYRAMID.length - index) * 40}ms` : "0ms" }}
            >
              {level}
            </div>
          );
        })}
      </div>
    </div>
  );
}
