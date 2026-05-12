import type { ScoutingAction } from "../../../core/scouting-action";
import type { ScoutingSession } from "../../../core/scouting-session";
import {
  fromScoutingActionRow,
  toScoutingActionRow,
} from "../stores/scouting-action-mappers";
import {
  fromScoutingSessionRow,
  toScoutingSessionRow,
} from "../stores/scouting-session-mappers";

describe("scouting persistence mappers", () => {
  test("maps ScoutingSession to/from Supabase row", () => {
    const session: ScoutingSession = {
      id: "session_1",
      classId: "class_1",
      date: "2026-05-09",
      type: "friendly",
      title: "Amistoso vs Maringá",
      opponent: "Maringá",
      location: "Ginásio",
      videoUrl: "https://video.example/scout.mp4",
      sourceType: "video",
      videoClipType: "serve_rally",
      videoNotes: "Vídeo editado com lances de saque e rally.",
      status: "in_progress",
      source: "manual",
      relatedEventId: "event_1",
      createdAt: "2026-05-09T12:00:00.000Z",
      updatedAt: "2026-05-09T12:30:00.000Z",
    };

    const row = toScoutingSessionRow(session);
    expect(row.class_id).toBe("class_1");
    expect(row.video_url).toBe("https://video.example/scout.mp4");
    expect(row.source_type).toBe("video");
    expect(fromScoutingSessionRow(row)).toEqual(session);
  });

  test("maps ScoutingAction to/from Supabase row", () => {
    const action: ScoutingAction = {
      id: "action_1",
      scoutingSessionId: "session_1",
      classId: "class_1",
      athleteId: "athlete_1",
      athleteName: "Maria",
      skill: "receive",
      actionType: "pass_a",
      quality: "high",
      score: 3,
      label: "A / Alto",
      gamePhase: "sideout",
      pressureLevel: "medium",
      rotation: "P1",
      zone: "5",
      videoTimestampSec: 42,
      videoTimestampMs: 42000,
      videoLabel: "Rally longo",
      clipReference: "serve_rally",
      notes: "Recepção estável.",
      source: "coach",
      createdAt: "2026-05-09T12:00:00.000Z",
    };

    const row = toScoutingActionRow(action);
    expect(row.scouting_session_id).toBe("session_1");
    expect(row.athlete_name).toBe("Maria");
    expect(row.video_timestamp_ms).toBe(42000);
    expect(fromScoutingActionRow(row)).toEqual(action);
  });
});
