import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { DatePickerModal } from "../DatePickerModal";

const mockModal = jest.fn();
jest.mock("../app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
jest.mock("../icon-registry", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return { GoAtletaIcon: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock("../ModalSheet", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { ModalSheet: ({ children, visible }: { children: React.ReactNode; visible: boolean }) => {
    mockModal(visible);
    return visible ? React.createElement(View, { testID: "modal-sheet" }, children) : null;
  } };
});
beforeEach(() => mockModal.mockClear());

test("inline renders the selected month in the flow without a modal or closing footer", () => {
  const view = render(React.createElement(DatePickerModal, { inline: true, visible: true, value: "2037-02-14", onChange: jest.fn(), onClose: jest.fn() }));
  expect(view.getByTestId("date-picker-inline")).toBeTruthy();
  expect(view.getByRole("button", { name: "Selecionar mês: Fevereiro de 2037" })).toBeTruthy();
  expect(view.queryByText("Dia")).toBeNull();
  expect(view.queryByText("Fev")).toBeNull();
  expect(view.getByRole("button", { name: /14 de fevereiro de 2037/ }).props.accessibilityState.selected).toBe(true);
  expect(view.queryByText("Fechar")).toBeNull();
  expect(view.queryByText("Cancelar")).toBeNull();
  expect(view.queryByTestId("modal-sheet")).toBeNull();
  expect(mockModal).not.toHaveBeenCalled();
});

test.each([false, true])("inline date selection respects closeOnSelect=%s", closeOnSelect => {
  const change = jest.fn(), close = jest.fn();
  const view = render(React.createElement(DatePickerModal, { inline: true, visible: true, value: "2037-02-14", closeOnSelect, onChange: change, onClose: close }));
  fireEvent.press(view.getByRole("button", { name: /10 de fevereiro de 2037/ }));
  expect(change).toHaveBeenCalledWith("2037-02-10");
  expect(close).toHaveBeenCalledTimes(closeOnSelect ? 1 : 0);
});

test("inline keeps month/year navigation and clamps dates when selecting a short month", () => {
  const change = jest.fn(), close = jest.fn();
  const view = render(React.createElement(DatePickerModal, { inline: true, visible: true, value: "2026-01-31", onChange: change, onClose: close }));
  fireEvent.press(view.getByRole("button", { name: "Próximo mês" }));
  fireEvent.press(view.getByRole("button", { name: "Selecionar mês: Fevereiro de 2026" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole("button", { name: "Abril de 2026" }));
  expect(change).toHaveBeenLastCalledWith("2026-04-30");
  fireEvent.press(view.getByRole("button", { name: "Selecionar ano: 2026" }));
  fireEvent.press(view.getByRole("button", { name: "Próximos 12 anos" }));
  fireEvent.press(view.getByRole("button", { name: "Ano 2028" }));
  expect(change).toHaveBeenLastCalledWith("2028-04-30");
  fireEvent.press(view.getByRole("button", { name: "Mostrar dias do mês: 2028–2039" }));
  expect(view.getByRole("button", { name: "Selecionar mês: Abril de 2028" })).toBeTruthy();
  expect(change).toHaveBeenCalledTimes(2);
  expect(close).not.toHaveBeenCalled();
  expect(mockModal).not.toHaveBeenCalled();
});

test("inline adjacent days select their real month and year instead of the displayed month", () => {
  const change = jest.fn(), close = jest.fn();
  const view = render(React.createElement(DatePickerModal, { inline: true, visible: true, value: "2026-10-29", closeOnSelect: true, onChange: change, onClose: close }));
  fireEvent.press(view.getByRole("button", { name: /30 de setembro de 2026/ }));
  expect(change).toHaveBeenLastCalledWith("2026-09-30");
  fireEvent.press(view.getByRole("button", { name: /1 de novembro de 2026/ }));
  expect(change).toHaveBeenLastCalledWith("2026-11-01");
  expect(close).toHaveBeenCalledTimes(2);
});

test("inline hides entirely when visible is false and honors an initial year view", () => {
  const props = { inline: true, visible: false, value: "2037-02-14", initialViewMode: "year" as const, onChange: jest.fn(), onClose: jest.fn() };
  const view = render(React.createElement(DatePickerModal, props));
  expect(view.queryByTestId("date-picker-inline")).toBeNull();
  expect(mockModal).not.toHaveBeenCalled();
  view.rerender(React.createElement(DatePickerModal, { ...props, visible: true }));
  expect(view.getByRole("button", { name: "Ano 2039" })).toBeTruthy();
  expect(view.queryByText("10")).toBeNull();
});

test("default modal presentation keeps its close button and selection behavior", () => {
  const change = jest.fn(), close = jest.fn();
  const view = render(React.createElement(DatePickerModal, { visible: true, value: "2037-02-14", onChange: change, onClose: close }));
  expect(view.getByTestId("modal-sheet")).toBeTruthy();
  expect(view.queryByTestId("date-picker-inline")).toBeNull();
  expect(view.getByRole("button", { name: "Ir para hoje" })).toBeTruthy();
  expect(view.getByText("Dia")).toBeTruthy();
  expect(view.getByText("Fev")).toBeTruthy();
  expect(view.getByText("2037")).toBeTruthy();
  expect(view.queryByRole("button", { name: /31 de janeiro de 2037/ })).toBeNull();
  fireEvent.press(view.getByRole("button", { name: /10 de fevereiro de 2037/ }));
  expect(change).toHaveBeenCalledWith("2037-02-10");
  expect(close).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole("button", { name: "Fechar calendário" }));
  expect(close).toHaveBeenCalledTimes(1);
});
