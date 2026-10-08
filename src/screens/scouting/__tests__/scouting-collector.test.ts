import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { ScoutingContact, Student } from "../../../core/models";
import type { ScoutingDetail } from "../../../db/scouting-collection";
import { ScoutingCollector } from "../ScoutingCollector";

const mockExecute = jest.fn(async () => true);
const mockError = jest.fn();
let mockContacts: ScoutingContact[] = [];
let mockTraining = false;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: {} }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../use-scouting-collection", () => ({ useScoutingCollection: () => {
  const [contacts, changeContacts] = jest.requireActual<typeof React>("react").useState(mockContacts);
  return { contacts, changeContacts, execute: mockExecute, setError: mockError, error: "", loading: false, busy: false, pending: null, conflict: false,
    detail: { captureReady: true, session: { id: "game", title: "Jogo", date: "2026-10-07", type: mockTraining ? "treino" : "jogo", status: "em_andamento", format: "6x6", matchState: mockTraining ? null : { setNumber: 1, scoreUs: 12, scoreThem: 10, serve: "them", rotation: 3, recoveredDraft: [] } }, actions: mockTraining ? [{ id: "action-1", fundamental: "recepcao", resultLabel: "Boa", phase: "side_out" }] : [], rallies: [] } as unknown as ScoutingDetail,
  };
} }));
const students = [{ id: "ana", name: "Ana Martins" }, { id: "maria1", name: "Maria Júlia Rodrigues" }, { id: "maria2", name: "Maria Gabriely Campos" }] as Student[];
const setup = () => render(React.createElement(ScoutingCollector, { org: "org", sessionId: "game", userId: "user", students, onClose: jest.fn(), onSaved: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); mockContacts = []; mockTraining = false; });

test("requires an explicit athlete or team choice before adding a contact, and keeps unconfirmed contacts out of the score", async () => {
  const screen = setup();
  expect(screen.getByRole("button", { name: "Boa" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "Ana Martins" }));
  expect(screen.getByRole("button", { name: "＋ Nosso ponto" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "Boa" }));
  expect(screen.getByRole("button", { name: "Editar contato 1: Ana Martins, Recepção, Boa" })).toBeTruthy();
  expect(mockExecute).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "＋ Nosso ponto" })); });
  expect(mockExecute).toHaveBeenCalledWith({ name: "point", payload: { winner: "us", contacts: [expect.objectContaining({ studentId: "ana", resultKey: "b_medio" })] } });
});

test("permits unattributed observations explicitly and distinguishes athletes with the same first name", () => {
  const screen = setup();
  expect(screen.getByText("Maria Júlia")).toBeTruthy();
  expect(screen.getByText("Maria Gabriely")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Sem atleta" }));
  fireEvent.press(screen.getByRole("button", { name: "Boa" }));
  expect(screen.getByRole("button", { name: "Editar contato 1: Equipe, Recepção, Boa" })).toBeTruthy();
});

test("editing a contact locks the point until the correction is applied; undo removes only the last contact", () => {
  mockContacts = [{ athleteName: "Ana Martins", studentId: "ana", fundamental: "recepcao", resultKey: "b_medio", phase: "side_out" }, { fundamental: "levantamento", resultKey: "organizou", phase: "side_out" }];
  const screen = setup();
  fireEvent.press(screen.getByRole("button", { name: "Editar contato 1: Ana Martins, Recepção, Boa" }));
  expect(screen.getByRole("button", { name: "＋ Nosso ponto" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "Completa" }));
  expect(screen.getByRole("button", { name: "Editar contato 1: Ana Martins, Recepção, Completa" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Desfazer contato" }));
  expect(screen.queryByRole("button", { name: /Editar contato 2/ })).toBeNull();
  expect(screen.getByRole("button", { name: "Editar contato 1: Ana Martins, Recepção, Completa" })).toBeTruthy();
});

test("training keeps the selected athlete for repeated observations and still allows undo", async () => {
  mockTraining = true;
  const screen = setup();
  fireEvent.press(screen.getByRole("button", { name: "Ana Martins" }));
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Boa" })); });
  expect(screen.getByRole("button", { name: "Boa" })).toBeEnabled();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Desfazer ação" })); });
  expect(mockExecute).toHaveBeenLastCalledWith({ name: "undo_action", payload: { actionId: "action-1" } });
});

test("the next set remains accessible even when the current set has no recorded points", () => {
  const screen = setup();
  fireEvent.press(screen.getByRole("button", { name: "Ver pontos" }));
  fireEvent.press(screen.getByRole("button", { name: "Próximo set" }));
  expect(screen.getByText("Set 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Começar coleta" })).toBeEnabled();
});
