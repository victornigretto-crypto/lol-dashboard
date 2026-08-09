import type { MatchDto, MatchParticipant, MatchTimelineDto } from "./client";

// Parse "Pseudo#TAG" en ses deux parties. Le tag est tout ce qui suit le
// DERNIER "#" (un gameName peut lui-même contenir des "#").
export function parseRiotId(raw: string): { gameName: string; tagLine: string } | null {
  const trimmed = raw.trim();
  const hashIndex = trimmed.lastIndexOf("#");
  if (hashIndex <= 0 || hashIndex === trimmed.length - 1) return null;
  return { gameName: trimmed.slice(0, hashIndex), tagLine: trimmed.slice(hashIndex + 1) };
}

// On n'affiche jamais l'ARAM ni les autres modes annexes : uniquement les
// files "vraie game" (Normal Draft, SoloQ, Flex).
export const QUEUE_NORMAL = 400;
export const QUEUE_SOLOQ = 420;
export const QUEUE_FLEX = 440;
export const ALLOWED_QUEUE_IDS = new Set([QUEUE_NORMAL, QUEUE_SOLOQ, QUEUE_FLEX]);

const QUEUE_LABELS: Record<number, string> = {
  [QUEUE_NORMAL]: "Normal",
  [QUEUE_SOLOQ]: "SoloQ",
  [QUEUE_FLEX]: "Flex",
};

export function queueLabel(queueId: number): string {
  return QUEUE_LABELS[queueId] ?? "Autre";
}

export function isAllowedQueue(queueId: number): boolean {
  return ALLOWED_QUEUE_IDS.has(queueId);
}

const LANE_LABELS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
};

export function laneLabel(participant: MatchParticipant): string {
  const position = participant.teamPosition || participant.individualPosition;
  return LANE_LABELS[position] ?? position ?? "";
}

export function findOpponent(match: MatchDto, participant: MatchParticipant): MatchParticipant | undefined {
  const position = participant.teamPosition || participant.individualPosition;
  if (!position) return undefined;
  return match.info.participants.find(
    (p) => p.teamId !== participant.teamId && (p.teamPosition || p.individualPosition) === position
  );
}

// CS au dernier frame disponible <= `minute` (les frames sont espacés d'~1min).
export function csAtMinute(timeline: MatchTimelineDto, participantId: number, minute: number): number {
  const targetMs = minute * 60 * 1000;
  const frames = timeline.info.frames;
  let chosen = frames[0];
  for (const frame of frames) {
    if (frame.timestamp <= targetMs) chosen = frame;
    else break;
  }
  const pf = chosen?.participantFrames[String(participantId)];
  return (pf?.minionsKilled ?? 0) + (pf?.jungleMinionsKilled ?? 0);
}

// Morts ramenées à un rythme "par 10 minutes de jeu", cohérent avec l'échelle
// utilisée dans la colonne "Mort/10m" du tableau (valeurs décimales, pas
// juste un décompte des 10 premières minutes).
export function deathsPer10Min(deaths: number, gameDurationSeconds: number): number {
  if (gameDurationSeconds <= 0) return 0;
  const value = (deaths * 600) / gameDurationSeconds;
  return Math.round(value * 10) / 10;
}

// CS total en fin de game : déjà présent dans la réponse Match-V5 qu'on
// récupère de toute façon (aucun appel API supplémentaire).
export function totalCs(participant: MatchParticipant): number {
  return participant.totalMinionsKilled + participant.neutralMinionsKilled;
}

export function csPerMin(cs: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.round((cs / minutes) * 10) / 10;
}
