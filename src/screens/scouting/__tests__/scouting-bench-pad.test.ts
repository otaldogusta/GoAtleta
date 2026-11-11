import React from "react";
import * as Native from "react-native";
import { act, fireEvent, render, within } from "@testing-library/react-native";
import type { Student } from "../../../core/models";
import { ScoutingBenchPad } from "../ScoutingBenchPad";
import { ScoutingLineupCourt } from "../ScoutingLineupCourt";

let mockDimensions={width:1024,height:1000,scale:1,fontScale:1};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions',()=>({__esModule:true,default:()=>mockDimensions}));
jest.mock('../../../ui/app-theme',()=>({useAppTheme:()=>({colors:{}})}));
jest.mock('../../../ui/icon-registry',()=>({GoAtletaIcon:()=>null,KeyboardIcon:()=>null}));
jest.mock('../../../components/visual-court/CourtEditorScene',()=>({CourtEditorScene:()=>null}));
jest.mock('../../../ui/ModalSheet',()=>({ModalSheet:({children}:{children:React.ReactNode})=>children}));
jest.mock('../../../ui/AnchoredDropdown',()=>({AnchoredDropdown:({children,visible}:{children:React.ReactNode;visible:boolean})=>visible?children:null}));
const students=[{id:'ana',name:'Ana Martins'},{id:'bia',name:'Bia de Lima'}] as Student[];
const base=()=>({skill:'saque' as const,students,jerseys:new Map([['ana','7'],['bia','11']]),studentId:null,athleteChosen:false,editing:null,disabled:false,wide:false,captureVersion:3,lineup:[null,null,null,null,null,null],lineupLoading:false,lineupSaving:false,lineupError:'',courtEnabled:true,onSaveLineup:jest.fn(async()=>true),onEditRoster:jest.fn(),canEditRoster:true,onCode:jest.fn(async()=>true),onCodeDirty:jest.fn(),onSkill:jest.fn(),onAthlete:jest.fn(),onResult:jest.fn()});
test('code Enter adds a validated contact without an implicit point and preserves invalid input',async()=>{
  const props=base(),screen=render(React.createElement(ScoutingBenchPad,props)),input=screen.getByLabelText('Registrar contato por código');
  fireEvent.changeText(input,'1S+');await act(async()=>fireEvent(input,'submitEditing'));
  expect(props.onCode).not.toHaveBeenCalled();expect(screen.getByDisplayValue('1S+')).toBeTruthy();expect(screen.getByText(/Camisa 1 não cadastrada/)).toBeTruthy();
  fireEvent.changeText(input,'7S+');await act(async()=>fireEvent(input,'submitEditing'));
  expect(props.onCode).toHaveBeenCalledTimes(1);expect(props.onCode).toHaveBeenCalledWith({studentId:'ana',fundamental:'saque',resultKey:'dificultou'});expect(input.props.value).toBe('');expect(props.onCodeDirty).toHaveBeenLastCalledWith(false);
});
test('an async submit locks repeated Enter and a failed command keeps the original code',async()=>{
  let complete!:(ok:boolean)=>void;const props=base();props.onCode=jest.fn(()=>new Promise<boolean>(resolve=>{complete=resolve;}));
  const screen=render(React.createElement(ScoutingBenchPad,props)),input=screen.getByLabelText('Registrar contato por código');fireEvent.changeText(input,'7S2');
  await act(async()=>{fireEvent(input,'submitEditing');fireEvent(input,'submitEditing');});expect(props.onCode).toHaveBeenCalledTimes(1);
  await act(async()=>complete(false));expect(screen.getByDisplayValue('7S2')).toBeTruthy();
});

test('an invalid code stays editable until cleared, and a selected athlete locks the code field', async () => {
  const props = { ...base(), lineup: ['ana', null, null, null, null, null] };
  const screen = render(React.createElement(ScoutingBenchPad, props));
  const input = screen.getByLabelText('Registrar contato por código');
  const athlete = screen.getByRole('button', { name: 'Zona 4, camisa 7, Ana Martins' });
  fireEvent.changeText(input, '1S+');
  await act(async () => fireEvent(input, 'submitEditing'));

  expect(screen.getByText(/Camisa 1 não cadastrada/)).toBeTruthy();
  expect(athlete).toBeDisabled();
  fireEvent.press(athlete);
  expect(props.onAthlete).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('1S+')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Limpar código do contato' }));
  expect(props.onCodeDirty).toHaveBeenLastCalledWith(false);
  expect(screen.queryByText(/Camisa 1 não cadastrada/)).toBeNull();
  fireEvent.press(athlete);
  expect(props.onAthlete).toHaveBeenLastCalledWith('ana');

  screen.rerender(React.createElement(ScoutingBenchPad, { ...props, athleteChosen: true, studentId: 'ana' }));
  expect(input.props.editable).toBe(false);
  fireEvent.changeText(input, '7S+');
  expect(input.props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Adicionar contato por código' })).toBeDisabled();
});

test('formats without a court offer one roster action and identify the selected guest', () => {
  const onGuest = jest.fn();
  const screen = render(React.createElement(ScoutingBenchPad, { ...base(), courtEnabled: false, athleteChosen: true, guestName: 'Convidado teste', onGuest }));

  expect(screen.getAllByText('Elenco')).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: 'Escolher no elenco completo, 2 atletas' }));
  expect(screen.getByLabelText('Buscar nome ou camisa')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Fechar escolher atleta' }));
  const guest = screen.getByRole('button', { name: 'Convidado' });
  expect(guest.props.accessibilityState.selected).toBe(true);
  expect(screen.getByRole('button', { name: 'Sem atleta' }).props.accessibilityState.selected).toBe(false);
  expect(screen.getByText('Convidado teste · Saque')).toBeTruthy();
  fireEvent.press(guest);
  expect(onGuest).toHaveBeenCalledTimes(1);
});

test('assigning and replacing athletes filters the available list and keeps the chosen position selected', async () => {
  const props = base(), screen = render(React.createElement(ScoutingBenchPad, props));
  expect(screen.queryByRole('button', { name: /Zona 4, camisa/ })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Definir atleta na zona 4' }));
  expect(screen.getAllByRole('button', { name: /^Z[1-6] ·/ }).map(button => button.props.accessibilityLabel)).toEqual([
    'Z4 · Vazio', 'Z3 · Vazio', 'Z2 · Vazio', 'Z5 · Vazio', 'Z6 · Vazio', 'Z1 · Vazio',
  ]);

  const availableAna = screen.getByRole('button', { name: 'Camisa 7: Ana Martins' });
  expect(within(availableAna).getByText('7 · Ana Martins')).toBeTruthy();
  expect(within(availableAna).queryByText('7')).toBeNull();
  fireEvent.press(availableAna);
  const assignedAna = screen.getByRole('button', { name: 'Z4 · 7 · Ana' });
  expect(within(assignedAna).getByText('7 · Ana')).toBeTruthy();
  expect(screen.getByLabelText('Buscar para a zona 4')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Camisa 7: Ana Martins' })).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Camisa 11: Bia de Lima' }));
  expect(within(screen.getByRole('button', { name: 'Z4 · 11 · Bia' })).getByText('11 · Bia')).toBeTruthy();
  expect(screen.getByLabelText('Buscar para a zona 4')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Camisa 7: Ana Martins' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Camisa 11: Bia de Lima' })).toBeNull();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' })));
  expect(props.onSaveLineup).toHaveBeenCalledWith(['bia', null, null, null, null, null]);
  expect(props.onAthlete).not.toHaveBeenCalled();
});

test('removing a player selects that position and returns the player to the list for reassignment', async () => {
  const props = { ...base(), lineup: ['ana', null, null, null, null, 'bia'] };
  const screen = render(React.createElement(ScoutingBenchPad, props));
  fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
  expect(screen.queryByRole('button', { name: 'Camisa 7: Ana Martins' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Camisa 11: Bia de Lima' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Z3 · Vazio' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remover Ana Martins da zona 4' }));

  expect(screen.getByLabelText('Buscar para a zona 4')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Z4 · Vazio' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Remover Ana Martins da zona 4' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Camisa 7: Ana Martins' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Camisa 11: Bia de Lima' })).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Z5 · Vazio' }));
  fireEvent.press(screen.getByRole('button', { name: 'Camisa 7: Ana Martins' }));
  expect(screen.getByRole('button', { name: 'Z5 · 7 · Ana' })).toBeTruthy();
  expect(screen.getByLabelText('Buscar para a zona 5')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Camisa 7: Ana Martins' })).toBeNull();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' })));
  expect(props.onSaveLineup).toHaveBeenCalledWith([null, null, null, 'ana', null, 'bia']);
});

test('saving prevents position changes, removals and replacements in the open lineup editor', () => {
  const props = { ...base(), lineup: ['ana', null, null, null, null, null] };
  const screen = render(React.createElement(ScoutingBenchPad, props));
  fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
  screen.rerender(React.createElement(ScoutingBenchPad, { ...props, lineupSaving: true }));

  const position = screen.getByRole('button', { name: 'Z3 · Vazio' });
  const remove = screen.getByRole('button', { name: 'Remover Ana Martins da zona 4' });
  const replacement = screen.getByRole('button', { name: 'Camisa 11: Bia de Lima' });
  for (const control of [position, remove, replacement]) {
    expect(control).toBeDisabled();
    fireEvent.press(control);
  }
  expect(screen.getByRole('button', { name: 'Z4 · 7 · Ana' })).toBeTruthy();
  expect(screen.getByLabelText('Buscar para a zona 4')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Camisa 7: Ana Martins' })).toBeNull();
  expect(props.onSaveLineup).not.toHaveBeenCalled();
});
test('configured court selects a real athlete while no-shirt players do not receive an invented number',()=>{
  const props={...base(),lineup:['ana','bia',null,null,null,null],jerseys:new Map([['ana','7']])},screen=render(React.createElement(ScoutingBenchPad,props));
  const numbered = screen.getByRole('button',{name:'Zona 4, camisa 7, Ana Martins'});
  expect(within(numbered).getByText('7')).toBeTruthy();
  expect(within(numbered).getByText('Ana')).toBeTruthy();
  fireEvent.press(numbered);expect(props.onAthlete).toHaveBeenLastCalledWith('ana');
  expect(screen.getByRole('button',{name:'Zona 3, Bia de Lima'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Zona 3, camisa 2, Bia de Lima'})).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
  expect(within(screen.getByRole('button', { name: 'Z4 · 7 · Ana' })).getByText('7 · Ana')).toBeTruthy();
  const noShirtPosition = screen.getByRole('button', { name: 'Z3 · Bia' });
  expect(within(noShirtPosition).getByText('Bia')).toBeTruthy();
  expect(within(noShirtPosition).queryByText(/^\d+ · Bia$/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Remover Bia de Lima da zona 3' }));
  const noShirtAvailable = screen.getByRole('button', { name: 'Bia de Lima' });
  expect(within(noShirtAvailable).getByText('Bia de Lima')).toBeTruthy();
  expect(within(noShirtAvailable).queryByText(/^\d+ · Bia de Lima$/)).toBeNull();
});

test('inline jerseys allow a normalized shirt swap in one save without changing the confirmed lineup or athletes', async () => {
  const onSaveJerseys = jest.fn(async (_jerseys: ReadonlyMap<string, string>) => true);
  const props = { ...base(), lineup: ['ana', null, null, null, null, null], onSaveJerseys, onLineupDirtyChange: jest.fn() };
  const originalStudents = JSON.stringify(props.students);
  const screen = render(React.createElement(ScoutingBenchPad, props));
  fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
  const ana = screen.getByLabelText('Camisa de Ana Martins');
  const bia = screen.getByLabelText('Camisa de Bia de Lima');
  expect(ana.props.value).toBe('7');
  expect(bia.props.value).toBe('11');
  expect(screen.getByRole('button', { name: 'Salvar em quadra' })).toBeDisabled();

  fireEvent.changeText(ana, '11');
  expect(screen.getByText('Há camisas repetidas no elenco.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Salvar em quadra' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' }));
  expect(onSaveJerseys).not.toHaveBeenCalled();
  fireEvent.changeText(bia, '07');
  expect(screen.queryByText('Há camisas repetidas no elenco.')).toBeNull();
  expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(true);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' })));
  expect(onSaveJerseys).toHaveBeenCalledTimes(1);
  expect(onSaveJerseys).toHaveBeenCalledWith(new Map([['ana', '11'], ['bia', '7']]));
  expect(screen.queryByText('Atletas em quadra')).toBeNull();
  expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(false);
  expect(props.onSaveLineup).not.toHaveBeenCalled();
  expect(props.onAthlete).not.toHaveBeenCalled();
  expect(props.onEditRoster).not.toHaveBeenCalled();
  expect(JSON.stringify(props.students)).toBe(originalStudents);
  expect(props.jerseys.get('ana')).toBe('7');
});

test('failed inline jersey changes survive closing and reopening for retry without assigning an available athlete', async () => {
  const onSaveJerseys = jest.fn<Promise<boolean>, [ReadonlyMap<string, string>]>().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const props = { ...base(), lineup: ['ana', null, null, null, null, null], onSaveJerseys, onLineupDirtyChange: jest.fn() };
  const screen = render(React.createElement(ScoutingBenchPad, props));
  fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
  const input = screen.getByLabelText('Camisa de Bia de Lima');
  fireEvent.changeText(input, '09');
  expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(true);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' })));
  expect(onSaveJerseys).toHaveBeenNthCalledWith(1, new Map([['bia', '9']]));
  expect(screen.getByDisplayValue('09')).toBeTruthy();
  expect(screen.getByText(/Não foi possível salvar/)).toBeTruthy();
  expect(props.onSaveLineup).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Fechar atletas em quadra' }));
  expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(true);
  fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
  expect(screen.getByDisplayValue('09')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Camisa de Bia de Lima'), '0');
  expect(screen.queryByText(/Não foi possível salvar/)).toBeNull();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' })));
  expect(onSaveJerseys).toHaveBeenNthCalledWith(2, new Map([['bia', '0']]));
  expect(screen.queryByText('Atletas em quadra')).toBeNull();
  expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(false);
  expect(props.onSaveLineup).not.toHaveBeenCalled();
  expect(props.onAthlete).not.toHaveBeenCalled();
});

test('a pending batch blocks repeated saves and changes, then discarding restores both jerseys and lineup', async () => {
  let complete!: (ok: boolean) => void;
  const onSaveJerseys = jest.fn(() => new Promise<boolean>(resolve => { complete = resolve; }));
  const props = { ...base(), onSaveJerseys, onLineupDirtyChange: jest.fn() };
  const screen = render(React.createElement(ScoutingBenchPad, props));
  fireEvent.press(screen.getByRole('button', { name: 'Definir atleta na zona 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Ana Martins' }));
  const input = screen.getByLabelText('Camisa de Ana Martins');
  fireEvent.changeText(input, '9');
  const save = screen.getByRole('button', { name: 'Salvar em quadra' });
  await act(async () => { fireEvent.press(save); fireEvent.press(save); });
  expect(onSaveJerseys).toHaveBeenCalledTimes(1);

  expect(screen.getByLabelText('Camisa de Ana Martins').props.editable).toBe(false);
  expect(screen.getByLabelText('Camisa de Bia de Lima').props.editable).toBe(false);
  for (const name of ['Z3 · Vazio', 'Remover Ana Martins da zona 4', 'Bia de Lima', 'Salvar em quadra', 'Descartar alterações']) {
    const control = screen.getByRole('button', { name });
    expect(control).toBeDisabled();
    fireEvent.press(control);
  }
  fireEvent.press(screen.getByRole('button', { name: 'Fechar atletas em quadra' }));
  expect(screen.getByText('Atletas em quadra')).toBeTruthy();
  expect(screen.getByLabelText('Buscar para a zona 4')).toBeTruthy();
  expect(props.onSaveLineup).not.toHaveBeenCalled();

  screen.rerender(React.createElement(ScoutingBenchPad, { ...props, disabled: true, jerseySaving: true }));
  fireEvent.press(screen.getByRole('button', { name: 'Fechar atletas em quadra' }));
  expect(screen.getByText('Atletas em quadra')).toBeTruthy();
  expect(screen.getByLabelText('Camisa de Ana Martins').props.editable).toBe(false);

  await act(async () => complete(false));
  screen.rerender(React.createElement(ScoutingBenchPad, props));
  expect(screen.getByDisplayValue('9')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Descartar alterações' }));
  expect(screen.getByRole('button', { name: 'Z4 · Vazio' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ana Martins' })).toBeTruthy();
  expect(screen.getByLabelText('Camisa de Ana Martins').props.value).toBe('7');
  expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('button', { name: 'Salvar em quadra' })).toBeDisabled();
  expect(props.onSaveLineup).not.toHaveBeenCalled();
});

test('after jerseys persist but lineup saving fails, retry saves only the retained lineup', async () => {
  const calls: string[] = [];
  const onSaveJerseys = jest.fn(async (_jerseys: ReadonlyMap<string, string>) => { calls.push('jerseys'); return true; });
  const onSaveLineup = jest.fn<Promise<boolean>, [(string | null)[]]>()
    .mockImplementationOnce(async () => { calls.push('lineup'); return false; })
    .mockImplementationOnce(async () => { calls.push('lineup'); return true; });
  const props = { ...base(), onSaveJerseys, onSaveLineup, onLineupDirtyChange: jest.fn() };
  const screen = render(React.createElement(ScoutingBenchPad, props));
  fireEvent.press(screen.getByRole('button', { name: 'Definir atleta na zona 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Ana Martins' }));
  fireEvent.changeText(screen.getByLabelText('Camisa de Ana Martins'), '08');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' })));
  expect(calls).toEqual(['jerseys', 'lineup']);
  expect(onSaveJerseys).toHaveBeenCalledWith(new Map([['ana', '8']]));
  expect(screen.getByText('Atletas em quadra')).toBeTruthy();
  expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(true);
  screen.rerender(React.createElement(ScoutingBenchPad, { ...props, jerseys: new Map([['ana', '8'], ['bia', '11']]) }));
  expect(screen.queryByRole('button', { name: 'Ana Martins' })).toBeNull();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' })));
  expect(calls).toEqual(['jerseys', 'lineup', 'lineup']);
  expect(onSaveJerseys).toHaveBeenCalledTimes(1);
  expect(onSaveLineup).toHaveBeenNthCalledWith(1, ['ana', null, null, null, null, null]);
  expect(onSaveLineup).toHaveBeenNthCalledWith(2, ['ana', null, null, null, null, null]);
  expect(screen.queryByText('Atletas em quadra')).toBeNull();
});

test('opening an empty zone targets that zone and keeps previous unsaved assignments', async () => {
  const props = base();
  const screen = render(React.createElement(ScoutingBenchPad, props));

  fireEvent.press(screen.getByRole('button', { name: 'Definir atleta na zona 1' }));
  expect(screen.getByLabelText('Buscar para a zona 1')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Camisa 7: Ana Martins' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fechar atletas em quadra' }));

  fireEvent.press(screen.getByRole('button', { name: 'Definir atleta na zona 5' }));
  expect(screen.getByLabelText('Buscar para a zona 5')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Camisa 11: Bia de Lima' }));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Salvar em quadra' })));
  expect(props.onSaveLineup).toHaveBeenCalledWith([null, null, null, 'bia', null, 'ana']);
});

test('closing the lineup preserves its draft and dirty guard until it is reopened and saved',async()=>{
  const props={...base(),onLineupDirtyChange:jest.fn()},screen=render(React.createElement(ScoutingBenchPad,props));
  fireEvent.press(screen.getByRole('button',{name:'Definir atleta na zona 4'}));
  fireEvent.press(screen.getByRole('button',{name:'Camisa 7: Ana Martins'}));
  expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(true);
  const roster=screen.getByRole('button',{name:'Editar elenco e camisas'});
  expect(roster.props.accessibilityState.disabled).toBe(true);fireEvent.press(roster);expect(props.onEditRoster).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Fechar atletas em quadra'}));
  expect(screen.queryByText('Atletas em quadra')).toBeNull();expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(true);
  fireEvent.press(screen.getByRole('button',{name:'Definir atleta na zona 4'}));
  expect(screen.getByRole('button',{name:'Z4 · 7 · Ana'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Camisa 7: Ana Martins'})).toBeNull();
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'Salvar em quadra'})));
  expect(props.onSaveLineup).toHaveBeenCalledWith(['ana',null,null,null,null,null]);expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(false);
});

test('an untouched hidden lineup editor follows the loaded lineup before the first edit',async()=>{
  const props=base(),screen=render(React.createElement(ScoutingBenchPad,props));
  const loaded={...props,lineup:['ana',null,null,null,null,null]};screen.rerender(React.createElement(ScoutingBenchPad,loaded));
  fireEvent.press(screen.getByRole('button',{name:'Editar'}));expect(screen.getByRole('button',{name:'Z4 · 7 · Ana'})).toBeTruthy();
  fireEvent.press(screen.getByRole('button',{name:'Camisa 11: Bia de Lima'}));
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'Salvar em quadra'})));
  expect(props.onSaveLineup).toHaveBeenCalledWith(['bia',null,null,null,null,null]);
});

test('discarding a retained lineup draft restores confirmed slots and enables roster editing without saving',()=>{
  const props={...base(),lineup:['ana',null,null,null,null,null],onLineupDirtyChange:jest.fn()},screen=render(React.createElement(ScoutingBenchPad,props));
  fireEvent.press(screen.getByRole('button',{name:'Editar'}));fireEvent.press(screen.getByRole('button',{name:'Camisa 11: Bia de Lima'}));
  expect(screen.getByRole('button',{name:'Z4 · 11 · Bia'})).toBeTruthy();expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(true);
  fireEvent.press(screen.getByRole('button',{name:'Descartar alterações'}));
  expect(screen.getByRole('button',{name:'Z4 · 7 · Ana'})).toBeTruthy();expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(false);expect(props.onSaveLineup).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Editar elenco e camisas'}));expect(props.onEditRoster).toHaveBeenCalledTimes(1);
});

test('on-court homonyms without shirts gain surname initials and keep full accessible names',()=>{
  const names=[{id:'a',name:'Ana Martins'},{id:'b',name:'Ana Ribeiro'},{id:'c',name:'Ana Souza'}] as Student[];
  const screen=render(React.createElement(ScoutingLineupCourt,{students:names,jerseys:new Map([['c','7']]),lineup:['a','b','c',null,null,null],readOnly:true}));
  expect(screen.getByText('Ana M.')).toBeTruthy();expect(screen.getByText('Ana R.')).toBeTruthy();expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.getByLabelText('Zona 4, Ana Martins')).toBeTruthy();expect(screen.getByLabelText('Zona 3, Ana Ribeiro')).toBeTruthy();
  expect(screen.getByText('Ana M.').props.numberOfLines).toBe(1);expect(screen.getByText('Ana M.').props.ellipsizeMode).toBe('tail');
});

test('mobile starts with six compact targets and expanding or collapsing the court keeps athlete and draft selection untouched',()=>{
  const previous=mockDimensions;mockDimensions={width:390,height:844,scale:1,fontScale:1};
  try{
    const props={...base(),lineup:['ana','bia',null,null,null,null],studentId:'ana',athleteChosen:true,onLineupDirtyChange:jest.fn()},screen=render(React.createElement(ScoutingBenchPad,props));
    expect(screen.getByRole('button',{name:'Expandir quadra'}).props.accessibilityState.expanded).toBe(false);
    expect(screen.getAllByRole('button',{name:'Zona 4, camisa 7, Ana Martins'})).toHaveLength(1);
    expect(screen.getByRole('button',{name:'Zona 4, camisa 7, Ana Martins'}).props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByRole('button',{name:'Expandir quadra'}));expect(screen.getByRole('button',{name:'Recolher quadra'}).props.accessibilityState.expanded).toBe(true);
    fireEvent.press(screen.getByRole('button',{name:'Recolher quadra'}));expect(screen.getByRole('button',{name:'Zona 4, camisa 7, Ana Martins'}).props.accessibilityState.selected).toBe(true);
    expect(props.onCodeDirty).not.toHaveBeenCalled();expect(props.onLineupDirtyChange).not.toHaveBeenCalled();expect(props.onSaveLineup).not.toHaveBeenCalled();expect(props.onAthlete).not.toHaveBeenCalled();screen.unmount();
  }finally{mockDimensions=previous;}
});

test('short notebook keeps a full-width court and six accessible targets',()=>{
  const previous=mockDimensions;mockDimensions={width:1024,height:768,scale:1,fontScale:1};
  try{
    const screen=render(React.createElement(ScoutingBenchPad,base())),first=screen.getByRole('button',{name:'Definir atleta na zona 4'});
    const surface=Native.StyleSheet.flatten(screen.getByTestId('scouting-lineup-court').props.style);
    const targets=Native.StyleSheet.flatten(screen.getByTestId('scouting-lineup-targets').props.style);
    expect(surface.width).toBe('100%');expect(surface.aspectRatio).toBeGreaterThan(1.5);
    expect(targets.flexWrap).toBe('wrap');
    expect(Native.StyleSheet.flatten(first.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(screen.getAllByRole('button',{name:/Definir atleta na zona/})).toHaveLength(6);screen.unmount();
  }finally{mockDimensions=previous;}
});

test.each([false, true])('preparation court is read-only and preserves the explicit lineup when collapsed=%s', collapsed => {
  const lineup = ['ana', null, 'bia', null, null, null], before = JSON.stringify(lineup);
  const onStudent = jest.fn(), onEmpty = jest.fn();
  const screen = render(React.createElement(ScoutingLineupCourt, { students, jerseys: new Map([['ana', '7']]), lineup,
    collapsed, readOnly: true, athleteChosen: true, studentId: 'ana', onStudent, onEmpty }));
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByLabelText('Zona 4, camisa 7, Ana Martins')).toBeTruthy();
  expect(screen.getByLabelText('Zona 2, Bia de Lima')).toBeTruthy();
  expect(screen.getAllByLabelText(/Zona \d, sem atleta/)).toHaveLength(4);
  expect(screen.queryByLabelText('Definir atleta na zona 3')).toBeNull();
  expect(screen.queryByLabelText('Registrar contato por código')).toBeNull();
  fireEvent.press(screen.getByLabelText('Zona 4, camisa 7, Ana Martins'));
  fireEvent.press(screen.getByLabelText('Zona 3, sem atleta'));
  expect(onStudent).not.toHaveBeenCalled(); expect(onEmpty).not.toHaveBeenCalled();
  expect(JSON.stringify(lineup)).toBe(before);
  const surface = Native.StyleSheet.flatten(screen.getByTestId('scouting-lineup-court').props.style);
  expect(surface.width).toBe('100%');
  expect(collapsed ? surface.height : surface.aspectRatio).toBe(collapsed ? 64 : 340 / 210);
});


test('matching surname initials expand names while keeping court slots fixed',()=>{
  const names=[{id:'a',name:'Ana Martins'},{id:'b',name:'Ana Mendes'}] as Student[];
  const screen=render(React.createElement(ScoutingLineupCourt,{students:names,lineup:['a','b',null,null,null,null]}));
  expect(screen.getByText('Ana Martins').props.numberOfLines).toBe(1);
  expect(screen.getByText('Ana Mendes').props.ellipsizeMode).toBe('tail');
});


test('expanded court remains operational in wide single-column tablet layouts',()=>{
  const screen=render(React.createElement(ScoutingLineupCourt,{students,lineup:['ana',null,null,null,null,null]}));
  const surface=Native.StyleSheet.flatten(screen.getByTestId('scouting-lineup-court').props.style);
  expect(surface).toMatchObject({width:'100%',maxWidth:340,alignSelf:'center',aspectRatio:340/210});
});
