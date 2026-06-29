/* eslint-disable no-console */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BYPASS_TAG = "ux-system: allow-raw-design-value";

const DESIGN_FILE_RE = /^(app|src)\/.*\.(ts|tsx)$/;
const ALLOWED_FILE_RE = /^(src\/theme\/tokens\.ts|src\/ui\/ux-tokens\.ts|src\/ui\/app-theme\.tsx|src\/ui\/figma-colors\.ts|src\/ui\/web-shell-tokens\.ts|src\/ui\/unit-colors\.tsx|src\/ui\/class-colors\.tsx)$/;
const ALLOWED_PREFIX_RE = /^(src\/pdf\/|src\/core\/.*__tests__\/|src\/.*\/__tests__\/|app\/.*__tests__\/)/;

const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/;
const RGBA_RE = /rgba?\s*\(/;
const SHADOW_RE = /\b(boxShadow|shadowColor|shadowOpacity|shadowRadius|shadowOffset)\b/;
const RADIUS_RE = /\bborderRadius\s*:\s*(\d+)\b/;
const FONT_SIZE_RE = /\bfontSize\s*:\s*(\d+)\b/;
const SPACING_PROP_RE =
  /\b(margin|marginTop|marginRight|marginBottom|marginLeft|marginHorizontal|marginVertical|padding|paddingTop|paddingRight|paddingBottom|paddingLeft|paddingHorizontal|paddingVertical|gap|rowGap|columnGap)\s*:\s*(\d+)\b/;

const ALLOWED_SPACING = new Set([0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80]);
const ALLOWED_FONT_SIZE = new Set([10, 11, 12, 14, 16, 20, 24]);
const ALLOWED_RADIUS = new Set([0, 3, 4, 6, 8, 12, 14, 16, 20, 999]);

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
    }
  }

  return { files, baseRef };
}

function listChangedFiles(baseRef) {
  const localDiff = [
    run("git diff --name-only"),
    run("git diff --cached --name-only"),
    run("git ls-files --others --exclude-standard"),
  ]
    .filter(Boolean)
    .join("\n");

  if (localDiff) {
    return Array.from(
      new Set(
        localDiff
          .split(/\r?\n/)
          .map((line) => toPosix(line.trim()))
          .filter(Boolean)
      )
    );
  }

  const candidates = [
    baseRef,
    process.env.UX_SYSTEM_BASE_REF || "",
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "origin/main",
    "origin/master",
    "HEAD~1",
  ].filter(Boolean);

  for (const ref of candidates) {
    if (!run(`git rev-parse --verify ${ref}`)) continue;
    const command =
      ref.startsWith("HEAD~") || ref === "HEAD"
        ? `git diff --name-only ${ref} HEAD`
        : `git diff --name-only ${ref}...HEAD`;
    const out = run(command);
    return out
      .split(/\r?\n/)
      .map((line) => toPosix(line.trim()))
      .filter(Boolean);
  }

  return [];
}

function getDiff(filePath, baseRef) {
  if (!run(`git ls-files --error-unmatch "${filePath}"`)) {
    const absolute = path.resolve(filePath);
    if (fs.existsSync(absolute)) {
      return fs
        .readFileSync(absolute, "utf8")
        .split(/\r?\n/)
        .map((line) => `+${line}`)
        .join("\n");
    }
  }

  const localDiff = [
    run(`git diff -U0 -- "${filePath}"`),
    run(`git diff --cached -U0 -- "${filePath}"`),
  ]
    .filter(Boolean)
    .join("\n");

  if (localDiff) return localDiff;

  const candidates = [
    baseRef,
    process.env.UX_SYSTEM_BASE_REF || "",
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "origin/main",
    "origin/master",
    "HEAD~1",
  ].filter(Boolean);

  for (const ref of candidates) {
    if (!run(`git rev-parse --verify ${ref}`)) continue;
    const command =
      ref.startsWith("HEAD~") || ref === "HEAD"
        ? `git diff -U0 ${ref} HEAD -- "${filePath}"`
        : `git diff -U0 ${ref}...HEAD -- "${filePath}"`;
    const out = run(command);
    return out;
  }

  return "";
}

function parseHunkAddedLineStart(line) {
  const match = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
  return match ? Number(match[1]) - 1 : null;
}

function isDesignFile(filePath) {
  return DESIGN_FILE_RE.test(filePath);
}

function isAllowedFile(filePath) {
  return ALLOWED_FILE_RE.test(filePath) || ALLOWED_PREFIX_RE.test(filePath);
}

function validateAddedLine(filePath, lineNumber, lineText) {
  if (lineText.includes(BYPASS_TAG)) return [];
  if (/^\s*\/\//.test(lineText)) return [];
  if (/^\s*['"`].*#/.test(lineText) && filePath.includes("/__tests__/")) return [];

  const violations = [];
  const radiusMatch = lineText.match(RADIUS_RE);
  const fontSizeMatch = lineText.match(FONT_SIZE_RE);
  const spacingMatch = lineText.match(SPACING_PROP_RE);

  if (HEX_COLOR_RE.test(lineText)) {
    violations.push("raw hex color");
  }
  if (RGBA_RE.test(lineText)) {
    violations.push("raw rgba/rgb color");
  }
  if (SHADOW_RE.test(lineText)) {
    violations.push("raw shadow/elevation");
  }
  if (radiusMatch && !ALLOWED_RADIUS.has(Number(radiusMatch[1]))) {
    violations.push(`borderRadius fora da escala (${radiusMatch[1]})`);
  }
  if (fontSizeMatch && !ALLOWED_FONT_SIZE.has(Number(fontSizeMatch[1]))) {
    violations.push(`fontSize fora da escala (${fontSizeMatch[1]})`);
  }
  if (spacingMatch && !ALLOWED_SPACING.has(Number(spacingMatch[2]))) {
    violations.push(`${spacingMatch[1]} fora da escala (${spacingMatch[2]})`);
  }

  return violations.map((reason) => ({
    filePath,
    lineNumber,
    reason,
    snippet: lineText.trim(),
  }));
}

function validateFile(filePath, baseRef) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return [];
  if (!isDesignFile(filePath) || isAllowedFile(filePath)) return [];

  const diff = getDiff(filePath, baseRef);
  if (!diff) return [];

  const violations = [];
  let addedLine = 0;

  for (const rawLine of diff.split(/\r?\n/)) {
    if (rawLine.startsWith("@@")) {
      const next = parseHunkAddedLineStart(rawLine);
      if (next !== null) addedLine = next;
      continue;
    }
    if (!rawLine || rawLine.startsWith("+++") || rawLine.startsWith("---")) continue;
    if (!rawLine.startsWith("+")) continue;

    addedLine += 1;
    const lineText = rawLine.slice(1);
    violations.push(...validateAddedLine(filePath, addedLine, lineText));
  }

  return violations;
}

function main() {
  const { files, baseRef } = parseArgs(process.argv.slice(2));
  const changed = files.length ? files : listChangedFiles(baseRef);

  if (!changed.length) {
    console.log("[ux-system] Nenhum arquivo alterado para validar.");
    return;
  }

  const violations = changed.flatMap((filePath) => validateFile(filePath, baseRef));

  if (!violations.length) {
    console.log(`[ux-system] OK (${changed.length} arquivo(s) avaliado(s)).`);
    return;
  }

  console.error("[ux-system] Valores visuais raw adicionados fora dos tokens:\n");
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.lineNumber} (${violation.reason})`);
    console.error(`  + ${violation.snippet}`);
  }
  console.error("\nUse tokens em src/theme/tokens.ts ou src/ui/ux-tokens.ts.");
  console.error(`Bypass permitido somente com justificativa na linha: ${BYPASS_TAG}`);
  process.exit(1);
}

main();
