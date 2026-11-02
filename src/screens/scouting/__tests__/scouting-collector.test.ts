import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { ScoutingContact, ScoutingRallyOutcome, ScoutingSide, Student } from "../../../core/models";
import type { ScoutingDetail } from "../../../db/scouting-collection";
import { ScoutingCollector } from "../ScoutingCollector";
import { ScoutingModal } from "../ScoutingUI";
import { ContactPad } from "../ScoutingCaptureUI";
import { Button } from "../../../ui/Button";

const mockExecute = jest.fn(async () => true);
const mockError = jest.fn();
const mockShortcuts = jest.fn();
let mockBusy = false;
let mockRosterSaving = false;
let mockPending: object | null = null;
let mockContacts: ScoutingContact[] = [];
let mockTraining = false;
let mockHasPoint = false;
let mockRevision = 0;
let mockRoster: { studentId: string; jersey: string }[] | null = null;
let mockCaptureVersion: number | undefined = 2;
let mockOutcome: ScoutingRallyOutcome | null = null, mockPointOutcome: ScoutingRallyOutcome | null = null;
let mockServe: ScoutingSide = 'them';
let mockSetOutcome: React.Dispatch<React.SetStateAction<ScoutingRallyOutcome|null>>;
jest.mock("../use-scouting-roster", () => ({
  ...jest.requireActual("../use-scouting-roster"),
  useScoutingRoster: () => ({ players: mockRoster, loading: false, saving: mockRosterSaving, error: "", save: jest.fn() }),
}));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: {} }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../use-scouting-shortcuts", () => ({ useScoutingShortcuts: (options: unknown) => mockShortcuts(options) }));
jest.mock("../use-scouting-collection", () => ({ useScoutingCollection: () => {
  const [contacts, changeContacts] = jest.requireActual<typeof React>("react").useState(mockContacts);
  const [outcome,changeOutcome] = jest.requireActual<typeof React>("react").useState(mockOutcome);mockSetOutcome=changeOutcome;
  return { contacts, changeContacts, outcome, changeOutcome, execute: mockExecute, setError: mockError, error: "", loading: false, busy: mockBusy, pending: mockPending, conflict: false,
    detail: { captureReady: true, captureVersion: mockCaptureVersion, session: { id: "game", revision: mockRevision, title: "Jogo", date: "2026-10-07", type: mockTraining ? "treino" : "jogo", status: "em_andamento", format: "6x6", matchState: mockTraining ? null : { setNumber: 1, scoreUs: 12, scoreThem: 10, serve: mockServe, rotation: 3, recoveredDraft: [], recoveredOutcome: outcome } }, actions: mockTraining ? [{ id: "action-1", fundamental: "recepcao", resultLabel: "Boa", phase: "side_out" }] : [], rallies: mockHasPoint ? [{ id: "point-1", setNumber: 1, won: false, contacts: [], outcome: mockPointOutcome }] : [] } as unknown as ScoutingDetail,
  };
} }));
const students = [{ id: "ana", name: "Ana Martins" }, { id: "maria1", name: "Maria Júlia Rodrigues" }, { id: "maria2", name: "Maria Gabriely Campos" }] as Student[];
const collectorProps = () => ({ org: "org", sessionId: "game", userId: "user", students, onClose: jest.fn(), onSaved: jest.fn() });
const setup = (options: Partial<React.ComponentProps<typeof ScoutingCollector>> = {}) => render(React.createElement(ScoutingCollector, { ...collectorProps(), ...options }));
beforeEach(() => { jest.clearAllMocks(); mockContacts = []; mockTraining = false; mockRoster = null; mockHasPoint = false; mockRevision = 0; mockBusy = false; mockRosterSaving = false; mockPending = null; mockCaptureVersion=2;mockOutcome=null;mockPointOutcome=null;mockServe='them'; });

test("redo restores the reopened point with the original winner and rejects a later revision", async () => {
  mockHasPoint = true;
  const screen = setup();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Desfazer ponto" })));
  expect(mockExecute).toHaveBeenLastCalledWith({ name: "reopen_point", payload: { rallyId: "point-1" } });
  mockRevision = 1; mockHasPoint = false;
  const refresh = () => screen.rerender(React.createElement(ScoutingCollector, { org: "org", sessionId: "game", userId: "user", students, onClose: jest.fn(), onSaved: jest.fn() }));
  refresh();
  expect(screen.getByRole("button", { name: "Refazer ponto" })).toBeTruthy();
  mockRevision = 2; refresh();
  expect(screen.queryByRole("button", { name: "Refazer ponto" })).toBeNull();
  mockRevision = 1; refresh();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Refazer ponto" })));
  expect(mockExecute).toHaveBeenLastCalledWith({ name: "point", payload: { contacts: [], winner: "them" } });
  expect(screen.queryByRole("button", { name: "Refazer ponto" })).toBeNull();
});

test("a game roster filters the collector and shows jerseys without changing student names", () => {
  mockRoster = [{ studentId: "maria2", jersey: "14" }, { studentId: "ana", jersey: "1" }];
  const screen = setup();
  expect(screen.getByRole("button", { name: "Camisa 1: Ana Martins" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Camisa 14: Maria Gabriely Campos" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Maria Júlia Rodrigues" })).toBeNull();
  expect(students[0].name).toBe("Ana Martins");
});

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


test("setter position P6 keeps its numeric value when starting the next set", async () => {
  const screen = setup();
  expect(screen.getByText("Set 1 · P3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Ver pontos" }));
  fireEvent.press(screen.getByRole("button", { name: "Próximo set" }));
  fireEvent.press(screen.getByRole("button", { name: "P6" }));
  expect(screen.getByRole("button", { name: "P6" }).props.accessibilityState.selected).toBe(true);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Começar coleta" })); });
  expect(mockExecute).toHaveBeenCalledWith({ name: "start_set", payload: { setNumber: 2, scoreUs: 0, scoreThem: 0, serve: "us", rotation: 6 } });
});

test("embedded collection keeps the same score and footer without opening another modal", () => {
  const modal = setup();
  expect(modal.UNSAFE_queryAllByType(ScoutingModal)).toHaveLength(1);
  modal.unmount();
  const onClose = jest.fn(), embedded = setup({ presentation: "embedded", onClose, containerWidth: 380 });
  expect(embedded.UNSAFE_queryAllByType(ScoutingModal)).toHaveLength(0);
  expect(embedded.getByLabelText("Coletor de scouting")).toBeTruthy();
  expect(embedded.getByLabelText("Placar: nós 12, adversário 10")).toBeTruthy();
  expect(embedded.getByRole("button", { name: "＋ Nosso ponto" })).toBeEnabled();
  expect(embedded.UNSAFE_getByType(ContactPad).props.wide).toBe(false);
  expect(embedded.queryByRole("button", { name: "Fechar coletor" })).toBeNull();
  expect(embedded.queryByRole("button", { name: "Fechar análise" })).toBeNull();
  expect(embedded.queryByText("Jogo · 6x6 · 07 de out. de 2026")).toBeNull();
  expect(embedded.getByText("Registrar jogada")).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
  expect(mockExecute).not.toHaveBeenCalled();
});

test("inactive embedded collector disables shortcuts and actions while retaining an unfinished contact", () => {
  const onDirtyChange = jest.fn(), props = { ...collectorProps(), presentation: "embedded" as const, onDirtyChange, containerWidth: 380 };
  const screen = render(React.createElement(ScoutingCollector, props));
  expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  fireEvent.press(screen.getByRole("button", { name: "Ana Martins" }));
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("button", { name: "Boa" })).toBeEnabled();
  screen.rerender(React.createElement(ScoutingCollector, { ...props, active: false }));
  expect(mockShortcuts).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  const hiddenPoint = screen.UNSAFE_getAllByType(Button).find(node => node.props.label === "＋ Nosso ponto")!;
  expect(hiddenPoint.props.disabled).toBe(true);
  expect(screen.UNSAFE_getByType(ContactPad).props.disabled).toBe(true);
  act(() => hiddenPoint.props.onPress());
  expect(mockExecute).not.toHaveBeenCalled();
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  screen.rerender(React.createElement(ScoutingCollector, { ...props, active: true }));
  expect(mockShortcuts).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  expect(screen.getByRole("button", { name: "Boa" })).toBeEnabled();
  fireEvent.press(screen.getByRole("button", { name: "Boa" }));
  expect(screen.getByRole("button", { name: "Editar contato 1: Ana Martins, Recepção, Boa" })).toBeTruthy();
  expect(mockExecute).not.toHaveBeenCalled();
  screen.unmount();
  expect(onDirtyChange).toHaveBeenLastCalledWith(false);
});

test("confirmed history is clean but pending contacts, configuration and in-flight saves remain dirty", () => {
  const onDirtyChange = jest.fn();mockHasPoint = true;
  const screen = setup({ presentation: "embedded", onDirtyChange });
  fireEvent.press(screen.getByRole("button", { name: "Ver pontos" }));
  expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  fireEvent.press(screen.getByRole("button", { name: "Próximo set" }));
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  screen.unmount();
  mockContacts = [{ fundamental: "saque", resultKey: "entrou", phase: "saque" }];
  const draft = setup({ presentation: "embedded", onDirtyChange });
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);draft.unmount();
  mockContacts = [];mockBusy = true;
  const busy = setup({ presentation: "embedded", onDirtyChange });
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);busy.unmount();
  mockBusy = false;mockPending = { requestId: "pending" };
  setup({ presentation: "embedded", onDirtyChange });
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
});

test("embedded layout follows its available width instead of the full window", () => {
  const props = { ...collectorProps(), presentation: "embedded" as const, containerWidth: 380 };
  const screen = render(React.createElement(ScoutingCollector, props));
  expect(screen.UNSAFE_getByType(ContactPad).props.wide).toBe(false);
  screen.rerender(React.createElement(ScoutingCollector, { ...props, containerWidth: 680 }));
  expect(screen.UNSAFE_getByType(ContactPad).props.wide).toBe(true);
  expect(mockExecute).not.toHaveBeenCalled();
});

test("busy notifications distinguish in-flight requests from persisted pending commands and clear on unmount", () => {
  const onBusyChange = jest.fn(), props = { ...collectorProps(), presentation: "embedded" as const, onBusyChange };
  mockPending = { requestId: "retry-later" };
  const screen = render(React.createElement(ScoutingCollector, props));
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  mockBusy = true;screen.rerender(React.createElement(ScoutingCollector, props));
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  mockBusy = false;screen.rerender(React.createElement(ScoutingCollector, props));
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  mockRosterSaving = true;screen.rerender(React.createElement(ScoutingCollector, props));
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  screen.unmount();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

test('an opponent ace is an optional ending and submits exactly one point with no receiver',async()=>{
  mockCaptureVersion=3;const onDirtyChange=jest.fn(),screen=setup({presentation:'embedded',onDirtyChange});
  fireEvent.press(screen.getByRole('button',{name:'Motivo do ponto'}));
  fireEvent.press(screen.getByRole('button',{name:'Ace adversário'}));
  expect(screen.getByRole('button',{name:'＋ Nosso ponto'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'＋ Ponto adversário'})).toBeEnabled();
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);expect(mockExecute).not.toHaveBeenCalled();
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'＋ Ponto adversário'})));
  expect(mockExecute).toHaveBeenCalledTimes(1);expect(mockExecute).toHaveBeenCalledWith({name:'point',payload:{contacts:[],winner:'them',outcome:{kind:'ace',team:'them'}}});
  expect(screen.queryByRole('button',{name:/Editar contato 1/})).toBeNull();
});

test('our net fault selects the opponent winner and can be cleared without adding a contact',async()=>{
  mockCaptureVersion=3;const screen=setup();
  fireEvent.press(screen.getByRole('button',{name:'Motivo do ponto'}));fireEvent.press(screen.getByRole('button',{name:'Falta nossa'}));fireEvent.press(screen.getByRole('button',{name:'Rede'}));
  expect(screen.getByRole('button',{name:'Falta nossa · Rede'})).toBeTruthy();expect(screen.getByRole('button',{name:'＋ Nosso ponto'})).toBeDisabled();
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'＋ Ponto adversário'})));
  expect(mockExecute).toHaveBeenLastCalledWith({name:'point',payload:{contacts:[],winner:'them',outcome:{kind:'falta',team:'us',reason:'rede'}}});
  fireEvent.press(screen.getByRole('button',{name:'Limpar motivo'}));expect(screen.getByRole('button',{name:'＋ Nosso ponto'})).toBeEnabled();
});

test.each([undefined,2])('capture capability %p keeps new endings and result keys unavailable',captureVersion=>{
  mockCaptureVersion=captureVersion;const screen=setup();
  expect(screen.queryByRole('button',{name:'Motivo do ponto'})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Ataque'}));
  expect(screen.queryByRole('button',{name:'Bola de graça'})).toBeNull();expect(screen.queryByRole('button',{name:'Voltou do bloqueio'})).toBeNull();
  expect(screen.UNSAFE_getByType(ContactPad).props.captureVersion).toBe(2);expect(mockExecute).not.toHaveBeenCalled();
});

test('new result keys require explicit capability 3 and returned block suggests coverage without inventing it',()=>{
  mockCaptureVersion=3;const screen=setup();fireEvent.press(screen.getByRole('button',{name:'Ataque'}));
  expect(screen.getByRole('button',{name:'Bola de graça'})).toBeTruthy();
  fireEvent.press(screen.getByRole('button',{name:'Ana Martins'}));fireEvent.press(screen.getByRole('button',{name:'Voltou do bloqueio'}));
  expect(screen.getByRole('button',{name:'Editar contato 1: Ana Martins, Ataque, Voltou do bloqueio'})).toBeTruthy();
  expect(screen.UNSAFE_getByType(ContactPad).props.skill).toBe('cobertura');
  expect(screen.queryByRole('button',{name:/Editar contato 2/})).toBeNull();expect(mockExecute).not.toHaveBeenCalled();
});

test('redo preserves recovered ending and becomes invalid when that ending changes',async()=>{
  mockCaptureVersion=3;mockHasPoint=true;mockPointOutcome={kind:'ace',team:'them'};const screen=setup();
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'Desfazer ponto'})));
  mockRevision=1;mockHasPoint=false;act(()=>mockSetOutcome(mockPointOutcome));
  screen.rerender(React.createElement(ScoutingCollector,collectorProps()));
  expect(screen.getByRole('button',{name:'Refazer ponto'})).toBeTruthy();
  act(()=>mockSetOutcome({kind:'falta',team:'us',reason:'rede'}));expect(screen.queryByRole('button',{name:'Refazer ponto'})).toBeNull();
  act(()=>mockSetOutcome(mockPointOutcome));
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'Refazer ponto'})));
  expect(mockExecute).toHaveBeenLastCalledWith({name:'point',payload:{contacts:[],winner:'them',outcome:{kind:'ace',team:'them'}}});
});
