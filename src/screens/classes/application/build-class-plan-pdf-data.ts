import type { ClassGroup, TrainingPlan } from "../../../core/models";
import { resolveTrainingPlanBlock } from "../../../core/training-plan-blocks";
import type { SessionPlanPdfData } from "../../../pdf/templates/session-plan";
import { normalizeDisplayText } from "../../../utils/text-normalization";

type BuildClassPlanPdfDataInput = {
  classGroup: ClassGroup;
  plan: TrainingPlan;
  lessonDate: string;
  coachName?: string;
};

const parseMinutes = (value: string | undefined, fallback: number) => {
  const match = String(value ?? "").match(/\d+/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const formatDateLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    weekday: "long",
  });
};

const formatTimeLabel = (startTime: string | undefined, durationMinutes: number) => {
  const match = String(startTime ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "-";
  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) return "-";

  const startTotal = startHour * 60 + startMinute;
  const endTotal = startTotal + durationMinutes;
  const formatClock = (total: number) => {
    const hours = Math.floor(total / 60) % 24;
    const minutes = total % 60;
    return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, "0")}`;
  };
  return `${formatClock(startTotal)} às ${formatClock(endTotal)}`;
};

const formatGender = (gender: ClassGroup["gender"]) => {
  if (gender === "masculino") return "Masculino";
  if (gender === "feminino") return "Feminino";
  return "Misto";
};

const blockData = (
  plan: TrainingPlan,
  key: "warmup" | "main" | "cooldown",
  title: string,
  durationMinutes: number
) => {
  const block = resolveTrainingPlanBlock(plan, key);
  return {
    title,
    durationMinutes,
    summary: block.summary,
    items: block.activities.map((activity) => ({
      ...activity,
      name: normalizeDisplayText(activity.name),
      description: normalizeDisplayText(activity.description ?? ""),
    })),
  };
};

export const buildClassPlanPdfData = ({
  classGroup,
  plan,
  lessonDate,
  coachName,
}: BuildClassPlanPdfDataInput): SessionPlanPdfData => {
  const totalDuration = classGroup.durationMinutes ?? 60;
  const warmupMinutes = parseMinutes(plan.warmupTime, Math.max(5, Math.round(totalDuration / 6)));
  const cooldownMinutes = parseMinutes(plan.cooldownTime, Math.max(5, Math.round(totalDuration / 12)));
  const mainMinutes = parseMinutes(
    plan.mainTime,
    Math.max(10, totalDuration - warmupMinutes - cooldownMinutes)
  );
  const learningObjectives = plan.pedagogy?.learningObjectives;
  const periodization = plan.pedagogy?.periodization;
  const weeklyFocus =
    periodization?.theme || periodization?.technicalFocus || plan.pedagogy?.focus?.skill || plan.title;
  const specificObjective = learningObjectives?.specific?.filter(Boolean).join("\n") ||
    plan.pedagogy?.objective?.description ||
    plan.pedagogy?.sessionObjective ||
    "";

  return {
    className: normalizeDisplayText(classGroup.name),
    ageGroup: normalizeDisplayText(classGroup.ageBand),
    unitLabel: normalizeDisplayText(classGroup.unit),
    genderLabel: formatGender(classGroup.gender),
    coachName: normalizeDisplayText(coachName ?? ""),
    dateLabel: formatDateLabel(lessonDate),
    timeLabel: formatTimeLabel(classGroup.startTime, totalDuration),
    weekLabel: periodization?.weekNumber ? `SEMANA ${String(periodization.weekNumber).padStart(2, "0")}` : "",
    title: normalizeDisplayText(plan.title),
    generalObjective: normalizeDisplayText(
      learningObjectives?.general || plan.pedagogy?.sessionObjective || plan.pedagogy?.objective?.description || ""
    ),
    specificObjective: normalizeDisplayText(specificObjective),
    weeklyFocus: normalizeDisplayText(weeklyFocus),
    pedagogicalRule: normalizeDisplayText(learningObjectives?.pedagogicalGuidelines?.[0] ?? ""),
    totalTime: `${warmupMinutes + mainMinutes + cooldownMinutes} min`,
    blocks: [
      blockData(plan, "warmup", "Aquecimento", warmupMinutes),
      blockData(plan, "main", "Parte principal", mainMinutes),
      blockData(plan, "cooldown", "Volta à calma", cooldownMinutes),
    ],
  };
};
