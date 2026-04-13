import type { ClassGroup, Student } from "../../../core/models";
import {
    buildPedagogicalPlan,
    type PedagogicalPlanPackage,
} from "../../../core/pedagogical-planning";
import type { ClassGenerationContext } from "./build-class-generation-context";

type BuildPedagogicalInputFromContextParams = {
  classGroup: ClassGroup;
  students: Student[];
  generationContext: ClassGenerationContext;
  variationSeed?: number;
  dimensionGuidelines?: string[];
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const skillLabel: Record<ClassGenerationContext["primarySkill"], string> = {
  passe: "passe",
  levantamento: "levantamento",
  ataque: "ataque",
  saque: "saque",
  defesa: "defesa",
  bloqueio: "bloqueio",
  transicao: "transicao",
};

const progressionLabel: Record<ClassGenerationContext["progressionDimensionTarget"], string> = {
  consistencia: "consistencia",
  precisao: "precisao",
  pressao_tempo: "pressao de tempo",
  oposicao: "oposicao",
  tomada_decisao: "tomada de decisao",
  transferencia_jogo: "transferencia para o jogo",
};

const phaseIntentLabel: Record<ClassGenerationContext["phaseIntent"], string> = {
  exploracao_fundamentos: "exploracao de fundamentos",
  estabilizacao_tecnica: "estabilizacao tecnica",
  aceleracao_decisao: "aceleracao de decisao",
  transferencia_jogo: "transferencia para o jogo",
  pressao_competitiva: "pressao competitiva",
};

const pedagogicalIntentLabel: Record<ClassGenerationContext["pedagogicalIntent"], string> = {
  decision_making: "tomada de decisao",
  game_reading: "leitura de jogo",
  team_organization: "organizacao coletiva",
  technical_adjustment: "ajuste tecnico",
  pressure_adaptation: "adaptacao a pressao",
};

const loadIntentLabel: Record<ClassGenerationContext["weeklyLoadIntent"], string> = {
  baixo: "baixo",
  moderado: "moderado",
  alto: "alto",
};

const buildGenerationObjectiveFromContext = (context: ClassGenerationContext) => {
  const parts = [
    `Desenvolver ${skillLabel[context.primarySkill]}`,
    context.secondarySkill ? `com apoio de ${skillLabel[context.secondarySkill]}` : null,
    `com foco em ${progressionLabel[context.progressionDimensionTarget]}`,
    `e ${phaseIntentLabel[context.phaseIntent]}`,
    `priorizando ${pedagogicalIntentLabel[context.pedagogicalIntent]}`,
    context.dominantGapSkill && context.dominantGapSkill !== context.primarySkill
      ? `corrigindo lacunas recentes em ${skillLabel[context.dominantGapSkill]}`
      : null,
    context.mustProgressFrom ? `progredindo a partir de ${context.mustProgressFrom}` : null,
    context.mustAvoidRepeating.length
      ? `sem repetir ${context.mustAvoidRepeating.slice(0, 2).join(" e ")}`
      : null,
  ].filter(Boolean);

  return `${parts.join(", ")}.`;
};

const buildContextConstraints = (context: ClassGenerationContext) =>
  uniqueStrings([
    ...context.constraints,
    `Skill principal: ${skillLabel[context.primarySkill]}.`,
    context.secondarySkill ? `Skill secundaria: ${skillLabel[context.secondarySkill]}.` : null,
    `Intencao da fase: ${phaseIntentLabel[context.phaseIntent]}.`,
    `Carga esperada da semana: ${loadIntentLabel[context.weeklyLoadIntent]}.`,
    `Progressao alvo: ${progressionLabel[context.progressionDimensionTarget]}.`,
    context.mustProgressFrom ? `Progressao obrigatoria: ${context.mustProgressFrom}.` : null,
    context.mustAvoidRepeating.length
      ? `Evitar repetir ${context.mustAvoidRepeating.join(" | ")}.`
      : null,
    context.allowedDrillFamilies.length
      ? `Favorecer familias: ${context.allowedDrillFamilies.join(", ")}.`
      : null,
    context.forbiddenDrillFamilies.length
      ? `Evitar familias: ${context.forbiddenDrillFamilies.join(", ")}.`
      : null,
  ]);

const buildContextDimensionGuidelines = (
  context: ClassGenerationContext,
  dimensionGuidelines?: string[]
) =>
  uniqueStrings([
    ...(dimensionGuidelines ?? []),
    `Sessao orientada por ${phaseIntentLabel[context.phaseIntent]} com carga ${loadIntentLabel[context.weeklyLoadIntent]}.`,
    `Skill principal ${skillLabel[context.primarySkill]} com progressao ${progressionLabel[context.progressionDimensionTarget]}.`,
    context.secondarySkill
      ? `Apoio complementar em ${skillLabel[context.secondarySkill]}.`
      : null,
    context.mustProgressFrom ? `Encadear a partir de ${context.mustProgressFrom}.` : null,
    context.mustAvoidRepeating.length
      ? `Nao repetir: ${context.mustAvoidRepeating.join(" | ")}.`
      : null,
  ]);

export function buildPedagogicalInputFromContext(
  params: BuildPedagogicalInputFromContextParams
): PedagogicalPlanPackage {
  const objective = buildGenerationObjectiveFromContext(params.generationContext);

  return buildPedagogicalPlan({
    classGroup: params.classGroup,
    students: params.students,
    objective,
    context: "treinamento",
    constraints: buildContextConstraints(params.generationContext),
    materials: params.generationContext.materials,
    duration: params.generationContext.duration,
    variationSeed: params.variationSeed,
    periodizationPhase: params.generationContext.planningPhase,
    rpeTarget: params.generationContext.rpeTarget,
    weekNumber: params.generationContext.weekNumber,
    dimensionGuidelines: buildContextDimensionGuidelines(
      params.generationContext,
      params.dimensionGuidelines
    ),
  });
}
