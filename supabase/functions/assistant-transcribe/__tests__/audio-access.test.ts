import { canTranscribeLesson } from "../audio-access";
test.each([10,50])("general chat allows organization staff level %s without inventing a class", async level => {
  const filters: string[]=[];
  const db={from(table:string) {
    expect(table).toBe("organization_members");
    return {select(){return this;},eq(key:string,value:string){filters.push(`${key}:${value}`);return this;},maybeSingle:async()=>({data:{role_level:level},error:null})};
  }};
  expect(await canTranscribeLesson(db as never,"user","org")).toBe(true);
  expect(filters).toEqual(["organization_id:org","user_id:user"]);
});
test.each([null,5,0])("general chat denies missing or insufficient membership %s",async level=>{
  const db={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:level===null?null:{role_level:level},error:null})})};
  expect(await canTranscribeLesson(db as never,"user","org")).toBe(false);
});
test("a supplied class still must belong to the authorized organization",async()=>{
  const db={from:(table:string)=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='classes'?null:{role_level:50},error:null})})};
  expect(await canTranscribeLesson(db as never,"user","org","foreign")).toBe(false);
});
