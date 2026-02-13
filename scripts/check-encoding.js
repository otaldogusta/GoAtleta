"use strict";

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const VALID_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
const IGNORE_DIRS = new Set([
  ".git",
  ".expo",
  ".next",
  "android",
  "build",
  "dist",
  "ios",
  "node_modules",
  "tmp",
]);
const IGNORE_FILES = new Set(["scripts/check-encoding.js"]);

const MOJIBAKE_TOKENS = [
  "Ã¡",
  "Ã¢",
  "Ã£",
  "Ã¤",
  "Ã§",
  "Ã©",
  "Ãª",
  "Ã­",
  "Ã³",
  "Ã´",
  "Ãµ",
  "Ãº",
  "Ã€",
  "Ã“",
  "Ã‡",
  "Âº",
  "Âª",
  "Â ",
  "â€™",
  "â€œ",
  "â€",
  "â€“",
  "â€”",
];

const UNICODE_ESCAPE_LITERAL_REGEX = /\\\\u00[0-9a-fA-F]{2}/;

function toPosixPath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
}

function getLineColumn(content, index) {
  const slice = content.slice(0, index);
  const lines = slice.split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

function findFirstMojibakeToken(content) {
  let best = null;
  for (const token of MOJIBAKE_TOKENS) {
    const index = content.indexOf(token);
    if (index === -1) continue;
    if (!best || index < best.index) {
      best = { token, index };
    }
  }
  return best;
}

function scanFile(filePath, issues) {
  const relativePath = toPosixPath(filePath);
  if (IGNORE_FILES.has(relativePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  const replacementIndex = content.indexOf("\uFFFD");
  if (replacementIndex >= 0) {
    const pos = getLineColumn(content, replacementIndex);
    issues.push(`${toPosixPath(filePath)}:${pos.line}:${pos.column} - caractere de substituicao (U+FFFD)`);
  }

  const escapeMatch = content.match(UNICODE_ESCAPE_LITERAL_REGEX);
  if (escapeMatch && typeof escapeMatch.index === "number") {
    const pos = getLineColumn(content, escapeMatch.index);
    issues.push(
      `${toPosixPath(filePath)}:${pos.line}:${pos.column} - escape unicode literal (\\\\u00..) encontrado`
    );
  }

  const mojibakeMatch = findFirstMojibakeToken(content);
  if (mojibakeMatch) {
    const pos = getLineColumn(content, mojibakeMatch.index);
    issues.push(
      `${toPosixPath(filePath)}:${pos.line}:${pos.column} - padrao de mojibake detectado (${mojibakeMatch.token})`
    );
  }
}

function walk(dirPath, issues) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(fullPath, issues);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!VALID_EXTENSIONS.has(extension)) continue;
    scanFile(fullPath, issues);
  }
}

function main() {
  const issues = [];
  walk(ROOT_DIR, issues);

  if (issues.length > 0) {
    console.error("Encoding check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("Encoding check passed.");
}

main();
