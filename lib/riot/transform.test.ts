import { describe, expect, it } from "vitest";
import type { MatchTimelineDto } from "@/lib/riot/client";
import {
  csAtMinute,
  csPerMin,
  deathsInLastMinutes,
  deathsPer10Min,
  formatDuration,
  isAllowedQueue,
  parseRiotId,
  queueLabel,
} from "@/lib/riot/transform";

describe("parseRiotId", () => {
  it("separe sur le DERNIER # — un pseudo peut en contenir", () => {
    expect(parseRiotId("Chopin Opus 52#1849")).toEqual({
      gameName: "Chopin Opus 52",
      tagLine: "1849",
    });
    expect(parseRiotId("a#b#c")).toEqual({ gameName: "a#b", tagLine: "c" });
  });

  it("tolere les espaces autour", () => {
    expect(parseRiotId("  Pseudo#EUW  ")).toEqual({ gameName: "Pseudo", tagLine: "EUW" });
  });

  it("refuse ce qui n'est pas un Riot ID complet", () => {
    expect(parseRiotId("sansdiese")).toBeNull();
    expect(parseRiotId("#tagseul")).toBeNull();
    expect(parseRiotId("pseudosanstag#")).toBeNull();
    expect(parseRiotId("")).toBeNull();
  });
});

describe("files de jeu", () => {
  // On n'affiche jamais l'ARAM ni les modes annexes.
  it("n'autorise que Normal, SoloQ et Flex", () => {
    expect(isAllowedQueue(400)).toBe(true);
    expect(isAllowedQueue(420)).toBe(true);
    expect(isAllowedQueue(440)).toBe(true);
    expect(isAllowedQueue(450)).toBe(false); // ARAM
  });

  it("nomme les files connues", () => {
    expect(queueLabel(400)).toBe("Normal");
    expect(queueLabel(420)).toBe("SoloQ");
    expect(queueLabel(440)).toBe("Flex");
    expect(queueLabel(450)).toBe("Autre");
  });
});

describe("csPerMin / deathsPer10Min", () => {
  it("arrondit a une decimale", () => {
    expect(csPerMin(160, 20)).toBe(8);
    expect(csPerMin(113, 15.4)).toBe(7.3);
  });

  it("rend 0 sur une duree nulle plutot qu'un infini", () => {
    expect(csPerMin(160, 0)).toBe(0);
    expect(deathsPer10Min(2, 0)).toBe(0);
  });

  // Valeur relevee sur une vraie partie mise en cache le 2026-08-16 :
  // 2 morts en 1763 s -> 0.7 morts/10 min.
  it("ramene les morts a un rythme par 10 minutes", () => {
    expect(deathsPer10Min(2, 1763)).toBe(0.7);
    expect(deathsPer10Min(6, 1800)).toBe(2);
  });
});

describe("formatDuration", () => {
  it("formate en mm:ss", () => {
    expect(formatDuration(1763)).toBe("29:23");
    expect(formatDuration(2090)).toBe("34:50");
    expect(formatDuration(600)).toBe("10:00");
  });

  it("rend une chaine vide sans duree exploitable", () => {
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(0)).toBe("");
  });

  it("normalise une duree donnee en millisecondes", () => {
    expect(formatDuration(1_800_000)).toBe("30:00");
  });
});

// Timeline minimale : un frame par minute, avec le CS cumule du participant 1.
const timeline = (
  frames: { minute: number; cs?: number; events?: MatchTimelineDto["info"]["frames"][number]["events"] }[]
): MatchTimelineDto => ({
  info: {
    frames: frames.map((f) => ({
      timestamp: f.minute * 60_000,
      participantFrames: {
        "1": { minionsKilled: f.cs ?? 0, jungleMinionsKilled: 0 },
      },
      events: f.events,
    })),
  },
});

describe("csAtMinute", () => {
  it("prend le dernier frame anterieur ou egal a la minute visee", () => {
    const t = timeline([
      { minute: 0, cs: 0 },
      { minute: 10, cs: 80 },
      { minute: 20, cs: 160 },
      { minute: 21, cs: 175 },
    ]);
    expect(csAtMinute(t, 1, 20)).toBe(160);
    expect(csAtMinute(t, 1, 15)).toBe(80);
  });

  it("additionne sbires et monstres neutres", () => {
    const t: MatchTimelineDto = {
      info: {
        frames: [
          {
            timestamp: 0,
            participantFrames: { "1": { minionsKilled: 100, jungleMinionsKilled: 40 } },
          },
        ],
      },
    };
    expect(csAtMinute(t, 1, 20)).toBe(140);
  });

  it("rend 0 pour un participant absent du frame", () => {
    expect(csAtMinute(timeline([{ minute: 0, cs: 80 }]), 9, 20)).toBe(0);
  });
});

describe("deathsInLastMinutes", () => {
  // C'est la source des morts tardives : le Match-V5 ne donne qu'un total,
  // seule la timeline dit QUAND on est mort.
  const kills = timeline([
    {
      minute: 0,
      events: [
        { type: "CHAMPION_KILL", timestamp: 25 * 60_000, victimId: 1 }, // avant la fenetre
        { type: "CHAMPION_KILL", timestamp: 31 * 60_000, victimId: 1 }, // dedans
        { type: "CHAMPION_KILL", timestamp: 33 * 60_000, victimId: 1 }, // dedans
        { type: "CHAMPION_KILL", timestamp: 32 * 60_000, victimId: 2 }, // autre joueur
        { type: "BUILDING_KILL", timestamp: 34 * 60_000, victimId: 1 }, // pas une mort
      ],
    },
  ]);

  it("ne compte que les morts du joueur dans la fenetre de fin", () => {
    // Partie de 35 min, fenetre de 5 min -> tout ce qui suit la 30e minute.
    expect(deathsInLastMinutes(kills, 1, 2100, 5)).toBe(2);
  });

  it("compte 0 quand la partie est plus courte que la fenetre", () => {
    expect(deathsInLastMinutes(kills, 1, 200, 5)).toBe(0);
  });

  it("accepte une duree donnee en millisecondes", () => {
    expect(deathsInLastMinutes(kills, 1, 2_100_000, 5)).toBe(2);
  });
});
