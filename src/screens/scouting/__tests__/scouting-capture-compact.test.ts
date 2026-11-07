import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import type { ScoutingActionFundamental, Student } from "../../../core/models";
import { ContactPad } from "../ScoutingCaptureUI";
import { collectorAthleteColumns, shortScoutingAthleteName } from "../ScoutingCollectionParts";

jest.mock("../../../ui/app-theme",()=>({useAppTheme:()=>({colors:{}})}));
jest.mock("../../../ui/icon-registry",()=>({GoAtletaIcon:()=>null}));
jest.mock("../../../ui/ModalSheet",()=>({ModalSheet:({children}:{children:React.ReactNode})=>children}));
jest.mock("../../../ui/AnchoredDropdown",()=>({AnchoredDropdown:({children,visible}:{children:React.ReactNode;visible:boolean})=>visible?children:null}));

const students=Array.from({length:9},(_,index)=>({id:`athlete-${index}`,name:index===7?"Patrícia Gabriela de Albuquerque":`Atleta Nome Sobrenome${index}`})) as Student[];
const jerseys=new Map([[students[7].id,"77"],[students[0].id,"0"]]);
const onResult=jest.fn();
function Harness({disabled=false}:{disabled?:boolean}){
  const [skill,setSkill]=useState<ScoutingActionFundamental>("recepcao"),[athlete,setAthlete]=useState<string|null>(null),[chosen,setChosen]=useState(false);
  return React.createElement(ContactPad,{compact:true,skill,students,jerseys,studentId:athlete,athleteChosen:chosen,editing:null,disabled,wide:false,captureVersion:3,onSkill:setSkill,onAthlete:id=>{setAthlete(id);setChosen(true);},onResult});
}
beforeEach(()=>jest.clearAllMocks());

test("compact athletes have uniform44 targets, first and last names and only actual jersey numbers",()=>{
  const screen=render(React.createElement(Harness));
  expect(shortScoutingAthleteName(" Maria  Júlia de Albuquerque ")).toBe("Maria Albuquerque");
  expect(screen.getByText("Atleta Sobrenome0")).toBeTruthy();
  const card=screen.getByRole("button",{name:"Camisa 0: Atleta Nome Sobrenome0"});
  expect(StyleSheet.flatten(card.props.style).height).toBe(44);
  expect(screen.getByRole("button",{name:students[1].name})).toBeTruthy();
  expect(screen.queryByRole("button",{name:`Camisa 1: ${students[1].name}`})).toBeNull();
  expect(screen.queryByRole("button",{name:"Camisa 77: Patrícia Gabriela de Albuquerque"})).toBeNull();
  expect(screen.getByRole("button",{name:"Boa"})).toBeDisabled();
});

test("the bounded roster searches real jersey or accent-insensitive name and keeps a selected reserve visible",()=>{
  const screen=render(React.createElement(Harness));
  fireEvent.press(screen.getByRole("button",{name:"Escolher no elenco completo, 9 atletas"}));
  const search=screen.getByLabelText("Buscar nome ou camisa");
  fireEvent.changeText(search,"patricia");expect(screen.getByText("Patrícia Gabriela de Albuquerque")).toBeTruthy();
  fireEvent.changeText(search,"77");
  expect(screen.queryByText(students[8].name)).toBeNull();
  fireEvent.press(screen.getByRole("button",{name:"Camisa 77: Patrícia Gabriela de Albuquerque"}));
  expect(screen.queryByLabelText("Buscar nome ou camisa")).toBeNull();
  expect(screen.getByRole("button",{name:"Camisa 77: Patrícia Gabriela de Albuquerque"}).props.accessibilityState.selected).toBe(true);
  expect(screen.getByText("Patrícia Albuquerque")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Boa"})).toBeEnabled();
  fireEvent.press(screen.getByRole("button",{name:"Boa"}));expect(onResult).toHaveBeenCalledWith("b_medio");
});

test("plus exposes only canonical extras and uses their existing rubric after explicit athlete selection",()=>{
  const screen=render(React.createElement(Harness));
  fireEvent.press(screen.getByRole("button",{name:"Mais fundamentos"}));
  expect(screen.getByRole("button",{name:"Cobertura"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Transição"})).toBeTruthy();
  fireEvent.press(screen.getByRole("button",{name:"Comunicação"}));
  expect(screen.getByText("Fundamento · Comunicação")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Clara"})).toBeDisabled();
  fireEvent.press(screen.getByRole("button",{name:"Sem atleta"}));fireEvent.press(screen.getByRole("button",{name:"Clara"}));
  expect(onResult).toHaveBeenCalledWith("clara");expect(screen.queryByText("Rolamento")).toBeNull();expect(screen.queryByText(/voz/i)).toBeNull();
});

test('the compact header keeps Sem atleta as an explicit44px choice that enables its existing result',()=>{
  const screen=render(React.createElement(Harness));const unassigned=screen.getByRole('button',{name:'Sem atleta'});
  expect(StyleSheet.flatten(unassigned.props.style).minHeight).toBe(44);expect(unassigned.props.accessibilityState.selected).toBe(false);expect(screen.getByRole('button',{name:'Boa'})).toBeDisabled();
  fireEvent.press(unassigned);expect(screen.getByRole('button',{name:'Sem atleta'}).props.accessibilityState.selected).toBe(true);expect(screen.getByRole('button',{name:'Boa'})).toBeEnabled();
  fireEvent.press(screen.getByRole('button',{name:'Boa'}));expect(onResult).toHaveBeenCalledWith('b_medio');
});

test("disabling a retained collector hides its picker and does not discard the selected athlete",()=>{
  const screen=render(React.createElement(Harness));fireEvent.press(screen.getByRole("button",{name:students[1].name}));
  fireEvent.press(screen.getByRole("button",{name:"Escolher no elenco completo, 9 atletas"}));
  screen.rerender(React.createElement(Harness,{disabled:true}));expect(screen.queryByLabelText("Buscar nome ou camisa")).toBeNull();
  screen.rerender(React.createElement(Harness));expect(screen.getByRole("button",{name:students[1].name}).props.accessibilityState.selected).toBe(true);
});

test.each([[550,3],[759,3],[760,6],[858,6]])('the shortcuts use available collector width %d for %d columns', (width,columns)=>{
  expect(collectorAthleteColumns(width)).toBe(columns);
});
