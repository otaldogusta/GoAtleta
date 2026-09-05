import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

import AttendanceScreen from "../../../../app/class/[id]/attendance";
import type { AttendanceRecord, ClassGroup, Student } from "../../../core/models";

const mockGetClassById = jest.fn();
const mockGetStudentsByClass = jest.fn();
const mockGetAttendanceByDate = jest.fn();
const mockSaveAttendanceRecords = jest.fn();
const mockShowSaveToast = jest.fn();
let mockRouteParams = { id: "class-1", date: "2026-09-01" };
type BeforeRemoveEvent = { preventDefault: () => void; data: { action: { type: string } } };
const mockBeforeRemoveListeners = new Set<(event: BeforeRemoveEvent) => void>();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
const mockNavigation = {
  dispatch: jest.fn(),
  addListener: (_event: string, listener: (event: BeforeRemoveEvent) => void) => {
    mockBeforeRemoveListeners.add(listener);
    return () => mockBeforeRemoveListeners.delete(listener);
  },
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
}));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ signOut: jest.fn() }) }));
jest.mock("../../../db/seed", () => ({
  getClassById: (...args: unknown[]) => mockGetClassById(...args),
  getStudentsByClass: (...args: unknown[]) => mockGetStudentsByClass(...args),
  getAttendanceByClass: jest.fn().mockResolvedValue([]),
  getAttendanceByDate: (...args: unknown[]) => mockGetAttendanceByDate(...args),
  saveAttendanceRecords: (...args: unknown[]) => mockSaveAttendanceRecords(...args),
  listActiveStudentContextsByClass: jest.fn().mockResolvedValue([]),
  saveConfirmedStudentContexts: jest.fn().mockResolvedValue({ savedCount: 0, notificationFailures: 0 }),
}));
jest.mock("../../../db/client", () => ({ isAuthError: () => false, isNetworkError: () => false }));
jest.mock("../../../observability/breadcrumbs", () => ({ logAction: jest.fn() }));
jest.mock("../../../observability/perf", () => ({ measure: (_name: string, action: () => Promise<unknown>) => action() }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: mockShowSaveToast }) }));
jest.mock("../../../hooks/use-is-online", () => ({ useIsOnline: () => true }));
jest.mock("../../../ui/use-responsive-layout", () => ({ useResponsiveLayout: () => ({ isMobile: false }) }));
jest.mock("../../../ui/use-persisted-state", () => ({
  usePersistedState: (_key: string, initial: unknown) => jest.requireActual<typeof import("react")>("react").useState(initial),
}));
jest.mock("../../../ui/class-colors", () => ({ getClassPalette: () => ({}) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual<typeof import("react-native")>("react-native").View }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual<typeof import("react-native")>("react-native").Pressable }));
jest.mock("../../../components/ui/ResponsivePage", () => ({ ResponsivePage: jest.requireActual<typeof import("react-native")>("react-native").View }));
jest.mock("../../../components/ui/ScreenLoadingState", () => ({ ScreenLoadingState: () => null }));
jest.mock("../../../components/ui/BackTitleHeader", () => ({ BackTitleHeader: () => null }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/ClassGenderBadge", () => ({ ClassGenderBadge: () => null }));
jest.mock("../../../ui/SyncStatusBadge", () => ({
  SyncStatusBadge: ({ message }: { message: string }) =>
    jest.requireActual<typeof import("react")>("react").createElement(
      jest.requireActual<typeof import("react-native")>("react-native").Text, {}, message,
    ),
}));
jest.mock("../../../ui/DatePickerModal", () => ({ DatePickerModal: () => null }));
jest.mock("../../../ui/DateInput", () => ({
  DateInput: ({ value, onChange, accessibilityLabel }: {
    value: string; onChange: (value: string) => void; accessibilityLabel: string;
  }) => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").TextInput, {
    value, onChangeText: onChange, accessibilityLabel,
  }),
}));
jest.mock("../../../ui/ConfirmCloseOverlay", () => ({
  ConfirmCloseOverlay: ({ visible, onDiscard }: { visible: boolean; onDiscard: () => void }) => visible
    ? jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Pressable, {
      accessibilityLabel: "Descartar alterações", onPress: onDiscard,
    }) : null,
}));

const classGroup = {
  id: "class-1", name: "Turma teste", daysOfWeek: [], startTime: "09:00", durationMinutes: 60,
  createdAt: "2026-01-01T12:00:00.000Z",
} as ClassGroup;
const student = { id: "student-1", name: "Aluna teste", classId: classGroup.id, membershipStatus: "active" } as Student;
const recordOnSecondDate: AttendanceRecord = {
  id: "record-second-date", classId: classGroup.id, studentId: student.id,
  date: "2026-09-02", status: "faltou", note: "Registro da segunda data", painScore: 0,
  createdAt: "2026-09-02T12:00:00.000Z",
};

function deferredSave() {
  let resolve!: (value: { status: "synced" }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ status: "synced" }>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function openMarkedAttendance() {
  const screen = render(React.createElement(AttendanceScreen));
  await waitFor(() => {
    expect(mockGetAttendanceByDate).toHaveBeenCalledWith(classGroup.id, "2026-09-01");
    expect(screen.getByLabelText("Presente: Aluna teste")).toBeEnabled();
  });
  fireEvent.press(screen.getByLabelText("Presente: Aluna teste"));
  expect(screen.getByLabelText("Salvar chamada")).toBeEnabled();
  return screen;
}

describe("attendance save navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRouteParams = { id: "class-1", date: "2026-09-01" };
    mockBeforeRemoveListeners.clear();
    mockGetClassById.mockResolvedValue(classGroup);
    mockGetStudentsByClass.mockResolvedValue([student]);
    mockGetAttendanceByDate.mockImplementation(async (_classId: string, date: string) =>
      date === recordOnSecondDate.date ? [recordOnSecondDate] : []);
  });
  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("blocks date changes and route removal until the pending save finishes", async () => {
    const pending = deferredSave();
    mockSaveAttendanceRecords.mockReturnValue(pending.promise);
    const screen = await openMarkedAttendance();
    const save = screen.getByLabelText("Salvar chamada");
    act(() => {
      fireEvent.press(save);
      fireEvent.press(save);
    });
    expect(mockSaveAttendanceRecords).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Próximo dia")).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Data da chamada: 01/09/2026"), "2026-09-02");
    const event = { preventDefault: jest.fn(), data: { action: { type: "GO_BACK" } } };
    act(() => { mockBeforeRemoveListeners.forEach((listener) => listener(event)); });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Descartar alterações")).toBeNull();
    expect(mockGetAttendanceByDate).not.toHaveBeenCalledWith(classGroup.id, "2026-09-02");

    await act(async () => { pending.resolve({ status: "synced" }); await pending.promise; });
    expect(screen.getByLabelText("Próximo dia")).toBeEnabled();
    const afterSaveEvent = { preventDefault: jest.fn(), data: { action: { type: "GO_BACK" } } };
    act(() => { mockBeforeRemoveListeners.forEach((listener) => listener(afterSaveEvent)); });
    expect(afterSaveEvent.preventDefault).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText("Data da chamada: 01/09/2026"), "2026-09-02");
    await waitFor(() => expect(mockGetAttendanceByDate).toHaveBeenCalledWith(classGroup.id, "2026-09-02"));
  });

  it.each(["success", "failure"] as const)("ignores an old save %s after a route parameter loads another date", async (outcome) => {
    const pending = deferredSave();
    mockSaveAttendanceRecords.mockReturnValue(pending.promise);
    const screen = await openMarkedAttendance();
    fireEvent.press(screen.getByLabelText("Salvar chamada"));
    expect(screen.getByText("Salvando chamada...")).toBeTruthy();
    expect(mockSaveAttendanceRecords).toHaveBeenCalledWith(classGroup.id, "2026-09-01", [
      expect.objectContaining({ date: "2026-09-01", status: "presente" }),
    ]);

    mockRouteParams = { id: classGroup.id, date: "2026-09-02" };
    screen.rerender(React.createElement(AttendanceScreen));
    await waitFor(() => {
      expect(screen.getByLabelText("Data da chamada: 02/09/2026").props.value).toBe("2026-09-02");
      expect(screen.getByLabelText("Faltou: Aluna teste").props.accessibilityState.checked).toBe(true);
      expect(screen.queryByText("Salvando chamada...")).toBeNull();
    });

    await act(async () => {
      if (outcome === "success") pending.resolve({ status: "synced" });
      else pending.reject(new Error("old request failed"));
      await pending.promise.catch(() => undefined);
    });
    expect(screen.getByLabelText("Faltou: Aluna teste").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("Presente: Aluna teste").props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText("Salvar chamada")).toBeDisabled();
    expect(screen.getByLabelText("Próximo dia")).toBeEnabled();
    expect(screen.queryByText("Salvando chamada...")).toBeNull();
    expect(mockShowSaveToast).not.toHaveBeenCalled();
  });
});
