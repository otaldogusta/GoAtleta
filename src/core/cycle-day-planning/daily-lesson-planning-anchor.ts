import type { DailyLessonPlan, LessonBlock, VolleyballSkill } from "../models";
import type { SessionPlanningDailyPlanAnchor } from "../session-planning-context-contract";

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const cleanText = (value: unknown) => String(value ?? "").trim();

const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((value) => cleanText(value)).filter(Boolean))];

const skillSignals: { skill: VolleyballSkill; pattern: RegExp }[] = [
  { skill: "passe", pattern: /\b(passe|passes|recep\w*|manchete|primeiro contato)\b/ },
  { skill: "levantamento", pattern: /\b(levant\w*|segundo contato|toque)\b/ },
  { skill: "ataque", pattern: /\b(ataq\w*|cortada|spike)\b/ },
  { skill: "bloqueio", pattern: /\b(bloq\w*|block)\b/ },
  { skill: "defesa", pattern: /\b(defes\w*|dig|cobertura)\b/ },
  { skill: "saque", pattern: /\b(saque|saques|sacar|serv\w*)\b/ },
  { skill: "transicao", pattern: /\b(trans\w*|virada|jogo)\b/ },
];

const parseAgeBandStart = (value: string | null | undefined) => {
  const match = String(value ?? "").match(/(\d{1,2})/);
  return match ? Number(match[1]) : null;
};

const extractSkills = (text: string): VolleyballSkill[] =>
  skillSignals
    .map(({ skill, pattern }) => {
      const match = pattern.exec(text);
      return match ? { skill, index: match.index } : null;
    })
    .filter((match): match is { skill: VolleyballSkill; index: number } => Boolean(match))
    .sort((left, right) => left.index - right.index)
    .map((match) => match.skill)
    .filter((skill, index, list) => list.indexOf(skill) === index);

const parseBlocksJson = (value: string | undefined): LessonBlock[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((raw): LessonBlock | null => {
        if (!raw || typeof raw !== "object") return null;
        const item = raw as {
          key?: unknown;
          label?: unknown;
          activities?: unknown;
          durationMinutes?: unknown;
        };
        if (item.key !== "warmup" && item.key !== "main" && item.key !== "cooldown") {
          return null;
        }
        const activities = Array.isArray(item.activities)
          ? item.activities
              .map((activity): { name: string; description: string } | null => {
                if (!activity || typeof activity !== "object") return null;
                const maybe = activity as { name?: unknown; description?: unknown };
                const name = cleanText(maybe.name);
                const description = cleanText(maybe.description);
                if (!name && !description) return null;
                return { name, description };
              })
              .filter(
                (activity): activity is { name: string; description: string } =>
                  Boolean(activity)
              )
          : [];
        return {
          key: item.key,
          label: cleanText(item.label) || item.key,
          durationMinutes:
            typeof item.durationMinutes === "number" && Number.isFinite(item.durationMinutes)
              ? item.durationMinutes
              : 0,
          activities,
        };
      })
      .filter((block): block is LessonBlock => Boolean(block));
  } catch {
    return [];
  }
};

const fallbackBlocks = (plan: DailyLessonPlan): LessonBlock[] => [
  {
    key: "warmup",
    label: "Aquecimento",
    durationMinutes: 0,
    activities: plan.warmup ? [{ name: "Aquecimento planejado", description: plan.warmup }] : [],
  },
  {
    key: "main",
    label: "Parte principal",
    durationMinutes: 0,
    activities: plan.mainPart
      ? [{ name: "Parte principal planejada", description: plan.mainPart }]
      : [],
  },
  {
    key: "cooldown",
    label: "Volta à calma",
    durationMinutes: 0,
    activities: plan.cooldown
      ? [{ name: "Volta à calma planejada", description: plan.cooldown }]
      : [],
  },
];

const buildPlannedBlocks = (plan: DailyLessonPlan) => {
  const parsed = parseBlocksJson(plan.blocksJson);
  const blocks = parsed.length ? parsed : fallbackBlocks(plan);
  return blocks.map((block) => ({
    key: block.key,
    label: cleanText(block.label),
    activities: (block.activities ?? [])
      .map((activity) => uniqueStrings([activity.name, activity.description]).join(": "))
      .filter(Boolean)
      .slice(0, 4),
  }));
};

const extractObjectiveHint = (plan: DailyLessonPlan) => {
  const observations = cleanText(plan.observations);
  const objectiveMatch = observations.match(/objetivo da aula\s*:\s*([^.\n]+)/i);
  return cleanText(objectiveMatch?.[1]) || cleanText(plan.title) || undefined;
};

const resolveConflictSignals = (params: {
  text: string;
  ageBand?: string;
}): Pick<SessionPlanningDailyPlanAnchor, "conflictResolved" | "conflictReasons" | "constraintHints"> => {
  const text = normalizeText(params.text);
  const ageStart = parseAgeBandStart(params.ageBand);
  const has2x2 = /\b2\s*x\s*2\b/.test(text);
  const has3x3 = /\b3\s*x\s*3\b/.test(text);
  const conflictReasons: string[] = [];
  const constraintHints: string[] = [];

  if (has2x2 && has3x3) {
    if (ageStart !== null && ageStart <= 9) {
      conflictReasons.push("Plano diario mistura 2x2 e 3x3; para 07-09, priorizar 2x2 e usar 3x3 como progressao curta.");
      constraintHints.push("Resolver conflito 2x2/3x3 com base em 2x2 e progressao curta para 3x3.");
    } else {
      conflictReasons.push("Plano diario mistura 2x2 e 3x3; tratar como progressao do menor para o maior formato.");
      constraintHints.push("Resolver conflito 2x2/3x3 como progressao de jogo reduzido.");
    }
  }

  return {
    conflictResolved: conflictReasons.length > 0,
    conflictReasons,
    constraintHints,
  };
};

const extractConstraintHints = (text: string) => {
  const normalized = normalizeText(text);
  return uniqueStrings([
    /alvo|zona/.test(normalized) ? "Manter zona-alvo simples no plano aplicado." : null,
    /cooper|continuidade|sequencia/.test(normalized)
      ? "Priorizar cooperacao e continuidade antes de aumentar oposicao."
      : null,
    /mini\s*jogo|jogo curto|jogo reduzido/.test(normalized)
      ? "Usar jogo reduzido coerente com a idade e a fase."
      : null,
    /estac/.test(normalized) ? "Evitar estacoes longas com fila; manter grupos pequenos." : null,
  ]);
};

export const buildDailyLessonPlanningAnchor = (params: {
  dailyLessonPlan?: DailyLessonPlan | null;
  sessionDate: string;
  ageBand?: string;
}): SessionPlanningDailyPlanAnchor | null => {
  const plan = params.dailyLessonPlan;
  if (!plan?.id || !plan.weeklyPlanId || !plan.date) return null;
  if (plan.date !== params.sessionDate) return null;

  const plannedBlocks = buildPlannedBlocks(plan);
  const fullText = uniqueStrings([
    plan.title,
    plan.warmup,
    plan.mainPart,
    plan.cooldown,
    plan.observations,
    ...plannedBlocks.flatMap((block) => block.activities),
  ]).join(" ");
  const conflictSignals = resolveConflictSignals({
    text: fullText,
    ageBand: params.ageBand,
  });

  return {
    schemaVersion: 1,
    dailyPlanId: plan.id,
    weeklyPlanId: plan.weeklyPlanId,
    sessionDate: plan.date,
    title: cleanText(plan.title),
    objectiveHint: extractObjectiveHint(plan),
    plannedBlocks,
    observations: cleanText(plan.observations) || undefined,
    syncStatus: plan.syncStatus,
    skillHints: extractSkills(normalizeText(fullText)),
    activityHints: uniqueStrings([
      plan.title,
      ...plannedBlocks.flatMap((block) => block.activities.map((activity) => activity.split(":")[0])),
    ]).slice(0, 8),
    constraintHints: uniqueStrings([
      ...extractConstraintHints(fullText),
      ...conflictSignals.constraintHints,
    ]),
    conflictResolved: conflictSignals.conflictResolved,
    conflictReasons: conflictSignals.conflictReasons,
  };
};
