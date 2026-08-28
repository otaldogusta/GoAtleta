const mockSupabaseDelete = jest.fn();
const mockSupabaseGet = jest.fn();

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock("../client", () => ({
  CACHE_KEYS: { classes: "classes" },
  getActiveOrganizationId: jest.fn(() => Promise.resolve("org-1")),
  getScopedOrganizationId: jest.fn((value: string | null | undefined) =>
    Promise.resolve(value ?? "org-1"),
  ),
  isAuthError: jest.fn(() => false),
  isMissingColumnInSchemaCache: jest.fn(() => false),
  isMissingRelation: jest.fn(() => false),
  isNetworkError: jest.fn(() => false),
  isPermissionError: jest.fn(() => false),
  readCache: jest.fn(),
  writeCache: jest.fn(),
  supabaseDelete: (...args: unknown[]) => mockSupabaseDelete(...args),
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  supabasePatch: jest.fn(),
  supabasePost: jest.fn(),
}));

jest.mock("../../auth/session", () => ({
  getSessionUserId: jest.fn(() => Promise.resolve("user-1")),
}));

jest.mock("../training-sessions", () => ({
  deleteTrainingIntegrationRuleBySession: jest.fn(),
  syncTrainingIntegrationRuleFromSession: jest.fn(),
}));

// eslint-disable-next-line import/first -- load the module only after its Jest dependencies are mocked
import { deleteClassCascade } from "../classes";

describe("deleteClassCascade athlete preservation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseDelete.mockResolvedValue(undefined);
  });

  it("stops before any destructive call when the class still has an athlete", async () => {
    mockSupabaseGet.mockImplementation((path: string) =>
      Promise.resolve(path.startsWith("/students?") ? [{ id: "student-1" }] : []),
    );

    await expect(deleteClassCascade("class-1")).rejects.toThrow(
      "possui atletas vinculados",
    );
    expect(mockSupabaseDelete).not.toHaveBeenCalled();
  });

  it("never issues a students DELETE for an empty class", async () => {
    mockSupabaseGet.mockResolvedValue([]);

    await deleteClassCascade("class-1");

    const deletePaths = mockSupabaseDelete.mock.calls.map(([path]) => String(path));
    expect(deletePaths.some((path) => path.startsWith("/students?"))).toBe(false);
    expect(deletePaths.some((path) => path.startsWith("/classes?"))).toBe(true);
  });
});
