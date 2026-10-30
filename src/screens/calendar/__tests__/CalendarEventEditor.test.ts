import React from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { CalendarEventEditor } from "../CalendarEventEditor";
import { createEvent, updateEvent, setEventClasses, deleteEvent, type EventListItem } from "../../../api/events";
import { validateTournamentRules } from "../../../regulation/tournament-rule-check";
import { initialEventDraft } from "../application/event-draft";
import { ensureEventAttachmentsAvailable, type EventAttachment } from "../../../api/event-attachments";
import { CalendarEntryDetails } from "../CalendarEntryDetails";
import { copyCalendarEntry, exportCalendarEntry, shareCalendarEntry } from "../application/share-calendar-entry";
let mockOrganization = { id: "org-a", role_level: 50 };
let mockCurrent = true;
let mockFocused = true;
let mockReducedMotion = true;
let mockDimensions = { width: 1036, height: 704 };
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
const mockConfirm = jest.fn(async () => true);
const mockToast = jest.fn();
const mockClose = jest.fn(), mockSaved = jest.fn();
const mockDatePicker = jest.fn();
const mockModal = jest.fn();
const mockAttachmentCommit = jest.fn();
const mockAttachmentState = { attachments: [] as EventAttachment[], files: [], removedIds: [], loading: false, error: null, picking: false, progress: null, signature: "empty", hasChanges: false, pick: jest.fn(), removePending: jest.fn(), removeExisting: jest.fn(), retryLoad: jest.fn(), open: jest.fn(), commit: mockAttachmentCommit };
jest.mock("../application/share-calendar-entry", () => ({ shareCalendarEntry: jest.fn(async () => undefined), copyCalendarEntry: jest.fn(async () => undefined), exportCalendarEntry: jest.fn(async () => undefined) }));
jest.mock("../useCalendarEventAttachments", () => ({ useCalendarEventAttachments: () => mockAttachmentState }));
jest.mock("../../../api/event-attachments", () => ({ ensureEventAttachmentsAvailable: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock("../CalendarTimePicker", () => ({ ...jest.requireActual("../CalendarTimePicker"), useCalendarReducedMotion: () => mockReducedMotion }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: "user-a" } } }) }));
jest.mock("../../../auth/session", () => ({ getSessionIdentity: () => ({ userId: "user-a", generation: 1 }), isSessionIdentityCurrent: () => mockCurrent }));
jest.mock("../../../db/client", () => ({ getReadCacheGeneration: () => 1, getActiveOrganizationId: async () => mockOrganization.id }));
jest.mock("../../../providers/organization-context", () => ({ useOrganization: () => ({ activeOrganization: mockOrganization }) }));
jest.mock("../../../api/events", () => ({ createEvent: jest.fn(), updateEvent: jest.fn(), setEventClasses: jest.fn(), deleteEvent: jest.fn() }));
jest.mock("../../../regulation/tournament-rule-check", () => ({ validateTournamentRules: jest.fn() }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: new Proxy({}, { get: () => "#334455" }) }) }));
jest.mock("../../../ui/confirm-dialog", () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
jest.mock("../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: mockToast }) }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: (props: { children: React.ReactNode; visible?: boolean }) => { mockModal(props); return props.visible === false ? null : props.children; } }));
jest.mock("../../../ui/DatePickerModal", () => ({ DatePickerModal: (props: object) => { mockDatePicker(props); return null; } }));
jest.mock("../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: () => null }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
const event = { id: "event-a", organizationId: "org-a", title: "Torneio", description: "", startsAt: "2026-09-30T09:00:00", endsAt: "2026-09-30T10:00:00", eventType: "torneio", sport: "geral", classIds: [] } as unknown as EventListItem;
const props = { date: "2026-09-30", classes: [], onClose: mockClose, onSaved: mockSaved };
beforeAll(() => { jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true); });
afterAll(() => { jest.restoreAllMocks(); });
beforeEach(() => {
 jest.clearAllMocks(); mockCurrent = true; mockOrganization = { id: "org-a", role_level: 50 };
 mockFocused = true; mockReducedMotion = true;
 mockDimensions = { width: 1036, height: 704 }; mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
 mockAttachmentState.hasChanges = false; mockAttachmentState.signature = "empty"; mockAttachmentState.picking = false;
 mockAttachmentState.attachments = []; mockAttachmentState.loading = false;
 jest.mocked(shareCalendarEntry).mockResolvedValue(undefined); jest.mocked(copyCalendarEntry).mockResolvedValue(undefined); jest.mocked(exportCalendarEntry).mockResolvedValue(undefined);
 mockAttachmentCommit.mockResolvedValue(undefined);
 jest.mocked(ensureEventAttachmentsAvailable).mockResolvedValue(undefined);
 jest.mocked(validateTournamentRules).mockResolvedValue({ ruleSetId: null, clauses: [], issues: [] });
 jest.mocked(createEvent).mockResolvedValue(event); jest.mocked(updateEvent).mockResolvedValue(event); jest.mocked(setEventClasses).mockResolvedValue(undefined);
 mockConfirm.mockResolvedValue(true);
});
test("creates in the selected month and refreshes only after event-class links complete", async () => {
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Reunião");
 fireEvent.press(view.getByLabelText("Salvar evento"));
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
 fireEvent.press(view.getByLabelText("Salvar evento")); fireEvent.press(view.getByLabelText("Salvar evento"));
 mockCurrent = false;
 await act(async () => finish({ ruleSetId: null, clauses: [], issues: [] }));
 expect(validateTournamentRules).toHaveBeenCalledTimes(1); expect(createEvent).not.toHaveBeenCalled();
});
test("requires the existing administrator role and rejects foreign-organization events", async () => {
 mockOrganization.role_level = 10;
 const view = render(React.createElement(CalendarEventEditor, { ...props, event }));
 expect(view.queryByLabelText("Editar evento")).toBeNull(); expect(view.queryByText("Excluir")).toBeNull();
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
 fireEvent.press(view.getByLabelText("Salvar evento"));
 mockOrganization = { id: "org-b", role_level: 50 }; view.rerender(React.createElement(CalendarEventEditor, props));
 await act(async () => finish({ ruleSetId: null, clauses: [], issues: [] }));
 expect(createEvent).not.toHaveBeenCalled(); expect(mockSaved).not.toHaveBeenCalled();
});
test("a failed class-link write retries the created ID instead of duplicating the event", async () => {
 jest.mocked(setEventClasses).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Reunião"); fireEvent.press(view.getByLabelText("Salvar evento"));
 await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" })));
 fireEvent.press(view.getByLabelText("Salvar evento"));
 await waitFor(() => expect(mockSaved).toHaveBeenCalled());
 expect(createEvent).toHaveBeenCalledTimes(1); expect(updateEvent).toHaveBeenCalledWith("event-a", expect.any(Object));
});


test("editing keeps the event rule-set and deletion requires an explicit confirmation", async () => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, event: { ...event, ruleSetId: "rules-v1" } }));
 fireEvent.press(view.getByLabelText("Editar evento"));
 fireEvent.changeText(view.getByLabelText("Título"), "Torneio atualizado");
 fireEvent.press(view.getByLabelText("Salvar evento"));
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
test("saved detail shows event metadata and resolves classes without exposing unresolved IDs", () => {
 const detailed = { ...event, description: "Levar material\nConfirmar presença", locationLabel: "Quadra 2", eventType: "amistoso" as const, sport: "volei_praia" as const, classIds: ["class-a", "private-class-id"] };
 const classes = [{ id: "class-a", name: "Hipopótamos", unitId: "unit-a" }] as React.ComponentProps<typeof CalendarEventEditor>["classes"];
 const view = render(React.createElement(CalendarEventEditor, { ...props, event: detailed, classes }));
 expect(view.getByRole("header", { name: detailed.title })).toBeTruthy();
 expect(view.getByText("Quadra 2")).toBeTruthy(); expect(view.getByText(detailed.description)).toBeTruthy();
 expect(view.getByText("Amistoso")).toBeTruthy(); expect(view.getByText("Vôlei de praia")).toBeTruthy();
 expect(view.getByText("Hipopótamos, 1 turma vinculada")).toBeTruthy();
 expect(view.queryByText("private-class-id")).toBeNull(); expect(view.queryByLabelText("Título")).toBeNull();
 expect(view.queryByLabelText("Adicionar anexo")).toBeNull(); expect(updateEvent).not.toHaveBeenCalled();
 fireEvent.press(view.getByLabelText("Editar evento"));
 expect(view.getByLabelText("Título").props.value).toBe(detailed.title);
 expect(view.getByLabelText("Anotações").props.value).toBe(detailed.description);
 expect(view.getByLabelText("Categoria: Amistoso")).toBeTruthy();
 expect(view.getByLabelText("Esporte: Vôlei de praia")).toBeTruthy();
 expect(view.getByLabelText("Hipopótamos").props.accessibilityState.checked).toBe(true);
 expect(view.getByLabelText("Adicionar anexo")).toBeTruthy();
});

test("read-only all-day detail displays the inclusive final date and closes without mutation", () => {
 mockOrganization.role_level = 10;
 const view = render(React.createElement(CalendarEventEditor, { ...props, event: { ...event, allDay: true, startsAt: "2026-09-30T00:00:00", endsAt: "2026-10-02T00:00:00" } }));
 expect(view.getByLabelText(/^Término: .*1 de out\./)).toBeTruthy();
 expect(view.getByText("Dia todo")).toBeTruthy(); expect(view.queryByText("09:00")).toBeNull();
 expect(view.queryByLabelText("Editar evento")).toBeNull(); expect(view.queryByLabelText("Excluir evento")).toBeNull();
 fireEvent.press(view.getByLabelText("Voltar à agenda"));
 expect(mockClose).toHaveBeenCalledTimes(1); expect(mockConfirm).not.toHaveBeenCalled();
 expect(createEvent).not.toHaveBeenCalled(); expect(updateEvent).not.toHaveBeenCalled(); expect(deleteEvent).not.toHaveBeenCalled();
});

test("detail cannot enter edit mode while deletion confirmation is outstanding", async () => {
 let finish!: (accepted: boolean) => void;
 mockConfirm.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
 const view = render(React.createElement(CalendarEventEditor, { ...props, event }));
 fireEvent.press(view.getByLabelText("Excluir evento"));
 expect(view.getByLabelText("Editar evento")).toBeDisabled(); expect(view.getByLabelText("Excluir evento")).toBeDisabled();
 fireEvent.press(view.getByLabelText("Editar evento")); expect(view.queryByLabelText("Título")).toBeNull();
 await act(async () => finish(false));
 expect(view.getByLabelText("Editar evento")).not.toBeDisabled(); expect(deleteEvent).not.toHaveBeenCalled();
});

test("read-only shell preserves mobile safe-area while editing keeps its original card", () => {
 mockDimensions = { width: 390, height: 844 }; mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
 const view = render(React.createElement(CalendarEventEditor, { ...props, event }));
 expect(mockModal.mock.calls.at(-1)![0].position).toBe("center");
 const detail = mockModal.mock.calls.at(-1)![0];
 expect(detail.backdropOpacity).toBe(1);
 const detailCard = StyleSheet.flatten(detail.cardStyle);
 expect(detailCard).toMatchObject({ padding: 0, paddingBottom: 0, marginBottom: 0, backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, maxWidth: 400, maxHeight: 731 });
 expect(detailCard.height).toBeUndefined();
 expect(detailCard.maxHeight + mockInsets.top + mockInsets.bottom + detail.containerPadding * 2).toBeLessThanOrEqual(mockDimensions.height);
 fireEvent.press(view.getByLabelText("Editar evento"));
 expect(StyleSheet.flatten(mockModal.mock.calls.at(-1)![0].cardStyle)).toMatchObject({ padding: 16, backgroundColor: "#334455", height: 704 });
 expect(mockModal.mock.calls.at(-1)![0]).toMatchObject({ position: "bottom", backdropOpacity: 0.5 });
 expect(view.getByLabelText("Título").props.value).toBe(event.title);
});

test("tournament warnings cannot be silently accepted", async () => {
 jest.mocked(validateTournamentRules).mockResolvedValue({ ruleSetId: null, clauses: [], issues: [{ severity: "warning", message: "Revisar horário" }] } as Awaited<ReturnType<typeof validateTournamentRules>>);
 mockConfirm.mockResolvedValueOnce(false);
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Encontro"); fireEvent.press(view.getByLabelText("Salvar evento"));
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

test("quick time picker overrides an explicit title time when confirmed and saved", async () => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, quick: true }));
 fireEvent.changeText(view.getByLabelText("Título do evento rápido"), "Reunião às 18h");
 fireEvent.press(view.getByLabelText("Alterar horário: 18:00"));
 expect(view.getByLabelText("Horas").props.accessibilityValue.now).toBe(18);
 fireEvent.press(view.getByLabelText("Hora 09"));
 fireEvent.press(view.getByLabelText("Minuto 30"));
 expect(createEvent).not.toHaveBeenCalled();
 fireEvent.press(view.getByLabelText("Confirmar horário"));
 expect(view.getByLabelText("Alterar horário: 09:30")).toBeTruthy();
 fireEvent.press(view.getByLabelText("Salvar evento rápido"));
 await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
 const saved = jest.mocked(createEvent).mock.calls[0][0];
 expect(saved.title).toBe("Reunião");
 expect(new Date(saved.startsAt).getHours()).toBe(9);
 expect(new Date(saved.startsAt).getMinutes()).toBe(30);
 expect(new Date(saved.endsAt).getTime() - new Date(saved.startsAt).getTime()).toBe(3600000);
});

test("cancel preserves the original quick time and confirming midnight transfers to details", () => {
 const expand = jest.fn();
 const view = render(React.createElement(CalendarEventEditor, { ...props, quick: true, onExpand: expand }));
 fireEvent.changeText(view.getByLabelText("Título do evento rápido"), "Reunião");
 fireEvent.press(view.getByLabelText("Alterar horário: 09:00"));
 fireEvent.press(view.getByLabelText("Hora 23"));
 fireEvent.press(view.getByLabelText("Cancelar horário"));
 expect(view.getByLabelText("Alterar horário: 09:00")).toBeTruthy();
 fireEvent.press(view.getByLabelText("Alterar horário: 09:00"));
 expect(view.getByLabelText("Horas").props.accessibilityValue.now).toBe(9);
 expect(createEvent).not.toHaveBeenCalled();
 fireEvent.press(view.getByLabelText("Hora 23"));
 fireEvent.press(view.getByLabelText("Minuto 30"));
 fireEvent.press(view.getByLabelText("Confirmar horário"));
 fireEvent.press(view.getByLabelText("Abrir detalhes do evento"));
 expect(expand).toHaveBeenCalledWith(expect.objectContaining({ title: "Reunião", startTime: "23:30", endTime: "00:30", endDate: "2026-10-01" }));
 expect(createEvent).not.toHaveBeenCalled();
});

test("suggested times still update the current quick time", () => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, quick: true, suggestedTimes: ["14:00", "17:30"] }));
 fireEvent.press(view.getByLabelText("Horário 17:30"));
 expect(view.getByLabelText("Alterar horário: 17:30")).toBeTruthy();
});

test("the full editor opens inline wheels and preserves duration when moving its start", async () => {
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Reunião");
 fireEvent.press(view.getByLabelText("Hora de início"));
 expect(view.getByTestId("calendar-inline-time-picker")).toBeTruthy();
 fireEvent.press(view.getByLabelText("Hora 23"));
 fireEvent.press(view.getByLabelText("Minuto 30"));
 expect(view.getByText("23:30")).toBeTruthy();
 expect(view.getByText("00:30")).toBeTruthy();
 expect(createEvent).not.toHaveBeenCalled();
 fireEvent.press(view.getByLabelText("Salvar evento"));
 await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
 const saved = jest.mocked(createEvent).mock.calls[0][0];
 expect(new Date(saved.endsAt).getDate()).toBe(1);
 expect(new Date(saved.endsAt).getTime() - new Date(saved.startsAt).getTime()).toBe(60 * 60000);
});

test("all-day hides the time controls without saving the event", async () => {
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.press(view.getByLabelText("Hora de término"));
 fireEvent.press(view.getByLabelText("Minuto 45"));
 expect(view.getByText("10:45")).toBeTruthy();
 fireEvent.press(view.getByLabelText("Dia todo"));
 expect(view.getByRole("switch", { name: "Dia todo" }).props.accessibilityState.checked).toBe(true);
 expect(view.queryByLabelText("Hora de início")).toBeNull();
 expect(view.queryByLabelText("Hora de término")).toBeNull();
 fireEvent.press(view.getByLabelText("Dia todo"));
 expect(view.getByLabelText("Hora de início")).toBeTruthy();
 expect(view.getByText("10:45")).toBeTruthy();
 expect(createEvent).not.toHaveBeenCalled();
});

test("the inline date selector moves the range and changing to time closes its calendar", () => {
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.press(view.getByLabelText("Data de início"));
 const slot = view.getByTestId("calendar-inline-date-picker");
 const picker = mockDatePicker.mock.calls.at(-1)![0];
 expect(picker).toMatchObject({ inline: true, visible: true, value: props.date });
 act(() => { picker.onChange("2026-10-01"); });
 expect(view.getByLabelText("Data de término").props.accessibilityHint).toBe("2026-10-01");
 fireEvent.press(view.getByLabelText("Hora de início"));
 expect(view.queryByTestId("calendar-inline-date-picker")).toBeNull();
 expect(view.getByTestId("calendar-inline-time-picker")).toBe(slot);
 expect(createEvent).not.toHaveBeenCalled();
});

test("the compact form retains category, sport, description and class links", async () => {
 const seed = { ...initialEventDraft(props.date), title: "Encontro", eventType: "amistoso" as const, sport: "volei_praia" as const, description: "Levar material", locationLabel: "Quadra 2", classIds: ["class-a"] };
 const classes = [{ id: "class-a", name: "Hipopótamos", unitId: "unit-a" }] as React.ComponentProps<typeof CalendarEventEditor>["classes"];
 const view = render(React.createElement(CalendarEventEditor, { ...props, classes, seed }));
 expect(view.getByLabelText("Categoria: Amistoso")).toBeTruthy();
 expect(view.getByLabelText("Esporte: Vôlei de praia")).toBeTruthy();
 expect(view.getByLabelText("Anotações").props.value).toBe("Levar material");
 fireEvent.press(view.getByLabelText("Turmas vinculadas"));
 fireEvent.press(view.getByLabelText("Turmas vinculadas"));
 expect(view.getByLabelText("Hipopótamos").props.accessibilityState.checked).toBe(true);
 fireEvent.press(view.getByLabelText("Salvar evento"));
 await waitFor(() => expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "amistoso", sport: "volei_praia", description: "Levar material", locationLabel: "Quadra 2", unitId: "unit-a" })));
 expect(setEventClasses).toHaveBeenCalledWith("event-a", "org-a", ["class-a"]);
});

test("notes grow and shrink inline, and changing only notes protects the draft", async () => {
 const view = render(React.createElement(CalendarEventEditor, props));
 const notes = view.getByLabelText("Anotações");
 expect(notes).toHaveStyle({ height: 24, backgroundColor: "transparent" });
 expect(notes.props.multiline).toBe(true);
 expect(notes.props.scrollEnabled).toBe(false);
 fireEvent.changeText(notes, "Primeira linha\nSegunda linha\nTerceira linha");
 fireEvent(notes, "contentSizeChange", { nativeEvent: { contentSize: { width: 300, height: 72 } } });
 expect(view.getByLabelText("Anotações")).toHaveStyle({ height: 72 });
 fireEvent.changeText(notes, "Levar material");
 fireEvent(notes, "contentSizeChange", { nativeEvent: { contentSize: { width: 300, height: 24 } } });
 expect(view.getByLabelText("Anotações")).toHaveStyle({ height: 24 });
 expect(createEvent).not.toHaveBeenCalled();
 mockConfirm.mockResolvedValueOnce(false);
 fireEvent.press(view.getByLabelText("Fechar evento"));
 await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
 expect(mockClose).not.toHaveBeenCalled();
 expect(view.getByLabelText("Anotações").props.value).toBe("Levar material");
});

test("saving an event preserves multiline notes in the existing description payload", async () => {
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Encontro");
 fireEvent.changeText(view.getByLabelText("Anotações"), "  Levar material\nConfirmar presença  ");
 expect(createEvent).not.toHaveBeenCalled();
 fireEvent.press(view.getByLabelText("Salvar evento"));
 await waitFor(() => expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ description: "Levar material\nConfirmar presença" })));
});

test("attachment availability is checked before creating an event and attachment writes follow its class links", async () => {
 mockAttachmentState.hasChanges = true; mockAttachmentState.signature = "pending-file";
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Encontro com anexos");
 fireEvent.press(view.getByLabelText("Salvar evento"));
 await waitFor(() => expect(mockAttachmentCommit).toHaveBeenCalledWith("event-a", expect.any(Function)));
 expect(ensureEventAttachmentsAvailable).toHaveBeenCalledWith({ organizationId: "org-a" });
 expect(jest.mocked(ensureEventAttachmentsAvailable).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(createEvent).mock.invocationCallOrder[0]);
 expect(jest.mocked(setEventClasses).mock.invocationCallOrder[0]).toBeLessThan(mockAttachmentCommit.mock.invocationCallOrder[0]);
});

test("unavailable attachment storage never creates a partial event", async () => {
 mockAttachmentState.hasChanges = true; mockAttachmentState.signature = "pending-file";
 jest.mocked(ensureEventAttachmentsAvailable).mockRejectedValueOnce(new Error("Os anexos ainda não estão disponíveis nesta instituição."));
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Encontro com anexos");
 fireEvent.press(view.getByLabelText("Salvar evento"));
 await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" })));
 expect(createEvent).not.toHaveBeenCalled();
 expect(mockAttachmentCommit).not.toHaveBeenCalled();
});

test("an outstanding file picker blocks saving before any event can be created", () => {
 mockAttachmentState.picking = true;
 const view = render(React.createElement(CalendarEventEditor, props));
 fireEvent.changeText(view.getByLabelText("Título"), "Encontro");
 expect(view.getByLabelText("Salvar evento")).toBeDisabled();
 fireEvent.press(view.getByLabelText("Salvar evento"));
 expect(createEvent).not.toHaveBeenCalled();
});

test("quick closing completes once when reduced motion changes during its exit", () => {
 jest.useFakeTimers();
 try {
  mockReducedMotion = false;
  const view = render(React.createElement(CalendarEventEditor, { ...props, quick: true }));
  fireEvent.press(view.getByLabelText("Fechar criação rápida"));
  expect(mockClose).not.toHaveBeenCalled();
  mockReducedMotion = true;
  view.rerender(React.createElement(CalendarEventEditor, { ...props, quick: true }));
  expect(mockClose).toHaveBeenCalledTimes(1);
  act(() => jest.runOnlyPendingTimers());
  expect(mockClose).toHaveBeenCalledTimes(1);
 } finally { jest.useRealTimers(); }
});

test("the event sheet finishes its exit before notifying its parent", () => {
 jest.useFakeTimers();
 try {
  mockReducedMotion = false;
  const view = render(React.createElement(CalendarEventEditor, props));
  fireEvent.press(view.getByLabelText("Fechar evento"));
  expect(mockClose).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1000));
  expect(mockClose).not.toHaveBeenCalled();
  act(() => mockModal.mock.calls.at(-1)![0].onExited());
  expect(mockClose).toHaveBeenCalledTimes(1);
  act(() => jest.runOnlyPendingTimers());
  expect(mockClose).toHaveBeenCalledTimes(1);
 } finally { jest.useRealTimers(); }
});

test("losing focus cancels the old quick exit and returning keeps the draft usable", () => {
 jest.useFakeTimers();
 try {
  mockReducedMotion = false;
  const view = render(React.createElement(CalendarEventEditor, { ...props, quick: true }));
  fireEvent.press(view.getByLabelText("Fechar criação rápida"));
  mockFocused = false;
  view.rerender(React.createElement(CalendarEventEditor, { ...props, quick: true }));
  act(() => jest.advanceTimersByTime(250));
  expect(mockClose).not.toHaveBeenCalled();
  mockFocused = true;
  view.rerender(React.createElement(CalendarEventEditor, { ...props, quick: true }));
  expect(view.getByLabelText("Fechar criação rápida")).toBeEnabled();
  fireEvent.press(view.getByLabelText("Fechar criação rápida"));
  act(() => jest.advanceTimersByTime(250));
  expect(mockClose).toHaveBeenCalledTimes(1);
 } finally { jest.useRealTimers(); }
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
 fireEvent.press(details.getByLabelText("Salvar evento"));
 await waitFor(() => expect(updateEvent).toHaveBeenCalledWith("event-a", expect.any(Object)));
 expect(createEvent).toHaveBeenCalledTimes(1);
});

test("duplicate waits for exit and opens an independent new draft without mutating its source", async () => {
 const duplicate = jest.fn(); mockReducedMotion = false;
 const original = { ...event, unitId: "unit-standalone", description: "Levar material", ruleSetId: "old-rules" };
 const view = render(React.createElement(CalendarEventEditor, { ...props, event: original, onDuplicate: duplicate }));
 fireEvent.press(view.getByLabelText("Duplicar evento"));
 expect(duplicate).not.toHaveBeenCalled(); expect(createEvent).not.toHaveBeenCalled(); expect(updateEvent).not.toHaveBeenCalled();
 act(() => mockModal.mock.calls.at(-1)![0].onExited());
 expect(duplicate).toHaveBeenCalledTimes(1);
 const seed = duplicate.mock.calls[0][0];
 expect(seed).toMatchObject({ title: event.title, description: "Levar material", unitId: "unit-standalone" });
 expect(seed).not.toHaveProperty("id"); expect(seed).not.toHaveProperty("resumeId"); expect(seed).not.toHaveProperty("attachments");
 view.unmount(); mockReducedMotion = true;
 const copy = render(React.createElement(CalendarEventEditor, { ...props, seed }));
 fireEvent.press(copy.getByLabelText("Salvar evento"));
 await waitFor(() => expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ unitId: "unit-standalone", title: event.title })));
 expect(updateEvent).not.toHaveBeenCalled(); expect(mockAttachmentCommit).toHaveBeenCalledWith("event-a", expect.any(Function));
 expect(validateTournamentRules).toHaveBeenCalledWith(expect.objectContaining({ existingRuleSetId: undefined }));
});

test("duplicate with attachments requires an explicit choice and keeps the original files untouched", async () => {
 const duplicate = jest.fn();
 mockAttachmentState.attachments = [{ id: "attachment-a", organizationId: "org-a", eventId: event.id, objectPath: "org-a/event-a/attachment-a", name: "Regulamento.pdf", mimeType: "application/pdf", sizeBytes: 100, createdBy: "user-a", createdAt: "2026-10-29", uploadedAt: "2026-10-29" }];
 mockConfirm.mockResolvedValueOnce(false);
 const view = render(React.createElement(CalendarEventEditor, { ...props, event, onDuplicate: duplicate }));
 fireEvent.press(view.getByLabelText("Duplicar evento"));
 await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Duplicar sem os anexos?", confirmLabel: "Continuar" })));
 expect(duplicate).not.toHaveBeenCalled(); expect(mockAttachmentCommit).not.toHaveBeenCalled(); expect(mockAttachmentState.attachments).toHaveLength(1);
});

test("a changed institution while confirming duplicate discards the old continuation", async () => {
 let finish!: (value: boolean) => void; const duplicate = jest.fn();
 mockAttachmentState.attachments = [{ id: "file", organizationId: "org-a", eventId: event.id, objectPath: "org-a/event-a/file", name: "Documento.pdf", mimeType: "application/pdf", sizeBytes: 100, createdBy: "user-a", createdAt: "2026-10-29", uploadedAt: "2026-10-29" }];
 mockConfirm.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
 const view = render(React.createElement(CalendarEventEditor, { ...props, event, onDuplicate: duplicate }));
 fireEvent.press(view.getByLabelText("Duplicar evento"));
 mockOrganization = { id: "org-b", role_level: 50 }; view.rerender(React.createElement(CalendarEventEditor, { ...props, event, onDuplicate: duplicate }));
 await act(async () => finish(true));
 expect(duplicate).not.toHaveBeenCalled(); expect(createEvent).not.toHaveBeenCalled(); expect(updateEvent).not.toHaveBeenCalled();
});

test.each(["title", "locationLabel", "description"] as const)("a detail field opens the existing editor focused on %s", target => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, event: { ...event, locationLabel: "Quadra 2", description: "Levar material" } }));
 const detail = view.UNSAFE_getByType(CalendarEntryDetails).props;
 const press = target === "title" ? detail.onTitlePress : detail.rows.find((row: { key: string }) => row.key === (target === "description" ? "notes" : "location")).onPress;
 act(() => press());
 expect(view.getByLabelText(target === "title" ? "Título" : target === "description" ? "Anotações" : "Local").props.autoFocus).toBe(true);
 expect(createEvent).not.toHaveBeenCalled(); expect(updateEvent).not.toHaveBeenCalled();
});

test.each(["startDate", "endDate", "startTime", "endTime"] as const)("the detail period opens its existing inline selector for %s", target => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, event }));
 const detail = view.UNSAFE_getByType(CalendarEntryDetails).props;
 act(() => detail[`on${target[0].toUpperCase()}${target.slice(1)}Press`]());
 expect(view.getByTestId(target.endsWith("Date") ? "calendar-inline-date-picker" : "calendar-inline-time-picker")).toBeTruthy();
 if (target.endsWith("Time")) expect(view.getByLabelText("Horas").props.accessibilityValue.now).toBe(target === "startTime" ? 9 : 10);
 expect(createEvent).not.toHaveBeenCalled(); expect(updateEvent).not.toHaveBeenCalled();
});

test("share, copy and ICS export use snapshots without persisting or attaching private files", async () => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, event }));
 await act(async () => fireEvent.press(view.getByLabelText("Compartilhar evento")));
 expect(shareCalendarEntry).toHaveBeenCalledWith(expect.objectContaining({ title: event.title, uid: `${event.id}@goatleta` }), expect.objectContaining({ isCurrent: expect.any(Function) }));
 const more = view.UNSAFE_getByType(CalendarEntryDetails).props.actions.find((action: { key: string }) => action.key === "more");
 await act(async () => more.menuItems.find((item: { key: string }) => item.key === "copy").onPress());
 await act(async () => more.menuItems.find((item: { key: string }) => item.key === "export").onPress());
 expect(copyCalendarEntry).toHaveBeenCalledTimes(1); expect(exportCalendarEntry).toHaveBeenCalledTimes(1);
 expect(jest.mocked(shareCalendarEntry).mock.calls[0][0]).not.toHaveProperty("attachments");
 expect(createEvent).not.toHaveBeenCalled(); expect(updateEvent).not.toHaveBeenCalled(); expect(deleteEvent).not.toHaveBeenCalled();
});

test("a member keeps sharing actions while edit, duplicate and field editing remain administrative", () => {
 mockOrganization.role_level = 10;
 const view = render(React.createElement(CalendarEventEditor, { ...props, event, onDuplicate: jest.fn() }));
 const detail = view.UNSAFE_getByType(CalendarEntryDetails).props;
 expect(detail.onTitlePress).toBeUndefined(); expect(detail.onStartTimePress).toBeUndefined();
 expect(view.queryByLabelText("Duplicar evento")).toBeNull(); expect(view.queryByLabelText("Editar evento")).toBeNull(); expect(view.queryByLabelText("Excluir evento")).toBeNull();
 expect(view.getByLabelText("Compartilhar evento")).toBeTruthy(); expect(view.getByLabelText("Mais opções do evento")).toBeTruthy();
});

test("stale field/share callbacks cannot act after a context change, and current share errors are visible", async () => {
 const view = render(React.createElement(CalendarEventEditor, { ...props, event }));
 const old = view.UNSAFE_getByType(CalendarEntryDetails).props;
 mockOrganization = { id: "org-b", role_level: 50 }; view.rerender(React.createElement(CalendarEventEditor, { ...props, event }));
 await act(async () => { old.onTitlePress(); old.actions.find((action: { key: string }) => action.key === "share").onPress(); });
 expect(view.queryByLabelText("Título")).toBeNull(); expect(shareCalendarEntry).not.toHaveBeenCalled();
 view.unmount(); mockOrganization = { id: "org-a", role_level: 50 }; jest.mocked(shareCalendarEntry).mockRejectedValueOnce(new Error("unavailable"));
 const fresh = render(React.createElement(CalendarEventEditor, { ...props, event }));
 await act(async () => fireEvent.press(fresh.getByLabelText("Compartilhar evento")));
 expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
 expect(createEvent).not.toHaveBeenCalled(); expect(updateEvent).not.toHaveBeenCalled();
});
