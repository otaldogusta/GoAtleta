import { applyScoutingCommand, loadScoutingOverview, loadScoutingDetail } from "../scouting-collection";
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockAssert = jest.fn();
jest.mock("../client", () => ({ supabasePost: (...args: unknown[]) => mockPost(...args), supabaseGet: (...args: unknown[]) => mockGet(...args) }));
jest.mock("../../auth/session", () => ({ getSessionIdentity: () => ({ userId: "user", generation: 3 }), assertSessionIdentity: (...args: unknown[]) => mockAssert(...args) }));
jest.mock("../scouting-sessions", () => ({ scoutingSessionRowToModel: (row: unknown) => row, scoutingActionRowToModel: (row: unknown) => row }));
beforeEach(() => { jest.clearAllMocks(); });
test("commands carry explicit org, revision, request identity, and auth generation", async () => {
  mockPost.mockResolvedValue({ session: {}, actions: [], rallies: [] });
  await applyScoutingCommand("org", "session", { revision: 7, requestId: "request-0001", command: { name: "point", payload: { contacts: [], winner: "them" } } });
  expect(mockPost).toHaveBeenCalledWith("/rpc/apply_scouting_command", { p_organization_id: "org", p_session_id: "session", p_expected_revision: 7, p_request_id: "request-0001", p_command: "point", p_payload: { contacts: [], winner: "them" } }, undefined, { userId: "user", generation: 3 });
  expect(mockAssert).toHaveBeenCalledWith({ userId: "user", generation: 3 });
});
test("schema rollout fallback is read-only and remains organization scoped", async () => {
  mockPost.mockRejectedValue(new Error("PGRST202")); mockGet.mockResolvedValue([]);
  expect((await loadScoutingOverview("org", "class", 50)).ready).toBe(false);
  expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("organization_id=eq.org&classid=eq.class"), { userId: "user", generation: 3 });
});
test("network/auth failures are not reported as an empty history", async () => {
  mockPost.mockRejectedValue(new Error("403 42501"));
  await expect(loadScoutingOverview("org", "class")).rejects.toThrow("42501");
  await expect(loadScoutingDetail("org", "session")).rejects.toThrow("42501");
  expect(mockGet).not.toHaveBeenCalled();
});
