import React from "react";
import { Platform, ScrollView, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { CalendarEntryDetails, type CalendarEntryDetailAction, type CalendarEntryDetailsProps } from "../CalendarEntryDetails";

const mockDropdown = jest.fn();
jest.mock("react-native/Libraries/Components/View/View", () => {
  const ReactRuntime = jest.requireActual<typeof import("react")>("react");
  return { __esModule: true, default: ReactRuntime.forwardRef(function MockView(props: { children?: React.ReactNode }, ref: React.Ref<unknown>) {
    return ReactRuntime.createElement("View", { ...props, ref }, props.children);
  }) };
});
jest.mock("../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: (props: { visible: boolean; children: React.ReactNode }) => { mockDropdown(props); return props.visible ? props.children : null; } }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: new Proxy({ dangerText: "#FCA5A5" }, { get: (target, key) => Reflect.get(target, key) ?? "#334455" }) }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
const year = new Date().getFullYear();
const weekday = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" });
const props: CalendarEntryDetailsProps = {
  title: "Festival de vôlei", accentColor: "#F8D394", startDate: `${year}-10-29`, endDate: `${year}-10-29`,
  startTime: "09:00", endTime: "10:30", rows: [], onClose: jest.fn(),
};
beforeEach(() => jest.clearAllMocks());

test("presents the title and inclusive interval, and invokes only supplied actions", () => {
  const edit = jest.fn();
  const view = render(React.createElement(CalendarEntryDetails, { ...props, actions: [{ key: "edit", label: "Editar", accessibilityLabel: "Editar evento", icon: "edit", onPress: edit }] }));
  expect(view.getByRole("header", { name: props.title })).toHaveStyle({ color: "#334455", fontSize: 16, fontWeight: "400" });
  expect(view.getByLabelText(`Início: ${weekday(props.startDate)}, 29 de out., 09:00`)).toBeTruthy();
  expect(view.getByLabelText(`Término: ${weekday(props.endDate)}, 29 de out., 10:30`)).toBeTruthy();
  const card = view.UNSAFE_getByType(ScrollView);
  expect(card.findAllByProps({ accessibilityLabel: "Voltar à agenda" })).toHaveLength(0);
  expect(card.findAllByProps({ accessibilityLabel: "Editar evento" })).toHaveLength(0);
  expect(card.findAllByProps({ accessibilityRole: "header" }).length).toBeGreaterThan(0);
  expect(view.getAllByRole("button")).toHaveLength(2);
  fireEvent.press(view.getByLabelText("Editar evento")); expect(edit).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByLabelText("Voltar à agenda")); expect(props.onClose).toHaveBeenCalledTimes(1);
});

test("shows both years across a year boundary and dates outside the current year", () => {
  const view = render(React.createElement(CalendarEntryDetails, { ...props, startDate: `${year}-12-31`, endDate: `${year + 1}-01-01` }));
  expect(view.getByLabelText(`Início: ${weekday(`${year}-12-31`)}, 31 de dez. de ${year}, 09:00`)).toBeTruthy();
  expect(view.getByLabelText(`Término: ${weekday(`${year + 1}-01-01`)}, 1 de jan. de ${year + 1}, 10:30`)).toBeTruthy();
  view.rerender(React.createElement(CalendarEntryDetails, { ...props, startDate: `${year - 1}-10-29`, endDate: `${year - 1}-10-29` }));
  expect(view.getByLabelText(`Início: ${weekday(`${year - 1}-10-29`)}, 29 de out. de ${year - 1}, 09:00`)).toBeTruthy();
});

test("all-day dates remain inclusive and omit clock values without inventing actions", () => {
  const view = render(React.createElement(CalendarEntryDetails, { ...props, allDay: true, endDate: `${year}-10-31` }));
  expect(view.getByLabelText(`Início: ${weekday(props.startDate)}, 29 de out.`)).toBeTruthy();
  expect(view.getByLabelText(`Término: ${weekday(`${year}-10-31`)}, 31 de out.`)).toBeTruthy();
  expect(view.getByText("Dia todo")).toBeTruthy();
  expect(view.queryByText("09:00")).toBeNull(); expect(view.queryByText("10:30")).toBeNull();
  expect(view.getAllByRole("button")).toHaveLength(1);
});

test("keeps multiline notes and attachment content without rendering empty metadata", () => {
  const notes = "Levar material\nConfirmar a lista com a coordenação";
  const view = render(React.createElement(CalendarEntryDetails, { ...props,
    rows: [{ key: "location", icon: "location", value: "Ginásio central" }, { key: "notes", icon: "notes", label: "Anotações", value: notes }, { key: "empty", icon: "classes", label: "Turmas", value: " " }],
    extra: React.createElement(Text, null, "Regulamento.pdf"),
  }));
  expect(view.getByText("Ginásio central")).toBeTruthy(); expect(view.getByText(notes)).toBeTruthy();
  expect(view.getByLabelText(`Anotações: ${notes}`)).toBeTruthy(); expect(view.getByText("Regulamento.pdf")).toBeTruthy();
  expect(view.queryByText("Turmas")).toBeNull();
});

test("disabled actions cannot run and destructive labels retain the danger token", () => {
  const remove = jest.fn();
  const view = render(React.createElement(CalendarEntryDetails, { ...props, actions: [{ key: "delete", label: "Excluir", icon: "trash", onPress: remove, disabled: true, destructive: true }] }));
  expect(view.getByRole("button", { name: "Excluir" })).toBeDisabled();
  expect(view.getByText("Excluir")).toHaveStyle({ color: "#FCA5A5" });
  fireEvent.press(view.getByRole("button", { name: "Excluir" })); expect(remove).not.toHaveBeenCalled();
});

test("only explicit field callbacks create editing controls and preserve the current values for accessibility", () => {
  const title = jest.fn(), startDate = jest.fn(), endDate = jest.fn(), startTime = jest.fn(), endTime = jest.fn(), accent = jest.fn(), notes = jest.fn();
  const parameters = { ...props, onTitlePress: title, onStartDatePress: startDate, onEndDatePress: endDate, onStartTimePress: startTime, onEndTimePress: endTime, onAccentPress: accent,
    rows: [{ key: "notes", icon: "notes" as const, label: "Anotações", value: "Levar bola", onPress: notes }, { key: "unit", icon: "organization" as const, label: "Unidade", value: "Rede Esperança" }],
  };
  const view = render(React.createElement(CalendarEntryDetails, parameters));
  const callbacks = [["Editar título", title], ["Editar data de início", startDate], ["Editar data de término", endDate], ["Editar hora de início", startTime], ["Editar hora de término", endTime], ["Editar cor", accent], ["Editar Anotações", notes]] as const;
  expect(view.getByLabelText("Editar título").props.accessibilityValue.text).toBe(props.title);
  expect(view.getByLabelText("Editar hora de início").props.accessibilityValue.text).toBe("09:00");
  expect(view.getByLabelText("Editar Anotações").props.accessibilityValue.text).toBe("Levar bola");
  expect(view.queryByRole("button", { name: "Editar Unidade" })).toBeNull();
  expect(view.getByLabelText("Unidade: Rede Esperança")).toBeTruthy();
  callbacks.forEach(([label, callback]) => { fireEvent.press(view.getByLabelText(label)); expect(callback).toHaveBeenCalledTimes(1); });
  view.rerender(React.createElement(CalendarEntryDetails, { ...parameters, disabled: true }));
  callbacks.forEach(([label, callback]) => { expect(view.getByLabelText(label)).toBeDisabled(); fireEvent.press(view.getByLabelText(label)); expect(callback).toHaveBeenCalledTimes(1); });
});

test("row-specific disabling does not create controls for read-only fields and all-day hides time edits", () => {
  const row = jest.fn(), time = jest.fn();
  const view = render(React.createElement(CalendarEntryDetails, { ...props, allDay: true, onStartTimePress: time, onEndTimePress: time,
    rows: [{ key: "notes", icon: "notes", label: "Anotações", value: "Levar material", onPress: row, disabled: true }],
  }));
  expect(view.queryByLabelText("Editar título")).toBeNull(); expect(view.queryByLabelText("Editar hora de início")).toBeNull();
  expect(view.getByLabelText(`Início: ${weekday(props.startDate)}, 29 de out.`)).toBeTruthy();
  expect(view.queryByLabelText("Editar hora de término")).toBeNull(); expect(view.queryByLabelText("Editar cor")).toBeNull();
  expect(view.getByLabelText("Editar Anotações")).toBeDisabled(); fireEvent.press(view.getByLabelText("Editar Anotações")); expect(row).not.toHaveBeenCalled();
});

test("five supported footer actions keep full labels and touch targets while an empty menu is omitted", () => {
  const callback = jest.fn();
  const actions: CalendarEntryDetailAction[] = [
    { key: "copy", label: "Duplicar", icon: "copy", onPress: callback }, { key: "edit", label: "Editar", icon: "edit", onPress: callback },
    { key: "share", label: "Compartilhar", icon: "share", onPress: callback }, { key: "delete", label: "Excluir", icon: "trash", onPress: callback },
    { key: "more", label: "Mais", icon: "ellipsisVertical", menuItems: [{ key: "export", label: "Exportar .ics", onPress: callback }] },
    { key: "empty", label: "Sem ação", icon: "options", menuItems: [] },
  ];
  const view = render(React.createElement(CalendarEntryDetails, { ...props, actions }));
  expect(view.getAllByRole("button")).toHaveLength(6); expect(view.queryByText("Sem ação")).toBeNull();
  actions.slice(0, 5).forEach(action => expect(view.getByRole("button", { name: action.label })).toHaveStyle({ minWidth: 44, minHeight: 56 }));
  expect(view.getByText("Compartilhar")).toHaveStyle({ fontSize: 10, lineHeight: 14 });
  expect(view.getByRole("button", { name: "Compartilhar" }).props.accessibilityLabel).toBe("Compartilhar");
});

test("More focuses enabled items, supports arrows/Home/End and restores its trigger on Escape", () => {
  const restore = jest.replaceProperty(Platform, "OS", "web");
  const copied = jest.fn(), exported = jest.fn(), ignored = jest.fn();
  const focused: string[] = [];
  const nodes = new Map<string, object>();
  const action: CalendarEntryDetailAction = { key: "more", label: "Mais", icon: "ellipsisVertical", onPress: ignored, menuItems: [
    { key: "disabled", label: "Indisponível", onPress: ignored, disabled: true }, { key: "copy", label: "Copiar informações", icon: "copy", onPress: copied }, { key: "export", label: "Exportar .ics", onPress: exported },
  ] };
  const view = render(React.createElement(CalendarEntryDetails, { ...props, actions: [action] }), { createNodeMock: element => {
    const id = element.props.nativeID as string | undefined;
    if (!id?.startsWith("calendar-entry-")) return null;
    if (!nodes.has(id)) nodes.set(id, { measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => done(280, 700, 56, 64), querySelector: () => ({ focus: () => focused.push(id) }) });
    return nodes.get(id);
  } });
  try {
    fireEvent.press(view.getByLabelText("Mais"));
    expect(ignored).not.toHaveBeenCalled(); expect(view.getByRole("menuitem", { name: "Copiar informações" })).toBeTruthy();
    expect(focused.at(-1)).toBe("calendar-entry-menu-more-copy");
    const key = (value: string) => fireEvent(view.UNSAFE_getAllByProps({ accessibilityRole: "menu" }).at(-1)!, "keyDown", { key: value, preventDefault: jest.fn(), stopPropagation: jest.fn() });
    key("ArrowDown"); expect(focused.at(-1)).toBe("calendar-entry-menu-more-export");
    key("ArrowDown"); expect(focused.at(-1)).toBe("calendar-entry-menu-more-copy");
    key("End"); expect(focused.at(-1)).toBe("calendar-entry-menu-more-export");
    key("Home"); expect(focused.at(-1)).toBe("calendar-entry-menu-more-copy");
    key("ArrowUp"); expect(focused.at(-1)).toBe("calendar-entry-menu-more-export");
    key("Escape"); expect(view.queryByRole("menuitem")).toBeNull(); expect(focused.at(-1)).toBe("calendar-entry-action-more-anchor");
    fireEvent.press(view.getByLabelText("Mais")); fireEvent.press(view.getByRole("menuitem", { name: "Copiar informações" }));
    expect(copied).toHaveBeenCalledTimes(1); expect(exported).not.toHaveBeenCalled(); expect(view.queryByRole("menuitem")).toBeNull();
  } finally { view.unmount(); restore.restore(); }
});

test("a late anchor measurement cannot reopen More after the detail becomes disabled", () => {
  let measure!: (x: number, y: number, width: number, height: number) => void;
  const action: CalendarEntryDetailAction = { key: "more", label: "Mais", icon: "ellipsisVertical", menuItems: [{ key: "copy", label: "Copiar informações", onPress: jest.fn() }] };
  const view = render(React.createElement(CalendarEntryDetails, { ...props, actions: [action] }), { createNodeMock: element => element.props.nativeID === "calendar-entry-action-more-anchor" ? { measureInWindow: (done: typeof measure) => { measure = done; } } : null });
  fireEvent.press(view.getByLabelText("Mais"));
  view.rerender(React.createElement(CalendarEntryDetails, { ...props, actions: [action], disabled: true }));
  act(() => measure(280, 700, 56, 64));
  expect(view.queryByRole("menuitem")).toBeNull(); expect(view.getByLabelText("Mais")).toBeDisabled();
});

test("a queued dismissal from an old menu cannot cancel the next opening measurement", () => {
  const measurements: ((x: number, y: number, width: number, height: number) => void)[] = [];
  const action: CalendarEntryDetailAction = { key: "more", label: "Mais", icon: "ellipsisVertical", menuItems: [{ key: "copy", label: "Copiar informações", onPress: jest.fn() }] };
  const view = render(React.createElement(CalendarEntryDetails, { ...props, actions: [action] }), { createNodeMock: element => element.props.nativeID === "calendar-entry-action-more-anchor" ? { measureInWindow: (done: typeof measurements[number]) => measurements.push(done) } : null });
  fireEvent.press(view.getByLabelText("Mais")); act(() => measurements[0](280, 700, 56, 64));
  expect(view.getByRole("menuitem", { name: "Copiar informações" })).toBeTruthy();
  const oldDismiss = mockDropdown.mock.calls.at(-1)![0].onRequestClose;
  act(() => oldDismiss());
  fireEvent.press(view.getByLabelText("Mais"));
  act(() => { oldDismiss(); measurements[1](280, 700, 56, 64); });
  expect(view.getByRole("menuitem", { name: "Copiar informações" })).toBeTruthy();
});
