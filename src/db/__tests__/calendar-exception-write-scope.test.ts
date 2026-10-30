import { getScopedOrganizationId, readCache, supabaseGet, supabasePost, writeCache } from "../client";
import { getClassCalendarExceptions, saveClassCalendarException } from "../periodization";
import type { ClassCalendarException } from "../../core/models";

let mockIdentity = { userId: "user-a", generation: 1 };
jest.mock("../../auth/session", () => ({ getSessionIdentity: () => ({ ...mockIdentity }), assertSessionIdentity: (value: typeof mockIdentity) => { if (value.userId !== mockIdentity.userId || value.generation !== mockIdentity.generation) throw new Error("Session changed"); } }));
jest.mock("../client", () => ({ CACHE_KEYS: {}, getActiveOrganizationId: jest.fn(), getScopedOrganizationId: jest.fn(), isMissingRelation: jest.fn(), isNetworkError: jest.fn(), readCache: jest.fn(), supabaseDelete: jest.fn(), supabaseGet: jest.fn(), supabasePatch: jest.fn(), supabasePost: jest.fn(), writeCache: jest.fn() }));
const item: ClassCalendarException = { id: "pause-a", classId: "class-a", organizationId: "org-a", date: "2026-10-29", kind: "no_training", reason: "Aula cancelada pela agenda.", createdAt: "2026-10-29T00:00:00Z" };
beforeEach(() => { jest.clearAllMocks(); mockIdentity = { userId: "user-a", generation: 1 }; jest.mocked(getScopedOrganizationId).mockResolvedValue("org-a"); jest.mocked(supabasePost).mockResolvedValue([]); });

test("captures the original identity and forwards the optional guard to the authenticated write", async () => {
  const assertCurrent = jest.fn();
  await saveClassCalendarException(item, { organizationId: "org-a", assertCurrent });
  expect(supabasePost).toHaveBeenCalledWith("/class_calendar_exceptions", [expect.objectContaining({ class_id: "class-a", date: item.date, organization_id: "org-a", kind: "no_training" })], { Prefer: "resolution=merge-duplicates" }, { userId: "user-a", generation: 1 }, expect.any(Function));
  expect(assertCurrent).toHaveBeenCalledTimes(3);
});

test.each(["organization", "session"])("%s changed while resolving organization prevents the POST", async change => {
  let release!: (organization: string) => void;
  let current = true;
  jest.mocked(getScopedOrganizationId).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const job = saveClassCalendarException(item, { organizationId: "org-a", assertCurrent: () => { if (!current) throw new Error("Context changed"); } });
  if (change === "organization") current = false;
  else mockIdentity = { userId: "user-b", generation: 2 };
  release("org-a");
  await expect(job).rejects.toThrow("changed"); expect(supabasePost).not.toHaveBeenCalled();
});

test("legacy callers retain their payload and still capture identity", async () => {
  await saveClassCalendarException(item);
  expect(getScopedOrganizationId).toHaveBeenCalledWith("org-a", "saveClassCalendarException");
  expect(supabasePost).toHaveBeenCalledTimes(1);
});

test("an obsolete pause read cannot reach cache after its response", async () => {
  let current = true;
  jest.mocked(supabaseGet).mockImplementationOnce(async () => { current = false; return []; });
  await expect(getClassCalendarExceptions("class-a", { organizationId: "org-a", assertCurrent: () => { if (!current) throw new Error("Context changed"); } })).rejects.toThrow("Context changed");
  expect(readCache).not.toHaveBeenCalled(); expect(writeCache).not.toHaveBeenCalled();
});
