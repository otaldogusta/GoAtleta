import { createScoutingAction, type CreateScoutingActionInput } from "../../core/scouting-action";
import {
  deleteScoutingActionRecord,
  listScoutingActionRecordsByAthlete,
  listScoutingActionRecordsByClass,
  listScoutingActionRecordsBySession,
  saveScoutingActionRecord,
} from "./scouting-action-store";
import { bootstrapScoutingStores } from "./bootstrap-scouting-stores";

export async function createScoutingActionForSession(input: CreateScoutingActionInput) {
  await bootstrapScoutingStores();
  const action = createScoutingAction(input);
  return saveScoutingActionRecord(action);
}

export async function listScoutingActionsBySession(scoutingSessionId: string) {
  await bootstrapScoutingStores();
  return listScoutingActionRecordsBySession(scoutingSessionId);
}

export async function listScoutingActionsByClass(classId: string) {
  await bootstrapScoutingStores();
  return listScoutingActionRecordsByClass(classId);
}

export async function listScoutingActionsByAthlete(athleteId: string) {
  await bootstrapScoutingStores();
  return listScoutingActionRecordsByAthlete(athleteId);
}

export async function deleteScoutingAction(id: string) {
  await bootstrapScoutingStores();
  return deleteScoutingActionRecord(id);
}
