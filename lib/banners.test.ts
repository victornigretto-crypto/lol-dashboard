import { describe, expect, it } from "vitest";
import {
  championPoolBanner,
  deathsBanner,
  farmPost20Banner,
  farmPre20Banner,
  performanceBanners,
  rolesBanner,
  sortBanners,
  type Banner,
  type BannerGame,
} from "@/lib/banners";
import { thresholdsOf } from "@/lib/content";

const PLATINUM = thresholdsOf("platinum");

// Une game "neutre" : Mid, SoloQ, 30 min, farm et morts confortables au palier
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
  // Ordre demande par Victor : le meilleur d'abord, le rouge en dernier.
  it("classe vert fonce, vert pale, jaune, puis rouge", () => {
    const sorted = sortBanners([
      banner("a", "bad"),
      banner("b", "good"),
      banner("c", "warn"),
      banner("d", "great"),
    ]);
    expect(sorted.map((b) => b.severity)).toEqual(["great", "good", "warn", "bad"]);
  });

  // Le tri doit rester stable : / et /suivi alimentent la liste en plusieurs
  // fois, l'ordre d'ajout doit survivre a severite egale.
  it("garde l'ordre d'ajout a severite egale", () => {
    const sorted = sortBanners([banner("a", "bad"), banner("b", "bad"), banner("c", "bad")]);
    expect(sorted.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const input = [banner("a", "bad"), banner("b", "great")];
    sortBanners(input);
    expect(input.map((b) => b.id)).toEqual(["a", "b"]);
  });

  // Un bandeau epingle passe AVANT le tri par severite : c'est tout l'interet,
  // sans quoi un bandeau rouge finirait en bas, derriere les verts.
  it("place un bandeau epingle avant tout le reste, verts compris", () => {
    const sorted = sortBanners([
      banner("vert", "great"),
      banner("jaune", "warn"),
      { ...banner("epingle", "bad"), pinned: true },
    ]);
    expect(sorted.map((b) => b.id)).toEqual(["epingle", "vert", "jaune"]);
  });
});

describe("farmPre20Banner", () => {
  // Seuils platine : vert fonce a 8.5 CS/min, vert pale a 7, jaune a 6.5.
  it("juge le farm sur les quatre bandes du palier", () => {
    expect(farmPre20Banner([game({ cs20: 180 })], PLATINUM)?.text).toBe("Très bon farm en lane");
    expect(farmPre20Banner([game({ cs20: 155 })], PLATINUM)?.text).toBe("Bon farm en lane");
    expect(farmPre20Banner([game({ cs20: 138 })], PLATINUM)?.text).toBe("Manque de farm en lane");
    expect(farmPre20Banner([game({ cs20: 120 })], PLATINUM)?.text).toBe("Gros manque de farm en lane");
  });

  // Choix du 2026-08-17 : le detail parle en CS TOTAUX a 20 min, pas en
  // CS/min — donc le seuil cite subit la meme conversion (7 -> 140). Citer
  // 7 a cote de 120 comparerait deux unites differentes.
  it("annonce la mesure et l'objectif dans la meme unite", () => {
    const detail = farmPre20Banner([game({ cs20: 120 })], PLATINUM)!.detail;
    expect(detail).toBe("120 CS à 20 mins en moyenne — insuffisant pour ton rank, tu dois viser au moins 140");
  });

  // L'objectif cite est le vert PALE, jamais le vert fonce : on donne le
  // niveau attendu au palier, pas l'excellence.
  it("cite le vert pale comme objectif, meme en jaune", () => {
    expect(farmPre20Banner([game({ cs20: 138 })], PLATINUM)?.detail).toContain("au moins 140");
  });

  it("ne cite aucun objectif quand la bande est deja verte", () => {
    expect(farmPre20Banner([game({ cs20: 155 })], PLATINUM)?.detail).toContain("correct pour ton rank");
    expect(farmPre20Banner([game({ cs20: 180 })], PLATINUM)?.detail).toContain("excellent pour ton rank");
  });

  // Un jungler ou un support n'a pas a etre juge sur son CS/min : seules les
  // lanes Top / Mid / Bot entrent dans la moyenne.
  it("exclut les lanes ou le farm n'est pas un indicateur", () => {
    const games = [game({ lane: "Mid", cs20: 180 }), game({ lane: "Jungle", cs20: 20 })];
    // Si la jungle comptait, la moyenne tomberait a 5.0 CS/min donc en rouge.
    expect(farmPre20Banner(games, PLATINUM)?.severity).toBe("great");
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

describe("farmPost20Banner", () => {
  // Le side lane reste en CS/min : c'est un rythme sur une duree variable, un
  // total n'y voudrait rien dire.
  it("reste en CS/min, contrairement a l'avant-20", () => {
    const detail = farmPost20Banner([game({ cs_final: 245 })], PLATINUM)!.detail;
    expect(detail).toBe("6.5 CS/min après 20mins en moyenne — faible pour ton rank, tu dois viser au moins 7");
  });

  // Une game de moins de 25 min n'a pas de valeur apres-20 : elle sort de la
  // moyenne, et s'il n'en reste aucune le bandeau disparait.
  it("ne dit rien quand aucune game ne dure assez", () => {
    expect(farmPost20Banner([game({ game_duration_seconds: 1400 })], PLATINUM)).toBeNull();
  });
});

describe("deathsBanner", () => {
  // Seuils platine : vert fonce sous 1, vert pale sous 2, jaune sous 2.5.
  it("nomme les quatre bandes", () => {
    expect(deathsBanner([game({ deaths10: 0.4 })], PLATINUM)?.text).toBe("Joueur intuable");
    expect(deathsBanner([game({ deaths10: 1.4 })], PLATINUM)?.text).toBe("Joueur safe");
    expect(deathsBanner([game({ deaths10: 2.3 })], PLATINUM)?.text).toBe("Un peu trop de morts");
    expect(deathsBanner([game({ deaths10: 3.5 })], PLATINUM)?.text).toBe("Beaucoup trop de morts");
  });

  // Le jaune etait auparavant masque sur les morts. Depuis le 2026-08-17 il a
  // son propre libelle, donc il DOIT s'afficher.
  it("affiche desormais le jaune", () => {
    expect(deathsBanner([game({ deaths10: 2.3 })], PLATINUM)?.severity).toBe("warn");
  });

  // Sur les morts, progresser c'est DESCENDRE : le verdict doit dire "moins
  // de", jamais "au moins", qui conseillerait l'inverse de l'objectif.
  it("inverse le sens du conseil", () => {
    const detail = deathsBanner([game({ deaths10: 3.5 })], PLATINUM)!.detail;
    expect(detail).toBe("3.5 morts/10mins en moyenne — insuffisant pour ton rank, tu dois viser moins de 2");
    expect(detail).not.toContain("au moins");
  });

  // Le bandeau doit utiliser le rythme PONDERE, comme la couleur de la
  // colonne. Meme game, seule la duree change : a 25 min rien n'est pondere
  // (jaune), a 35 min les morts tardives comptent a moitie et la font passer
  // en vert pale.
  it("juge sur le rythme pondere, pas sur le rythme brut", () => {
    const brut = game({ deaths10: 2.3, deaths: 8, deaths_last5: 4, game_duration_seconds: 1500 });
    expect(deathsBanner([brut], PLATINUM)?.severity).toBe("warn");

    const pondere = game({ deaths10: 2.3, deaths: 8, deaths_last5: 4, game_duration_seconds: 2100 });
    expect(deathsBanner([pondere], PLATINUM)?.severity).toBe("good");
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
    expect(rolesBanner(four)?.severity).toBe("bad");
    expect(rolesBanner(four)?.detail).toContain("4 rôles");
  });

  // Demande de Victor : c'est le constat le plus important, il doit etre en
  // tete meme quand tous les autres bandeaux sont verts.
  it("remonte en tete de liste, devant les bandeaux verts", () => {
    const games = [
      game({ lane: "Mid", cs20: 180 }),
      game({ lane: "Top", cs20: 180 }),
      game({ lane: "Jungle" }),
      game({ lane: "Support" }),
    ];
    expect(performanceBanners(games, PLATINUM, null)[0].id).toBe("roles");
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
    expect(performanceBanners(games, null, null).map((b) => b.id)).toEqual(["roles"]);
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
      "bad"
    );
  });

  // Le pool se compte PAR ROLE, pas sur l'ensemble des games : 3 champions en
  // mid et 3 en top, c'est un joueur concentre sur chacun de ses roles.
  it("compte le pool par role et non sur l'ensemble", () => {
    const games = [
      ...withChampions(["a", "b", "c"], { lane: "Mid" }),
      ...withChampions(["d", "e", "f"], { lane: "Top" }),
    ];
    expect(championPoolBanner(games, PLATINUM)).toBeNull();
  });

  // Le chiffre annonce est celui du role le plus charge — celui qui a
  // declenche — et pas le total tous roles confondus (ici 7).
  it("annonce le pool du role qui a declenche", () => {
    const games = [
      ...withChampions(["a", "b", "c", "d", "e", "f"], { lane: "Top" }),
      ...withChampions(["g"], { lane: "Mid" }),
    ];
    expect(championPoolBanner(games, PLATINUM)?.detail).toBe(
      "Tu as joué 6 champions sur tes 7 dernières parties. Concentres toi sur moins de 5 champions pour progresser"
    );
  });

  it("ignore les games hors SoloQ et n'a rien a dire sans seuils", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(championPoolBanner(withChampions(six, { queue: "Flex" }), PLATINUM)).toBeNull();
    expect(championPoolBanner(withChampions(six), null)).toBeNull();
  });
});

describe("performanceBanners", () => {
  it("rend les bandeaux deja tries du meilleur au rouge, epingles mis a part", () => {
    // Bon farm (vert fonce) + 4 roles (rouge, epingle) sur le meme echantillon.
    const games = [
      game({ lane: "Mid", cs20: 180 }),
      game({ lane: "Top", cs20: 180 }),
      game({ lane: "Jungle" }),
      game({ lane: "Support" }),
    ];
    const banners = performanceBanners(games, PLATINUM, null);
    expect(banners.map((b) => b.severity)).toContain("great");
    expect(banners.map((b) => b.severity)).toContain("bad");

    // Les epingles occupent le debut de la liste, sans exception.
    const premierNonEpingle = banners.findIndex((b) => !b.pinned);
    expect(banners.slice(0, premierNonEpingle).every((b) => b.pinned)).toBe(true);

    // Et la suite reste triee du meilleur au pire.
    const rank = { great: 0, good: 1, warn: 2, bad: 3 };
    const values = banners.slice(premierNonEpingle).map((b) => rank[b.severity]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });


  // Demande de Victor du 2026-08-17 : les stats ne se jugent que dans le role
  // principal. Un mid qui depanne ailleurs ne doit pas voir son farm de mid
  // moyenne avec des games d'un autre role.
  it("ne juge les stats que sur les games du role principal", () => {
    // Le contraste se fait avec TOP, pas avec la jungle : la jungle n'est pas
    // une lane de farm (cf. FARM_LANES), elle serait donc deja ecartee du
    // bandeau de farm sans que le filtre de role y soit pour quoi que ce soit.
    // Le test ne prouverait alors rien.
    const games = [
      // Deux games de mid impeccables.
      game({ lane: "Mid", cs20: 180 }),
      game({ lane: "Mid", cs20: 180 }),
      // Et six games de top catastrophiques, qui ne doivent PAS compter.
      ...Array.from({ length: 6 }, () => game({ lane: "Top", cs20: 20 })),
    ];

    const farmMid = performanceBanners(games, PLATINUM, "mid").find((b) => b.id === "farm-pre20");
    const farmTous = performanceBanners(games, PLATINUM, null).find((b) => b.id === "farm-pre20");

    // Filtre sur mid : le verdict reste au vert le plus haut.
    expect(farmMid?.severity).toBe("great");
    // Sans filtre, les games de jungle tirent la moyenne vers le bas — c'est
    // exactement le melange que le filtre supprime.
    expect(farmTous?.severity).toBe("bad");
  });

  // Ces deux-la echappent au filtre, et ce n'est pas un oubli : "trop de roles"
  // compte justement les roles, et le pool a besoin de voir les autres roles
  // pour designer le plus charge.
  it("laisse les bandeaux roles et champions voir tous les roles", () => {
    const games = [
      game({ lane: "Mid" }),
      game({ lane: "Top" }),
      game({ lane: "Jungle" }),
      game({ lane: "Support" }),
    ];

    // Filtre sur mid : si "roles" etait filtre lui aussi, il ne verrait qu'un
    // seul role et ne pourrait plus jamais se declencher.
    expect(performanceBanners(games, PLATINUM, "mid").map((b) => b.id)).toContain("roles");
  });

  // Un joueur dont l'echantillon ne contient aucune game du role principal :
  // pas de bandeau de stats, plutot que les stats d'un autre role sous une
  // etiquette fausse.
  it("ne rend aucun bandeau de stats quand le role principal est absent", () => {
    // Encore une fois du TOP et non de la jungle : il faut des games qui
    // DONNERAIENT un bandeau de farm sans le filtre, sinon leur absence ne
    // prouve rien.
    const games = [game({ lane: "Top" }), game({ lane: "Top" })];

    expect(performanceBanners(games, PLATINUM, null).map((b) => b.id)).toContain("farm-pre20");

    const ids = performanceBanners(games, PLATINUM, "mid").map((b) => b.id);
    expect(ids).not.toContain("farm-pre20");
    expect(ids).not.toContain("deaths");
  });

  it("ne rend aucun bandeau dependant du palier sans seuils", () => {
    expect(performanceBanners([game()], null, null)).toEqual([]);
  });
});
