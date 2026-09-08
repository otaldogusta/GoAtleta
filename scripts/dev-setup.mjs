import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const checkOnly = process.argv.includes("--check");
const required = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.error || result.status !== 0) throw new Error(`${command} falhou. Confira a instalacao e tente novamente.`);
}
function config() {
  const values = { ...process.env };
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && values[match[1]] === undefined) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
  return values;
}

try {
  if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("Use Node.js 24.x; versao de referencia em .nvmrc.");
  run("git", ["--version"]);
  if (!checkOnly) {
    const local = path.join(root, ".env.local");
    if (!existsSync(local)) {
      writeFileSync(local, "# Preencha com a configuracao publica do projeto Supabase. Nunca use service_role.\nEXPO_PUBLIC_SUPABASE_URL=\nEXPO_PUBLIC_SUPABASE_ANON_KEY=\nEXPO_PUBLIC_NAV_V2=1\nEXPO_PUBLIC_WHATSAPP_DEFAULT_TEXT=true\n", { flag: "wx" });
      console.log("Criado .env.local sem credenciais. Arquivos existentes nunca sao sobrescritos.");
    }
    // npm_execpath is supplied by npm run and avoids shell-dependent npm.cmd execution.
    if (!process.env.npm_execpath) throw new Error("Execute com npm run dev:setup.");
    run(process.execPath, [process.env.npm_execpath, "ci"]);
  }
  const values = config();
  const missing = required.filter((key) => !values[key] || /your-|your_project|example|placeholder/i.test(values[key]));
  const dependenciesReady = existsSync(path.join(root, "node_modules", "expo", "package.json"));
  console.log(`Dependencias: ${dependenciesReady ? "OK" : "execute npm run dev:setup"}`);
  console.log(`Configuracao local: ${missing.length ? `preencha ${missing.join(", ")} em .env.local` : "OK (valores nao exibidos)"}`);
  console.log("Este comando nao aplica migracoes, nao publica e nao autentica contas.");
  if (missing.length || !dependenciesReady) process.exitCode = 1;
  else console.log("Pronto para iniciar: npm run dev:web");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
