import { describe, expect, it } from "vitest";
import {
  EARLIEST_GAME_ISO,
  MIN_DURATION_SECONDS,
  SAMPLE_SIZE,
  sampleForAnalysis,
} from "./sample";

// Une game réduite à ce que la sélection regarde : sa date et sa durée. La
// durée par défaut est une vraie partie, pour que les tests de date n'aient pas
// à s'en soucier.
function game(
  played_at: string | null,
  id = played_at ?? "sans-date",
  game_duration_seconds: number | null = 1800
) {
  return { id, played_at, game_duration_seconds };
}

// Décalage en jours par rapport au plancher, pour écrire des dates lisibles
// sans dépendre de la date du jour (un test qui vieillit est un test qui
// finira par échouer tout seul).
function apresPlancher(jours: number): string {
  return new Date(Date.parse(EARLIEST_GAME_ISO) + jours * 86_400_000).toISOString();
}

describe("sampleForAnalysis", () => {
  it("garde les 20 plus récentes quand il y en a davantage", () => {
    const games = Array.from({ length: 30 }, (_, i) => game(apresPlancher(i + 1)));
    const retenues = sampleForAnalysis(games);

    expect(retenues).toHaveLength(SAMPLE_SIZE);
    // La plus récente des 30 est en tête, la 20e en queue : on coupe par le bas.
    expect(retenues[0].played_at).toBe(apresPlancher(30));
    expect(retenues[SAMPLE_SIZE - 1].played_at).toBe(apresPlancher(11));
  });

  it("remonte au-delà de deux mois pour compléter l'échantillon", () => {
    // Le cas de Victor : 2 parties récentes, 12 bien plus anciennes. L'ancienne
    // règle n'en analysait que 2 ; on veut les 14.
    const recentes = [game(apresPlancher(200)), game(apresPlancher(201))];
    const anciennes = Array.from({ length: 12 }, (_, i) => game(apresPlancher(i + 1)));

    expect(sampleForAnalysis([...recentes, ...anciennes])).toHaveLength(14);
  });

  it("écarte tout ce qui précède le plancher", () => {
    const avant = new Date(Date.parse(EARLIEST_GAME_ISO) - 86_400_000).toISOString();
    const retenues = sampleForAnalysis([game(avant), game(apresPlancher(1))]);

    expect(retenues.map((g) => g.played_at)).toEqual([apresPlancher(1)]);
  });

  it("garde une partie tombant exactement sur le plancher", () => {
    // La borne est inclusive : le 18 janvier lui-même compte.
    expect(sampleForAnalysis([game(EARLIEST_GAME_ISO)])).toHaveLength(1);
  });

  it("trie avant de couper, même si l'entrée est dans le désordre", () => {
    // Une liste mal triée découpée telle quelle jetterait des parties récentes
    // en gardant des vieilles — c'est précisément ce que ce tri empêche.
    const desordre = [game(apresPlancher(5)), game(apresPlancher(50)), game(apresPlancher(20))];

    expect(sampleForAnalysis(desordre).map((g) => g.played_at)).toEqual([
      apresPlancher(50),
      apresPlancher(20),
      apresPlancher(5),
    ]);
  });

  it("écarte les parties sans date et celles dont la date est illisible", () => {
    const games = [game(null), game("pas une date"), game(apresPlancher(3))];

    expect(sampleForAnalysis(games)).toHaveLength(1);
  });

  it("ne modifie pas le tableau qu'on lui passe", () => {
    // L'appelant affiche souvent la liste complète à côté : la trier dans son
    // dos changerait son affichage sans prévenir.
    const games = [game(apresPlancher(1)), game(apresPlancher(9))];
    const avant = games.map((g) => g.id);

    sampleForAnalysis(games);

    expect(games.map((g) => g.id)).toEqual(avant);
  });


  // Demande de Victor du 2026-08-18 : une partie de moins de 5 minutes est un
  // remake, elle ne compte pour rien nulle part.
  it("écarte les parties de moins de cinq minutes", () => {
    const games = [
      game(apresPlancher(3), "remake", MIN_DURATION_SECONDS - 1),
      game(apresPlancher(2), "vraie", MIN_DURATION_SECONDS),
    ];

    expect(sampleForAnalysis(games).map((g) => g.id)).toEqual(["vraie"]);
  });

  it("garde une partie qui dure exactement cinq minutes", () => {
    // La borne est stricte : « moins de 5 minutes » exclut 4:59, pas 5:00.
    expect(sampleForAnalysis([game(apresPlancher(1), "pile", MIN_DURATION_SECONDS)])).toHaveLength(1);
  });

  it("écarte les parties dont la durée est inconnue", () => {
    expect(sampleForAnalysis([game(apresPlancher(1), "sans-duree", null)])).toEqual([]);
  });

  // « Ne compter pour rien » va jusqu'à ne pas occuper de place : un remake ne
  // doit pas voler un des 20 créneaux à une vraie partie.
  it("ne laisse pas un remake consommer une place de l'échantillon", () => {
    const remakes = Array.from({ length: 5 }, (_, i) =>
      game(apresPlancher(100 + i), `remake-${i}`, 120)
    );
    const vraies = Array.from({ length: SAMPLE_SIZE }, (_, i) => game(apresPlancher(i + 1), `vraie-${i}`));

    const retenues = sampleForAnalysis([...remakes, ...vraies]);

    expect(retenues).toHaveLength(SAMPLE_SIZE);
    expect(retenues.every((g) => g.id.startsWith("vraie"))).toBe(true);
  });

  it("rend une liste vide sans broncher", () => {
    expect(sampleForAnalysis([])).toEqual([]);
  });
});
