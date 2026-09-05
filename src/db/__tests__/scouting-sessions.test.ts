import { getLatestScoutingSessionDetailForPlanning } from "../scouting-sessions";

const mockSupabaseGet = jest.fn();

jest.mock("../client", () => ({
  getActiveOrganizationId: jest.fn(() => Promise.resolve("org_1")),
  isAuthError: jest.fn(() => false),
  isMissingRelation: jest.fn(() => false),
  isNetworkError: jest.fn(() => false),
  supabaseDelete: jest.fn(),
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  supabasePatch: jest.fn(),
  supabasePost: jest.fn(),
}));

jest.mock("../session", () => ({
  saveScoutingLog: jest.fn(),
}));

describe("scouting session persistence helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads the latest rich scouting session up to the planning date with actions", async () => {
    mockSupabaseGet
      .mockResolvedValueOnce([
        {
          id: "ss_empty",
          organization_id: "org_1",
          classid: "class_1",
          type: "treino",
          date: "2026-06-20",
          title: "Treino técnico",
          opponent: null,
          initial_note: null,
          status: "concluido",
          createdat: "2026-06-20T10:00:00.000Z",
          updatedat: "2026-06-20T10:30:00.000Z",
          completed_at: "2026-06-20T10:30:00.000Z",
        },
        {
          id: "ss_rich",
          organization_id: "org_1",
          classid: "class_1",
          type: "treino",
          date: "2026-06-19",
          title: "Treino técnico",
          opponent: null,
          initial_note: null,
          status: "em_andamento",
          createdat: "2026-06-19T10:00:00.000Z",
          updatedat: "2026-06-19T10:20:00.000Z",
          completed_at: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "sa_1",
          session_id: "ss_rich",
          organization_id: "org_1",
          classid: "class_1",
          student_id: null,
          athlete_name: null,
          fundamental: "cobertura",
          phase: "transicao",
          result_key: "falhou",
          result_label: "Falhou",
          result_level: 0,
          createdat: "2026-06-19T10:01:00.000Z",
        },
      ]);

    const detail = await getLatestScoutingSessionDetailForPlanning("class_1", "2026-06-20", {
      organizationId: "org_1",
    });

    expect(mockSupabaseGet).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("date=lte.2026-06-20")
    );
    expect(mockSupabaseGet).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("order=date.desc")
    );
    expect(detail?.session.id).toBe("ss_rich");
    expect(detail?.actions).toHaveLength(1);
    expect(detail?.actions[0]).toMatchObject({
      fundamental: "cobertura",
      phase: "transicao",
    });
  });
});
