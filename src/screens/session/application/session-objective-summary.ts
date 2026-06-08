import type { TrainingPlan } from "../../../core/models";
import { normalizeDisplayText } from "../../../utils/text-normalization";

const skillLabels: Record<string, string> = {
  saque: "saque",
  recepcao: "recepcao",
  levantamento: "levantamento",
  ataque: "ataque",
  bloqueio: "bloqueio",
  defesa: "defesa",
  passe: "passe",
  deslocamento: "deslocamento",
};

const progressionLabels: Record<string, string> = {
  controle: "controle",
  consistencia: "consistencia",
  precisao: "precisao",
  decisao: "tomada de decisao",
  transferencia: "transferencia para o jogo",
  cooperacao: "cooperacao",
};

const cleanText = (value: string | null | undefined) => normalizeDisplayText(value).trim();

const cleanActivityName = (value: string | null | undefined) => {
  const text = cleanText(value);
  return text.replace(/^\s*\d+\s*min(?:utos?)?\s*[-•:]?\s*/i, "").trim();
};

const inferSkillFromText = (value: string) => {
  const text = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(passe|recepcao|manchete|primeiro contato)\b/.test(text)) return "passe";
  if (/\b(levantamento|levantador|levantar)\b/.test(text)) return "levantamento";
  if (/\b(ataque|atacar|cortada)\b/.test(text)) return "ataque";
  if (/\b(bloqueio|bloquear)\b/.test(text)) return "bloqueio";
  if (/\b(defesa|defender)\b/.test(text)) return "defesa";
  if (/\b(saque|sacar)\b/.test(text)) return "saque";
  return "";
};

const resolveContentSkill = (plan: TrainingPlan) => {
  const structuredActivities = [
    ...(plan.pedagogy?.blocks?.main?.activities ?? []),
    ...(plan.pedagogy?.blocks?.warmup?.activities ?? []),
    ...(plan.pedagogy?.blocks?.cooldown?.activities ?? []),
  ];
  const primarySkill = structuredActivities.find((activity) =>
    cleanText(activity.primarySkill)
  )?.primarySkill;

  if (primarySkill) return primarySkill;

  const currentContent = [
    plan.title,
    ...(plan.main ?? []),
    ...(plan.warmup ?? []),
    ...structuredActivities.flatMap((activity) => [
      activity.name,
      activity.description,
      activity.organization,
      activity.execution,
      activity.coachFocus,
      activity.successCriteria,
      activity.adaptation,
    ]),
  ].join(" ");

  return inferSkillFromText(currentContent);
};

const formatList = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
};

export const buildSessionObjectiveFromPlanContent = (plan: TrainingPlan | null | undefined) => {
  if (!plan) return "";

  const contentSkill = resolveContentSkill(plan);
  const storedFocusSkill = cleanText(plan.pedagogy?.focus?.skill);
  const focusSkill = contentSkill || storedFocusSkill;
  const skillLabel = focusSkill ? skillLabels[focusSkill] ?? focusSkill : "";
  const progression = cleanText(plan.pedagogy?.progression?.dimension);
  const progressionLabel = progression
    ? progressionLabels[progression] ?? progression
    : "";

  const mainActivities = (
    plan.pedagogy?.blocks?.main?.activities?.map((activity) => activity.name) ??
    plan.main ??
    []
  )
    .map((item) => cleanActivityName(item))
    .filter(Boolean)
    .slice(0, 2);

  const warmupActivities = (
    plan.pedagogy?.blocks?.warmup?.activities?.map((activity) => activity.name) ??
    plan.warmup ??
    []
  )
    .map((item) => cleanActivityName(item))
    .filter(Boolean)
    .slice(0, 1);

  const activityFocus = mainActivities.length
    ? formatList(mainActivities)
    : warmupActivities.length
      ? formatList(warmupActivities)
      : cleanText(plan.title);

  if (skillLabel && activityFocus && progressionLabel) {
    return `Desenvolver ${skillLabel} em ${activityFocus}, priorizando ${progressionLabel}.`;
  }

  if (skillLabel && activityFocus) {
    return `Desenvolver ${skillLabel} em ${activityFocus}.`;
  }

  if (activityFocus) {
    return `Conduzir ${activityFocus} com intencionalidade pedagogica.`;
  }

  return "";
};

export const resolveSessionObjectiveText = (plan: TrainingPlan | null | undefined) => {
  const storedObjective = cleanText(plan?.pedagogy?.sessionObjective);
  if (plan?.pedagogy?.sessionObjectiveSource === "manual" && storedObjective) {
    return storedObjective;
  }

  const contentObjective = buildSessionObjectiveFromPlanContent(plan);
  return (
    contentObjective ||
    storedObjective ||
    cleanText(plan?.pedagogy?.objective?.description) ||
    cleanText(plan?.title) ||
    "Conduzir treino do dia"
  );
};
