import { loadActivityContext } from "../activity-context";
function fixture(error: boolean) {
  const calls: unknown[][] = [];
  const db = { from(table: string) {
    calls.push(["from",table]);
    const query: Record<string,unknown> = {};
    for (const method of ["select","eq","gte","lte","order","limit","contains"]) query[method]=(...args:unknown[])=>{calls.push([method,...args]);return query;};
    query.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve({data:table==='class_calendar_exceptions'?[{class_id:'a',date:'2026-09-07',reason:'Férias/recesso'}]:[],error:error?{message:'unavailable'}:null}));
    return query;
  } };
  return {db,calls};
}
it("provides confirmed dates and reasons with organization and class isolation",async()=>{
  const {db,calls}=fixture(false);
  const result=await loadActivityContext(db as never,'org-a','2026-09-07','a');
  expect(calls.filter(c=>c[0]==='eq'&&c[1]==='organization_id')).toEqual([['eq','organization_id','org-a'],['eq','organization_id','org-a']]);
  expect(calls).toContainEqual(['eq','class_id','a']);
  expect(calls).toContainEqual(['contains','class_ids',['a']]);
  expect(result).toContain('Férias/recesso');
  expect(result).toContain('2026-09-07');
  expect(result).toContain('Ausência de chamada não prova falta');
});
it("does not report an empty calendar when the query failed",async()=>{
  expect(await loadActivityContext(fixture(true).db as never,'org-a','2026-09-07')).toContain('Não foi possível consultar');
});
