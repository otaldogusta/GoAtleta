import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep the pre-existing hosted schema in the normal SQL/CI regression gates.
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('./scouting-rallies-sql.mjs', import.meta.url)), '--hosted-compat',
], { stdio: 'inherit', timeout: 120000, windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
