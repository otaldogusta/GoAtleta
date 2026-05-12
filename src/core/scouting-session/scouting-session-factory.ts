import type {
  CreateScoutingSessionDraftInput,
  ScoutingSession,
  ScoutingSessionStatus,
  ScoutingSessionType,
} from "./types";

const buildId = () => `scouting_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const cleanOptional = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
};

export const buildScoutingSessionTitle = (input: {
  type: ScoutingSessionType;
  opponent?: string;
  title?: string;
}) => {
  const explicitTitle = input.title?.trim();
  if (explicitTitle) return explicitTitle;
  const opponent = cleanOptional(input.opponent);
  if (input.type === "training") return "Scouting de treino";
  if (input.type === "friendly") {
    return opponent ? `Amistoso vs ${opponent}` : "Scouting de amistoso";
  }
  return opponent ? `Jogo vs ${opponent}` : "Scouting de jogo";
};

const withStatus = (
  session: ScoutingSession,
  currentAllowed: ScoutingSessionStatus[],
  nextStatus: ScoutingSessionStatus
): ScoutingSession => {
  if (!currentAllowed.includes(session.status)) return session;
  const now = new Date().toISOString();
  return {
    ...session,
    status: nextStatus,
    updatedAt: now,
  };
};

export const createScoutingSessionDraft = (
  input: CreateScoutingSessionDraftInput
): ScoutingSession => {
  const now = new Date().toISOString();
  return {
    id: buildId(),
    classId: input.classId,
    date: input.date,
    type: input.type,
    title: buildScoutingSessionTitle(input),
    opponent: cleanOptional(input.opponent),
    location: cleanOptional(input.location),
    videoUrl: cleanOptional(input.videoUrl),
    sourceType: input.sourceType,
    videoClipType: cleanOptional(input.videoClipType),
    videoNotes: cleanOptional(input.videoNotes),
    status: "draft",
    source: input.source,
    relatedEventId: cleanOptional(input.relatedEventId),
    createdAt: now,
    updatedAt: now,
  };
};

export const startScoutingSession = (session: ScoutingSession) =>
  withStatus(session, ["draft"], "in_progress");

export const completeScoutingSession = (session: ScoutingSession) =>
  withStatus(session, ["draft", "in_progress"], "completed");

export const archiveScoutingSession = (session: ScoutingSession) =>
  session.status === "archived" ? session : withStatus(session, ["draft", "in_progress", "completed"], "archived");
