import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEmbeddedClassAttendance } from "../use-embedded-class-attendance";
import { loadEmbeddedAttendance, saveAttendanceRecords } from "../../../db/seed";
import type { AttendanceRecord, Student } from "../../../core/models";
import {
  clearAttendanceDraftIfCurrent, getAttendanceDraft, listOfflineAttendanceDrafts,
  markAttendanceDraftConflict, setAttendanceDraftEdit,
} from "../../../db/attendance-draft";

jest.mock("../../../db/seed", () => ({
  loadEmbeddedAttendance: jest.fn(), saveAttendanceRecords: jest.fn(),
}));
jest.mock("../use-attendance-date-guard", () => ({useAttendanceDateGuard: () => (run: () => void) => run()}));
jest.mock("../../../hooks/schedule-effect-task", () => ({scheduleEffectTask: (run: () => void) => {run(); return () => undefined;}}));
jest.mock("../../../hooks/use-is-online", () => ({ useIsOnline: () => mockOnline }));
jest.mock("../../../core/smart-sync", () => ({ smartSync: { scheduleSyncAfterWrite: jest.fn() } }));
jest.mock("../../../db/pending-write-identity", () => ({
  ...jest.requireActual("../../../db/pending-write-identity"),
  getCurrentPendingWriteOrigin: async () => mockActiveOrigin,
}));

const history = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map(date => ({
  id: date, classId: "class", studentId: "review", date, status: "faltou",
} as AttendanceRecord));
const students = [
  {id: "active", membershipStatus: "active"}, {id: "review", membershipStatus: "active"},
  {id: "inactive", membershipStatus: "inactive"},
] as Student[];
const origin = { userId: "coach", organizationId: "organization" };
const assertCurrent = async () => {};
const date = "2026-10-05";
let mockActiveOrigin = origin;
let mockOnline = true;
let dayRecords: AttendanceRecord[];

beforeEach(async () => {
  jest.useFakeTimers({now: new Date("2026-10-05T12:00:00")});
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockActiveOrigin = origin;
  mockOnline = true;
  dayRecords = [];
  jest.mocked(loadEmbeddedAttendance).mockImplementation(async (_classId, _date, resolveRoster) => ({
    students: resolveRoster(students, dayRecords, history), records: dayRecords,
    origin, assertCurrent, offline: false,
  }));
  (saveAttendanceRecords as jest.Mock).mockResolvedValue({status: "synced"});
});
afterEach(() => jest.useRealTimers());

test("loads the same review-aware roster and preserves hidden saved records", async () => {
  const opaque = {...history[0], studentId: "moved", date: "2026-10-05"};
  dayRecords = [opaque];
  const {result} = renderHook(() => useEmbeddedClassAttendance({classId: "class", date: "2026-10-05", enabled: true}));
  await waitFor(() => expect(result.current.students.map(s => s.id)).toEqual(["active"]));
  expect(result.current.markedCount).toBe(0);
  act(() => result.current.setStudentStatus("active", "presente"));
  await act(async () => {await result.current.save();});
  expect(saveAttendanceRecords).toHaveBeenCalledWith("class", "2026-10-05", expect.arrayContaining([
    opaque, expect.objectContaining({studentId: "active", status: "presente"}),
  ]), { origin });
});

test("does not offer an unchecked roster if review history fails to load", async () => {
  jest.mocked(loadEmbeddedAttendance).mockRejectedValue(new Error("offline"));
  const {result} = renderHook(() => useEmbeddedClassAttendance({classId: "class", date: "2026-10-05", enabled: true}));
  await waitFor(() => expect(result.current.loadFailed).toBe(true));
  expect(result.current.students).toEqual([]);
  await act(async () => {expect(await result.current.save()).toBeNull();});
  expect(saveAttendanceRecords).not.toHaveBeenCalled();
});

test("restores an unconfirmed online draft with details after closing, and clears it on Save", async () => {
  const useEditor = () => useEmbeddedClassAttendance({ classId: "class", date, enabled: true });
  const first = renderHook(useEditor);
  await waitFor(() => expect(first.result.current.students.map(({ id }) => id)).toEqual(["active"]));
  act(() => {
    first.result.current.setStudentStatus("active", "presente");
    first.result.current.setStudentDetails("active", { note: "Dor ao saltar", painScore: 2 });
  });
  await waitFor(() => expect(first.result.current.isDraftDurable).toBe(true));
  expect(await listOfflineAttendanceDrafts()).toEqual([]);
  expect(saveAttendanceRecords).not.toHaveBeenCalled();
  first.unmount();

  const reopened = renderHook(useEditor);
  await waitFor(() => expect(reopened.result.current.statusById.active).toBe("presente"));
  expect(reopened.result.current.detailsById.active).toEqual({ note: "Dor ao saltar", painScore: 2 });
  expect(reopened.result.current.hasPersistedAttendance).toBe(false);
  expect(reopened.result.current.hasChanges).toBe(true);
  await act(async () => { await reopened.result.current.save(); });
  expect(await getAttendanceDraft("class", date)).toBeNull();
});

test("the cold offline editor retains marks locally without starting an official save", async () => {
  mockOnline = false;
  const localSnapshot = { students: [{ id: "active", name: "Ana" }], records: [], date, origin, assertCurrent };
  const { result } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true, localSnapshot }));
  await waitFor(() => expect(result.current.students).toEqual(localSnapshot.students));
  act(() => result.current.setStudentStatus("active", "faltou"));
  await waitFor(() => expect(result.current.isDraftDurable).toBe(true));
  await act(async () => { expect(await result.current.save()).toBeNull(); });
  expect(loadEmbeddedAttendance).not.toHaveBeenCalled();
  expect(saveAttendanceRecords).not.toHaveBeenCalled();
  expect(await listOfflineAttendanceDrafts()).toMatchObject([{ edits: [{ studentId: "active", after: { status: "faltou" } }] }]);
});

test("a draft acknowledgement preserves a newer change and conflicts stay on the device", async () => {
  const scope = { classId: "class", date, origin };
  const marked = { status: "presente", note: "", painScore: 0 } as const;
  await setAttendanceDraftEdit({ ...scope, studentId: "active", before: null, after: marked, offline: true });
  const [inFlight] = await listOfflineAttendanceDrafts();
  await setAttendanceDraftEdit({ ...scope, studentId: "active", before: null, after: null, offline: true });
  await clearAttendanceDraftIfCurrent(inFlight);
  const [reversal] = await listOfflineAttendanceDrafts();
  expect(reversal.edits).toEqual([{ studentId: "active", before: marked, after: null, offline: true }]);
  await markAttendanceDraftConflict(reversal);
  expect(await listOfflineAttendanceDrafts()).toEqual([]);
  expect(await getAttendanceDraft("class")).toMatchObject({ conflicted: true, edits: reversal.edits });
  mockActiveOrigin = { ...origin, organizationId: "another-organization" };
  expect(await getAttendanceDraft("class", date)).toBeNull();
  mockActiveOrigin = { ...origin, userId: "another-coach" };
  expect(await listOfflineAttendanceDrafts()).toEqual([]);
});

test("continuing an online draft offline promotes the whole day through the conditional sync", async () => {
  const scope = { classId: "class", date, origin };
  const marked = { status: "presente", note: "", painScore: 0 } as const;
  await setAttendanceDraftEdit({ ...scope, studentId: "active", before: null, after: marked, offline: false });
  expect(await listOfflineAttendanceDrafts()).toEqual([]);
  await setAttendanceDraftEdit({ ...scope, studentId: "other", before: null, after: marked, offline: true });
  const [pending] = await listOfflineAttendanceDrafts();
  expect(pending.edits).toEqual(expect.arrayContaining([
    expect.objectContaining({ studentId: "active", offline: true }),
    expect.objectContaining({ studentId: "other", offline: true }),
  ]));
  const { result } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.draftPendingSync).toBe(true));
  await act(async () => { expect(await result.current.save()).toBeNull(); });
  expect(saveAttendanceRecords).not.toHaveBeenCalled();
});

test("a mark written while an acknowledgement is clearing storage rebases on that acknowledgement", async () => {
  const scope = { classId: "class", date, origin };
  const marked = { status: "presente", note: "", painScore: 0 } as const;
  const latest = { ...marked, status: "faltou" } as const;
  await setAttendanceDraftEdit({ ...scope, studentId: "active", before: null, after: marked, offline: true });
  const [inFlight] = await listOfflineAttendanceDrafts();
  const acknowledge = clearAttendanceDraftIfCurrent(inFlight);
  const edit = setAttendanceDraftEdit({ ...scope, studentId: "active", before: null, after: latest, offline: true });
  await Promise.all([acknowledge, edit]);
  const [pending] = await listOfflineAttendanceDrafts();
  expect(pending.edits).toEqual([{ studentId: "active", before: marked, after: latest, offline: true }]);
});

test("a conflicting draft blocks a blind replacement until the teacher reviews it", async () => {
  const marked = { status: "presente", note: "", painScore: 0 } as const;
  await setAttendanceDraftEdit({ classId: "class", date, origin, studentId: "active", before: null, after: marked, offline: true });
  const [conflict] = await listOfflineAttendanceDrafts();
  await markAttendanceDraftConflict(conflict);
  dayRecords = [{ ...history[0], date, studentId: "active", status: "faltou" }];
  const { result } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.draftConflict).toBe(true));
  await act(async () => { expect(await result.current.save()).toBeNull(); });
  expect(saveAttendanceRecords).not.toHaveBeenCalled();
  act(() => result.current.setStudentDetails("active", { note: "Conferido", painScore: 0 }));
  await waitFor(() => expect(result.current.draftConflict).toBe(false));
  await act(async () => { await result.current.save(); });
  expect(saveAttendanceRecords).toHaveBeenCalledTimes(1);
});

test("an explicit discard removes the known draft after navigating away", async () => {
  const { result, unmount } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.students.map(({ id }) => id)).toEqual(["active"]));
  act(() => result.current.setStudentStatus("active", "presente"));
  await waitFor(() => expect(result.current.isDraftDurable).toBe(true));
  act(() => result.current.discardChanges());
  unmount();
  await waitFor(async () => expect(await getAttendanceDraft("class", date)).toBeNull());
});

test("discard shows the newer revision when another editor has already updated the draft", async () => {
  const { result } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.students.map(({ id }) => id)).toEqual(["active"]));
  act(() => result.current.setStudentStatus("active", "presente"));
  await waitFor(() => expect(result.current.isDraftDurable).toBe(true));
  const newer = await setAttendanceDraftEdit({
    classId: "class", date, origin, studentId: "active", before: null,
    after: { status: "faltou", note: "Outra aba", painScore: 0 }, offline: false,
  });

  act(() => result.current.discardChanges());
  await waitFor(() => expect(result.current.statusById.active).toBe("faltou"));
  expect(result.current.detailsById.active.note).toBe("Outra aba");
  expect(result.current.isDraftDurable).toBe(true);
  expect(result.current.hasChanges).toBe(true);
  expect(result.current.error).toBe("O rascunho mudou enquanto você descartava. Confira as marcações.");
  expect((await getAttendanceDraft("class", date))?.revision).toBe(newer?.revision);
});

test("an edit made during discard persists after the known draft is removed", async () => {
  jest.mocked(loadEmbeddedAttendance).mockResolvedValue({
    students: [{ id: "active", name: "Ana" }, { id: "other", name: "Bia" }],
    records: [], origin, assertCurrent, offline: false,
  });
  const { result } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.students).toHaveLength(2));
  act(() => result.current.setStudentStatus("active", "presente"));
  await waitFor(() => expect(result.current.isDraftDurable).toBe(true));

  act(() => {
    result.current.discardChanges();
    result.current.setStudentStatus("other", "faltou");
  });
  await waitFor(() => expect(result.current.isDraftDurable).toBe(true));
  expect(result.current.statusById).toEqual({ active: undefined, other: "faltou" });
  expect((await getAttendanceDraft("class", date))?.edits.map(({ studentId }) => studentId)).toEqual(["other"]);
});

test("a storage failure leaves the unsaved mark visible without claiming durability", async () => {
  const { result } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.students.map(({ id }) => id)).toEqual(["active"]));
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("storage unavailable"));
  act(() => result.current.setStudentStatus("active", "presente"));
  await waitFor(() => expect(result.current.error).toBe("Não foi possível guardar o rascunho no dispositivo."));
  expect(result.current.statusById.active).toBe("presente");
  expect(result.current.isDraftDurable).toBe(false);
});

test("a successful write for another student cannot hide a failed offline edit", async () => {
  mockOnline = false;
  jest.mocked(loadEmbeddedAttendance).mockResolvedValue({
    students: [{ id: "active", name: "Ana" }, { id: "other", name: "Bia" }],
    records: [], origin, assertCurrent, offline: true,
  });
  const { result, rerender } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.students).toHaveLength(2));

  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("storage unavailable"));
  act(() => {
    result.current.setStudentStatus("active", "presente");
    result.current.setStudentStatus("other", "faltou");
  });
  await waitFor(() => expect(result.current.draftPendingSync).toBe(true));
  expect(result.current.statusById).toEqual({ active: "presente", other: "faltou" });
  expect(result.current.isDraftDurable).toBe(false);
  expect(result.current.error).toBe("Não foi possível guardar o rascunho no dispositivo.");
  const [partial] = await listOfflineAttendanceDrafts();
  expect(partial.edits.map(({ studentId }) => studentId)).toEqual(["other"]);

  mockOnline = true;
  rerender(undefined);
  await act(async () => { await clearAttendanceDraftIfCurrent(partial); });
  expect(loadEmbeddedAttendance).toHaveBeenCalledTimes(1);
  expect(result.current.statusById.active).toBe("presente");
  expect(result.current.isDraftDurable).toBe(false);
  await act(async () => { expect(await result.current.save()).toBeNull(); });
  expect(saveAttendanceRecords).not.toHaveBeenCalled();

  act(() => result.current.setStudentDetails("active", { note: "Revisada", painScore: 0 }));
  await waitFor(() => expect(result.current.isDraftDurable).toBe(true));
  expect(result.current.error).toBeNull();
  expect(await listOfflineAttendanceDrafts()).toMatchObject([{
    edits: [{ studentId: "active", after: { status: "presente", note: "Revisada" } }],
  }]);
});

test("discard clears the last successful draft even when a newer write failed", async () => {
  jest.mocked(loadEmbeddedAttendance).mockResolvedValue({
    students: [{ id: "active", name: "Ana" }, { id: "other", name: "Bia" }],
    records: [], origin, assertCurrent, offline: false,
  });
  const { result } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.students).toHaveLength(2));
  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(write).mockRejectedValueOnce(new Error("storage unavailable"));
  act(() => {
    result.current.setStudentStatus("other", "faltou");
    result.current.setStudentStatus("active", "presente");
  });
  await waitFor(() => expect(result.current.error).toBe("Não foi possível guardar o rascunho no dispositivo."));
  act(() => result.current.discardChanges());
  await waitFor(() => expect(result.current.isDraftDurable).toBe(true));
  expect(result.current.hasChanges).toBe(false);
  expect(await getAttendanceDraft("class", date)).toBeNull();
});

test("a draft read failure keeps the checked attendance available", async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("storage unavailable"));
  const { result } = renderHook(() => useEmbeddedClassAttendance({ classId: "class", date, enabled: true }));
  await waitFor(() => expect(result.current.students.map(({ id }) => id)).toEqual(["active"]));
  expect(result.current.loadFailed).toBe(false);
  expect(result.current.isDraftDurable).toBe(false);
  expect(result.current.error).toContain("Não foi possível ler a última cópia");
});
