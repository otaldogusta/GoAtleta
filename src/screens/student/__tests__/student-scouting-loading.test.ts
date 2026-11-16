import React from "react";
import { act, fireEvent, fireEventAsync, render, renderAsync, waitFor } from "@testing-library/react-native";
import StudentScouting from "../../../../app/student-scouting";
import { getClassById, getStudentScoutingByDate, saveStudentScoutingLog } from "../../../db/seed";
import { navigateBackOrReplace } from "../../../navigation/safe-router";
import type { ClassGroup, StudentScoutingLog } from "../../../core/models";

let mockStudent: { id: string; classId: string; organizationId?: string };
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../../auth/role", () => ({ useRole: () => ({ student: mockStudent, loading: false }) }));
jest.mock("../../../db/seed", () => ({ getClassById: jest.fn(), getStudentScoutingByDate: jest.fn(), saveStudentScoutingLog: jest.fn() }));
jest.mock("../../../navigation/safe-router", () => ({ navigateBackOrReplace: jest.fn() }));
jest.mock("../../../observability/perf", () => ({ markRender: jest.fn(), measureAsync: (_name: string, run: () => unknown) => run() }));
jest.mock("../../../ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../../../components/ui/ScreenPageHeader", () => ({ ScreenPageHeader: () => null }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa", background: "#000", card: "#111", border: "#333", dangerText: "#faa" } }) }));
jest.mock("../../../ui/use-responsive-layout", () => ({ useResponsiveLayout: () => ({ maxContentWidth: 960, gutter: 16, supportsSplitView: false, density: { cardPadding: 16, pageGap: 16 } }) }));

const group = { id: "class-a", organizationId: "student-org", name: "Turma vinculada", daysOfWeek: [5], startTime: "18:00" } as ClassGroup;
const log = { studentId: "student-a", classId: "class-a", serve0: 7, serve1: 0, serve2: 0, receive0: 0, receive1: 0, receive2: 0, set0: 0, set1: 0, set2: 0, attackSend0: 0, attackSend1: 0, attackSend2: 0 } as StudentScoutingLog;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 10, 13, 18, 30) });
  mockStudent = { id: "student-a", classId: "class-a", organizationId: "student-org" };
  (getClassById as jest.Mock).mockResolvedValue(group);
  (getStudentScoutingByDate as jest.Mock).mockResolvedValue(null);
  (saveStudentScoutingLog as jest.Mock).mockResolvedValue({});
});
afterEach(() => { jest.useRealTimers(); });

it("loads the linked class with enrollment organization before reading the athlete's day", async () => {
  const screen = render(React.createElement(StudentScouting));
  await waitFor(() => expect(screen.getByText("Turma vinculada")).toBeTruthy());
  await waitFor(() => expect(screen.getByLabelText("Salvar scouting").props.accessibilityState.disabled).toBe(false));
  expect(getClassById).toHaveBeenCalledWith("class-a", { organizationId: "student-org" });
  expect(getStudentScoutingByDate).toHaveBeenCalledWith("student-a", "class-a", "2026-11-13");
  expect(screen.getByLabelText("Salvar scouting").props.accessibilityState.disabled).toBe(false);
});

it("does not fall back to an active workspace without an enrollment organization", async () => {
  mockStudent = { id: "student-a", classId: "class-a" };
  const screen = render(React.createElement(StudentScouting));
  await waitFor(() => expect(screen.getByText("Nenhuma turma disponível")).toBeTruthy());
  expect(getClassById).not.toHaveBeenCalled();
  expect(getStudentScoutingByDate).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Salvar scouting").props.accessibilityState.disabled).toBe(true);
});

it("does not read the log when the class lookup returns no authorized class", async () => {
  (getClassById as jest.Mock).mockResolvedValue(null);
  const screen = render(React.createElement(StudentScouting));
  await waitFor(() => expect(screen.getByText("Nenhuma turma disponível")).toBeTruthy());
  expect(getStudentScoutingByDate).not.toHaveBeenCalled();
});

it("distinguishes a failed log read from empty counts and retries the current enrollment", async () => {
  (getStudentScoutingByDate as jest.Mock).mockRejectedValueOnce(new Error("Offline"));
  const screen = render(React.createElement(StudentScouting));
  await waitFor(() => expect(screen.getByText("Não foi possível carregar seu scouting")).toBeTruthy());
  expect(screen.queryByLabelText("Aumentar Saque, nota 0")).toBeNull();
  expect(screen.getByLabelText("Salvar scouting").props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByText("Tentar novamente"));
  await waitFor(() => expect(screen.getByLabelText("Aumentar Saque, nota 0")).toBeTruthy());
  expect(getClassById).toHaveBeenLastCalledWith("class-a", { organizationId: "student-org" });
});

it("discards an old scouting response after changing enrollment", async () => {
  let resolveOld!: (value: StudentScoutingLog) => void;
  (getStudentScoutingByDate as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(null);
  const screen = render(React.createElement(StudentScouting));
  await waitFor(() => expect(getStudentScoutingByDate).toHaveBeenCalled());
  mockStudent = { id: "student-b", classId: "class-b", organizationId: "other-org" };
  (getClassById as jest.Mock).mockResolvedValue({ ...group, id: "class-b", organizationId: "other-org", name: "Outra turma" });
  screen.rerender(React.createElement(StudentScouting));
  await waitFor(() => expect(screen.getByText("Outra turma")).toBeTruthy());
  await waitFor(() => expect(screen.getByLabelText("Salvar scouting").props.accessibilityState.disabled).toBe(false));
  await act(async () => { resolveOld(log); });
  expect(screen.queryByText("7")).toBeNull();
  expect(screen.queryByText("Turma vinculada")).toBeNull();
  expect(getStudentScoutingByDate).toHaveBeenLastCalledWith("student-b", "class-b", "2026-11-13");
});

it("keeps the enrollment organization on save and preserves counts if saving fails", async () => {
  (saveStudentScoutingLog as jest.Mock).mockRejectedValueOnce(new Error("Offline"));
  const screen = await renderAsync(React.createElement(StudentScouting));
  expect(screen.getByLabelText("Salvar scouting").props.accessibilityState.disabled).toBe(false);
  await fireEventAsync.press(screen.getByLabelText("Aumentar Saque, nota 0"));
  await fireEventAsync.press(screen.getByLabelText("Salvar scouting"));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(saveStudentScoutingLog).toHaveBeenCalledWith(expect.objectContaining({ studentId: "student-a", classId: "class-a", serve0: 1 }), { organizationId: "student-org" });
  expect(navigateBackOrReplace).not.toHaveBeenCalled();
  await fireEventAsync.press(screen.getByLabelText("Salvar scouting"));
  expect(navigateBackOrReplace).toHaveBeenCalledTimes(1);
  expect(saveStudentScoutingLog).toHaveBeenLastCalledWith(expect.objectContaining({ serve0: 1 }), { organizationId: "student-org" });
});

it("does not navigate away from a new enrollment after an old save completes", async () => {
  let resolveOld!: () => void;
  (saveStudentScoutingLog as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { resolveOld = resolve; }));
  const screen = await renderAsync(React.createElement(StudentScouting));
  expect(screen.getByLabelText("Salvar scouting").props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByLabelText("Salvar scouting"));
  expect(saveStudentScoutingLog).toHaveBeenCalledTimes(1);
  mockStudent = { id: "student-b", classId: "class-b", organizationId: "other-org" };
  await screen.rerenderAsync(React.createElement(StudentScouting));
  expect(getClassById).toHaveBeenLastCalledWith("class-b", { organizationId: "other-org" });
  await act(async () => { resolveOld(); });
  expect(navigateBackOrReplace).not.toHaveBeenCalled();
});
