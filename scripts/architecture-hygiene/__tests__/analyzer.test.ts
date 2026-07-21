import path from "path";

import { analyzeProject, normalizePath } from "../analyzer";

const fixtureRoot = (name: string) => path.join(__dirname, "fixtures", name);

const analyzeFixture = (
  name: string,
  options: { config?: Record<string, unknown>; baseline?: Record<string, unknown> } = {}
) =>
  analyzeProject({
    rootDir: fixtureRoot(name),
    config: options.config ?? {},
    baseline: options.baseline ?? { schemaVersion: 1, violations: [] },
  });

describe("architecture hygiene analyzer", () => {
  test("accepts a project without cycles", () => {
    const result = analyzeFixture("clean");

    expect(result.blocking).toHaveLength(0);
    expect(result.staleBaseline).toHaveLength(0);
    expect(result.summary.internalEdges).toBe(1);
  });

  test("reports a simple runtime cycle with its complete path", () => {
    const result = analyzeFixture("cycle-simple");
    const violation = result.blocking.find(
      (item: { rule: string }) => item.rule === "circular-runtime"
    );

    expect(violation).toBeDefined();
    expect(violation.cyclePath).toHaveLength(3);
    expect(violation.cyclePath[0]).toBe(violation.cyclePath[2]);
    expect(violation.message).toContain(" -> ");
  });

  test("reports a cycle across three modules", () => {
    const result = analyzeFixture("cycle-three");
    const violation = result.blocking.find(
      (item: { rule: string }) => item.rule === "circular-runtime"
    );

    expect(violation.cycleMembers).toHaveLength(3);
    expect(violation.cyclePath).toHaveLength(4);
  });

  test("blocks src importing app", () => {
    const result = analyzeFixture("src-to-app");
    const violation = result.blocking.find(
      (item: { rule: string }) => item.rule === "src-to-app"
    );

    expect(violation).toMatchObject({
      file: "src/service.ts",
      target: "app/screen.ts",
      line: 1,
      severity: "critical",
    });
  });

  test("blocks a pure core module importing React or Expo", () => {
    const result = analyzeFixture("core-framework");
    const violations = result.blocking.filter(
      (item: { rule: string }) => item.rule === "core-framework-dependency"
    );

    expect(violations.map((item: { specifier: string }) => item.specifier)).toEqual([
      "expo-constants",
      "react",
    ]);
  });

  test("blocks an Edge Function importing frontend code", () => {
    const result = analyzeFixture("edge-frontend");

    expect(result.blocking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "edge-to-frontend",
          file: "supabase/functions/example/index.ts",
          target: "app/screen.ts",
        }),
      ])
    );
  });

  test("accepts a small explicit exception with justification", () => {
    const result = analyzeFixture("src-to-app", {
      config: {
        exceptions: [
          {
            rule: "src-to-app",
            source: "src/service.ts",
            target: "app/screen.ts",
            justification: "Fixture que comprova a politica de excecao explicita.",
          },
        ],
      },
    });

    expect(result.blocking).toHaveLength(0);
    expect(result.acceptedExceptions).toHaveLength(1);
  });

  test("accepts a preexisting baselinable violation", () => {
    const initial = analyzeFixture("type-cycle");
    const violation = initial.blocking.find(
      (item: { rule: string }) => item.rule === "circular-structural"
    );
    const result = analyzeFixture("type-cycle", {
      baseline: {
        schemaVersion: 1,
        violations: [
          {
            fingerprint: violation.fingerprint,
            rule: violation.rule,
            path: violation.cyclePath.join(" -> "),
            justification: "Divida tipada preexistente da fixture.",
          },
        ],
      },
    });

    expect(result.blocking).toHaveLength(0);
    expect(result.baselined).toHaveLength(1);
  });

  test("blocks a new violation absent from the baseline", () => {
    const result = analyzeFixture("type-cycle");

    expect(result.blocking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "circular-structural" }),
      ])
    );
  });

  test("marks removed baseline debt as stale so it cannot silently return", () => {
    const initial = analyzeFixture("type-cycle");
    const violation = initial.blocking[0];
    const result = analyzeFixture("clean", {
      baseline: {
        schemaVersion: 1,
        violations: [
          {
            fingerprint: violation.fingerprint,
            rule: violation.rule,
            path: violation.cyclePath.join(" -> "),
            justification: "Entrada removida deve ser apagada do baseline.",
          },
        ],
      },
    });

    expect(result.staleBaseline).toHaveLength(1);
    expect(result.summary.blocking).toBeGreaterThan(0);
  });

  test("produces actionable error messages", () => {
    const result = analyzeFixture("src-to-app");
    const violation = result.blocking[0];

    expect(violation.message).toContain("src");
    expect(violation.suggestion.length).toBeGreaterThan(20);
    expect(violation.fingerprint).toMatch(/^[a-f0-9]{16}$/);
  });

  test("normalizes Windows and Unix paths to the same identity", () => {
    expect(normalizePath("src\\core\\rules.ts")).toBe("src/core/rules.ts");
    expect(normalizePath("./src/core/rules.ts")).toBe("src/core/rules.ts");
  });

  test("resolves the TypeScript alias used by the project", () => {
    const result = analyzeFixture("alias");

    expect(result.summary.internalEdges).toBe(1);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "app/screen.ts",
          target: "src/core/rules.ts",
          specifier: "@/src/core/rules",
        }),
      ])
    );
  });

  test("includes generic and Metro platform variants in the graph", () => {
    const result = analyzeFixture("platform-variants");
    const targets = result.edges
      .filter((edge: { source: string }) => edge.source === "app/screen.ts")
      .map((edge: { target: string }) => edge.target)
      .sort();

    expect(targets).toEqual(["src/adapter.ts", "src/adapter.web.ts"]);
  });
});
