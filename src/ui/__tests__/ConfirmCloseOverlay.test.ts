import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { ConfirmCloseOverlay } from "../ConfirmCloseOverlay";

jest.mock("../app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../ModalSheet", () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) => children,
}));

test("exposes the default actions by name and keeps continuing separate from discarding", () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  const screen = render(React.createElement(ConfirmCloseOverlay, {
    visible: true, onCancel, onConfirm,
  }));

  fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "Descartar" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test("keeps custom names and distinct callbacks for the three-action confirmation", () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  const onDiscard = jest.fn();
  const screen = render(React.createElement(ConfirmCloseOverlay, {
    visible: true, cancelLabel: "Continuar editando", confirmLabel: "Salvar",
    discardLabel: "Descartar alterações", onCancel, onConfirm, onDiscard,
  }));

  fireEvent.press(screen.getByRole("button", { name: "Descartar alterações" }));
  expect(onDiscard).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "Continuar editando" }));
  fireEvent.press(screen.getByRole("button", { name: "Salvar" }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test("keeps the confirmation action absent when the consumer only allows continuing or discarding", () => {
  const onDiscard = jest.fn();
  const onConfirm = jest.fn();
  const screen = render(React.createElement(ConfirmCloseOverlay, {
    visible: true, cancelLabel: "Continuar editando", discardLabel: "Descartar",
    confirmLabel: "Salvar", showConfirmAction: false, onCancel: jest.fn(), onConfirm, onDiscard,
  }));

  expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  expect(screen.getAllByRole("button")).toHaveLength(2);
  fireEvent.press(screen.getByRole("button", { name: "Descartar" }));
  expect(onDiscard).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

test("does not expose actions while the overlay is closed", () => {
  const screen = render(React.createElement(ConfirmCloseOverlay, {
    visible: false, onCancel: jest.fn(), onConfirm: jest.fn(),
  }));
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});
