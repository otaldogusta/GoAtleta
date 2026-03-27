"use strict";

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const VALID_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
const IGNORE_DIRS = new Set([
  ".git",
  ".expo",
  ".expo-web-build-check",
  ".expo-web-build-check2",
  ".next",
  "android",
  "build",
  "dist",
  "ios",
  "node_modules",
  "tmp",
]);
const IGNORE_FILES = new Set(["scripts/check-encoding.js"]);

const MOJIBAKE_PATTERNS = [
  { token: "Ã¡", bytes: [0xc3, 0x83, 0xc2, 0xa1] },
  { token: "Ã¢", bytes: [0xc3, 0x83, 0xc2, 0xa2] },
  { token: "Ã£", bytes: [0xc3, 0x83, 0xc2, 0xa3] },
  { token: "Ã§", bytes: [0xc3, 0x83, 0xc2, 0xa7] },
  { token: "Ã©", bytes: [0xc3, 0x83, 0xc2, 0xa9] },
  { token: "Ãª", bytes: [0xc3, 0x83, 0xc2, 0xaa] },
  { token: "Ã­", bytes: [0xc3, 0x83, 0xc2, 0xad] },
  { token: "Ã³", bytes: [0xc3, 0x83, 0xc2, 0xb3] },
  { token: "Ã´", bytes: [0xc3, 0x83, 0xc2, 0xb4] },
  { token: "Ãµ", bytes: [0xc3, 0x83, 0xc2, 0xb5] },
  { token: "Ãº", bytes: [0xc3, 0x83, 0xc2, 0xba] },
  { token: "Âº", bytes: [0xc3, 0x82, 0xc2, 0xba] },
  { token: "Âª", bytes: [0xc3, 0x82, 0xc2, 0xaa] },
  { token: "ðŸ", bytes: [0xc3, 0xb0, 0xc5, 0xb8] },
  { token: "â€™", bytes: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x84, 0xa2] },
  { token: "â€œ", bytes: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc5, 0x93] },
  { token: "â€", bytes: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0x9d] },
  { token: "â€“", bytes: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0x93] },
  { token: "â€”", bytes: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0x94] },
];

const UNICODE_ESCAPE_LITERAL_REGEX = /\\\\u00[0-9a-fA-F]{2}/;

function toPosixPath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
}

function getLineColumnFromBuffer(buffer, index) {
  const slice = buffer.slice(0, index).toString("utf8");
  const lines = slice.split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

function findPatternIndex(buffer, pattern) {
  const needle = Buffer.from(pattern.bytes);
  return buffer.indexOf(needle);
}

function findFirstMojibakePattern(buffer) {
  let best = null;
  for (const candidate of MOJIBAKE_PATTERNS) {
    const index = findPatternIndex(buffer, candidate);
    if (index === -1) continue;
    if (!best || index < best.index) {
      best = { token: candidate.token, index };
    }
  }
  return best;
}

function scanFile(filePath, issues) {
  const relativePath = toPosixPath(filePath);
  if (IGNORE_FILES.has(relativePath)) return;

  const buffer = fs.readFileSync(filePath);
  const content = buffer.toString("utf8");

  const replacementIndex = content.indexOf("\uFFFD");
  if (replacementIndex >= 0) {
    const pos = getLineColumnFromBuffer(buffer, Buffer.from(content.slice(0, replacementIndex), "utf8").length);
    issues.push(
      `${toPosixPath(filePath)}:${pos.line}:${pos.column} - caractere de substituicao (U+FFFD)`
    );
  }

  const escapeMatch = content.match(UNICODE_ESCAPE_LITERAL_REGEX);
  if (escapeMatch && typeof escapeMatch.index === "number") {
    const pos = getLineColumnFromBuffer(buffer, Buffer.from(content.slice(0, escapeMatch.index), "utf8").length);
    issues.push(
      `${toPosixPath(filePath)}:${pos.line}:${pos.column} - escape unicode literal (\\\\u00..) encontrado`
    );
  }

  const mojibakeMatch = findFirstMojibakePattern(buffer);
  if (mojibakeMatch) {
    const pos = getLineColumnFromBuffer(buffer, mojibakeMatch.index);
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
