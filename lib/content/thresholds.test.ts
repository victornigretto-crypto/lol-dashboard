import { describe, expect, it } from "vitest";
import { RANKED_TIERS, thresholdsOf } from "@/lib/content";

describe("thresholdsOf", () => {
  // Choix structurant : sans palier connu, ni couleur ni bandeau.
  it("rend null pour un compte non classe", () => {
    expect(thresholdsOf("unranked")).toBeNull();
  });

  it("rend des seuils pour chacun des 10 paliers classes", () => {
    for (const tier of RANKED_TIERS) {
      expect(thresholdsOf(tier), `palier ${tier}`).not.toBeNull();
    }
  });

  // Decision de Victor : faute de seuils propres, tout ce qui est au-dessus
  // d'emeraude reprend exactement les siens.
  it("diamond a challenger reprennent les seuils d'emeraude", () => {
    const emerald = thresholdsOf("emerald");
    for (const tier of ["diamond", "master", "grandmaster", "challenger"] as const) {
      expect(thresholdsOf(tier), `palier ${tier}`).toEqual(emerald);
    }
  });

  // Garde-fou de non-regression du 2026-08-11 : les paliers dont le CS/min
  // avant 20 min n'a pas ete recalibre doivent garder EXACTEMENT le
  // comportement d'avant (ancienne cible en vert, ratio de 85 % en jaune).
  // Si ces valeurs changent, des games changent de couleur.
  it("conserve les seuils avant-20 non recalibres", () => {
    expect(thresholdsOf("bronze")?.csPre20).toEqual({ green: 7.5, yellow: 6.375 });
    expect(thresholdsOf("silver")?.csPre20).toEqual({ green: 7.5, yellow: 6.375 });
    expect(thresholdsOf("gold")?.csPre20).toEqual({ green: 8, yellow: 6.8 });
    expect(thresholdsOf("platinum")?.csPre20).toEqual({ green: 8, yellow: 6.8 });
  });

  it("iron a ses propres seuils, les plus bas", () => {
    expect(thresholdsOf("iron")?.csPre20).toEqual({ green: 7, yellow: 5.5 });
    expect(thresholdsOf("iron")?.csPost20).toEqual({ green: 6, yellow: 5 });
  });

  // Le seuil vert des morts est le meme partout : c'est un objectif, pas une
  // moyenne de palier (choix assume, note dans MEMOIRE.md).
  it("vise 1.0 mort/10 min en vert a tous les paliers", () => {
    for (const tier of RANKED_TIERS) {
      expect(thresholdsOf(tier)?.deaths10.green, `palier ${tier}`).toBe(1);
    }
  });

  // Le pool tolere s'elargit avec le palier.
  it("tolere de plus en plus de champions en montant", () => {
    expect(thresholdsOf("iron")?.maxChampions).toBe(3);
    expect(thresholdsOf("bronze")?.maxChampions).toBe(3);
    expect(thresholdsOf("silver")?.maxChampions).toBe(4);
    expect(thresholdsOf("gold")?.maxChampions).toBe(4);
    expect(thresholdsOf("platinum")?.maxChampions).toBe(5);
    expect(thresholdsOf("emerald")?.maxChampions).toBe(5);
  });

  // Un seuil jaune ne doit jamais etre plus exigeant que le vert, sinon la
  // bande jaune serait vide ou inversee.
  it("garde toujours jaune moins exigeant que vert", () => {
    for (const tier of RANKED_TIERS) {
      const t = thresholdsOf(tier);
      expect(t!.csPre20.yellow, `csPre20 ${tier}`).toBeLessThan(t!.csPre20.green);
      expect(t!.csPost20.yellow, `csPost20 ${tier}`).toBeLessThan(t!.csPost20.green);
      // Morts : logique inversee, le jaune tolere PLUS de morts que le vert.
      expect(t!.deaths10.yellow, `deaths10 ${tier}`).toBeGreaterThan(t!.deaths10.green);
    }
  });
});
