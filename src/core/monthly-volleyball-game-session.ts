import type {
  ClassCalendarException,
  ClassGroup,
  SessionStrategy,
} from "./models";
import type {
  LessonPlanDraft,
  PedagogicalActivity,
  PedagogicalPlanPackage,
} from "./pedagogical-planning";
import { resolveSportProfile } from "./periodization-basics";
import { buildSessionCalendar } from "./session-calendar-engine";

export type MonthlyVolleyballGameSessionPolicy = {
  applies: boolean;
  sessionDate: string;
  lastSessionDate: string | null;
  warmupMinutes: number;
  gameMinutes: number;
  cooldownMinutes: number;
  reason: string;
};

type ResolveMonthlyVolleyballGameSessionParams = {
  classGroup: Pick<
    ClassGroup,
    "daysOfWeek" | "durationMinutes" | "daysPerWeek" | "modality"
  >;
  sessionDate: string;
  calendarExceptions?: ClassCalendarException[];
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const resolveMonthBounds = (sessionDate: string) => {
  if (!ISO_DATE_PATTERN.test(sessionDate)) return null;
  const [year, month] = sessionDate.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  const monthToken = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${monthToken}-01`,
    endDate: `${year}-${monthToken}-${String(lastDay).padStart(2, "0")}`,
  };
};

export const resolveMonthlyVolleyballGameDurations = (durationMinutes: number) => {
  const total = Math.max(15, Math.round(Number(durationMinutes) || 60));
  const warmupMinutes = total >= 45 ? 10 : Math.max(4, Math.round(total * 0.2));
  const cooldownMinutes = total >= 30 ? 5 : Math.max(2, Math.round(total * 0.1));
  return {
    warmupMinutes,
    gameMinutes: Math.max(1, total - warmupMinutes - cooldownMinutes),
    cooldownMinutes,
  };
};

export const resolveMonthlyVolleyballGameSession = (
  params: ResolveMonthlyVolleyballGameSessionParams
): MonthlyVolleyballGameSessionPolicy => {
  const durations = resolveMonthlyVolleyballGameDurations(
    params.classGroup.durationMinutes
  );
  const bounds = resolveMonthBounds(params.sessionDate);
  const isVolleyball =
    resolveSportProfile(params.classGroup.modality) === "voleibol";

  if (!bounds || !isVolleyball) {
    return {
      applies: false,
      sessionDate: params.sessionDate,
      lastSessionDate: null,
      ...durations,
      reason: isVolleyball
        ? "Data da aula invalida para a regra mensal."
        : "A regra mensal de jogo consolidado se aplica apenas ao voleibol.",
    };
  }

  const calendar = buildSessionCalendar({
    classGroup: params.classGroup,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    exceptions: params.calendarExceptions,
  });
  const lastSessionDate = calendar.sessions.at(-1)?.date ?? null;
  const applies = lastSessionDate === params.sessionDate;

  return {
    applies,
    sessionDate: params.sessionDate,
    lastSessionDate,
    ...durations,
    reason: applies
      ? "Ultima aula real do mes reservada para aquecimento e jogo consolidado."
      : "A aula nao e a ultima sessao real do mes.",
  };
};

export const applyMonthlyVolleyballGameSessionToStrategy = (
  strategy: SessionStrategy,
  policy: MonthlyVolleyballGameSessionPolicy
): SessionStrategy => {
  if (!policy.applies) return strategy;
  return {
    ...strategy,
    progressionDimension: "transferencia_jogo",
    pedagogicalIntent: "team_organization",
    drillFamilies: ["jogo_consolidado"],
    forbiddenDrillFamilies: [
      ...new Set([
        ...strategy.forbiddenDrillFamilies,
        "tecnica_isolada",
        "repeticao_sem_jogo",
      ]),
    ],
    oppositionLevel: "high",
    timePressureLevel: "medium",
    gameTransferLevel: "high",
  };
};

const buildMonthlyGameDraft = (
  source: LessonPlanDraft,
  policy: MonthlyVolleyballGameSessionPolicy
): LessonPlanDraft => {
  const warmupActivity: PedagogicalActivity = {
    id: `jogo-mensal-aquecimento-${policy.sessionDate}`,
    name: "Aquecimento para o jogo",
    description:
      "Mobilidade, deslocamentos e contato leve com a bola para preparar o grupo. Sem treino técnico específico.",
    stage: "warmup",
    organization: "Grupo todo, com ativação progressiva e bola.",
    coachFocus: "Preparar com segurança e liberar o maior tempo possível para o jogo.",
  };
  const gameActivity: PedagogicalActivity = {
    id: `jogo-mensal-principal-${policy.sessionDate}`,
    name: "Jogo consolidado do mês",
    description:
      "Organizar equipes equilibradas e realizar jogo contínuo. As intervenções do professor ficam restritas à organização, segurança, participação, rodízio e fair play; não há treino isolado de fundamentos.",
    stage: "game",
    organization: "Equipes equilibradas, com rodízio para garantir participação.",
    simpleRule:
      "Manter o jogo fluido e adaptar apenas as regras necessárias à segurança e à participação.",
    coachFocus: "Organização coletiva, autonomia, leitura do jogo e convivência.",
    successCriteria: "Todos participam e o jogo mantém continuidade com segurança.",
  };
  const cooldownActivity: PedagogicalActivity = {
    id: `jogo-mensal-fechamento-${policy.sessionDate}`,
    name: "Volta à calma e fechamento",
    description:
      "Recuperação breve, hidratação e conversa rápida sobre participação, cooperação e jogo.",
    stage: "cooldown",
    coachFocus: "Recuperação e fechamento coletivo.",
  };

  return {
    ...source,
    objective: "jogo_reduzido",
    warmup: {
      name: "aquecimento",
      duration: policy.warmupMinutes,
      summary: "Preparação geral para o jogo",
      activities: [warmupActivity],
    },
    main: {
      name: "principal",
      duration: policy.gameMinutes,
      summary: "Jogo consolidado do mês",
      activities: [gameActivity],
    },
    cooldown: {
      name: "volta_calma",
      duration: policy.cooldownMinutes,
      summary: "Recuperação e fechamento",
      activities: [cooldownActivity],
    },
    variations: [],
    explanations: [
      ...source.explanations.filter(
        (item) => !item.message.toLowerCase().includes("ultima aula")
      ),
      {
        message:
          "A última aula real do mês segue a tradição da turma: aquecimento e jogo consolidado, sem bloco técnico específico.",
        source: "contexto",
        appliedTo: "geral",
      },
    ],
  };
};

export const applyMonthlyVolleyballGameSessionToPackage = (
  pkg: PedagogicalPlanPackage,
  policy: MonthlyVolleyballGameSessionPolicy
): PedagogicalPlanPackage => {
  if (!policy.applies) return pkg;
  return {
    ...pkg,
    input: {
      ...pkg.input,
      objective: "Jogo consolidado do mês",
      constraints: [
        ...new Set([
          ...(pkg.input.constraints ?? []),
          "Última aula real do mês: aquecimento e jogo, sem treino técnico específico.",
        ]),
      ],
    },
    draft: buildMonthlyGameDraft(pkg.draft, policy),
    generated: {
      ...pkg.generated,
      ...buildMonthlyGameDraft(pkg.generated, policy),
    },
    final: {
      ...pkg.final,
      ...buildMonthlyGameDraft(pkg.final, policy),
    },
  };
};
