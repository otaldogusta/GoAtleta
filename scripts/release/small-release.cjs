const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const fail = message => { throw new Error(`Small release: ${message}. Use build:verified for the full release.`); };
const testFile = name => /(?:^|\/)(?:__tests__\/.*|[^/]+\.(?:test|spec))\.[cm]?[jt]sx?$/.test(name);
const docFile = name => /^docs\/.*\.(?:md|html)$/.test(name) || name === 'docs/product/build_inventory.py';
const uiFile = name => /^src\/(?:components|screens|ui)\/.*\.(?:tsx|css)$/.test(name);

function smallReleasePlan(root, { base, tests = [], env = process.env } = {}) {
  if (env.CI || env.GITHUB_ACTIONS) fail('the small profile is local only; CI must run every gate');
  if (!base || !tests.length) fail('provide --base=<validated-commit> and at least one --test=<existing-test-path>');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const revision = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
  git(['merge-base', '--is-ancestor', revision, 'HEAD']);
  const changed = [...new Set([
    ...git(['diff', '--name-only', '-z', revision, '--']).split('\0'),
    ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0'),
  ].filter(Boolean))];
  if (!changed.length) fail('no changes found against the supplied base');
  const code = [];
  for (const name of changed) {
    if (!fs.existsSync(path.join(root, name))) fail(`deleted file ${name}`);
    if (docFile(name) || testFile(name)) continue;
    if (/(?:auth|login|signup|reset-password|permission|access|navigation|routing)/i.test(name)) fail(`sensitive UI path ${name}`);
    if (!uiFile(name) && name !== 'app/+html.tsx') fail(`protected or unsupported path ${name}`);
    const content = fs.readFileSync(path.join(root, name), 'utf8');
    let previous;
    try { previous = git(['show', `${revision}:${name}`]); } catch { fail(`new application file ${name}`); }
    const patch = git(['diff', '--unified=0', revision, '--', name]);
    const lines = patch.split('\n').filter(line => /^[+-](?![+-])/.test(line));
    if (lines.length > 80) fail(`patch too large in ${name}`);
    if (name === 'app/+html.tsx') {
      const withoutTitle = text => text.replace(/[ \t]*<title(?:\s[^>]*)?>[\s\S]*?<\/title>[ \t]*(?:\r?\n)?/g, '').replace(/\r\n/g, '\n');
      if (withoutTitle(previous) !== withoutTitle(content)) fail('document-shell changes extend beyond the title');
    } else if (lines.some(line => /\b(?:import|export|const|let|function|return|if|switch|while|for|throw|try|new|async|await|fetch|use[A-Z]\w*|on[A-Z]\w*|router|navigation|supabase)\b|=>/.test(line.slice(1)))) {
      fail(`behavior or structural changes need full review in ${name}`);
    }
    code.push(name);
  }
  if (!code.length || code.length > 5) fail('expected one to five existing presentation files');
  const testPaths = [...new Set(tests)];
  for (const name of testPaths) {
    const absolute = path.resolve(root, name);
    if (!testFile(name) || name.includes('\\') || path.isAbsolute(name) || path.relative(root, absolute).startsWith('..') || !fs.existsSync(absolute)) fail(`invalid test path ${name}`);
  }
  return { base: revision, changed, code, tests: testPaths };
}

module.exports = { smallReleasePlan };
