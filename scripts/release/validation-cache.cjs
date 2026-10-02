const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const digest = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.existsSync(file) ? fs.readFileSync(file) : Buffer.from('<missing>');
const fileDigest = file => fs.existsSync(file)
  ? digest(Buffer.concat([Buffer.from('file\0'), fs.readFileSync(file)]))
  : digest('missing\0');
const CACHE_VERSION = 1;
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function snapshot(root, env = process.env) {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(Boolean);
  // Git ignores must never hide a runtime input (for example an ignored asset or generated type).
  const visit = folder => {
    if (!fs.existsSync(path.join(root, folder))) return;
    for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__pycache__') continue;
      const name = `${folder}/${entry.name}`;
      if (entry.isDirectory()) visit(name);
      else paths.push(name);
    }
  };
  for (const folder of ['app', 'src', 'assets', 'public', 'scripts', 'supabase', 'patches', 'types', '.expo/types']) visit(folder);
  // Expo consumes ignored local environment files too. Only their digests stay in memory.
  paths.push(...fs.readdirSync(root).filter(name => /^\.env(?:\.|$)/.test(name)), 'expo-env.d.ts');
  const files = [...new Set(paths)].sort().map(name => [name, fileDigest(path.join(root, name))]);
  const dependencyFile = path.join(root, 'node_modules/.package-lock.json');
  if (!fs.existsSync(dependencyFile)) throw new Error('Run npm ci before validation (installed dependency lock missing).');
  const environment = Object.entries(env).filter(([name]) => !/^npm_|^INIT_CWD$|^OLDPWD$|^SHLVL$|^_$/.test(name)).sort();
  const context = digest(JSON.stringify({
    version: CACHE_VERSION, root, node: process.version, platform: process.platform, arch: process.arch,
    environment, dependencies: digest(read(dependencyFile)), installedAt: fs.statSync(dependencyFile).mtimeMs,
  }));
  return { files, context };
}

function fingerprint(state, gate) {
  const files = state.files.filter(([name]) => !gate.roots || !name.includes('/') ||
    name.startsWith('patches/') || name.startsWith('scripts/release/') || gate.roots.some(root => name.startsWith(root)));
  return digest(JSON.stringify([state.context, gate.id, gate.args, files]));
}

function outputDigest(root) {
  const directory = path.join(root, 'dist');
  if (!fs.existsSync(path.join(directory, 'index.html'))) return null;
  const hash = createHash('sha256');
  const visit = folder => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Unexpected symbolic link in build output.');
      if (entry.isDirectory()) visit(file);
      else hash.update(JSON.stringify([path.relative(directory, file), digest(read(file))]));
    }
  };
  visit(directory);
  return hash.digest('hex');
}

function reusable(record, key, now = Date.now(), output) {
  return Boolean(record && record.version === CACHE_VERSION && record.key === key &&
    record.status === 'passed' && Number.isFinite(record.at) && now >= record.at && now - record.at < MAX_AGE_MS &&
    (output === undefined || (output !== null && record.output === output)));
}

function readRecord(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeRecord(file, key, output) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ version: CACHE_VERSION, status: 'passed', key, at: Date.now(), output }));
  fs.renameSync(temporary, file);
}

module.exports = { snapshot, fingerprint, outputDigest, reusable, readRecord, writeRecord, MAX_AGE_MS };
