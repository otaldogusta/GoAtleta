import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { CalendarMonthPicker } from "../CalendarMonthPicker";

jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: new Proxy({}, { get: () => "#334455" }) }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));

test("selects a month, clamps the preserved day and closes", () => {
  const onChange = jest.fn(), onClose = jest.fn();
  const view = render(React.createElement(CalendarMonthPicker, { visible: true, value: "2026-01-31", onChange, onClose }));
  fireEvent.press(view.getByLabelText("Selecionar mês fevereiro de 2026"));
  expect(onChange).toHaveBeenCalledWith("2026-02-28");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("year navigation and cancellation do not commit a date", () => {
  const onChange = jest.fn(), onClose = jest.fn();
  const view = render(React.createElement(CalendarMonthPicker, { visible: true, value: "2026-09-12", onChange, onClose }));
  fireEvent.press(view.getByLabelText("Próximo ano"));
  expect(view.getByLabelText("Selecionar mês setembro de 2027")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Ano anterior"));
  fireEvent.press(view.getByLabelText("Escolher ano"));
  fireEvent.press(view.getByLabelText("Próximos anos"));
  fireEvent.press(view.getByLabelText("Selecionar ano 2028"));
  expect(view.getByLabelText("Selecionar mês setembro de 2028")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Cancelar seleção de mês"));
  expect(onChange).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("reopening resets temporary year selection and leap February keeps day 29", () => {
  const onChange = jest.fn(), onClose = jest.fn();
  const view = render(React.createElement(CalendarMonthPicker, { visible: true, value: "2024-01-31", onChange, onClose }));
  fireEvent.press(view.getByLabelText("Próximo ano"));
  view.rerender(React.createElement(CalendarMonthPicker, { visible: false, value: "2024-01-31", onChange, onClose }));
  view.rerender(React.createElement(CalendarMonthPicker, { visible: true, value: "2024-01-31", onChange, onClose }));
  fireEvent.press(view.getByLabelText("Selecionar mês fevereiro de 2024"));
  expect(onChange).toHaveBeenCalledWith("2024-02-29");
});
