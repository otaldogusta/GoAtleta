import type { ScoutingAction } from "../../../core/scouting-action";

export type ScoutingActionRow = {
  id: string;
  scouting_session_id: string;
  class_id: string;
  athlete_id: string | null;
  athlete_name: string | null;
  skill: ScoutingAction["skill"];
  action_type: string;
  quality: ScoutingAction["quality"];
  score: number | null;
  label: string | null;
  game_phase: ScoutingAction["gamePhase"] | null;
  pressure_level: ScoutingAction["pressureLevel"] | null;
  rotation: string | null;
  zone: string | null;
  video_timestamp_sec: number | null;
  video_timestamp_ms: number | null;
  video_label: string | null;
  clip_reference: string | null;
  notes: string | null;
  source: ScoutingAction["source"];
  created_at: string;
};

export function toScoutingActionRow(action: ScoutingAction): ScoutingActionRow {
  return {
    id: action.id,
    scouting_session_id: action.scoutingSessionId,
    class_id: action.classId,
    athlete_id: action.athleteId ?? null,
    athlete_name: action.athleteName ?? null,
    skill: action.skill,
    action_type: action.actionType,
    quality: action.quality,
    score: action.score ?? null,
    label: action.label ?? null,
    game_phase: action.gamePhase ?? null,
    pressure_level: action.pressureLevel ?? null,
    rotation: action.rotation ?? null,
    zone: action.zone ?? null,
    video_timestamp_sec: action.videoTimestampSec ?? null,
    video_timestamp_ms: action.videoTimestampMs ?? null,
    video_label: action.videoLabel ?? null,
    clip_reference: action.clipReference ?? null,
    notes: action.notes ?? null,
    source: action.source,
    created_at: action.createdAt,
  };
}

export function fromScoutingActionRow(row: ScoutingActionRow): ScoutingAction {
  const score =
    row.score === 0 || row.score === 1 || row.score === 2 || row.score === 3
      ? row.score
      : undefined;

  return {
    id: row.id,
    scoutingSessionId: row.scouting_session_id,
    classId: row.class_id,
    athleteId: row.athlete_id ?? undefined,
    athleteName: row.athlete_name ?? undefined,
    skill: row.skill,
    actionType: row.action_type,
    quality: row.quality,
    score,
    label: row.label ?? undefined,
    gamePhase: row.game_phase ?? undefined,
    pressureLevel: row.pressure_level ?? undefined,
    rotation: row.rotation ?? undefined,
    zone: row.zone ?? undefined,
    videoTimestampSec: row.video_timestamp_sec ?? undefined,
    videoTimestampMs: row.video_timestamp_ms ?? undefined,
    videoLabel: row.video_label ?? undefined,
    clipReference: row.clip_reference ?? undefined,
    notes: row.notes ?? undefined,
    source: row.source,
    createdAt: row.created_at,
  };
}
