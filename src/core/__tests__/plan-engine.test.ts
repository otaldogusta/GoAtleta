import {
  applyUserChange,
  applyPlanRules,
  buildPlanDiff,
  detectImpact,
  replanFrom,
  validatePlan,
  type PlanGraph,
  type PlanWeek,
} from "../plan-engine";
import type { WeeklyAutopilotKnowledgeContext } from "../models";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toEqual: (expected: unknown) => void;
  toContain: (expected: unknown) => void;
  toBeGreaterThan: (expected: number) => void;
  some: (predicate: (value: any) => boolean) => boolean;
};

const knowledgeContext: WeeklyAutopilotKnowledgeContext = {
  versionId: "kbv_1",
  versionLabel: "2026.1",
  domain: "youth_training",
  references: [
    {
      sourceId: "src_1",
      title: "Youth Volleyball Guidelines",
      authors: "Lloyd & Oliver",
      sourceYear: 2020,
      sourceType: "guideline",
      citationText: "Lloyd & Oliver, 2020",
      url: "https://example.com/youth-volleyball",
    },
  ],
  ruleHighlights: [
    "Progressao conservadora para base jovem.",
    "Evitar alta intensidade continua.",
  ],
};

const buildWeek = (
  weekNumber: number,
  overrides: Partial<PlanWeek> = {}
): PlanWeek => {
  const baseDate = new Date("2026-03-02T00:00:00.000Z");
  baseDate.setDate(baseDate.getDate() + (weekNumber - 1) * 7);
  const weekStart = baseDate.toISOString().slice(0, 10);
  return {
    weekStart,
    weekNumber,
    phase: "development",
    objective: "technical_consistency",
    loadTarget: 0.45 + (weekNumber - 1) * 0.05,
    intensityTarget: 0.5 + (weekNumber - 1) * 0.04,
    technicalFocus: [`Fundamento ${weekNumber}`],
    physicalFocus: ["Coordenação"],
    constraints: [
      {
        type: "scientific",
        value: "Bloco preventivo obrigatório.",
        severity: "high",
      },
    ],
    progressionModel: "linear",
    knowledgeBaseVersionId: knowledgeContext.versionId,
    knowledgeBaseVersionLabel: knowledgeContext.versionLabel,
    knowledgeDomain: knowledgeContext.domain,
    knowledgeRuleHighlights: [...knowledgeContext.ruleHighlights],
    knowledgeReferences: [...knowledgeContext.references],
    dependsOnWeekStart: weekNumber === 1 ? null : `${String(baseDate.getFullYear())}-${String(
      baseDate.getMonth() + 1
    ).padStart(2, "0")}-${String(baseDate.getDate() - 7).padStart(2, "0")}`,
    locked: false,
    source: "AUTO",
    createdAt: "2026-03-02T00:00:00.000Z",
    updatedAt: "2026-03-02T00:00:00.000Z",
    ...overrides,
  };
};

const buildPlan = (): PlanGraph => ({
  classId: "class_1",
  organizationId: "org_1",
  cycleStartDate: "2026-03-02",
  revision: 1,
  weeks: [buildWeek(1), buildWeek(2), buildWeek(3), buildWeek(4)],
});

describe("plan-engine", () => {
  it("detects impact across the planned horizon", () => {
    const impact = detectImpact(buildPlan(), {
      kind: "load_change",
      weekStart: "2026-03-09",
      field: "loadTarget",
      previousValue: 0.5,
      nextValue: 0.7,
    });

    expect(impact.fromWeekIndex).toBe(1);
    expect(impact.severity).toBe("high");
    expect(impact.affectedWeekIndexes).toEqual([1, 2, 3]);
  });

  it("preserves the edited week while propagating forward", () => {
    const edited = applyUserChange(buildPlan(), {
      kind: "load_change",
      weekStart: "2026-03-09",
      field: "loadTarget",
      previousValue: 0.5,
      nextValue: 0.7,
    });

    const result = replanFrom(edited, 1, knowledgeContext);

    expect(result.nextPlan.weeks[1].loadTarget).toBe(0.7);
    expect(result.nextPlan.weeks[2].dependsOnWeekStart).toBe("2026-03-09");
    expect(result.nextPlan.weeks[2].knowledgeBaseVersionId).toBe(knowledgeContext.versionId);
    expect(result.changedWeekIndexes).toContain(2);
  });

  it("validates scientific caps and load jumps", () => {
    const plan = buildPlan();
    plan.weeks[1].loadTarget = 0.72;
    plan.weeks[2].loadTarget = 0.95;
    plan.weeks[2].knowledgeBaseVersionId = "kbv_other";

    const issues = validatePlan(plan, knowledgeContext);

    expect(issues.some((issue) => issue.code === "knowledge_rule_violation")).toBe(true);
    expect(issues.some((issue) => issue.code === "load_jump_too_large")).toBe(true);
    expect(issues.some((issue) => issue.code === "scientific_version_mismatch")).toBe(true);
  });

  it("builds a structured diff for UI review", () => {
    const before = buildWeek(2);
    const after = {
      ...before,
      loadTarget: 0.65,
      intensityTarget: 0.6,
      technicalFocus: ["Fundamento 2", "Controle"],
    };

    const diff = buildPlanDiff(before, after);

    expect(diff.weekStart).toBe(before.weekStart);
    expect(diff.changes.length).toBeGreaterThan(0);
    expect(diff.changes.some((change) => change.field === "loadTarget")).toBe(true);
  });

  it("auto-corrects soft rules when requested", () => {
    const week = buildWeek(4, {
      objective: "technical_consistency",
      technicalFocus: ["Fundamentos"],
      physicalFocus: ["Coordenação"],
      constraints: [],
      loadTarget: 0.48,
      intensityTarget: 0.5,
    });

    const result = applyPlanRules(
      week,
      {
        plan: buildPlan(),
        index: 3,
        previousWeek: buildWeek(3),
        nextWeek: null,
        knowledgeSnapshot: knowledgeContext,
      },
      { autoCorrect: true }
    );

    expect(result.issues.some((issue) => issue.code === "missing_preventive_block")).toBe(true);
    expect(result.week.constraints.some((item) => /prevent/i.test(item.value))).toBe(true);
    expect(result.correctedRuleIds.length).toBeGreaterThan(0);
  });

  it("rejects NaN input for loadTarget — clamps to previous value", () => {
    const plan = buildPlan();
    const originalLoad = plan.weeks[0].loadTarget;

    const result = applyUserChange(plan, {
      kind: "load_change",
      weekStart: plan.weeks[0].weekStart,
      field: "loadTarget",
      previousValue: originalLoad,
      nextValue: NaN,
    });

    const load = result.weeks[0].loadTarget;
    expect(Number.isFinite(load)).toBe(true);
    expect(load).toBe(originalLoad);
  });

  it("rejects NaN input for intensityTarget — clamps to previous value", () => {
    const plan = buildPlan();
    const originalIntensity = plan.weeks[1].intensityTarget;

    const result = applyUserChange(plan, {
      kind: "load_change",
      weekStart: plan.weeks[1].weekStart,
      field: "intensityTarget",
      previousValue: originalIntensity,
      nextValue: "abc",
    });

    const intensity = result.weeks[1].intensityTarget;
    expect(Number.isFinite(intensity)).toBe(true);
    expect(intensity).toBe(originalIntensity);
  });

  it("rejects null input for loadTarget — clamps to previous value", () => {
    const plan = buildPlan();
    const originalLoad = plan.weeks[0].loadTarget;

    const result = applyUserChange(plan, {
      kind: "load_change",
      weekStart: plan.weeks[0].weekStart,
      field: "loadTarget",
      previousValue: originalLoad,
      nextValue: null,
    });

    expect(Number.isFinite(result.weeks[0].loadTarget)).toBe(true);
    expect(result.weeks[0].loadTarget).toBe(originalLoad);
  });

  it("handles replanFrom with empty weeks array without throwing", () => {
    const emptyPlan: PlanGraph = {
      classId: "class_1",
      organizationId: "org_1",
      cycleStartDate: "2026-03-02",
      revision: 1,
      weeks: [],
    };

    const result = replanFrom(emptyPlan, 0, knowledgeContext);

    expect(result.nextPlan.weeks).toEqual([]);
    expect(result.changedWeekIndexes).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("handles replanFrom with startWeekIndex beyond weeks length without throwing", () => {
    const plan = buildPlan();
    const result = replanFrom(plan, 99, knowledgeContext);

    expect(result.nextPlan.weeks.length).toBe(plan.weeks.length);
    expect(result.changedWeekIndexes).toEqual([]);
  });

  it("never produces NaN in any numeric field after applyUserChange + replanFrom", () => {
    const plan = buildPlan();

    const edited = applyUserChange(plan, {
      kind: "load_change",
      weekStart: plan.weeks[0].weekStart,
      field: "loadTarget",
      previousValue: plan.weeks[0].loadTarget,
      nextValue: NaN,
    });

    const result = replanFrom(edited, 0, knowledgeContext);

    result.nextPlan.weeks.forEach((week) => {
      expect(Number.isFinite(week.loadTarget)).toBe(true);
      expect(Number.isFinite(week.intensityTarget)).toBe(true);
    });
  });
});
