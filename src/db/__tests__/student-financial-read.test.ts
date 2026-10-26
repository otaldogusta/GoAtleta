let mockIdentity = { userId: "owner", generation: 1 };
let mockGeneration = 1;
let mockOrganization: string | null = "org-active";
const mockRequest = jest.fn();
const mockGuard = jest.fn(async () => undefined);
jest.mock("../../auth/session", () => {
  class Changed extends Error {}
  return {
    getSessionIdentity: () => ({ ...mockIdentity }),
    assertSessionIdentity: (identity: typeof mockIdentity) => {
      if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) throw new Changed();
    },
    SessionIdentityChangedError: Changed,
  };
});
jest.mock("../client", () => ({
  getActiveOrganizationId: async () => mockOrganization,
  getReadCacheGeneration: () => mockGeneration,
  supabaseRequest: (...args: unknown[]) => mockRequest(...args),
}));

// eslint-disable-next-line import/first -- isolated session/transport boundaries precede loader
import { readStudentFinancialStatuses, STUDENT_FINANCIAL_RPC_MAX_IDS } from "../student-financial-read";
// eslint-disable-next-line import/first -- same error constructor as the mocked session
import { SessionIdentityChangedError } from "../../auth/session";

beforeEach(() => {
  jest.clearAllMocks(); mockIdentity = { userId: "owner", generation: 1 };
  mockGeneration = 1; mockOrganization = "org-active";
  mockGuard.mockResolvedValue(undefined); mockRequest.mockResolvedValue("[]");
});
const context = () => ({ identity: { ...mockIdentity }, assertCurrent: mockGuard });
const response = (ids: string[]) => JSON.stringify(ids.map(student_id => ({ student_id, status: "regular" })));

test("one POST returns all 5,000 requested states beyond the ordinary row cap", async () => {
  const ids = Array.from({ length: 5000 }, (_, i) => `student-${i}`);
  mockRequest.mockResolvedValue(response(ids));
  const rows = await readStudentFinancialStatuses("org-explicit", ids, context());
  expect(rows).toHaveLength(5000);
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenCalledWith("POST", "/rpc/get_student_financial_statuses_v1",
    { p_org_id: "org-explicit", p_student_ids: ids }, undefined, mockIdentity);
});

test("bounded sequential chunks preserve all 10,001 IDs without an overall product cap", async () => {
  const ids = Array.from({ length: 10001 }, (_, i) => `id-${i}`);
  let active = 0; let peak = 0;
  mockRequest.mockImplementation(async (_method, _path, body: { p_student_ids: string[] }) => {
    active++; peak = Math.max(peak, active); await Promise.resolve(); active--;
    return response(body.p_student_ids);
  });
  expect(await readStudentFinancialStatuses("org-explicit", ids)).toHaveLength(10001);
  expect(mockRequest.mock.calls.map(call => call[2].p_student_ids.length)).toEqual([5000, 5000, 1]);
  expect(peak).toBe(1); expect(STUDENT_FINANCIAL_RPC_MAX_IDS).toBe(5000);
});

test("normalizes requested IDs while preserving non-UUID/reserved text and an RLS subset", async () => {
  const id = 'id,(reserved)"\\text';
  mockRequest.mockResolvedValue(response([id]));
  expect(await readStudentFinancialStatuses(" org-other ", [" ", ` ${id} `, id, "hidden"])).toEqual([{ student_id: id, status: "regular" }]);
  expect(mockRequest.mock.calls[0][2]).toEqual({ p_org_id: "org-other", p_student_ids: [id, "hidden"] });
});

test("empty normalized input makes no request", async () => {
  expect(await readStudentFinancialStatuses("org", ["", " "])).toEqual([]);
  expect(mockRequest).not.toHaveBeenCalled();
});

test.each(["", " ", null])("invalid organization %j does not broaden the request", async org => {
  await expect(readStudentFinancialStatuses(org as string, ["a"])).rejects.toThrow("Organização");
  expect(mockRequest).not.toHaveBeenCalled();
});

test.each([null, [null], [42]])("invalid ID input %j is rejected", async ids => {
  await expect(readStudentFinancialStatuses("org", ids as unknown as string[])).rejects.toThrow("Organização");
  expect(mockRequest).not.toHaveBeenCalled();
});

test("only exact missing-signature error returns null, including after a completed first chunk", async () => {
  const ids = Array.from({ length: 5001 }, (_, i) => `id-${i}`);
  mockRequest.mockResolvedValueOnce(response(ids.slice(0, 5000)))
    .mockRejectedValueOnce(new Error("Supabase POST error: 404 PGRST202"));
  expect(await readStudentFinancialStatuses("org", ids, context())).toBeNull();
});

test.each(["Supabase POST error: 403 PGRST202", "Supabase POST error: 403 42501",
  "Supabase POST error: 401 PGRST301", "Supabase POST error: 404 42883",
  "Supabase POST error: 404 PGRST203", "Supabase POST error: 404 PGRST202 extra",
  "Supabase GET error: 404 PGRST202", "Timed out", "Failed to fetch"])("propagates %s without compatibility fallback", async message => {
  const error = new Error(message); mockRequest.mockRejectedValue(error);
  await expect(readStudentFinancialStatuses("org", ["a"], context())).rejects.toBe(error);
});

test.each(["broken-json", "null", "{}", '[{"student_id":"a","status":"other"}]',
  '[{"student_id":"other","status":"regular"}]', '[{"student_id":"a","status":"regular","note":"extra"}]',
  '[{"student_id":"a","status":"regular"},{"student_id":"a","status":"regular"}]',
  '[{"student_id":"a"}]', '[null]', '[["a","regular"]]'])("rejects malformed/unrequested results instead of returning partial success (%s)", async body => {
  mockRequest.mockResolvedValue(body);
  await expect(readStudentFinancialStatuses("org", ["a", "hidden"], context())).rejects.toThrow("inválidos");
});

test.each(["identity", "generation", "workspace", "round-trip"])("default context rejects %s change during the request", async change => {
  mockRequest.mockImplementation(async () => {
    if (change === "identity") mockIdentity = { userId: "other", generation: 2 };
    if (change === "generation") mockIdentity.generation++;
    if (change === "workspace") mockOrganization = "org-changed";
    if (change === "round-trip") mockGeneration += 2;
    return response(["a"]);
  });
  await expect(readStudentFinancialStatuses("org-explicit", ["a"])).rejects.toBeInstanceOf(SessionIdentityChangedError);
});

test("caller guard failure after a request wins over missing-RPC fallback", async () => {
  const error = new SessionIdentityChangedError();
  mockRequest.mockImplementation(async () => { mockGuard.mockRejectedValue(error); throw new Error("Supabase POST error: 404 PGRST202"); });
  await expect(readStudentFinancialStatuses("org", ["a"], context())).rejects.toBe(error);
});

test("a failed second chunk rejects the entire result", async () => {
  const ids = Array.from({ length: 5001 }, (_, i) => `id-${i}`), error = new Error("Supabase POST error: 403 42501");
  mockRequest.mockResolvedValueOnce(response(ids.slice(0, 5000))).mockRejectedValueOnce(error);
  await expect(readStudentFinancialStatuses("org", ids, context())).rejects.toBe(error);
});

test("no authenticated identity does not issue a request", async () => {
  mockIdentity.userId = "";
  await expect(readStudentFinancialStatuses("org", ["a"])).rejects.toThrow("Sessão expirada");
  expect(mockRequest).not.toHaveBeenCalled();
});
