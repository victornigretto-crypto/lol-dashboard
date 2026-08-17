import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estAdmin } from "@/lib/admin";
import { enregistrerCleRiot, etatCleRiot } from "@/lib/settings";

// Lecture de l'etat de la cle Riot, et remplacement de celle-ci.
//
// Le controle d'acces est ICI, pas dans l'interface. Le bouton cache cote
// client n'est qu'un confort : cette route est atteignable directement, avec
// un simple curl et un cookie de session valide. C'est donc elle qui doit
// refuser, et elle le fait sur l'email de la session Supabase — jamais sur un
// champ envoye par l'appelant, qui serait choisi par l'attaquant lui-meme.
//
// Ce que cette route ne renvoie JAMAIS : la cle en clair. Une fois posee, elle
// ne ressort plus que sous forme masquee. Perdre la valeur n'est pas grave, une
// dev key Riot se regenere en trente secondes ; la laisser fuiter, si — elle
// permet d'epuiser le quota du projet.

// Format d'une cle Riot : `RGAPI-` suivi d'un UUID. On refuse tout le reste
// plutot que d'enregistrer une valeur qui ne marchera pas — c'est exactement le
// genre d'erreur qui se paie en une session de debogage, le symptome (rang et
// recommandations qui disparaissent ensemble, cf. MEMOIRE.md du 13/08) ne
// disant rien de la cause.
const FORMAT_CLE = /^RGAPI-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function refuserSiPasAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!estAdmin(user?.email)) {
    // Meme reponse qu'on soit deconnecte ou simplement pas administrateur :
    // rien ne doit permettre de deviner quel compte detient ce droit.
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const refus = await refuserSiPasAdmin();
  if (refus) return refus;

  return NextResponse.json(await etatCleRiot());
}

export async function POST(request: Request) {
  const refus = await refuserSiPasAdmin();
  if (refus) return refus;

  // L'identite est relue depuis la session pour la tracer : `updated_by` doit
  // dire qui a reellement agi, pas ce que la requete a bien voulu declarer.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json().catch(() => null);
  const valeur = typeof body?.value === "string" ? body.value.trim() : "";

  if (valeur === "") {
    return NextResponse.json({ error: "Colle une clé avant d'enregistrer." }, { status: 400 });
  }
  if (!FORMAT_CLE.test(valeur)) {
    return NextResponse.json(
      { error: "Ça ne ressemble pas à une clé Riot : elle commence par « RGAPI- »." },
      { status: 400 }
    );
  }

  const resultat = await enregistrerCleRiot(valeur, user!.id);
  if (!resultat.ok) {
    // Écran d'administration, donc destinataire unique : l'administrateur.
    // Ici, être precis N'EST PAS une fuite technique — c'est la seule facon de
    // savoir quoi faire. Dire « réessaie dans un moment » quand la table
    // n'existe pas envoie chercher une panne passagère qui n'existe pas :
    // c'est exactement ce qui s'est produit le 2026-08-17.
    const messages: Record<typeof resultat.raison, string> = {
      "stockage-absent":
        "La table app_settings n'existe pas dans cette base. Lance la migration " +
        "supabase/migrations/20260817_app_settings.sql dans Supabase → SQL Editor.",
      "stockage-indisponible":
        "SUPABASE_SERVICE_ROLE_KEY est absente de .env.local : le serveur ne peut pas écrire.",
      erreur: "Enregistrement impossible. Réessaie dans un moment.",
    };
    return NextResponse.json({ error: messages[resultat.raison] }, { status: 500 });
  }

  // On renvoie le nouvel etat masque : l'interface affiche ainsi ce qui est
  // reellement en base, et pas ce qu'elle croit avoir envoye.
  return NextResponse.json(await etatCleRiot());
}
