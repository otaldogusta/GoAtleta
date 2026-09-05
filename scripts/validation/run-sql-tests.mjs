import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const directory = new URL('./', import.meta.url);
const scripts = readdirSync(directory).filter((file) => file.endsWith('-sql.mjs')).sort();
if (!scripts.length) throw new Error('No SQL regression suites found');
for (const script of scripts) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, directory))], {
    stdio: 'inherit', timeout: 120000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`[sql-tests] ${scripts.length} PostgreSQL suites passed without a remote connection.`);
