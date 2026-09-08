import { missingClassActivity } from "../activity-review";
import type { ClassGroup } from "../models";
const cls = { id:"a",name:"Turma",unit:"Unidade",daysOfWeek:[1,3,5],createdAt:"2026-08-20",cycleStartDate:"2026-08-20" } as ClassGroup;
const base = { classes:[cls],attendance:[],pauses:[],reviews:[],today:"2026-09-07" };
it("suggests a review only after at least three past scheduled calls are missing",()=>{
  const result=missingClassActivity(base);
  expect(result[0].dates.slice(0,3)).toEqual(["2026-09-04","2026-09-02","2026-08-31"]);
  expect(result[0].dates).not.toContain(base.today);
  expect(missingClassActivity({...base,attendance:[{classid:"a",date:"2026-08-31"}]})).toEqual([]);
});
it("a recorded call breaks the streak even if every student was absent",()=>{
  expect(missingClassActivity({...base,attendance:[{classid:"a",date:"2026-09-04"}]})).toEqual([]);
});
it("excludes confirmed pauses and does not invent expectations before creation",()=>{
  expect(missingClassActivity({...base,classes:[{...cls,createdAt:"2026-09-01"}]})).toEqual([]);
  expect(missingClassActivity({...base,classes:[{...cls,createdAt:""}]})).toEqual([]);
  expect(missingClassActivity({...base,pauses:[{class_id:"a",date:"2026-09-04"}]} )[0].dates).not.toContain("2026-09-04");
});
it("does not repeat a reviewed period but reappears for a new missing date",()=>{
  expect(missingClassActivity({...base,reviews:[{class_ids:["a"],start_date:"2026-08-01",end_date:"2026-09-04"}]})).toEqual([]);
  expect(missingClassActivity({...base,reviews:[{class_ids:["a"],start_date:"2026-08-01",end_date:"2026-09-02"}]})).toHaveLength(1);
});

it("a future recess does not excuse past missing records",()=>{expect(missingClassActivity({...base,reviews:[{class_ids:["a"],start_date:"2026-09-10",end_date:"2026-09-20"}]})).toHaveLength(1);});
