/* eslint-disable no-console */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCREEN_FILE_RE = /^(app\/.+|src\/screens\/.+)\.(ts|tsx)$/;
const SKIP_RENDER_TAG = "perf-check: ignore-render";
const SKIP_MEASURE_TAG = "perf-check: ignore-measure";

function run(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function parseArgs(argv) {
  const args = [...argv];
  const files = [];
  let baseRef = "";

  while (args.length) {
    const token = args.shift();
    if (token === "--base") {
      baseRef = args.shift() || "";
      continue;
    }
    if (token === "--files") {
      while (args.length && !args[0].startsWith("--")) {
        files.push(toPosix(args.shift()));
      }
      continue;
    }
  }

  return { files, baseRef };
}

function listChangedFiles(baseRef) {
  const candidates = [
    baseRef,
    process.env.PERF_BASE_REF || "",
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "origin/main",
    "origin/master",
    "HEAD~1",
  ].filter(Boolean);

  for (const ref of candidates) {
    const hasRef = run(`git rev-parse --verify ${ref}`);
    if (!hasRef) continue;

    const command =
      ref.startsWith("HEAD~") || ref === "HEAD"
        ? `git diff --name-only ${ref} HEAD`
        : `git diff --name-only ${ref}...HEAD`;
    const out = run(command);
    if (!out) continue;
    return out
      .split(/\r?\n/)
      .map((line) => toPosix(line.trim()))
      .filter(Boolean);
  }

  return [];
}

function isCandidateScreenFile(filePath) {
  if (!SCREEN_FILE_RE.test(filePath)) return false;
  if (filePath.includes("/components/")) return false;
  if (filePath.includes("/__tests__/")) return false;
  return true;
}

function hasDefaultExportScreen(content) {
  return /export\s+default\s+function\s+/m.test(content);
}

function validateFile(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return null;

  const content = fs.readFileSync(absolute, "utf8");
  if (!hasDefaultExportScreen(content)) return null;

  const missing = [];
  const skipRender = content.includes(SKIP_RENDER_TAG);
  const skipMeasure = content.includes(SKIP_MEASURE_TAG);

  if (!skipRender && !/markRender\(\s*["'`]screen\./m.test(content)) {
    missing.push("markRender(\"screen.<feature>.render.<target>\")");
  }
  if (!skipMeasure && !/measureAsync\(/m.test(content)) {
    missing.push("measureAsync(\"screen.<feature>.load.<target>\", ...)");
  }

  if (!missing.length) return null;
  return { filePath, missing };
}

function main() {
  const { files: cliFiles, baseRef } = parseArgs(process.argv.slice(2));
  const changed = cliFiles.length ? cliFiles : listChangedFiles(baseRef);

  if (!changed.length) {
    console.log("[perf-hygiene] Nenhum arquivo alterado para validar.");
    process.exit(0);
  }

  const candidates = changed.filter(isCandidateScreenFile);
  if (!candidates.length) {
    console.log("[perf-hygiene] Sem telas alteradas no diff.");
    process.exit(0);
  }

  const violations = candidates
    .map(validateFile)
    .filter((entry) => Boolean(entry));

  if (!violations.length) {
    console.log(`[perf-hygiene] OK (${candidates.length} tela(s) validada(s)).`);
    process.exit(0);
  }

  console.error("[perf-hygiene] Falha: telas alteradas sem markers obrigatorios:\n");
  for (const violation of violations) {
    console.error(`- ${violation.filePath}`);
    for (const missing of violation.missing) {
      console.error(`  - faltando: ${missing}`);
    }
  }
  console.error(
    `\nUse "${SKIP_RENDER_TAG}" ou "${SKIP_MEASURE_TAG}" apenas quando houver justificativa tecnica.`
  );
  process.exit(1);
}

main();
