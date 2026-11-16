import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import AgendaScreen from "../../../../app/agenda";
import { getClassById, getClasses } from "../../../db/seed";
import type { ClassGroup } from "../../../core/models";

type CalendarProps = { studentClasses: ClassGroup[]; studentLoading: boolean; studentError: boolean; onStudentRetry: () => void };
let mockStudent = { classId: "class-a", organizationId: "org-a" };
const mockCalendarRender = jest.fn<void, [CalendarProps]>();
const mockCalendarMount = jest.fn();
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn() }));
jest.mock("../../../../app/calendar", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  return { __esModule: true, default: function CalendarStub(props: CalendarProps) {
    mockCalendarRender(props);
    ReactModule.useEffect(() => { mockCalendarMount(); }, []);
    return null;
  } };
});
jest.mock("../CalendarExportMenu", () => ({ CalendarExportMenu: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({}), usePathname: () => "/student/agenda" }));
jest.mock("../../../auth/role", () => ({ useRole: () => ({ role: "student", student: mockStudent }) }));
jest.mock("../../../providers/organization-context", () => ({ useOptionalOrganization: () => ({ activeOrganization: { id: "unrelated-staff-org" } }) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../db/seed", () => ({ getClassById: jest.fn(), getClasses: jest.fn() }));
jest.mock("../../../observability/perf", () => ({ markRender: jest.fn(), measureAsync: (_label: string, run: () => Promise<unknown>) => run() }));
const read = jest.mocked(getClassById);
const group = (id: string, organizationId: string) => ({ id, organizationId, name: id, daysOfWeek: [1], startTime: "14:00", durationMinutes: 60 }) as ClassGroup;
const latest = () => mockCalendarRender.mock.calls.at(-1)![0];
function deferred() {
  let resolve!: (value: ClassGroup | null) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ClassGroup | null>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks(); read.mockReset(); mockStudent = { classId: "class-a", organizationId: "org-a" };
});

test("retries only the linked class, clears the error while loading and keeps the calendar mounted", async () => {
  read.mockRejectedValueOnce(new Error("Unavailable"));
  render(React.createElement(AgendaScreen));
  await waitFor(() => expect(latest().studentError).toBe(true));
  const response = deferred(); read.mockReturnValueOnce(response.promise);
  act(() => latest().onStudentRetry());
  expect(latest().studentError).toBe(false);
  expect(latest().studentLoading).toBe(true);
  expect(latest().studentClasses).toEqual([]);
  expect(read).toHaveBeenNthCalledWith(2, "class-a", { organizationId: "org-a" });
  await act(async () => { response.resolve(group("class-a", "org-a")); await response.promise; });
  expect(latest().studentLoading).toBe(false);
  expect(latest().studentError).toBe(false);
  expect(latest().studentClasses.map(item => item.id)).toEqual(["class-a"]);
  expect(mockCalendarMount).toHaveBeenCalledTimes(1);
  expect(getClasses).not.toHaveBeenCalled();
});

test.each(["success", "failure"])("ignores an old retry's %s after the linked class and organization change", async (outcome) => {
  read.mockRejectedValueOnce(new Error("Unavailable"));
  const screen = render(React.createElement(AgendaScreen));
  await waitFor(() => expect(latest().studentError).toBe(true));
  const old = deferred(); read.mockReturnValueOnce(old.promise);
  act(() => latest().onStudentRetry());
  const current = deferred(); read.mockReturnValueOnce(current.promise);
  mockStudent = { classId: "class-b", organizationId: "org-b" };
  screen.rerender(React.createElement(AgendaScreen));
  expect(latest().studentLoading).toBe(true);
  expect(latest().studentClasses).toEqual([]);
  expect(read).toHaveBeenLastCalledWith("class-b", { organizationId: "org-b" });
  await act(async () => { current.resolve(group("class-b", "org-b")); await current.promise; });
  await act(async () => {
    if (outcome === "success") old.resolve(group("class-a", "org-a"));
    else old.reject(new Error("Old failure"));
    await Promise.resolve();
  });
  expect(latest().studentLoading).toBe(false);
  expect(latest().studentError).toBe(false);
  expect(latest().studentClasses.map(item => item.id)).toEqual(["class-b"]);
  expect(getClasses).not.toHaveBeenCalled();
});
