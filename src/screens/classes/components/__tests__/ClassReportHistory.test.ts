import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ClassReportHistory } from "../ClassReportHistory";
import { buildReportHistory } from "../../application/report-history";

jest.mock("../../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: () => null }));
const year = new Date().getFullYear();
const entries = buildReportHistory([
  { id: "1", clientId: "1", createdAt: `${year}-10-07T12:00:00Z`, activity: "Recepção", conclusion: "Duplas" },
  { id: "2", clientId: "2", createdAt: `${year}-08-28T12:00:00Z`, activity: "Saque", conclusion: "Alvos" },
]);
const props = {
  colors: { text: "#fff", muted: "#aaa", border: "#555", inputText: "#fff" } as any,
  inputBackground: "#121c30", compact: false, className: "Turma", active: true, entries,
  loading: false, error: false, onRetry: jest.fn(), onOpenReport: jest.fn(), onClose: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

it("opens the dated report, preserving the search when the list becomes active again", () => {
  const screen = render(React.createElement(ClassReportHistory, props));
  fireEvent.changeText(screen.getByLabelText("Buscar no relato"), "recepcao");
  fireEvent.press(screen.getByLabelText(`Abrir relatório de 07/10/${year}: Recepção`));
  expect(props.onOpenReport).toHaveBeenCalledWith(`${year}-10-07`);
  screen.rerender(React.createElement(ClassReportHistory, { ...props, active: false }));
  screen.rerender(React.createElement(ClassReportHistory, props));
  expect(screen.getByDisplayValue("recepcao")).toBeTruthy();
  expect(screen.queryByText("Saque")).toBeNull();
  expect(screen.getByText("1 relatório")).toBeTruthy();
});

it("distinguishes an empty search, clears filters and shows the complete list", () => {
  const screen = render(React.createElement(ClassReportHistory, props));
  fireEvent.changeText(screen.getByLabelText("Buscar no relato"), "unmatched");
  expect(screen.getByText("Nenhum relatório neste filtro.")).toBeTruthy();
  fireEvent.press(screen.getByText("Limpar filtros"));
  expect(screen.getByText("2 relatórios")).toBeTruthy();
  expect(screen.getByLabelText("Ano: Todos os anos")).toBeTruthy();
});

it("shows actionable errors separately from an empty history", () => {
  const screen = render(React.createElement(ClassReportHistory, { ...props, entries: [], error: true }));
  fireEvent.press(screen.getByText("Tentar novamente"));
  expect(props.onRetry).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Nenhum relatório registrado.")).toBeNull();
  screen.rerender(React.createElement(ClassReportHistory, { ...props, entries: [] }));
  expect(screen.getByText("Nenhum relatório registrado.")).toBeTruthy();
});

it("limits the rendered history while making older reports reachable", () => {
  const many = buildReportHistory(Array.from({ length: 40 }, (_, index) => ({
    id: String(index), clientId: String(index), activity: `Aula ${index}`, conclusion: "",
    createdAt: new Date(Date.UTC(year, 9, 7 - index, 12)).toISOString(),
  })));
  const screen = render(React.createElement(ClassReportHistory, { ...props, entries: many }));
  expect(screen.getAllByLabelText(/^Abrir relatório de /)).toHaveLength(30);
  fireEvent.press(screen.getByText("Mostrar mais relatórios"));
  expect(screen.getAllByLabelText(/^Abrir relatório de /)).toHaveLength(40);
});
