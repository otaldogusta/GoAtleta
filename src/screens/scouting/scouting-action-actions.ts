import { createScoutingAction, type CreateScoutingActionInput } from "../../core/scouting-action";
import {
  deleteScoutingActionRecord,
  listScoutingActionRecords,
  saveScoutingActionRecord,
} from "./scouting-action-store";

export async function createScoutingActionForSession(input: CreateScoutingActionInput) {
  const action = createScoutingAction(input);
  return saveScoutingActionRecord(action);
}

export async function listScoutingActionsBySession(scoutingSessionId: string) {
  const actions = await listScoutingActionRecords();
  return actions.filter((item) => item.scoutingSessionId === scoutingSessionId);
}

export async function listScoutingActionsByClass(classId: string) {
  const actions = await listScoutingActionRecords();
  return actions.filter((item) => item.classId === classId);
}

export async function listScoutingActionsByAthlete(athleteId: string) {
  const actions = await listScoutingActionRecords();
  return actions.filter((item) => item.athleteId === athleteId);
}

export async function deleteScoutingAction(id: string) {
  return deleteScoutingActionRecord(id);
}
