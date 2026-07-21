#!/usr/bin/env node
const { execFileSync } = require("child_process");
const path = require("path");

const {
  analyzeProject,
  normalizePath,
  parseJsonFile,
} = require("./architecture-hygiene/analyzer");

function parseArgs(argv) {
  const options = { strict: false, report: false, json: false, base: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--strict") options.strict = true;
    else if (token === "--report") options.report = true;
    else if (token === "--json") options.json = true;
    else if (token === "--base") options.base = argv[index + 1] || "";
    if (token === "--base") index += 1;
  }
  return options;
}

function gitLines(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .trim()
      .split(/\r?\n/)
      .map(normalizePath)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function changedFiles(base) {
  const changed = new Set([
    ...gitLines(["diff", "--name-only", "HEAD"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ]);
  const candidates = [
    base,
    process.env.ARCHITECTURE_BASE_REF || "",
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "origin/main",
    "origin/master",
    "HEAD~1",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!gitLines(["rev-parse", "--verify", candidate]).length) continue;
    const diffArgs = candidate.startsWith("HEAD~")
      ? ["diff", "--name-only", candidate, "HEAD"]
      : ["diff", "--name-only", `${candidate}...HEAD`];
    for (const filePath of gitLines(diffArgs)) changed.add(filePath);
    break;
  }
  return [...changed];
}

function formatLocation(violation) {
  return `${violation.file}${violation.line ? `:${violation.line}` : ""}`;
}

function printViolation(violation, prefix = "erro") {
  console.error(`- [${prefix}] ${formatLocation(violation)} [${violation.rule}]`);
  console.error(`  ${violation.message}`);
  if (violation.target) console.error(`  alvo: ${violation.target}`);
  console.error(`  correcao: ${violation.suggestion}`);
  console.error(`  fingerprint: ${violation.fingerprint}`);
}

function printMetricRows(title, rows, render) {
  console.log(`\n${title}:`);
  if (!rows.length) {
    console.log("- nenhum");
    return;
  }
  for (const row of rows) console.log(`- ${render(row)}`);
}

function printReport(result) {
  const { metrics } = result;
  console.log("\n[architecture] Distribuicoes observadas (limites informativos derivados da base):");
  console.log(`- linhas: mediana=${metrics.distributions.lines.median}, p90=${metrics.distributions.lines.p90}, p95=${metrics.distributions.lines.p95}, max=${metrics.distributions.lines.max}`);
  console.log(`- dependencias de saida: mediana=${metrics.distributions.outgoing.median}, p90=${metrics.distributions.outgoing.p90}, p95=${metrics.distributions.outgoing.p95}, max=${metrics.distributions.outgoing.max}`);
  console.log(`- dependencias de entrada: mediana=${metrics.distributions.incoming.median}, p90=${metrics.distributions.incoming.p90}, p95=${metrics.distributions.incoming.p95}, max=${metrics.distributions.incoming.max}`);
  printMetricRows("Maiores arquivos", metrics.largestFiles, (row) => `${row.file}: ${row.lines} linhas`);
  printMetricRows("Mais dependencias", metrics.mostDependencies, (row) => `${row.file}: ${row.outgoing}`);
  printMetricRows("Mais importados", metrics.mostImported, (row) => `${row.file}: ${row.incoming}`);
  printMetricRows(
    "Mistura de camadas",
    metrics.mixedLayers,
    (row) => `${row.file}: ${row.layers.join(", ")} (${row.outgoing} dependencias)`
  );
  printMetricRows(
    "Concentracao em telas/hooks",
    metrics.presentationConcentration,
    (row) => `${row.file}: ${row.lines} linhas; camadas=${row.layers.join(", ")}`
  );
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const configPath = path.join(rootDir, "scripts", "architecture-hygiene.config.json");
  const baselinePath = path.join(rootDir, "scripts", "architecture-hygiene-baseline.json");
  const config = parseJsonFile(configPath, {});
  const baseline = parseJsonFile(baselinePath, { schemaVersion: 1, violations: [] });
  const result = analyzeProject({
    rootDir,
    config,
    baseline,
    strict: cli.strict,
    changedFiles: cli.strict ? changedFiles(cli.base) : [],
  });

  if (cli.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `[architecture] ${result.summary.files} modulos; ${result.summary.internalEdges} imports internos; ${result.summary.baselined} violacao(oes) no baseline.`
    );
    if (result.baselined.length) {
      console.log("[architecture] Divida preexistente preservada pelo baseline:");
      for (const violation of result.baselined) {
        console.log(`- ${formatLocation(violation)} [${violation.rule}] ${violation.fingerprint}`);
      }
    }
    if (result.acceptedExceptions.length) {
      console.log(`[architecture] ${result.acceptedExceptions.length} excecao(oes) explicita(s) aplicada(s).`);
    }
    if (cli.report) printReport(result);
    if (result.configErrors.length) {
      console.error("\n[architecture] Configuracao invalida:");
      for (const error of result.configErrors) console.error(`- ${error}`);
    }
    if (result.staleBaseline.length) {
      console.error("\n[architecture] Baseline obsoleto; remova as entradas para impedir retorno da divida:");
      for (const entry of result.staleBaseline) {
        console.error(`- [${entry.rule}] ${entry.fingerprint}: ${entry.path || entry.source || "sem caminho"}`);
      }
    }
    if (result.blocking.length) {
      console.error("\n[architecture] Violacoes bloqueadoras:");
      for (const violation of result.blocking) printViolation(violation);
    }
  }

  const failed =
    result.blocking.length > 0 ||
    result.staleBaseline.length > 0 ||
    result.configErrors.length > 0;
  if (failed) process.exit(1);
  console.log(`[architecture] OK${cli.strict ? " (strict)" : ""}${cli.report ? " (report)" : ""}.`);
}

main();
