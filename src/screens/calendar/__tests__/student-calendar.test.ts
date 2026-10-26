import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import CalendarScreen from "../../../../app/calendar";
import type { ClassGroup } from "../../../core/models";
import { getClasses, getTrainingPlans, saveTrainingPlan } from "../../../db/seed";
import { listEvents } from "../../../api/events";
import { listCalendarPauses } from "../../../api/holiday-decisions";
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => "/student/agenda", useLocalSearchParams: () => ({ openApply: "1", targetClassId: "linked", targetDate: "2026-10-31" }) }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: "athlete" } } }) }));
jest.mock("../../../providers/organization-context", () => ({ useOrganization: () => ({ activeOrganization: { id: "other-org" } }) }));
jest.mock("../../../db/seed", () => ({ getClasses: jest.fn(), getTrainingPlans: jest.fn(), saveTrainingPlan: jest.fn(), getLatestTrainingPlanByClass: jest.fn() }));
jest.mock("../../../api/events", () => ({ listEvents: jest.fn() }));
jest.mock("../../../api/holiday-decisions", () => ({ listCalendarPauses: jest.fn() }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: () => null }));
jest.mock("../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: jest.fn() }) }));
jest.mock("../../../ui/use-modal-card-style", () => ({ useModalCardStyle: () => ({}) }));
jest.mock("../useEventSheetGesture", () => ({ useEventSheetGesture: () => ({ interacting: false, progress: { interpolate: () => 0 } }) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View, useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock("../../../components/ui/ScreenPageHeader", () => ({ ScreenPageHeader: ({ children }: {children: React.ReactNode}) => children }));
jest.mock("../NativeCalendarFold", () => ({ NativeCalendarFold: () => null }));
jest.mock("../NativeCalendarEvents", () => ({ NativeCalendarEvents: () => null }));
const linked = { id: "linked", name: "Treino vinculado", unit: "Quadra", daysOfWeek: [6], startTime: "13:30", durationMinutes: 60, colorKey: "blue" } as ClassGroup;
beforeEach(() => jest.clearAllMocks());
it("renders only supplied athlete classes without staff reads or management actions, even with apply URL params", async () => {
 const screen = render(React.createElement(CalendarScreen, { studentClasses: [linked] }));
 await waitFor(() => expect(screen.getByLabelText("2026-10-31, 1 aula")).toBeTruthy());
 fireEvent.press(screen.getByLabelText("2026-10-31, 1 aula"));
 fireEvent.press(screen.getByLabelText("13:30 - 14:30, Treino vinculado"));
 expect(mockPush).toHaveBeenCalledWith({ pathname: "/student-plan", params: { classId: "linked", date: "2026-10-31" } });
 expect(getClasses).not.toHaveBeenCalled(); expect(getTrainingPlans).not.toHaveBeenCalled();
 expect(listEvents).not.toHaveBeenCalled(); expect(listCalendarPauses).not.toHaveBeenCalled();
 expect(saveTrainingPlan).not.toHaveBeenCalled(); expect(screen.queryByText("Aplicar planejamento")).toBeNull();
});
it("clears athlete rows when the supplied scope becomes empty", async () => {
 const screen = render(React.createElement(CalendarScreen, { studentClasses: [linked] }));
 screen.rerender(React.createElement(CalendarScreen, { studentClasses: [] }));
 await waitFor(() => expect(screen.getByLabelText("2026-10-31, Sem agenda")).toBeTruthy());
 expect(screen.queryByText("Treino vinculado")).toBeNull();
});
it("distinguishes a failed read from an empty training day", () => {
 const screen = render(React.createElement(CalendarScreen, { studentClasses: [], studentError: true }));
 expect(screen.getByText("Não foi possível carregar seus treinos.")).toBeTruthy();
 expect(screen.queryByText("Nenhum treino neste dia.")).toBeNull();
 expect(getClasses).not.toHaveBeenCalled();
});
it("keeps the export month synchronized with calendar navigation", () => {
 const onMonthChange = jest.fn();
 const screen = render(React.createElement(CalendarScreen, { studentClasses: [], onMonthChange }));
 fireEvent.press(screen.getByLabelText("Próximo mês"));
 expect(onMonthChange.mock.calls.at(-1)?.[0]).toEqual(new Date(2026, 10, 1));
});
