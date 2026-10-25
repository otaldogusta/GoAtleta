import { StackRouter } from "expo-router";
import { Platform } from "react-native";
import { navigateBackToCalendar } from "../primary-route-navigation";

const originKey="calendar-real-leaf-key";
const href={pathname:"/prof/calendar",params:{targetDate:"2026-10-27",unit:"Stress 02"}};
const leaf=(key=originKey,name="calendar")=>({key,name,params:{initial:false,unit:"Stress 02",unknown:"preserve-me",extra:{view:"week"}}});
const parent=(key=originKey)=>({key:`prof-parent:${key}`,name:"prof",state:{index:1,routes:[{key:"home",name:"home"},leaf(key)]}});
const detail={key:"class-002",name:"class/[id]",params:{id:"class-002",calendarSource:"prof",calendarDate:"2026-10-27",calendarUnit:"Stress 02",calendarOriginKey:originKey}};
const state=(routes:ReturnType<typeof parent>[]|any[])=>({stale:false as const,type:"stack" as const,key:"app-stack",index:routes.length-1,routeNames:["prof","calendar","class/[id]","events/[id]"],preloadedRoutes:[],routes});
const originalOS=Object.getOwnPropertyDescriptor(Platform,"OS")!;
beforeEach(()=>Object.defineProperty(Platform,"OS",{configurable:true,value:"web"}));
afterEach(()=>Object.defineProperty(Platform,"OS",originalOS));

test("public SDK GO_BACK preserves the exact calendar route and unknown parameters when selected date is only local",()=>{
  const calendar=parent();const retainedLeaf=calendar.state.routes[1];let current=state([calendar,detail]);
  const sdk=StackRouter({});
  const replace=jest.fn();
  const back=jest.fn(()=>{current=sdk.getStateForAction(current,{type:"GO_BACK"},{routeNames:current.routeNames,routeParamList:{},routeGetIdList:{}})!;});
  navigateBackToCalendar({router:{back,replace},href,navigationState:current,originKey});
  expect(back).toHaveBeenCalledTimes(1);expect(replace).not.toHaveBeenCalled();
  expect(current.routes).toEqual([calendar]);expect(current.routes[0]).toBe(calendar);
  expect(current.routes[0].state.routes[1]).toBe(retainedLeaf);
  expect(calendar.state.routes[1].params).toEqual({initial:false,unit:"Stress 02",unknown:"preserve-me",extra:{view:"week"}});
  expect(calendar.state.routes[1].params).not.toHaveProperty("targetDate");
});

test("resolves generated __root and compares the focused leaf key rather than the prof branch key",()=>{
  const previous=parent();const app=state([previous,detail]);const wrapped={index:0,routes:[{key:"generated-wrapper",name:"__root",state:app}]};
  const router={back:jest.fn(),replace:jest.fn()};
  navigateBackToCalendar({router,href,navigationState:wrapped,originKey});expect(router.back).toHaveBeenCalledTimes(1);
  navigateBackToCalendar({router,href,navigationState:wrapped,originKey:previous.key});expect(router.replace).toHaveBeenCalledTimes(1);
});

test("shared calendar origin uses its direct key without a workspace branch",()=>{
  const router={back:jest.fn(),replace:jest.fn()};
  navigateBackToCalendar({router,href:{...href,pathname:"/calendar"},navigationState:state([leaf(),detail]),originKey});
  expect(router.back).toHaveBeenCalledTimes(1);expect(router.replace).not.toHaveBeenCalled();
});

test.each([
  [state([parent("different-calendar-key"),detail]),originKey],
  [state([parent(),parent("other-immediate-calendar"),detail]),originKey],
  [state([{key:originKey,name:"events/[id]"},detail]),originKey],
  [state([detail]),originKey],
  [state([parent(),detail]),"stale-key"],
  [state([parent(),detail]),[originKey]],
])("wrong, non-immediate, ambiguous or invalid origins retain explicit destination fallback (%#)",(navigationState,key)=>{
  const router={back:jest.fn(),replace:jest.fn()};navigateBackToCalendar({router,href,navigationState,originKey:key});
  expect(router.back).not.toHaveBeenCalled();expect(router.replace).toHaveBeenCalledWith(href,{withAnchor:true});
});

test.each(["android","ios"])("%s keeps its explicit class-to-calendar replacement",platform=>{
  Object.defineProperty(Platform,"OS",{configurable:true,value:platform});const router={back:jest.fn(),replace:jest.fn()};
  navigateBackToCalendar({router,href,navigationState:state([parent(),detail]),originKey});
  expect(router.back).not.toHaveBeenCalled();expect(router.replace).toHaveBeenCalledWith(href,{withAnchor:true});
});

test("older links retain strict full-context matching, and deep links retain replacement",()=>{
  const router={back:jest.fn(),replace:jest.fn()};const matching=parent();matching.state.routes[1].params=href.params as never;
  navigateBackToCalendar({router,href,navigationState:state([matching,detail])});expect(router.back).toHaveBeenCalledTimes(1);
  navigateBackToCalendar({router,href,navigationState:state([parent(),detail])});expect(router.replace).toHaveBeenCalledTimes(1);
});
