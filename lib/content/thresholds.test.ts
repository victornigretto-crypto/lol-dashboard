import { describe, expect, it } from "vitest";
import { RANKED_TIERS, thresholdsOf } from "@/lib/content";
import { deathsBand } from "@/lib/stats";

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

  // La table dictee par Victor le 2026-08-17, palier par palier. Ces valeurs
  // decident directement de la couleur de chaque case : elles sont reprises
  // telles quelles ici pour qu'une modification involontaire se voie.
  it("applique la table de farm avant 20 min", () => {
    expect(thresholdsOf("iron")?.csPre20).toEqual({ great: 7.5, good: 6, warn: 5.5 });
    expect(thresholdsOf("bronze")?.csPre20).toEqual({ great: 7.5, good: 7, warn: 6 });
    expect(thresholdsOf("silver")?.csPre20).toEqual({ great: 7.5, good: 7, warn: 6.5 });
    expect(thresholdsOf("gold")?.csPre20).toEqual({ great: 8, good: 7, warn: 6.5 });
    expect(thresholdsOf("platinum")?.csPre20).toEqual({ great: 8.5, good: 7, warn: 6.5 });
    expect(thresholdsOf("emerald")?.csPre20).toEqual({ great: 8.5, good: 7.5, warn: 6.5 });
  });

  it("applique la table de farm apres 20 min", () => {
    expect(thresholdsOf("iron")?.csPost20).toEqual({ great: 7, good: 6, warn: 5 });
    expect(thresholdsOf("bronze")?.csPost20).toEqual({ great: 7, good: 6, warn: 5 });
    expect(thresholdsOf("silver")?.csPost20).toEqual({ great: 7.5, good: 6.5, warn: 6 });
    expect(thresholdsOf("gold")?.csPost20).toEqual({ great: 7.5, good: 6.5, warn: 6 });
    // Platine -> challenger partagent le meme farm apres 20 min.
    for (const tier of ["platinum", "emerald", "challenger"] as const) {
      expect(thresholdsOf(tier)?.csPost20, `palier ${tier}`).toEqual({ great: 8, good: 7, warn: 6 });
    }
  });

  it("applique la table des morts", () => {
    expect(thresholdsOf("iron")?.deaths10).toEqual({ great: 1, good: 2, warn: 3 });
    expect(thresholdsOf("bronze")?.deaths10).toEqual({ great: 1, good: 2, warn: 3 });
    expect(thresholdsOf("silver")?.deaths10).toEqual({ great: 1, good: 2, warn: 2.5 });
    expect(thresholdsOf("gold")?.deaths10).toEqual({ great: 1, good: 2, warn: 2.5 });
    expect(thresholdsOf("platinum")?.deaths10).toEqual({ great: 1, good: 2, warn: 2.5 });
    expect(thresholdsOf("emerald")?.deaths10).toEqual({ great: 0.5, good: 1.75, warn: 2.5 });
  });

  // La grille de depart laissait la zone 0.5 - 1 sans bande sur les paliers
  // hauts. Victor l'a tranchee dans les deux sens, differemment :
  //   - platine : le vert FONCE remonte a 1, donc 0.8 est vert fonce ;
  //   - emeraude et au-dessus : le vert PALE descend a 0.5, donc 0.8 est vert
  //     pale.
  // Les deux sont des decisions, pas des restes. Ce test les fige toutes deux
  // parce qu'un seul chiffre deplace ferait silencieusement reapparaitre le
  // trou, sans qu'aucune autre assertion ne s'en apercoive.
  it("ne laisse aucun rythme de morts sans bande sur les paliers hauts", () => {
    for (const v of [0.4, 0.5, 0.8, 1, 1.1]) {
      for (const tier of ["platinum", "emerald", "challenger"] as const) {
        const band = deathsBand(v, thresholdsOf(tier)!.deaths10);
        expect(band, `${v} morts en ${tier}`).not.toBe("unknown");
      }
    }
    expect(deathsBand(0.8, thresholdsOf("platinum")!.deaths10)).toBe("great");
    expect(deathsBand(0.8, thresholdsOf("emerald")!.deaths10)).toBe("good");
  });

  // Les deux bandes vertes doivent SE TOUCHER : le vert fonce s'arrete pile ou
  // le vert pale commence. C'est ce qui garantit l'absence de trou, quelle que
  // soit la valeur testee.
  it("fait se toucher le vert fonce et le vert pale sur les morts", () => {
    for (const tier of RANKED_TIERS) {
      const morts = thresholdsOf(tier)!.deaths10;
      const juste_au_dessus = morts.great + 0.01;
      expect(deathsBand(morts.great, morts), `${tier} au seuil`).toBe("great");
      expect(deathsBand(juste_au_dessus, morts), `${tier} juste au-dessus`).toBe("good");
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

  // Les quatre bandes doivent rester ordonnees, sinon l'une d'elles est vide
  // et une couleur devient inatteignable.
  //
  // L'ordre NUMERIQUE s'inverse entre les deux familles de stats, et c'est
  // exactement ce que ce test doit verifier : pour le farm il faut monter
  // (warn < good < great), pour les morts il faut descendre
  // (great < good < warn). Ecrire la meme assertion pour les trois — l'erreur
  // faite en ecrivant ce test — laisserait passer une table inversee.
  it("garde les quatre bandes du farm ordonnees, du jaune au vert fonce", () => {
    for (const tier of RANKED_TIERS) {
      const t = thresholdsOf(tier)!;
      for (const [name, s] of [
        ["csPre20", t.csPre20],
        ["csPost20", t.csPost20],
      ] as const) {
        expect(s.warn, `${name} ${tier} : jaune < vert pale`).toBeLessThan(s.good);
        expect(s.good, `${name} ${tier} : vert pale < vert fonce`).toBeLessThan(s.great);
      }
    }
  });

  it("garde les quatre bandes des morts ordonnees en sens inverse", () => {
    for (const tier of RANKED_TIERS) {
      const morts = thresholdsOf(tier)!.deaths10;
      expect(morts.great, `deaths10 ${tier} : vert fonce < vert pale`).toBeLessThan(morts.good);
      expect(morts.good, `deaths10 ${tier} : vert pale < jaune`).toBeLessThan(morts.warn);
    }
  });
});
