import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import type { ClassGroup } from "../../../core/models";
import { HolidayRecommendation } from "../HolidayRecommendation";

jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/ModalSheet", () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));

const friday = { id: "fri", name: "Turma de sexta", daysOfWeek: [5] } as ClassGroup;
const thursday = { id: "thu", name: "Turma de quinta", daysOfWeek: [4] } as ClassGroup;
const props = { holiday: "Consciência Negra", date: "2026-11-20", saving: false, error: "" };

it("limits review and bulk confirmation to classes scheduled on the holiday", () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const view = render(React.createElement(HolidayRecommendation, {
    ...props, classes: [thursday, friday], pausedIds: [thursday.id], onSave,
  }));
  fireEvent.press(view.getByText("Revisar aulas"));
  expect(view.getByText(friday.name)).toBeTruthy();
  expect(view.queryByText(thursday.name)).toBeNull();
  fireEvent.press(view.getByText("Marcar todas sem aula neste dia"));
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.press(view.getByText("Confirmar"));
  expect(onSave).toHaveBeenCalledWith([friday.id]);
});

it("hides the review when there are no classes scheduled on the holiday", () => {
  const view = render(React.createElement(HolidayRecommendation, {
    ...props, classes: [thursday], onSave: jest.fn(),
  }));
  expect(view.queryByText("Revisar aulas")).toBeNull();
});

it("offers scheduling only for suspended classes and allows deferring it", () => {
  const onSchedule = jest.fn();
  const onSave = jest.fn();
  const view = render(React.createElement(HolidayRecommendation, {
    ...props, classes: [friday, thursday], onSchedule, onSave,
  }));
  fireEvent.press(view.getByText("Revisar aulas"));
  expect(view.queryByText("Confirmar e agendar reposição")).toBeNull();
  fireEvent.press(view.getByLabelText("Turma de sexta: Sem aula"));
  fireEvent.press(view.getByText("Confirmar e agendar reposição"));
  expect(onSchedule).toHaveBeenCalledWith([friday.id]);
  expect(onSave).not.toHaveBeenCalled();
});
