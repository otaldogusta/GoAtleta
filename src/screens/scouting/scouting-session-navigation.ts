import type { CreateScoutingSessionDraftInput, ScoutingSession } from "../../core/scouting-session";

export type NewScoutingUiType = "treino" | "amistoso" | "jogo";

export const mapUiTypeToScoutingSessionType = (type: NewScoutingUiType) =>
  type === "treino" ? "training" : type === "amistoso" ? "friendly" : "official_match";

export const mapUiTypeToLegacyScoutingMode = (type: NewScoutingUiType) =>
  type === "treino" ? "treino" : "jogo";

export const buildScoutingSessionDraftInput = (params: {
  classId: string;
  date: string;
  uiType: NewScoutingUiType;
  opponent?: string;
  source: "manual" | "session" | "event";
}) => {
  const input: CreateScoutingSessionDraftInput = {
    classId: params.classId,
    date: params.date,
    type: mapUiTypeToScoutingSessionType(params.uiType),
    opponent: params.opponent,
    source: params.source,
  };
  return input;
};

export const buildScoutingSessionRoute = (params: {
  classId: string;
  scoutingSessionId: string;
}) => ({
  pathname: "/class/[id]/scouting/[scoutingSessionId]" as const,
  params: {
    id: params.classId,
    scoutingSessionId: params.scoutingSessionId,
  },
});

export const buildLegacyScoutingRoute = (params: {
  classId: string;
  session: ScoutingSession;
}) => ({
  pathname: "/class/[id]/session" as const,
  params: {
    id: params.classId,
    tab: "scouting",
    source: "scouting_module",
    date: params.session.date,
    scoutingMode: params.session.type === "training" ? "treino" : "jogo",
    scoutingSessionId: params.session.id,
    opponent: params.session.opponent,
  },
});
