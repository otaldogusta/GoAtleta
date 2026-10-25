import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import ReportsScreen from "../../../../app/reports/trainer";
import { exportTrainerAttendance } from "../application/export-trainer-attendance";

let mockOrg={id:"org-a"};
let mockClasses=[{id:"class-a",name:"Turma Alfa",unit:"Centro"}];
const mockReportRead=jest.fn();
jest.mock("expo-router",()=>({useRouter:()=>({back:jest.fn(),replace:jest.fn()})}));
jest.mock("../../../providers/organization-context",()=>({useOrganization:()=>({activeOrganization:mockOrg})}));
jest.mock("../../../observability/perf",()=>({markRender:()=>undefined,measureAsync:(_name:string,load:()=>Promise<unknown>)=>load()}));
jest.mock("../application/export-trainer-attendance",()=>({exportTrainerAttendance:jest.fn()}));
jest.mock("../hooks/useTrainerReportsData",()=>({useTrainerReportsData:(params:{classId:string;reportTab:string;organizationId:string})=>{mockReportRead(params);return {
  classes:mockClasses,students:[{id:`student-${params.classId}`,name:mockClasses.length>1?`Atleta ${params.classId}`:"Ana"}],
  attendanceDays:[{classId:"class-a",date:"2026-10-24",total:55000,present:48125}],loading:false,sessionLogs:[],studentScoutingLogs:[],loadError:null,
};}}));
jest.mock("../../../ui/app-theme",()=>({useAppTheme:()=>({colors:{}})}));
jest.mock("../../../ui/use-responsive-layout",()=>({useResponsiveLayout:()=>({isMobile:false})}));
jest.mock("../../../ui/use-modal-card-style",()=>({useModalCardStyle:()=>({})}));
jest.mock("../../../ui/Pressable",()=>({Pressable:jest.requireActual("react-native").Pressable}));
jest.mock("../../../ui/icon-registry",()=>({GoAtletaIcon:()=>null}));
jest.mock("../../../ui/ClassGenderBadge",()=>({ClassGenderBadge:()=>null}));
jest.mock("../../../ui/ModalSheet",()=>({ModalSheet:()=>null}));
jest.mock("../../../ui/AnimatedSegmentedTabs",()=>({AnimatedSegmentedTabs:({tabs,onChange}:{tabs:{id:string;label:string}[];onChange:(id:string)=>void})=>{
  const runtime=jest.requireActual("react");const rn=jest.requireActual("react-native");
  return runtime.createElement(rn.View,null,...tabs.map(tab=>runtime.createElement(rn.Pressable,{key:tab.id,onPress:()=>onChange(tab.id)},runtime.createElement(rn.Text,null,tab.label))));
}}));
jest.mock("../../../components/ui/ScreenPageHeader",()=>({ScreenPageHeader:({children}:{children:React.ReactNode})=>children}));
jest.mock("react-native-safe-area-context",()=>({SafeAreaView:jest.requireActual("react-native").View}));
beforeEach(()=>{jest.clearAllMocks();mockOrg={id:"org-a"};mockClasses=[{id:"class-a",name:"Turma Alfa",unit:"Centro"}];jest.spyOn(Alert,"alert").mockImplementation(()=>undefined);});
afterEach(()=>jest.restoreAllMocks());
const flush=()=>act(async()=>{for(let index=0;index<10;index++)await Promise.resolve();});
test("only the click loads detail, prevents repeated export, and preserves the captured names/month",async()=>{
  let release!:(value:Awaited<ReturnType<typeof exportTrainerAttendance>>)=>void;
  jest.mocked(exportTrainerAttendance).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const view=render(React.createElement(ReportsScreen));await flush();
  expect(view.getByText("48125")).toBeTruthy();expect(exportTrainerAttendance).not.toHaveBeenCalled();
  fireEvent.press(view.getByText("Exportar XLSX"));fireEvent.press(view.getByText("Exportando..."));
  expect(exportTrainerAttendance).toHaveBeenCalledTimes(1);
  const request=jest.mocked(exportTrainerAttendance).mock.calls[0][0];
  expect(request).toMatchObject({organizationId:"org-a",classNames:{"class-a":"Turma Alfa"}});
  expect(request).not.toHaveProperty("studentNames");
  expect(request.isCurrent()).toBe(true);
  fireEvent.press(view.getByText("›"));await flush();expect(request.isCurrent()).toBe(false);
  await act(async()=>release({fileName:"report.xlsx",uri:"blob:report"}));expect(view.getByText("Exportar XLSX")).toBeTruthy();
});
test("organization roundtrip and unmount invalidate a pending export",async()=>{
  jest.mocked(exportTrainerAttendance).mockImplementationOnce(()=>new Promise(()=>{}));
  const view=render(React.createElement(ReportsScreen));await flush();fireEvent.press(view.getByText("Exportar XLSX"));
  const request=jest.mocked(exportTrainerAttendance).mock.calls[0][0];
  mockOrg={id:"org-b"};view.rerender(React.createElement(ReportsScreen));mockOrg={id:"org-a"};view.rerender(React.createElement(ReportsScreen));
  expect(request.isCurrent()).toBe(false);view.unmount();expect(request.isCurrent()).toBe(false);
});
test("a lazy read failure is visible and releases the export button",async()=>{
  jest.mocked(exportTrainerAttendance).mockRejectedValueOnce(new Error("Falha controlada"));
  const view=render(React.createElement(ReportsScreen));await flush();fireEvent.press(view.getByText("Exportar XLSX"));await flush();
  expect(Alert.alert).toHaveBeenCalledWith("Relatórios","Falha controlada");expect(view.getByText("Exportar XLSX")).toBeTruthy();
});
test("unit selection atomically moves highlights to the first class of the new unit and preserves same-unit class selection",async()=>{
  mockClasses=[{id:"class-001",name:"Turma 001",unit:"Stress 01"},{id:"class-002",name:"Turma 002",unit:"Stress 02"},{id:"class-003",name:"Turma 003",unit:"Stress 02"}];
  const view=render(React.createElement(ReportsScreen));await flush();
  fireEvent.press(view.getByText("Destaques"));await flush();
  expect(view.getAllByText("Atleta class-001").length).toBeGreaterThan(0);
  fireEvent.press(view.getByText("Stress 01"));fireEvent.press(view.getByText("Stress 02"));
  expect(mockReportRead.mock.calls.at(-1)![0]).toMatchObject({classId:"class-002",reportTab:"students",organizationId:"org-a"});
  expect(view.queryAllByText("Atleta class-001")).toHaveLength(0);
  expect(view.getAllByText("Atleta class-002").length).toBeGreaterThan(0);
  expect(view.queryByText("Selecione a turma")).toBeNull();
  fireEvent.press(view.getByText("Turma 002"));fireEvent.press(view.getByText("Turma 003"));
  expect(mockReportRead.mock.calls.at(-1)![0].classId).toBe("class-003");
  fireEvent.press(view.getByText("Stress 02"));fireEvent.press(view.getAllByText("Stress 02").at(-1)!);
  expect(mockReportRead.mock.calls.at(-1)![0].classId).toBe("class-003");
  await flush();
});
