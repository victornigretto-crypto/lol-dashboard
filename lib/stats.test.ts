import { describe, expect, it } from "vitest";
import {
  alertClass,
  averageCsPerMin,
  bandClass,
  csBand,
  csMetrics,
  deathsBand,
  durationMinutes,
  explainsDeaths,
  highlightClass,
  highlightFieldClass,
  weightedDeaths10,
  type CsSource,
  type DeathsSource,
} from "@/lib/stats";
import { getContent, type StatThreshold } from "@/lib/content";

const cs = (cs20: number | null, cs_final: number | null, seconds: number | null): CsSource => ({
  cs20,
  cs_final,
  game_duration_seconds: seconds,
});

const deaths = (
  deaths10: number,
  total: number | null,
  last5: number | null,
  seconds: number | null
): DeathsSource => ({
  deaths10,
  deaths: total,
  deaths_last5: last5,
  game_duration_seconds: seconds,
});

describe("durationMinutes", () => {
  it("rend null pour une duree absente ou nulle", () => {
    expect(durationMinutes(null)).toBeNull();
    expect(durationMinutes(0)).toBeNull();
    expect(durationMinutes(-10)).toBeNull();
  });

  it("convertit des secondes en minutes", () => {
    expect(durationMinutes(1800)).toBe(30);
    expect(durationMinutes(1763)).toBeCloseTo(29.383, 3);
  });

  // Quelques vieux matchs Riot renvoient gameDuration en millisecondes ; une
  // partie de plus de ~2h47 (10000 s) etant impossible, au-dela c'est des ms.
  it("detecte une duree donnee en millisecondes", () => {
    expect(durationMinutes(1_800_000)).toBe(30);
    expect(durationMinutes(10_000)).toBeCloseTo(166.67, 2);
  });
});

describe("csMetrics — CS/min avant 20 min", () => {
  // Le bug corrige le 2026-08-10 : diviser TOUJOURS par 20 sous-estimait le
  // farm des games courtes. Les trois valeurs ci-dessous sont celles mesurees
  // ce jour-la sur de vraies parties.
  it("divise par la duree reelle quand la game dure moins de 20 min", () => {
    expect(csMetrics(cs(113, null, 924)).perMinPre20).toBe(7.3); // 15,4 min
    expect(csMetrics(cs(141, null, 930)).perMinPre20).toBe(9.1); // 15,5 min
    expect(csMetrics(cs(163, null, 1134)).perMinPre20).toBe(8.6); // 18,9 min
  });

  it("divise par la fenetre pleine de 20 min des que la game les depasse", () => {
    expect(csMetrics(cs(160, null, 1800)).perMinPre20).toBe(8);
    expect(csMetrics(cs(160, null, 1200)).perMinPre20).toBe(8);
  });

  // Garde-fou : sans duree connue (games importees avant la colonne), on garde
  // le comportement d'avant plutot que de deviner.
  it("garde la fenetre de 20 min quand la duree est inconnue", () => {
    expect(csMetrics(cs(150, null, null)).perMinPre20).toBe(7.5);
  });

  it("rend null sans cs20", () => {
    expect(csMetrics(cs(null, 250, 1800)).perMinPre20).toBeNull();
  });
});

describe("csMetrics — CS/min apres 20 min", () => {
  it("calcule sur le temps ecoule au-dela de 20 min", () => {
    expect(csMetrics(cs(160, 250, 1800)).perMinPost20).toBe(9); // 90 CS en 10 min
  });

  // Sous 25 min, l'apres-20 reposerait sur quelques minutes a peine : on
  // n'affiche rien plutot qu'une valeur qui varie du simple au double.
  it("rend null sous 25 min de partie, et calcule a partir de 25 min pile", () => {
    expect(csMetrics(cs(160, 200, 1440)).perMinPost20).toBeNull(); // 24 min
    expect(csMetrics(cs(160, 200, 1500)).perMinPost20).toBe(8); // 25 min pile
  });

  it("rend null s'il manque un fait brut", () => {
    expect(csMetrics(cs(160, null, 1800)).perMinPost20).toBeNull();
    expect(csMetrics(cs(null, 250, 1800)).perMinPost20).toBeNull();
    expect(csMetrics(cs(160, 250, null)).perMinPost20).toBeNull();
  });
});

describe("weightedDeaths10 — ponderation des morts de fin de partie", () => {
  // Au-dela de 30 min, une mort dans les 5 dernieres minutes ne compte qu'a
  // moitie POUR LA COULEUR. Le compteur affiche (deaths10) ne bouge pas.
  it("ponderee a moitie au-dela de 30 min", () => {
    // 8 morts dont 2 tardives sur 35 min -> (8 - 1) * 10 / 35 = 2.0
    expect(weightedDeaths10(deaths(2.3, 8, 2, 2100))).toBe(2);
    // 6 morts dont 2 tardives sur 31 min -> (6 - 1) * 10 / 31 = 1.6
    expect(weightedDeaths10(deaths(1.9, 6, 2, 1860))).toBe(1.6);
  });

  it("ne pondere pas a 30 min pile ni en dessous", () => {
    expect(weightedDeaths10(deaths(2.3, 8, 2, 1800))).toBe(2.3);
    expect(weightedDeaths10(deaths(2.3, 8, 2, 1500))).toBe(2.3);
  });

  // Sans les faits bruts (games importees avant les colonnes), on retombe sur
  // le rythme brut : meme comportement qu'avant, zero regression.
  it("retombe sur le rythme brut sans faits bruts", () => {
    expect(weightedDeaths10(deaths(2.3, null, 2, 2100))).toBe(2.3);
    expect(weightedDeaths10(deaths(2.3, 8, null, 2100))).toBe(2.3);
    expect(weightedDeaths10(deaths(2.3, 8, 2, null))).toBe(2.3);
  });

  it("n'a aucun effet quand aucune mort n'est tardive", () => {
    // 7 morts, aucune tardive, 35 min -> 7 * 10 / 35 = 2.0
    expect(weightedDeaths10(deaths(2, 7, 0, 2100))).toBe(2);
  });
});

describe("explainsDeaths — condition du pointille", () => {
  // Le pointille exige que la ponderation ait REELLEMENT eu lieu, sinon il
  // annoncerait un calcul qui n'a pas ete fait.
  it("vrai au-dela de 34 min avec les faits bruts", () => {
    expect(explainsDeaths(deaths(2.3, 8, 2, 2090))).toBe(true); // 34:50
  });

  it("faux a 34 min pile — la comparaison est stricte", () => {
    expect(explainsDeaths(deaths(2.3, 8, 2, 2040))).toBe(false);
  });

  it("faux sans les faits bruts, meme sur une longue partie", () => {
    expect(explainsDeaths(deaths(2.3, null, null, 2400))).toBe(false);
    expect(explainsDeaths(deaths(2.3, 8, null, 2400))).toBe(false);
  });
});

describe("averageCsPerMin", () => {
  it("ignore les valeurs non calculables", () => {
    expect(averageCsPerMin([7, 8, null])).toBe(7.5);
  });

  it("rend null si rien n'est calculable", () => {
    expect(averageCsPerMin([])).toBeNull();
    expect(averageCsPerMin([null, null])).toBeNull();
  });

  it("arrondit a une decimale", () => {
    expect(averageCsPerMin([1, 1, 2])).toBe(1.3);
  });
});

describe("csBand / deathsBand — sens de comparaison", () => {
  // Les seuils platine, tels que recalibres par Victor.
  const farm: StatThreshold = { great: 8.5, good: 7, warn: 6.5 };
  const morts: StatThreshold = { great: 1, good: 2, warn: 2.5 };

  // Farm : plus grand = mieux. Les bornes sont inclusives du cote favorable —
  // etre PILE au seuil, c'est l'avoir atteint.
  it("farm — les quatre bandes, bornes inclusives", () => {
    expect(csBand(8.5, farm)).toBe("great");
    expect(csBand(8.4, farm)).toBe("good");
    expect(csBand(7, farm)).toBe("good");
    expect(csBand(6.9, farm)).toBe("warn");
    expect(csBand(6.5, farm)).toBe("warn");
    expect(csBand(6.4, farm)).toBe("bad");
  });

  // Morts : logique inversee, plus petit = mieux. Le vert fonce est en BAS.
  it("morts — logique inversee sur les quatre bandes", () => {
    expect(deathsBand(1, morts)).toBe("great");
    expect(deathsBand(1.1, morts)).toBe("good");
    expect(deathsBand(2, morts)).toBe("good");
    expect(deathsBand(2.1, morts)).toBe("warn");
    expect(deathsBand(2.5, morts)).toBe("warn");
    expect(deathsBand(2.6, morts)).toBe("bad");
  });

  // Le vert pale et le vert fonce doivent rester deux couleurs distinctes :
  // les confondre annulerait la demande du 2026-08-17.
  it("donne deux fonds differents aux deux verts", () => {
    expect(bandClass("great")).not.toBe(bandClass("good"));
    expect(bandClass("great")).toContain("green");
    expect(bandClass("good")).toContain("green");
  });

  // Choix structurant : seuils ou valeur inconnus -> on ne dit rien plutot que
  // de dire faux.
  it("inconnu quand la valeur ou les seuils manquent", () => {
    expect(csBand(null, farm)).toBe("unknown");
    expect(csBand(8, null)).toBe("unknown");
    expect(deathsBand(null, morts)).toBe("unknown");
    expect(deathsBand(1, null)).toBe("unknown");
  });
});

// Deux signaux, portes par le meme clignotement mais pas au meme endroit :
// l'en-tete dit ce que le palier doit travailler, la cellule dit que CETTE
// valeur pose probleme.
describe("clignotement", () => {
  const iron = getContent("mid", "iron"); // surveille les 3 stats
  const platinum = getContent("mid", "platinum"); // ne surveille que csPost20

  // Le croisement est la regle : palier ET rouge. C'est le cas rapporte par
  // Victor le 2026-08-16 — en platine, seul le CS apres 20 min doit alerter,
  // meme si les deux autres cases sont rouges.
  it("exige a la fois le palier ET le rouge", () => {
    expect(alertClass(iron, "csPre20", "bad")).not.toBe("");
    expect(alertClass(platinum, "csPost20", "bad")).not.toBe("");
  });

  it("reste muet sur une stat rouge que le palier ne surveille pas", () => {
    expect(alertClass(platinum, "csPre20", "bad")).toBe("");
    expect(alertClass(platinum, "deaths10", "bad")).toBe("");
  });

  it("reste muet sur une stat surveillee mais pas rouge", () => {
    expect(alertClass(iron, "csPre20", "warn")).toBe("");
    expect(alertClass(iron, "csPre20", "good")).toBe("");
    expect(alertClass(iron, "csPre20", "great")).toBe("");
  });

  // On n'alerte pas sur ce qu'on ne sait pas juger : sans seuils de palier, la
  // case est grise et doit rester muette.
  it("une valeur non jugeable ne clignote jamais", () => {
    expect(alertClass(iron, "csPre20", "unknown")).toBe("");
    expect(alertClass(iron, "csPre20", csBand(4, null))).toBe("");
    expect(alertClass(iron, "csPre20", csBand(null, { great: 9, good: 8, warn: 6 }))).toBe("");
  });

  // Emeraude ne surveille aucune stat : aucune cellule chiffree ne doit
  // clignoter, quelle que soit la valeur.
  it("ne clignote nulle part quand le palier ne surveille aucune stat", () => {
    const emerald = getContent("mid", "emerald");
    for (const stat of ["csPre20", "csPost20", "deaths10"] as const) {
      expect(alertClass(emerald, stat, "bad"), stat).toBe("");
    }
  });

  it("l'en-tete clignote selon le palier, independamment de toute valeur", () => {
    expect(highlightClass(iron, "csPre20")).not.toBe("");
    expect(highlightFieldClass(iron, "lane")).toBe("");

    expect(highlightClass(platinum, "csPost20")).not.toBe("");
    expect(highlightClass(platinum, "csPre20")).toBe("");
    expect(highlightFieldClass(platinum, "lane")).not.toBe("");
    expect(highlightFieldClass(platinum, "macro")).not.toBe("");
    expect(highlightFieldClass(platinum, "fight")).toBe("");
  });

  // Deux signaux differents, donc deux rendus differents (demande de Victor du
  // 2026-08-16) : l'en-tete porte un contour FIXE, seule la cellule clignote.
  // Les faire se ressembler noierait l'alerte au milieu d'en-tetes agites.
  it("distingue le contour fixe de l'en-tete du clignotement de la cellule", () => {
    const entete = highlightClass(iron, "csPre20");
    const cellule = alertClass(iron, "csPre20", "bad");

    expect(entete).not.toBe("");
    expect(cellule).not.toBe("");
    expect(entete).not.toBe(cellule);

    // Aucun en-tete ne doit porter d'animation, ni cote stat ni cote champ.
    expect(entete).not.toContain("animate");
    expect(highlightFieldClass(platinum, "lane")).not.toContain("animate");
    expect(cellule).toContain("animate");
  });

  // Les deux en-tetes (stat et champ) partagent le meme contour : rien ne
  // justifierait qu'une colonne chiffree et une colonne de question se
  // signalent differemment.
  it("emploie le meme contour pour les en-tetes de stat et de champ", () => {
    expect(highlightClass(platinum, "csPost20")).toBe(highlightFieldClass(platinum, "lane"));
  });
});
