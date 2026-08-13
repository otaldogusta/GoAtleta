import type { ClassPlan, DailyLessonPlan, TrainingPlan, VolleyballSkill } from "../models";

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const SKILL_SIGNALS: { skill: VolleyballSkill; pattern: RegExp }[] = [
  { skill: "passe", pattern: /\b(passe|passes|recep\w*|manchete|primeiro contato)\b/ },
  { skill: "levantamento", pattern: /\b(levant\w*|segundo contato|toque)\b/ },
  { skill: "ataque", pattern: /\b(ataq\w*|cortada|spike)\b/ },
  { skill: "bloqueio", pattern: /\b(bloq\w*|block)\b/ },
  { skill: "defesa", pattern: /\b(defes\w*|dig|cobertura)\b/ },
  { skill: "saque", pattern: /\b(saque|saques|sacar|serv\w*)\b/ },
  { skill: "transicao", pattern: /\b(trans\w*|virada|jogo)\b/ },
];

export const extractVolleyballSkills = (value: unknown): VolleyballSkill[] => {
  const text = normalizeText(value);
  return SKILL_SIGNALS
    .map(({ skill, pattern }) => {
      const match = pattern.exec(text);
      return match ? { skill, index: match.index } : null;
    })
    .filter((match): match is { skill: VolleyballSkill; index: number } => Boolean(match))
    .sort((left, right) => left.index - right.index)
    .map((match) => match.skill)
    .filter((skill, index, list) => list.indexOf(skill) === index);
};

export const resolveClassPlanSkills = (classPlan?: ClassPlan | null) => {
  const themeSkills = extractVolleyballSkills(classPlan?.theme);
  const technicalFocusSkills = extractVolleyballSkills(classPlan?.technicalFocus);
  if (themeSkills.length && technicalFocusSkills.length) {
    const overlap = themeSkills.filter((skill) => technicalFocusSkills.includes(skill));
    if (overlap.length) return overlap;
    return themeSkills.length > 1 ? themeSkills : technicalFocusSkills;
  }
  if (technicalFocusSkills.length) return technicalFocusSkills;
  if (themeSkills.length) return themeSkills;
  return extractVolleyballSkills(
    [classPlan?.generalObjective, classPlan?.specificObjective]
      .filter(Boolean)
      .join(" ")
  );
};

export const resolveTrainingPlanPrimarySkill = (
  plan?: TrainingPlan | null
): VolleyballSkill | null =>
  plan?.pedagogy?.decisionTrace?.decision.primarySkill ??
  extractVolleyballSkills(
    [
      plan?.pedagogy?.focus?.skill,
      plan?.pedagogy?.sessionObjective,
      plan?.title,
      ...(plan?.warmup ?? []),
      ...(plan?.main ?? []),
    ]
      .filter(Boolean)
      .join(" ")
  )[0] ??
  null;

export const isTrainingPlanAlignedWithClassPlan = (params: {
  plan?: TrainingPlan | null;
  classPlan?: ClassPlan | null;
}) => {
  const periodizationSkills = resolveClassPlanSkills(params.classPlan);
  const planSkill = resolveTrainingPlanPrimarySkill(params.plan);
  if (!periodizationSkills.length || !planSkill) return true;
  return periodizationSkills.includes(planSkill);
};

export const shouldRegenerateInconsistentAutomaticPlan = (params: {
  plan?: TrainingPlan | null;
  classPlan?: ClassPlan | null;
  dailyLessonPlan?: DailyLessonPlan | null;
}) => {
  const { plan } = params;
  if (!plan) return false;
  if (params.dailyLessonPlan?.syncStatus === "overridden") return false;
  const hasLegacyAutomaticEvidence =
    !plan.origin &&
    Boolean(
      plan.generatedAt ||
        plan.inputHash ||
        plan.pedagogy?.decisionTrace ||
        plan.pedagogy?.generationExplanation
    );
  const isReplaceableAutomaticPlan = plan.origin === "auto" || hasLegacyAutomaticEvidence;
  return isReplaceableAutomaticPlan && !isTrainingPlanAlignedWithClassPlan(params);
};
