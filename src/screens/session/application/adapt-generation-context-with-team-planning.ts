import type { TeamPlanningContext } from "../../../core/team-context";
import type { ClassGenerationContext } from "./build-class-generation-context";

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const mapIncreasedLoad = (value: ClassGenerationContext["weeklyLoadIntent"]) => {
  if (value === "baixo") return "moderado";
  return "alto";
};

export function adaptGenerationContextWithTeamPlanning(options: {
  generationContext: ClassGenerationContext;
  teamPlanningContext?: TeamPlanningContext | null;
}): ClassGenerationContext {
  const { generationContext, teamPlanningContext } = options;
  if (!teamPlanningContext) return generationContext;

  let weeklyLoadIntent = generationContext.weeklyLoadIntent;
  if (teamPlanningContext.recommendedLoadBias === "reduce") {
    weeklyLoadIntent = "baixo";
  } else if (teamPlanningContext.recommendedLoadBias === "increase") {
    weeklyLoadIntent = mapIncreasedLoad(generationContext.weeklyLoadIntent);
  }

  let phaseIntent = generationContext.phaseIntent;
  let pedagogicalIntent = generationContext.pedagogicalIntent;
  let primarySkill = generationContext.primarySkill;
  let secondarySkill = generationContext.secondarySkill;

  const allowedDrillFamilies = [...generationContext.allowedDrillFamilies];
  const forbiddenDrillFamilies = [...generationContext.forbiddenDrillFamilies];
  const constraints = [...generationContext.constraints];

  if (teamPlanningContext.planningMode === "pre_match") {
    phaseIntent = "transferencia_jogo";
    pedagogicalIntent = "team_organization";
    if (primarySkill === "bloqueio") {
      secondarySkill = secondarySkill ?? "passe";
    }
    allowedDrillFamilies.push("jogo_condicionado", "cooperacao", "alvo_zona");
    forbiddenDrillFamilies.push("estacoes");
    constraints.push(
      "Contexto competitivo: pré-jogo.",
      "Priorizar organização coletiva, comunicação e ajustes táticos.",
      "Evitar fadiga excessiva, carga alta e volume desnecessário."
    );
  } else if (teamPlanningContext.planningMode === "post_match") {
    phaseIntent = "estabilizacao_tecnica";
    pedagogicalIntent = "technical_adjustment";
    allowedDrillFamilies.push("cooperacao", "alvo_zona");
    constraints.push(
      "Contexto competitivo: pós-jogo.",
      "Priorizar recuperação ativa, correções do jogo e estabilidade técnica."
    );
  } else if (teamPlanningContext.planningMode === "recovery") {
    phaseIntent = "estabilizacao_tecnica";
    pedagogicalIntent = "technical_adjustment";
    constraints.push(
      "Contexto competitivo: recuperação.",
      "Evitar densidade excessiva e manter clareza de execução."
    );
  } else if (teamPlanningContext.planningMode === "evaluation") {
    phaseIntent = "aceleracao_decisao";
    pedagogicalIntent = "game_reading";
    constraints.push(
      "Contexto competitivo: avaliação.",
      "Usar tarefas com observação dirigida e critérios claros."
    );
  }

  constraints.push(
    ...teamPlanningContext.focusHints.map((item) => `Foco contextual: ${item}.`),
    ...teamPlanningContext.avoidHints.map((item) => `Evitar: ${item}.`)
  );

  return {
    ...generationContext,
    primarySkill,
    secondarySkill,
    phaseIntent,
    pedagogicalIntent,
    weeklyLoadIntent,
    constraints: uniqueStrings(constraints),
    allowedDrillFamilies: uniqueStrings(allowedDrillFamilies),
    forbiddenDrillFamilies: uniqueStrings(forbiddenDrillFamilies),
  };
}
