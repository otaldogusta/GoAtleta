const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const roots = [
  "app",
  "src",
  "public",
  "docs",
  "supabase/functions",
  "supabase/templates",
];
const rootFiles = ["README.md", "app.config.js"];
const supportedExtensions = new Set([
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
]);
const excludedSegments = new Set(["archive", "node_modules"]);

const technicalAllowList = [
  /GoAtleta\/1\.0/g,
  /X-GoAtleta-/g,
  /GoAtleta\.git/g,
  /(?:^|[\\/])GoAtleta(?=[\\/]|$)/g,
  /\bcd GoAtleta\b/g,
];

const files = [];
const visit = (target) => {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (supportedExtensions.has(path.extname(target))) files.push(target);
    return;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedSegments.has(entry.name)) continue;
    visit(path.join(target, entry.name));
  }
};

for (const relative of roots) visit(path.join(root, relative));
for (const relative of rootFiles) visit(path.join(root, relative));

const failures = [];
for (const file of files) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/GoAtleta\b/.test(line)) return;
    const remaining = technicalAllowList.reduce(
      (value, allowed) => value.replace(allowed, ""),
      line,
    );
    if (/GoAtleta\b/.test(remaining)) {
      failures.push(`${relative}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (failures.length > 0) {
  console.error('Nome público inválido. Use "Go Atleta" com espaço:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Brand name check passed: public name is "Go Atleta".');
