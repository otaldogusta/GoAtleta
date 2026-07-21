const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const PLATFORM_SUFFIXES = ["", ".native", ".ios", ".android", ".web"];
const NON_BASELINABLE_RULES = new Set([
  "circular-runtime",
  "src-to-app",
  "service-to-frontend",
  "core-to-frontend",
  "edge-to-frontend",
  "ui-direct-data-access",
  "ai-mutation-without-scope",
]);

const DEFAULT_CONFIG = {
  roots: ["app", "src", "supabase/functions"],
  exclude: [
    "**/__tests__/**",
    "**/__mocks__/**",
    "**/fixtures/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
  ],
  pureCore: ["src/core/**"],
  publicModules: [],
  exceptions: [],
};

function normalizePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  const withoutPrefix = normalized.replace(/^\.\//, "");
  const collapsed = path.posix.normalize(withoutPrefix);
  return collapsed === "." ? "" : collapsed.replace(/^\/+/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob) {
  const normalized = normalizePath(glob);
  let expression = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      expression += ".*";
      index += 1;
    } else if (char === "*") {
      expression += "[^/]*";
    } else if (char === "?") {
      expression += "[^/]";
    } else {
      expression += escapeRegExp(char);
    }
  }
  return new RegExp(`^${expression}$`);
}

function matchesPattern(filePath, pattern) {
  return globToRegExp(pattern).test(normalizePath(filePath));
}

function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => matchesPattern(filePath, pattern));
}

function walkFiles(rootDir, relativeDir, output) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) return;
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = normalizePath(path.posix.join(relativeDir, entry.name));
    if (entry.isDirectory()) {
      walkFiles(rootDir, relativePath, output);
      continue;
    }
    if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) output.push(relativePath);
  }
}

function discoverFiles(rootDir, config) {
  const files = [];
  for (const root of config.roots) walkFiles(rootDir, normalizePath(root), files);
  return files
    .filter((filePath) => !matchesAny(filePath, config.exclude || []))
    .sort((left, right) => left.localeCompare(right));
}

function parseJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadTsAliases(rootDir) {
  const tsconfigPath = path.join(rootDir, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return [];
  const parsed = ts.parseConfigFileTextToJson(
    tsconfigPath,
    fs.readFileSync(tsconfigPath, "utf8")
  );
  if (parsed.error || !parsed.config) return [];
  const compilerOptions = parsed.config.compilerOptions || {};
  const baseUrl = normalizePath(compilerOptions.baseUrl || ".");
  const aliases = [];
  for (const [key, values] of Object.entries(compilerOptions.paths || {})) {
    for (const value of values) {
      aliases.push({ pattern: key, target: normalizePath(path.posix.join(baseUrl, value)) });
    }
  }
  return aliases;
}

function applyAlias(specifier, aliases) {
  for (const alias of aliases) {
    const starIndex = alias.pattern.indexOf("*");
    if (starIndex === -1) {
      if (specifier === alias.pattern) return alias.target;
      continue;
    }
    const prefix = alias.pattern.slice(0, starIndex);
    const suffix = alias.pattern.slice(starIndex + 1);
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    const captured = specifier.slice(prefix.length, specifier.length - suffix.length);
    return alias.target.replace("*", captured);
  }
  return null;
}

function resolveInternalImports(source, specifier, fileSet, aliases) {
  let basePath = null;
  if (specifier.startsWith(".")) {
    basePath = normalizePath(path.posix.join(path.posix.dirname(source), specifier));
  } else {
    basePath = applyAlias(specifier, aliases);
  }
  if (!basePath) return [];
  const candidates = [basePath];
  for (const platformSuffix of PLATFORM_SUFFIXES) {
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.push(`${basePath}${platformSuffix}${extension}`);
      candidates.push(
        normalizePath(path.posix.join(basePath, `index${platformSuffix}${extension}`))
      );
    }
  }
  return [...new Set(candidates.map(normalizePath).filter((candidate) => fileSet.has(candidate)))];
}

function isTypeOnlyImport(node) {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
    return false;
  }
  return (
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function parseImports(filePath, content) {
  const scriptKind = filePath.endsWith(".tsx") || filePath.endsWith(".jsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );
  const imports = [];
  const pushImport = (node, specifier, typeOnly, lazy = false) => {
    if (!specifier) return;
    imports.push({
      specifier,
      typeOnly,
      lazy,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      pushImport(node, node.moduleSpecifier.text, isTypeOnlyImport(node));
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      pushImport(node, node.moduleSpecifier.text, Boolean(node.isTypeOnly));
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      pushImport(node, node.moduleReference.expression.text, false);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === "require") ||
        node.expression.kind === ts.SyntaxKind.ImportKeyword)
    ) {
      pushImport(
        node,
        node.arguments[0].text,
        false,
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return imports;
}

function stronglyConnectedComponents(graph) {
  let nextIndex = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowLinks = new Map();
  const components = [];

  const visit = (node) => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of graph.get(node) || []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(target)));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    if (component.length > 1 || (graph.get(node) || []).includes(node)) {
      components.push(component.sort((left, right) => left.localeCompare(right)));
    }
  };

  for (const node of [...graph.keys()].sort()) {
    if (!indices.has(node)) visit(node);
  }
  return components;
}

function findCycleWitness(graph, component) {
  const allowed = new Set(component);
  let best = null;
  for (const start of component) {
    const neighbors = [...new Set(graph.get(start) || [])].filter((item) => allowed.has(item));
    for (const neighbor of neighbors) {
      if (neighbor === start) return [start, start];
      const queue = [[neighbor, [neighbor]]];
      const visited = new Set([neighbor]);
      while (queue.length) {
        const [current, pathSoFar] = queue.shift();
        for (const target of graph.get(current) || []) {
          if (!allowed.has(target)) continue;
          if (target === start) {
            const candidate = [start, ...pathSoFar, start];
            if (!best || candidate.length < best.length) best = candidate;
            queue.length = 0;
            break;
          }
          if (!visited.has(target)) {
            visited.add(target);
            queue.push([target, [...pathSoFar, target]]);
          }
        }
      }
    }
  }
  return best || [component[0], component[0]];
}

function fingerprintFor(violation) {
  const identity = violation.cycleMembers
    ? `${violation.rule}|${[...violation.cycleMembers].sort().join("|")}`
    : `${violation.rule}|${violation.file || ""}|${violation.target || ""}|${
        violation.specifier || ""
      }`;
  return crypto.createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

function layerFor(filePath) {
  if (/^(?:app|src\/(?:ui|screens|components|navigation))\//.test(filePath)) return "interface";
  if (/^src\/core\//.test(filePath)) return "domain";
  if (/^src\/(?:api|db)\//.test(filePath)) return "data";
  if (/^src\/copilot\//.test(filePath)) return "ai";
  if (/^supabase\/functions\//.test(filePath)) return "backend";
  if (/^src\/(?:auth|providers|services)\//.test(filePath)) return "application";
  return "shared";
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * ratio))];
}

function distribution(values) {
  return {
    median: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    p95: percentile(values, 0.95),
    max: values.length ? Math.max(...values) : 0,
  };
}

function buildMetrics(files, graph, contents) {
  const incoming = new Map(files.map((filePath) => [filePath, 0]));
  for (const targets of graph.values()) {
    for (const target of new Set(targets)) incoming.set(target, (incoming.get(target) || 0) + 1);
  }
  const rows = files.map((filePath) => {
    const dependencies = [...new Set(graph.get(filePath) || [])];
    const layers = [...new Set(dependencies.map(layerFor))].sort();
    return {
      file: filePath,
      lines: contents.get(filePath).split(/\r?\n/).length,
      outgoing: dependencies.length,
      incoming: incoming.get(filePath) || 0,
      layers,
    };
  });
  const top = (field, limit = 15) =>
    [...rows]
      .sort((left, right) => right[field] - left[field] || left.file.localeCompare(right.file))
      .slice(0, limit);
  const mixedLayers = [...rows]
    .filter((row) => row.layers.length >= 3)
    .sort(
      (left, right) =>
        right.layers.length - left.layers.length ||
        right.outgoing - left.outgoing ||
        left.file.localeCompare(right.file)
    )
    .slice(0, 15);
  const presentationConcentration = [...rows]
    .filter((row) => /^(?:app|src\/(?:screens|hooks))\//.test(row.file))
    .filter((row) => row.layers.includes("domain") && (row.layers.includes("data") || row.layers.includes("ai")))
    .sort((left, right) => right.lines - left.lines || right.outgoing - left.outgoing)
    .slice(0, 15);
  return {
    distributions: {
      lines: distribution(rows.map((row) => row.lines)),
      outgoing: distribution(rows.map((row) => row.outgoing)),
      incoming: distribution(rows.map((row) => row.incoming)),
    },
    largestFiles: top("lines"),
    mostDependencies: top("outgoing"),
    mostImported: top("incoming"),
    mixedLayers,
    presentationConcentration,
  };
}

function exceptionMatches(exception, violation) {
  if (exception.rule !== violation.rule) return false;
  if (exception.source && normalizePath(exception.source) !== violation.file) return false;
  if (exception.target && normalizePath(exception.target) !== violation.target) return false;
  return true;
}

function analyzeProject(options) {
  const rootDir = path.resolve(options.rootDir);
  const config = {
    ...DEFAULT_CONFIG,
    ...(options.config || {}),
    roots: options.config?.roots || DEFAULT_CONFIG.roots,
    exclude: options.config?.exclude || DEFAULT_CONFIG.exclude,
    pureCore: options.config?.pureCore || DEFAULT_CONFIG.pureCore,
    publicModules: options.config?.publicModules || [],
    exceptions: options.config?.exceptions || [],
  };
  const files = discoverFiles(rootDir, config);
  const fileSet = new Set(files);
  const aliases = loadTsAliases(rootDir);
  const contents = new Map();
  const graph = new Map(files.map((filePath) => [filePath, []]));
  const runtimeGraph = new Map(files.map((filePath) => [filePath, []]));
  const edges = [];
  const violations = [];
  const configErrors = [];

  const addViolation = (violation) => {
    const normalized = {
      ...violation,
      file: normalizePath(violation.file),
      target: violation.target ? normalizePath(violation.target) : undefined,
    };
    normalized.fingerprint = fingerprintFor(normalized);
    violations.push(normalized);
  };

  for (const filePath of files) {
    const content = fs.readFileSync(path.join(rootDir, filePath), "utf8");
    contents.set(filePath, content);
    for (const imported of parseImports(filePath, content)) {
      const targets = resolveInternalImports(filePath, imported.specifier, fileSet, aliases);
      if (!targets.length) {
        edges.push({ source: filePath, target: null, ...imported });
      }
      for (const target of targets) {
        edges.push({ source: filePath, target, ...imported });
        graph.get(filePath).push(target);
        if (!imported.typeOnly && !imported.lazy) runtimeGraph.get(filePath).push(target);
      }
    }
  }

  const frontendPatterns = [
    "app/**",
    "src/ui/**",
    "src/screens/**",
    "src/components/**",
    "src/navigation/**",
  ];
  const frameworkPattern = /^(?:react|react-native|expo|expo-router)(?:$|\/|-)/;
  for (const edge of edges) {
    if (matchesAny(edge.source, config.pureCore) && frameworkPattern.test(edge.specifier)) {
      addViolation({
        rule: "core-framework-dependency",
        severity: "high",
        file: edge.source,
        line: edge.line,
        specifier: edge.specifier,
        message: `Nucleo independente importa framework de interface: ${edge.specifier}.`,
        suggestion: "Mova o adapter/hook para uma camada de interface ou injete um contrato independente.",
      });
    }
    if (!edge.target) continue;
    if (edge.source.startsWith("src/") && edge.target.startsWith("app/")) {
      addViolation({
        rule: "src-to-app",
        severity: "critical",
        file: edge.source,
        target: edge.target,
        line: edge.line,
        specifier: edge.specifier,
        message: "Modulo em src depende de uma rota/tela em app.",
        suggestion: "Extraia o contrato ou caso de uso para src e deixe app apenas compor a tela.",
      });
    } else if (
      /^src\/(?:api|db)\//.test(edge.source) &&
      matchesAny(edge.target, frontendPatterns)
    ) {
      addViolation({
        rule: "service-to-frontend",
        severity: "critical",
        file: edge.source,
        target: edge.target,
        line: edge.line,
        specifier: edge.specifier,
        message: "Persistencia/API depende de implementacao do frontend.",
        suggestion: "Inverta a dependencia e exponha um contrato neutro na aplicacao ou no dominio.",
      });
    } else if (matchesAny(edge.source, config.pureCore) && matchesAny(edge.target, frontendPatterns)) {
      addViolation({
        rule: "core-to-frontend",
        severity: "critical",
        file: edge.source,
        target: edge.target,
        line: edge.line,
        specifier: edge.specifier,
        message: "Dominio/nucleo depende de componente ou navegacao do frontend.",
        suggestion: "Mova a dependencia visual para um adapter fora do nucleo.",
      });
    } else if (
      edge.source.startsWith("supabase/functions/") &&
      matchesAny(edge.target, frontendPatterns)
    ) {
      addViolation({
        rule: "edge-to-frontend",
        severity: "critical",
        file: edge.source,
        target: edge.target,
        line: edge.line,
        specifier: edge.specifier,
        message: "Edge Function depende de codigo especifico do frontend.",
        suggestion: "Compartilhe somente contratos neutros ou mova o codigo para supabase/functions/_shared.",
      });
    }

    for (const boundary of config.publicModules) {
      const moduleRoot = normalizePath(boundary.root).replace(/\/$/, "");
      const entryBase = normalizePath(boundary.entry || `${moduleRoot}/index`);
      const entryCandidates = new Set(
        [entryBase, ...SOURCE_EXTENSIONS.map((extension) => `${entryBase}${extension}`)].map(normalizePath)
      );
      const crossesBoundary =
        edge.target.startsWith(`${moduleRoot}/`) && !edge.source.startsWith(`${moduleRoot}/`);
      if (crossesBoundary && !entryCandidates.has(edge.target)) {
        addViolation({
          rule: "dangerous-deep-import",
          severity: "medium",
          file: edge.source,
          target: edge.target,
          line: edge.line,
          specifier: edge.specifier,
          message: `Import interno atravessa a API publica de ${moduleRoot}.`,
          suggestion: `Importe por ${entryBase} ou amplie explicitamente a API publica do modulo.`,
        });
      }
    }
  }

  const directDataPattern = /\bSUPABASE_URL\b|\/rest\/v1\/|\/functions\/v1\/|\bcreateClient\s*\(/;
  const mutationPattern = /\.(?:insert|update|upsert|delete)\s*\(/;
  const scopePattern = /\b(?:organizationId|workspaceId|organization_id|workspace_id|requireActiveWorkspaceId|assertOrganizationId|getActiveOrganizationId)\b/;
  for (const filePath of files) {
    const content = contents.get(filePath);
    if (directDataPattern.test(content)) {
      if (/^src\/(?:ui|screens)\//.test(filePath)) {
        addViolation({
          rule: "ui-direct-data-access",
          severity: "critical",
          file: filePath,
          message: "Componente/tela em src acessa Supabase ou Edge Function diretamente.",
          suggestion: "Encapsule o acesso em src/api, src/db ou em um caso de uso da aplicacao.",
        });
      } else if (filePath.startsWith("src/copilot/")) {
        addViolation({
          rule: "copilot-direct-data-access",
          severity: "high",
          file: filePath,
          message: "Modulo do Copilot usa acesso de dados de baixo nivel diretamente.",
          suggestion: "Passe por um servico que preserve validacao, autorizacao e contexto organizacional.",
        });
      } else if (filePath.startsWith("app/")) {
        addViolation({
          rule: "app-direct-data-access",
          severity: "high",
          file: filePath,
          message: "Rota/tela em app usa acesso de dados de baixo nivel diretamente.",
          suggestion: "Extraia a chamada para src/api ou para um caso de uso testavel.",
        });
      }
    }
    const isAiMutationSurface =
      filePath.startsWith("src/copilot/") ||
      filePath.startsWith("supabase/functions/assistant/") ||
      /^supabase\/functions\/_shared\/ai-/.test(filePath);
    if (
      isAiMutationSurface &&
      directDataPattern.test(content) &&
      mutationPattern.test(content) &&
      !scopePattern.test(content)
    ) {
      addViolation({
        rule: "ai-mutation-without-scope",
        severity: "critical",
        file: filePath,
        message: "Superficie de IA contem mutacao sem sinal explicito de organizacao/workspace.",
        suggestion: "Passe a mutacao pelo caso de uso autorizado e torne o contexto organizacional explicito.",
      });
    }
  }

  const runtimeComponents = stronglyConnectedComponents(runtimeGraph);
  const runtimeCycleNodes = new Set(runtimeComponents.flat());
  for (const component of runtimeComponents) {
    const witness = findCycleWitness(runtimeGraph, component);
    addViolation({
      rule: "circular-runtime",
      severity: "critical",
      file: witness[0],
      cycleMembers: component,
      cyclePath: witness,
      message: `Ciclo de runtime: ${witness.join(" -> ")}`,
      suggestion: "Extraia o contrato compartilhado ou inverta uma das dependencias do ciclo.",
    });
  }
  for (const component of stronglyConnectedComponents(graph)) {
    if (component.some((filePath) => runtimeCycleNodes.has(filePath))) continue;
    const witness = findCycleWitness(graph, component);
    addViolation({
      rule: "circular-structural",
      severity: "high",
      file: witness[0],
      cycleMembers: component,
      cyclePath: witness,
      message: `Ciclo estrutural (inclui imports de tipo): ${witness.join(" -> ")}`,
      suggestion: "Mova tipos compartilhados para um modulo neutro sem dependencia reversa.",
    });
  }

  const exceptions = config.exceptions || [];
  for (const exception of exceptions) {
    if (!exception.rule || !exception.source || !String(exception.justification || "").trim()) {
      configErrors.push("Toda excecao precisa de regra, source e justificativa nao vazia.");
    }
  }
  const remainingViolations = [];
  const acceptedExceptions = [];
  for (const violation of violations) {
    const exception = exceptions.find((candidate) => exceptionMatches(candidate, violation));
    if (exception && String(exception.justification || "").trim()) {
      acceptedExceptions.push({ violation, exception });
    } else {
      remainingViolations.push(violation);
    }
  }

  const baseline = options.baseline || { schemaVersion: 1, violations: [] };
  const baselineEntries = baseline.violations || [];
  for (const entry of baselineEntries) {
    if (!entry.fingerprint || !entry.rule || !String(entry.justification || "").trim()) {
      configErrors.push("Toda entrada do baseline precisa de fingerprint, regra e justificativa.");
    }
    if (NON_BASELINABLE_RULES.has(entry.rule)) {
      configErrors.push(`A regra critica ${entry.rule} nao pode ser adicionada ao baseline.`);
    }
  }
  const baselineByFingerprint = new Map(
    baselineEntries.map((entry) => [entry.fingerprint, entry])
  );
  const baselined = [];
  const blocking = [];
  for (const violation of remainingViolations) {
    const entry = baselineByFingerprint.get(violation.fingerprint);
    if (entry && !NON_BASELINABLE_RULES.has(violation.rule)) {
      baselined.push({ ...violation, baseline: entry });
    } else {
      blocking.push(violation);
    }
  }
  const actualFingerprints = new Set(baselined.map((violation) => violation.fingerprint));
  const staleBaseline = baselineEntries.filter(
    (entry) => entry.fingerprint && !actualFingerprints.has(entry.fingerprint)
  );

  if (options.strict && options.changedFiles) {
    const changed = new Set(options.changedFiles.map(normalizePath));
    for (const violation of baselined) {
      if (violation.rule.startsWith("circular-")) continue;
      if (changed.has(violation.file)) {
        blocking.push({
          ...violation,
          rule: "baseline-debt-touched",
          originalRule: violation.rule,
          fingerprint: fingerprintFor({
            rule: "baseline-debt-touched",
            file: violation.file,
            target: violation.target,
            specifier: violation.specifier,
          }),
          message: `Arquivo alterado ainda contem divida do baseline (${violation.rule}).`,
          suggestion: "Remova a violacao tocada ou registre uma excecao pequena e explicitamente justificada.",
        });
      }
    }
  }

  return {
    files,
    edges,
    violations: remainingViolations,
    blocking,
    baselined,
    staleBaseline,
    acceptedExceptions,
    configErrors,
    metrics: buildMetrics(files, graph, contents),
    summary: {
      files: files.length,
      internalEdges: edges.filter((edge) => edge.target).length,
      externalImports: edges.filter((edge) => !edge.target).length,
      blocking: blocking.length + staleBaseline.length + configErrors.length,
      baselined: baselined.length,
      exceptions: acceptedExceptions.length,
    },
  };
}

module.exports = {
  DEFAULT_CONFIG,
  NON_BASELINABLE_RULES,
  analyzeProject,
  fingerprintFor,
  globToRegExp,
  matchesPattern,
  normalizePath,
  parseJsonFile,
};
