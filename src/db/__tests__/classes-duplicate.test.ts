import type { ClassGroup } from "../../core/models";
import { duplicateClass } from "../classes";
import { supabasePost } from "../client";

jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock("../../auth/session", () => ({
  getSessionUserId: jest.fn(),
}));

jest.mock("../training-sessions", () => ({
  deleteTrainingIntegrationRuleBySession: jest.fn(),
  syncTrainingIntegrationRuleFromSession: jest.fn(),
}));

jest.mock("../client", () => ({
  CACHE_KEYS: { classes: "classes" },
  getActiveOrganizationId: jest.fn(),
  getScopedOrganizationId: jest.fn(),
  isAuthError: jest.fn(() => false),
  isMissingRelation: jest.fn(() => false),
  isNetworkError: jest.fn(() => false),
  isPermissionError: jest.fn(() => false),
  readCache: jest.fn(),
  writeCache: jest.fn(),
  supabaseGet: jest.fn(),
  supabasePost: jest.fn(),
  supabasePatch: jest.fn(),
  supabaseDelete: jest.fn(),
}));

const mockedSupabasePost = jest.mocked(supabasePost);

describe("duplicateClass", () => {
  beforeEach(() => {
    mockedSupabasePost.mockReset();
    mockedSupabasePost.mockResolvedValue([]);
  });

  it("sends null instead of an empty cycle start date", async () => {
    const source = {
      id: "class-source",
      organizationId: "org-1",
      unitId: "unit-1",
      name: "Turma teste",
      unit: "Unidade teste",
      modality: "voleibol",
      ageBand: "10-12",
      gender: "misto",
      startTime: "14:00",
      durationMinutes: 60,
      daysOfWeek: [2, 4],
      goal: "Fundamentos",
      equipment: "quadra",
      level: 1,
      mvLevel: "MV1",
      cycleStartDate: "",
      cycleLengthWeeks: 12,
    } as ClassGroup;

    await duplicateClass(source);

    expect(mockedSupabasePost).toHaveBeenCalledWith(
      "/classes",
      [expect.objectContaining({ cycle_start_date: null, organization_id: "org-1" })]
    );
  });
});
