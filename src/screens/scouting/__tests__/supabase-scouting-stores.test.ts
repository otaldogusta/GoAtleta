jest.mock("../../../db/client", () => ({
  supabaseDelete: jest.fn(),
  supabaseGet: jest.fn(),
  supabasePost: jest.fn(),
}));

import { supabaseDelete, supabaseGet, supabasePost } from "../../../db/client";
import { SupabaseScoutingActionStore } from "../stores/supabase-scouting-action-store";
import { SupabaseScoutingSessionStore } from "../stores/supabase-scouting-session-store";

const mockSupabaseGet = supabaseGet as jest.MockedFunction<typeof supabaseGet>;
const mockSupabasePost = supabasePost as jest.MockedFunction<typeof supabasePost>;
const mockSupabaseDelete = supabaseDelete as jest.MockedFunction<typeof supabaseDelete>;

describe("supabase scouting stores", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseGet.mockResolvedValue([]);
    mockSupabasePost.mockImplementation(async (_path, body) => body as never);
    mockSupabaseDelete.mockResolvedValue(undefined);
  });

  test("persists ScoutingSession without hitting real Supabase", async () => {
    const store = new SupabaseScoutingSessionStore();
    const session = await store.save({
      id: "session_1",
      classId: "class_1",
      date: "2026-05-09",
      type: "training",
      title: "Scouting de treino",
      status: "draft",
      createdAt: "2026-05-09T12:00:00.000Z",
    });

    expect(session.id).toBe("session_1");
    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/scouting_sessions",
      [expect.objectContaining({ class_id: "class_1" })],
      expect.objectContaining({ Prefer: expect.stringContaining("merge-duplicates") }),
    );
  });

  test("lists ScoutingAction by session with scoped endpoint", async () => {
    mockSupabaseGet.mockResolvedValueOnce([
      {
        id: "action_1",
        scouting_session_id: "session_1",
        class_id: "class_1",
        athlete_id: null,
        athlete_name: "Maria",
        skill: "serve",
        action_type: "ace",
        quality: "excellent",
        score: 3,
        label: "Ace",
        game_phase: null,
        pressure_level: null,
        rotation: null,
        zone: null,
        video_timestamp_sec: null,
        notes: null,
        source: "coach",
        created_at: "2026-05-09T12:00:00.000Z",
      },
    ]);

    const store = new SupabaseScoutingActionStore();
    const actions = await store.listBySession("session_1");

    expect(actions).toHaveLength(1);
    expect(actions[0]?.athleteName).toBe("Maria");
    expect(mockSupabaseGet).toHaveBeenCalledWith(
      expect.stringContaining("scouting_session_id=eq.session_1"),
    );
  });

  test("deletes ScoutingAction by id", async () => {
    const store = new SupabaseScoutingActionStore();
    await store.delete("action_1");
    expect(mockSupabaseDelete).toHaveBeenCalledWith("/scouting_actions?id=eq.action_1");
  });
});
