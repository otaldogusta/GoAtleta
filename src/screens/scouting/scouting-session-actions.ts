import {
  completeScoutingSession,
  createScoutingSessionDraft,
  startScoutingSession,
  archiveScoutingSession,
  type CreateScoutingSessionDraftInput,
} from "../../core/scouting-session";
import {
  getScoutingSessionRecord,
  listScoutingSessionRecords,
  saveScoutingSessionRecord,
} from "./scouting-session-store";
import { bootstrapScoutingStores } from "./bootstrap-scouting-stores";

export async function createScoutingSession(input: CreateScoutingSessionDraftInput) {
  await bootstrapScoutingStores();
  const session = createScoutingSessionDraft(input);
  return saveScoutingSessionRecord(session);
}

export async function listScoutingSessionsByClass(classId: string) {
  await bootstrapScoutingStores();
  return listScoutingSessionRecords(classId);
}

export async function getScoutingSession(id: string) {
  await bootstrapScoutingStores();
  return getScoutingSessionRecord(id);
}

export async function startScoutingSessionById(id: string) {
  await bootstrapScoutingStores();
  const session = await getScoutingSessionRecord(id);
  if (!session) return null;
  return saveScoutingSessionRecord(startScoutingSession(session));
}

export async function completeScoutingSessionById(id: string) {
  await bootstrapScoutingStores();
  const session = await getScoutingSessionRecord(id);
  if (!session) return null;
  return saveScoutingSessionRecord(completeScoutingSession(session));
}

export async function archiveScoutingSessionById(id: string) {
  await bootstrapScoutingStores();
  const session = await getScoutingSessionRecord(id);
  if (!session) return null;
  return saveScoutingSessionRecord(archiveScoutingSession(session));
}

export async function createAndStartScoutingSession(input: CreateScoutingSessionDraftInput) {
  const created = await createScoutingSession(input);
  const started = await startScoutingSessionById(created.id);
  if (!started) {
    throw new Error("Não foi possível iniciar a sessão de scouting.");
  }
  return started;
}
