import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

type Handler = (request: Request) => Promise<Response>;

const compile = (relativePath: string) => transpileModule(
  readFileSync(resolve(__dirname, relativePath), "utf8"),
  { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } },
).outputText;
const handlerCode = compile("../../rules-sync-admin/index.ts");
const corsCode = compile("../cors.ts");
const origin = "https://goatleta.com";

function setup({ roleLevel = 50, userExists = true } = {}) {
  const getUser = jest.fn().mockResolvedValue({
    data: { user: userExists ? { id: "user-admin" } : null }, error: null,
  });
  const query = (data: unknown) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
  });
  const sourceQuery = query({ id: "source-1", organization_id: "org-1", enabled: true });
  const memberQuery = query(roleLevel < 0 ? null : { role_level: roleLevel });
  const from = jest.fn((table: string) => {
    if (table === "regulation_sources") return sourceQuery;
    if (table === "organization_members") return memberQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
  const createClient = jest.fn((_url: string, key: string) => (
    key === "test-service-key" ? { from } : { auth: { getUser } }
  ));
  const report = { checked: 1, newDocuments: 1, newUpdates: 1, skipped: 0, errors: [] };
  const runRulesSync = jest.fn().mockResolvedValue(report);
  const environment: Record<string, string> = {
    SUPABASE_URL: "https://example.test",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    RULES_SYNC_ADMIN_RATE_LIMIT_PER_MIN: "1",
  };
  let handler: Handler | undefined;
  const deno = {
    env: { get: (name: string) => environment[name] },
    serve: (callback: Handler) => { handler = callback; },
  };
  const corsExports = {};
  new Function("exports", "Deno", "Response", corsCode)(corsExports, deno, Response);
  // Execute the real entrypoint and CORS helper without loading network imports.
  new Function("require", "exports", "Deno", "Response", "globalThis", handlerCode)(
    (specifier: string) => {
      if (specifier === "https://esm.sh/@supabase/supabase-js@2") return { createClient };
      if (specifier === "../_shared/cors.ts") return corsExports;
      if (specifier === "../_shared/regulation-sync-core.ts") return { runRulesSync };
      throw new Error(`Unexpected import: ${specifier}`);
    },
    {}, deno, Response, {},
  );
  if (!handler) throw new Error("Deno.serve did not register the handler");
  const invoke = handler;
  const call = ({
    method = "POST", authenticated = true,
    body = JSON.stringify({ sourceId: "source-1", organizationId: "org-1" }),
  } = {}) => invoke(new Request("https://example.test/rules-sync-admin", {
    method,
    headers: { Origin: origin, ...(authenticated ? { Authorization: "Bearer test-session" } : {}) },
    ...(method === "POST" ? { body } : {}),
  }));
  return { call, createClient, getUser, from, sourceQuery, memberQuery, runRulesSync, report };
}

const expectCors = (response: Response) => {
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(response.headers.get("Vary")).toBe("Origin");
};

describe("rules-sync-admin request handling", () => {
  it("answers preflight with the request origin before authentication or sync", async () => {
    const ctx = setup();
    const response = await ctx.call({ method: "OPTIONS", authenticated: false });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expectCors(response);
    expect(ctx.createClient).not.toHaveBeenCalled();
    expect(ctx.runRulesSync).not.toHaveBeenCalled();
  });

  it.each([
    { method: "GET", authenticated: false, status: 405 },
    { method: "POST", authenticated: false, status: 401 },
  ])("returns $status for $method without invoking sync", async ({ status, ...input }) => {
    const ctx = setup();
    const response = await ctx.call(input);
    expect(response.status).toBe(status);
    expectCors(response);
    expect(ctx.from).not.toHaveBeenCalled();
    expect(ctx.runRulesSync).not.toHaveBeenCalled();
  });

  it("rejects a bearer token that has no authenticated user", async () => {
    const ctx = setup({ userExists: false });
    const response = await ctx.call();
    expect(response.status).toBe(401);
    expect(ctx.getUser).toHaveBeenCalledWith("test-session");
    expectCors(response);
    expect(ctx.from).not.toHaveBeenCalled();
    expect(ctx.runRulesSync).not.toHaveBeenCalled();
  });

  it.each(["{invalid", "{}"])("returns a CORS-safe validation error for %s", async (body) => {
    const ctx = setup();
    const response = await ctx.call({ body });
    expect(response.status).toBe(400);
    expectCors(response);
    expect(ctx.from).not.toHaveBeenCalled();
    expect(ctx.runRulesSync).not.toHaveBeenCalled();
  });

  it.each([20, -1])("denies non-administrators or missing members (%s) in the source organization", async (roleLevel) => {
    const ctx = setup({ roleLevel });
    const response = await ctx.call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expectCors(response);
    expect(ctx.memberQuery.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(ctx.memberQuery.eq).toHaveBeenCalledWith("user_id", "user-admin");
    expect(ctx.runRulesSync).not.toHaveBeenCalled();
  });

  it("rejects a source from a different requested organization without syncing", async () => {
    const ctx = setup();
    const response = await ctx.call({ body: JSON.stringify({ sourceId: "source-1", organizationId: "org-other" }) });
    expect(response.status).toBe(400);
    expectCors(response);
    expect(ctx.memberQuery.maybeSingle).not.toHaveBeenCalled();
    expect(ctx.runRulesSync).not.toHaveBeenCalled();
  });

  it("returns the authorized report and preserves the request-origin headers", async () => {
    const ctx = setup();
    const response = await ctx.call({ body: JSON.stringify({ sourceId: "source-1", organizationId: "org-1", force: false }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", ...ctx.report });
    expectCors(response);
    expect(ctx.runRulesSync).toHaveBeenCalledWith({ organizationId: "org-1", sourceId: "source-1", force: false });
  });

  it("returns a CORS-safe failure if synchronization fails", async () => {
    const ctx = setup();
    ctx.runRulesSync.mockRejectedValueOnce(new Error("Source unavailable"));
    const response = await ctx.call();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Source unavailable" });
    expectCors(response);
  });

  it("keeps the per-organization/user limit without running a second synchronization", async () => {
    const ctx = setup();
    expect((await ctx.call()).status).toBe(200);
    const response = await ctx.call();
    expect(response.status).toBe(429);
    expectCors(response);
    expect(ctx.runRulesSync).toHaveBeenCalledTimes(1);
  });
});
