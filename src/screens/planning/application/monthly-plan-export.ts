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

const formatDatePt = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
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

const formatWeekLabel = (weekNumber: number | undefined) =>
  `SEMANA ${String(weekNumber || 0).padStart(2, "0")}`;

const formatMinutes = (value: number | undefined) => {
  const minutes = Number.isFinite(value) ? Math.max(0, Math.round(Number(value))) : 0;
  return `${minutes || 0}'`;
};

const numberedLines = (rows: string[], maxItems = rows.length) => {
  const cleaned = rows.map(safeText).filter(Boolean);
  if (!cleaned.length) return "";
  if (cleaned.length === 1) return cleaned[0];
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

const resolveBlockText = (block: LessonBlock, field: "name" | "description", maxItems: number) =>
  numberedLines((block.activities ?? []).map((activity) => safeText(activity[field])), maxItems);

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
      activities: compactText(resolveBlockText(block, "name", isMain ? 5 : 1) || safeText(block.label), isMain ? 110 : 56),
      time: formatMinutes(block.durationMinutes),
      description: compactText(
        resolveBlockText(block, "description", isMain ? 5 : 1) || fallbackDescription,
        isMain ? 300 : 140
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
      dateLabel: formatDatePt(params.session.date),
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
    weekLabel: formatWeekLabel(weeklyPlan.weekNumber),
    dateLabel: formatDatePt(dailyPlan.date),
    generalObjective: compactText(objectives.generalObjective, 125),
    specificObjective: compactText(objectives.specificObjective, 135),
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
    ageGroup: classGroup.ageBand,
    professorName,
    monthLabel: capitalizeFirst(month.label),
    generatedAt: formatGeneratedAt(generatedAt),
    totalWeeks: new Set(monthPlans.map((plan) => plan.id)).size,
    totalSessions: lessons.length,
    lessons: lessons.sort((a, b) => {
      const aDate = a.dateLabel.split("/").reverse().join("-");
      const bDate = b.dateLabel.split("/").reverse().join("-");
      return aDate.localeCompare(bDate);
    }),
  };
};
