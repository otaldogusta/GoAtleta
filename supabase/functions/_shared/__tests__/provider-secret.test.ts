import {
  createSecureWebhookToken,
  decryptProviderSecret,
  encryptProviderSecret,
  providerSecretContext,
} from "../provider-secret.ts";

describe("provider secret storage", () => {
  const masterSecret = "test-only-master-secret-with-at-least-32-characters";
  const context = providerSecretContext({
    organizationId: "00000000-0000-4000-8000-000000000001",
    provider: "asaas",
    environment: "sandbox",
  });

  test("round-trips a key through AES-GCM without persisting plaintext", async () => {
    const encrypted = await encryptProviderSecret({
      plaintext: "sandbox-api-key-that-must-remain-private",
      masterSecret,
      context,
    });

    expect(encrypted.ciphertext).not.toContain("sandbox-api-key");
    expect(encrypted.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    await expect(
      decryptProviderSecret({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        masterSecret,
        context,
      }),
    ).resolves.toBe("sandbox-api-key-that-must-remain-private");
  });

  test("binds ciphertext to its organization and environment", async () => {
    const encrypted = await encryptProviderSecret({
      plaintext: "sandbox-api-key-that-must-remain-private",
      masterSecret,
      context,
    });

    await expect(
      decryptProviderSecret({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        masterSecret,
        context: `${context}:different`,
      }),
    ).rejects.toBeTruthy();
  });

  test("creates a header-safe webhook token", () => {
    expect(createSecureWebhookToken()).toMatch(/^[A-Za-z0-9_-]{32,255}$/);
  });
});
