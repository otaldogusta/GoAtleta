import {
  buildGoogleDriveHeaders,
  buildGoogleDriveResourceKeyHeader,
  createPkceChallenge,
  createPkceVerifier,
  decryptDriveRefreshToken,
  encryptDriveRefreshToken,
  revokeGoogleDriveToken,
  resolveGoogleDriveCredential,
  resolveSafeDriveReturnUrl,
} from "../google-drive-auth.ts";

describe("Google Drive credential helpers", () => {
  test("protege refresh token com AES-GCM sem persistir texto puro", async () => {
    const secret = "document-token-secret-with-at-least-32-characters";
    const encrypted = await encryptDriveRefreshToken(
      "refresh-token-sensitive",
      secret,
    );

    expect(encrypted.ciphertext).not.toContain("refresh-token-sensitive");
    expect(encrypted.iv).toBeTruthy();
    await expect(
      decryptDriveRefreshToken(encrypted.ciphertext, encrypted.iv, secret),
    ).resolves.toBe("refresh-token-sensitive");
  });

  test("gera PKCE S256 para o fluxo OAuth", async () => {
    const verifier = createPkceVerifier();
    const challenge = await createPkceChallenge(verifier);

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toBe(verifier);
  });

  test("usa API key somente quando a estratégia permite", async () => {
    await expect(
      resolveGoogleDriveCredential({
        requestedStrategy: "api_key",
        apiKey: "public-api-key",
      }),
    ).resolves.toMatchObject({
      strategy: "api_key",
      apiKey: "public-api-key",
      accessToken: null,
    });
    await expect(
      resolveGoogleDriveCredential({
        requestedStrategy: "oauth_user",
        apiKey: "public-api-key",
      }),
    ).rejects.toThrow("google_oauth_required");
  });

  test("envia bearer e resource keys somente em headers do Google", () => {
    expect(
      buildGoogleDriveResourceKeyHeader([
        { fileId: "file-1", resourceKey: "resource-1" },
        { fileId: "file-2", resourceKey: null },
      ]),
    ).toBe("file-1/resource-1");

    const headers = buildGoogleDriveHeaders({
      credential: {
        strategy: "oauth_user",
        apiKey: null,
        accessToken: "access-token",
        expiresAt: null,
      },
      resourceKeys: [{ fileId: "file-1", resourceKey: "resource-1" }],
    });
    expect(headers.get("Authorization")).toBe("Bearer access-token");
    expect(headers.get("X-Goog-Drive-Resource-Keys")).toBe(
      "file-1/resource-1",
    );
  });

  test("aceita somente retornos conhecidos do GoAtleta", () => {
    expect(
      resolveSafeDriveReturnUrl(
        "http://localhost:8081/profile?drive=connect",
      ),
    ).toContain("localhost:8081/profile");
    expect(
      resolveSafeDriveReturnUrl("https://go-atleta.vercel.app/profile"),
    ).toContain("go-atleta.vercel.app/profile");
    expect(
      resolveSafeDriveReturnUrl("https://goatleta.com/profile"),
    ).toContain("goatleta.com/profile");
    expect(() =>
      resolveSafeDriveReturnUrl("https://example.com/steal"),
    ).toThrow("drive_oauth_return_url_not_allowed");
  });

  test("revoga a credencial no endpoint oficial sem expor o token na URL", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue(new Response(null, {
      status: 200,
    }));
    global.fetch = fetchMock as typeof fetch;
    try {
      await expect(revokeGoogleDriveToken("refresh-token")).resolves.toBe(true);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://oauth2.googleapis.com/revoke");
      expect(url).not.toContain("refresh-token");
      expect(String(init.body)).toContain("token=refresh-token");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
