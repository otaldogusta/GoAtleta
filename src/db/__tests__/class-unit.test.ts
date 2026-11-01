import { updateClassUnit } from "../class-unit";
import { SessionIdentityChangedError } from "../../auth/session";
import { getActiveOrganizationId, supabaseRequest } from "../client";

let mockIdentity = { userId: "teacher-a", generation: 1 }, mockGeneration = 1;
let mockOrganization: string | null = "org-a";
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
  getActiveOrganizationId: jest.fn(async () => mockOrganization),
  getReadCacheGeneration: () => mockGeneration,
  supabaseRequest: jest.fn(),
}));

const saved = (unit = "Centro", unitId: string | null = "unit-a") => JSON.stringify([{ id: "class-a", organization_id: "org-a", unit, unit_id: unitId }]);
const request = jest.mocked(supabaseRequest);
beforeEach(() => {
  jest.clearAllMocks(); mockIdentity = { userId: "teacher-a", generation: 1 }; mockGeneration = 1; mockOrganization = "org-a";
  jest.mocked(getActiveOrganizationId).mockImplementation(async () => mockOrganization);
  request.mockImplementation(async method => method === "GET" ? JSON.stringify([{ unit: "Centro", unit_id: "unit-a" }]) : saved());
});

test("patches only unit fields and uses a bounded organization-scoped relation lookup", async () => {
  const assertCurrent = jest.fn();
  await expect(updateClassUnit(" class-a ", " Centro ", { organizationId: " org-a ", assertCurrent })).resolves.toEqual({ unit: "Centro", unitId: "unit-a" });
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenNthCalledWith(1, "GET", "/classes?select=unit,unit_id&organization_id=eq.org-a&unit=eq.Centro&unit_id=not.is.null&order=id.asc&limit=1", undefined, undefined, mockIdentity, expect.any(Function));
  expect(request).toHaveBeenNthCalledWith(2, "PATCH", "/classes?id=eq.class-a&organization_id=eq.org-a&select=id,organization_id,unit,unit_id", { unit: "Centro", unit_id: "unit-a" }, { Prefer: "return=representation" }, mockIdentity, expect.any(Function));
  expect(assertCurrent).toHaveBeenCalled();
});

test("a custom label clears the old relation without writing to global units", async () => {
  request.mockResolvedValueOnce("[]").mockResolvedValueOnce(saved("Nova unidade", null));
  const result = await updateClassUnit("class-a", "Nova unidade", { organizationId: "org-a" });
  expect(result).toEqual({ unit: "Nova unidade", unitId: undefined });
  expect(Object.hasOwn(result, "unitId")).toBe(true);
  expect(request.mock.calls[1][2]).toEqual({ unit: "Nova unidade", unit_id: null });
  expect(request.mock.calls.every(call => call[1].startsWith("/classes?"))).toBe(true);
});

test("preserves literal reserved text in the lookup and canonicalizes known labels", async () => {
  const label = 'Quadra "A", anexo\\2';
  request.mockResolvedValueOnce("[]").mockResolvedValueOnce(saved(label, null));
  await updateClassUnit("class-a", label, { organizationId: "org-a" });
  const params = new URLSearchParams(request.mock.calls[0][1].split("?")[1]);
  expect(params.get("unit")).toBe(`eq.${label}`);
  request.mockResolvedValueOnce("[]").mockResolvedValueOnce(saved("Rede Esperança", null));
  await expect(updateClassUnit("class-a", "rede esperanca", { organizationId: "org-a" })).resolves.toEqual({ unit: "Rede Esperança" });
});

test.each([["", "Centro", "org-a"], ["class-a", " ", "org-a"], ["class-a", "Centro", ""], [null, "Centro", "org-a"]])("invalid input never makes a request", async (id, unit, organizationId) => {
  await expect(updateClassUnit(id as string, unit!, { organizationId: organizationId! })).rejects.toThrow("obrigatórias");
  expect(request).not.toHaveBeenCalled();
});

test("an unauthenticated session cannot make a request", async () => {
  mockIdentity = { userId: "", generation: 2 };
  await expect(updateClassUnit("class-a", "Centro", { organizationId: "org-a" })).rejects.toThrow("Sessão expirada");
  expect(request).not.toHaveBeenCalled();
});

test("a mismatched active organization never makes a request", async () => {
  mockOrganization = "org-b";
  await expect(updateClassUnit("class-a", "Centro", { organizationId: "org-a" })).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(request).not.toHaveBeenCalled();
});

test.each(["organization", "identity", "generation", "guard"])("%s changing during lookup prevents the PATCH", async change => {
  let current = true;
  request.mockImplementationOnce(async () => {
    if (change === "organization") mockOrganization = "org-b";
    if (change === "identity") mockIdentity = { userId: "teacher-b", generation: 2 };
    if (change === "generation") mockGeneration++;
    if (change === "guard") current = false;
    return "[]";
  });
  await expect(updateClassUnit("class-a", "Centro", { organizationId: "org-a", assertCurrent: () => { if (!current) throw new SessionIdentityChangedError(); } })).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(request).toHaveBeenCalledTimes(1);
});

test("the transport guard rejects stale context during authenticated retries", async () => {
  let current = true;
  request.mockImplementationOnce(async (_method, _path, _body, _headers, _identity, guard) => {
    expect(guard).toEqual(expect.any(Function)); guard!();
    current = false; guard!();
    return "[]";
  });
  await expect(updateClassUnit("class-a", "Centro", { organizationId: "org-a", assertCurrent: () => { if (!current) throw new SessionIdentityChangedError(); } })).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(request).toHaveBeenCalledTimes(1);
});

test.each(["[]", "", "{}", "invalid", saved("Outra"), JSON.stringify([{ id: "other-class", organization_id: "org-a", unit: "Centro", unit_id: "unit-a" }]), JSON.stringify([{ id: "class-a", organization_id: "org-b", unit: "Centro", unit_id: "unit-a" }]), JSON.stringify([{ id: "class-a", organization_id: "org-a", unit: "Centro", unit_id: "other-unit" }]), JSON.stringify([{}, {}])])("does not report success for invalid or empty PATCH response %s", async response => {
  request.mockResolvedValueOnce(JSON.stringify([{ unit: "Centro", unit_id: "unit-a" }])).mockResolvedValueOnce(response);
  await expect(updateClassUnit("class-a", "Centro", { organizationId: "org-a" })).rejects.toThrow("confirmar");
});

test.each(["{}", "[null]", JSON.stringify([{ unit: "Outra", unit_id: "unit-a" }]), JSON.stringify([{ unit: "Centro", unit_id: null }]), "[{},{}]"])("malformed lookup %s cannot trigger a write", async response => {
  request.mockResolvedValueOnce(response);
  await expect(updateClassUnit("class-a", "Centro", { organizationId: "org-a" })).rejects.toThrow("confirmar");
  expect(request).toHaveBeenCalledTimes(1);
});

test.each(["GET", "PATCH"])("permission failure during %s propagates without fallback", async method => {
  const denied = new Error("Supabase request error: 403 42501");
  request.mockImplementation(async operation => {
    if (operation === method) throw denied;
    return JSON.stringify([{ unit: "Centro", unit_id: "unit-a" }]);
  });
  await expect(updateClassUnit("class-a", "Centro", { organizationId: "org-a" })).rejects.toBe(denied);
  expect(request).toHaveBeenCalledTimes(method === "GET" ? 1 : 2);
});

test("context changed after PATCH cannot confirm a save for the new workspace", async () => {
  request.mockImplementation(async method => {
    if (method === "GET") return JSON.stringify([{ unit: "Centro", unit_id: "unit-a" }]);
    mockOrganization = "org-b"; return saved();
  });
  await expect(updateClassUnit("class-a", "Centro", { organizationId: "org-a" })).rejects.toBeInstanceOf(SessionIdentityChangedError);
});
