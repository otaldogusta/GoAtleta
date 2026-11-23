import { act, renderHook, waitFor } from "@testing-library/react-native";
import { listHolidayMakeups, type HolidayMakeup } from "../../../api/holiday-makeups";
import { getClassCalendarExceptions } from "../../../db/periodization";
import { adjacentClassLesson, resolveAttendanceEntryDate } from "../application/class-lesson-calendar";
import { useClassLessonCalendar } from "../use-class-lesson-calendar";

jest.mock("../../../api/holiday-makeups", () => ({ listHolidayMakeups: jest.fn() }));
jest.mock("../../../db/periodization", () => ({ getClassCalendarExceptions: jest.fn() }));

const friday = "2026-11-20";
const monday = "2026-11-23";
const makeup: HolidayMakeup = { classId: "class-a", originalDate: friday, date: monday, startTime: "17:30" };

test("the date navigator skips the suspended Friday and includes its Monday makeup in both directions", () => {
  const paused = new Map([[friday, "Feriado"]]);
  const adjacent = (day: number, direction: -1 | 1) => adjacentClassLesson([5], new Date(2026, 10, day), direction, paused, [monday]);
  expect(adjacent(13, 1)).toEqual(new Date(2026, 10, 23));
  expect(adjacent(23, -1)).toEqual(new Date(2026, 10, 13));
  expect(adjacent(27, -1)).toEqual(new Date(2026, 10, 23));
  expect(adjacent(23, 1)).toEqual(new Date(2026, 10, 27));
});

test("a class switch discards late makeups, only the confirmed class/date closes for attendance", async () => {
  jest.mocked(getClassCalendarExceptions).mockResolvedValue([]);
  let previous!: (rows: HolidayMakeup[]) => void;
  jest.mocked(listHolidayMakeups).mockImplementationOnce(() => new Promise(resolve => { previous = resolve; }))
    .mockResolvedValueOnce([makeup, { ...makeup, classId: "class-b" }]);
  let classId = "class-a";
  const { result, rerender } = renderHook(() => useClassLessonCalendar(classId, "org", classId, true));
  classId = "class-b";
  rerender({});
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => { previous([makeup]); });
  expect(listHolidayMakeups).toHaveBeenCalledWith("org", "class-b");
  expect(result.current.makeups).toEqual([{ ...makeup, classId: "class-b" }]);
  expect(result.current.paused.has(friday)).toBe(true);
  expect(result.current.paused.has(monday)).toBe(false);
});

test("implicit Monday waits through a partial calendar, then selects the confirmed makeup or previous open Friday", async () => {
  const reference = new Date(2026, 10, 23);
  const paused = new Map([[friday, "Feriado"]]);
  const select = (dates: string[], ready: boolean, explicit = false) =>
    resolveAttendanceEntryDate(reference, explicit, [5], paused, dates, ready);
  expect(select([], false)).toBeNull();
  expect(select([], false, true)).toEqual(reference);
  expect(select([], true)).toEqual(new Date(2026, 10, 13));
  expect(select([monday], true)).toEqual(reference);
  expect(resolveAttendanceEntryDate(new Date(2026, 10, 27), false, [5], paused, [], false))
    .toEqual(new Date(2026, 10, 27));

  jest.mocked(getClassCalendarExceptions).mockResolvedValue([]);
  jest.mocked(listHolidayMakeups).mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce([makeup]);
  const { result } = renderHook(() => useClassLessonCalendar("scope-a", "org", "class-a", true));
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.pausesAvailable).toBe(true);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.makeupDates).toEqual([monday]);
});

test("only an offline refresh of the same scope can reuse confirmed makeup dates", async () => {
  jest.mocked(getClassCalendarExceptions).mockResolvedValue([]);
  jest.mocked(listHolidayMakeups).mockResolvedValueOnce([makeup]).mockRejectedValue(new Error("Failed to fetch"));
  let scope = "scope-a";
  const { result, rerender } = renderHook(() => useClassLessonCalendar(scope, "org", "class-a", true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.makeupDates).toEqual([monday]);
  scope = "scope-b";
  rerender({});
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.makeups).toEqual([]);
});
