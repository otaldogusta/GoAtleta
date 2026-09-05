const { createHash } = require('node:crypto');
const path = require('node:path');

function collectErrors(results, rootDir) {
  const errors = [];
  for (const result of results) {
    const file = path.relative(rootDir, result.filePath).replace(/\\/g, '/');
    const lines = (result.source || '').split(/\r?\n/);
    for (const message of result.messages) {
      if (message.severity !== 2) continue;
      const firstLine = (message.line || 1) - 1;
      const lastLine = (message.endLine || message.line || 1) - 1;
      const excerpt = lines.slice(firstLine, lastLine + 1);
      if (excerpt.length) {
        if (message.endColumn) excerpt[excerpt.length - 1] = excerpt[excerpt.length - 1].slice(0, message.endColumn - 1);
        excerpt[0] = excerpt[0].slice((message.column || 1) - 1);
      }
      const anchor = excerpt.join('\n').replace(/\s+/g, ' ').trim();
      const summary = message.message.split('\n\n')[0].replace(/\s+/g, ' ').trim();
      const rule = message.ruleId || 'parser';
      const fingerprint = createHash('sha256').update(JSON.stringify([file, rule, summary, anchor])).digest('hex');
      errors.push({ file, rule, fingerprint, anchor, line: message.line || 1, fatal: Boolean(message.fatal) });
    }
  }
  return errors;
}

function compareBaseline(errors, baseline) {
  const remaining = new Map(baseline.entries.map((entry) => [entry.fingerprint, entry.count]));
  const added = [];
  for (const error of errors) {
    const count = remaining.get(error.fingerprint) || 0;
    if (error.fatal || count < 1) added.push(error);
    else remaining.set(error.fingerprint, count - 1);
  }
  const resolved = baseline.entries.reduce((total, entry) => total + (remaining.get(entry.fingerprint) || 0), 0);
  return { added, resolved };
}

function buildEntries(errors) {
  const entries = new Map();
  for (const { file, rule, fingerprint, anchor } of errors) {
    const entry = entries.get(fingerprint);
    if (entry) entry.count += 1;
    else entries.set(fingerprint, { file, rule, fingerprint, anchor: anchor.slice(0, 160), count: 1 });
  }
  return [...entries.values()].sort((a, b) => a.file.localeCompare(b.file) || a.fingerprint.localeCompare(b.fingerprint));
}

function canPassBaseline(delta, prune = false) {
  return delta.added.length === 0 && (prune || delta.resolved === 0);
}

module.exports = { collectErrors, compareBaseline, buildEntries, canPassBaseline };
