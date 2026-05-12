import { generateScoutingImpactFromActions } from "../../core/scouting-impact";
import type { ScoutingImpact } from "../../core/team-context";
import {
  createScoutingImpactRecord,
  listScoutingImpactRecords,
} from "../team-context/team-context-store";
import { listScoutingActionsBySession } from "./scouting-action-actions";
import { getScoutingSession } from "./scouting-session-actions";

export type GenerateAndSaveScoutingImpactResult = {
  impact: ScoutingImpact | null;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  ignoredReasons: string[];
  saved: boolean;
};

export async function generateAndSaveScoutingImpactForSession(
  scoutingSessionId: string,
): Promise<GenerateAndSaveScoutingImpactResult> {
  const session = await getScoutingSession(scoutingSessionId);
  if (!session) {
    return {
      impact: null,
      confidence: "low",
      reasons: [],
      ignoredReasons: ["sessão de scouting não encontrada"],
      saved: false,
    };
  }

  const actions = await listScoutingActionsBySession(scoutingSessionId);
  const result = generateScoutingImpactFromActions({
    classId: session.classId,
    eventId: session.relatedEventId,
    scoutingSessionId: session.id,
    date: session.date,
    actions,
    sessionType: session.type,
  });

  if (!result.impact) {
    return { ...result, saved: false };
  }

  const savedImpact = await createScoutingImpactRecord(result.impact);
  return {
    ...result,
    impact: savedImpact,
    saved: true,
  };
}

export async function listGeneratedScoutingImpactsByClass(classId: string) {
  return listScoutingImpactRecords(classId);
}
