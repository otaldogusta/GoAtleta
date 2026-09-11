import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pendingSource = readFileSync(
  resolve(__dirname, "../../../app/pending.tsx"),
  "utf8",
);
const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260909115540_restrict_organization_creation_to_platform_admin.sql",
  ),
  "utf8",
);

describe("organization provisioning access", () => {
  it("does not expose institution creation to an unmatched account", () => {
    expect(pendingSource).not.toContain("createOrganization");
    expect(pendingSource).not.toContain("Criar instituição");
    expect(pendingSource).not.toContain("Nome da instituição");
  });

  it("reserves the legacy provisioning RPC for a trusted service", () => {
    expect(migrationSource).toContain(
      "from public, anon, authenticated",
    );
    expect(migrationSource).toContain(
      "grant execute on function public.create_organization_with_admin(text)",
    );
    expect(migrationSource).toContain("to service_role");
  });
});
