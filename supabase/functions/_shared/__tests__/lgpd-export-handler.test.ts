import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

type Row = Record<string, unknown>;
type Handler = (request: Request) => Promise<Response>;
type Read = { table: string; columns: string; filters: [string, unknown][]; start?: number; end?: number };

const student = { id: "student-a", organization_id: "org-a", name: "Synthetic athlete", cpf_encrypted: "excluded-ciphertext", cpf_hmac: "excluded-hash" };
const otherStudent = { id: "student-b", organization_id: "org-b", name: "Other synthetic athlete" };
const datasetTables = ["consents", "attendance_checkins", "attendance_logs", "training_session_attendance", "athlete_intakes", "student_scouting_logs", "scouting_actions", "student_class_enrollments", "student_relationships", "absence_notices", "student_context_events", "health_data_access_logs"];

function setup(options: {
  invalidUser?: boolean;
  deniedStudent?: boolean;
  studentError?: boolean;
  errorTable?: string;
  throwTable?: string;
  receiptError?: boolean;
  receiptThrows?: boolean;
  missingConfig?: string;
  pageCap?: number;
  missingCount?: boolean;
  changedCount?: boolean;
  emptyPage?: boolean;
  duplicatePage?: boolean;
  foreignRow?: boolean;
  countOverride?: number;
  hiddenTable?: string;
  records?: Record<string, Row[]>;
} = {}) {
  const reads: Read[] = [];
  const receipts: Row[] = [];
  const receiptAttempts: Row[] = [];
  const records: Record<string, Row[]> = { students: [student, otherStudent] };
  for (const table of datasetTables) {
    const subjectColumn = ["attendance_logs", "student_scouting_logs"].includes(table) ? "studentid" : "student_id";
    records[table] = [
      { id: `${table}-a`, [subjectColumn]: "student-a", organization_id: "org-a", relationship_kind: "guardian", contact_email: "third-party@example.invalid", user_id: "other-person", ip_address: "excluded-ip" },
      { id: `${table}-peer`, [subjectColumn]: "student-peer", organization_id: "org-a" },
      { id: `${table}-other-org`, [subjectColumn]: "student-b", organization_id: "org-b" },
    ];
  }
  Object.assign(records, options.records);
  const getUser = jest.fn().mockResolvedValue({ data: { user: options.invalidUser ? null : { id: "verified-user-a" } }, error: options.invalidUser ? { message: "private auth detail" } : null });
  const receiptInsert = jest.fn(async (receipt: Row) => {
    receiptAttempts.push(receipt);
    if (options.receiptThrows) throw new Error("private receipt network detail");
    if (options.receiptError) return { error: { message: "private receipt database detail" } };
    receipts.push(receipt);
    return { error: null };
  });
  const project = (row: Row, columns: string) => Object.fromEntries(columns.split(",").filter((key) => key in row).map((key) => [key, row[key]]));
  const callerFrom = jest.fn((table: string) => {
    if (!(table in records)) throw new Error(`Unexpected read table: ${table}`);
    const read: Read = { table, columns: "", filters: [] };
    const matching = () => (options.hiddenTable === table ? [] : records[table])
      // Mock RLS for org A; real RLS must still be exercised separately.
      .filter((row) => row.organization_id === "org-a")
      .filter((row) => read.filters.every(([key, value]) => row[key] === value));
    const query = {
      select(columns: string, config?: { count: string }) {
        read.columns = columns;
        if (table !== "students") expect(config).toEqual({ count: "exact" });
        return query;
      },
      eq(column: string, value: unknown) { read.filters.push([column, value]); return query; },
      order(column: string, config: unknown) { expect(column).toBe("id"); expect(config).toEqual({ ascending: true }); return query; },
      async maybeSingle() {
        reads.push(read);
        expect(getUser).toHaveBeenCalledWith("synthetic-session");
        return { data: options.deniedStudent ? null : matching().map((row) => project(row, read.columns))[0] ?? null, error: options.studentError ? { message: "private student query detail" } : null };
      },
      async range(start: number, end: number) {
        read.start = start; read.end = end; reads.push(read);
        if (options.throwTable === table) throw new Error("private upstream network detail");
        if (options.errorTable === table) return { data: null, error: { code: "42703", message: "private query/student detail" }, count: null };
        const rows = matching().sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const pageEnd = Math.min(end + 1, start + (options.pageCap ?? 500));
        let data = rows.slice(start, pageEnd).map((row) => project(row, read.columns));
        if (options.emptyPage && start > 0) data = [];
        if (options.duplicatePage && start > 0) data = rows.slice(0, 1).map((row) => project(row, read.columns));
        if (options.foreignRow && table === "consents") data = [{ id: "foreign", student_id: "student-b", organization_id: "org-b" }];
        return { data, error: null, count: options.missingCount ? null : options.countOverride ?? (rows.length + (options.changedCount && start > 0 ? 1 : 0)) };
      },
    };
    return query;
  });
  const adminFrom = jest.fn((table: string) => {
    expect(table).toBe("data_subject_requests");
    return { insert: receiptInsert };
  });
  const createClient = jest.fn((_url: string, key: string, config: unknown) => {
    if (key === "synthetic-service") {
      expect(config).toEqual({ auth: { persistSession: false, autoRefreshToken: false } });
      return { from: adminFrom };
    }
    expect(key).toBe("synthetic-anon");
    expect(config).toEqual({ auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer synthetic-session" } } });
    return { from: callerFrom, auth: { getUser } };
  });
  const environment: Record<string, string> = { SUPABASE_URL: "https://example.invalid", SUPABASE_ANON_KEY: "synthetic-anon", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service" };
  if (options.missingConfig) delete environment[options.missingConfig];
  let handler: Handler | undefined;
  const deno = { env: { get: (key: string) => environment[key] }, serve: (callback: Handler) => { handler = callback; } };
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const existing = cache.get(file);
    if (existing) return existing.exports;
    const module = { exports: {} };
    cache.set(file, module);
    const compiled = transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", "Deno", "Response", "TextEncoder", compiled)(
      (specifier: string) => {
        if (specifier === "https://esm.sh/@supabase/supabase-js@2") return { createClient };
        if (!specifier.startsWith(".")) throw new Error(`Unexpected dependency: ${specifier}`);
        return load(resolve(file, "..", specifier));
      }, module, module.exports, deno, Response, TextEncoder,
    );
    return module.exports;
  }
  load(resolve(__dirname, "../../lgpd-export/index.ts"));
  if (!handler) throw new Error("Missing real handler registration");
  const invoke = handler;
  const call = ({ method = "POST", authorized = true, body = JSON.stringify({ studentId: "student-a" }) } = {}) => invoke(new Request("https://example.invalid/lgpd-export", {
    method, headers: { Origin: "https://goatleta.com", ...(authorized ? { Authorization: "Bearer synthetic-session" } : {}) },
    ...(method === "POST" ? { body } : {}),
  }));
  return { call, reads, receipts, receiptAttempts, createClient, callerFrom, adminFrom, getUser };
}

const failWithoutFile = async (ctx: ReturnType<typeof setup>, status = 500) => {
  const response = await ctx.call();
  expect(response.status).toBe(status);
  expect(response.headers.get("Content-Disposition")).toBeNull();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.text()).not.toMatch(/private|Synthetic athlete|synthetic-session|excluded-/);
  expect(ctx.receipts).toEqual([]);
};

describe("LGPD structured export real handler with synthetic Supabase responses", () => {
  it("authenticates via Auth, reads only with caller RLS, projects personal sets and records the declared scope", async () => {
    const ctx = setup();
    const response = await ctx.call({ body: JSON.stringify({ studentId: "student-a", organizationId: "org-b" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://goatleta.com");
    expect(response.headers.get("Content-Disposition")).toContain("goatleta_export_student-a.json");
    const result = await response.json();
    expect(result.requested_by).toBe("verified-user-a");
    expect(result.coverage.universal_subject_export).toBe(false);
    expect(result.coverage.excluded).toEqual(expect.arrayContaining([expect.objectContaining({ dataset: "session_logs" })]));
    expect(result.student).toEqual({ id: "student-a", organization_id: "org-a", name: "Synthetic athlete" });
    expect(result.scouting[0].studentid).toBe("student-a");
    expect(result.attendance_logs[0].studentid).toBe("student-a");
    expect(result.intakes).toHaveLength(1);
    expect(result.scouting_actions).toHaveLength(1);
    expect(result.relationships[0]).not.toHaveProperty("contact_email");
    expect(result.relationships[0]).not.toHaveProperty("user_id");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/third-party@example|excluded-|student-peer|student-b|other-person/);
    expect(ctx.reads.every((read) => read.columns !== "*")).toBe(true);
    expect(ctx.reads.find((read) => read.table === "student_scouting_logs")?.filters).toEqual([["studentid", "student-a"]]);
    expect(ctx.reads.find((read) => read.table === "athlete_intakes")?.filters).toEqual([["student_id", "student-a"], ["organization_id", "org-a"]]);
    expect(ctx.adminFrom).toHaveBeenCalledTimes(1);
    expect(ctx.receipts).toEqual([expect.objectContaining({ user_id: "verified-user-a", status: "completed", metadata: { export_coverage: result.coverage }, reason: expect.stringContaining("does not close") })]);
  });

  it("answers OPTIONS and rejects unsupported/missing-auth requests before clients or receipts", async () => {
    for (const [method, status] of [["OPTIONS", 200], ["GET", 405], ["POST", 401]] as const) {
      const ctx = setup();
      expect((await ctx.call({ method, authorized: false })).status).toBe(status);
      expect(ctx.createClient).not.toHaveBeenCalled();
      expect(ctx.receiptAttempts).toEqual([]);
    }
  });

  it.each(["null", "[]", "42", "{", JSON.stringify({ studentId: 7 }), JSON.stringify({ studentId: "bad\r\nfilename" }), JSON.stringify({ studentId: 'bad"name' }), JSON.stringify({ studentId: "x".repeat(129) })])("rejects malformed payload %s without database access", async (body) => {
    const ctx = setup();
    expect((await ctx.call({ body })).status).toBe(400);
    expect(ctx.createClient).not.toHaveBeenCalled();
  });

  it("rejects a bearer not validated by Supabase Auth before reading any subject record", async () => {
    const ctx = setup({ invalidUser: true });
    await failWithoutFile(ctx, 401);
    expect(ctx.callerFrom).not.toHaveBeenCalled();
    expect(ctx.adminFrom).not.toHaveBeenCalled();
  });

  it("does not read related datasets or write receipts when the student is hidden by RLS", async () => {
    const ctx = setup({ deniedStudent: true });
    await failWithoutFile(ctx, 404);
    expect(ctx.reads.map(({ table }) => table)).toEqual(["students"]);
    expect(ctx.adminFrom).not.toHaveBeenCalled();
  });

  it("denies a requested student in another organization using the caller client", async () => {
    const ctx = setup();
    expect((await ctx.call({ body: JSON.stringify({ studentId: "student-b" }) })).status).toBe(404);
    expect(ctx.reads.map(({ table }) => table)).toEqual(["students"]);
    expect(ctx.receiptAttempts).toEqual([]);
  });

  it.each(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"])("fails closed when %s is unavailable", async (missingConfig) => {
    const ctx = setup({ missingConfig });
    await failWithoutFile(ctx, 503);
    expect(ctx.createClient).not.toHaveBeenCalled();
  });

  it.each(datasetTables)("returns no partial file or completed receipt after %s fails", async (errorTable) => {
    const ctx = setup({ errorTable });
    await failWithoutFile(ctx);
    expect(ctx.receiptAttempts).toEqual([]);
  });

  it.each([{ studentError: true }, { throwTable: "athlete_intakes" }, { receiptError: true }, { receiptThrows: true }, { missingCount: true }, { foreignRow: true }])("fails safely for query/receipt/shape failures %j", async (options) => {
    await failWithoutFile(setup(options));
  });

  it("continues shorter server-capped pages until the exact count, without duplicating or truncating", async () => {
    const records = { attendance_logs: Array.from({ length: 5 }, (_, index) => ({ id: `attendance-${index}`, studentid: "student-a", organization_id: "org-a" })) };
    const ctx = setup({ pageCap: 2, records });
    const response = await ctx.call();
    expect(response.status).toBe(200);
    expect((await response.json()).attendance_logs).toHaveLength(5);
    expect(ctx.reads.filter(({ table }) => table === "attendance_logs").map(({ start }) => start)).toEqual([0, 2, 4]);
  });

  it.each([{ changedCount: true }, { emptyPage: true }, { duplicatePage: true }])("aborts unstable/incomplete pagination instead of returning success %j", async (options) => {
    const records = { consents: [0, 1, 2].map((id) => ({ id: `consent-${id}`, student_id: "student-a", organization_id: "org-a" })) };
    const ctx = setup({ ...options, pageCap: 1, records });
    await failWithoutFile(ctx);
    expect(ctx.receiptAttempts).toEqual([]);
  });

  it("declares RLS visibility limits instead of claiming empty visible sets are universal coverage", async () => {
    const ctx = setup({ hiddenTable: "athlete_intakes" });
    const response = await ctx.call();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.intakes).toEqual([]);
    expect(result.coverage.visibility).toContain("does not prove absence");
    expect(result.coverage.universal_subject_export).toBe(false);
  });

  it("refuses oversized totals before returning data or persisting a completion", async () => {
    const ctx = setup({ countOverride: 10_001 });
    await failWithoutFile(ctx, 413);
    expect(ctx.receiptAttempts).toEqual([]);
  });

  it("checks serialized byte limits before attempting a completed receipt", async () => {
    const ctx = setup({ records: { athlete_intakes: [{ id: "intake-large", student_id: "student-a", organization_id: "org-a", notes: "x".repeat(10 * 1024 * 1024) }] } });
    await failWithoutFile(ctx, 413);
    expect(ctx.receiptAttempts).toEqual([]);
  });
});
