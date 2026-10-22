// Forensic reproduction for JUR-02. Synthetic data, no network or dependencies.
// This confirms the defect in the audited source; it is not a passing product test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Resolve from docs/audits/evidence back to the repository root.
const endpointUrl = new URL('../../../supabase/functions/lgpd-export/index.ts', import.meta.url);
const original = readFileSync(endpointUrl, 'utf8').replace(/^\uFEFF/, '');
assert.equal((original.match(/^import .*;\r?$/gm) ?? []).length, 3);
const source = stripTypeScriptTypes(original.replace(/^import .*;\r?\n/gm, ''), { mode: 'strip' });
const requests = [];
const receipts = [];
const invalidTables = new Set(['session_logs', 'student_scouting_logs']);
let handler;

const createClient = () => ({
  from(table) {
    const result = invalidTables.has(table)
      ? { data: null, error: { code: '42703', message: 'Synthetic missing student_id column' } }
      : { data: [], error: null };
    const query = {
      select() { return query; },
      eq(column, value) { requests.push({ table, column, value }); return query; },
      maybeSingle() { return Promise.resolve({ data: { id: 'synthetic-student' }, error: null }); },
      insert(receipt) { receipts.push(receipt); return Promise.resolve({ error: null }); },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
    return query;
  },
});

vm.runInNewContext(source, {
  Deno: { env: { get: () => 'synthetic-config' }, serve: (value) => { handler = value; } },
  createClient,
  buildCorsHeaders: () => ({}),
  corsPreflight: () => new Response(null, { status: 204 }),
  Response,
  atob,
}, { timeout: 1000, filename: 'lgpd-export.synthetic.js' });

const payload = Buffer.from(JSON.stringify({ sub: 'synthetic-user', exp: 4102444800 })).toString('base64url');
const response = await handler(new Request('https://synthetic.invalid/lgpd-export', {
  method: 'POST',
  headers: { Authorization: `Bearer synthetic.${payload}.synthetic` },
  body: JSON.stringify({ studentId: 'synthetic-student' }),
}));
const exported = await response.json();
assert.equal(response.status, 200);
assert.deepEqual(exported.sessions, []);
assert.deepEqual(exported.scouting, []);
assert.equal(receipts.length, 1);
assert.equal(receipts[0].status, 'completed');
for (const table of invalidTables) {
  assert.ok(requests.some((request) => request.table === table && request.column === 'student_id'));
}
console.log('JUR-02 reproduced: two related-query errors -> HTTP 200, empty sections, completed receipt. Synthetic mocks only.');
