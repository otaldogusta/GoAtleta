import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const { snapshot, fingerprint, outputDigest, reusable, MAX_AGE_MS } = require('../validation-cache.cjs');
const { gates, buildGate, pool, validate, parseArgs, runProcess } = require('../validate.cjs');

let root: string;
const write = (file: string, content = 'example') => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'goatleta-validation-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  write('.gitignore', '.tmp/\nnode_modules/\ndist/\n.env.local\n');
  write('node_modules/.package-lock.json', '{}');
  write('package.json', '{}');
  write('src/example.ts');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const key = (id = 'tests', env = {}) => fingerprint(snapshot(root, env), gates.find((gate: any) => gate.id === id));

it('retains every existing gate and rejects unknown flags', () => {
  expect(gates.map((gate: any) => gate.id).sort()).toEqual(['architecture', 'assets', 'brand', 'encoding', 'jwt', 'lint', 'org-scope', 'performance', 'sql', 'tests', 'types']);
  expect(parseArgs(['--fresh', '--build', '--jobs=1'])).toEqual({ fresh: true, build: true, jobs: 1 });
  expect(() => parseArgs(['--skip-security'])).toThrow();
  expect(() => parseArgs(['--jobs=20'])).toThrow();
});

it('invalidates edited, added, deleted and renamed inputs, including untracked files', () => {
  const original = key();
  write('src/example.ts', 'changed'); expect(key()).not.toBe(original);
  write('src/example.ts'); expect(key()).toBe(original);
  write('src/new.ts'); expect(key()).not.toBe(original);
  fs.unlinkSync(path.join(root, 'src/new.ts')); expect(key()).toBe(original);
  fs.renameSync(path.join(root, 'src/example.ts'), path.join(root, 'src/moved.ts'));
  expect(key()).not.toBe(original);
  fs.unlinkSync(path.join(root, 'src/moved.ts')); expect(key()).not.toBe(original);
});

it('invalidates environment, lockfile, installed dependencies, patches and runner changes', () => {
  const original = key();
  expect(key('tests', { EXAMPLE_SETTING: 'changed' })).not.toBe(original);
  for (const file of ['.env.local', 'package-lock.json', 'patches/fix.patch', 'scripts/release/validate.cjs']) {
    write(file); expect(key()).not.toBe(original); fs.unlinkSync(path.join(root, file));
  }
  write('node_modules/.package-lock.json', '{"changed":true}'); expect(key()).not.toBe(original);
});

it('includes ignored runtime files in invalidation', () => {
  write('.gitignore', '.tmp/\nnode_modules/\ndist/\n.env.local\nassets/private.png\n');
  const original = key();
  write('assets/private.png'); expect(key()).not.toBe(original);
});

it('distinguishes a deleted tracked file from a literal missing marker', () => {
  write('src/example.ts', '<missing>');
  execFileSync('git', ['add', 'src/example.ts'], { cwd: root });
  const original = key();
  fs.unlinkSync(path.join(root, 'src/example.ts'));
  expect(key()).not.toBe(original);
});

it('observes real child exit status and keeps diagnostics in its log', async () => {
  write('fixture.cjs', "console.error('fixture diagnostic'); process.exit(3);");
  const log = path.join(root, 'fixture.log');
  expect(await runProcess(root, { args: ['fixture.cjs'] }, log, new Set(), process.env)).toBe(false);
  expect(fs.readFileSync(log, 'utf8')).toContain('fixture diagnostic');
});

it('reuses only successful, current receipts with matching outputs', () => {
  const record = { version: 1, status: 'passed', key: 'abc', at: 1000, output: 'built' };
  expect(reusable(record, 'abc', 1001, 'built')).toBe(true);
  expect(reusable(record, 'abc', 1001, null)).toBe(false);
  expect(reusable(record, 'abc', 1001, 'tampered')).toBe(false);
  expect(reusable(record, 'changed', 1001)).toBe(false);
  expect(reusable(record, 'abc', 1000 + MAX_AGE_MS)).toBe(false);
  expect(reusable(record, 'abc', 999)).toBe(false);
  expect(reusable({ ...record, status: 'failed' }, 'abc', 1001)).toBe(false);
  expect(reusable({ ...record, version: 0 }, 'abc', 1001)).toBe(false);
});

it('detects missing, changed and extra build artifacts', () => {
  expect(outputDigest(root)).toBeNull();
  write('dist/index.html'); const built = outputDigest(root);
  write('dist/chunk.js'); expect(outputDigest(root)).not.toBe(built);
  fs.unlinkSync(path.join(root, 'dist/chunk.js')); expect(outputDigest(root)).toBe(built);
  write('dist/index.html', 'changed'); expect(outputDigest(root)).not.toBe(built);
});

it('bounds parallel execution and records failures without hiding other results', async () => {
  let active = 0, peak = 0;
  const results = await pool([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2, async (gate: any) => {
    active++; peak = Math.max(active, peak);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    if (gate.id === 'b') throw new Error('failure');
    return { id: gate.id, status: 'passed' };
  });
  expect(peak).toBe(2);
  expect(results.map((result: any) => result.status)).toEqual(['passed', 'failed', 'passed']);
});

it('resumes passed gates locally, retries failure, and builds only after all gates pass', async () => {
  const calls: string[] = [];
  const failed = await validate({ root, env: {}, build: true, report: () => {}, execute: async (_: any, gate: any) => {
    calls.push(gate.id); return gate.id !== 'tests';
  } });
  expect(failed.passed).toBe(false); expect(calls).not.toContain('build');
  expect(fs.existsSync(path.join(root, '.tmp/validation/results/tests.json'))).toBe(false);
  calls.length = 0;
  const passed = await validate({ root, env: {}, build: true, report: () => {}, execute: async (_: any, gate: any) => {
    calls.push(gate.id); if (gate.id === 'build') write('dist/index.html'); return true;
  } });
  expect(passed.passed).toBe(true); expect(calls).toContain('tests'); expect(calls).toContain('build');
  expect(calls).not.toContain('lint'); expect(calls).not.toContain('types'); expect(calls).not.toContain('sql');
  calls.length = 0;
  await validate({ root, env: {}, build: true, report: () => {}, execute: async (_: any, gate: any) => { calls.push(gate.id); return true; } });
  expect(calls).not.toContain('build'); expect(calls).not.toContain('tests'); expect(calls).toContain('performance');
});

it.each([{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }])('CI runs all gates every time: %j', async env => {
  const execute = jest.fn(async () => true);
  await validate({ root, env, execute, report: () => {} });
  execute.mockClear();
  await validate({ root, env, execute, report: () => {} });
  expect(execute).toHaveBeenCalledTimes(gates.length);
});

it('refuses a result when inputs change during the run and releases its lock', async () => {
  const result = await validate({ root, env: {}, report: () => {}, execute: async (_: any, gate: any) => {
    if (gate.id === 'tests') write('src/example.ts', 'edited during check');
    return true;
  } });
  expect(result.passed).toBe(false); expect(result.changed).toBe(true);
  expect(fs.existsSync(path.join(root, '.tmp/validation/results'))).toBe(false);
  expect(fs.existsSync(path.join(root, '.tmp/validation/running.lock'))).toBe(false);
});

it('fresh runs ignore receipts; records contain no environment values', async () => {
  const execute = jest.fn(async () => true);
  const env = { EXAMPLE_SETTING: 'private-test-value' };
  await validate({ root, env, execute, report: () => {} });
  const record = fs.readFileSync(path.join(root, '.tmp/validation/results/tests.json'), 'utf8');
  expect(record).not.toContain('private-test-value');
  execute.mockClear();
  await validate({ root, env, fresh: true, execute, report: () => {} });
  expect(execute).toHaveBeenCalledTimes(gates.length);
});

it('serializes callers and rejects missing dependency installation', async () => {
  write('.tmp/validation/running.lock', 'existing-process');
  await expect(validate({ root })).rejects.toThrow('already running');
  expect(fs.readFileSync(path.join(root, '.tmp/validation/running.lock'), 'utf8')).toBe('existing-process');
  fs.unlinkSync(path.join(root, '.tmp/validation/running.lock'));
  fs.unlinkSync(path.join(root, 'node_modules/.package-lock.json'));
  expect(() => snapshot(root, {})).toThrow('npm ci');
});

it('scopes SQL cache to its real inputs while application tests see documentation too', () => {
  const sql = key('sql'), tests = key('tests');
  write('docs/example.md'); expect(key('sql')).toBe(sql); expect(key('tests')).not.toBe(tests);
  write('supabase/migrations/new.sql'); expect(key('sql')).not.toBe(sql);
  expect(fingerprint(snapshot(root, {}), buildGate)).not.toBe(tests);
});
