import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260826003243_add_organization_timezone.sql",
  ),
  "utf8",
);

describe("organization timezone migration", () => {
  test("backfills old organizations and rejects unknown IANA timezone names", () => {
    expect(migrationSource).toContain("add column if not exists timezone text");
    expect(migrationSource).toContain("set timezone = 'America/Sao_Paulo'");
    expect(migrationSource).toContain("pg_catalog.pg_timezone_names");
    expect(migrationSource).toContain("organizations_enforce_timezone");
    expect(migrationSource).toContain("alter column timezone set not null");
  });

  test("returns the timezone only through the existing membership-scoped RPC", () => {
    expect(migrationSource).toContain("create function public.get_my_organizations()");
    expect(migrationSource).toContain("membership.user_id = (select auth.uid())");
    expect(migrationSource).toContain("organization.timezone");
    expect(migrationSource).toContain("grant execute on function public.get_my_organizations()");
    expect(migrationSource).not.toMatch(/grant\s+execute[^;]+to\s+anon/i);
  });
});
