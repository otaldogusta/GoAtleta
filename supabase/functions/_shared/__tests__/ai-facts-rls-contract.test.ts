import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260919192145_harden_ai_assistant_prompt_boundaries.sql",
  ),
  "utf8",
);

describe("ai_facts RLS contract", () => {
  test("removes the membership-only insert policy", () => {
    expect(migration).toMatch(/DROP POLICY IF EXISTS ai_facts_insert_member/i);
  });

  test("allows a member to write only their own coach facts", () => {
    expect(migration).toMatch(/subject_type\s*=\s*'coach'/i);
    expect(migration).toMatch(/subject_id\s*=\s*\(SELECT auth\.uid\(\)\)::text/i);
    expect(migration).toMatch(/public\.is_org_member\(organization_id\)/i);
  });

  test("keeps organization administrators as the privileged writer", () => {
    expect(migration).toMatch(/public\.is_org_admin\(organization_id\)/i);
    expect(migration).toMatch(/FOR INSERT TO authenticated/i);
  });
});
