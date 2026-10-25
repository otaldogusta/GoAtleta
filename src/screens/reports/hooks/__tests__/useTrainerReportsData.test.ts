import { act, renderHook } from "@testing-library/react-native";
import { useTrainerReportsData } from "../useTrainerReportsData";
import { getMonthlyAttendanceSummary } from "../../../../db/attendance-summary";
import { getAttendanceAll, getClasses, getStudents, getSessionLogsByRange, getStudentScoutingByRange } from "../../../../db/seed";
import { getAttendanceExportStudents } from "../../../../db/students";
jest.mock("../../../../db/seed",()=>({getAttendanceAll:jest.fn(),getClasses:jest.fn(),getStudents:jest.fn(),getSessionLogsByRange:jest.fn(),getStudentScoutingByRange:jest.fn()}));
jest.mock("../../../../db/attendance-summary",()=>({getMonthlyAttendanceSummary:jest.fn()}));
jest.mock("../../../../db/students",()=>({getAttendanceExportStudents:jest.fn()}));
jest.mock("../../../../observability/perf",()=>({measureAsync:(_name:string,load:()=>Promise<unknown>)=>load()}));
const params=(monthKey="2026-10",organizationId:string|null="org-a")=>({
  organizationId,monthKey,month:new Date(`${monthKey}-01T12:00:00Z`),classId:"",reportTab:"month" as "month"|"reports"|"students",
  rangeBounds:{start:new Date("2026-10-01T12:00:00Z"),end:new Date("2026-11-01T12:00:00Z")},
});
const day={classId:"class-a",date:"2026-10-24",total:50,present:41};
beforeEach(()=>{
  jest.clearAllMocks();jest.mocked(getClasses).mockResolvedValue([]);jest.mocked(getStudents).mockResolvedValue([]);
  jest.mocked(getMonthlyAttendanceSummary).mockResolvedValue([day]);
  jest.mocked(getSessionLogsByRange).mockResolvedValue([]);
  jest.mocked(getStudentScoutingByRange).mockResolvedValue([]);
  jest.mocked(getAttendanceExportStudents).mockResolvedValue([{id:"student-a",name:"Ana",membershipStatus:"inactive"}]);
});
const flush=()=>act(async()=>{for(let index=0;index<15;index++)await Promise.resolve();});
test("initial monthly display loads only one summary and never the detailed attendance reader",async()=>{
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:params()});await flush();
  expect(hook.result.current.attendanceDays).toEqual([day]);expect(hook.result.current.loading).toBe(false);
  expect(getMonthlyAttendanceSummary).toHaveBeenCalledWith({organizationId:"org-a",monthKey:"2026-10"});expect(getAttendanceAll).not.toHaveBeenCalled();
  expect(getStudents).not.toHaveBeenCalled();expect(getAttendanceExportStudents).not.toHaveBeenCalled();
});
test("month change removes stale counts immediately and ignores late old-month completion",async()=>{
  let release!:(value:typeof day[])=>void;
  jest.mocked(getMonthlyAttendanceSummary).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:params()});await flush();
  hook.rerender(params("2026-11"));await flush();
  await act(async()=>release([{...day,total:999}]));
  expect(hook.result.current.attendanceDays).toEqual([day]);expect(getAttendanceAll).not.toHaveBeenCalled();
});
test("org change hides stale labels and counts while replacement reads are pending",async()=>{
  jest.mocked(getClasses).mockResolvedValueOnce([{id:"class-a",name:"Organization A"}] as never);
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:params()});await flush();
  jest.mocked(getClasses).mockImplementationOnce(()=>new Promise(()=>{}));
  jest.mocked(getMonthlyAttendanceSummary).mockImplementationOnce(()=>new Promise(()=>{}));
  hook.rerender(params("2026-10","org-b"));
  expect(hook.result.current.classes).toEqual([]);expect(hook.result.current.students).toEqual([]);
  expect(hook.result.current.attendanceDays).toEqual([]);expect(hook.result.current.loading).toBe(true);
  await flush();
});
test("RPC failure is explicit and does not silently fetch 55k detailed rows",async()=>{
  jest.mocked(getMonthlyAttendanceSummary).mockRejectedValueOnce(new Error("PGRST202"));
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:params()});await flush();
  expect(hook.result.current.loadError).toBe("PGRST202");expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.attendanceDays).toEqual([]);expect(getAttendanceAll).not.toHaveBeenCalled();
});
test("a fast new-month summary never displays the previous month's PSE or reports",async()=>{
  jest.mocked(getSessionLogsByRange).mockResolvedValueOnce([{id:"october-report",PSE:8}] as never);
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:params()});await flush();
  expect(hook.result.current.sessionLogs).toHaveLength(1);
  jest.mocked(getSessionLogsByRange).mockImplementationOnce(()=>new Promise(()=>{}));
  hook.rerender(params("2026-11"));await flush();
  expect(hook.result.current.loading).toBe(false);expect(hook.result.current.attendanceDays).toEqual([day]);
  expect(hook.result.current.sessionLogs).toEqual([]);
});
test("highlights load only the selected primary class through the minimal name-ordered reader",async()=>{
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:params()});await flush();
  hook.rerender({...params(),reportTab:"reports"});await flush();expect(getAttendanceExportStudents).not.toHaveBeenCalled();
  hook.rerender({...params(),reportTab:"students",classId:"class-a"});await flush();
  expect(getAttendanceExportStudents).toHaveBeenCalledWith({organizationId:"org-a",classId:"class-a",orderByName:true});
  expect(hook.result.current.students).toEqual([{id:"student-a",name:"Ana",membershipStatus:"inactive"}]);
  expect(getStudents).not.toHaveBeenCalled();
});
test("a late old-class response cannot replace the new class or leak into another organization",async()=>{
  let release!:(value:Awaited<ReturnType<typeof getAttendanceExportStudents>>)=>void;
  jest.mocked(getAttendanceExportStudents).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:{...params(),reportTab:"students" as const,classId:"class-a"}});await flush();
  hook.rerender({...params(),reportTab:"students",classId:"class-b"});await flush();
  await act(async()=>release([{id:"old-student",name:"Old class",membershipStatus:"active"}]));
  expect(hook.result.current.students[0].id).toBe("student-a");
  jest.mocked(getAttendanceExportStudents).mockImplementationOnce(()=>new Promise(()=>{}));
  hook.rerender({...params("2026-10","org-b"),reportTab:"students",classId:"class-b"});await flush();
  expect(hook.result.current.students).toEqual([]);expect(hook.result.current.loading).toBe(true);
});
test("minimal athlete read errors stay visible without a full-directory fallback",async()=>{
  jest.mocked(getAttendanceExportStudents).mockRejectedValueOnce(new Error("Forbidden names"));
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:{...params(),reportTab:"students" as const,classId:"class-a"}});await flush();
  expect(hook.result.current.loadError).toBe("Forbidden names");expect(hook.result.current.students).toEqual([]);
  expect(hook.result.current.loading).toBe(false);expect(getStudents).not.toHaveBeenCalled();
});
test("fresh highlight names never combine with scouting from a different organization or interval",async()=>{
  jest.mocked(getStudentScoutingByRange).mockResolvedValueOnce([{id:"old-scouting",studentId:"student-a"}] as never);
  const first={...params(),reportTab:"students" as const,classId:"class-a"};
  const hook=renderHook(input=>useTrainerReportsData(input),{initialProps:first});await flush();
  expect(hook.result.current.studentScoutingLogs).toHaveLength(1);
  jest.mocked(getStudentScoutingByRange).mockImplementationOnce(()=>new Promise(()=>{}));
  hook.rerender({...first,organizationId:"org-b"});await flush();
  expect(hook.result.current.students).toHaveLength(1);expect(hook.result.current.studentScoutingLogs).toEqual([]);
  expect(getStudentScoutingByRange).toHaveBeenCalledTimes(2);
});
