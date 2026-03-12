/* eslint-disable no-console */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function isCsv(filePath) {
  return filePath.toLowerCase().endsWith(".csv");
}

function walkCsvFiles(dir, acc) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkCsvFiles(fullPath, acc);
      continue;
    }
    if (!entry.isFile() || !isCsv(fullPath)) continue;
    acc.push(fullPath);
  }
}

function pickLatestIntakeCsv() {
  const userHome = process.env.USERPROFILE || process.env.HOME || "";
  const candidatesRoots = [
    path.join(userHome, "Desktop"),
    path.join(userHome, "OneDrive", "Desktop"),
    path.join(userHome, "OneDrive", "Área de Trabalho"),
    path.join(userHome, "OneDrive", "Area de Trabalho"),
    path.join(process.cwd(), "data", "imports"),
  ];

  const files = [];
  for (const root of candidatesRoots) {
    walkCsvFiles(root, files);
  }

  const intakeCandidates = files
    .filter((filePath) => {
      const name = path.basename(filePath).toLowerCase();
      return (
        name.includes("anamnese") ||
        name.includes("intake") ||
        name.includes("triagem")
      );
    })
    .map((filePath) => {
      const stat = fs.statSync(filePath);
      return { filePath, ms: stat.mtimeMs };
    })
    .sort((a, b) => b.ms - a.ms);

  return intakeCandidates[0]?.filePath || "";
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Uso: npm run intake:auto -- [<csvPath>] [--upsert] [--class-id <id> | --class-id-feminino <id> --class-id-masculino <id>] [--organization-id <id>]");
    console.log("Dica: sem <csvPath>, o script detecta automaticamente o CSV mais recente de anamnese.");
    process.exit(0);
  }

  const flagsWithValue = new Set([
    "--class-id",
    "--class-id-feminino",
    "--class-id-masculino",
    "--organization-id",
    "--supabase-url",
    "--service-role-key",
  ]);
  let explicitPath = "";
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      if (flagsWithValue.has(arg)) i += 1;
      continue;
    }
    explicitPath = arg;
    break;
  }
  const csvPath = explicitPath || process.env.INTAKE_CSV_PATH || pickLatestIntakeCsv();

  if (!csvPath) {
    console.error(
      "Nenhum CSV de anamnese encontrado automaticamente. Informe INTAKE_CSV_PATH ou passe o caminho no comando."
    );
    process.exit(1);
  }

  const passThroughFlags = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      if (arg === explicitPath) continue;
      continue;
    }
    passThroughFlags.push(arg);
    if (
      arg === "--class-id" ||
      arg === "--class-id-feminino" ||
      arg === "--class-id-masculino" ||
      arg === "--organization-id" ||
      arg === "--supabase-url" ||
      arg === "--service-role-key"
    ) {
      const value = args[i + 1] || "";
      if (value && !value.startsWith("--")) {
        passThroughFlags.push(value);
        i += 1;
      }
    }
  }

  const importerArgs = ["scripts/import-athlete-intake.js", csvPath, ...passThroughFlags];

  console.log(`CSV detectado: ${csvPath}`);
  const result = spawnSync("node", importerArgs, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
    shell: false,
  });

  if (result.error) {
    console.error("Falha ao executar importador:", result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

main();
