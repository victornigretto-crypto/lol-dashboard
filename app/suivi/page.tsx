"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { performanceBanners } from "@/lib/banners";
import {
  FALLBACK_CONTENT,
  getContent,
  roleFromLane,
  thresholdsOf,
  tierFromRiotTier,
  type TierContent,
  type TierThresholds,
} from "@/lib/content";
import { championIconUrl, useDdragonVersion } from "@/lib/ddragon";
import { rankEmblemUrl, rankLabel } from "@/lib/riot/rank";
import { formatDuration, formatGameDate, parseRiotId } from "@/lib/riot/transform";
import {
  alertClass,
  csBand,
  csClass,
  csMetrics,
  deathsBand,
  deathsClass,
  explainsDeaths,
  highlightClass,
  highlightFieldClass,
  weightedDeaths10,
  DEATHS_EXPLANATION,
} from "@/lib/stats";
import { AdminKeyButton } from "../_components/AdminKeyButton";
import { AnalysisPanel } from "../_components/AnalysisPanel";
import { FeedbackButton } from "../_components/FeedbackButton";

// Les champs venant de l'import Riot sont en lecture seule ici : seuls les
// trois listes d'erreurs et le résumé sont saisis par le joueur (Slice 4).
type Game = {
  id: string;
  lane: string;
  champion: string;
  matchup: string;
  result: string;
  queue: string | null;
  played_at: string | null;
  cs20: number;
  deaths10: number;
  cs_final: number | null;
  game_duration_seconds: number | null;
  deaths: number | null;
  deaths_last5: number | null;
  errorLane: string[];
  errorMacro: string[];
  errorFight: string[];
  summary: string;
};

type GameRow = Omit<Game, "errorLane" | "errorMacro" | "errorFight"> & {
  error_lane: string[];
  error_macro: string[];
  error_fight: string[];
};

type Rank = { tier: string; rank: string; leaguePoints: number } | null;

// Les listes d'erreurs sont stockées en base sans case vide ; l'UI ajoute
// toujours un champ vide en fin de liste pour permettre d'en saisir une nouvelle.
const toDisplayList = (values: string[]): string[] => (values.length ? [...values, ""] : [""]);

const toStoredList = (values: string[]): string[] =>
  values.map((v) => v.trim()).filter((v) => v !== "");

const fromRow = (row: GameRow): Game => ({
  ...row,
  errorLane: toDisplayList(row.error_lane),
  errorMacro: toDisplayList(row.error_macro),
  errorFight: toDisplayList(row.error_fight),
});

// Seuls les champs réellement saisis par le joueur repartent en base : tout
// le reste vient de l'import Riot et ne doit jamais être réécrit d'ici.
const toUpdatePayload = (game: Game) => ({
  error_lane: toStoredList(game.errorLane),
  error_macro: toStoredList(game.errorMacro),
  error_fight: toStoredList(game.errorFight),
  summary: game.summary,
});

const SAVE_DELAY_MS = 600;

type ErrorField = "errorLane" | "errorMacro" | "errorFight";

export default function SuiviPage() {
  const router = useRouter();
  const supabase = createClient();
  const ddragonVersion = useDdragonVersion();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [rank, setRank] = useState<Rank>(null);
  const [riotId, setRiotId] = useState<string | null>(null);
  const [primaryRole, setPrimaryRole] = useState<string | null>(null);
  const [content, setContent] = useState<TierContent>(FALLBACK_CONTENT);
  // Séparé de `content` : les seuils de couleur ne dépendent que du palier,
  // alors que le contenu pédagogique dépend du couple (rôle, palier).
  const [thresholds, setThresholds] = useState<TierThresholds | null>(null);

  // Changement de compte Riot. `reloadKey` relance l'effet de chargement au
  // lieu de dupliquer sa logique : il garde ainsi son propre garde-fou
  // `active` et l'ordre import -> lecture des games.
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchInput, setSwitchInput] = useState("");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const gamesRef = useRef<Game[]>([]);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUserEmail(user?.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("puuid, riot_id, primary_role, former_rank")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      if (!active) return;
      setPrimaryRole(profile?.primary_role ?? null);
      setRiotId(profile?.riot_id ?? null);

      // Un seul appel sert deux besoins : il importe (et persiste) les games
      // manquantes de CE compte lié, et renvoie le rang league-v4 dont on a
      // besoin pour cibler les couleurs. L'échec n'est pas bloquant : le
      // cockpit s'affiche avec ce qui est déjà en base, sans couleurs.
      let currentRank: Rank = null;
      if (profile?.riot_id) {
        try {
          const res = await fetch("/api/riot/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ riotId: profile.riot_id, filter: "soloq" }),
          });
          if (res.ok) currentRank = ((await res.json()).rank ?? null) as Rank;
        } catch {
          // hors ligne / API Riot indisponible : on continue sur le cache.
        }
      }
      if (!active) return;
      setRank(currentRank);

      // Le palier de référence est le rang SoloQ courant ; à défaut (non
      // classé), l'ancien rang saisi à l'onboarding.
      const tier = tierFromRiotTier(currentRank?.tier ?? profile?.former_rank);
      const role = roleFromLane(profile?.primary_role);
      if (role) setContent(getContent(role, tier));
      // Les couleurs, elles, s'appliquent dès que le palier est connu — même
      // pour un rôle dont le contenu pédagogique n'est pas encore écrit.
      setThresholds(thresholdsOf(tier));

      // Le cockpit ne montre QUE les games du compte Riot actuellement lié.
      // `user_id` seul ne suffit pas : relier un autre Riot ID écrase
      // profiles.puuid mais laissait les anciennes games en base, et le cockpit
      // affichait alors un mélange des deux comptes. Le filtre reste la
      // deuxième barrière même si `handleSwitchProfile` efface déjà tout ce qui
      // n'appartient pas au compte courant.
      if (profile?.puuid) {
        const { data, error } = await supabase
          .from("games")
          .select("*")
          .eq("puuid", profile.puuid)
          .order("played_at", { ascending: false, nullsFirst: false });

        if (!active) return;
        if (error) {
          console.error("Impossible de charger les games", error);
        } else {
          setGames((data as GameRow[]).map(fromRow));
        }
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase, reloadKey]);

  const scheduleSave = (id: string) => {
    const timers = saveTimers.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);

    timers.set(
      id,
      setTimeout(async () => {
        timers.delete(id);
        const game = gamesRef.current.find((g) => g.id === id);
        if (!game) return;
        const { error } = await supabase.from("games").update(toUpdatePayload(game)).eq("id", id);
        if (error) console.error("Sauvegarde impossible", error);
      }, SAVE_DELAY_MS)
    );
  };

  const updateSummary = (id: string, value: string) => {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, summary: value } : g)));
    scheduleSave(id);
  };

  const updateErrorList = (id: string, field: ErrorField, value: string, index: number) => {
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const list = [...g[field]];
        list[index] = value;
        if (value !== "" && index === list.length - 1) list.push("");
        return { ...g, [field]: list };
      })
    );
    scheduleSave(id);
  };

  // Retour à l'accueil et non à /login : se déconnecter n'est pas vouloir se
  // reconnecter. L'accueil est la page publique d'analyse gratuite, donc on
  // sort sur quelque chose d'utilisable plutôt que sur un formulaire.
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Changement de compte Riot. La liaison passe par la route de l'onboarding
  // (elle réécrit puuid / riot_id / primary_role) ; `onboarded_at` reste posé,
  // donc pas de re-onboarding.
  //
  // La suppression est VOLONTAIREMENT définitive et couvre tout ce qui
  // n'appartient pas au nouveau compte : l'ancien compte lié, mais aussi les
  // games héritées d'avant la colonne `puuid`, qui ne sont attribuables à aucun
  // compte et sont précisément la cause du mélange. Les notes écrites à la main
  // partent avec — c'est le sens de l'avertissement affiché avant de valider.
  //
  // On lie AVANT de supprimer : si le Riot ID est faux ou l'API Riot injoignable,
  // rien n'est effacé.
  const handleSwitchProfile = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseRiotId(switchInput);
    if (!parsed) {
      setSwitchError("Format attendu : Pseudo#TAG");
      return;
    }
    setSwitching(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/profile/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotId: `${parsed.gameName}#${parsed.tagLine}` }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Liaison impossible.");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      // Garde-fou : sans puuid exploitable, le filtre "tout sauf lui" viserait
      // la totalité des games. On préfère ne rien supprimer.
      if (user && typeof body.puuid === "string" && body.puuid !== "") {
        const { error } = await supabase
          .from("games")
          .delete()
          .eq("user_id", user.id)
          .or(`puuid.is.null,puuid.neq.${body.puuid}`);
        if (error) console.error("Suppression de l'ancien profil impossible", error);
      }

      setGames([]);
      setRank(null);
      setContent(FALLBACK_CONTENT);
      setThresholds(null);
      setSwitchOpen(false);
      setSwitchInput("");
      setLoading(true);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "Changement impossible (réseau).");
    } finally {
      setSwitching(false);
    }
  };

  const parsedRiotId = riotId ? parseRiotId(riotId) : null;
  // Mêmes bandeaux que sur l'analyse gratuite, calculés sur les games du
  // cockpit. Ils apparaissent donc en même temps que le tableau, une fois
  // l'import terminé.
  const banners = performanceBanners(games, thresholds);

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      {/* Le conteneur passe de max-w-6xl (1152 px) à 1600 px pour donner au
          tableau de l'historique les ~1200 px qu'il lui faut : à 1152 px, une
          fois retirés la colonne d'analyse (300 px) et le gap (24 px), il ne
          restait que 828 px. Décision de Victor du 2026-08-16, contre
          l'alternative d'un panneau repliable — ici l'analyse reste visible. */}
      <section className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          {/* Hors du cadre : ce qui concerne le COMPTE GG DASHBOARD (email,
              déconnexion) et le choix du compte Riot analysé. Le cadre, lui, ne
              parle que du profil LoL affiché — d'où la séparation. */}
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <button
              onClick={() => {
                setSwitchOpen((open) => !open);
                setSwitchError(null);
              }}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-500"
            >
              Synchroniser avec un autre compte
            </button>

            <div className="flex flex-col items-end gap-2 text-sm text-slate-400">
              {userEmail && <span>{userEmail}</span>}
              {/* Le coin haut droit est déjà pris ici : la pastille flottante
                  du layout y recouvrait l'email, puis la carte de profil. Sur
                  cette page seule, le bouton de retour rentre donc dans le
                  flux, à gauche de la déconnexion et dans le même style.
                  `FeedbackButton` s'efface tout seul en flottant sur /suivi
                  (cf. PAGES_INLINE), il n'y en a jamais deux. */}
              <div className="flex items-center gap-2">
                {/* Ne rend rien pour les autres comptes. Le vrai contrôle
                    d'accès est côté serveur, dans la route. */}
                <AdminKeyButton email={userEmail} />
                <FeedbackButton variant="inline" />
                <button
                  onClick={handleLogout}
                  className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          </div>

          {switchOpen && (
            <form
              onSubmit={handleSwitchProfile}
              className="mb-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4"
            >
              <p className="text-sm font-semibold text-red-200">
                Changer de profil supprime définitivement tes données
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Les games et les notes {riotId ? "de " : "du compte actuel"}
                {riotId && <span className="font-semibold text-slate-100">{riotId}</span>} seront
                effacées. Cette action est irréversible.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={switchInput}
                  onChange={(e) => setSwitchInput(e.target.value)}
                  placeholder="Pseudo#TAG"
                  autoFocus
                  className="min-w-0 flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={switching || !switchInput.trim()}
                  className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {switching ? "..." : "Changer et supprimer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSwitchOpen(false);
                    setSwitchInput("");
                    setSwitchError(null);
                  }}
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </button>
              </div>

              {switchError && <p className="mt-2 text-sm text-red-400">{switchError}</p>}
            </form>
          )}

          <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <Link href="/" className="text-sm uppercase tracking-[0.3em] text-blue-400 hover:text-blue-300">
                  GG Dashboard
                </Link>
                <h1 className="mt-3 text-3xl font-semibold break-words">
                  {parsedRiotId ? (
                    <>
                      {parsedRiotId.gameName}
                      <span className="text-slate-500">#{parsedRiotId.tagLine}</span>
                    </>
                  ) : (
                    "Mon suivi"
                  )}
                </h1>
                <p className="mt-1 text-slate-400">
                  {primaryRole ? `Rôle principal : ${primaryRole}` : "Rôle principal en cours de détection"}
                </p>
              </div>

              {/* Emblème, palier, LP empilés — la disposition du client LoL. */}
              {rank && (
                <div className="flex shrink-0 flex-col items-center">
                  <img
                    src={rankEmblemUrl(rank.tier)}
                    alt={rank.tier}
                    className="h-20 w-20 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <p className="mt-1 text-lg font-semibold">{rankLabel(rank.tier, rank.rank)}</p>
                  <p className="text-sm text-slate-400">{rank.leaguePoints} LP</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Le bloc reste visible même sans contenu écrit : on préfère dire
            franchement qu'il n'existe pas encore plutôt que de le faire
            disparaître sans explication. */}
        <div className="mb-6 rounded-2xl border border-blue-500/40 bg-blue-500/10 p-5">
          <h2 className="text-lg font-semibold text-blue-200">Sur quoi progresser</h2>
          {/* Le panneau occupe toute la largeur, mais son TEXTE est borné :
              depuis l'élargissement à 1600 px, des lignes pleine largeur
              deviendraient pénibles à lire. */}
          {content.inDevelopment ? (
            <p className="mt-2 max-w-4xl italic text-slate-400">
              Pas encore développé pour ton palier et ton rôle.
            </p>
          ) : (
            <>
              <p className="mt-2 max-w-4xl text-slate-200">{content.focusIntro}</p>
              <ul className="mt-3 flex max-w-4xl flex-col gap-2">
                {content.focusPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-0.5 shrink-0 text-blue-400">→</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Même disposition que l'analyse gratuite : les bandeaux à gauche,
            l'historique à droite. Sur mobile la colonne de gauche passe
            au-dessus. */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
          <AnalysisPanel banners={banners} loading={loading} />

          {loading ? (
            <p className="text-slate-400">Chargement...</p>
          ) : games.length === 0 ? (
            <p className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-center text-slate-400">
              Aucune game pour l&apos;instant. Joue une SoloQ : elle apparaîtra ici automatiquement.
            </p>
          ) : (
            <GamesTable
              games={games}
              thresholds={thresholds}
              content={content}
              ddragonVersion={ddragonVersion}
              onErrorChange={updateErrorList}
              onSummaryChange={updateSummary}
            />
          )}
        </div>
      </section>
    </main>
  );
}

// --- Le tableau de l'historique -------------------------------------------
//
// Esprit tableur : tout est visible en permanence, rien ne se replie et rien
// ne se tronque. La hauteur d'une ligne suit son contenu le plus long —
// comportement natif de <table>, où toutes les cellules d'une rangée
// s'alignent sur la plus haute. C'est pour ça que c'est un vrai <table> et pas
// une grille de <div>.

const CELL = "border border-slate-700 align-top";
const HEAD = "border border-slate-700 bg-slate-800 px-2 py-2 text-left text-xs font-semibold text-slate-300";

// Zone de saisie qui grandit avec son contenu : `rows={1}` puis la hauteur est
// recalculée sur la valeur. `overflow-hidden` garantit qu'aucune cellule n'a
// son propre ascenseur — sans ça, un texte long serait masqué dans une boîte
// de taille fixe, ce que le tableur doit justement éviter.
function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // useLayoutEffect et non useEffect : la mesure se fait avant la peinture,
  // sinon la ligne sauterait visiblement à chaque frappe.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // `scrollHeight` ne compte PAS les bordures, alors que la hauteur posée
    // les inclut (box-sizing: border-box, défaut Tailwind). Sans ce rattrapage
    // la dernière ligne est rognée de 2 px — invisible puisque `overflow` est
    // masqué, donc du texte disparaîtrait sans que rien ne le signale.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none overflow-hidden rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-100 placeholder:text-slate-600 hover:border-slate-700 focus:border-blue-500 focus:bg-slate-900/60 focus:outline-none"
    />
  );
}

// Une question du palier (lib/content) et SES réponses : une question peut en
// recevoir plusieurs. La dernière case est toujours vide — la remplir en crée
// une nouvelle, exactement comme avant (c'est `updateErrorList` qui ajoute la
// case vide, pas ce composant).
function AnswerList({
  values,
  onChange,
}: {
  values: string[];
  onChange: (value: string, index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {values.map((text, index) => (
        <AutoTextarea
          key={index}
          value={text}
          onChange={(v) => onChange(v, index)}
          placeholder={index === 0 ? "Ta réponse..." : "Autre chose ?"}
        />
      ))}
    </div>
  );
}

function GamesTable({
  games,
  thresholds,
  content,
  ddragonVersion,
  onErrorChange,
  onSummaryChange,
}: {
  games: Game[];
  thresholds: TierThresholds | null;
  content: TierContent;
  ddragonVersion: string | null;
  onErrorChange: (id: string, field: ErrorField, value: string, index: number) => void;
  onSummaryChange: (id: string, value: string) => void;
}) {
  return (
    // `overflow-x-auto` + `min-w` : sous ~1150 px le tableau défile
    // horizontalement au lieu de déformer la page. Ce n'est PAS une adaptation
    // mobile — elle reste à faire.
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-slate-700">
      {/* `table-fixed` et non le `auto` par défaut : en auto, la largeur d'une
          colonne suit son CONTENU, donc les trois colonnes de questions
          finissent inégales dès qu'une réponse est plus longue que les autres —
          et elles bougent à chaque frappe. En fixed, les largeurs posées sur les
          en-têtes font foi, l'espace restant se répartit proportionnellement, et
          les trois colonnes restent identiques quoi qu'on y écrive.
          Contrepartie assumée : un en-tête long passe à la ligne au lieu
          d'élargir sa colonne. C'est ce que Victor a demandé.
          Somme des largeurs = 1212 px. À 1600 px de fenêtre il reste 1226 px
          une fois retirés le `p-4` du main (32), le panneau d'analyse (300),
          la gouttière (24) et la barre de défilement verticale (18) — c'est
          cette dernière qui manquait au premier calcul et faisait déborder le
          tableau de 7 px. Mesuré à 1224 px de rendu réel, sans défilement. */}
      <table className="w-full min-w-[1212px] table-fixed border-collapse">
        {/* C'est l'EN-TÊTE qui signale ce que le palier demande de travailler :
            l'information est la même pour toutes les games, elle n'a donc rien
            à faire répétée sur chaque ligne. Les cellules, elles, ne clignotent
            que sur une valeur rouge (cf. GameRow). */}
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={HEAD + " w-[210px]"}>Matchup</th>
            <th className={HEAD + " w-[70px] text-center"}>V/D</th>
            {/* Colonnes chiffrées resserrées de quelques pixels : elles
                n'affichent qu'un nombre à une décimale, et c'est le seul
                endroit où prendre les pixels rendus à la colonne Matchup sans
                toucher aux trois questions ni à la conclusion. Les intitulés
                se replient, ce qui ne coûte rien : ils sont identiques sur
                toutes les lignes. */}
            <th className={HEAD + " w-[74px] text-center" + highlightClass(content, "csPre20")}>
              CS/20min
            </th>
            <th className={HEAD + " w-[80px] text-center" + highlightClass(content, "csPost20")}>
              CS après 20min
            </th>
            <th className={HEAD + " w-[78px] text-center" + highlightClass(content, "deaths10")}>
              Morts/10min
            </th>
            {/* Les intitulés viennent du palier : jamais écrits en dur.
                Les trois portent la MÊME largeur, posée explicitement : les
                trois questions se valent, rien ne justifierait qu'une colonne
                soit plus étroite parce que son libellé est plus court. */}
            <th className={HEAD + " w-[175px]" + highlightFieldClass(content, "lane")}>
              {content.fieldQuestions.lane}
            </th>
            <th className={HEAD + " w-[175px]" + highlightFieldClass(content, "macro")}>
              {content.fieldQuestions.macro}
            </th>
            <th className={HEAD + " w-[175px]" + highlightFieldClass(content, "fight")}>
              {content.fieldQuestions.fight}
            </th>
            {/* Même largeur que les trois questions. Elle était un cran plus
                étroite (155 px) au nom de « une synthèse, pas une quatrième
                question », mais à cette largeur l'intitulé ne tenait pas dans
                la colonne chez Victor. Les 20 px manquants sont pris sur
                Matchup, qui en avait de reste : deux icônes de 32 px, le « VS »
                et un nom de champion qui se replie déjà. */}
            <th className={HEAD + " w-[175px]"}>Résumé / Conclusion</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              thresholds={thresholds}
              content={content}
              ddragonVersion={ddragonVersion}
              onErrorChange={onErrorChange}
              onSummaryChange={onSummaryChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameRow({
  game,
  thresholds,
  content,
  ddragonVersion,
  onErrorChange,
  onSummaryChange,
}: {
  game: Game;
  thresholds: TierThresholds | null;
  content: TierContent;
  ddragonVersion: string | null;
  onErrorChange: (id: string, field: ErrorField, value: string, index: number) => void;
  onSummaryChange: (id: string, value: string) => void;
}) {
  const win = game.result.toLowerCase().startsWith("v");
  const icon = championIconUrl(ddragonVersion, game.champion);
  const opponentIcon = championIconUrl(ddragonVersion, game.matchup);

  // Mêmes fonctions que StatCells sur l'analyse gratuite : la présentation
  // change (cellule au lieu de carte), les RÈGLES de couleur restent au seul
  // endroit qui les détient, lib/stats.
  const { perMinPre20, perMinPost20 } = csMetrics(game);
  const deathsForColour = weightedDeaths10(game);
  const explained = explainsDeaths(game);
  const stat = "px-1 py-2 text-center text-sm ";

  // La bande sert deux fois : la couleur de fond, et le clignotement — qui
  // exige EN PLUS que le palier surveille cette stat. Une valeur inconnue
  // (grise) ne clignote donc jamais : on n'alerte pas sur ce qu'on ne sait pas
  // juger.
  const bandPre20 = csBand(perMinPre20, thresholds?.csPre20 ?? null);
  const bandPost20 = csBand(perMinPost20, thresholds?.csPost20 ?? null);
  const bandDeaths = deathsBand(deathsForColour, thresholds?.deaths10 ?? null);

  return (
    <tr className="bg-slate-900/40">
      <td className={CELL + " px-2 py-2"}>
        <div className="flex items-center gap-1.5">
          {icon && (
            <img
              src={icon}
              alt={game.champion}
              className="h-8 w-8 shrink-0 rounded-full bg-slate-800"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          {opponentIcon && (
            <>
              <span className="text-[10px] font-extrabold text-red-500">VS</span>
              <img
                src={opponentIcon}
                alt={game.matchup}
                className="h-8 w-8 shrink-0 rounded-full bg-slate-800"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </>
          )}
        </div>
        {/* Quatre lignes, du plus identifiant au plus circonstanciel : les
            deux visages, puis leurs noms, puis le contexte de jeu, puis quand
            et combien de temps. Les trois dernières étaient auparavant
            tassées en deux lignes, dont une qui mêlait date, lane, file et
            durée séparées par des points médians. */}
        <p className="mt-1 text-sm font-medium break-words">
          {game.champion}
          {game.matchup && <span className="text-slate-500"> vs {game.matchup}</span>}
        </p>
        <p className="text-[11px] text-slate-400">
          {[game.lane, game.queue].filter(Boolean).join(" · ")}
        </p>
        <p className="text-[11px] text-slate-500">
          {[formatGameDate(game.played_at), formatDuration(game.game_duration_seconds)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </td>

      <td className={CELL + stat + "font-semibold " + (win ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
        {win ? "Victoire" : "Défaite"}
      </td>

      <td
        className={
          CELL +
          stat +
          csClass(perMinPre20, thresholds?.csPre20 ?? null) +
          alertClass(content, "csPre20", bandPre20)
        }
      >
        {perMinPre20 ?? "—"}
      </td>

      <td
        className={
          CELL +
          stat +
          csClass(perMinPost20, thresholds?.csPost20 ?? null) +
          alertClass(content, "csPost20", bandPost20)
        }
      >
        {perMinPost20 ?? "—"}
      </td>

      <td
        className={
          CELL +
          stat +
          deathsClass(deathsForColour, thresholds?.deaths10 ?? null) +
          alertClass(content, "deaths10", bandDeaths)
        }
      >
        {/* Le chiffre affiché reste le rythme BRUT ; seule la couleur suit le
            rythme pondéré. Le pointillé signale cet écart. */}
        <span
          className={explained ? "cursor-help underline decoration-dotted underline-offset-2" : undefined}
          title={explained ? DEATHS_EXPLANATION : undefined}
        >
          {game.deaths10}
        </span>
      </td>

      {/* Pas de clignotement ici : la priorité du palier est portée par
          l'en-tête de colonne, une fois pour toutes. */}
      <td className={CELL + " p-1"}>
        <AnswerList
          values={game.errorLane}
          onChange={(value, index) => onErrorChange(game.id, "errorLane", value, index)}
        />
      </td>
      <td className={CELL + " p-1"}>
        <AnswerList
          values={game.errorMacro}
          onChange={(value, index) => onErrorChange(game.id, "errorMacro", value, index)}
        />
      </td>
      <td className={CELL + " p-1"}>
        <AnswerList
          values={game.errorFight}
          onChange={(value, index) => onErrorChange(game.id, "errorFight", value, index)}
        />
      </td>

      <td className={CELL + " p-1"}>
        <AutoTextarea
          value={game.summary}
          onChange={(value) => onSummaryChange(game.id, value)}
          placeholder="Ta conclusion..."
        />
      </td>
    </tr>
  );
}
