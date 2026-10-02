const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { snapshot, fingerprint, outputDigest, reusable, readRecord, writeRecord } = require('./validation-cache.cjs');

// Keep the complete release contract explicit. CI never trusts local pass receipts.
const gates = [
  { id: 'lint', args: ['scripts/check-lint-hygiene.js'], roots: ['app/', 'src/', 'scripts/'] },
  { id: 'types', args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app-check.json', '--noEmit'], roots: ['app/', 'src/'] },
  { id: 'tests', args: ['node_modules/jest/bin/jest.js', '--passWithNoTests', '--runInBand'] },
  { id: 'sql', args: ['scripts/validation/run-sql-tests.mjs'], roots: ['supabase/', 'scripts/'] },
  ...[
    ['encoding', 'check-encoding.js'], ['brand', 'check-brand-name.js'], ['jwt', 'check-edge-jwt.js'],
    ['org-scope', 'check-org-scope.js'], ['assets', 'check-image-signatures.js'],
    ['architecture', 'check-architecture-hygiene.js', '--strict'], ['performance', 'check-release-perf.js'],
  ].map(([id, script, ...args]) => ({ id, args: [`scripts/${script}`, ...args], always: true })),
];
const buildGate = { id: 'build', args: ['node_modules/expo/bin/cli', 'export', '-p', 'web', '--max-workers', '2'] };

async function pool(items, jobs, execute) {
  let next = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try { results[index] = await execute(items[index]); }
      catch (error) { results[index] = { id: items[index].id, status: 'failed', error: error.message }; }
    }
  }));
  return results;
}

function runProcess(root, gate, logFile, children, env) {
  return new Promise((resolve, reject) => {
    const log = fs.createWriteStream(logFile, { flags: 'w' });
    const child = spawn(process.execPath, gate.args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    children.add(child);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', reject);
    child.on('close', code => {
      children.delete(child);
      log.end(() => resolve(code === 0));
    });
    log.on('error', reject);
  });
}

async function validate({ root, jobs = 2, fresh = false, build = false, env = process.env,
  execute = runProcess, report = console.log } = {}) {
  const directory = path.join(root, '.tmp/validation');
  fs.mkdirSync(directory, { recursive: true });
  const lock = path.join(directory, 'running.lock');
  let lockFd;
  try { lockFd = fs.openSync(lock, 'wx'); }
  catch { throw new Error('Validation already running, or stale .tmp/validation/running.lock. Check the recorded PID before removing the lock.'); }
  fs.writeFileSync(lockFd, String(process.pid));
  const children = new Set();
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
    for (const child of children) {
      if (process.platform === 'win32' && child.pid) execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
      else child.kill();
    }
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const initial = snapshot(root, env);
    const reuse = !fresh && !env.CI && !env.GITHUB_ACTIONS;
    const started = Date.now();
    const run = async gate => {
      if (interrupted) return { id: gate.id, status: 'failed', error: 'Interrupted' };
      const key = fingerprint(initial, gate);
      const receipt = path.join(directory, 'results', `${gate.id}.json`);
      const artifact = gate.id === 'build' ? outputDigest(root) : undefined;
      if (reuse && !gate.always && reusable(readRecord(receipt), key, Date.now(), artifact)) {
        report(`[validation] ${gate.id}: reused (unchanged inputs)`);
        return { id: gate.id, status: 'reused', key };
      }
      // A failed or interrupted attempt must not leave an earlier success reusable.
      fs.rmSync(receipt, { force: true });
      const logFile = path.join(directory, `${gate.id}.log`);
      report(`[validation] ${gate.id}: running`);
      const begin = Date.now();
      const passed = await execute(root, gate, logFile, children, env);
      const seconds = Math.round((Date.now() - begin) / 1000);
      report(`[validation] ${gate.id}: ${passed ? 'passed' : 'FAILED'} (${seconds}s)${passed ? '' : ` — ${path.relative(root, logFile)}`}`);
      return { id: gate.id, status: passed && !interrupted ? 'passed' : 'failed', key, seconds,
        output: passed && gate.id === 'build' ? outputDigest(root) : undefined };
    };
    const results = await pool(gates, jobs, run);
    if (build && results.every(result => result.status !== 'failed')) results.push(await run(buildGate));
    const final = snapshot(root, env);
    const changed = fingerprint(initial, { id: 'snapshot' }) !== fingerprint(final, { id: 'snapshot' });
    if (changed) report('[validation] Inputs changed during validation; results cannot authorize this working tree. Run again.');
    for (const result of results) {
      if (!changed && !interrupted && result.status === 'passed' && !env.CI && !env.GITHUB_ACTIONS) {
        writeRecord(path.join(directory, 'results', `${result.id}.json`), result.key, result.output);
      }
      if (result.error) report(`[validation] ${result.id}: ${result.error}`);
    }
    const passed = !changed && !interrupted && results.every(result => result.status !== 'failed');
    report(`[validation] ${passed ? 'PASSED' : 'FAILED'} in ${Math.round((Date.now() - started) / 1000)}s. ${results.filter(r => r.status === 'reused').length} reused. Logs: .tmp/validation`);
    return { passed, changed, results };
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    fs.closeSync(lockFd);
    fs.rmSync(lock, { force: true });
  }
}

function parseArgs(args) {
  const options = {};
  for (const arg of args) {
    if (arg === '--build') options.build = true;
    else if (arg === '--fresh') options.fresh = true;
    else if (/^--jobs=[12]$/.test(arg)) options.jobs = Number(arg.split('=')[1]);
    else throw new Error(`Unknown option: ${arg}. Use --build, --fresh or --jobs=1|2.`);
  }
  return options;
}

if (require.main === module) {
  Promise.resolve().then(() => validate({ root: path.resolve(__dirname, '../..'), ...parseArgs(process.argv.slice(2)) }))
    .then(result => { process.exitCode = result.passed ? 0 : 1; })
    .catch(error => { console.error(`[validation] ${error.message}`); process.exitCode = 1; });
}
module.exports = { gates, buildGate, pool, validate, parseArgs, runProcess };
