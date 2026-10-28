import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const { smallReleasePlan } = jest.requireActual('../small-release.cjs');
const { validate, parseArgs } = jest.requireActual('../validate.cjs');

let root: string;
const write = (file: string, value: string) => { const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, value); };
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const testPath = 'src/bootstrap/__tests__/initial-loading.test.ts';
const options = { base: 'HEAD', tests: [testPath], env: {} };
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'goatleta-small-release-'));
  git('init', '--quiet');
  write('.gitignore', '.tmp/\nnode_modules/\ndist/\n'); write('package.json', '{}');
  write('node_modules/.package-lock.json', '{}');
  write('app/+html.tsx', '<head><title>Go Atleta</title><meta name="viewport" /></head>');
  write('src/components/Card.tsx', '<Text>Anterior</Text>'); write(testPath, 'test fixture');
  git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--no-gpg-sign', '-m', 'fixture baseline');
  write('app/+html.tsx', '<head><meta name="viewport" /></head>');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

it('accepts a title-only correction and existing focused tests', () => {
  expect(smallReleasePlan(root, options).code).toEqual(['app/+html.tsx']);
  expect(parseArgs(['--small', '--base=HEAD', `--test=${testPath}`, '--build'])).toEqual({ small: true, base: 'HEAD', tests: [testPath], build: true });
});
it('accepts literal presentation copy but rejects changed handlers and imports', () => {
  write('src/components/Card.tsx', '<Text>Atualizado</Text>');
  expect(smallReleasePlan(root, options).code).toHaveLength(2);
  write('src/components/Card.tsx', '<Button onPress={remove} />');
  expect(() => smallReleasePlan(root, options)).toThrow('behavior or structural');
  write('src/components/Card.tsx', 'import helper from "../core/helper";');
  expect(() => smallReleasePlan(root, options)).toThrow('behavior or structural');
});
it.each(['src/db/query.ts', 'src/core/model.ts', 'app/_layout.tsx', 'package-lock.json', 'supabase/migrations/change.sql', '.github/workflows/core-ci.yml', 'scripts/helper.cjs'])('rejects protected change %s, including untracked work', file => {
  write(file, 'change'); expect(() => smallReleasePlan(root, options)).toThrow('protected or unsupported');
});
it('rejects document behavior beyond the title, missing tests and CI', () => {
  expect(() => smallReleasePlan(root, { ...options, tests: [] })).toThrow('provide --base');
  expect(() => smallReleasePlan(root, { ...options, tests: ['--all'] })).toThrow('invalid test');
  expect(() => smallReleasePlan(root, { ...options, tests: ['../outside.test.ts'] })).toThrow('invalid test');
  expect(() => smallReleasePlan(root, { ...options, env: { CI: 'true' } })).toThrow('local only');
  expect(() => smallReleasePlan(root, { ...options, env: { GITHUB_ACTIONS: 'true' } })).toThrow('local only');
  write('app/+html.tsx', '<head><script>unsafe()</script></head>');
  expect(() => smallReleasePlan(root, options)).toThrow('beyond the title');
});
it('does not produce or reuse full-test receipts for a focused run', async () => {
  const calls: any[] = [];
  const result = await validate({ root, ...options, small: true, build: true, report: () => {}, execute: async (_: unknown, gate: any) => {
    calls.push(gate); if (gate.id === 'build') write('dist/index.html', '<title>Go Atleta</title>'); return true;
  } });
  expect(result.passed).toBe(true);
  expect(calls.find(g => g.id === 'focused-tests').args).toContain('--runTestsByPath');
  expect(calls.map(g => g.id)).toEqual(expect.arrayContaining(['small-lint', 'types', 'focused-tests', 'org-scope', 'build']));
  expect(calls.map(g => g.id)).not.toEqual(expect.arrayContaining(['tests']));
  expect(calls.some(g => ['tests', 'sql', 'court-runtime'].includes(g.id))).toBe(false);
  expect(fs.existsSync(path.join(root, '.tmp/validation/results/tests.json'))).toBe(false);
  expect(fs.existsSync(path.join(root, '.tmp/validation/results/focused-tests.json'))).toBe(true);
});
it('blocks export when the focused suite fails', async () => {
  const calls: string[] = [];
  const result = await validate({ root, ...options, small: true, build: true, report: () => {}, execute: async (_: unknown, gate: any) => { calls.push(gate.id); return gate.id !== 'focused-tests'; } });
  expect(result.passed).toBe(false);
  expect(calls).not.toContain('build');
  expect(fs.existsSync(path.join(root, '.tmp/validation/results/focused-tests.json'))).toBe(false);
});
it('does not hide changes to JavaScript string contents in the document shell', () => {
  write('app/+html.tsx', '<head><meta name="viewport" /></head> ');
  expect(() => smallReleasePlan(root, options)).toThrow('beyond the title');
});
