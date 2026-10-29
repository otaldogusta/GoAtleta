import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { CalendarEventEditor } from "../CalendarEventEditor";
import { createEvent, updateEvent, setEventClasses, deleteEvent, type EventListItem } from "../../../api/events";
import { validateTournamentRules } from "../../../regulation/tournament-rule-check";
let mockOrganization = { id: "org-a", role_level: 50 };
let mockCurrent = true;
const mockConfirm = jest.fn(async () => true);
const mockToast = jest.fn();
const mockClose = jest.fn(), mockSaved = jest.fn();
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: "user-a" } } }) }));
jest.mock("../../../auth/session", () => ({ getSessionIdentity: () => ({ userId: "user-a", generation: 1 }), isSessionIdentityCurrent: () => mockCurrent }));
jest.mock("../../../providers/organization-context", () => ({ useOrganization: () => ({ activeOrganization: mockOrganization }) }));
jest.mock("../../../api/events", () => ({ createEvent: jest.fn(), updateEvent: jest.fn(), setEventClasses: jest.fn(), deleteEvent: jest.fn() }));
jest.mock("../../../regulation/tournament-rule-check", () => ({ validateTournamentRules: jest.fn() }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: new Proxy({}, { get: () => "#334455" }) }) }));
jest.mock("../../../ui/confirm-dialog", () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
jest.mock("../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: mockToast }) }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../../../ui/DatePickerModal", () => ({ DatePickerModal: () => null }));
jest.mock("../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: () => null }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
const event = { id: "event-a", organizationId: "org-a", title: "Torneio", description: "", startsAt: "2026-09-30T09:00:00", endsAt: "2026-09-30T10:00:00", eventType: "torneio", sport: "geral", classIds: [] } as unknown as EventListItem;
const props = { date: "2026-09-30", classes: [], onClose: mockClose, onSaved: mockSaved };
beforeEach(() => {
 jest.clearAllMocks(); mockCurrent = true; mockOrganization = { id: "org-a", role_level: 50 };
 jest.mocked(validateTournamentRules).mockResolvedValue({ ruleSetId: null, clauses: [], issues: [] });
 jest.mocked(createEvent).mockResolvedValue(event); jest.mocked(updateEvent).mockResolvedValue(event); jest.mocked(setEventClasses).mockResolvedValue(undefined);
 mockConfirm.mockResolvedValue(true);
});
test("creates in the selected month and refreshes only after event-class links complete", async () => {
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Reunião");
 fireEvent.press(view.getByText("Salvar evento"));
 await waitFor(() => expect(mockSaved).toHaveBeenCalledTimes(1));
 expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ title: "Reunião", organizationId: "org-a", startsAt: expect.stringContaining("2026-09-30") }));
 expect(setEventClasses).toHaveBeenCalledWith("event-a", "org-a", []);
 expect(mockClose).toHaveBeenCalledTimes(1);
});
test("prevents duplicate clicks and discards continuation after session change", async () => {
 let finish!: (value: { ruleSetId: null; clauses: []; issues: [] }) => void;
 jest.mocked(validateTournamentRules).mockReturnValue(new Promise(resolve => { finish = resolve; }));
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Reunião");
 fireEvent.press(view.getByText("Salvar evento")); fireEvent.press(view.getByText("Salvar evento"));
 mockCurrent = false;
 await act(async () => finish({ ruleSetId: null, clauses: [], issues: [] }));
 expect(validateTournamentRules).toHaveBeenCalledTimes(1); expect(createEvent).not.toHaveBeenCalled();
});
test("requires the existing administrator role and rejects foreign-organization events", async () => {
 mockOrganization.role_level = 10;
 const view = render(React.createElement(CalendarEventEditor, { ...props, event }));
 expect(view.queryByText("Editar evento")).toBeNull(); expect(view.queryByText("Excluir")).toBeNull();
 view.unmount(); mockOrganization.role_level = 50;
 const other = render(React.createElement(CalendarEventEditor, { ...props, event: { ...event, organizationId: "org-other" } }));
 fireEvent.press(other.getByText("Excluir"));
 expect(deleteEvent).not.toHaveBeenCalled(); expect(mockConfirm).not.toHaveBeenCalled();
});
test("refuses a late organization response and protects dirty drafts on close", async () => {
 let finish!: (value: { ruleSetId: null; clauses: []; issues: [] }) => void;
 jest.mocked(validateTournamentRules).mockReturnValue(new Promise(resolve => { finish = resolve; }));
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Reunião");
 mockConfirm.mockResolvedValueOnce(false);
 fireEvent.press(view.getByLabelText("Fechar evento"));
 await waitFor(() => expect(mockConfirm).toHaveBeenCalled()); expect(mockClose).not.toHaveBeenCalled();
 fireEvent.press(view.getByText("Salvar evento"));
 mockOrganization = { id: "org-b", role_level: 50 }; view.rerender(React.createElement(CalendarEventEditor, props));
 await act(async () => finish({ ruleSetId: null, clauses: [], issues: [] }));
 expect(createEvent).not.toHaveBeenCalled(); expect(mockSaved).not.toHaveBeenCalled();
});
test("a failed class-link write retries the created ID instead of duplicating the event", async () => {
 jest.mocked(setEventClasses).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Reunião"); fireEvent.press(view.getByText("Salvar evento"));
 await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" })));
 fireEvent.press(view.getByText("Salvar evento"));
 await waitFor(() => expect(mockSaved).toHaveBeenCalled());
 expect(createEvent).toHaveBeenCalledTimes(1); expect(updateEvent).toHaveBeenCalledWith("event-a", expect.any(Object));
});


test("editing keeps the event rule-set and deletion requires an explicit confirmation", async () => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, event: { ...event, ruleSetId: "rules-v1" } }));
 fireEvent.press(view.getByText("Editar evento"));
 fireEvent.changeText(view.getByLabelText("Título"), "Torneio atualizado");
 fireEvent.press(view.getByText("Salvar evento"));
 await waitFor(() => expect(updateEvent).toHaveBeenCalledWith("event-a", expect.objectContaining({ title: "Torneio atualizado", organizationId: "org-a" })));
 expect(validateTournamentRules).toHaveBeenCalledWith(expect.objectContaining({ existingRuleSetId: "rules-v1" }));
 expect(createEvent).not.toHaveBeenCalled(); view.unmount();
 mockConfirm.mockResolvedValueOnce(false);
 const detail = render(React.createElement(CalendarEventEditor, { ...props, event }));
 fireEvent.press(detail.getByText("Excluir"));
 await waitFor(() => expect(mockConfirm).toHaveBeenCalled()); expect(deleteEvent).not.toHaveBeenCalled();
 mockConfirm.mockResolvedValueOnce(true); fireEvent.press(detail.getByText("Excluir"));
 await waitFor(() => expect(deleteEvent).toHaveBeenCalledWith("event-a", "org-a"));
});
test("tournament warnings cannot be silently accepted", async () => {
 jest.mocked(validateTournamentRules).mockResolvedValue({ ruleSetId: null, clauses: [], issues: [{ severity: "warning", message: "Revisar horário" }] } as Awaited<ReturnType<typeof validateTournamentRules>>);
 mockConfirm.mockResolvedValueOnce(false);
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Encontro"); fireEvent.press(view.getByText("Salvar evento"));
 await waitFor(() => expect(mockConfirm).toHaveBeenCalled()); expect(createEvent).not.toHaveBeenCalled();
});

test("quick entry saves through the same guarded event flow with explicit time", async () => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, quick: true }));
 expect(view.queryByLabelText("Data de início")).toBeNull();
 fireEvent.changeText(view.getByLabelText("Título do evento rápido"), "Reunião às 18h");
 fireEvent.press(view.getByLabelText("Salvar evento rápido"));
 await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
 const saved = jest.mocked(createEvent).mock.calls[0][0];
 expect(saved.title).toBe("Reunião"); expect(new Date(saved.startsAt).getHours()).toBe(18);
 await waitFor(() => expect(mockSaved).toHaveBeenCalled());
});
test("opening details transfers the draft without writing or asking to discard", () => {
 const expand = jest.fn();
 const view = render(React.createElement(CalendarEventEditor, { ...props, quick: true, onExpand: expand }));
 fireEvent.changeText(view.getByLabelText("Título do evento rápido"), "Reunião às 18h");
 fireEvent.press(view.getByLabelText("Abrir detalhes do evento"));
 expect(expand).toHaveBeenCalledWith(expect.objectContaining({ title: "Reunião", startDate: props.date, startTime: "18:00", endTime: "19:00" }));
 expect(createEvent).not.toHaveBeenCalled(); expect(mockConfirm).not.toHaveBeenCalled();
});

test("quick partial save carries its ID to details, and details retries that ID", async () => {
 jest.mocked(setEventClasses).mockRejectedValueOnce(new Error("offline"));
 const expand = jest.fn();
 const quick = render(React.createElement(CalendarEventEditor, { ...props, quick: true, onExpand: expand }));
 fireEvent.changeText(quick.getByLabelText("Título do evento rápido"), "Reunião às 18h"); fireEvent.press(quick.getByLabelText("Salvar evento rápido"));
 await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" })));
 fireEvent.press(quick.getByLabelText("Abrir detalhes do evento"));
 expect(expand).toHaveBeenCalledWith(expect.objectContaining({ title: "Reunião" }), "event-a");
 const seed = expand.mock.calls[0][0]; quick.unmount();
 const details = render(React.createElement(CalendarEventEditor, { ...props, seed, resumeId: "event-a" }));
 fireEvent.press(details.getByText("Salvar evento"));
 await waitFor(() => expect(updateEvent).toHaveBeenCalledWith("event-a", expect.any(Object)));
 expect(createEvent).toHaveBeenCalledTimes(1);
});
