import { exportTrainerAttendance } from "../export-trainer-attendance";
import { getAttendanceAll, getAttendanceExportStudents } from "../../../../db/students";
import { exportWorkbookXlsx } from "../../../../utils/export-xlsx";
import { REPORT_ATTENDANCE_EXPORT_HEADERS_PTBR } from "../../../../utils/export-schemas";
import type { AttendanceRecord } from "../../../../core/models";

let mockIdentity = { userId: "teacher-a", generation: 1 };
let mockOrg: string | null = "org-a";
let mockGeneration=1;
jest.mock("../../../../auth/session",()=>({
  getSessionIdentity:()=>({...mockIdentity}),
  assertSessionIdentity:(value:typeof mockIdentity)=>{if(value.userId!==mockIdentity.userId||value.generation!==mockIdentity.generation)throw new Error("Session changed");},
  SessionIdentityChangedError:class extends Error{},
}));
jest.mock("../../../../db/client",()=>({getActiveOrganizationId:async()=>mockOrg,getReadCacheGeneration:()=>mockGeneration}));
jest.mock("../../../../db/students",()=>({getAttendanceAll:jest.fn(),getAttendanceExportStudents:jest.fn()}));
jest.mock("../../../../utils/export-xlsx",()=>({exportWorkbookXlsx:jest.fn()}));
// Export keeps the real month filter, without importing the selectors' unrelated intelligence dependencies.
jest.mock("../trainer-report-selectors",()=>({buildMonthAttendance:jest.requireActual("../trainer-report-selectors").buildMonthAttendance}));
const input=()=>({organizationId:"org-a",monthKey:"2026-10",classNames:{"class-a":"Turma Alfa"},isCurrent:()=>true});
const record=(index:number):AttendanceRecord=>({id:`a-${index}`,classId:"class-a",studentId:"student-a",date:index%2?"2026-10-31":"2026-10-01",status:index%8?"presente":"faltou",note:`Observação ${index}`,painScore:3,createdAt:"2026-10-24T12:00:00Z"});
beforeEach(()=>{
  jest.clearAllMocks();mockIdentity={userId:"teacher-a",generation:1};mockOrg="org-a";mockGeneration=1;
  jest.mocked(getAttendanceAll).mockResolvedValue([record(0)]);
  jest.mocked(getAttendanceExportStudents).mockResolvedValue([{id:"student-a",name:"Ana",membershipStatus:"inactive"}]);
  jest.mocked(exportWorkbookXlsx).mockResolvedValue({fileName:"report.xlsx",uri:"blob:report"});
});
test("lazy export preserves all 55,000 ordered rows, notes, labels and existing workbook options",async()=>{
  const records=Array.from({length:55000},(_,index)=>record(index));
  jest.mocked(getAttendanceAll).mockResolvedValue([...records,{...record(55000),date:"2026-11-01"}]);
  expect(getAttendanceAll).not.toHaveBeenCalled();await exportTrainerAttendance(input());
  expect(getAttendanceAll).toHaveBeenCalledTimes(1);
  expect(getAttendanceExportStudents).toHaveBeenCalledTimes(1);
  expect(getAttendanceExportStudents).toHaveBeenCalledWith({organizationId:"org-a"});
  expect(getAttendanceAll).toHaveBeenCalledWith({organizationId:"org-a",startIso:"2026-10-01",endIso:"2026-11-01"});
  const workbook=jest.mocked(exportWorkbookXlsx).mock.calls[0][0];
  expect(workbook.fileName).toBe("relatorio_2026-10.xlsx");
  expect(workbook.sheets[0].rows).toEqual([[...REPORT_ATTENDANCE_EXPORT_HEADERS_PTBR],...records.map(row=>[row.date,"Turma Alfa","Ana",row.status,row.note])]);
  expect(workbook.sheets[0].options).toEqual({freezeHeaderRow:true,autoFilterHeaderRow:true,autoSizeColumns:true,columnWidths:[12,24,28,14,42],minColumnWidth:10,maxColumnWidth:48});
});
test.each(["user","session","organization","generation","month"])("%s changes during detailed loading prevent any workbook",async kind=>{
  let current=true;
  jest.mocked(getAttendanceAll).mockImplementationOnce(async()=>{
    if(kind==="user")mockIdentity.userId="teacher-b";if(kind==="session")mockIdentity.generation++;
    if(kind==="organization")mockOrg="org-b";if(kind==="generation")mockGeneration++;if(kind==="month")current=false;
    return [record(0)];
  });
  await expect(exportTrainerAttendance({...input(),isCurrent:()=>current})).rejects.toThrow();expect(exportWorkbookXlsx).not.toHaveBeenCalled();
});
test("errors never download an empty or partial workbook",async()=>{
  jest.mocked(getAttendanceAll).mockRejectedValueOnce(new Error("Forbidden"));
  await expect(exportTrainerAttendance(input())).rejects.toThrow("Forbidden");expect(exportWorkbookXlsx).not.toHaveBeenCalled();
});
test("guard handed to async workbook loading still rejects a later scope change",async()=>{
  await exportTrainerAttendance(input());const guard=jest.mocked(exportWorkbookXlsx).mock.calls[0][0].assertCurrent!;
  mockGeneration++;expect(guard).toThrow();
});
test.each(["user","generation","organization","month","error"])("%s failure during minimal name loading prevents a workbook",async kind=>{
  let current=true;
  jest.mocked(getAttendanceExportStudents).mockImplementationOnce(async()=>{
    if(kind==="user")mockIdentity.userId="teacher-b";
    if(kind==="generation")mockGeneration++;
    if(kind==="organization")mockOrg="org-b";
    if(kind==="month")current=false;
    if(kind==="error")throw new Error("Forbidden names");
    return [{id:"student-a",name:"Ana",membershipStatus:"active"}];
  });
  await expect(exportTrainerAttendance({...input(),isCurrent:()=>current})).rejects.toThrow();
  expect(exportWorkbookXlsx).not.toHaveBeenCalled();
});
test.each(["Etc/GMT-3","America/Sao_Paulo"])("%s keeps the full civil month, including day31",async timezone=>{
  const previous=process.env.TZ;process.env.TZ=timezone;
  try {
    jest.mocked(getAttendanceAll).mockResolvedValue([{...record(1),date:"2026-10-31"}]);
    await exportTrainerAttendance(input());
    expect(getAttendanceAll).toHaveBeenCalledWith({organizationId:"org-a",startIso:"2026-10-01",endIso:"2026-11-01"});
    expect(jest.mocked(exportWorkbookXlsx).mock.calls[0][0].sheets[0].rows[1][0]).toBe("2026-10-31");
  } finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
