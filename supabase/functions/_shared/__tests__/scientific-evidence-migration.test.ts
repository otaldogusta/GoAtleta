import fs from "fs";
import path from "path";

describe("scientific evidence persistence contract", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260919013436_add_scientific_search_orchestration.sql"),
    "utf8"
  );

  test("keeps searches and candidates organization-scoped", () => {
    expect(migration).toContain("organization_id uuid not null");
    expect(migration).toContain("public.is_org_member(organization_id)");
    expect(migration).toContain("enable row level security");
  });

  test("does not grant client writes to the orchestration tables", () => {
    expect(migration).toContain("revoke all on public.scientific_evidence_searches from anon, authenticated");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete).*scientific_evidence_/i);
  });

  test("records reversible publication state and audit operations", () => {
    expect(migration).toContain("scientific_evidence_publication_audit");
    expect(migration).toContain("'withdraw'");
    expect(migration).toContain("previous_state jsonb");
    expect(migration).toContain("resulting_state jsonb not null");
  });

  test("reserves organization and trainer quota atomically before the external call", () => {
    expect(migration).toContain("reserve_scientific_evidence_consensus_call");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("count(*) >= 50");
    expect(migration).toContain("count(*) >= 5");
    expect(migration).toContain("'consensus', 'pending', 1");
    expect(migration).toContain("to service_role");
  });
});
