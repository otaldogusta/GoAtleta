import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { Student } from "../../../core/models";
import { emptyScoutingLineup, parseScoutingCode, validScoutingLineup, visibleScoutingLineup } from "../scouting-bench";
import { useScoutingLineup } from "../use-scouting-lineup";

const students=[{id:"ana",name:"Ana"},{id:"bia",name:"Bia"}] as Student[];
const jerseys=new Map([["ana","07"],["bia","11"]]);
beforeEach(async()=>{await AsyncStorage.clear();jest.restoreAllMocks();jest.clearAllMocks();});
test('codes use real jersey identity and the current result rubric, never a point command',()=>{
  expect(parseScoutingCode(' 7S+ ',students,jerseys,3)).toEqual({contact:{studentId:'ana',fundamental:'saque',resultKey:'dificultou'}});
  expect(parseScoutingCode('11R2',students,jerseys,3)).toEqual({contact:{studentId:'bia',fundamental:'recepcao',resultKey:'b_medio'}});
  expect(parseScoutingCode('7S#',students,jerseys,3)).toEqual({contact:{studentId:'ana',fundamental:'saque',resultKey:'ace'}});
  expect(parseScoutingCode('H',students,jerseys,3)).toHaveProperty('error');
  expect(parseScoutingCode('7A+',students,jerseys,3)).toHaveProperty('error');
  expect(parseScoutingCode('7Abloqueio_continua',students,jerseys,3)).toEqual({contact:{studentId:'ana',fundamental:'ataque',resultKey:'bloqueio_continua'}});
  expect(parseScoutingCode('7Abloqueio_continua',students,jerseys,2)).toHaveProperty('error');
  expect(parseScoutingCode('7A Bloq. ponto',students,jerseys,3)).toEqual({contact:{studentId:'ana',fundamental:'ataque',resultKey:'bloqueio_ponto'}});
  expect(parseScoutingCode('7A Bola de graça',students,jerseys,3)).toEqual({contact:{studentId:'ana',fundamental:'ataque',resultKey:'freeball_devolvida'}});
});
test('missing, ambiguous and unregistered shirt numbers do not resolve to roster indexes',()=>{
  expect(parseScoutingCode('1S+',students,jerseys,3).error).toMatch(/não cadastrada/);
  expect(parseScoutingCode('7S+',students,new Map([['ana','7'],['bia','07']]),3).error).toMatch(/repetida/);
  expect(parseScoutingCode('0S+',students,new Map([['ana','0']]),3).contact?.studentId).toBe('ana');
  expect(parseScoutingCode('7S+',students,new Map(),3)).toHaveProperty('error');
});
test('a lineup has exactly six explicit unique selections and hides athletes removed from the roster',()=>{
  expect(validScoutingLineup(['ana',null,null,null,null,'ana'])).toBe(false);
  expect(validScoutingLineup(['ana'])).toBe(false);
  expect(validScoutingLineup(['ana',null,null,null,null,'bia'])).toBe(true);
  expect(visibleScoutingLineup(['ana','other',null,null,null,'bia'],students)).toEqual(['ana',null,null,null,null,'bia']);
  expect(emptyScoutingLineup()).toEqual([null,null,null,null,null,null]);
});
test('explicit lineup is restored only inside the same user, org, class and session scope',async()=>{
  const hook=renderHook(()=>useScoutingLineup('user','org','class','game',students,true));
  await waitFor(()=>expect(hook.result.current.loading).toBe(false));
  await act(async()=>{expect(await hook.result.current.save(['ana',null,'bia',null,null,null])).toBe(true);});hook.unmount();
  const restored=renderHook(()=>useScoutingLineup('user','org','class','game',students,true));
  await waitFor(()=>expect(restored.result.current.lineup).toEqual(['ana',null,'bia',null,null,null]));restored.unmount();
  for(const scope of [['other','org','class','game'],['user','other','class','game'],['user','org','other','game'],['user','org','class','other']]){
    const isolated=renderHook(()=>useScoutingLineup(scope[0],scope[1],scope[2],scope[3],students,true));
    await waitFor(()=>expect(isolated.result.current.loading).toBe(false));expect(isolated.result.current.lineup).toEqual(emptyScoutingLineup());isolated.unmount();
  }
});
test('lineup rejects athletes outside the current roster and late reads cannot leak across a scope change',async()=>{
  const hook=renderHook(({game})=>useScoutingLineup('user','org','class',game,students,true),{initialProps:{game:'first'}});
  await waitFor(()=>expect(hook.result.current.loading).toBe(false));
  await act(async()=>{expect(await hook.result.current.save(['stranger',null,null,null,null,null])).toBe(false);});
  let finishSecond!:(raw:string|null)=>void,finishFirst!:(raw:string|null)=>void;
  jest.spyOn(AsyncStorage,'getItem').mockImplementationOnce(()=>new Promise(resolve=>{finishSecond=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{finishFirst=resolve;}));
  hook.rerender({game:'second'});expect(hook.result.current.lineup).toEqual(emptyScoutingLineup());hook.rerender({game:'first'});
  await act(async()=>finishSecond(JSON.stringify(['bia',null,null,null,null,null])));expect(hook.result.current.lineup).toEqual(emptyScoutingLineup());
  await act(async()=>finishFirst(JSON.stringify(['ana',null,null,null,null,null])));expect(hook.result.current.lineup).toEqual(['ana',null,null,null,null,null]);hook.unmount();
});
test('a disabled bench never reads or persists a lineup',async()=>{
  const get=jest.spyOn(AsyncStorage,'getItem'),set=jest.spyOn(AsyncStorage,'setItem');
  const hook=renderHook(()=>useScoutingLineup('user','org','class','game',students,false));
  await act(async()=>{expect(await hook.result.current.save(['ana',null,null,null,null,null])).toBe(false);});
  expect(get).not.toHaveBeenCalled();expect(set).not.toHaveBeenCalled();hook.unmount();
});
