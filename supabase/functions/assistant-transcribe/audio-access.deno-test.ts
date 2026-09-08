import { canTranscribeLesson } from "./audio-access.ts";
Deno.test("transcription requires the caller's membership, coach role and scoped class", async () => {
  for (const [level, classId, error, allowed] of [[10, "class", null, true], [50, "class", null, true], [5, "class", null, false], [undefined, "class", null, false], [50, null, null, false], [50, "class", { message: "denied" }, false]] as const) {
    const filters: string[] = [];
    const client = { from(table: string) {
      return { select() { return this; }, eq(key: string, value: string) { filters.push(`${table}:${key}:${value}`); return this; },
        maybeSingle() { return Promise.resolve({ data: table === "classes" ? { id: classId } : { role_level: level }, error }); } };
    } };
    if (await canTranscribeLesson(client as never, "user", "org", "class") !== allowed) throw new Error("Incorrect access result");
    for (const required of ["organization_members:user_id:user", "organization_members:organization_id:org", "classes:organization_id:org", "classes:id:class"]) {
      if (!filters.includes(required)) throw new Error(`Missing scope ${required}`);
    }
  }
});
