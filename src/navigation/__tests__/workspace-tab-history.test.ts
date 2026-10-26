import React from "react";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";
import ProfessorTabsLayout from "../../../app/prof/_layout";
import CoordinationTabsLayout from "../../../app/coord/_layout";
import StudentTabsLayout from "../../../app/student/_layout";
import FamilyTabsLayout from "../../../app/family/_layout";

const mockTabs=jest.fn();
jest.mock("expo-router",()=>({Tabs:Object.assign((props:object)=>{mockTabs(props);return null;},{Screen:()=>null})}));
jest.mock("../../ui/AppShell",()=>({AppShell:({children}:{children:React.ReactNode})=>children}));
jest.mock("../../components/navigation/AnimatedBottomTabs",()=>({AnimatedBottomTabs:()=>null}));
const originalOS=Object.getOwnPropertyDescriptor(Platform,"OS")!;
afterEach(()=>{Object.defineProperty(Platform,"OS",originalOS);jest.clearAllMocks();});
const layouts=[ProfessorTabsLayout,CoordinationTabsLayout,StudentTabsLayout,FamilyTabsLayout];
test.each(layouts)("%p keeps complete browser history only on web",Layout=>{
  Object.defineProperty(Platform,"OS",{configurable:true,value:"web"});render(React.createElement(Layout));
  expect(mockTabs.mock.calls.at(-1)![0].backBehavior).toBe("fullHistory");
});
test.each(layouts)("%p retains the SDK default on Android and iOS",Layout=>{
  for(const platform of["android","ios"]){
    Object.defineProperty(Platform,"OS",{configurable:true,value:platform});const view=render(React.createElement(Layout));
    expect(mockTabs.mock.calls.at(-1)![0].backBehavior).toBeUndefined();view.unmount();
  }
});
