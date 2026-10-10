/** @jest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { transpileModule, ModuleKind } from "typescript";
import { isTrainerInviteAvailable } from "../trainer-invite-validation";

const source = readFileSync(resolve(__dirname, "../../validate-trainer-invite/index.ts"), "utf8");
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
const active = { revoked: false, claimed_by: null, uses: 0, max_uses: 1, expires_at: "2099-01-01T00:00:00Z" };

describe("validate-trainer-invite Edge handler", () => {
  let handler: (request: Request) => Promise<Response>;
  let lookup: jest.Mock;
  let filter: jest.Mock;
  beforeEach(() => {
    lookup = jest.fn().mockResolvedValue({ data: active, error: null });
    filter = jest.fn(() => ({ maybeSingle: lookup }));
    const from = jest.fn((table) => {
      expect(table).toBe("trainer_invites");
      // No write or claim operation is available in this test backend.
      return { select: () => ({ eq: filter }) };
    });
    const requireModule = (name: string) => {
      if (name.includes("supabase-js")) return { createClient: () => ({ from }) };
      if (name.includes("cors")) return { buildCorsHeaders: () => ({}), corsPreflight: () => new Response(null, { status: 204 }) };
      if (name.includes("trainer-invite-validation")) return { isTrainerInviteAvailable };
      throw new Error(`Unexpected import: ${name}`);
    };
    new Function("require", "exports", "Deno", "crypto", compiled)(requireModule, {}, {
      env: { get: () => "local-test-only" }, serve: (fn: typeof handler) => { handler = fn; },
    }, webcrypto);
  });
  const request = (code: unknown = " abcd-efgh ") => new Request("http://localhost/validate", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
  it("checks a hash anonymously and returns only availability", async () => {
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "valid" });
    const hash = Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode("ABCD-EFGH"))).toString("hex");
    expect(filter).toHaveBeenCalledWith("code_hash", hash);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("allows the local signup origin for preflight and error responses only by exact match", async () => {
    for (const origin of ["http://localhost:8089", "https://untrusted.example"]) {
      const preflight = await handler(new Request("http://localhost/validate", { method: "OPTIONS", headers: { Origin: origin } }));
      const response = await handler(new Request("http://localhost/validate", { method: "POST", headers: { Origin: origin }, body: JSON.stringify({ code: "!" }) }));
      const expected = origin === "http://localhost:8089" ? origin : null;
      expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(expected);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(expected);
      expect(lookup).not.toHaveBeenCalled();
    }
  });
  it.each([
    null, { ...active, revoked: true }, { ...active, claimed_by: "someone" },
    { ...active, uses: 1 }, { ...active, expires_at: "2000-01-01T00:00:00Z" },
    { ...active, expires_at: "invalid" },
  ])("rejects unavailable invitations without disclosing the reason: %j", async (data) => {
    lookup.mockResolvedValue({ data, error: null });
    const response = await handler(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVITE_INVALID" });
  });
  it("handles bad inputs before querying and distinguishes backend failures", async () => {
    expect((await handler(request({ malicious: true }))).status).toBe(400);
    expect((await handler(request("a"))).status).toBe(400);
    expect((await handler(new Request("http://localhost/validate"))).status).toBe(405);
    expect(lookup).not.toHaveBeenCalled();
    lookup.mockResolvedValue({ data: null, error: { message: "private details" } });
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "SERVER_ERROR" });
  });
});
