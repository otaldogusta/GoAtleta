import type {
  ClassPlan,
  KnowledgeBaseDomain,
  WeeklyAutopilotKnowledgeContext,
  WeeklyAutopilotKnowledgeReference,
} from "./models";

export type PlanEditableField =
  | "phase"
  | "objective"
  | "loadTarget"
  | "intensityTarget"
  | "technicalFocus"
  | "physicalFocus"
  | "constraints"
  | "progressionModel";

export type Phase = "base" | "development" | "intensification" | "recovery" | "taper";
export type Objective =
  | "motor_learning"
  | "technical_consistency"
  | "load_progression"
  | "game_transfer"
  | "recovery"
  | "performance";
export type ProgressionModel = "linear" | "undulating" | "block";
export type ConstraintType = "injury" | "volume_limit" | "environment" | "equipment" | "scientific";
export type PlanSource = ClassPlan["source"] | "MIXED";

export type PlanConstraint = {
  type: ConstraintType;
  value: string;
  severity: "low" | "medium" | "high";
};

export type Constraint = PlanConstraint;

export type PlanWeek = {
  weekStart: string;
  weekNumber: number;
  phase: Phase;
  objective: Objective;
  loadTarget: number;
  intensityTarget: number;
  technicalFocus: string[];
  physicalFocus: string[];
  constraints: PlanConstraint[];
  progressionModel: ProgressionModel;
  knowledgeBaseVersionId?: string | null;
  knowledgeBaseVersionLabel?: string | null;
  knowledgeDomain?: KnowledgeBaseDomain | null;
  knowledgeRuleHighlights: string[];
  knowledgeReferences: WeeklyAutopilotKnowledgeReference[];
  dependsOnWeekStart: string | null;
  locked: boolean;
  source: PlanSource;
  createdAt: string;
  updatedAt: string;
};

export type PlanGraph = {
  classId: string;
  organizationId: string;
  cycleStartDate: string;
  revision: number;
  weeks: PlanWeek[];
};

export type ClassPlanningGraph = PlanGraph;

export type PlanChangeKind =
  | "load_change"
  | "objective_change"
  | "exercise_change"
  | "constraint_change"
  | "scientific_version_change";

export type PlanChange = {
  kind: PlanChangeKind;
  weekStart: string;
  field: PlanEditableField;
  previousValue: unknown;
  nextValue: unknown;
  reason?: string;
};

export type PlanRuleType = "hard" | "soft";

export type PlanRuleContext = {
  plan: PlanGraph;
  week: PlanWeek;
  index: number;
  previousWeek: PlanWeek | null;
  nextWeek: PlanWeek | null;
  knowledgeSnapshot: WeeklyAutopilotKnowledgeContext;
};

export type PlanRule = {
  id: string;
  label: string;
  type: PlanRuleType;
  priority: number;
  evaluate: (context: PlanRuleContext) => ValidationIssue | null;
  correct?: (context: PlanRuleContext) => PlanWeek | null;
};

export type DetectImpactResult = {
  fromWeekIndex: number;
  affectedWeekIndexes: number[];
  severity: "low" | "medium" | "high";
  reason: string;
};

export type PlanDiffItem = {
  field: PlanEditableField;
  before: unknown;
  after: unknown;
};

export type PlanDiff = {
  weekStart: string;
  changes: PlanDiffItem[];
};

export type ValidationIssue = {
  weekStart: string;
  code:
    | "load_jump_too_large"
    | "objective_mismatch"
    | "missing_recovery"
    | "missing_preventive_block"
  | "knowledge_rule_violation"
  | "scientific_version_mismatch";
  message: string;
  severity: "info" | "warning" | "error";
  reference?: string;
  ruleId?: string;
  ruleType?: PlanRuleType;
  priority?: number;
  autoCorrected?: boolean;
};

export type ReplanResult = {
  nextPlan: PlanGraph;
  changedWeekIndexes: number[];
  diffs: PlanDiff[];
  warnings: string[];
  citations: string[];
};

type PlanBuildingContext = {
  knowledgeSnapshot: WeeklyAutopilotKnowledgeContext | null;
  phase: Phase;
  objective: Objective;
  progressionModel: ProgressionModel;
  loadTarget: number;
  intensityTarget: number;
  technicalFocus: string[];
  physicalFocus: string[];
  constraints: PlanConstraint[];
  knowledgeBaseVersionId?: string | null;
  knowledgeBaseVersionLabel?: string | null;
  knowledgeDomain?: KnowledgeBaseDomain | null;
  knowledgeRuleHighlights: string[];
  knowledgeReferences: WeeklyAutopilotKnowledgeReference[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const safeFinite = (value: unknown, fallback: number): number => {
  if (value == null) return fallback;
  if (typeof value === "string" && value.trim().length === 0) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeText = (value: string | null | undefined) => String(value ?? "").trim();

const lower = (value: string | null | undefined) => normalizeText(value).toLowerCase();

const toIsoDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;

const toWeekStartIso = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return toIsoDate(date);
};

const weekStartFromCycle = (cycleStartDate: string, weekNumber: number) => {
  const base = new Date(`${cycleStartDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return toWeekStartIso();
  base.setDate(base.getDate() + Math.max(0, weekNumber - 1) * 7);
  return toIsoDate(base);
};

const clonePlan = (plan: PlanGraph): PlanGraph => ({
  ...plan,
  weeks: plan.weeks.map((week) => ({
    ...week,
    technicalFocus: [...week.technicalFocus],
    physicalFocus: [...week.physicalFocus],
    constraints: week.constraints.map((item) => ({ ...item })),
    knowledgeRuleHighlights: [...week.knowledgeRuleHighlights],
    knowledgeReferences: week.knowledgeReferences.map((item) => ({ ...item })),
  })),
});

const cloneWeek = (week: PlanWeek): PlanWeek => ({
  ...week,
  technicalFocus: [...week.technicalFocus],
  physicalFocus: [...week.physicalFocus],
  constraints: week.constraints.map((item) => ({ ...item })),
  knowledgeRuleHighlights: [...week.knowledgeRuleHighlights],
  knowledgeReferences: week.knowledgeReferences.map((item) => ({ ...item })),
});

const hasValueChanged = (before: unknown, after: unknown) =>
  JSON.stringify(before) !== JSON.stringify(after);

const parseNumericTarget = (value: string | null | undefined, fallback = 0.5) => {
  const raw = normalizeText(value);
  if (!raw) return fallback;
  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return fallback;
  const parsed = Number(match[1].replace(",", "."));
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed > 10) return clamp(parsed / 10, 0, 1);
  return clamp(parsed / 10, 0, 1);
};

const phaseFromText = (value: string | null | undefined): Phase => {
  const text = lower(value);
  if (text.includes("recuper") || text.includes("recovery")) return "recovery";
  if (text.includes("compet")) return "taper";
  if (text.includes("pre")) return "intensification";
  if (text.includes("dev")) return "development";
  return "base";
};

const objectiveFromText = (value: string | null | undefined): Objective => {
  const text = lower(value);
  if (text.includes("recuper") || text.includes("resta")) return "recovery";
  if (text.includes("jogo") || text.includes("transicao") || text.includes("transfer")) {
    return "game_transfer";
  }
  if (text.includes("forca") || text.includes("potenc") || text.includes("carga")) {
    return "load_progression";
  }
  if (text.includes("consist") || text.includes("fundament") || text.includes("tecn")) {
    return "technical_consistency";
  }
  if (text.includes("performance") || text.includes("compet")) return "performance";
  return "motor_learning";
};

const progressionModelForPhase = (phase: Phase): ProgressionModel => {
  if (phase === "intensification") return "block";
  if (phase === "recovery") return "undulating";
  return "linear";
};

const technicalFocusForObjective = (objective: Objective, sourceText: string) => {
  if (objective === "recovery") return ["Recuperacao ativa", "Mobilidade e prevencao"];
  if (objective === "game_transfer") return ["Jogo condicionado", "Tomada de decisao"];
  if (objective === "load_progression") return ["Forca especifica", "Potencia controlada"];
  if (objective === "performance") return ["Ajuste de jogo", "Execucao sob pressao"];
  if (objective === "technical_consistency") return ["Fundamentos", "Controle e repeticao"];
  return [sourceText || "Aprendizagem motora", "Variacao com controle"];
};

const physicalFocusForObjective = (objective: Objective, sourceText: string) => {
  if (objective === "recovery") return ["Recuperacao", "Mobilidade"];
  if (objective === "game_transfer") return ["Manutencao", "Resistencia especifica"];
  if (objective === "load_progression") return ["Forca", "Pliometria controlada"];
  if (objective === "performance") return ["Potencia", "Prontidao"];
  if (objective === "technical_consistency") return ["Coordencao", "Controle de carga"];
  return [sourceText || "Base fisica", "Coordencao"];
};

const baselinePreventiveConstraintForObjective = (objective: Objective): PlanConstraint => ({
  type: "scientific",
  value: objective === "recovery" ? "Recuperacao ativa e controle de carga." : "Bloco preventivo obrigatorio.",
  severity: "high",
});

const buildKnowledgeConstraints = (context: WeeklyAutopilotKnowledgeContext | null): PlanConstraint[] => {
  if (!context) return [];
  const highlights = context.ruleHighlights
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 4);
  return highlights.map((item) => ({
    type: "scientific" as const,
    value: item,
    severity:
      /recuper|preven|seguran|lower|leve/i.test(item)
        ? "high"
        : /progress|increment|carga|intens/i.test(item)
          ? "medium"
          : "low",
  }));
};

const baseLoadForObjective = (objective: Objective) => {
  switch (objective) {
    case "recovery":
      return 0.35;
    case "technical_consistency":
      return 0.46;
    case "motor_learning":
      return 0.42;
    case "load_progression":
      return 0.58;
    case "game_transfer":
      return 0.66;
    case "performance":
      return 0.74;
    default:
      return 0.5;
  }
};

const baseIntensityForObjective = (objective: Objective) => {
  switch (objective) {
    case "recovery":
      return 0.32;
    case "technical_consistency":
      return 0.48;
    case "motor_learning":
      return 0.44;
    case "load_progression":
      return 0.62;
    case "game_transfer":
      return 0.68;
    case "performance":
      return 0.8;
    default:
      return 0.5;
  }
};

const domainCaps = (domain?: KnowledgeBaseDomain | null) => {
  if (domain === "youth_training") return { load: 0.68, intensity: 0.72 };
  if (domain === "general_fitness") return { load: 0.72, intensity: 0.76 };
  if (domain === "clinical") return { load: 0.55, intensity: 0.62 };
  if (domain === "performance") return { load: 0.88, intensity: 0.9 };
  return { load: 0.8, intensity: 0.84 };
};

const getLoadJumpThreshold = (progressionModel: ProgressionModel) => {
  if (progressionModel === "block") return 0.1;
  if (progressionModel === "undulating") return 0.08;
  return 0.12;
};

const hasPreventiveConstraint = (week: PlanWeek) =>
  week.constraints.some((item) => /prevent|preven|core|recuper|mob/i.test(item.value));

const buildPlanRules = (knowledgeSnapshot: WeeklyAutopilotKnowledgeContext): PlanRule[] => {
  const caps = domainCaps(knowledgeSnapshot.domain);

  return [
    {
      id: "scientific_version_match",
      label: "Base cientifica consistente",
      type: "hard",
      priority: 100,
      evaluate: (context) =>
        context.week.knowledgeBaseVersionId &&
        context.week.knowledgeBaseVersionId !== knowledgeSnapshot.versionId
          ? {
              weekStart: context.week.weekStart,
              code: "scientific_version_mismatch",
              message: "A semana usa uma versao cientifica diferente do snapshot atual.",
              severity: "warning",
              reference: knowledgeSnapshot.versionLabel,
              ruleId: "scientific_version_match",
              ruleType: "hard",
              priority: 100,
            }
          : null,
    },
    {
      id: "load_and_intensity_caps",
      label: "Limites de carga e intensidade",
      type: "hard",
      priority: 90,
      evaluate: (context) =>
        context.week.loadTarget > caps.load || context.week.intensityTarget > caps.intensity
          ? {
              weekStart: context.week.weekStart,
              code: "knowledge_rule_violation",
              message: "Carga ou intensidade ultrapassa o limite sugerido pela base.",
              severity: knowledgeSnapshot.domain === "clinical" ? "error" : "warning",
              reference: knowledgeSnapshot.ruleHighlights[0] ?? knowledgeSnapshot.versionLabel,
              ruleId: "load_and_intensity_caps",
              ruleType: "hard",
              priority: 90,
            }
          : null,
    },
    {
      id: "load_progression_safety",
      label: "Progressao de carga conservadora",
      type: "soft",
      priority: 80,
      evaluate: (context) => {
        if (!context.previousWeek) return null;
        const threshold = getLoadJumpThreshold(context.week.progressionModel);
        const delta = context.week.loadTarget - context.previousWeek.loadTarget;
        if (delta <= threshold) return null;
        return {
          weekStart: context.week.weekStart,
          code: "load_jump_too_large",
          message: "Incremento de carga acima do limite conservador da v1.",
          severity: "error",
          reference: knowledgeSnapshot.ruleHighlights[0] ?? knowledgeSnapshot.versionLabel,
          ruleId: "load_progression_safety",
          ruleType: "soft",
          priority: 80,
        };
      },
      correct: (context) => {
        if (!context.previousWeek) return null;
        const threshold = getLoadJumpThreshold(context.week.progressionModel);
        const nextLoad = clamp(context.previousWeek.loadTarget + threshold, 0.25, caps.load);
        const nextIntensity = clamp(
          Math.max(context.week.intensityTarget, nextLoad - 0.02),
          0.25,
          caps.intensity
        );
        return {
          ...cloneWeek(context.week),
          loadTarget: nextLoad,
          intensityTarget: nextIntensity,
        };
      },
    },
    {
      id: "recovery_control",
      label: "Semana de recovery controlada",
      type: "soft",
      priority: 70,
      evaluate: (context) =>
        context.week.objective === "recovery" && context.week.loadTarget > 0.5
          ? {
              weekStart: context.week.weekStart,
              code: "missing_recovery",
              message: "Semana marcada como recovery ainda esta pesada demais.",
              severity: "warning",
              ruleId: "recovery_control",
              ruleType: "soft",
              priority: 70,
            }
          : null,
      correct: (context) => {
        if (context.week.objective !== "recovery") return null;
        return {
          ...cloneWeek(context.week),
          loadTarget: Math.min(context.week.loadTarget, 0.45),
          intensityTarget: Math.min(context.week.intensityTarget, 0.42),
          constraints: hasPreventiveConstraint(context.week)
            ? [...context.week.constraints]
            : [
                baselinePreventiveConstraintForObjective(context.week.objective),
                ...context.week.constraints,
              ],
        };
      },
    },
    {
      id: "preventive_block_present",
      label: "Bloco preventivo explicito",
      type: "soft",
      priority: 60,
      evaluate: (context) =>
        context.week.objective === "technical_consistency" && !hasPreventiveConstraint(context.week)
          ? {
              weekStart: context.week.weekStart,
              code: "missing_preventive_block",
              message: "Semana tecnica deveria explicitar bloco preventivo.",
              severity: "warning",
              reference: knowledgeSnapshot.ruleHighlights[0] ?? knowledgeSnapshot.versionLabel,
              ruleId: "preventive_block_present",
              ruleType: "soft",
              priority: 60,
            }
          : null,
      correct: (context) =>
        context.week.objective === "technical_consistency"
          ? {
              ...cloneWeek(context.week),
              constraints: hasPreventiveConstraint(context.week)
                ? [...context.week.constraints]
                : [
                    baselinePreventiveConstraintForObjective(context.week.objective),
                    ...context.week.constraints,
                  ],
            }
          : null,
    },
    {
      id: "performance_alignment",
      label: "Performance com intensidade coerente",
      type: "soft",
      priority: 50,
      evaluate: (context) =>
        context.week.phase === "development" &&
        context.week.objective === "performance" &&
        context.week.intensityTarget < 0.55
          ? {
              weekStart: context.week.weekStart,
              code: "objective_mismatch",
              message: "Objetivo de performance com intensidade subalinhada.",
              severity: "warning",
              ruleId: "performance_alignment",
              ruleType: "soft",
              priority: 50,
            }
          : null,
      correct: (context) =>
        context.week.phase === "development" && context.week.objective === "performance"
          ? {
              ...cloneWeek(context.week),
              intensityTarget: Math.max(context.week.intensityTarget, 0.58),
              loadTarget: Math.max(context.week.loadTarget, 0.6),
            }
          : null,
    },
  ];
};

export type PlanRuleApplicationResult = {
  week: PlanWeek;
  issues: ValidationIssue[];
  correctedRuleIds: string[];
};

export const applyPlanRules = (
  week: PlanWeek,
  context: Omit<PlanRuleContext, "week">,
  options: { autoCorrect?: boolean } = {}
): PlanRuleApplicationResult => {
  const rules = buildPlanRules(context.knowledgeSnapshot).sort((a, b) => b.priority - a.priority);
  let workingWeek = cloneWeek(week);
  const issues: ValidationIssue[] = [];
  const correctedRuleIds: string[] = [];

  for (const rule of rules) {
    const evaluation = rule.evaluate({
      ...context,
      week: workingWeek,
    });
    if (!evaluation) continue;

    issues.push(evaluation);

    if (!options.autoCorrect || rule.type !== "soft" || workingWeek.locked || !rule.correct) {
      continue;
    }

    const corrected = rule.correct({
      ...context,
      week: workingWeek,
    });
    if (!corrected) continue;

    workingWeek = cloneWeek(corrected);
    correctedRuleIds.push(rule.id);
  }

  return {
    week: workingWeek,
    issues,
    correctedRuleIds,
  };
};

const buildWeekTargets = (
  context: PlanBuildingContext,
  weekNumber: number,
  previousWeek: PlanWeek | null
) => {
  const caps = domainCaps(context.knowledgeDomain);
  const recoverySlot = weekNumber > 1 && weekNumber % 4 === 0;
  const objective = recoverySlot ? "recovery" : context.objective;
  const phase = recoverySlot ? "recovery" : context.phase;
  const progressionModel = recoverySlot ? "undulating" : context.progressionModel;

  const baselineLoad = baseLoadForObjective(objective);
  const baselineIntensity = baseIntensityForObjective(objective);
  const previousLoad = previousWeek?.loadTarget ?? baselineLoad;
  const progressionStep =
    progressionModel === "block"
      ? weekNumber % 4 === 1
        ? 0.05
        : weekNumber % 4 === 0
          ? -0.12
          : 0.08
      : progressionModel === "undulating"
        ? weekNumber % 2 === 0
          ? -0.05
          : 0.06
        : 0.05;

  let loadTarget = baselineLoad;
  if (previousWeek) {
    loadTarget = previousLoad + progressionStep;
  }
  if (recoverySlot) {
    loadTarget = Math.min(loadTarget, previousLoad - 0.12);
  }

  if (context.knowledgeDomain === "youth_training") {
    loadTarget = Math.min(loadTarget, 0.66);
  }
  if (context.knowledgeDomain === "clinical") {
    loadTarget = Math.min(loadTarget, 0.52);
  }

  const intensityTarget = clamp(
    baselineIntensity + (loadTarget - baselineLoad) * 0.8,
    0.25,
    caps.intensity
  );
  loadTarget = clamp(loadTarget, 0.25, caps.load);

  return {
    objective,
    phase,
    progressionModel,
    loadTarget,
    intensityTarget,
    technicalFocus: technicalFocusForObjective(objective, context.knowledgeRuleHighlights[0] ?? ""),
    physicalFocus: physicalFocusForObjective(objective, context.knowledgeRuleHighlights[1] ?? ""),
    constraints: [
      baselinePreventiveConstraintForObjective(objective),
      ...buildKnowledgeConstraints(context.knowledgeSnapshot),
      ...(recoverySlot
        ? [
            {
              type: "scientific" as const,
              value: "Recovery week inserted by progression logic",
              severity: "high" as const,
            },
          ]
        : []),
    ],
  };
};

export const createPlanWeekFromClassPlan = (
  plan: ClassPlan,
  knowledgeSnapshot: WeeklyAutopilotKnowledgeContext | null,
  weekStart = toWeekStartIso(),
  dependsOnWeekStart: string | null = null
): PlanWeek => {
  const phase = phaseFromText(plan.phase);
  const objective = objectiveFromText(`${plan.theme} ${plan.technicalFocus} ${plan.physicalFocus}`);
  const progressionModel = progressionModelForPhase(phase);
  const intensityTarget = parseNumericTarget(plan.rpeTarget, baseIntensityForObjective(objective));
  const loadTarget = clamp(intensityTarget - 0.05, 0.25, 0.9);
  const constraints = normalizeText(plan.constraints)
    .split(/\s*\|\s*/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      type: /prevenc|seguran|recuper/i.test(item) ? ("scientific" as const) : ("volume_limit" as const),
      value: item,
      severity: /prevenc|seguran|recuper/i.test(item) ? ("high" as const) : ("medium" as const),
    }));

  return {
    weekStart,
    weekNumber: plan.weekNumber,
    phase,
    objective,
    loadTarget,
    intensityTarget,
    technicalFocus: [normalizeText(plan.technicalFocus) || objective],
    physicalFocus: [normalizeText(plan.physicalFocus) || "Base fisica"],
    constraints: [...buildKnowledgeConstraints(knowledgeSnapshot), ...constraints],
    progressionModel,
    knowledgeBaseVersionId: knowledgeSnapshot?.versionId ?? null,
    knowledgeBaseVersionLabel: knowledgeSnapshot?.versionLabel ?? null,
    knowledgeDomain: knowledgeSnapshot?.domain ?? null,
    knowledgeRuleHighlights: [...(knowledgeSnapshot?.ruleHighlights ?? [])],
    knowledgeReferences: [...(knowledgeSnapshot?.references ?? [])],
    dependsOnWeekStart,
    locked: plan.source === "MANUAL",
    source: plan.source,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
};

export const toPlanningGraphFromClassPlans = (input: {
  classId: string;
  organizationId: string;
  cycleStartDate: string;
  classPlans: ClassPlan[];
  knowledgeSnapshot: WeeklyAutopilotKnowledgeContext | null;
}): PlanGraph => {
  let previousWeekStart: string | null = null;
  const weeks = [...input.classPlans]
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((plan) => {
      const week = createPlanWeekFromClassPlan(
        plan,
        input.knowledgeSnapshot,
        weekStartFromCycle(input.cycleStartDate, plan.weekNumber),
        previousWeekStart
      );
      previousWeekStart = week.weekStart;
      return week;
    });
  return {
    classId: input.classId,
    organizationId: input.organizationId,
    cycleStartDate: input.cycleStartDate,
    revision: 1,
    weeks,
  };
};

export const toClassPlansFromPlanningGraph = (graph: PlanGraph): ClassPlan[] =>
  graph.weeks
    .slice()
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((week) => ({
      id: `cp_${graph.classId}_${week.weekNumber}_${week.weekStart}`,
      classId: graph.classId,
      startDate: week.weekStart,
      weekNumber: week.weekNumber,
      phase: week.phase,
      theme: week.technicalFocus[0] ?? week.objective,
      technicalFocus: week.technicalFocus[0] ?? week.objective,
      physicalFocus: week.physicalFocus[0] ?? "",
      constraints: week.constraints.map((item) => item.value).join(" | "),
      mvFormat: week.progressionModel,
      warmupProfile: week.knowledgeRuleHighlights[0] ?? "",
      jumpTarget: week.knowledgeRuleHighlights[1] ?? "",
      rpeTarget: String(Math.round(clamp(week.intensityTarget * 10, 1, 10))),
      source: week.source === "MIXED" ? "MANUAL" : week.source,
      createdAt: week.createdAt,
      updatedAt: week.updatedAt,
    }));

export const createDraftWeeklyPlanGraph = (input: {
  classId: string;
  organizationId: string;
  weekStart?: string;
  knowledgeSnapshot: WeeklyAutopilotKnowledgeContext | null;
  objective: Objective;
  phase?: Phase;
  technicalFocus?: string[];
  physicalFocus?: string[];
  summary?: string;
  source?: PlanSource;
}): PlanGraph => {
  const weekStart = input.weekStart ?? toWeekStartIso();
  const nowIso = new Date().toISOString();
  const phase = input.phase ?? "base";
  const objective = input.objective;
  const progressionModel = progressionModelForPhase(phase);
  const loadTarget = baseLoadForObjective(objective);
  const intensityTarget = baseIntensityForObjective(objective);

  return {
    classId: input.classId,
    organizationId: input.organizationId,
    cycleStartDate: weekStart,
    revision: 1,
    weeks: [
      {
        weekStart,
        weekNumber: 1,
        phase,
        objective,
        loadTarget,
        intensityTarget,
        technicalFocus: input.technicalFocus?.length
          ? input.technicalFocus
          : technicalFocusForObjective(objective, input.summary ?? ""),
        physicalFocus: input.physicalFocus?.length
          ? input.physicalFocus
          : physicalFocusForObjective(objective, input.summary ?? ""),
        constraints: [
          baselinePreventiveConstraintForObjective(objective),
          ...buildKnowledgeConstraints(input.knowledgeSnapshot),
        ],
        progressionModel,
        knowledgeBaseVersionId: input.knowledgeSnapshot?.versionId ?? null,
        knowledgeBaseVersionLabel: input.knowledgeSnapshot?.versionLabel ?? null,
        knowledgeDomain: input.knowledgeSnapshot?.domain ?? null,
        knowledgeRuleHighlights: [...(input.knowledgeSnapshot?.ruleHighlights ?? [])],
        knowledgeReferences: [...(input.knowledgeSnapshot?.references ?? [])],
        dependsOnWeekStart: null,
        locked: Boolean(input.source === "MANUAL"),
        source: input.source ?? "AUTO",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  };
};

export const applyUserChange = (plan: PlanGraph, change: PlanChange): PlanGraph => {
  const next = clonePlan(plan);
  const index = next.weeks.findIndex((week) => week.weekStart === change.weekStart);
  if (index < 0) return next;

  const target = next.weeks[index];
  const nextValue = change.nextValue;
  if (change.field === "technicalFocus" || change.field === "physicalFocus") {
    const value = Array.isArray(nextValue) ? nextValue.map(String) : [String(nextValue ?? "")];
    (target[change.field] as string[]) = value.filter(Boolean);
  } else if (change.field === "constraints") {
    const value = Array.isArray(nextValue)
      ? nextValue
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
          .map((item) => ({
            type: "scientific" as const,
            value: item,
            severity: "medium" as const,
          }))
      : [
          {
            type: "scientific" as const,
            value: String(nextValue ?? "").trim(),
            severity: "medium" as const,
          },
        ].filter((item) => item.value);
    target.constraints = value;
  } else if (change.field === "phase") {
    target.phase = String(nextValue ?? target.phase) as Phase;
  } else if (change.field === "objective") {
    target.objective = String(nextValue ?? target.objective) as Objective;
  } else if (change.field === "progressionModel") {
    target.progressionModel = String(nextValue ?? target.progressionModel) as ProgressionModel;
  } else if (change.field === "loadTarget") {
    target.loadTarget = clamp(safeFinite(nextValue, target.loadTarget), 0.25, 1);
  } else if (change.field === "intensityTarget") {
    target.intensityTarget = clamp(safeFinite(nextValue, target.intensityTarget), 0.25, 1);
  }

  target.locked = true;
  target.source = "MIXED";
  target.updatedAt = new Date().toISOString();
  next.revision += 1;
  return next;
};

export const detectImpact = (plan: PlanGraph, change: PlanChange): DetectImpactResult => {
  const index = plan.weeks.findIndex((week) => week.weekStart === change.weekStart);
  if (index < 0) {
    return {
      fromWeekIndex: 0,
      affectedWeekIndexes: [],
      severity: "low",
      reason: "Semana nao encontrada no plano.",
    };
  }

  const current = plan.weeks[index];
  const lastIndex = plan.weeks.length - 1;
  const fieldImpact = change.kind === "scientific_version_change" ? "high" : change.kind;
  const affectedWeekIndexes: number[] = [];
  let severity: "low" | "medium" | "high" = "low";

  if (change.kind === "scientific_version_change") {
    for (let i = 0; i <= lastIndex; i += 1) affectedWeekIndexes.push(i);
    severity = "high";
  } else if (change.kind === "objective_change" || change.field === "phase") {
    for (let i = index; i <= lastIndex; i += 1) affectedWeekIndexes.push(i);
    severity = "high";
  } else if (change.kind === "load_change") {
    const delta = Math.abs(Number(change.nextValue ?? 0) - Number(change.previousValue ?? 0));
    const baseSpan =
      current.progressionModel === "block"
        ? 3
        : current.progressionModel === "undulating"
          ? 2
          : 1;
    const span = delta >= 0.15 ? Math.max(3, baseSpan) : baseSpan;
    for (let i = index; i <= Math.min(lastIndex, index + span); i += 1) affectedWeekIndexes.push(i);
    severity = delta >= 0.15 || current.objective === "performance" ? "high" : "medium";
  } else if (change.kind === "exercise_change") {
    const span = current.objective === "game_transfer" ? 2 : 1;
    for (let i = index; i <= Math.min(lastIndex, index + span); i += 1) affectedWeekIndexes.push(i);
    severity = current.objective === "game_transfer" ? "high" : "medium";
  } else if (change.field === "progressionModel") {
    const span = String(change.nextValue ?? "").toLowerCase() === "block" ? 3 : 2;
    for (let i = index; i <= Math.min(lastIndex, index + span); i += 1) affectedWeekIndexes.push(i);
    severity = "medium";
  } else {
    for (let i = index; i <= lastIndex; i += 1) affectedWeekIndexes.push(i);
    severity = change.kind === "constraint_change" ? "medium" : "low";
  }

  return {
    fromWeekIndex: index,
    affectedWeekIndexes,
    severity,
    reason:
      change.reason ||
      (fieldImpact === "high"
        ? "Mudanca estrutural exige recalculo do restante do plano."
        : "Mudanca local com propagacao parcial."),
  };
};

const getNumericLoadScore = (week: PlanWeek) => clamp(week.loadTarget, 0, 1);

const getNextWeekForReplan = (
  week: PlanWeek,
  previousWeek: PlanWeek | null,
  knowledgeSnapshot: WeeklyAutopilotKnowledgeContext
) => {
  const stepContext: PlanBuildingContext = {
    knowledgeSnapshot,
    phase: week.phase,
    objective: week.objective,
    progressionModel: week.progressionModel,
    loadTarget: week.loadTarget,
    intensityTarget: week.intensityTarget,
    technicalFocus: week.technicalFocus,
    physicalFocus: week.physicalFocus,
    constraints: week.constraints,
    knowledgeBaseVersionId: knowledgeSnapshot.versionId,
    knowledgeBaseVersionLabel: knowledgeSnapshot.versionLabel,
    knowledgeDomain: knowledgeSnapshot.domain,
    knowledgeRuleHighlights: knowledgeSnapshot.ruleHighlights,
    knowledgeReferences: knowledgeSnapshot.references,
  };
  const built = buildWeekTargets(
    stepContext,
    week.weekNumber,
    previousWeek
  );

  return {
    ...week,
    phase: built.phase,
    objective: built.objective,
    loadTarget: built.loadTarget,
    intensityTarget: built.intensityTarget,
    progressionModel: built.progressionModel,
    technicalFocus: built.technicalFocus,
    physicalFocus: built.physicalFocus,
    constraints: built.constraints,
    knowledgeBaseVersionId: knowledgeSnapshot.versionId,
    knowledgeBaseVersionLabel: knowledgeSnapshot.versionLabel,
    knowledgeDomain: knowledgeSnapshot.domain,
    knowledgeRuleHighlights: [...knowledgeSnapshot.ruleHighlights],
    knowledgeReferences: [...knowledgeSnapshot.references],
    updatedAt: new Date().toISOString(),
  };
};

export const replanFrom = (
  plan: PlanGraph,
  startWeekIndex: number,
  knowledgeSnapshot: WeeklyAutopilotKnowledgeContext
): ReplanResult => {
  const nextPlan = clonePlan(plan);
  const changedWeekIndexes: number[] = [];
  const diffs: PlanDiff[] = [];
  const warnings: string[] = [];
  const citations: string[] = [];

  let previousWeek: PlanWeek | null = startWeekIndex > 0 ? nextPlan.weeks[startWeekIndex - 1] : null;

  for (let index = Math.max(0, startWeekIndex); index < nextPlan.weeks.length; index += 1) {
    const current = nextPlan.weeks[index];
    if (index === startWeekIndex) {
      const anchor = cloneWeek({
        ...current,
        dependsOnWeekStart: previousWeek?.weekStart ?? null,
        knowledgeBaseVersionId: knowledgeSnapshot.versionId,
        knowledgeBaseVersionLabel: knowledgeSnapshot.versionLabel,
        knowledgeDomain: knowledgeSnapshot.domain,
        knowledgeRuleHighlights: [...knowledgeSnapshot.ruleHighlights],
        knowledgeReferences: [...knowledgeSnapshot.references],
        updatedAt: new Date().toISOString(),
      });
      nextPlan.weeks[index] = anchor;
      previousWeek = anchor;
      continue;
    }

    if (current.locked) {
      previousWeek = current;
      continue;
    }

    const before = { ...current };
    const recalculated = getNextWeekForReplan(current, previousWeek, knowledgeSnapshot);
    recalculated.dependsOnWeekStart = previousWeek?.weekStart ?? null;
    const ruleOutcome = applyPlanRules(recalculated, {
      plan: nextPlan,
      index,
      previousWeek,
      nextWeek: nextPlan.weeks[index + 1] ?? null,
      knowledgeSnapshot,
    });
    nextPlan.weeks[index] = ruleOutcome.week;
    previousWeek = ruleOutcome.week;

    const diff = buildPlanDiff(before, ruleOutcome.week);
    if (diff.changes.length > 0) {
      changedWeekIndexes.push(index);
      diffs.push(diff);
    }

    ruleOutcome.issues.forEach((issue) => {
      const reference = issue.reference ? ` (${issue.reference})` : "";
      const message = issue.autoCorrected
        ? `Auto-corrigido: ${issue.message}${reference}`
        : issue.message + reference;
      if (issue.ruleType === "soft" && ruleOutcome.correctedRuleIds.includes(issue.ruleId ?? "")) {
        warnings.push(`Auto-corrigido: ${issue.message}${reference}`);
      } else if (issue.severity === "warning" || issue.severity === "error") {
        warnings.push(message);
      }
      if (issue.reference) {
        citations.push(issue.reference);
      }
    });
    if (ruleOutcome.week.progressionModel === "block") {
      citations.push(knowledgeSnapshot.versionLabel);
    }
  }

  nextPlan.revision += 1;

  return {
    nextPlan,
    changedWeekIndexes,
    diffs,
    warnings,
    citations: [...new Set(citations)].filter(Boolean),
  };
};

export const validatePlan = (
  plan: PlanGraph,
  knowledgeSnapshot: WeeklyAutopilotKnowledgeContext
): ValidationIssue[] => {
  return plan.weeks.flatMap((week, index) =>
    applyPlanRules(
      week,
      {
        plan,
        index,
        previousWeek: plan.weeks[index - 1] ?? null,
        nextWeek: plan.weeks[index + 1] ?? null,
        knowledgeSnapshot,
      },
      { autoCorrect: false }
    ).issues
  );
};

export const buildPlanDiff = (before: PlanWeek, after: PlanWeek): PlanDiff => {
  const changes: PlanDiffItem[] = [];
  const fieldMap: Record<PlanEditableField, [unknown, unknown]> = {
    phase: [before.phase, after.phase],
    objective: [before.objective, after.objective],
    loadTarget: [before.loadTarget, after.loadTarget],
    intensityTarget: [before.intensityTarget, after.intensityTarget],
    technicalFocus: [before.technicalFocus, after.technicalFocus],
    physicalFocus: [before.physicalFocus, after.physicalFocus],
    constraints: [before.constraints.map((item) => item.value), after.constraints.map((item) => item.value)],
    progressionModel: [before.progressionModel, after.progressionModel],
  };

  (Object.keys(fieldMap) as PlanEditableField[]).forEach((field) => {
    const [beforeValue, afterValue] = fieldMap[field];
    if (hasValueChanged(beforeValue, afterValue)) {
      changes.push({
        field,
        before: beforeValue,
        after: afterValue,
      });
    }
  });

  return {
    weekStart: after.weekStart,
    changes,
  };
};

export const buildPlanReviewSummary = (plan: PlanGraph, knowledgeSnapshot: WeeklyAutopilotKnowledgeContext) => {
  const issues = validatePlan(plan, knowledgeSnapshot);
  return {
    issues,
    ok: issues.length === 0,
    versionLabel: knowledgeSnapshot.versionLabel,
    domain: knowledgeSnapshot.domain,
  };
};
