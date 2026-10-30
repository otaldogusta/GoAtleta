import React from "react";
import { act, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { ClassGroup } from "../../../core/models";
import { CalendarClassDetails } from "../CalendarClassDetails";
import type { CalendarEntryDetailsProps } from "../CalendarEntryDetails";
import { getClassCalendarExceptions, saveClassCalendarException } from "../../../db/periodization";
import { copyCalendarEntry, exportCalendarEntry, shareCalendarEntry } from "../application/share-calendar-entry";

const mockEntry = jest.fn(), mockSheet = jest.fn();
const mockConfirm = jest.fn(), mockToast = jest.fn();
let mockOrganization = { id: "org-a", role_level: 50 }, mockIdentity = { userId: "user-a", generation: 1 }, mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: mockIdentity.userId } } }) }));
jest.mock("../../../auth/session", () => ({ getSessionIdentity: () => ({ ...mockIdentity }), isSessionIdentityCurrent: (identity: typeof mockIdentity) => identity.userId === mockIdentity.userId && identity.generation === mockIdentity.generation, SessionIdentityChangedError: class extends Error {} }));
jest.mock("../../../providers/organization-context", () => ({ useOrganization: () => ({ activeOrganization: mockOrganization }) }));
jest.mock("../../../db/client", () => ({ getReadCacheGeneration: () => 1 }));
jest.mock("../../../db/periodization", () => ({ getClassCalendarExceptions: jest.fn(), saveClassCalendarException: jest.fn() }));
jest.mock("../../../ui/confirm-dialog", () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
jest.mock("../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: mockToast }) }));
jest.mock("../application/share-calendar-entry", () => ({ shareCalendarEntry: jest.fn(), copyCalendarEntry: jest.fn(), exportCalendarEntry: jest.fn() }));
let mockDimensions = { width: 1036, height: 704 };
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { card: "#121c30" } }) }));
jest.mock("../CalendarTimePicker", () => ({ useCalendarReducedMotion: () => true }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: (props: { visible: boolean; children: React.ReactNode }) => { mockSheet(props); return props.visible ? props.children : null; } }));
jest.mock("../CalendarEntryDetails", () => ({ ...jest.requireActual("../CalendarEntryDetails"), CalendarEntryDetails: (props: CalendarEntryDetailsProps) => { mockEntry(props); return null; } }));
const group = { id: "class-a", name: "Primeiros Saques", unit: "Rede Esperança", organizationId: "org-a", ageBand: "12-14", level: 1, mvLevel: "MV2", modality: "voleibol", trainingSpace: "Quadra 2", startTime: "09:00", durationMinutes: 60 } as ClassGroup;
const props = { classGroup: group, date: "2026-12-31", timeLabel: "23:30 - 00:30", unitLabel: "Rede Esperança", accentColor: "#aaccff", onClose: jest.fn(), onOpenClass: jest.fn(), onDuplicate: jest.fn(), onChanged: jest.fn() };
const entry = () => mockEntry.mock.calls.at(-1)![0] as CalendarEntryDetailsProps;
const action = (key: string) => entry().actions!.find(item => item.key === key)!;
const menu = (key: string) => action("more").menuItems!.find(item => item.key === key)!;
const flush = () => act(async () => { for (let tick = 0; tick < 10; tick++) await Promise.resolve(); });
beforeEach(() => {
  jest.clearAllMocks(); mockDimensions = { width: 1036, height: 704 }; mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  mockOrganization = { id: "org-a", role_level: 50 }; mockIdentity = { userId: "user-a", generation: 1 }; mockFocused = true;
  mockConfirm.mockResolvedValue(true); jest.mocked(getClassCalendarExceptions).mockResolvedValue([]); jest.mocked(saveClassCalendarException).mockResolvedValue(undefined);
});

test("uses the displayed occurrence interval across midnight and existing class metadata", () => {
  render(React.createElement(CalendarClassDetails, props));
  const entry = mockEntry.mock.calls.at(-1)![0] as CalendarEntryDetailsProps;
  expect(entry).toMatchObject({ title: "Primeiros Saques", accentColor: props.accentColor, startDate: "2026-12-31", endDate: "2027-01-01", startTime: "23:30", endTime: "00:30" });
  expect(entry.rows).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: "unit", value: "Rede Esperança" }), expect.objectContaining({ key: "space", value: "Quadra 2" }),
    expect.objectContaining({ key: "age", value: "12-14" }), expect.objectContaining({ key: "level", value: "Intermediário" }), expect.objectContaining({ key: "sport", value: "Vôlei de quadra" }),
  ]));
  expect(entry.actions!.map(item => item.key)).toEqual(["duplicate", "edit", "share", "cancel", "more"]);
  expect(mockSheet.mock.calls.at(-1)![0]).toMatchObject({ transition: "calendar", reduceMotion: true, position: "center" });
  const card = StyleSheet.flatten(mockSheet.mock.calls.at(-1)![0].cardStyle);
  expect(card).toMatchObject({ maxWidth: 400, maxHeight: 640, padding: 0, paddingBottom: 0, marginBottom: 0, backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0 });
  expect(card.height).toBeUndefined();
});

test("navigation waits for the sheet's completed exit and cannot run twice", () => {
  render(React.createElement(CalendarClassDetails, props));
  act(() => menu("class").onPress());
  expect(props.onOpenClass).not.toHaveBeenCalled(); expect(props.onClose).not.toHaveBeenCalled();
  expect(mockSheet.mock.calls.at(-1)![0].visible).toBe(false);
  act(() => { mockSheet.mock.calls.at(-1)![0].onExited(); mockSheet.mock.calls.at(-1)![0].onExited(); });
  expect(props.onOpenClass).toHaveBeenCalledTimes(1); expect(props.onClose).not.toHaveBeenCalled();
});

test("closing does not navigate and mobile keeps back and actions inside nonzero safe-area insets", () => {
  mockDimensions = { width: 390, height: 844 };
  const view = render(React.createElement(CalendarClassDetails, props));
  const sheet = mockSheet.mock.calls.at(-1)![0];
  expect(sheet.position).toBe("center"); expect(sheet.containerPadding).toBe(12);
  expect(sheet.cardStyle).toEqual(expect.arrayContaining([expect.objectContaining({ width: 366, maxWidth: 400, maxHeight: 812 })]));
  expect(sheet.backdropOpacity).toBe(1);
  mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
  view.rerender(React.createElement(CalendarClassDetails, props));
  const safeSheet = mockSheet.mock.calls.at(-1)![0];
  const card = StyleSheet.flatten(safeSheet.cardStyle);
  expect(card).toMatchObject({ maxHeight: 731 });
  expect(card.height).toBeUndefined();
  expect(card.maxHeight + mockInsets.top + mockInsets.bottom + safeSheet.containerPadding * 2).toBeLessThanOrEqual(mockDimensions.height);
  act(() => mockEntry.mock.calls.at(-1)![0].onClose());
  act(() => mockSheet.mock.calls.at(-1)![0].onExited());
  expect(props.onClose).toHaveBeenCalledTimes(1); expect(props.onOpenClass).not.toHaveBeenCalled();
});

test("does not invent missing class metadata and preserves an unavailable displayed time", () => {
  const minimal = { id: "c", name: "Turma sem dados", startTime: "09:00" } as ClassGroup;
  render(React.createElement(CalendarClassDetails, { ...props, classGroup: minimal, unitLabel: "", timeLabel: "Horário indefinido" }));
  expect(mockEntry.mock.calls.at(-1)![0]).toMatchObject({ startDate: props.date, endDate: props.date, startTime: undefined, endTime: undefined, rows: [{ key: "time", icon: "time", label: "Horário", value: "Horário indefinido" }] });
});

test("equal endpoints represent the next day instead of a zero-length occurrence", () => {
  render(React.createElement(CalendarClassDetails, { ...props, date: "2026-10-23", timeLabel: "14:00 - 14:00" }));
  expect(mockEntry.mock.calls.at(-1)![0]).toMatchObject({ startDate: "2026-10-23", endDate: "2026-10-24", startTime: "14:00", endTime: "14:00" });
});

test("duplicate opens a linked event draft after exiting and never saves a class or pause", () => {
  render(React.createElement(CalendarClassDetails, props));
  act(() => action("duplicate").onPress());
  expect(props.onDuplicate).not.toHaveBeenCalled();
  act(() => mockSheet.mock.calls.at(-1)![0].onExited());
  expect(props.onDuplicate).toHaveBeenCalledWith(expect.objectContaining({ title: "Primeiros Saques (cópia)", startDate: "2026-12-31", endDate: "2027-01-01", startTime: "23:30", endTime: "00:30", sport: "volei_quadra", classIds: ["class-a"], locationLabel: "Rede Esperança · Quadra 2" }));
  expect(saveClassCalendarException).not.toHaveBeenCalled();
});

test.each([["voleibol_areia", "volei_praia"], ["futebol", "futebol"], ["basquete", "geral"]] as const)("duplicates %s using the existing %s event category", (modality, sport) => {
  render(React.createElement(CalendarClassDetails, { ...props, classGroup: { ...group, modality } }));
  act(() => action("duplicate").onPress()); act(() => mockSheet.mock.calls.at(-1)![0].onExited());
  expect(props.onDuplicate).toHaveBeenCalledWith(expect.objectContaining({ sport }));
});

test("time and metadata edits confirm the recurring scope before navigating to the existing settings section", async () => {
  render(React.createElement(CalendarClassDetails, props));
  act(() => entry().onStartTimePress!()); await flush();
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Editar turma e seus horários", message: expect.stringContaining("recorrentes") }));
  expect(props.onOpenClass).not.toHaveBeenCalled();
  act(() => mockSheet.mock.calls.at(-1)![0].onExited());
  expect(props.onOpenClass).toHaveBeenCalledWith({ settings: "1", settingsSection: "agenda" });
});

test("rejecting a recurring edit keeps the lesson open and unchanged", async () => {
  mockConfirm.mockResolvedValue(false);
  render(React.createElement(CalendarClassDetails, props));
  act(() => entry().rows.find(row => row.key === "age")!.onPress!()); await flush();
  expect(mockSheet.mock.calls.at(-1)![0].visible).toBe(true);
  expect(props.onOpenClass).not.toHaveBeenCalled(); expect(saveClassCalendarException).not.toHaveBeenCalled();
});

test("delete cancels only the selected occurrence and refreshes after a guarded successful write", async () => {
  render(React.createElement(CalendarClassDetails, props));
  act(() => { action("cancel").onPress(); action("cancel").onPress(); }); await flush();
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Cancelar somente esta aula?" }));
  expect(saveClassCalendarException).toHaveBeenCalledWith(expect.objectContaining({ classId: "class-a", organizationId: "org-a", date: "2026-12-31", kind: "no_training" }), expect.objectContaining({ organizationId: "org-a", assertCurrent: expect.any(Function) }));
  expect(props.onChanged).toHaveBeenCalledTimes(1); expect(props.onClose).not.toHaveBeenCalled();
  act(() => mockSheet.mock.calls.at(-1)![0].onExited()); expect(props.onClose).toHaveBeenCalledTimes(1);
});

test("an existing pause is not overwritten and failure leaves the detail open without refresh", async () => {
  jest.mocked(getClassCalendarExceptions).mockResolvedValue([{ date: props.date, kind: "no_training" }] as Awaited<ReturnType<typeof getClassCalendarExceptions>>);
  const view = render(React.createElement(CalendarClassDetails, props));
  act(() => action("cancel").onPress()); await flush();
  expect(saveClassCalendarException).not.toHaveBeenCalled(); expect(props.onChanged).toHaveBeenCalledTimes(1);
  view.unmount(); jest.clearAllMocks(); jest.mocked(getClassCalendarExceptions).mockRejectedValue(new Error("Network"));
  render(React.createElement(CalendarClassDetails, props));
  act(() => action("cancel").onPress()); await flush();
  expect(props.onChanged).not.toHaveBeenCalled(); expect(props.onClose).not.toHaveBeenCalled();
  expect(mockSheet.mock.calls.at(-1)![0].visible).toBe(true); expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
});

test.each(["organization", "session", "focus", "role"])("%s changes while confirming prevent old cancellation", async change => {
  let release!: (value: boolean) => void;
  mockConfirm.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const view = render(React.createElement(CalendarClassDetails, props));
  act(() => action("cancel").onPress());
  if (change === "organization") mockOrganization = { id: "org-b", role_level: 50 };
  if (change === "session") mockIdentity = { userId: "user-b", generation: 2 };
  if (change === "focus") mockFocused = false;
  if (change === "role") mockOrganization = { id: "org-a", role_level: 10 };
  view.rerender(React.createElement(CalendarClassDetails, props));
  await act(async () => release(true));
  expect(getClassCalendarExceptions).not.toHaveBeenCalled(); expect(saveClassCalendarException).not.toHaveBeenCalled(); expect(props.onChanged).not.toHaveBeenCalled();
});

test("readers can share, copy, export, and enter the class without management controls", async () => {
  mockOrganization = { id: "org-a", role_level: 10 };
  render(React.createElement(CalendarClassDetails, props));
  expect(entry().actions!.map(item => item.key)).toEqual(["share", "more"]);
  expect(entry().onTitlePress).toBeUndefined(); expect(entry().rows.every(row => !row.onPress)).toBe(true);
  act(() => action("share").onPress()); await flush();
  act(() => menu("copy").onPress()); await flush();
  act(() => menu("export").onPress()); await flush();
  expect(shareCalendarEntry).toHaveBeenCalledWith(expect.objectContaining({ startDate: props.date, startTime: "23:30", endTime: "00:30" }), expect.objectContaining({ isCurrent: expect.any(Function) }));
  expect(copyCalendarEntry).toHaveBeenCalledTimes(1); expect(exportCalendarEntry).toHaveBeenCalledTimes(1);
});

test("role changes release the old confirmation without leaving reader actions blocked", async () => {
  let release!: (value: boolean) => void;
  mockConfirm.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const view = render(React.createElement(CalendarClassDetails, props));
  act(() => action("cancel").onPress());
  mockOrganization = { id: "org-a", role_level: 10 };
  view.rerender(React.createElement(CalendarClassDetails, props));
  await act(async () => release(true));
  expect(action("share").disabled).toBe(false);
  act(() => action("share").onPress()); await flush();
  expect(shareCalendarEntry).toHaveBeenCalledTimes(1); expect(saveClassCalendarException).not.toHaveBeenCalled();
});
