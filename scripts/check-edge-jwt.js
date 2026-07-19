#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const configPath = path.resolve(process.cwd(), "supabase", "config.toml");
if (!fs.existsSync(configPath)) {
  console.error(`Missing file: ${configPath}`);
  process.exit(1);
}

const content = fs.readFileSync(configPath, "utf8");

const parseFunctions = (toml) => {
  const lines = toml.split(/\r?\n/);
  const functions = {};
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^\[functions\.([^\]]+)\]$/);
    if (header) {
      current = header[1];
      functions[current] = functions[current] || {};
      continue;
    }
    if (!current) continue;
    const kv = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1];
    const valueRaw = kv[2].trim();
    if (valueRaw === "true" || valueRaw === "false") {
      functions[current][key] = valueRaw === "true";
    } else {
      functions[current][key] = valueRaw.replace(/^"(.*)"$/, "$1");
    }
  }
  return functions;
};

const functions = parseFunctions(content);

const requiredJwtTrue = [
  "assistant",
  "create-student-invite",
  "claim-student-invite",
  "revoke-student-access",
  "rules-sync",
  "rules-sync-admin",
  "students-import",
];

const intentionallyPublic = [
  "invite-link",
  "auto-link-student",
  "document-drive-oauth",
];

const selfAuthenticated = [
  "claim-trainer-invite",
];

const errors = [];
for (const fnName of requiredJwtTrue) {
  if (!Object.prototype.hasOwnProperty.call(functions, fnName)) {
    errors.push(`Missing section [functions.${fnName}]`);
    continue;
  }
  if (functions[fnName].verify_jwt !== true) {
    errors.push(`[functions.${fnName}] must set verify_jwt = true`);
  }
}

for (const fnName of intentionallyPublic) {
  if (!Object.prototype.hasOwnProperty.call(functions, fnName)) {
    errors.push(`Missing section [functions.${fnName}]`);
    continue;
  }
  if (functions[fnName].verify_jwt !== false) {
    errors.push(
      `[functions.${fnName}] expected verify_jwt = false (public endpoint by design)`
    );
  }
}

for (const fnName of selfAuthenticated) {
  if (!Object.prototype.hasOwnProperty.call(functions, fnName)) {
    errors.push(`Missing section [functions.${fnName}]`);
    continue;
  }
  if (functions[fnName].verify_jwt !== false) {
    errors.push(
      `[functions.${fnName}] expected verify_jwt = false (JWT is validated inside the function)`
    );
    continue;
  }
  const functionPath = path.resolve(
    process.cwd(),
    "supabase",
    "functions",
    fnName,
    "index.ts"
  );
  if (!fs.existsSync(functionPath)) {
    errors.push(`Missing self-authenticated function source: ${functionPath}`);
    continue;
  }
  const functionSource = fs.readFileSync(functionPath, "utf8");
  if (
    !/headers\.get\(["']Authorization["']\)/.test(functionSource)
    || !/auth\.getUser\(token\)/.test(functionSource)
  ) {
    errors.push(
      `[functions.${fnName}] must validate the bearer token with auth.getUser(token)`
    );
  }
}

if (errors.length > 0) {
  console.error("Edge JWT config check failed:");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log("Edge JWT config check passed.");
