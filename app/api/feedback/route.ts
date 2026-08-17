import { NextResponse } from "next/server";

// Réception des retours utilisateur (bug / suggestion) et envoi par email.
//
// Resend est appelé en HTTPS brut, sans son SDK : l'envoi est UN POST JSON, et
// une dépendance de plus pour ça serait du poids sans contrepartie. Décision de
// Victor du 2026-08-17 — `package.json` n'a pas bougé.

const DESTINATAIRE = "grosgalio@gmail.com";

// Expéditeur de démarrage fourni par Resend, utilisable sans posséder de
// domaine. ATTENTION : tant qu'aucun domaine n'est vérifié, Resend n'accepte
// d'envoyer QU'À l'adresse propriétaire du compte. Si le compte Resend n'est
// pas celui de DESTINATAIRE, l'envoi est refusé en 403.
const EXPEDITEUR = "GG Dashboard <onboarding@resend.dev>";

const MAX_LONGUEUR = 5000;

// Limite de débit : 3 envois par IP et par 10 minutes. Assez pour un aller-
// retour honnête (« ah, j'ai oublié un détail »), trop peu pour arroser.
const FENETRE_MS = 10 * 60 * 1000;
const MAX_PAR_FENETRE = 3;

type TypeRetour = "bug" | "suggestion";

const SUJETS: Record<TypeRetour, string> = {
  bug: "[BUG] Retour utilisateur — GG Dashboard",
  suggestion: "[SUGGESTION] Retour utilisateur — GG Dashboard",
};

// Message unique renvoyé au navigateur en cas d'échec, quelle qu'en soit la
// cause. Rien de technique ne doit remonter à l'utilisateur : ni statut Resend,
// ni message d'exception. Le détail part dans les logs serveur.
const ECHEC_GENERIQUE = "L'envoi n'a pas pu aboutir. Réessaie dans un moment.";

// Compteur en mémoire du process. Il ne prétend pas être un vrai régulateur :
// avec plusieurs instances serverless, chacune a le sien, donc la limite
// réelle est N × MAX_PAR_FENETRE (même travers que celui relevé pour le quota
// Riot dans MEMOIRE.md). C'est assez pour ce que ça protège — un formulaire de
// retour — et un état partagé serait de la sur-ingénierie ici.
const envois = new Map<string, number[]>();

function tropDEnvois(ip: string): boolean {
  const maintenant = Date.now();

  // Purge opportuniste : sans elle, la Map grandit d'une entrée par IP vue et
  // ne rend jamais rien. C'est fait ici plutôt qu'avec un minuteur, qui
  // survivrait au recyclage du process sans que personne le remarque.
  for (const [cle, dates] of envois) {
    if (dates.every((t) => maintenant - t >= FENETRE_MS)) envois.delete(cle);
  }

  const recents = (envois.get(ip) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  if (recents.length >= MAX_PAR_FENETRE) return true;

  envois.set(ip, [...recents, maintenant]);
  return false;
}

function ipDe(request: Request): string {
  // Derrière un proxy, la première valeur de x-forwarded-for est le client.
  const transmise = request.headers.get("x-forwarded-for");
  if (transmise) return transmise.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "inconnue";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Honeypot : un champ que le formulaire garde vide et masqué. Un humain ne le
  // voit pas, un robot qui remplit tout le renseigne. On répond alors un succès
  // parfaitement ordinaire — annoncer le refus apprendrait au robot à
  // contourner le piège.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    console.warn("[feedback] honeypot rempli, envoi ignoré");
    return NextResponse.json({ ok: true });
  }

  const type: TypeRetour = body?.type === "suggestion" ? "suggestion" : "bug";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (message === "") {
    return NextResponse.json({ error: "Écris ton message avant d'envoyer." }, { status: 400 });
  }
  if (message.length > MAX_LONGUEUR) {
    return NextResponse.json(
      { error: `Message trop long (${MAX_LONGUEUR} caractères maximum).` },
      { status: 400 }
    );
  }

  if (tropDEnvois(ipDe(request))) {
    return NextResponse.json(
      { error: "Tu as déjà envoyé plusieurs retours. Réessaie dans quelques minutes." },
      { status: 429 }
    );
  }

  // La clé Resend reste dans l'environnement : contrairement à la clé Riot,
  // elle n'expire pas et n'a donc rien à faire dans un écran d'administration.
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    // Même esprit que createAdminClient() : on le dit fort côté serveur, et
    // l'utilisateur ne voit qu'un échec ordinaire.
    console.error("[feedback] RESEND_API_KEY absente : aucun email ne peut partir.");
    return NextResponse.json({ error: ECHEC_GENERIQUE }, { status: 500 });
  }

  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EXPEDITEUR,
        to: DESTINATAIRE,
        subject: SUJETS[type],
        text: message,
      }),
    });

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      console.error(`[feedback] Resend a répondu ${reponse.status} : ${detail}`);
      return NextResponse.json({ error: ECHEC_GENERIQUE }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback] envoi impossible :", err);
    return NextResponse.json({ error: ECHEC_GENERIQUE }, { status: 502 });
  }
}
