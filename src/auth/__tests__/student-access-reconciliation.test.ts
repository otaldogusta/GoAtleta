import { getStudentAccessPendingCopy, reconcileMyStudentAccess } from "../student-access-reconciliation";
import { getPendingInvite, getPendingRelationshipInvite, getPendingTrainerInvite } from "../pending-invite";

jest.mock("../../api/config", () => ({ SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "test-key" }));
jest.mock("../pending-invite", () => ({
  getPendingInvite: jest.fn(), getPendingRelationshipInvite: jest.fn(), getPendingTrainerInvite: jest.fn(),
}));
const pendingGetters = [getPendingInvite, getPendingRelationshipInvite, getPendingTrainerInvite] as jest.Mock[];

beforeEach(() => { pendingGetters.forEach(mock => mock.mockReset().mockResolvedValue("")); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it("sends only the session, never an email or target user id", async () => {
  const request = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => "linked" } as Response);
  expect(await reconcileMyStudentAccess("test-token")).toBe("linked");
  expect(request).toHaveBeenCalledWith("https://example.test/rest/v1/rpc/reconcile_my_student_access_v1", expect.objectContaining({
    method: "POST", body: "{}", headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
  }));
});
it.each([0,1,2])("preserves pending invitation priority (%s)", async index => {
  pendingGetters[index].mockResolvedValue("pending-invite");
  const request = jest.spyOn(global, "fetch");
  expect(await reconcileMyStudentAccess("test-token")).toBe("invite_required");
  expect(request).not.toHaveBeenCalled();
});
it.each(["linked", "already_linked", "not_found", "review_required", "verification_required", "invite_required"])("parses %s", async status => {
  jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => status } as Response);
  expect(await reconcileMyStudentAccess("test-token")).toBe(status);
});
it.each([404,401,500])("does not turn HTTP %s into a new registration", async status => {
  jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status } as Response);
  expect(await reconcileMyStudentAccess("test-token")).toBe("unavailable");
});
it("fails closed on malformed responses", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ status: "linked" }) } as Response);
  expect(await reconcileMyStudentAccess("test-token")).toBe("unavailable");
});
it("bounds an offline lookup", async () => {
  jest.useFakeTimers();
  jest.spyOn(global, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  const result = reconcileMyStudentAccess("test-token");
  await jest.advanceTimersByTimeAsync(5000);
  expect(await result).toBe("unavailable");
});
it("shows onboarding only for a genuine unmatched account", () => {
  expect(getStudentAccessPendingCopy("not_found")).toBeNull();
  for (const status of ["review_required", "verification_required", "invite_required", "unavailable"] as const) {
    expect(getStudentAccessPendingCopy(status)).toMatchObject({ title: expect.any(String), action: expect.any(String) });
  }
});
