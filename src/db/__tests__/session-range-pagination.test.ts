import * as Sentry from "@sentry/react-native";
import { SessionIdentityChangedError } from "../../auth/session";
import { getActiveOrganizationId, getScopedOrganizationId, supabaseGet } from "../client";
import type { SessionLogRow } from "../row-types";
import { getSessionLogsByRange } from "../session";

let mockIdentity = { userId: "teacher-a", generation: 1 };
let mockCacheGeneration = 1;
let mockActiveOrganizationId: string | null = "org-a";

jest.mock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn() }));
jest.mock("../../auth/session", () => {
  class IdentityChangedError extends Error {}
  return {
    getSessionIdentity: () => ({ ...mockIdentity }),
    SessionIdentityChangedError: IdentityChangedError,
    assertSessionIdentity: (identity: typeof mockIdentity) => {
      if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) {
        throw new IdentityChangedError("session changed");
      }
    },
  };
});
jest.mock("../client", () => ({
  getActiveOrganizationId: jest.fn(async () => mockActiveOrganizationId),
  getScopedOrganizationId: jest.fn(async (candidate?: string | null) => candidate ?? mockActiveOrganizationId),
  getReadCacheGeneration: () => mockCacheGeneration,
  supabaseGet: jest.fn(),
}));
jest.mock("../classes", () => ({}));
jest.mock("../training", () => ({}));
jest.mock("../training-sessions", () => ({}));
jest.mock("../pending-write-queue", () => ({}));
jest.mock("../pending-write-identity", () => ({}));

const start = "2026-10-01T00:00:00.000Z";
const end = "2026-11-01T00:00:00.000Z";
const identity = { userId: "teacher-a", generation: 1 };
const makeRow = (index: number): SessionLogRow => ({
  id: `report-${String(index).padStart(4, "0")}`,
  classid: "class-a",
  organization_id: "org-a",
  rpe: 5,
  technique: "ok",
  attendance: 20,
  activity: "Atividade fictícia",
  conclusion: "Relato fictício",
  participants_count: 20,
  pain_score: 0,
  // Deliberately share dates: the id order must break ties across page edges.
  createdat: start,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentity = { ...identity };
  mockCacheGeneration = 1;
  mockActiveOrganizationId = "org-a";
  jest.mocked(getActiveOrganizationId).mockImplementation(async () => mockActiveOrganizationId);
  jest.mocked(getScopedOrganizationId).mockImplementation(async candidate => candidate ?? mockActiveOrganizationId);
  jest.mocked(supabaseGet).mockResolvedValue([]);
});

it("loads all 1200 lightweight reports with fixed scope, range and stable ordering", async () => {
  const fixture = Array.from({ length: 1200 }, (_, index) => makeRow(index));
  jest.mocked(supabaseGet).mockImplementation(async path => {
    const query = new URLSearchParams(path.split("?")[1]);
    const offset = Number(query.get("offset"));
    return fixture.slice(offset, offset + Number(query.get("limit")));
  });

  const reports = await getSessionLogsByRange(start, end, { organizationId: "org-a" });

  expect(reports).toHaveLength(1200);
  expect(new Set(reports.map(report => report.id)).size).toBe(1200);
  expect(reports[1199]).toMatchObject({
    id: "report-1199", clientId: "report-1199", classId: "class-a",
    PSE: 5, technique: "ok", participantsCount: 20, photos: "", createdAt: start,
  });
  expect(jest.mocked(supabaseGet).mock.calls.map(([path]) => new URLSearchParams(path.split("?")[1]).get("offset")))
    .toEqual(["0", "500", "1000", "1200"]);
  for (const [path, capturedIdentity] of jest.mocked(supabaseGet).mock.calls) {
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("organization_id")).toBe("eq.org-a");
    expect(query.getAll("createdat")).toEqual([`gte.${start}`, `lt.${end}`]);
    expect(query.get("order")).toBe("createdat.asc,id.asc");
    expect(query.get("limit")).toBe("500");
    expect(query.get("select")).not.toContain("photos");
    expect(capturedIdentity).toEqual(identity);
  }
  expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
    message: "getSessionLogsByRange", data: { ms: expect.any(Number), rows: 1200 },
  }));
});

it("continues after a nonempty short page capped by the backend", async () => {
  jest.mocked(supabaseGet)
    .mockResolvedValueOnce([makeRow(0)])
    .mockResolvedValueOnce([makeRow(1)])
    .mockResolvedValueOnce([]);
  await expect(getSessionLogsByRange(start, end)).resolves.toHaveLength(2);
  expect(jest.mocked(supabaseGet).mock.calls.map(([path]) => new URLSearchParams(path.split("?")[1]).get("offset")))
    .toEqual(["0", "1", "2"]);
});

it("preserves row defaults and the legacy technique fallback", async () => {
  jest.mocked(supabaseGet).mockResolvedValueOnce([{ ...makeRow(0), technique: "legacy", activity: null, conclusion: null, participants_count: null, pain_score: null }]);
  await expect(getSessionLogsByRange(start, end)).resolves.toEqual([expect.objectContaining({
    technique: "boa", activity: "", conclusion: "", participantsCount: 0, painScore: 0,
  })]);
});

it("does not query a global range without an organization", async () => {
  mockActiveOrganizationId = null;
  await expect(getSessionLogsByRange(start, end)).resolves.toEqual([]);
  expect(supabaseGet).not.toHaveBeenCalled();
});

it("requires an authenticated identity", async () => {
  mockIdentity = { userId: "", generation: 2 };
  await expect(getSessionLogsByRange(start, end)).rejects.toThrow("Sessão expirada");
  expect(supabaseGet).not.toHaveBeenCalled();
});

it("preserves an explicit organization different from the active workspace across pages", async () => {
  jest.mocked(supabaseGet).mockResolvedValueOnce([{ ...makeRow(0), organization_id: "org-student" }]);
  await expect(getSessionLogsByRange(start, end, { organizationId: "org-student" }))
    .resolves.toHaveLength(1);
  expect(supabaseGet).toHaveBeenCalledTimes(2);
  for (const [path, capturedIdentity] of jest.mocked(supabaseGet).mock.calls) {
    expect(new URLSearchParams(path.split("?")[1]).get("organization_id")).toBe("eq.org-student");
    expect(capturedIdentity).toEqual(identity);
  }
});

it("pins identity before asynchronous organization lookup", async () => {
  jest.mocked(getScopedOrganizationId).mockImplementationOnce(async () => {
    mockIdentity = { userId: "teacher-b", generation: 2 };
    return "org-a";
  });
  await expect(getSessionLogsByRange(start, end)).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(supabaseGet).not.toHaveBeenCalled();
});

it.each(["logout", "account", "organization", "organization round trip"])(
  "discards a page after %s without requesting another page",
  async kind => {
    jest.mocked(supabaseGet).mockImplementationOnce(async () => {
      if (kind === "logout") mockIdentity = { userId: "", generation: 2 };
      if (kind === "account") mockIdentity = { userId: "teacher-b", generation: 2 };
      if (kind === "organization") mockActiveOrganizationId = "org-b";
      if (kind === "organization round trip") mockCacheGeneration += 2;
      return [makeRow(0)];
    });
    await expect(getSessionLogsByRange(start, end)).rejects.toBeInstanceOf(SessionIdentityChangedError);
    expect(supabaseGet).toHaveBeenCalledTimes(1);
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  },
);

it("rechecks identity after asynchronous active organization lookup", async () => {
  jest.mocked(getActiveOrganizationId).mockResolvedValueOnce("org-a").mockImplementationOnce(async () => {
    mockIdentity = { userId: "teacher-b", generation: 2 };
    return "org-a";
  });
  await expect(getSessionLogsByRange(start, end)).rejects.toBeInstanceOf(SessionIdentityChangedError);
  expect(supabaseGet).not.toHaveBeenCalled();
});

it.each(["Failed to fetch", "HTTP 403"])("surfaces %s on a later page instead of returning a partial range", async message => {
  jest.mocked(supabaseGet).mockResolvedValueOnce([makeRow(0)]).mockRejectedValueOnce(new Error(message));
  await expect(getSessionLogsByRange(start, end)).rejects.toThrow(message);
  expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
});

it("rejects a repeated page instead of looping or duplicating totals", async () => {
  jest.mocked(supabaseGet).mockResolvedValue([makeRow(0)]);
  await expect(getSessionLogsByRange(start, end)).rejects.toThrow("registros repetidos");
  expect(supabaseGet).toHaveBeenCalledTimes(2);
});
