import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";

import CalendarScreen from "../../../../app/calendar";
import { getCalendarTrainingPlanApplications, getTrainingPlanById, getTrainingPlanSummaries, type TrainingPlanSummary } from "../../../db/training";
import { getClasses, getLatestTrainingPlanByClass, getTrainingPlans, saveTrainingPlan } from "../../../db/seed";
import type { ClassGroup, TrainingPlan } from "../../../core/models";
import { RootWebShell } from "../../../ui/RootWebShell";

let mockOrganization = { id: "org-a" };
let mockGeneration = 1;
let mockParams: Record<string, string> = { targetDate: "2026-10-23", targetClassId: "class-a" };
let mockPathname = "/prof/calendar";
const mockToast = jest.fn();
const mockCalendarPush = jest.fn();
const mockCalendarSetParams = jest.fn((params: Record<string, string>) => { mockParams = { ...mockParams, ...params }; });
const mockColors = new Proxy({}, { get: () => "#334455" });
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockCalendarPush, replace: jest.fn(), setParams: mockCalendarSetParams }), useRoute: () => ({ key: "calendar-public-origin-key", name: "calendar", params: mockParams }), useNavigationContainerRef: () => ({ current: { getRootState: () => ({ routes: [] }) } }), usePathname: () => mockPathname, useLocalSearchParams: () => mockParams }));
jest.mock("../../../hooks/use-effective-profile", () => ({ useEffectiveProfile: () => "professor" }));
jest.mock("../../../ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: "teacher-a" } } }) }));
jest.mock("../../../auth/session", () => ({ getSessionIdentity: () => ({ userId: "teacher-a", generation: 1 }) }));
jest.mock("../../../db/client", () => ({ getReadCacheGeneration: () => mockGeneration }));
jest.mock("../../../providers/organization-context", () => ({ useOrganization: () => ({ activeOrganization: mockOrganization }) }));
jest.mock("../../../db/training", () => ({ getCalendarTrainingPlanApplications: jest.fn(), getTrainingPlanSummaries: jest.fn(), getTrainingPlanById: jest.fn() }));
jest.mock("../../../db/seed", () => ({ getClasses: jest.fn(), getTrainingPlans: jest.fn(), getLatestTrainingPlanByClass: jest.fn(), saveTrainingPlan: jest.fn() }));
jest.mock("../../../api/holiday-decisions", () => ({ listCalendarPauses: async () => [] }));
jest.mock("../../../api/events", () => ({ listEvents: async () => [] }));
jest.mock("../../../observability/perf", () => ({ markRender: () => undefined, measureAsync: (_name: string, load: () => Promise<unknown>) => load() }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: mockColors }) }));
jest.mock("../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: mockToast }) }));
jest.mock("../../../ui/use-modal-card-style", () => ({ useModalCardStyle: () => ({}) }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/class-colors", () => ({ getClassPalette: () => ({ bg: "#123456", text: "#eeeeee" }) }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View, useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }) }));
jest.mock("../../../components/ui/ScreenPageHeader", () => ({ ScreenPageHeader: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../../../components/ui/ScreenLoadingState", () => ({ ScreenLoadingState: () => null }));
jest.mock("../CalendarFold", () => ({ CalendarFold: () => null }));
jest.mock("../NativeCalendarFold", () => ({ NativeCalendarFold: () => null }));
jest.mock("../CalendarWeekPager", () => ({ CalendarWeekPager: () => null }));
jest.mock("../CalendarUnitSelect", () => {
  const runtimeReact = jest.requireActual("react");
  const { Pressable, Text } = jest.requireActual("react-native");
  return { CalendarUnitSelect: ({ options, onChange }: { options: string[]; onChange: (value: string) => void }) => runtimeReact.createElement(runtimeReact.Fragment, null, options.map(option => runtimeReact.createElement(Pressable, { key: option, accessibilityLabel: `Selecionar unidade ${option}`, onPress: () => onChange(option) }, runtimeReact.createElement(Text, null, option)))) };
});
jest.mock("../CalendarEventSheet", () => {
  const runtimeReact = jest.requireActual("react");
  return { CalendarEventSheet: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => runtimeReact.createElement(runtimeReact.Fragment, null, header, children) };
});
jest.mock("../useEventSheetGesture", () => ({ useEventSheetGesture: () => ({ interacting: false, progress: 0, nativeMotion: null }) }));

const classGroup = (id: string, name: string, unit = "Centro", ageBand = "12-14"): ClassGroup => ({
  id, name, unit, ageBand, organizationId: "org-a", startTime: "14:00", daysOfWeek: [5], durationMinutes: 60, createdAt: "2020-01-01", gender: "misto", colorKey: "green",
} as ClassGroup);
const classes = [classGroup("class-a", "Turma Alfa"), classGroup("class-b", "Turma Compatível", "centro"), classGroup("other-unit", "Outra unidade", "Sul"), classGroup("other-age", "Outra idade", "Centro", "15-17")];
const fullPlan: TrainingPlan = {
  id: "plan-b", classId: "class-b", title: "Treino autoral completo", tags: ["passe"], applyDate: "2025-01-01", applyDays: [], createdAt: "2026-10-20T12:00:00Z", version: 3, status: "final",
  warmup: ["Aquecimento autoral"], main: ["Sequência principal autoral"], cooldown: ["Retorno autoral"], warmupTime: "12", mainTime: "38", cooldownTime: "10",
};
const summary: TrainingPlanSummary = {
  id: fullPlan.id, classId: fullPlan.classId, title: fullPlan.title, tags: fullPlan.tags,
  applyDate: fullPlan.applyDate, applyDays: fullPlan.applyDays, createdAt: fullPlan.createdAt,
  version: fullPlan.version, status: fullPlan.status,
};
const flush = () => act(async () => { for (let tick = 0; tick < 20; tick += 1) await Promise.resolve(); });
beforeEach(() => {
  jest.clearAllMocks();
  mockOrganization = { id: "org-a" };
  mockGeneration = 1;
  mockParams = { targetDate: "2026-10-23", targetClassId: "class-a" };
  mockPathname = "/prof/calendar";
  jest.mocked(getClasses).mockResolvedValue(classes);
  jest.mocked(getCalendarTrainingPlanApplications).mockResolvedValue([]);
  jest.mocked(getTrainingPlanSummaries).mockResolvedValue([summary]);
  jest.mocked(getTrainingPlanById).mockResolvedValue(fullPlan);
  jest.mocked(getLatestTrainingPlanByClass).mockResolvedValue({ ...fullPlan, version: 7 });
  jest.mocked(saveTrainingPlan).mockResolvedValue(undefined);
});

test("starts the small grid read independently of classes, and does not load full plans while the picker is closed", async () => {
  let release!: (value: ClassGroup[]) => void;
  jest.mocked(getClasses).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const view = render(React.createElement(CalendarScreen));
  await flush();
  expect(getCalendarTrainingPlanApplications).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-a", startDate: "2026-09-28", endDate: "2026-11-08" }));
  expect(getTrainingPlans).not.toHaveBeenCalled();
  expect(getTrainingPlanSummaries).not.toHaveBeenCalled();
  expect(getTrainingPlanById).not.toHaveBeenCalled();
  await act(async () => release(classes));
  expect(view.getByText("Turma Alfa")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Próximo mês"));
  await flush();
  expect(jest.mocked(getCalendarTrainingPlanApplications).mock.calls.at(-1)![0]).toMatchObject({ startDate: "2026-10-26", endDate: "2026-12-06" });
}, 20_000);

test("web agenda carries the public focused calendar leaf key into the class origin context",async()=>{
  const original=Object.getOwnPropertyDescriptor(Platform,"OS")!;
  Object.defineProperty(Platform,"OS",{configurable:true,value:"web"});
  try {
    const view=render(React.createElement(CalendarScreen));await flush();
    fireEvent.press(view.getByText("Turma Alfa"));
    expect(mockCalendarPush).toHaveBeenCalledWith(expect.objectContaining({pathname:"/class/[id]",params:expect.objectContaining({id:"class-a",calendarSource:"prof",calendarDate:"2026-10-23",calendarOriginKey:"calendar-public-origin-key"})}));
  } finally {Object.defineProperty(Platform,"OS",original);}
});

test.each([false, true])("restores the clicked day across the real shared shell boundary (unit change: %s)", async changeUnit => {
  const originalOS = Object.getOwnPropertyDescriptor(Platform, "OS")!;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  jest.useFakeTimers({ now: new Date(2026, 9, 24, 12) });
  try {
    mockParams = { initial: "false", unknown: "keep-me" };
    const secondClass = { ...classGroup("class-002", "Turma 002", "Stress 02"), daysOfWeek: [2] };
    jest.mocked(getClasses).mockResolvedValue([secondClass]);
    const screen = () => React.createElement(RootWebShell, null, React.createElement(CalendarScreen));
    const view = render(screen());
    await flush();
    expect(view.getByRole("header", { name: "24 de outubro" })).toBeTruthy();
    fireEvent.press(view.getByLabelText(/^2026-10-27,/));
    if (changeUnit) {
      fireEvent.press(view.getByLabelText("Selecionar unidade Stress 02"));
      view.rerender(screen());
      await flush();
      expect(mockParams).toMatchObject({ targetDate: "2026-10-27", unit: "Stress 02" });
    }
    expect(view.getByRole("header", { name: "27 de outubro" })).toBeTruthy();
    fireEvent.press(view.getByText("Turma 002"));
    expect(mockCalendarPush).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ calendarDate: "2026-10-27", calendarOriginKey: "calendar-public-origin-key" }) }));

    // RootWebShell changes Fragment → AppShell on a shared class route. The
    // navigator can preserve the route key while its screen remounts underneath.
    mockPathname = "/class/class-002";
    view.rerender(screen());
    await flush();
    expect(view.getByRole("header", { name: "27 de outubro" })).toBeTruthy();
    expect(mockParams).toMatchObject({ initial: "false", unknown: "keep-me", targetDate: "2026-10-27", unit: changeUnit ? "Stress 02" : "Todas" });
    expect(mockCalendarSetParams.mock.invocationCallOrder.at(-1)).toBeLessThan(mockCalendarPush.mock.invocationCallOrder[0]);
    mockPathname = "/prof/calendar";
    view.rerender(screen());
    await flush();
    expect(view.getByRole("header", { name: "27 de outubro" })).toBeTruthy();
    expect(view.getByText("Turma 002")).toBeTruthy();
  } finally {
    jest.useRealTimers();
    Object.defineProperty(Platform, "OS", originalOS);
  }
});

test.each(["android", "ios"])("%s keeps the existing unit parameters and agenda navigation", async platform => {
  const originalOS = Object.getOwnPropertyDescriptor(Platform, "OS")!;
  Object.defineProperty(Platform, "OS", { configurable: true, value: platform });
  try {
    const view = render(React.createElement(CalendarScreen));
    await flush();
    fireEvent.press(view.getByLabelText("Selecionar unidade Centro"));
    expect(mockCalendarSetParams).toHaveBeenCalledWith({ unit: "Centro" });
    mockCalendarSetParams.mockClear();
    fireEvent.press(view.getByText("Turma Alfa"));
    expect(mockCalendarSetParams).not.toHaveBeenCalled();
    expect(mockCalendarPush).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ calendarSource: "prof", calendarDate: "2026-10-23", calendarUnit: "Centro" }) }));
    expect(mockCalendarPush.mock.calls[0][0].params).not.toHaveProperty("calendarOriginKey");
  } finally {
    Object.defineProperty(Platform, "OS", originalOS);
  }
});

test("an incoming target date restores both the displayed month and selected agenda day", async () => {
  const view = render(React.createElement(CalendarScreen));
  await flush();
  mockParams = { ...mockParams, targetDate: "2026-11-06" };
  view.rerender(React.createElement(CalendarScreen));
  await flush();
  expect(view.getByRole("header", { name: "6 de novembro" })).toBeTruthy();
  expect(view.getByText("Turma Alfa")).toBeTruthy();
});

test("loads all compatible classes only on opening the picker and applies the full authored body", async () => {
  const view = render(React.createElement(CalendarScreen));
  await flush();
  expect(getTrainingPlans).not.toHaveBeenCalled();
  mockParams = { ...mockParams, openApply: "1" };
  view.rerender(React.createElement(CalendarScreen));
  await flush();
  expect(getTrainingPlanSummaries).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-a", classIds: ["class-a", "class-b"] }));
  expect(getTrainingPlanById).not.toHaveBeenCalled();
  expect(getTrainingPlans).not.toHaveBeenCalled();
  expect(view.getByText(fullPlan.title)).toBeTruthy();
  fireEvent.press(view.getByText("Aplicar na aula do dia"));
  await flush();
  expect(getTrainingPlanById).toHaveBeenCalledWith(fullPlan.id, { organizationId: "org-a" });
  expect(saveTrainingPlan).toHaveBeenCalledWith(expect.objectContaining({
    classId: "class-a", applyDate: "2026-10-23", applyDays: [], version: 8,
    warmup: fullPlan.warmup, main: fullPlan.main, cooldown: fullPlan.cooldown,
    warmupTime: "12", mainTime: "38", cooldownTime: "10", parentPlanId: fullPlan.id,
  }), { organizationId: "org-a" });
});

test("shows grid and picker failures instead of presenting an authorized empty result", async () => {
  jest.mocked(getCalendarTrainingPlanApplications).mockRejectedValue(new Error("403"));
  jest.mocked(getTrainingPlanSummaries).mockRejectedValue(new Error("network"));
  mockParams = { ...mockParams, openApply: "1" };
  const view = render(React.createElement(CalendarScreen));
  await flush();
  expect(view.getByText("Não foi possível carregar os planejamentos.")).toBeTruthy();
  expect(view.getByText("Não foi possível carregar os planos disponíveis.")).toBeTruthy();
  expect(saveTrainingPlan).not.toHaveBeenCalled();
});

test.each([null, new Error("network"), { ...fullPlan, classId: "other-unit" }])("does not apply an unavailable or incompatible full body (%s)", async response => {
  mockParams = { ...mockParams, openApply: "1" };
  if (response instanceof Error) jest.mocked(getTrainingPlanById).mockRejectedValueOnce(response);
  else jest.mocked(getTrainingPlanById).mockResolvedValueOnce(response);
  const view = render(React.createElement(CalendarScreen));
  await flush();
  fireEvent.press(view.getByText("Aplicar na aula do dia"));
  await flush();
  expect(saveTrainingPlan).not.toHaveBeenCalled();
  expect(view.getByText("Aplicar planejamento")).toBeTruthy();
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: response instanceof Error ? "error" : "warning" }));
});

test.each(["close", "workspace", "round trip"])("discards a delayed body after picker %s without writing", async change => {
  let release!: (plan: TrainingPlan) => void;
  jest.mocked(getTrainingPlanById).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  mockParams = { ...mockParams, openApply: "1" };
  const view = render(React.createElement(CalendarScreen));
  await flush();
  fireEvent.press(view.getByText("Aplicar na aula do dia"));
  await flush();
  if (change === "close") fireEvent.press(view.getByText("Fechar"));
  else {
    if (change === "workspace") mockOrganization = { id: "org-b" };
    mockGeneration += 2;
    view.rerender(React.createElement(CalendarScreen));
  }
  await act(async () => release(fullPlan));
  await flush();
  expect(saveTrainingPlan).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
});

test("coalesces repeated apply clicks while the selected full body is loading", async () => {
  let release!: (plan: TrainingPlan) => void;
  jest.mocked(getTrainingPlanById).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  mockParams = { ...mockParams, openApply: "1" };
  const view = render(React.createElement(CalendarScreen));
  await flush();
  const button = view.getByText("Aplicar na aula do dia");
  fireEvent.press(button);
  fireEvent.press(button);
  await flush();
  expect(getTrainingPlanById).toHaveBeenCalledTimes(1);
  expect(saveTrainingPlan).not.toHaveBeenCalled();
  await act(async () => release(fullPlan));
  await flush();
  expect(saveTrainingPlan).toHaveBeenCalledTimes(1);
});

test("a late previous-workspace response cannot replace current classes or plans", async () => {
  let release!: (value: ClassGroup[]) => void;
  jest.mocked(getClasses).mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValueOnce([classGroup("class-new", "Turma Beta")]);
  const view = render(React.createElement(CalendarScreen));
  mockOrganization = { id: "org-b" };
  mockGeneration += 1;
  view.rerender(React.createElement(CalendarScreen));
  await flush();
  await act(async () => release(classes));
  expect(view.queryByText("Turma Alfa")).toBeNull();
  expect(view.getByText("Turma Beta")).toBeTruthy();
});
