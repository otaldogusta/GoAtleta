import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { Student } from "../../../../core/models";
import { projectStudentDirectoryRecord } from "../../../../core/student-read-models";
import { resolveStudentProfile } from "../../application/student-profile";
import { useStudentProfileDetail } from "../useStudentProfileDetail";

let mockIdentity = { userId: "user-a", generation: 1 };
let mockGeneration = 1;
const mockGet = jest.fn();
jest.mock("../../../../auth/session", () => ({ getSessionIdentity: () => ({ ...mockIdentity }) }));
jest.mock("../../../../db/client", () => ({ getReadCacheGeneration: () => mockGeneration }));
jest.mock("../../../../db/students", () => ({ getStudentById: (...args: unknown[]) => mockGet(...args) }));
const student = (id: string, organizationId = "org-a"): Student => ({ id, organizationId, name: `Atleta ${id}`, classId: "class-a", age: 16,
  phone: "11999990000", loginEmail: "fixture@example.test", guardianName: "Responsável", guardianPhone: "11999990001", guardianRelation: "Mãe",
  birthDate: "2010-01-01", healthIssue: false, healthIssueNotes: "Ficha completa", medicationUse: false, medicationNotes: "", healthObservations: "",
  positionPrimary: "indefinido", positionSecondary: "indefinido", athleteObjective: "base", learningStyle: "misto", createdAt: "2026-01-01",
  membershipStatus: "active", financialStatus: "unknown" });
const deferred = () => { let resolve!: (value: Student | null) => void; const promise = new Promise<Student | null>(done => { resolve = done; }); return { promise, resolve }; };
let latest!: ReturnType<typeof useStudentProfileDetail>;
function Probe({ id, org = "org-a", focused = true }: { id: string | null; org?: string; focused?: boolean }) {
  const value = useStudentProfileDetail(id, org, focused);
  React.useLayoutEffect(() => { latest = value; });
  return React.createElement("state", { studentId: value.student?.id, loading: value.loading, error: value.error });
}
let root: TestRenderer.ReactTestRenderer;
async function mount(id: string | null) { await act(async () => { root = TestRenderer.create(React.createElement(Probe, { id })); }); }
beforeEach(() => { mockGet.mockReset(); mockIdentity = { userId: "user-a", generation: 1 }; mockGeneration = 1; });
afterEach(async () => { if (root) await act(async () => root.unmount()); });
test("an ID absent from the authorized directory never requests a full record", async () => {
  const target = resolveStudentProfile("foreign", "org-a", [projectStudentDirectoryRecord(student("a"))], new Map());
  await mount(target?.student.id ?? null); expect(mockGet).not.toHaveBeenCalled(); expect(latest.student).toBeNull();
});
test("full details are unavailable while pending; closing cannot reopen a resolved selection", async () => {
  const job = deferred(); mockGet.mockReturnValue(job.promise); await mount("a");
  expect(latest.loading).toBe(true); expect(latest.student).toBeNull();
  await act(async () => root.update(React.createElement(Probe, { id: null })));
  await act(async () => job.resolve(student("a"))); expect(latest.student).toBeNull(); expect(latest.loading).toBe(false);
});
test("a late old target never overwrites the selected full record", async () => {
  const old = deferred(); mockGet.mockReturnValueOnce(old.promise).mockResolvedValueOnce(student("b")); await mount("a");
  await act(async () => root.update(React.createElement(Probe, { id: "b" })));
  await act(async () => old.resolve(student("a"))); expect(latest.student?.id).toBe("b");
});
test("an old replace callback cannot publish after closing and reopening the same athlete", async () => {
  mockGet.mockResolvedValueOnce(student("a")).mockResolvedValueOnce({ ...student("a"), healthIssueNotes: "fresh" });
  await mount("a"); const oldReplace = latest.replace;
  await act(async () => root.update(React.createElement(Probe, { id: null })));
  await act(async () => root.update(React.createElement(Probe, { id: "a" })));
  expect(latest.student?.healthIssueNotes).toBe("fresh");
  await act(async () => oldReplace({ ...student("a"), healthIssueNotes: "obsolete" }));
  expect(latest.student?.healthIssueNotes).toBe("fresh");
});
test.each(["focus", "organization", "identity"])("a %s round trip invalidates the original response even when its target ID matches again", async kind => {
  const old = deferred(), fresh = deferred(); mockGet.mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise); await mount("a");
  if (kind === "identity") mockIdentity = { userId: "user-b", generation: 2 };
  await act(async () => root.update(React.createElement(Probe, { id: "a", org: kind === "organization" ? "org-b" : "org-a", focused: kind !== "focus" })));
  if (kind === "identity") mockIdentity = { userId: "user-a", generation: 3 };
  await act(async () => root.update(React.createElement(Probe, { id: "a" })));
  await act(async () => old.resolve(student("a"))); expect(latest.student).toBeNull();
  await act(async () => fresh.resolve(student("a"))); expect(latest.student?.healthIssueNotes).toBe("Ficha completa");
});
test.each([student("wrong"), student("a", "org-b")])("mismatched full payload stays unavailable", async value => {
  mockGet.mockResolvedValue(value); await mount("a"); expect(latest.student).toBeNull(); expect(latest.error).toContain("indisponível");
});
test("a first offline detail shows the existing error composition and retry fetches a complete record", async () => {
  mockGet.mockRejectedValueOnce(new Error("Conecte-se à internet para carregar esta ficha pela primeira vez.")).mockResolvedValueOnce(student("a"));
  await mount("a"); expect(latest.student).toBeNull(); expect(latest.error).toContain("primeira vez");
  await act(async () => latest.retry()); expect(latest.student?.healthIssueNotes).toBe("Ficha completa");
});
