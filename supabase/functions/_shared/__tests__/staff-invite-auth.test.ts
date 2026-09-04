import { buildStaffInviteEmailLink, assertStaffInviteRecipient } from "../staff-invite-auth";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transpileModule, ModuleKind } from "typescript";
import { webcrypto } from "node:crypto";
import { hasTrustedInviteIdentity } from "../invite-email-verification";

describe("staff email authentication", () => {
  it("keeps proof in the recipient fragment; shared link stays invite-only", () => {
    const url = new URL(buildStaffInviteEmailLink("https://goatleta.com/signup", "TEST-CODE", "a".repeat(64), "magiclink", "staff@example.com"));
    expect(url.pathname).toBe("/staff-invite");
    expect(url.search).toBe("");
    expect(url.hash).toContain("token_hash=");
    const sender = readFileSync(resolve(__dirname, "../../create-trainer-invite/index.ts"), "utf8");
    expect(sender).toContain("signup_link: signupLink");
    expect(sender).not.toContain("signup_link: emailOnlyLink");
  });
  it("rejects another authenticated identity", () => {
    expect(() => assertStaffInviteRecipient("staff@example.com", "owner@example.com")).toThrow("INVITE_EMAIL_MISMATCH");
  });

  const source = readFileSync(resolve(__dirname, "../../accept-staff-invite/index.ts"), "utf8")
    .replace(/^import .*;\r?\n/gm, "");
  const javascript = transpileModule(source, { compilerOptions: { module: ModuleKind.None } }).outputText;
  function setup({ email = "staff@example.com", expired = false, proofError = false, claimError = false, newUser = false, trusted = true, claimed = false, samePassword = false, linkOnly = false } = {}) {
    const invite = { id: "invite-1", invited_to: linkOnly ? null : "staff@example.com", invited_via: linkOnly ? "link" : "email", uses: claimed ? 1 : 0, max_uses: 1, revoked: false, claimed_by: claimed ? "recipient-id" : null, organization_id: "org-1", expires_at: expired ? "2020-01-01" : "2099-01-01" };
    const user = { id: "recipient-id", email, app_metadata: { staff_invite_setup_required: newUser, email_verified_hybrid_at: trusted ? "2026-09-04" : null }, user_metadata: {} };
    const rpc = jest.fn().mockResolvedValue({ error: claimError ? {} : null });
    const update = jest.fn().mockImplementation(async (_id, updates) => ({ data: { user: { ...user, ...updates } }, error: null }));
    const verify = jest.fn().mockResolvedValue({ error: proofError ? {} : null, data: { user, session: { access_token: "recipient-session", refresh_token: "recipient-refresh" } } });
    const getUser = jest.fn().mockResolvedValue({ error: null, data: { user } });
    const accountUpdate = jest.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    if (samePassword) accountUpdate.mockResolvedValueOnce(new Response(JSON.stringify({ code: "same_password" }), { status: 422 }));
    const admin = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: invite, error: null }) }) }) }), rpc, auth: { admin: { updateUserById: update } } };
    const client = jest.fn().mockReturnValueOnce(admin).mockReturnValueOnce({ auth: { verifyOtp: verify, getUser } });
    let handler: (req: Request) => Promise<Response>;
    new Function("createClient", "buildCorsHeaders", "corsPreflight", "assertStaffInviteRecipient", "hasTrustedInviteIdentity", "Deno", "crypto", "fetch", javascript)(
      client, () => ({}), () => new Response(null), assertStaffInviteRecipient, hasTrustedInviteIdentity,
      { env: { get: () => "test-config" }, serve: (fn: typeof handler) => { handler = fn; } }, webcrypto, accountUpdate,
    );
    return { rpc, update, verify, getUser, accountUpdate, call: (body: Record<string, unknown> = {}) => handler(new Request("https://example.test", { method: "POST", headers: { Authorization: "Bearer test-session" }, body: JSON.stringify({ code: "TEST-CODE", token_hash: "a".repeat(64), type: "magiclink", ...body }) })) };
  }
  it("authenticates and claims as the recipient, never the existing owner session", async () => {
    const ctx = setup();
    const response = await ctx.call();
    expect(response.status).toBe(200);
    expect(ctx.rpc).toHaveBeenCalledWith("claim_trainer_invite_access", { p_invite_id: "invite-1", p_user_id: "recipient-id" });
    expect((await response.json()).session.access_token).toBe("recipient-session");
  });
  it.each([{ email: "owner@example.com" }, { expired: true }, { proofError: true }])("never grants or returns a session for invalid proof %o", async (options) => {
    const ctx = setup(options);
    const response = await ctx.call();
    expect(response.status).toBe(400);
    expect(ctx.rpc).not.toHaveBeenCalled();
    expect(ctx.update).not.toHaveBeenCalled();
    expect(ctx.accountUpdate).not.toHaveBeenCalled();
    expect((await response.json()).session).toBeUndefined();
  });
  it("does not report success or return credentials when claim fails", async () => {
    const ctx = setup({ claimError: true });
    const response = await ctx.call();
    expect(response.status).toBe(409);
    expect((await response.json()).session).toBeUndefined();
  });
  it("holds a new account at signup without granting membership", async () => {
    const ctx = setup({ newUser: true });
    const response = await ctx.call();
    expect((await response.json()).setup_required).toBe(true);
    expect(ctx.rpc).not.toHaveBeenCalled();
    expect(ctx.update.mock.calls.some(([, value]) => "password" in value)).toBe(false);
  });
  it.each([{ newUser: false }, { newUser: true, trusted: false }, { newUser: true, email: "other@example.com" }])("cannot reset an existing or unverified/wrong account %o", async options => {
    const ctx = setup(options);
    const response = await ctx.call({ action: "complete", full_name: "Ana Silva", password: "New-password-123", setup_required: true });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(ctx.update).not.toHaveBeenCalled();
    expect(ctx.rpc).not.toHaveBeenCalled();
  });
  it.each([{ full_name: "", password: "secret123" }, { full_name: "Ana Silva", password: "123" }])("rejects invalid signup fields %o", async fields => {
    const ctx = setup({ newUser: true });
    expect((await ctx.call({ action: "complete", ...fields })).status).toBe(400);
    expect(ctx.update).not.toHaveBeenCalled();
  });
  it.each([false, true])("sets credentials, claims and clears onboarding (own retry: %s)", async claimed => {
    const ctx = setup({ newUser: true, claimed });
    const response = await ctx.call({ action: "complete", full_name: " Ana  Silva ", password: "secret123" });
    expect(response.status).toBe(200);
    expect(JSON.parse(ctx.accountUpdate.mock.calls[0][1].body)).toEqual({ password: "secret123", data: { full_name: "Ana Silva", name: "Ana Silva" } });
    expect(ctx.accountUpdate.mock.calls[0][1].headers.Authorization).toBe("Bearer test-session");
    expect(ctx.update.mock.calls.some(([, value]) => "password" in value)).toBe(false);
    expect(ctx.rpc).toHaveBeenCalledWith("claim_trainer_invite_access", { p_invite_id: "invite-1", p_user_id: "recipient-id" });
    expect((await response.json()).user.app_metadata.staff_invite_setup_required).toBe(false);
  });
  it("does not finish onboarding on claim failure", async () => {
    const ctx = setup({ newUser: true, claimError: true });
    expect((await ctx.call({ action: "complete", full_name: "Ana Silva", password: "secret123" })).status).toBe(409);
    expect(ctx.accountUpdate).toHaveBeenCalledTimes(1);
    expect(ctx.update).not.toHaveBeenCalled();
  });
  it("allows retry after a password was saved but the claim failed", async () => {
    const ctx = setup({ newUser: true, samePassword: true });
    expect((await ctx.call({ action: "complete", full_name: "Ana Silva", password: "secret123" })).status).toBe(200);
    expect(ctx.accountUpdate).toHaveBeenCalledTimes(2);
    expect(JSON.parse(ctx.accountUpdate.mock.calls[1][1].body)).toEqual({ data: { full_name: "Ana Silva", name: "Ana Silva" } });
  });
  it("resumes through canonical verified login without requiring a new email credential", async () => {
    const ctx = setup({ newUser: true });
    expect((await ctx.call({ action: "setup", token_hash: undefined })).status).toBe(200);
    expect(ctx.verify).not.toHaveBeenCalled();
    expect(ctx.update).not.toHaveBeenCalled();
    expect(ctx.rpc).not.toHaveBeenCalled();
  });
  it("does not allow the legacy claim to bypass required onboarding", () => {
    const source = readFileSync(resolve(__dirname, "../../claim-trainer-invite/index.ts"), "utf8");
    expect(source).toContain('user.app_metadata?.staff_invite_setup_required === true');
    expect(source).toContain('409, "STAFF_SETUP_REQUIRED"');
  });
  it("supports a WhatsApp-only invite only through verified canonical authentication", async () => {
    const ctx = setup({ newUser: true, linkOnly: true });
    expect((await ctx.call({ action: "setup", token_hash: undefined })).status).toBe(200);
    expect(ctx.verify).not.toHaveBeenCalled();
    const unboundProof = setup({ newUser: true, linkOnly: true });
    expect((await unboundProof.call()).status).toBe(400);
    expect(unboundProof.verify).not.toHaveBeenCalled();
  });
});
