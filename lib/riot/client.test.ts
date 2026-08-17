import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `lib/settings` lit la base pour trouver la clé : hors de question dans un
// test. On le remplace par une clé factice, ce qui isole ce qui nous intéresse
// vraiment ici — la traduction du statut HTTP en message.
vi.mock("@/lib/settings", () => ({
  cleRiot: async () => "RGAPI-cle-de-test",
}));

const { CLE_EXPIREE, getAccountByRiotId } = await import("@/lib/riot/client");

function reponse(status: number, body = "") {
  return new Response(body, { status, statusText: "" });
}

describe("riotFetch : clé refusée par Riot", () => {
  beforeEach(() => {
    // Le message technique part dans les logs serveur : on le tait pendant les
    // tests, sans quoi la sortie de la suite est noyée sous des erreurs
    // attendues.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // La panne la plus fréquente du projet : la dev key expire toutes les 24 h.
  // Le joueur voyait `Riot API 401 sur /lol/...: {"status":{"message":"Unknown
  // apikey"}}` — illisible et surtout inactionnable.
  it("rend le message adressé au joueur sur un 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reponse(401, '{"status":{"message":"Unknown apikey","status_code":401}}'))
    );

    await expect(getAccountByRiotId("Pseudo", "TAG")).rejects.toThrow(CLE_EXPIREE);
  });

  // Riot renvoie l'un ou l'autre selon que la clé est inconnue ou expirée, et
  // le remède est le même dans les deux cas.
  it("rend le même message sur un 403", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reponse(403, "Forbidden")));

    await expect(getAccountByRiotId("Pseudo", "TAG")).rejects.toThrow(CLE_EXPIREE);
  });

  it("dit exactement ce que Victor a demandé", () => {
    expect(CLE_EXPIREE).toBe(
      "Expiration de la clef API : Contacter Gros Galio pour lui demander de la refresh"
    );
  });

  // Les autres pannes gardent leur message technique : un 404 sur un pseudo
  // inexistant n'a rien à voir avec la clé, et le maquiller enverrait le joueur
  // déranger Gros Galio pour une faute de frappe.
  it("laisse les autres erreurs remonter telles quelles", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reponse(404, "not found")));

    await expect(getAccountByRiotId("Pseudo", "TAG")).rejects.toThrow(/404/);
    await expect(getAccountByRiotId("Pseudo", "TAG")).rejects.not.toThrow(CLE_EXPIREE);
  });
});
