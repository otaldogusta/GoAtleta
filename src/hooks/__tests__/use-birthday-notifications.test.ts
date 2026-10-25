import { act, renderHook } from "@testing-library/react-native";

import type { EffectiveProfile } from "../../core/effective-profile";
import type { StudentBirthdayCandidate } from "../../db/students";
import { getStudentBirthdayCandidates } from "../../db/seed";
import { notifyBirthdays } from "../../notifications";
import { useBirthdayNotifications } from "../use-birthday-notifications";

let mockLastChecks: Record<string, string> = {};
let mockStorageLoaded = true;
let mockSessionIdentity = { userId: "user-a", generation: 1 };
const mockSetLastChecks = jest.fn();

jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ ...mockSessionIdentity }),
  isSessionIdentityCurrent: (identity: typeof mockSessionIdentity) =>
    identity.userId === mockSessionIdentity.userId && identity.generation === mockSessionIdentity.generation,
}));
jest.mock("../../db/seed", () => ({ getStudentBirthdayCandidates: jest.fn() }));
jest.mock("../../notifications", () => ({ notifyBirthdays: jest.fn() }));
jest.mock("../../ui/use-persisted-state", () => ({
  usePersistedState: () => [mockLastChecks, mockSetLastChecks, mockStorageLoaded],
}));

const candidate: StudentBirthdayCandidate = { id: "student-a", name: "Atleta fictício", birthDate: "2010-10-23" };
const useCheck = (organizationId = "org-a", effectiveProfile: EffectiveProfile = "professor", enabled = true) =>
  useBirthdayNotifications({ enabled, organizationId, effectiveProfile });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 9, 23, 12, 0, 0) });
  mockLastChecks = {};
  mockStorageLoaded = true;
  mockSessionIdentity = { userId: "user-a", generation: 1 };
  jest.mocked(getStudentBirthdayCandidates).mockResolvedValue([]);
  jest.mocked(notifyBirthdays).mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());

test("keeps local-date filtering, profile route and notification dedupe with the small projection", async () => {
  jest.mocked(getStudentBirthdayCandidates).mockResolvedValue([
    candidate,
    { id: "other-day", name: "Outra data", birthDate: "2010-10-24" },
    { id: "no-date", name: "Sem data", birthDate: "" },
  ]);
  renderHook(() => useCheck());
  await act(async () => undefined);
  expect(getStudentBirthdayCandidates).toHaveBeenCalledWith({ organizationId: "org-a" });
  expect(notifyBirthdays).toHaveBeenCalledWith(["Atleta fictício"], expect.objectContaining({
    actionUrl: "/prof/students", sourceType: "students", sourceId: "birthday:org-a:2026-10-23", dedupe: true,
    metadata: { studentIds: ["student-a"], date: "2026-10-23" },
  }));
  const update = mockSetLastChecks.mock.calls[0][0];
  expect(update({ "other-org": "2026-10-22" })).toEqual({ "other-org": "2026-10-22", "org-a": "2026-10-23" });
});

test("preserves the coordination action route", async () => {
  jest.mocked(getStudentBirthdayCandidates).mockResolvedValue([candidate]);
  renderHook(() => useCheck("org-a", "admin"));
  await act(async () => undefined);
  expect(notifyBirthdays).toHaveBeenCalledWith([candidate.name], expect.objectContaining({ actionUrl: "/coord/students" }));
});

test.each(["student", "family"] as const)("does not load the directory for %s", async (profile) => {
  renderHook(() => useCheck("org-a", profile));
  await act(async () => undefined);
  expect(getStudentBirthdayCandidates).not.toHaveBeenCalled();
});

test.each(["disabled", "storage pending", "already checked"])("does no work when %s", async (state) => {
  mockStorageLoaded = state !== "storage pending";
  mockLastChecks = state === "already checked" ? { "org-a": "2026-10-23" } : {};
  renderHook(() => useCheck("org-a", "professor", state !== "disabled"));
  await act(async () => undefined);
  expect(getStudentBirthdayCandidates).not.toHaveBeenCalled();
  expect(notifyBirthdays).not.toHaveBeenCalled();
});

test("does not mark a failed load as checked", async () => {
  jest.mocked(getStudentBirthdayCandidates).mockRejectedValue(new Error("network"));
  renderHook(() => useCheck());
  await act(async () => undefined);
  expect(mockSetLastChecks).not.toHaveBeenCalled();
});

test("does not mark a failed notification as checked", async () => {
  jest.mocked(getStudentBirthdayCandidates).mockResolvedValue([candidate]);
  jest.mocked(notifyBirthdays).mockRejectedValue(new Error("notification unavailable"));
  renderHook(() => useCheck());
  await act(async () => undefined);
  expect(mockSetLastChecks).not.toHaveBeenCalled();
});

test("ignores a response from the previous organization after switching workspace", async () => {
  let release!: (students: StudentBirthdayCandidate[]) => void;
  jest.mocked(getStudentBirthdayCandidates).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const { rerender } = renderHook(({ organizationId }) => useCheck(organizationId), { initialProps: { organizationId: "org-a" } });
  rerender({ organizationId: "org-b" });
  await act(async () => { release([candidate]); });
  expect(notifyBirthdays).not.toHaveBeenCalled();
  expect(mockSetLastChecks.mock.calls.map(([update]) => update({}))).toEqual([{ "org-b": "2026-10-23" }]);
});

test("ignores a response after unmount", async () => {
  let release!: (students: StudentBirthdayCandidate[]) => void;
  jest.mocked(getStudentBirthdayCandidates).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const { unmount } = renderHook(() => useCheck());
  unmount();
  await act(async () => { release([candidate]); });
  expect(notifyBirthdays).not.toHaveBeenCalled();
  expect(mockSetLastChecks).not.toHaveBeenCalled();
});

test("ignores a response after the session rotates even for the same user", async () => {
  let release!: (students: StudentBirthdayCandidate[]) => void;
  jest.mocked(getStudentBirthdayCandidates).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  renderHook(() => useCheck());
  mockSessionIdentity = { userId: "user-a", generation: 3 };
  await act(async () => { release([candidate]); });
  expect(notifyBirthdays).not.toHaveBeenCalled();
  expect(mockSetLastChecks).not.toHaveBeenCalled();
});
