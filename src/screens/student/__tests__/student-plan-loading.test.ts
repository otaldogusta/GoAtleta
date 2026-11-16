import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import StudentPlanScreen from "../../../../app/student-plan";
import { getLatestTrainingPlanByClass, getTrainingPlans } from "../../../db/seed";
import type { TrainingPlan } from "../../../core/models";

let mockStudent: { id: string; classId: string; organizationId?: string };
let mockParams: { classId?: string; date?: string };
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock("../../../auth/role", () => ({ useRole: () => ({ student: mockStudent, loading: false }) }));
jest.mock("../../../db/seed", () => ({ getTrainingPlans: jest.fn(), getLatestTrainingPlanByClass: jest.fn() }));
jest.mock("../../../observability/perf", () => ({ markRender: jest.fn(), measureAsync: (_name: string, run: () => unknown) => run() }));
jest.mock("../../../ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../../../components/ui/ScreenPageHeader", () => ({ ScreenPageHeader: () => null }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa", background: "#000", card: "#111", border: "#333" } }) }));
jest.mock("../../../ui/use-responsive-layout", () => ({ useResponsiveLayout: () => ({ maxContentWidth: 960, gutter: 16, density: { cardPadding: 16, pageGap: 16 } }) }));

const plan = {
  id: "plan-a", classId: "class-a", title: "Recepção publicada", status: "final",
  createdAt: "2026-11-12T09:00:00Z", applyDate: "2026-11-12",
  warmup: ["Mobilidade"], main: ["Recepção em dupla"], cooldown: [],
  warmupTime: "10 min", mainTime: "40 min", cooldownTime: "10 min",
} as TrainingPlan;

beforeEach(() => {
  jest.clearAllMocks();
  mockStudent = { id: "student-a", classId: "class-a", organizationId: "student-org" };
  mockParams = { classId: "class-a", date: "2026-11-12" };
  (getTrainingPlans as jest.Mock).mockResolvedValue([plan]);
  (getLatestTrainingPlanByClass as jest.Mock).mockResolvedValue(plan);
});

it("loads the selected date with the enrolled student's organization and final plans", async () => {
  const screen = render(React.createElement(StudentPlanScreen));
  await waitFor(() => expect(screen.getByText("Recepção publicada")).toBeTruthy());
  expect(getTrainingPlans).toHaveBeenCalledWith({ organizationId: "student-org", classId: "class-a" });
  expect(getLatestTrainingPlanByClass).not.toHaveBeenCalled();
});

it("scopes the latest published plan to the same enrollment", async () => {
  mockParams = {};
  const screen = render(React.createElement(StudentPlanScreen));
  await waitFor(() => expect(screen.getByText("Recepção publicada")).toBeTruthy());
  expect(getLatestTrainingPlanByClass).toHaveBeenCalledWith("class-a", { organizationId: "student-org" });
  expect(getTrainingPlans).not.toHaveBeenCalled();
});

it("does not fall back to a workspace when enrollment has no organization", async () => {
  mockStudent = { id: "student-a", classId: "class-a" };
  const screen = render(React.createElement(StudentPlanScreen));
  await waitFor(() => expect(screen.getByText("Ainda não há plano para este dia")).toBeTruthy());
  expect(getTrainingPlans).not.toHaveBeenCalled();
  expect(getLatestTrainingPlanByClass).not.toHaveBeenCalled();
});

it("distinguishes a failed read from an empty day and retries the same scope", async () => {
  (getTrainingPlans as jest.Mock).mockRejectedValueOnce(new Error("Offline"));
  const screen = render(React.createElement(StudentPlanScreen));
  await waitFor(() => expect(screen.getByText("Não foi possível carregar o plano")).toBeTruthy());
  expect(screen.queryByText("Ainda não há plano para este dia")).toBeNull();
  fireEvent.press(screen.getByText("Tentar novamente"));
  await waitFor(() => expect(screen.getByText("Recepção publicada")).toBeTruthy());
  expect(getTrainingPlans).toHaveBeenLastCalledWith({ organizationId: "student-org", classId: "class-a" });
});

it("discards an old response after changing the enrollment scope", async () => {
  let resolveOld!: (value: TrainingPlan[]) => void;
  (getTrainingPlans as jest.Mock).mockImplementationOnce(() => new Promise<TrainingPlan[]>(resolve => { resolveOld = resolve; })).mockResolvedValueOnce([]);
  const screen = render(React.createElement(StudentPlanScreen));
  mockStudent = { id: "student-b", classId: "class-b", organizationId: "other-org" };
  mockParams = { classId: "class-b", date: "2026-11-12" };
  screen.rerender(React.createElement(StudentPlanScreen));
  await waitFor(() => expect(screen.getByText("Ainda não há plano para este dia")).toBeTruthy());
  await act(async () => { resolveOld([plan]); });
  expect(screen.queryByText("Recepção publicada")).toBeNull();
  expect(getTrainingPlans).toHaveBeenLastCalledWith({ organizationId: "other-org", classId: "class-b" });
});

it("keeps legacy published plans without a status and excludes generated drafts", async () => {
  (getTrainingPlans as jest.Mock).mockResolvedValue([
    { ...plan, status: undefined, title: "Plano legado publicado", version: 1 },
    { ...plan, id: "draft", status: "generated", title: "Rascunho reservado", version: 2 },
  ]);
  const screen = render(React.createElement(StudentPlanScreen));
  await waitFor(() => expect(screen.getByText("Plano legado publicado")).toBeTruthy());
  expect(screen.queryByText("Rascunho reservado")).toBeNull();
  expect(getTrainingPlans).toHaveBeenCalledWith({ organizationId: "student-org", classId: "class-a" });
});
