import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const studentsSource = readFileSync(resolve(__dirname, "../students.ts"), "utf8");
const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260815010512_add_student_inactivation_audit.sql"
  ),
  "utf8"
);

describe("student inactivation audit contract", () => {
  test("keeps the schema change additive and bounded", () => {
    expect(migrationSource).toContain("add column if not exists inactivated_by");
    expect(migrationSource).toContain("add column if not exists inactivation_reason");
    expect(migrationSource).toContain("char_length(inactivation_reason) <= 240");
    expect(migrationSource).not.toMatch(/\bdrop\s+table\b/i);
    expect(migrationSource).not.toMatch(/\bdelete\s+from\b/i);
  });

  test("records the actor and reason and clears the audit when reactivated", () => {
    expect(studentsSource).toContain("payload.inactivated_by = (await getSessionUserId()) || null");
    expect(studentsSource).toContain("payload.inactivation_reason = patch.inactivationReason?.trim() || null");
    expect(studentsSource).toContain("payload.inactivated_by = null");
    expect(studentsSource).toContain("payload.inactivation_reason = null");
  });
});
