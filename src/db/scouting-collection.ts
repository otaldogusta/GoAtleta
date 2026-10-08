import { assertSessionIdentity, getSessionIdentity } from "../auth/session";
import type { ScoutingAction, ScoutingContact, ScoutingFormat, ScoutingMatchState, ScoutingRally, ScoutingSession, ScoutingSide } from "../core/models";
import { supabaseGet, supabasePost } from "./client";
import type { ScoutingActionRow, ScoutingSessionRow } from "./row-types";
import { scoutingActionRowToModel, scoutingSessionRowToModel } from "./scouting-sessions";

export type ScoutingDetail = { session: ScoutingSession; actions: ScoutingAction[]; rallies: ScoutingRally[]; captureReady: boolean };
type RallyRow = { id: string; session_id: string; set_number: number; number: number; won: boolean; serve: ScoutingSide; rotation: number | null;
  score_us: number; score_them: number; contacts: ScoutingContact[]; createdat: string };
type DetailRow = { session: ScoutingSessionRow; actions: ScoutingActionRow[]; rallies: RallyRow[] };
export type ScoutingCount = { fundamental: ScoutingAction["fundamental"]; result_key: string; result_level: number; count: number };
export type ScoutingOverview = { session: ScoutingSession; counts: ScoutingCount[];
  rallyStats: { total: number; receiving: number; receivingWon: number; serving: number; servingWon: number } };
type OverviewRow = Omit<ScoutingOverview, "session"> & { session: ScoutingSessionRow };
const mapDetail = (row: DetailRow): ScoutingDetail => ({
  session: scoutingSessionRowToModel(row.session), actions: row.actions.map(scoutingActionRowToModel), captureReady: true,
  rallies: row.rallies.map(r => ({ id: r.id, sessionId: r.session_id, setNumber: r.set_number, number: r.number, won: r.won,
    serve: r.serve, rotation: r.rotation, scoreUs: r.score_us, scoreThem: r.score_them, contacts: r.contacts, createdAt: r.createdat })),
});
const missingRpc = (error: unknown) => /PGRST202/.test(String(error));

export async function loadScoutingOverview(organizationId: string, classId: string, offset = 0) {
  const identity = getSessionIdentity();
  try {
    const rows = await supabasePost<OverviewRow[]>("/rpc/get_scouting_overview", {
      p_organization_id: organizationId, p_class_id: classId, p_offset: offset,
    }, undefined, identity);
    assertSessionIdentity(identity);
    return { ready: true, rows: rows.map(r => ({ ...r, session: scoutingSessionRowToModel(r.session) })) };
  } catch (error) {
    if (!missingRpc(error)) throw error;
    // Historical reading stays available during additive migration rollout.
    const sessions = await supabaseGet<ScoutingSessionRow[]>(`/scouting_sessions?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&classid=eq.${encodeURIComponent(classId)}&order=date.desc,createdat.desc,id&limit=50&offset=${offset}`, identity);
    assertSessionIdentity(identity);
    return { ready: false, rows: sessions.map(session => ({ session: scoutingSessionRowToModel(session), counts: [],
      rallyStats: { total: 0, receiving: 0, receivingWon: 0, serving: 0, servingWon: 0 } })) };
  }
}

export async function loadScoutingDetail(organizationId: string, sessionId: string): Promise<ScoutingDetail> {
  const identity = getSessionIdentity();
  try {
    const row = await supabasePost<DetailRow>("/rpc/get_scouting_detail", { p_session_id: sessionId, p_organization_id: organizationId }, undefined, identity);
    assertSessionIdentity(identity); return mapDetail(row);
  } catch (error) {
    if (!missingRpc(error)) throw error;
    const scope = `organization_id=eq.${encodeURIComponent(organizationId)}`;
    const sessions = await supabaseGet<ScoutingSessionRow[]>(`/scouting_sessions?select=*&id=eq.${encodeURIComponent(sessionId)}&${scope}&limit=1`, identity);
    if (!sessions[0]) throw new Error("Análise não encontrada.");
    const actions = await supabaseGet<ScoutingActionRow[]>(`/scouting_actions?select=*&session_id=eq.${encodeURIComponent(sessionId)}&${scope}&order=createdat.desc&limit=1000`, identity);
    assertSessionIdentity(identity);
    return { session: scoutingSessionRowToModel(sessions[0]), actions: actions.map(scoutingActionRowToModel), rallies: [], captureReady: false };
  }
}

export type ScoutingCommand =
  | { name: "point"; payload: { contacts: ScoutingContact[]; winner: ScoutingSide } }
  | { name: "action"; payload: { contacts: ScoutingContact[] } }
  | { name: "start_set"; payload: Omit<ScoutingMatchState, "recoveredDraft"> }
  | { name: "reopen_point"; payload: { rallyId: string } }
  | { name: "undo_action"; payload: { actionId: string } }
  | { name: "complete" | "discard_draft"; payload: Record<string, never> };
export type PendingScoutingCommand = { requestId: string; revision: number; command: ScoutingCommand };
export async function applyScoutingCommand(organizationId: string, sessionId: string, pending: PendingScoutingCommand) {
  const identity = getSessionIdentity();
  const row = await supabasePost<DetailRow>("/rpc/apply_scouting_command", {
    p_session_id: sessionId, p_organization_id: organizationId, p_expected_revision: pending.revision,
    p_request_id: pending.requestId, p_command: pending.command.name, p_payload: pending.command.payload,
  }, undefined, identity);
  assertSessionIdentity(identity); return mapDetail(row);
}

export async function createCollectedScouting(input: { requestId: string; organizationId: string; classId: string; type: "treino" | "jogo" | "amistoso"; date: string; format: ScoutingFormat; title: string; opponent?: string }) {
  const identity = getSessionIdentity();
  const row = { id: `ss_${input.requestId}`, organization_id: input.organizationId, classid: input.classId,
    type: input.type, date: input.date, title: input.title.trim(), opponent: input.opponent?.trim() || null, format: input.format };
  const saved = await supabasePost<ScoutingSessionRow[]>("/scouting_sessions?on_conflict=id", row, { Prefer: "resolution=ignore-duplicates,return=representation" }, identity);
  const result = saved[0] ?? (await supabaseGet<ScoutingSessionRow[]>(`/scouting_sessions?select=*&id=eq.${encodeURIComponent(row.id)}&organization_id=eq.${encodeURIComponent(input.organizationId)}&limit=1`, identity))[0];
  if (!result) throw new Error("Análise não encontrada após salvar.");
  assertSessionIdentity(identity); return scoutingSessionRowToModel(result);
}
