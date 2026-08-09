"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseRiotId } from "@/lib/riot/transform";
import { rankEmblemUrl, tierLabel } from "@/lib/riot/rank";

// Paliers affichés dans la pyramide, du plus bas au plus haut. Diamant+ n'a
// pas encore de contenu pédagogique (Slice 2), mais reste affichable dans la
// pyramide : "en développement" ne s'applique qu'au contenu, pas au rang lui-même.
const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];

type Rank = { tier: string; rank: string; leaguePoints: number } | null;
type LinkResult = { puuid: string; riotId: string; primaryRole: string | null; rank: Rank };

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
  const [formerRank, setFormerRank] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // L'animation d'entrée ne joue qu'au tout premier affichage de la pyramide
  // (mount). "Passer" la déclenche instantanément sans attendre les étapes.
  const [revealed, setRevealed] = useState(false);
  const hasAnimated = useRef(false);

  // Pré-remplit le Riot ID si un compte est déjà lié (ex : onboarding
  // interrompu avant la fin) pour éviter de le retaper.
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
        .select("riot_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (profile?.riot_id) setRiotIdInput(profile.riot_id);
      setLoadingProfile(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!linked || hasAnimated.current) return;
    hasAnimated.current = true;
    const timer = setTimeout(() => setRevealed(true), 50);
    return () => clearTimeout(timer);
  }, [linked]);

  const handleLink = async (e: React.FormEvent) => {
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
      setLinked(result);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Liaison impossible (réseau).");
    } finally {
      setLinking(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({
          former_rank: linked?.rank ? null : formerRank || null,
          onboarded_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }
    router.replace("/suivi");
  };

  if (loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-950 px-4 py-16 text-slate-100">
      {linked && (
        <button
          onClick={finish}
          disabled={saving}
          className="fixed right-4 top-4 text-sm text-slate-500 underline hover:text-slate-300 disabled:opacity-50"
        >
          Passer
        </button>
      )}

      <div className="w-full max-w-lg text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-blue-400">Bienvenue sur GG Dashboard</p>

        {!linked ? (
          <>
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
          </>
        ) : (
          <div
            className={
              "transition-all duration-700 " + (revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")
            }
          >
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              {linked.riotId} · {linked.primaryRole ?? "Rôle en développement"}
            </h1>

            {linked.rank ? (
              <>
                <p className="mt-3 text-slate-400">Ton palier actuel :</p>
                <RankPyramid tier={linked.rank.tier} revealed={revealed} />
                <p className="mt-2 text-slate-300">
                  {tierLabel(linked.rank.tier)} {linked.rank.rank} · {linked.rank.leaguePoints} LP
                </p>
              </>
            ) : (
              <div className="mt-8">
                <p className="text-slate-300">Tu n&apos;es pas classé en SoloQ pour l&apos;instant.</p>
                <label className="mt-4 block text-left text-sm text-slate-400">
                  Ton dernier rang connu (saison précédente, ou une estimation) :
                  <select
                    value={formerRank}
                    onChange={(e) => setFormerRank(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  >
                    <option value="">Aucun</option>
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {tierLabel(t)}
                      </option>
                    ))}
                  </select>
                </label>
                {formerRank ? (
                  <RankPyramid tier={formerRank} revealed={revealed} />
                ) : (
                  <p className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
                    Sans rang de référence, le contenu personnalisé par palier reste en développement pour toi —
                    ton cockpit fonctionne quand même normalement.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={finish}
              disabled={saving}
              className="mt-10 rounded-full bg-blue-600 px-8 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "..." : "Direction mon cockpit"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function RankPyramid({ tier, revealed }: { tier: string; revealed: boolean }) {
  const currentIndex = TIERS.indexOf(tier.toUpperCase());

  return (
    <div className="mt-6 flex flex-col-reverse items-center gap-1">
      {TIERS.map((t, index) => {
        const isCurrent = index === currentIndex;
        const isNeighbor = currentIndex >= 0 && Math.abs(index - currentIndex) === 1;
        const isHighlighted = isCurrent || isNeighbor;

        return (
          <div
            key={t}
            className={
              "flex items-center gap-3 rounded-lg px-3 py-1.5 transition-all duration-500 " +
              (isHighlighted ? "bg-slate-900/80 border border-blue-500/40" : "opacity-40") +
              " " +
              (revealed ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0")
            }
            style={{ transitionDelay: revealed ? `${(TIERS.length - index) * 40}ms` : "0ms" }}
          >
            <img
              src={rankEmblemUrl(t)}
              alt={t}
              className={isCurrent ? "h-10 w-10 object-contain" : "h-6 w-6 object-contain"}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className={isCurrent ? "font-bold text-blue-300" : "text-sm text-slate-400"}>
              {tierLabel(t)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
