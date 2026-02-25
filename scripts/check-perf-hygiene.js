/* eslint-disable no-console */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCREEN_FILE_RE = /^(app\/.+|src\/screens\/.+)\.(ts|tsx)$/;
const SKIP_RENDER_TAG = "perf-check: ignore-render";
const SKIP_MEASURE_TAG = "perf-check: ignore-measure";
const SKIP_INLINE_ROW_STYLE_TAG = "perf-check: ignore-inline-row-style";

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
  let strict = false;

  while (args.length) {
    const token = args.shift();
    if (token === "--base") {
      baseRef = args.shift() || "";
      continue;
    }
    if (token === "--strict") {
      strict = true;
      continue;
    }
    if (token === "--files") {
      while (args.length && !args[0].startsWith("--")) {
        files.push(toPosix(args.shift()));
      }
      continue;
    }
  }

  return { files, baseRef, strict };
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

function getDiffForFile(filePath, baseRef) {
  const normalized = toPosix(filePath);
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
        ? `git diff -U14 ${ref} HEAD -- "${normalized}"`
        : `git diff -U14 ${ref}...HEAD -- "${normalized}"`;
    const out = run(command);
    if (out) return out;
  }

  return "";
}

function parseHunkAddedLineStart(line) {
  const match = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
  if (!match) return null;
  return Number(match[1]);
}

function validateInlineRowStyles(filePath, baseRef) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return [];

  const content = fs.readFileSync(absolute, "utf8");
  if (content.includes(SKIP_INLINE_ROW_STYLE_TAG)) return [];
  if (!hasDefaultExportScreen(content)) return [];

  const diff = getDiffForFile(filePath, baseRef);
  if (!diff) return [];

  const lines = diff.split(/\r?\n/);
  const violations = [];
  const contextWindow = [];
  let addedLine = 0;

  for (const rawLine of lines) {
    if (!rawLine) continue;

    if (rawLine.startsWith("@@")) {
      const start = parseHunkAddedLineStart(rawLine);
      addedLine = Number.isFinite(start) ? Number(start) - 1 : addedLine;
      contextWindow.length = 0;
      continue;
    }
    if (rawLine.startsWith("diff --git") || rawLine.startsWith("index ")) {
      continue;
    }

    const marker = rawLine[0];
    const lineText = rawLine.slice(1);

    if (marker === " ") {
      addedLine += 1;
      contextWindow.push(lineText);
      if (contextWindow.length > 20) contextWindow.shift();
      continue;
    }

    if (marker === "-") {
      contextWindow.push(lineText);
      if (contextWindow.length > 20) contextWindow.shift();
      continue;
    }

    if (marker !== "+" || rawLine.startsWith("+++")) continue;

    addedLine += 1;
    const contextText = contextWindow.join("\n");
    const hasInlineStyle = /style\s*=\s*\{\s*\{/.test(lineText);
    const inListContext =
      /\.map\s*\(/.test(contextText) ||
      /renderItem\s*=/.test(contextText) ||
      /\.map\s*\(/.test(lineText) ||
      /renderItem\s*=/.test(lineText);

    if (hasInlineStyle && inListContext) {
      violations.push({
        filePath,
        line: addedLine,
        snippet: lineText.trim(),
      });
    }

    contextWindow.push(lineText);
    if (contextWindow.length > 20) contextWindow.shift();
  }

  return violations;
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
  const { files: cliFiles, baseRef, strict } = parseArgs(process.argv.slice(2));
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

  const strictViolations = strict
    ? candidates.flatMap((filePath) => validateInlineRowStyles(filePath, baseRef))
    : [];

  if (!violations.length && !strictViolations.length) {
    console.log(
      `[perf-hygiene] OK (${candidates.length} tela(s) validada(s)${strict ? ", modo strict" : ""}).`
    );
    process.exit(0);
  }

  if (violations.length) {
    console.error("[perf-hygiene] Falha: telas alteradas sem markers obrigatorios:\n");
    for (const violation of violations) {
      console.error(`- ${violation.filePath}`);
      for (const missing of violation.missing) {
        console.error(`  - faltando: ${missing}`);
      }
    }
  }

  if (strictViolations.length) {
    console.error("\n[perf-hygiene] Falha strict: inline style adicionado em contexto de row/lista:\n");
    for (const violation of strictViolations) {
      console.error(`- ${violation.filePath}:${violation.line}`);
      console.error(`  + ${violation.snippet}`);
    }
  }

  console.error("\nBypass tags permitidas (somente com justificativa tecnica):");
  console.error(`- ${SKIP_RENDER_TAG}`);
  console.error(`- ${SKIP_MEASURE_TAG}`);
  console.error(`- ${SKIP_INLINE_ROW_STYLE_TAG}`);
  process.exit(1);
}

main();
