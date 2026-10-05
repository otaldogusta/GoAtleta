import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useEmbeddedClassAttendance } from "../use-embedded-class-attendance";
import { getAttendanceByClass, getAttendanceByDate, getStudentsByClass, saveAttendanceRecords } from "../../../db/seed";
import type { AttendanceRecord, Student } from "../../../core/models";

jest.mock("../../../db/seed", () => ({
  getStudentsByClass: jest.fn(), getAttendanceByDate: jest.fn(),
  getAttendanceByClass: jest.fn(), saveAttendanceRecords: jest.fn(),
}));
jest.mock("../use-attendance-date-guard", () => ({useAttendanceDateGuard: () => (run: () => void) => run()}));
jest.mock("../../../hooks/schedule-effect-task", () => ({scheduleEffectTask: (run: () => void) => {run(); return () => undefined;}}));

const history = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map(date => ({
  id: date, classId: "class", studentId: "review", date, status: "faltou",
} as AttendanceRecord));

beforeEach(() => {
  jest.useFakeTimers({now: new Date("2026-10-05T12:00:00")});
  jest.clearAllMocks();
  (getStudentsByClass as jest.Mock).mockResolvedValue([
    {id: "active", membershipStatus: "active"}, {id: "review", membershipStatus: "active"},
    {id: "inactive", membershipStatus: "inactive"},
  ] as Student[]);
  (getAttendanceByDate as jest.Mock).mockResolvedValue([]);
  (getAttendanceByClass as jest.Mock).mockResolvedValue(history);
  (saveAttendanceRecords as jest.Mock).mockResolvedValue({status: "synced"});
});
afterEach(() => jest.useRealTimers());

test("loads the same review-aware roster and preserves hidden saved records", async () => {
  const opaque = {...history[0], studentId: "moved", date: "2026-10-05"};
  (getAttendanceByDate as jest.Mock).mockResolvedValue([opaque]);
  const {result} = renderHook(() => useEmbeddedClassAttendance({classId: "class", date: "2026-10-05", enabled: true}));
  await waitFor(() => expect(result.current.students.map(s => s.id)).toEqual(["active"]));
  expect(getStudentsByClass).toHaveBeenCalledWith("class", {includeInactive: true});
  expect(result.current.markedCount).toBe(0);
  act(() => result.current.setStudentStatus("active", "presente"));
  await act(async () => {await result.current.save();});
  expect(saveAttendanceRecords).toHaveBeenCalledWith("class", "2026-10-05", expect.arrayContaining([
    opaque, expect.objectContaining({studentId: "active", status: "presente"}),
  ]));
});

test("does not offer an unchecked roster if review history fails to load", async () => {
  (getAttendanceByClass as jest.Mock).mockRejectedValue(new Error("offline"));
  const {result} = renderHook(() => useEmbeddedClassAttendance({classId: "class", date: "2026-10-05", enabled: true}));
  await waitFor(() => expect(result.current.loadFailed).toBe(true));
  expect(result.current.students).toEqual([]);
  await act(async () => {expect(await result.current.save()).toBeNull();});
  expect(saveAttendanceRecords).not.toHaveBeenCalled();
});
