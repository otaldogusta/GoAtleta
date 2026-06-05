// ---------------------------------------------------------------------------
// Scouting sessions + actions domain module
// ---------------------------------------------------------------------------

import type {
  ScoutingAction,
  ScoutingActionFundamental,
  ScoutingActionPhase,
  ScoutingSession,
  ScoutingSessionStatus,
  ScoutingSessionType,
} from "../core/models";
import {
  aggregateScoutingActionsToCounts,
  buildLogFromCounts,
  createEmptyCounts,
  getScoutingResultOption,
} from "../core/scouting";
import {
  getActiveOrganizationId,
  isAuthError,
  isMissingRelation,
  isNetworkError,
  supabaseDelete,
  supabaseGet,
  supabasePatch,
  supabasePost,
} from "./client";
import { saveScoutingLog } from "./session";
import type { ScoutingActionRow, ScoutingSessionRow } from "./row-types";

export type ScoutingSessionDetail = {
  session: ScoutingSession;
  actions: ScoutingAction[];
};

type CreateScoutingSessionInput = {
  classId: string;
  organizationId?: string | null;
  type: ScoutingSessionType;
  date: string;
  title?: string | null;
  opponent?: string | null;
  initialNote?: string | null;
};

type AddScoutingActionInput = {
  sessionId: string;
  studentId?: string | null;
  athleteName?: string | null;
  fundamental: ScoutingActionFundamental;
  phase: ScoutingActionPhase;
  resultKey: string;
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "").trim();

const normalizeSessionType = (value: string | null | undefined): ScoutingSessionType =>
  value === "jogo" || value === "amistoso" ? value : "treino";

const normalizeSessionStatus = (
  value: string | null | undefined
): ScoutingSessionStatus => (value === "concluido" ? "concluido" : "em_andamento");

const scoutingSessionRowToModel = (row: ScoutingSessionRow): ScoutingSession => ({
  id: row.id,
  organizationId: row.organization_id ?? "",
  classId: row.classid,
  type: normalizeSessionType(row.type),
  date: row.date,
  title: row.title?.trim() || buildScoutingSessionTitle(normalizeSessionType(row.type), row.opponent),
  opponent: row.opponent ?? null,
  initialNote: row.initial_note ?? null,
  status: normalizeSessionStatus(row.status),
  createdAt: row.createdat,
  updatedAt: row.updatedat ?? row.createdat,
  completedAt: row.completed_at ?? null,
});

const normalizeFundamental = (
  value: string | null | undefined
): ScoutingActionFundamental => {
  const normalized = normalizeText(value) as ScoutingActionFundamental;
  const allowed: ScoutingActionFundamental[] = [
    "saque",
    "recepcao",
    "levantamento",
    "ataque",
    "bloqueio",
    "defesa",
    "cobertura",
    "transicao",
    "comunicacao",
  ];
  return allowed.includes(normalized) ? normalized : "saque";
};

const normalizePhase = (value: string | null | undefined): ScoutingActionPhase => {
  const normalized = normalizeText(value) as ScoutingActionPhase;
  const allowed: ScoutingActionPhase[] = ["saque", "side_out", "transicao", "pressao", "freeball"];
  return allowed.includes(normalized) ? normalized : "side_out";
};

const normalizeResultLevel = (value: number | null | undefined): ScoutingAction["resultLevel"] => {
  if (value === 1 || value === 2 || value === 3) return value;
  return 0;
};

const scoutingActionRowToModel = (row: ScoutingActionRow): ScoutingAction => ({
  id: row.id,
  sessionId: row.session_id,
  organizationId: row.organization_id ?? "",
  classId: row.classid,
  studentId: row.student_id ?? null,
  athleteName: row.athlete_name ?? null,
  fundamental: normalizeFundamental(row.fundamental),
  phase: normalizePhase(row.phase),
  resultKey: row.result_key ?? "erro",
  resultLabel: row.result_label ?? "Erro",
  resultLevel: normalizeResultLevel(row.result_level),
  createdAt: row.createdat,
});

const sessionTypeLabel = (type: ScoutingSessionType) => {
  if (type === "jogo") return "Jogo";
  if (type === "amistoso") return "Amistoso";
  return "Treino";
};

export const buildScoutingSessionTitle = (
  type: ScoutingSessionType,
  opponent?: string | null
) => {
  const opponentText = normalizeText(opponent);
  if (opponentText && type !== "treino") return `${sessionTypeLabel(type)} vs ${opponentText}`;
  return type === "treino" ? "Treino técnico" : sessionTypeLabel(type);
};

const buildScoutingSessionId = (params: {
  organizationId: string;
  classId: string;
  date: string;
  type: ScoutingSessionType;
  createdAt: string;
}) =>
  `ss_${hashString(
    [params.organizationId, params.classId, params.date, params.type, params.createdAt].join("|")
  )}`;

const buildScoutingActionId = (params: { sessionId: string; createdAt: string; seed: string }) =>
  `sa_${hashString([params.sessionId, params.createdAt, params.seed].join("|"))}`;

const getActionsBySessionId = async (
  sessionId: string,
  organizationId?: string | null
): Promise<ScoutingAction[]> => {
  const rows = await supabaseGet<ScoutingActionRow[]>(
    `/scouting_actions?select=*&session_id=eq.${encodeURIComponent(sessionId)}` +
      (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "") +
      "&order=createdat.desc"
  );
  return rows.map(scoutingActionRowToModel);
};

const syncLegacyScoutingLogForSession = async (
  session: ScoutingSession,
  actions: ScoutingAction[]
) => {
  const counts = actions.length ? aggregateScoutingActionsToCounts(actions) : createEmptyCounts();
  const now = new Date().toISOString();
  const mode = session.type === "treino" ? "treino" : "jogo";
  await saveScoutingLog(
    buildLogFromCounts(
      {
        id: `legacy_${session.id}`,
        clientId: `legacy_${session.id}`,
        classId: session.classId,
        unit: "",
        mode,
        date: session.date,
        createdAt: session.createdAt || now,
        updatedAt: now,
      },
      counts
    ),
    { allowQueue: false, organizationId: session.organizationId }
  );
};

export async function createScoutingSession(
  input: CreateScoutingSessionInput
): Promise<ScoutingSession> {
  const organizationId = input.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) {
    throw new Error("Organização ativa não encontrada para criar scouting.");
  }
  const createdAt = new Date().toISOString();
  const type = normalizeSessionType(input.type);
  const id = buildScoutingSessionId({
    organizationId,
    classId: input.classId,
    date: input.date,
    type,
    createdAt,
  });
  const title = normalizeText(input.title) || buildScoutingSessionTitle(type, input.opponent);
  const payload = {
    id,
    organization_id: organizationId,
    classid: input.classId,
    type,
    date: input.date,
    title,
    opponent: normalizeText(input.opponent) || null,
    initial_note: normalizeText(input.initialNote) || null,
    status: "em_andamento",
    createdat: createdAt,
    updatedat: createdAt,
    completed_at: null,
  };
  await supabasePost("/scouting_sessions?on_conflict=id", [payload], {
    Prefer: "resolution=merge-duplicates",
  });
  return scoutingSessionRowToModel(payload);
}

export async function getScoutingSessionById(
  sessionId: string,
  options: { organizationId?: string | null } = {}
): Promise<ScoutingSessionDetail | null> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<ScoutingSessionRow[]>(
      `/scouting_sessions?select=*&id=eq.${encodeURIComponent(sessionId)}` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "") +
        "&limit=1"
    );
    const row = rows[0];
    if (!row) return null;
    const session = scoutingSessionRowToModel(row);
    const actions = await getActionsBySessionId(session.id, organizationId);
    return { session, actions };
  } catch (error) {
    if (isMissingRelation(error, "scouting_sessions")) return null;
    if (isMissingRelation(error, "scouting_actions")) return null;
    if (isAuthError(error) || isNetworkError(error)) return null;
    throw error;
  }
}

export async function getScoutingSessionsByClass(
  classId: string,
  options: { organizationId?: string | null; limit?: number } = {}
): Promise<ScoutingSession[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const limit = typeof options.limit === "number" && options.limit > 0 ? options.limit : 20;
    const rows = await supabaseGet<ScoutingSessionRow[]>(
      `/scouting_sessions?select=*&classid=eq.${encodeURIComponent(classId)}` +
        (organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "") +
        `&order=date.desc&order=createdat.desc&limit=${Math.floor(limit)}`
    );
    return rows.map(scoutingSessionRowToModel);
  } catch (error) {
    if (isMissingRelation(error, "scouting_sessions")) return [];
    if (isAuthError(error) || isNetworkError(error)) return [];
    throw error;
  }
}

export async function addScoutingAction(input: AddScoutingActionInput): Promise<ScoutingSessionDetail> {
  const detail = await getScoutingSessionById(input.sessionId);
  if (!detail) {
    throw new Error("Sessão de scouting não encontrada.");
  }
  if (detail.session.status === "concluido") {
    throw new Error("Sessão de scouting já finalizada.");
  }
  const result = getScoutingResultOption(input.fundamental, input.resultKey);
  const createdAt = new Date().toISOString();
  const actionId = buildScoutingActionId({
    sessionId: detail.session.id,
    createdAt,
    seed: `${input.studentId ?? ""}|${input.athleteName ?? ""}|${input.fundamental}|${input.phase}|${input.resultKey}`,
  });
  const payload = {
    id: actionId,
    session_id: detail.session.id,
    organization_id: detail.session.organizationId,
    classid: detail.session.classId,
    student_id: normalizeText(input.studentId) || null,
    athlete_name: normalizeText(input.athleteName) || null,
    fundamental: input.fundamental,
    phase: input.phase,
    result_key: result.key,
    result_label: result.label,
    result_level: result.level,
    createdat: createdAt,
  };
  await supabasePost("/scouting_actions?on_conflict=id", [payload], {
    Prefer: "resolution=merge-duplicates",
  });
  const updatedSession = {
    ...detail.session,
    updatedAt: createdAt,
  };
  await supabasePatch(
    `/scouting_sessions?id=eq.${encodeURIComponent(detail.session.id)}` +
      `&organization_id=eq.${encodeURIComponent(detail.session.organizationId)}`,
    { updatedat: createdAt }
  );
  const actions = [scoutingActionRowToModel(payload), ...detail.actions];
  await syncLegacyScoutingLogForSession(updatedSession, actions);
  return { session: updatedSession, actions };
}

export async function deleteLastScoutingAction(
  sessionId: string,
  options: { organizationId?: string | null } = {}
): Promise<ScoutingSessionDetail | null> {
  const detail = await getScoutingSessionById(sessionId, options);
  if (!detail) return null;
  if (detail.session.status === "concluido") {
    throw new Error("Sessão de scouting já finalizada.");
  }
  const lastAction = detail.actions[0];
  if (!lastAction) return detail;
  await supabaseDelete(
    `/scouting_actions?id=eq.${encodeURIComponent(lastAction.id)}` +
      `&organization_id=eq.${encodeURIComponent(detail.session.organizationId)}`
  );
  const now = new Date().toISOString();
  await supabasePatch(
    `/scouting_sessions?id=eq.${encodeURIComponent(detail.session.id)}` +
      `&organization_id=eq.${encodeURIComponent(detail.session.organizationId)}`,
    { updatedat: now }
  );
  const actions = detail.actions.filter((action) => action.id !== lastAction.id);
  const session = { ...detail.session, updatedAt: now };
  await syncLegacyScoutingLogForSession(session, actions);
  return { session, actions };
}

export async function completeScoutingSession(
  sessionId: string,
  options: { organizationId?: string | null } = {}
): Promise<ScoutingSessionDetail | null> {
  const detail = await getScoutingSessionById(sessionId, options);
  if (!detail) return null;
  const now = new Date().toISOString();
  await supabasePatch(
    `/scouting_sessions?id=eq.${encodeURIComponent(detail.session.id)}` +
      `&organization_id=eq.${encodeURIComponent(detail.session.organizationId)}`,
    {
      status: "concluido",
      updatedat: now,
      completed_at: detail.session.completedAt ?? now,
    }
  );
  const session = {
    ...detail.session,
    status: "concluido" as const,
    updatedAt: now,
    completedAt: detail.session.completedAt ?? now,
  };
  await syncLegacyScoutingLogForSession(session, detail.actions);
  return { session, actions: detail.actions };
}
