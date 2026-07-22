import type { ClassGroup } from "../../core/models";
import { duplicateClass, saveClass } from "../classes";
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
  isMissingColumnInSchemaCache: jest.fn((error: unknown, columnName: string) => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes("schema cache") && message.includes(`'${columnName.toLowerCase()}'`);
  }),
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
      trainingSpace: "Quadra 2",
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
      [expect.objectContaining({ cycle_start_date: null, organization_id: "org-1", training_space: "Quadra 2" })]
    );
  });
});

describe("saveClass schema compatibility", () => {
  beforeEach(() => {
    mockedSupabasePost.mockReset();
  });

  it("retries without training_space only when the connected schema does not have the column", async () => {
    mockedSupabasePost
      .mockRejectedValueOnce(
        new Error(
          "Supabase POST error: 400 Could not find the 'training_space' column of 'classes' in the schema cache"
        )
      )
      .mockResolvedValueOnce([]);

    await saveClass({
      name: "Turma teste",
      organizationId: "org-1",
      unit: "Unidade teste",
      unitId: "unit-1",
      trainingSpace: "Quadra 2",
      modality: "voleibol",
      ageBand: "10-12",
      gender: "misto",
      daysOfWeek: [2, 4],
      goal: "Fundamentos",
      startTime: "14:00",
      durationMinutes: 60,
    });

    expect(mockedSupabasePost).toHaveBeenCalledTimes(2);
    expect(mockedSupabasePost).toHaveBeenNthCalledWith(
      1,
      "/classes",
      [expect.objectContaining({ training_space: "Quadra 2" })]
    );
    expect(mockedSupabasePost).toHaveBeenNthCalledWith(
      2,
      "/classes",
      [expect.not.objectContaining({ training_space: expect.anything() })]
    );
  });

  it("does not hide unrelated Supabase errors", async () => {
    const error = new Error("Supabase POST error: 403 permission denied");
    mockedSupabasePost.mockRejectedValueOnce(error);

    await expect(
      saveClass({
        name: "Turma teste",
        organizationId: "org-1",
        unit: "Unidade teste",
        unitId: "unit-1",
        trainingSpace: "Quadra 2",
        modality: "voleibol",
        ageBand: "10-12",
        gender: "misto",
        daysOfWeek: [2, 4],
        goal: "Fundamentos",
        startTime: "14:00",
        durationMinutes: 60,
      })
    ).rejects.toBe(error);

    expect(mockedSupabasePost).toHaveBeenCalledTimes(1);
  });
});
