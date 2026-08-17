// Reglages lus en base plutot que dans l'environnement, pour pouvoir etre
// changes depuis l'application (cf. supabase/migrations/20260817_app_settings.sql).
//
// CODE SERVEUR UNIQUEMENT. Ce module lit un secret d'API : il ne doit jamais
// etre importe depuis un composant client, au meme titre que lib/supabase/admin.
//
// Le besoin vient de la cle Riot : en dev key elle EXPIRE TOUTES LES 24 H, et
// jusqu'ici la remplacer voulait dire editer .env.local sur la machine qui fait
// tourner le serveur. Trois pannes de la session du 13/08 et du 16/08 viennent
// de la (cf. MEMOIRE.md).
import { createAdminClient } from "@/lib/supabase/admin";

export const CLE_RIOT = "riot_api_key";

// D'ou vient la valeur effectivement utilisee. Sert a l'ecran d'administration :
// savoir qu'une cle vient encore de l'environnement explique pourquoi la
// modifier depuis l'app ne change rien tant qu'elle n'a pas ete enregistree.
export type Source = "base" | "environnement" | "absente";

export type EtatCle = {
  source: Source;
  /** Apercu masque, sans jamais rendre le secret. `null` si absente. */
  apercu: string | null;
  /** Horodatage du dernier enregistrement en base, `null` si jamais ecrit. */
  modifieLe: string | null;
  /**
   * `false` quand la table `app_settings` n'existe pas encore. L'ecran
   * d'administration le dit alors franchement, au lieu de laisser decouvrir le
   * probleme au moment d'enregistrer — ce qui est arrive le 2026-08-17.
   */
  stockagePret: boolean;
};

// Pourquoi un enregistrement a echoue. Distinguer "la table n'existe pas" du
// reste n'est pas un detail : dans le premier cas, reessayer ne marchera JAMAIS,
// et le seul remede est une migration a lancer a la main.
export type Echec = "stockage-absent" | "stockage-indisponible" | "erreur";

// PostgREST signale une table inconnue par PGRST205, Postgres par 42P01. On
// teste aussi le message, les codes ayant deja change d'une version a l'autre.
function tableAbsente(error: { code?: string; message?: string }): boolean {
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return (error.message ?? "").includes("Could not find the table");
}

// On montre le debut et la fin, jamais le milieu : assez pour reconnaitre
// QUELLE cle est en place, trop peu pour la reconstituer. Une cle courte est
// masquee entierement plutot que de laisser deviner la moitie des caracteres.
export function masquer(valeur: string): string {
  if (valeur.length <= 12) return "•".repeat(valeur.length);
  return `${valeur.slice(0, 6)}${"•".repeat(8)}${valeur.slice(-4)}`;
}

// --- Cache en memoire -----------------------------------------------------
//
// Indispensable, et pas une optimisation de confort : un seul import Riot
// declenche une quarantaine d'appels a `riotFetch`, qui reclament chacun la
// cle. Sans cache, ce serait autant d'allers-retours vers Postgres pour lire
// la meme ligne.
//
// La duree de vie est courte pour que le remplacement de la cle prenne effet
// vite. Elle n'a pas a etre parfaite : `enregistrerCleRiot` vide le cache du
// process qui ecrit, donc en developpement (un seul process) l'effet est
// immediat. Avec plusieurs instances serverless, les autres rattrapent au plus
// tard au bout de DUREE_CACHE_MS — meme limite que celle deja notee pour la
// limite de debit du feedback.
const DUREE_CACHE_MS = 30_000;

let cache: { valeur: string | null; expire: number } | null = null;

function viderCache() {
  cache = null;
}

type Lecture = { ligne: { value: string; updated_at: string } | null; stockagePret: boolean };

async function lireEnBase(cle: string): Promise<Lecture> {
  const admin = createAdminClient();
  if (!admin) return { ligne: null, stockagePret: false };

  const { data, error } = await admin
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", cle)
    .maybeSingle();

  if (error) {
    // Cas le plus probable au premier lancement : la migration n'a pas encore
    // ete passee. On le dit fort cote serveur et on retombe sur l'environnement
    // plutot que de tomber en panne — meme esprit que createAdminClient().
    console.error(`[settings] lecture de "${cle}" impossible :`, error.message);
    return { ligne: null, stockagePret: !tableAbsente(error) };
  }
  return { ligne: data ?? null, stockagePret: true };
}

// La cle Riot effectivement utilisee par lib/riot/client.
// La BASE a la priorite sur l'environnement : c'est ce qui donne son sens a
// l'ecran d'administration. `RIOT_API_KEY` reste un filet de secours, utile
// tant que la migration n'est pas passee.
export async function cleRiot(): Promise<string | null> {
  if (cache && cache.expire > Date.now()) return cache.valeur;

  const { ligne } = await lireEnBase(CLE_RIOT);
  const valeur = ligne?.value || process.env.RIOT_API_KEY || null;
  cache = { valeur, expire: Date.now() + DUREE_CACHE_MS };
  return valeur;
}

export async function etatCleRiot(): Promise<EtatCle> {
  // Lecture directe, sans passer par le cache : cet ecran doit montrer l'etat
  // REEL de la base, pas ce qu'un process a memorise il y a vingt secondes.
  const { ligne, stockagePret } = await lireEnBase(CLE_RIOT);
  if (ligne?.value) {
    return {
      source: "base",
      apercu: masquer(ligne.value),
      modifieLe: ligne.updated_at,
      stockagePret,
    };
  }
  const env = process.env.RIOT_API_KEY;
  if (env) {
    return { source: "environnement", apercu: masquer(env), modifieLe: null, stockagePret };
  }
  return { source: "absente", apercu: null, modifieLe: null, stockagePret };
}

export async function enregistrerCleRiot(
  valeur: string,
  parUtilisateur: string
): Promise<{ ok: true } | { ok: false; raison: Echec }> {
  const admin = createAdminClient();
  if (!admin) {
    console.error("[settings] SUPABASE_SERVICE_ROLE_KEY absente : enregistrement impossible.");
    return { ok: false, raison: "stockage-indisponible" };
  }

  const { error } = await admin.from("app_settings").upsert(
    { key: CLE_RIOT, value: valeur, updated_at: new Date().toISOString(), updated_by: parUtilisateur },
    { onConflict: "key" }
  );

  if (error) {
    // La valeur ne doit JAMAIS apparaitre dans un log, meme en cas d'echec.
    console.error("[settings] enregistrement de la cle Riot impossible :", error.message);
    return { ok: false, raison: tableAbsente(error) ? "stockage-absent" : "erreur" };
  }

  viderCache();
  return { ok: true };
}
