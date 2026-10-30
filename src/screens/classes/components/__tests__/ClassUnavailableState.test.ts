import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { ClassUnavailableState } from "../ClassUnavailableState";

jest.mock("../../../../components/ui/ScreenPageHeader", () => ({ ScreenPageHeader: () => null }));
jest.mock("../../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../../ui/app-theme", () => ({
  useAppTheme: () => ({ colors: {
    background: "#0E1729", card: "#162033", border: "#334155", secondaryBg: "#0A1322",
    text: "#F1F4F9", muted: "#8A9AB3", primaryBg: "#3DDC84", primaryText: "#0A1322",
  } }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual<typeof import("react-native")>("react-native").View,
}));

it("explains the current institution without asserting that the class was deleted", () => {
  const onBack = jest.fn();
  const onRetry = jest.fn();
  const screen = render(React.createElement(ClassUnavailableState, { kind: "unavailable", organizationName: "Escola A", onBack, onRetry }));
  expect(screen.getByText("Turma indisponível")).toBeTruthy();
  expect(screen.getByText("Não encontramos esta turma em Escola A. Confira a instituição e seu acesso.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Voltar para turmas" }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onRetry).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it("offers retry for a load failure without presenting an absent class", () => {
  const screen = render(React.createElement(ClassUnavailableState, { kind: "error", errorMessage: "Sua conexão está indisponível.", onBack: jest.fn(), onRetry: jest.fn() }));
  expect(screen.getByText("Não foi possível carregar a turma")).toBeTruthy();
  expect(screen.getByText("Sua conexão está indisponível.")).toBeTruthy();
  expect(screen.queryByText("Turma indisponível")).toBeNull();
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
});

it("asks for an institution without claiming that a class lookup failed", () => {
  const screen = render(React.createElement(ClassUnavailableState, { kind: "context", onBack: jest.fn(), onRetry: jest.fn() }));
  expect(screen.getByText("Escolha uma instituição")).toBeTruthy();
  expect(screen.getByText("Abra uma instituição com acesso a esta turma.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  expect(screen.getByRole("button", { name: "Voltar para turmas" })).toBeTruthy();
});

it("uses safe copy when the current institution name is unavailable", () => {
  const screen = render(React.createElement(ClassUnavailableState, { kind: "unavailable", onBack: jest.fn(), onRetry: jest.fn() }));
  expect(screen.getByText("Não encontramos esta turma na instituição atual. Confira a instituição e seu acesso.")).toBeTruthy();
});
