import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

const connectionSource = read("../../finance-provider-connection/index.ts");
const webhookSource = read("../../asaas-webhook/index.ts");
const webhookHandlerSource = read("../asaas-webhook-handler.ts");
const migrationSource = read(
  "../../../migrations/20260901160250_add_asaas_receivables_connector.sql",
);
const rotationMigrationSource = read(
  "../../../migrations/20260902110857_rotate_asaas_receivables_key.sql",
);
const configSource = read("../../../config.toml");

describe("Asaas connector security contract", () => {
  test("keeps credentials outside the client data API", () => {
    expect(migrationSource).toContain(
      "alter table public.payment_provider_credentials enable row level security",
    );
    expect(migrationSource).toContain(
      "revoke all on table public.payment_provider_credentials from public, anon, authenticated",
    );
    expect(migrationSource).toContain(
      "grant all on table public.payment_provider_credentials to service_role",
    );
    expect(migrationSource).toContain("secret_ciphertext text not null");
    expect(migrationSource).not.toContain("api_key text");
  });

  test("connects atomically in read-only mode with charge creation disabled", () => {
    const connectRpc = migrationSource.slice(
      migrationSource.indexOf(
        "create or replace function public.connect_asaas_receivables_v1",
      ),
      migrationSource.indexOf(
        "create or replace function public.disconnect_asaas_receivables_v1",
      ),
    );
    expect(connectRpc).toContain("connection_mode = 'read_only'");
    expect(connectRpc).toContain("charges_enabled = false");
    expect(migrationSource).toContain(
      ") to service_role;\ngrant execute on function public.disconnect_asaas_receivables_v1",
    );
  });

  test("encrypts the provider key and never logs request payloads", () => {
    expect(connectionSource).toContain("PAYMENT_PROVIDER_ENCRYPTION_KEY");
    expect(connectionSource).toContain("encryptProviderSecret({");
    expect(connectionSource).toContain("decryptProviderSecret({");
    expect(connectionSource).not.toContain("console.log");
    expect(connectionSource).not.toContain("JSON.stringify(body)");
  });

  test("detects the Asaas environment on the server", () => {
    expect(connectionSource).toContain("detectAsaasEnvironment({ apiKey })");
    expect(connectionSource).not.toContain("body.environment");
  });

  test("rotates a validated key atomically without changing the connected account", () => {
    expect(connectionSource).toContain('if (action === "rotate_key")');
    expect(connectionSource).toContain(
      "textValue(currentMerchant.external_account_id) !== account.walletId",
    );
    expect(connectionSource).toContain(
      'admin.rpc("rotate_asaas_receivables_key_v1"',
    );
    expect(rotationMigrationSource).toContain("ASAAS_ACCOUNT_MISMATCH");
    expect(rotationMigrationSource).toContain("'provider_credential_rotated'");
    expect(rotationMigrationSource).toContain("'history_preserved', true");
    expect(rotationMigrationSource).toContain(") to service_role;");
  });

  test("derives the hosted webhook URL and alert email when no override exists", () => {
    expect(connectionSource).toContain(
      "`${supabaseUrl}/functions/v1/asaas-webhook`",
    );
    expect(connectionSource).toContain("textValue(auth.user.email)");
    expect(connectionSource).toContain(
      'parsedWebhookUrl.protocol !== "https:"',
    );
  });

  test("creates automatic relationship links only for an unambiguous match", () => {
    expect(connectionSource).toContain(
      "if (relationshipIds.length !== 1) continue;",
    );
  });

  test("authenticates Asaas callbacks and stores each provider event once", () => {
    expect(configSource).toContain(
      "[functions.asaas-webhook]\nverify_jwt = false",
    );
    expect(webhookHandlerSource).toContain('req.headers.get("asaas-access-token")');
    expect(webhookSource).toContain('rpc("process_asaas_event_v2", command)');
    expect(webhookSource).not.toContain('eventError?.code === "23505"');
    expect(webhookSource).not.toContain("console.log");
  });
});
