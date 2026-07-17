import type { ClassCalendarException, ClassGroup, ClassPlan, DailyLessonPlan, LessonBlock } from "../../../core/models";
import { resolveLearningObjectives } from "../../../core/pedagogy/objective-language";
import type {
  MonthlyLessonPlanBlockRow,
  MonthlyLessonPlanItem,
  MonthlyPlanPdfData,
} from "../../../pdf/templates/monthly-plan";
import type { MonthPlanningSummary } from "./month-planning-summary";
import { buildPlanSessionCalendar, filterClassPlansBySessionMonth } from "./monthly-plan-calendar";
import { regenerateDailyLessonPlanFromWeek } from "./regenerate-daily-lesson-plan";
import { resolveLessonBlocksFromDailyPlan } from "./daily-lesson-blocks";

export const DEFAULT_MONTHLY_PLAN_PROFESSOR = "Gustavo Ribeiro dos Santos";

export type MonthlyPlanDailyLookup = Record<string, DailyLessonPlan>;

export const formatMonthlyPlanDateLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
  return `${day}/${month}/${year} (${weekday})`;
};

export const formatMonthlyPlanTimeLabel = (classGroup: ClassGroup) => {
  const start = safeText(classGroup.startTime);
  const end = safeText(classGroup.endTime);
  const toHourLabel = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return value;
    return match[2] === "00" ? `${Number(match[1])}h` : `${Number(match[1])}h${match[2]}`;
  };
  if (start && end) return `${toHourLabel(start)} às ${toHourLabel(end)}`;
  if (start) return start;
  return "";
};

const formatGeneratedAt = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const capitalizeFirst = (value: string) => value.replace(/^./, (char) => char.toUpperCase());

const safeText = (value: unknown) => String(value ?? "").trim();

const formatWeekLabel = (weekNumber: number | undefined, theme?: string) => {
  const label = `SEMANA ${String(weekNumber || 0).padStart(2, "0")}`;
  const cleanTheme = safeText(theme);
  return cleanTheme ? `${label} — ${cleanTheme}` : label;
};

const formatGenderLabel = (gender: ClassGroup["gender"]) => {
  if (gender === "masculino") return "masculino";
  if (gender === "feminino") return "feminino";
  return "misto";
};

export const formatMonthlyPlanAgeGroup = (ageBand: string) =>
  safeText(ageBand)
    .split("-")
    .map((part) => (/^\d+$/.test(part) ? String(Number(part)) : part))
    .join("–");

const formatMinutes = (value: number | undefined) => {
  const minutes = Number.isFinite(value) ? Math.max(0, Math.round(Number(value))) : 0;
  return `${minutes || 0}'`;
};

const numberedLines = (rows: string[], maxItems = rows.length, forceNumbering = false) => {
  const cleaned = rows.map(safeText).filter(Boolean);
  if (!cleaned.length) return "";
  if (cleaned.length === 1 && !forceNumbering) return cleaned[0];
  return cleaned.slice(0, maxItems).map((row, index) => `${index + 1}. ${row}`).join("\n");
};

const compactText = (value: string, maxLength: number) => {
  const cleaned = safeText(value).replace(/\s+/g, " ");
  if (cleaned.length <= maxLength) return cleaned;
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  let result = "";
  for (const sentence of sentences) {
    const next = result ? `${result} ${sentence}` : sentence;
    if (next.length > maxLength) break;
    result = next;
  }
  if (result.length >= Math.min(80, maxLength)) return result;
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const compactMultilineText = (value: string, maxLength: number) => {
  const cleaned = value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const resolveBlockText = (
  block: LessonBlock,
  field: "name" | "description",
  maxItems: number,
  forceNumbering = false
) => numberedLines(
  (block.activities ?? []).map((activity) => safeText(activity[field])),
  maxItems,
  forceNumbering
);

const blockLabelToPeriod = (block: LessonBlock): MonthlyLessonPlanBlockRow["period"] => {
  if (block.key === "main") return "Parte principal";
  if (block.key === "cooldown") return "Volta à calma";
  return "Aquecimento";
};

const toBlockRows = (plan: DailyLessonPlan, durationMinutes: number | undefined): MonthlyLessonPlanBlockRow[] =>
  resolveLessonBlocksFromDailyPlan(plan, durationMinutes).map((block) => {
    const period = blockLabelToPeriod(block);
    const isMain = block.key === "main";
    const fallbackDescription =
      block.key === "warmup" ? plan.warmup : block.key === "main" ? plan.mainPart : plan.cooldown;

    return {
      period,
      activities: compactMultilineText(
        resolveBlockText(block, "name", isMain ? 8 : 1, isMain) || safeText(block.label),
        isMain ? 260 : 120
      ),
      time: formatMinutes(block.durationMinutes),
      description: compactMultilineText(
        resolveBlockText(block, "description", isMain ? 8 : 1, isMain) || fallbackDescription,
        isMain ? 1200 : 480
      ),
    };
  });

const resolveLessonObjectives = (weeklyPlan: ClassPlan, dailyPlan: DailyLessonPlan) => {
  const fallbackTheme = weeklyPlan.theme || weeklyPlan.technicalFocus || dailyPlan.title;
  return resolveLearningObjectives({
    generalObjective: weeklyPlan.generalObjective,
    specificObjective:
      weeklyPlan.specificObjective ||
      weeklyPlan.technicalFocus ||
      dailyPlan.mainPart ||
      fallbackTheme,
    title: dailyPlan.title || fallbackTheme,
    theme: weeklyPlan.theme,
    technicalFocus: weeklyPlan.technicalFocus,
    weeklyFocus: weeklyPlan.theme || weeklyPlan.technicalFocus,
    pedagogicalRule: weeklyPlan.pedagogicalRule,
    ageBand: "",
    sportProfile: "",
  });
};

const lowerFirst = (value: string) => value.replace(/^./, (character) => character.toLowerCase());

const normalizeObjectiveSentence = (value: string) => {
  const cleaned = safeText(value).replace(/\s+/g, " ").replace(/[.;]+$/, "");
  return cleaned ? `${capitalizeFirst(cleaned)}.` : "";
};

const resolveStructuredSpecificObjective = (weeklyPlan: ClassPlan, dailyPlan: DailyLessonPlan) => {
  const existing = safeText(weeklyPlan.specificObjective);
  if (/Conceitual:|Procedimental:|Atitudinal:/i.test(existing)) return existing;

  const focus = safeText(weeklyPlan.technicalFocus || weeklyPlan.theme || dailyPlan.title || "fundamento da aula");
  const proceduralBase = normalizeObjectiveSentence(
    existing || dailyPlan.mainPart || weeklyPlan.theme || resolveLessonObjectives(weeklyPlan, dailyPlan).specificObjective
  );
  return [
    `Conceitual: Reconhecer os princípios de ${focus} e perceber como eles aparecem em situações simples de jogo.`,
    "Atitudinal: Persistir diante das tentativas, cooperar com os colegas e comunicar as próprias escolhas.",
    `Procedimental: ${proceduralBase || `Executar ${lowerFirst(focus)} com base estável, ajuste de deslocamento e controle da bola durante as atividades.`}`,
  ].join("\n");
};

const resolveSituationProblem = (weeklyPlan: ClassPlan, dailyPlan: DailyLessonPlan) => {
  const existing = safeText(weeklyPlan.pedagogicalRule);
  if (existing) return existing;
  const focus = safeText(weeklyPlan.technicalFocus || weeklyPlan.theme || dailyPlan.title || "o fundamento da aula");
  return `Como aplicar ${lowerFirst(focus)} em uma situação de cooperação sem perder a continuidade e o controle da bola?`;
};

const buildGeneratedDailyPlan = (params: {
  weeklyPlan: ClassPlan;
  session: ReturnType<typeof buildPlanSessionCalendar>["sessions"][number];
  classGroup: ClassGroup;
  recentPlans: DailyLessonPlan[];
}) =>
  regenerateDailyLessonPlanFromWeek({
    existing: null,
    weeklyPlan: params.weeklyPlan,
    session: {
      sessionIndex: params.session.sessionIndexInWeek,
      weekday: params.session.weekday,
      weekdayLabel: "",
      date: params.session.date,
      dateLabel: formatMonthlyPlanDateLabel(params.session.date),
      shortLabel: params.session.date.slice(5),
    },
    context: {
      className: params.classGroup.name,
      ageBand: params.classGroup.ageBand,
      durationMinutes: params.classGroup.durationMinutes,
      classGroup: params.classGroup,
      recentPlans: params.recentPlans,
    },
  });

const toLessonItem = (params: {
  classGroup: ClassGroup;
  weeklyPlan: ClassPlan;
  dailyPlan: DailyLessonPlan;
}): MonthlyLessonPlanItem => {
  const { classGroup, weeklyPlan, dailyPlan } = params;
  const objectives = resolveLessonObjectives(weeklyPlan, dailyPlan);

  return {
    id: `${weeklyPlan.id}:${dailyPlan.date}`,
    weekLabel: formatWeekLabel(weeklyPlan.weekNumber, weeklyPlan.theme || weeklyPlan.technicalFocus),
    dateLabel: formatMonthlyPlanDateLabel(dailyPlan.date),
    timeLabel: formatMonthlyPlanTimeLabel(classGroup),
    generalObjective: compactText(objectives.generalObjective, 260),
    specificObjective: compactMultilineText(resolveStructuredSpecificObjective(weeklyPlan, dailyPlan), 520),
    situationProblem: compactText(resolveSituationProblem(weeklyPlan, dailyPlan), 300),
    blocks: toBlockRows(dailyPlan, classGroup.durationMinutes),
    observations: "",
  };
};

export const buildMonthlyPlanExportData = (params: {
  classGroup: ClassGroup;
  month: MonthPlanningSummary;
  plans: ClassPlan[];
  dailyPlansByKey?: MonthlyPlanDailyLookup;
  exceptions?: ClassCalendarException[];
  generatedAt?: Date;
  professorName?: string;
}): MonthlyPlanPdfData => {
  const {
    classGroup,
    month,
    plans,
    dailyPlansByKey = {},
    exceptions = [],
    generatedAt = new Date(),
    professorName = DEFAULT_MONTHLY_PLAN_PROFESSOR,
  } = params;
  const monthPlans = filterClassPlansBySessionMonth(plans, classGroup, exceptions, month.monthKey);
  const recentPlans = Object.values(dailyPlansByKey).sort((a, b) => (a.date < b.date ? 1 : -1));
  const lessons = monthPlans.flatMap((weeklyPlan) => {
    const sessions = buildPlanSessionCalendar({
      plan: weeklyPlan,
      classGroup,
      exceptions,
      monthKey: month.monthKey,
    }).sessions;

    return sessions.map((session) => {
      const key = `${weeklyPlan.id}::${session.date}`;
      const dailyPlan =
        dailyPlansByKey[key] ??
        buildGeneratedDailyPlan({
          weeklyPlan,
          session,
          classGroup,
          recentPlans,
        });

      return toLessonItem({ classGroup, weeklyPlan, dailyPlan });
    });
  });

  return {
    className: classGroup.name || "Turma",
    unitLabel: classGroup.unit,
    ageGroup: formatMonthlyPlanAgeGroup(classGroup.ageBand),
    professorName,
    genderLabel: formatGenderLabel(classGroup.gender),
    monthLabel: capitalizeFirst(month.label),
    generatedAt: formatGeneratedAt(generatedAt),
    totalWeeks: new Set(monthPlans.map((plan) => plan.id)).size,
    totalSessions: lessons.length,
    lessons: lessons.sort((a, b) => {
      const aDate = a.dateLabel.slice(0, 10).split("/").reverse().join("-");
      const bDate = b.dateLabel.slice(0, 10).split("/").reverse().join("-");
      return aDate.localeCompare(bDate);
    }),
  };
};

export const buildWeeklyPlanExportData = (params: {
  classGroup: ClassGroup;
  plan: ClassPlan;
  dailyPlansByKey?: MonthlyPlanDailyLookup;
  exceptions?: ClassCalendarException[];
  generatedAt?: Date;
  professorName?: string;
}): MonthlyPlanPdfData => {
  const {
    classGroup,
    plan,
    dailyPlansByKey = {},
    exceptions = [],
    generatedAt = new Date(),
    professorName = DEFAULT_MONTHLY_PLAN_PROFESSOR,
  } = params;
  const recentPlans = Object.values(dailyPlansByKey).sort((a, b) => (a.date < b.date ? 1 : -1));
  const sessions = buildPlanSessionCalendar({ plan, classGroup, exceptions }).sessions;
  const lessons = sessions.map((session) => {
    const key = `${plan.id}::${session.date}`;
    const dailyPlan =
      dailyPlansByKey[key] ??
      buildGeneratedDailyPlan({
        weeklyPlan: plan,
        session,
        classGroup,
        recentPlans,
      });
    return toLessonItem({ classGroup, weeklyPlan: plan, dailyPlan });
  });

  return {
    className: classGroup.name || "Turma",
    unitLabel: classGroup.unit,
    ageGroup: formatMonthlyPlanAgeGroup(classGroup.ageBand),
    genderLabel: formatGenderLabel(classGroup.gender),
    professorName,
    monthLabel: `Semana ${String(plan.weekNumber || "").padStart(2, "0")}`,
    generatedAt: formatGeneratedAt(generatedAt),
    totalWeeks: 1,
    totalSessions: lessons.length,
    lessons,
  };
};
