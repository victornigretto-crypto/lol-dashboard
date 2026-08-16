import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// Client Supabase en cle service_role : il CONTOURNE RLS. A n'importer que
// depuis du code serveur (route handlers, server components), au meme titre
// que lib/riot/client.ts. Si cette cle atteignait le navigateur, n'importe qui
// pourrait lire et ecrire toutes les tables, tous utilisateurs confondus.
//
// Son seul usage aujourd'hui est le cache partage `match_facts`, qui n'a pas
// de proprietaire : un visiteur anonyme n'a pas d'`auth.uid()`, donc aucune
// policy RLS ne peut l'autoriser a ecrire. Tout ce qui appartient a un user
// (`games`, `profiles`) continue de passer par lib/supabase/server.ts, avec sa
// session et RLS -- ne pas se servir de ce client-ci pour raccourcir un
// controle d'acces.

let cached: SupabaseClient | null = null;
let warned = false;

// Renvoie `null` si SUPABASE_SERVICE_ROLE_KEY n'est pas configuree, au lieu de
// lever : le cache est une optimisation, pas une dependance. Sans la cle,
// l'app retombe exactement sur son comportement d'avant (tout retelecharge
// depuis Riot) au lieu de tomber en panne.
export function createAdminClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    if (!warned) {
      warned = true;
      console.warn(
        "SUPABASE_SERVICE_ROLE_KEY absente : le cache partage des parties est desactive, " +
          "chaque recherche retelechargera tout depuis l'API Riot (cf. .env.local.example)."
      );
    }
    return null;
  }

  cached = createSupabaseClient(url, serviceRoleKey, {
    // Pas de session a persister ni a rafraichir : ce client est sans
    // utilisateur, et vit dans un process serveur partage.
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
