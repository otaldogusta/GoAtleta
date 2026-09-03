import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260903013732_expose_provider_receivables_to_finance_dashboard.sql",
  ),
  "utf8",
).toLowerCase();

describe("provider receivables finance projection", () => {
  it("requires an authenticated finance member for the requested organization", () => {
    expect(migrationSource).toContain("security definer");
    expect(migrationSource).toContain("if (select auth.uid()) is null");
    expect(migrationSource).toContain(
      "public.has_org_member_permission(p_org_id, 'financial')",
    );
    expect(migrationSource).toContain(
      "revoke all on function public.list_organization_provider_receivables_v1",
    );
    expect(migrationSource).toContain("from public, anon");
    expect(migrationSource).toContain("to authenticated");
  });

  it("returns a bounded monthly projection without credentials", () => {
    expect(migrationSource).toContain(
      "least(greatest(coalesce(p_limit, 250), 1), 500)",
    );
    expect(migrationSource).toContain("receivable.organization_id = p_org_id");
    expect(migrationSource).toContain("receivable.provider = 'asaas'");
    expect(migrationSource).not.toContain("secret_ciphertext");
    expect(migrationSource).not.toContain("secret_iv");
    expect(migrationSource).not.toContain("secret_fingerprint");
  });
});
