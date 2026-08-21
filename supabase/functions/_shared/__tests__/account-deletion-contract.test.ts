import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const functionSource = readFileSync(
  resolve(__dirname, "../../delete-account/index.ts"),
  "utf8",
);
const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../migrations/20260821100049_self_service_account_deletion.sql",
  ),
  "utf8",
);

describe("self-service account deletion contract", () => {
  test("authenticates the caller and only deletes the authenticated user", () => {
    expect(functionSource).toContain("authClient.auth.getUser(token)");
    expect(functionSource).toContain("admin.auth.admin.deleteUser(user.id, false)");
    expect(functionSource).not.toContain("payload.userId");
    expect(functionSource).toContain("normalizeEmail(payload.confirmationEmail)");
  });

  test("prepares organizations and storage before removing Auth", () => {
    const organizationPreparation = functionSource.indexOf(
      '"prepare_self_account_deletion"',
    );
    const storagePreparation = functionSource.indexOf(
      '"list_owned_storage_objects_for_account_deletion"',
    );
    const authDeletion = functionSource.indexOf("auth.admin.deleteUser");

    expect(organizationPreparation).toBeGreaterThan(-1);
    expect(storagePreparation).toBeGreaterThan(organizationPreparation);
    expect(authDeletion).toBeGreaterThan(storagePreparation);
    expect(functionSource).toContain('storageObject.bucket_id === "profile-photos"');
    expect(functionSource).toContain("rehomeSharedStorageObject");
  });

  test("keeps privileged preparation unavailable to browser roles", () => {
    expect(migrationSource).toContain("ACCOUNT_DELETE_REQUIRES_ADMIN_TRANSFER");
    expect(migrationSource).toContain("on delete set null");
    expect(migrationSource).toContain(
      "revoke all on function public.prepare_self_account_deletion(uuid)",
    );
    expect(migrationSource).toContain(
      "grant execute on function public.prepare_self_account_deletion(uuid) to service_role",
    );
    expect(migrationSource).toContain("from storage.objects storage_object");
  });
});
