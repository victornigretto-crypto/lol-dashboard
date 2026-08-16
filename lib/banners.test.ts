import { describe, expect, it } from "vitest";
import {
  championPoolBanner,
  deathsBanner,
  farmPre20Banner,
  performanceBanners,
  rolesBanner,
  sortBanners,
  type Banner,
  type BannerGame,
} from "@/lib/banners";
import { thresholdsOf } from "@/lib/content";

const PLATINUM = thresholdsOf("platinum");

// Une game "neutre" : Mid, SoloQ, 30 min, farm et morts au niveau du vert
// platine. Chaque test ne surcharge que ce qu'il veut eprouver.
const game = (over: Partial<BannerGame> = {}): BannerGame => ({
  cs20: 180,
  cs_final: 400,
  game_duration_seconds: 1800,
  deaths10: 0.7,
  deaths: null,
  deaths_last5: null,
  lane: "Mid",
  champion: "Syndra",
  queue: "SoloQ",
  ...over,
});

const banner = (id: string, severity: Banner["severity"]): Banner => ({
  id,
  severity,
  text: id,
  detail: "",
});

describe("sortBanners", () => {
  // Ordre demande par Victor le 2026-08-11 : le vert d'abord, le rouge en
  // dernier (l'inverse de l'ordre d'origine).
  it("classe vert, puis jaune, puis rouge", () => {
    const sorted = sortBanners([banner("a", "red"), banner("b", "green"), banner("c", "yellow")]);
    expect(sorted.map((b) => b.severity)).toEqual(["green", "yellow", "red"]);
  });

  // Le tri doit rester stable : / et /suivi alimentent la liste en plusieurs
  // fois, l'ordre d'ajout doit survivre a severite egale.
  it("garde l'ordre d'ajout a severite egale", () => {
    const sorted = sortBanners([banner("a", "red"), banner("b", "red"), banner("c", "red")]);
    expect(sorted.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const input = [banner("a", "red"), banner("b", "green")];
    sortBanners(input);
    expect(input.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("farmPre20Banner", () => {
  it("juge le farm face au seuil du palier", () => {
    expect(farmPre20Banner([game({ cs20: 180 })], PLATINUM)?.severity).toBe("green");
    expect(farmPre20Banner([game({ cs20: 145 })], PLATINUM)?.severity).toBe("yellow");
    expect(farmPre20Banner([game({ cs20: 120 })], PLATINUM)?.severity).toBe("red");
  });

  // Un jungler ou un support n'a pas a etre juge sur son CS/min : seules les
  // lanes Top / Mid / Bot entrent dans la moyenne.
  it("exclut les lanes ou le farm n'est pas un indicateur", () => {
    const games = [game({ lane: "Mid", cs20: 180 }), game({ lane: "Jungle", cs20: 20 })];
    // Si la jungle comptait, la moyenne tomberait a 5.0 CS/min donc en rouge.
    expect(farmPre20Banner(games, PLATINUM)?.severity).toBe("green");
  });

  // Choix structurant : seuils inconnus -> on ne dit rien.
  it("ne dit rien sans seuils de palier", () => {
    expect(farmPre20Banner([game()], null)).toBeNull();
  });

  it("ne dit rien si aucune game ne se prete au calcul", () => {
    expect(farmPre20Banner([], PLATINUM)).toBeNull();
    expect(farmPre20Banner([game({ lane: "Support" })], PLATINUM)).toBeNull();
  });
});

describe("deathsBanner", () => {
  it("annonce un joueur safe ou trop de morts", () => {
    expect(deathsBanner([game({ deaths10: 0.7 })], PLATINUM)?.text).toBe("Joueur safe");
    expect(deathsBanner([game({ deaths10: 2 })], PLATINUM)?.text).toBe("Trop de morts");
  });

  // Demande explicite : le jaune ne dit rien d'actionnable sur les morts, donc
  // aucun bandeau. Ce n'est pas un oubli.
  it("n'affiche rien en jaune", () => {
    expect(deathsBanner([game({ deaths10: 1.3 })], PLATINUM)).toBeNull();
  });

  // Le bandeau doit utiliser le rythme PONDERE, comme la couleur de la
  // colonne. Meme game, seule la duree change : a 25 min rien n'est pondere
  // (rouge), a 35 min les morts tardives comptent a moitie et la font sortir
  // du rouge.
  it("juge sur le rythme pondere, pas sur le rythme brut", () => {
    const brut = game({ deaths10: 1.7, deaths: 6, deaths_last5: 4, game_duration_seconds: 1500 });
    expect(deathsBanner([brut], PLATINUM)?.severity).toBe("red");

    const pondere = game({ deaths10: 1.7, deaths: 6, deaths_last5: 4, game_duration_seconds: 2100 });
    expect(deathsBanner([pondere], PLATINUM)).toBeNull();
  });

  it("ne dit rien sans seuils ni sans games", () => {
    expect(deathsBanner([game()], null)).toBeNull();
    expect(deathsBanner([], PLATINUM)).toBeNull();
  });
});

describe("rolesBanner", () => {
  const roles = ["Top", "Jungle", "Mid", "Bot", "Support"];

  it("alerte a partir de 4 roles differents", () => {
    const four = roles.slice(0, 4).map((lane) => game({ lane }));
    expect(rolesBanner(four)?.severity).toBe("red");
    expect(rolesBanner(four)?.detail).toContain("4 rôles");
  });

  it("ne dit rien en dessous de 4 roles", () => {
    expect(rolesBanner(roles.slice(0, 3).map((lane) => game({ lane })))).toBeNull();
  });

  // Ce bandeau se juge sur la SoloQ seule : c'est la file ou la specialisation
  // compte.
  it("ignore les games hors SoloQ", () => {
    expect(rolesBanner(roles.map((lane) => game({ lane, queue: "Flex" })))).toBeNull();
    expect(rolesBanner(roles.map((lane) => game({ lane, queue: null })))).toBeNull();
  });

  // Seul bandeau du lot a ne pas dependre du palier : la regle est la meme
  // pour tout le monde, donc il s'affiche aussi sans seuils.
  it("s'affiche meme sans seuils de palier", () => {
    const games = roles.slice(0, 4).map((lane) => game({ lane }));
    expect(performanceBanners(games, null).map((b) => b.id)).toEqual(["roles"]);
  });
});

describe("championPoolBanner", () => {
  const withChampions = (names: string[], over: Partial<BannerGame> = {}) =>
    names.map((champion) => game({ champion, ...over }));

  // Le seuil est un nombre TOLERE, pas un plafond interdit : la comparaison
  // est stricte (5 champions en platine ne dit rien, 6 declenche).
  it("declenche strictement au-dela du nombre tolere", () => {
    expect(championPoolBanner(withChampions(["a", "b", "c", "d", "e"]), PLATINUM)).toBeNull();
    expect(championPoolBanner(withChampions(["a", "b", "c", "d", "e", "f"]), PLATINUM)?.severity).toBe(
      "red"
    );
  });

  // Le pool se compte PAR ROLE : 3 champions en mid et 3 en top, c'est un
  // joueur concentre sur chacun de ses roles.
  it("compte le pool par role et non sur l'ensemble", () => {
    const games = [
      ...withChampions(["a", "b", "c"], { lane: "Mid" }),
      ...withChampions(["d", "e", "f"], { lane: "Top" }),
    ];
    expect(championPoolBanner(games, PLATINUM)).toBeNull();
  });

  it("nomme le role qui a declenche", () => {
    const games = [
      ...withChampions(["a", "b", "c", "d", "e", "f"], { lane: "Top" }),
      ...withChampions(["g"], { lane: "Mid" }),
    ];
    expect(championPoolBanner(games, PLATINUM)?.detail).toContain("Top");
  });

  it("ignore les games hors SoloQ et n'a rien a dire sans seuils", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(championPoolBanner(withChampions(six, { queue: "Flex" }), PLATINUM)).toBeNull();
    expect(championPoolBanner(withChampions(six), null)).toBeNull();
  });
});

describe("performanceBanners", () => {
  it("rend les bandeaux deja tries du vert au rouge", () => {
    // Bon farm (vert) + 4 roles (rouge) sur le meme echantillon.
    const games = [
      game({ lane: "Mid", cs20: 180 }),
      game({ lane: "Top", cs20: 180 }),
      game({ lane: "Jungle" }),
      game({ lane: "Support" }),
    ];
    const severities = performanceBanners(games, PLATINUM).map((b) => b.severity);
    const rank = { green: 0, yellow: 1, red: 2 };
    const values = severities.map((s) => rank[s]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(severities).toContain("green");
    expect(severities).toContain("red");
  });

  it("ne rend aucun bandeau dependant du palier sans seuils", () => {
    expect(performanceBanners([game()], null)).toEqual([]);
  });
});
