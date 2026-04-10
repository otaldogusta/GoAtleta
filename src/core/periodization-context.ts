import type { ClassPlan, PeriodizationContext, PedagogicalPeriodizationLoad, TrainingPlanPedagogy } from "./models";

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalize = (value: string) => stripAccents(String(value ?? "")).toLowerCase().trim();

const splitList = (value?: string | null) =>
  String(value ?? "")
    .split(/[\n,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const isCompetitivePhase = (value: string) => {
  const normalized = normalize(value);
  return (
    normalized.includes("compet") ||
    normalized.includes("pre-compet") ||
    normalized.includes("desenvolv") ||
    normalized.includes("base")
  );
};

const isPedagogicalPhase = (value: string) => {
  const normalized = normalize(value);
  return (
    normalized.includes("fundament") ||
    normalized.includes("consolid") ||
    normalized.includes("especializ") ||
    normalized.includes("aprendiz") ||
    normalized.includes("formacao")
  );
};

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  const output: string[] = [];
  values.forEach((value) => {
    const normalized = normalize(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(value.trim());
  });
  return output;
};

const mapLoadToPeriodizationLoad = (
  load?: TrainingPlanPedagogy["load"] | null
): PedagogicalPeriodizationLoad | undefined => {
  if (!load) return undefined;
  const level =
    load.volume === "alto" ? "alto" : load.volume === "moderado" ? "medio" : "baixo";
  return {
    level,
    trend: "estavel",
  };
};

export const resolvePeriodizationModel = (input: {
  classPlan?: Pick<ClassPlan, "phase" | "rpeTarget"> | null;
  planningMode?: string | null;
  competitivePhase?: string | null;
}): PeriodizationContext["model"] => {
  const planningMode = normalize(input.planningMode ?? "");
  const planPhase = input.classPlan?.phase ?? "";
  const competitiveSignal =
    planningMode === "adulto-competitivo" ||
    isCompetitivePhase(input.competitivePhase ?? "") ||
    isCompetitivePhase(planPhase) ||
    Boolean(input.classPlan?.rpeTarget?.trim() && !isPedagogicalPhase(planPhase));
  const pedagogicalSignal = isPedagogicalPhase(planPhase);

  if (competitiveSignal && pedagogicalSignal) return "hibrido";
  if (competitiveSignal) return "rendimento";
  return "formacao";
};

export const buildPeriodizationContext = (input: {
  objective: string;
  focus: string;
  classPlan?: Pick<
    ClassPlan,
    "phase" | "theme" | "technicalFocus" | "physicalFocus" | "constraints" | "rpeTarget"
  > | null;
  constraints?: string[];
  pedagogicalIntent?: string;
  load?: TrainingPlanPedagogy["load"] | null;
  planningMode?: string | null;
  competitivePhase?: string | null;
}): PeriodizationContext => {
  const model = resolvePeriodizationModel({
    classPlan: input.classPlan,
    planningMode: input.planningMode,
    competitivePhase: input.competitivePhase,
  });
  const classPlanConstraints = splitList(input.classPlan?.constraints);
  const constraints = uniqueStrings([...(input.constraints ?? []), ...classPlanConstraints]);
  const objective = String(input.objective ?? "").trim();
  const focus = String(input.focus ?? "").trim();
  const cyclePhase = String(input.classPlan?.phase ?? "").trim() || undefined;
  const load = mapLoadToPeriodizationLoad(input.load);

  const pedagogicalIntent =
    input.pedagogicalIntent?.trim() ||
    (model === "rendimento"
      ? "Organizar a carga e a especificidade com controle"
      : model === "hibrido"
      ? "Equilibrar aprendizagem pedagógica e exigência competitiva"
      : "Desenvolver aprendizagem progressiva com consolidação de fundamentos");

  const source =
    input.planningMode === "adulto-competitivo"
      ? "competitive_profile"
      : input.classPlan
      ? "class_plan"
      : "default";

  return {
    model,
    objective,
    focus,
    constraints: constraints.length ? constraints : undefined,
    pedagogicalIntent,
    load,
    cyclePhase,
    source,
  };
};
