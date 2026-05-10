export type VisibleSessionTabId = "treino" | "relatório";
export type SessionScreenTabId = VisibleSessionTabId | "scouting";

export const isScoutingModuleSession = (tab?: string, source?: string) =>
  tab === "scouting" && source === "scouting_module";

export const shouldRedirectLegacyScoutingTab = (tab?: string, source?: string) =>
  tab === "scouting" && source !== "scouting_module";

export const buildScoutingNewRouteParams = (params: {
  classId: string;
  date: string;
  type?: "training" | "game";
  source?: "session" | "class" | "scouting";
}) => ({
  id: params.classId,
  date: params.date,
  type: params.type ?? "training",
  source: params.source ?? "session",
});
