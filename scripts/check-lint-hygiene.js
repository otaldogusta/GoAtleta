const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { ESLint } = require('eslint');
const { collectErrors, compareBaseline, buildEntries, canPassBaseline } = require('./lint-hygiene/baseline');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const baselinePath = path.join(__dirname, 'lint-hygiene-baseline.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const cacheContext = createHash('sha256').update(process.version);
  // ESLint invalidates changed file contents itself. Invalidate the whole cache
  // for dependency/config changes or file additions/removals that affect imports.
  for (const file of ['package-lock.json', 'eslint.config.js', 'scripts/check-lint-hygiene.js']) {
    cacheContext.update(fs.readFileSync(path.join(rootDir, file)));
  }
  for (const folder of ['app', 'src', 'patches']) {
    const names = fs.readdirSync(path.join(rootDir, folder), { recursive: true }).sort();
    cacheContext.update(JSON.stringify([folder, names]));
    if (folder === 'patches') for (const name of names) {
      const file = path.join(rootDir, folder, name);
      if (fs.statSync(file).isFile()) cacheContext.update(fs.readFileSync(file));
    }
  }
  const eslint = new ESLint({
    cwd: rootDir,
    cache: true,
    cacheStrategy: 'content',
    cacheLocation: path.join(rootDir, `.tmp/validation/eslint/${cacheContext.digest('hex')}.cache`),
  });
  const results = await eslint.lintFiles(['app', 'src']);
  const errors = collectErrors(results, rootDir);
  const delta = compareBaseline(errors, baseline);
  const { added, resolved } = delta;
  const prune = process.argv.includes('--prune');
  const warnings = results.reduce((total, result) => total + result.warningCount, 0);
  console.log(`[lint-hygiene] ${errors.length} known errors; ${added.length} new; ${resolved} resolved; ${warnings} warnings.`);
  for (const error of added) console.error(`- ${error.file}:${error.line} [${error.rule}] ${error.anchor.slice(0, 180)}`);
  if (warnings) {
    for (const result of results) {
      for (const message of result.messages.filter(item => item.severity === 1)) {
        console.error(`- ${path.relative(rootDir, result.filePath)}:${message.line} [${message.ruleId}] ${message.message}`);
      }
    }
    console.error('Fix lint warnings before release; the application warning budget is zero.');
    process.exitCode = 1;
  }
  if (!canPassBaseline(delta, prune)) {
    console.error(added.length
      ? 'Fix new errors; the baseline must not grow. Run npm run lint for complete diagnostics.'
      : 'Remove resolved debt with npm run check:lint-hygiene -- --prune and include the reduced baseline.');
    process.exitCode = 1;
    return;
  }
  if (prune) {
    fs.writeFileSync(baselinePath, `${JSON.stringify({ ...baseline, entries: buildEntries(errors) }, null, 2)}\n`);
    console.log(`[lint-hygiene] Removed ${resolved} resolved diagnostics from the baseline.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
