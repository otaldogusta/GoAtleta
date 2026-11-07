import React from "react";
import * as Native from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
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
test('court does not invent a lineup, empty slots configure explicit selections and duplicate selection moves the athlete',async()=>{
  const props=base(),screen=render(React.createElement(ScoutingBenchPad,props));
  expect(screen.queryByRole('button',{name:/Zona 4, camisa/})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Definir atleta na zona 4'}));
  fireEvent.press(screen.getByRole('button',{name:'Camisa 7: Ana Martins'}));
  fireEvent.press(screen.getByRole('button',{name:'Camisa 7: Ana Martins'}));
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'Salvar em quadra'})));
  expect(props.onSaveLineup).toHaveBeenCalledWith([null,'ana',null,null,null,null]);expect(props.onAthlete).not.toHaveBeenCalled();
});
test('configured court selects a real athlete while no-shirt players do not receive an invented number',()=>{
  const props={...base(),lineup:['ana','bia',null,null,null,null],jerseys:new Map([['ana','7']])},screen=render(React.createElement(ScoutingBenchPad,props));
  fireEvent.press(screen.getByRole('button',{name:'Zona 4, camisa 7, Ana Martins'}));expect(props.onAthlete).toHaveBeenLastCalledWith('ana');
  expect(screen.getByRole('button',{name:'Zona 3, Bia de Lima'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Zona 3, camisa 2, Bia de Lima'})).toBeNull();
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
  expect(screen.getByText('Z4 · Ana')).toBeTruthy();
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'Salvar em quadra'})));
  expect(props.onSaveLineup).toHaveBeenCalledWith(['ana',null,null,null,null,null]);expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(false);
});

test('an untouched hidden lineup editor follows the loaded lineup before the first edit',async()=>{
  const props=base(),screen=render(React.createElement(ScoutingBenchPad,props));
  const loaded={...props,lineup:['ana',null,null,null,null,null]};screen.rerender(React.createElement(ScoutingBenchPad,loaded));
  fireEvent.press(screen.getByRole('button',{name:'Editar'}));expect(screen.getByText('Z4 · Ana')).toBeTruthy();
  fireEvent.press(screen.getByRole('button',{name:'Camisa 11: Bia de Lima'}));
  await act(async()=>fireEvent.press(screen.getByRole('button',{name:'Salvar em quadra'})));
  expect(props.onSaveLineup).toHaveBeenCalledWith(['bia',null,null,null,null,null]);
});

test('discarding a retained lineup draft restores confirmed slots and enables roster editing without saving',()=>{
  const props={...base(),lineup:['ana',null,null,null,null,null],onLineupDirtyChange:jest.fn()},screen=render(React.createElement(ScoutingBenchPad,props));
  fireEvent.press(screen.getByRole('button',{name:'Editar'}));fireEvent.press(screen.getByRole('button',{name:'Camisa 11: Bia de Lima'}));
  expect(screen.getByText('Z4 · Bia')).toBeTruthy();expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(true);
  fireEvent.press(screen.getByRole('button',{name:'Descartar alterações'}));
  expect(screen.getByText('Z4 · Ana')).toBeTruthy();expect(props.onLineupDirtyChange).toHaveBeenLastCalledWith(false);expect(props.onSaveLineup).not.toHaveBeenCalled();
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
