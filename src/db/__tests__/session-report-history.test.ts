import { getClassReportHistory } from "../session-report-history";
import { supabaseGet } from "../client";
import { assertSessionIdentity, getSessionIdentity } from "../../auth/session";

jest.mock("../client", () => ({ supabaseGet: jest.fn() }));
jest.mock("../../auth/session", () => ({ getSessionIdentity: jest.fn(), assertSessionIdentity: jest.fn() }));
const scope = { classId: "class-1", organizationId: "org-1", userId: "user-1" };
const row = { id: "report-1", client_id: "client-1", createdat: "2026-10-07T12:00:00Z", activity: "Recepção", conclusion: "Boa aula" };

beforeEach(() => {
  jest.resetAllMocks();
  (getSessionIdentity as jest.Mock).mockReturnValue({ userId: "user-1", generation: 1 });
});

it("paginates even below the backend cap, pins identity/scope and excludes photo payloads", async () => {
  (supabaseGet as jest.Mock).mockResolvedValueOnce([row]).mockResolvedValueOnce([{ ...row, id: "report-2" }]).mockResolvedValueOnce([]);
  const result = await getClassReportHistory(scope);
  expect(result).toHaveLength(2);
  const calls = (supabaseGet as jest.Mock).mock.calls;
  expect(calls).toHaveLength(3);
  calls.forEach(([path, identity], index) => {
    expect(path).toContain("organization_id=eq.org-1&classid=eq.class-1");
    expect(path).toContain(`offset=${index}`);
    expect(path).toContain("order=createdat.desc,id.desc&limit=100");
    expect(path).not.toContain("photos");
    expect(identity).toEqual({ userId: "user-1", generation: 1 });
  });
});

it.each([{ ...scope, organizationId: "" }, { ...scope, classId: "" }, { ...scope, userId: "" }, { ...scope, userId: "other-user" }])("fails closed for missing or changed scope %o", async invalid => {
  await expect(getClassReportHistory(invalid)).rejects.toThrow();
  expect(supabaseGet).not.toHaveBeenCalled();
});

it("discards a response after cancellation without requesting another page", async () => {
  const controller = new AbortController();
  (supabaseGet as jest.Mock).mockImplementation(async () => { controller.abort(); return [row]; });
  await expect(getClassReportHistory({ ...scope, signal: controller.signal })).rejects.toThrow();
  expect(supabaseGet).toHaveBeenCalledTimes(1);
});

it("rejects late data when the authenticated identity changes", async () => {
  (supabaseGet as jest.Mock).mockResolvedValueOnce([row]);
  (assertSessionIdentity as jest.Mock).mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error("Session changed"); });
  await expect(getClassReportHistory(scope)).rejects.toThrow("Session changed");
});

it("surfaces errors instead of returning an empty or incomplete history", async () => {
  (supabaseGet as jest.Mock).mockResolvedValueOnce([row]).mockRejectedValueOnce(new Error("Network unavailable"));
  await expect(getClassReportHistory(scope)).rejects.toThrow("Network unavailable");
});
