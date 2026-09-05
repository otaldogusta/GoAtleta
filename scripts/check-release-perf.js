const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');

// Every release uses an explicit resolvable commit; a shallow checkout must not
// silently report that there are no changed screens. Fetch history in the caller.
const reference = process.env.PERF_BASE_REF ||
  (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD~1');
let base;
try {
  base = execFileSync('git', ['rev-parse', '--verify', `${reference}^{commit}`], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (!/^[a-f0-9]{40,64}$/.test(base)) throw new Error('Invalid commit');
} catch {
  console.error('[release-perf] Missing comparison commit. Fetch Git history or set PERF_BASE_REF to an available base commit.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [
  path.join(__dirname, 'check-perf-hygiene.js'), '--strict', '--base', base, '--worktree',
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(typeof result.status === 'number' ? result.status : 1);
