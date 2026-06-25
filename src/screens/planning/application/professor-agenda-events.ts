import type { ClassPlan, DailyLessonPlan, LessonBlock } from "../../../core/models";
import type { WeekSessionPreview } from "../../periodization/application/build-week-session-preview";
import { resolveLessonBlocksFromDailyPlan } from "./daily-lesson-blocks";

export type ProfessorAgendaEventStatus = "planned" | "ready" | "needs_review";

export type ProfessorCoachGuidance = {
  title: string;
  subtitle?: string;
  doNow: string[];
  avoidToday: string[];
  advanceIf: string[];
  simplifyIf: string[];
  setupHint?: string;
  closingCue?: string;
};

export type ProfessorAgendaEvent = {
  id: string;
  date: string;
  dayOfMonth: number;
  weekday: number;
  weekdayLabel: string;
  dateLabel: string;
  weekId: string;
  weekLabel: string;
  weekNumber: number;
  sessionIndex: number;
  title: string;
  objective: string;
  status: ProfessorAgendaEventStatus;
  statusLabel: string;
  googleCalendarReady: true;
  plan: ClassPlan;
  session: WeekSessionPreview;
  dailyPlan: DailyLessonPlan | null;
  guidance: ProfessorCoachGuidance;
  blocks: LessonBlock[];
};

export type ProfessorAgendaCalendarDay = {
  date: string;
  dayOfMonth: number;
  weekday: number;
  isCurrentMonth: boolean;
  events: ProfessorAgendaEvent[];
};

type WeeklyAgendaItem = {
  plan: ClassPlan;
  label: string;
  sessions: WeekSessionPreview[];
};

type DailyLessonPlanLookup = Record<string, DailyLessonPlan>;

const FORBIDDEN_PUBLIC_TERMS =
  /(confidence|riskFlags|readinessState|estimatedGameLevel|appliedCoreLevel|baixa evid[eê]ncia|risco de salto|hist[oó]rico parcial|fam[ií]lias|debug da periodiza[cç][aã]o)/i;

const DEFAULT_GUIDANCE: ProfessorCoachGuidance = {
  title: "Aula do dia",
  subtitle: "Conduza a aula com foco simples e decisão clara em quadra.",
  doNow: [
    "Comece com aquecimento com bola.",
    "Use uma tarefa principal com alvo claro.",
    "Feche com jogo curto e regra simples.",
  ],
  avoidToday: [
    "Evite explicar muitas regras ao mesmo tempo.",
    "Evite parar a aula por muito tempo.",
  ],
  advanceIf: [
    "A maioria cumprir a tarefa sem perder organização.",
    "A comunicação aparecer durante o jogo.",
  ],
  simplifyIf: [
    "A bola cair no primeiro contato.",
    "A turma perder a regra principal da atividade.",
  ],
  setupHint: "Organize a quadra antes de chamar a turma para a primeira tarefa.",
  closingCue: "Pergunte: o que ajudou a manter a bola em jogo?",
};

const safeText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const sanitizePublicText = (value: string, fallback: string) => {
  const text = safeText(value);
  if (!text || FORBIDDEN_PUBLIC_TERMS.test(text)) return fallback;
  return text;
};

const compactText = (value: string, fallback: string, limit = 72) => {
  const text = sanitizePublicText(value, fallback);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
};

const uniqueItems = (items: string[], fallback: string[]) => {
  const result = [...new Set(items.map((item) => sanitizePublicText(item, "")).filter(Boolean))];
  return result.length ? result : fallback;
};

const buildGuidance = (params: {
  plan: ClassPlan;
  dailyPlan: DailyLessonPlan | null;
  blocks: LessonBlock[];
}): ProfessorCoachGuidance => {
  const { plan, dailyPlan, blocks } = params;
  const mainBlock = blocks.find((block) => block.key === "main");
  const warmupBlock = blocks.find((block) => block.key === "warmup");
  const cooldownBlock = blocks.find((block) => block.key === "cooldown");
  const title = compactText(
    dailyPlan?.title || plan.theme || plan.technicalFocus || plan.generalObjective || "",
    DEFAULT_GUIDANCE.title,
    54
  );
  const mainActivity = mainBlock?.activities[0]?.name || dailyPlan?.mainPart || plan.theme;
  const warmupActivity = warmupBlock?.activities[0]?.name || dailyPlan?.warmup;
  const cooldownActivity = cooldownBlock?.activities[0]?.name || dailyPlan?.cooldown;

  return {
    title,
    subtitle: compactText(
      plan.generalObjective || plan.specificObjective || plan.theme || "",
      "Conduza a aula com um objetivo de quadra claro.",
      96
    ),
    doNow: uniqueItems(
      [
        warmupActivity ? `Comece com ${warmupActivity}.` : "",
        mainActivity ? `Parte principal: ${mainActivity}.` : "",
        cooldownActivity ? `Feche com ${cooldownActivity}.` : "",
      ],
      DEFAULT_GUIDANCE.doNow
    ).slice(0, 4),
    avoidToday: DEFAULT_GUIDANCE.avoidToday,
    advanceIf: DEFAULT_GUIDANCE.advanceIf,
    simplifyIf: DEFAULT_GUIDANCE.simplifyIf,
    setupHint: DEFAULT_GUIDANCE.setupHint,
    closingCue: DEFAULT_GUIDANCE.closingCue,
  };
};

const resolveStatus = (dailyPlan: DailyLessonPlan | null): ProfessorAgendaEventStatus => {
  if (!dailyPlan) return "planned";
  if (dailyPlan.syncStatus && dailyPlan.syncStatus !== "in_sync" && dailyPlan.syncStatus !== "overridden") {
    return "needs_review";
  }
  return "ready";
};

const statusLabelFor = (status: ProfessorAgendaEventStatus) => {
  switch (status) {
    case "ready":
      return "Aula pronta";
    case "needs_review":
      return "Revisar";
    default:
      return "Planejada";
  }
};

const parseMonthKey = (monthKey: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildEvent = (
  item: WeeklyAgendaItem,
  session: WeekSessionPreview,
  dailyPlansByKey: DailyLessonPlanLookup
): ProfessorAgendaEvent => {
  const dailyPlan = dailyPlansByKey[`${item.plan.id}::${session.date}`] ?? null;
  const blocks = dailyPlan
    ? resolveLessonBlocksFromDailyPlan(
        {
          warmup: dailyPlan.warmup,
          mainPart: dailyPlan.mainPart,
          cooldown: dailyPlan.cooldown,
          blocksJson: dailyPlan.blocksJson,
        },
        undefined
      )
    : [];
  const guidance = buildGuidance({ plan: item.plan, dailyPlan, blocks });
  const status = resolveStatus(dailyPlan);
  const date = new Date(`${session.date}T00:00:00`);
  const dayOfMonth = Number(session.date.slice(8, 10));

  return {
    id: `${item.plan.id}::${session.date}`,
    date: session.date,
    dayOfMonth,
    weekday: Number.isNaN(date.getTime()) ? session.weekday : date.getDay(),
    weekdayLabel: session.weekdayLabel,
    dateLabel: session.dateLabel,
    weekId: item.plan.id,
    weekLabel: item.label,
    weekNumber: item.plan.weekNumber,
    sessionIndex: session.sessionIndex,
    title: guidance.title,
    objective: compactText(guidance.subtitle || item.plan.generalObjective || item.plan.theme || "", "Objetivo da aula"),
    status,
    statusLabel: statusLabelFor(status),
    googleCalendarReady: true,
    plan: item.plan,
    session,
    dailyPlan,
    guidance,
    blocks,
  };
};

export const buildProfessorAgendaEvents = (params: {
  weeklyItems: WeeklyAgendaItem[];
  dailyPlansByKey: DailyLessonPlanLookup;
}): ProfessorAgendaEvent[] =>
  params.weeklyItems
    .flatMap((item) => item.sessions.map((session) => buildEvent(item, session, params.dailyPlansByKey)))
    .sort((a, b) => a.date.localeCompare(b.date));

export const buildProfessorMonthCalendar = (params: {
  monthKey: string;
  events: ProfessorAgendaEvent[];
}): ProfessorAgendaCalendarDay[] => {
  const parsed = parseMonthKey(params.monthKey);
  if (!parsed) return [];

  const firstDay = new Date(parsed.year, parsed.month - 1, 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const lastDay = new Date(parsed.year, parsed.month, 0);
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  const eventsByDate = new Map<string, ProfessorAgendaEvent[]>();
  for (const event of params.events) {
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  }

  const days: ProfessorAgendaCalendarDay[] = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    const date = toIsoDate(cursor);
    days.push({
      date,
      dayOfMonth: cursor.getDate(),
      weekday: cursor.getDay(),
      isCurrentMonth: cursor.getMonth() === parsed.month - 1,
      events: eventsByDate.get(date) ?? [],
    });
  }

  return days;
};
