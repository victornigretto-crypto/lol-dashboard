import { describe, expect, it } from "vitest";
import {
  dominantRole,
  FALLBACK_CONTENT,
  getContent,
  RANKED_TIERS,
  roleFromLane,
  tierFromRiotTier,
} from "@/lib/content";

const WRITTEN_TIERS = ["iron", "bronze", "silver", "gold", "platinum", "emerald"] as const;
const BORROWING_TIERS = ["diamond", "master", "grandmaster", "challenger"] as const;
const OTHER_ROLES = ["top", "jungle", "adc", "support"] as const;

describe("getContent — contenu reellement ecrit", () => {
  it("sert le contenu mid des 6 paliers ecrits, non marque en developpement", () => {
    for (const tier of WRITTEN_TIERS) {
      const content = getContent("mid", tier);
      expect(content.inDevelopment, `palier ${tier}`).toBe(false);
      expect(content.focusPoints.length, `palier ${tier}`).toBeGreaterThan(0);
      expect(content.focusIntro, `palier ${tier}`).not.toBe(FALLBACK_CONTENT.focusIntro);
    }
  });
});

describe("getContent — emprunt", () => {
  // Regle : un contenu manquant s'emprunte, une recommandation ne s'emprunte
  // pas. Le contenu emprunte sert ses questions et sa surbrillance, mais reste
  // marque inDevelopment pour que les pages affichent l'avertissement a la
  // place des recommandations.
  it("emprunte emeraude pour les paliers au-dessus, en restant marque", () => {
    const emerald = getContent("mid", "emerald");
    for (const tier of BORROWING_TIERS) {
      const borrowed = getContent("mid", tier);
      expect(borrowed.inDevelopment, `palier ${tier}`).toBe(true);
      expect(borrowed.focusPoints, `palier ${tier}`).toEqual(emerald.focusPoints);
      expect(borrowed.fieldQuestions, `palier ${tier}`).toEqual(emerald.fieldQuestions);
      expect(borrowed.highlightStats, `palier ${tier}`).toEqual(emerald.highlightStats);
    }
  });

  it("emprunte le mid du meme palier pour les quatre autres roles", () => {
    const mid = getContent("mid", "platinum");
    for (const role of OTHER_ROLES) {
      const borrowed = getContent(role, "platinum");
      expect(borrowed.inDevelopment, `role ${role}`).toBe(true);
      expect(borrowed.fieldQuestions, `role ${role}`).toEqual(mid.fieldQuestions);
      expect(borrowed.highlightStats, `role ${role}`).toEqual(mid.highlightStats);
    }
  });

  it("cumule les deux emprunts : un support diamant lit le mid emeraude", () => {
    expect(getContent("support", "diamond").fieldQuestions).toEqual(
      getContent("mid", "emerald").fieldQuestions
    );
  });

  // Seul `unranked` retombe encore sur le generique complet.
  it("retombe sur le generique pour un compte non classe", () => {
    expect(getContent("mid", "unranked")).toBe(FALLBACK_CONTENT);
    expect(getContent("support", "unranked")).toBe(FALLBACK_CONTENT);
  });

  // Le contenu ecrit ne doit JAMAIS etre mute au passage : l'emprunt renvoie
  // une copie. Sans ca, lire le contenu d'un support marquerait le contenu mid
  // comme "en developpement" pour tout le reste de la session.
  it("ne mute jamais le contenu ecrit d'origine", () => {
    for (const tier of WRITTEN_TIERS) {
      getContent("support", tier);
      getContent("top", tier);
      expect(getContent("mid", tier).inDevelopment, `palier ${tier}`).toBe(false);
    }
  });

  it("renvoie bien l'objet ecrit lui-meme pour mid, sans copie inutile", () => {
    expect(getContent("mid", "iron")).toBe(getContent("mid", "iron"));
  });
});

describe("tierFromRiotTier", () => {
  it("normalise la casse de league-v4", () => {
    expect(tierFromRiotTier("PLATINUM")).toBe("platinum");
    expect(tierFromRiotTier("Emerald")).toBe("emerald");
  });

  it("rend unranked pour une valeur absente ou inconnue", () => {
    expect(tierFromRiotTier(null)).toBe("unranked");
    expect(tierFromRiotTier(undefined)).toBe("unranked");
    expect(tierFromRiotTier("")).toBe("unranked");
    expect(tierFromRiotTier("BRONZE_III")).toBe("unranked");
  });

  it("reconnait les 10 paliers classes", () => {
    for (const tier of RANKED_TIERS) {
      expect(tierFromRiotTier(tier.toUpperCase()), `palier ${tier}`).toBe(tier);
    }
  });
});

describe("roleFromLane / dominantRole", () => {
  it("accepte les libelles d'affichage et les positions brutes de Riot", () => {
    expect(roleFromLane("Mid")).toBe("mid");
    expect(roleFromLane("MIDDLE")).toBe("mid");
    expect(roleFromLane("Bot")).toBe("adc");
    expect(roleFromLane("BOTTOM")).toBe("adc");
    expect(roleFromLane("UTILITY")).toBe("support");
    expect(roleFromLane("  jungle  ")).toBe("jungle");
  });

  it("rend null pour une lane vide ou inconnue", () => {
    expect(roleFromLane(null)).toBeNull();
    expect(roleFromLane("")).toBeNull();
    expect(roleFromLane("INVALID")).toBeNull();
  });

  it("prend le role le plus joue", () => {
    expect(dominantRole(["Mid", "Mid", "Top"])).toBe("mid");
  });

  it("ignore les lanes non reconnues", () => {
    expect(dominantRole(["???", "Top", null])).toBe("top");
    expect(dominantRole([])).toBeNull();
    expect(dominantRole(["???"])).toBeNull();
  });

  // Egalite tranchee par la premiere occurrence, donc par la game la plus
  // recente (Riot renvoie les matchs du plus recent au plus ancien).
  it("tranche une egalite par la game la plus recente", () => {
    expect(dominantRole(["Top", "Mid"])).toBe("top");
    expect(dominantRole(["Mid", "Top"])).toBe("mid");
  });
});
