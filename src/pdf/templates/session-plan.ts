import type { LessonActivity, LessonBlock } from "../../core/models";
import { resolveLearningObjectives } from "../../core/pedagogy/objective-language";
import { sanitizeVolleyballLanguage } from "../../core/pedagogy/volleyball-language-lexicon";
import { buildActivityPlanText } from "../activity-plan-text";
import { toPdfCoachingText, toPdfText } from "../pdf-coaching-text";
import {
  monthlyPlanHtml,
  type MonthlyLessonPlanBlockRow,
  type MonthlyPlanPdfData,
} from "./monthly-plan";

export type SessionPlanActivity = LessonActivity & {
  description?: string;
  // Legacy fallback for migration.
  notes?: string;
};

export type SessionBlock = Partial<LessonBlock> & {
  title?: string;
  time?: string;
  // Legacy fallback for migration.
  summary?: string;
  activities?: SessionPlanActivity[];
  items?: SessionPlanActivity[];
};

export type SessionPlanPdfData = {
  className: string;
  ageGroup?: string;
  unitLabel?: string;
  genderLabel?: string;
  dateLabel: string;
  timeLabel?: string;
  weekLabel?: string;
  title?: string;
  objective?: string;
  generalObjective?: string;
  specificObjective?: string;
  weeklyFocus?: string;
  pedagogicalRule?: string;
  totalTime?: string;
  plannedLoad?: string;
  materials?: string[];
  notes?: string;
  blocks: SessionBlock[];
  coachName?: string;
};

const asText = (value: unknown) => sanitizeVolleyballLanguage(toPdfText(value));

const asCoachingText = (value: unknown) => sanitizeVolleyballLanguage(toPdfCoachingText(value));

const getBlockLabel = (block: SessionBlock) => asText(block?.label || block?.title) || "-";

const getBlockTime = (block: SessionBlock) => {
  if (typeof block?.durationMinutes === "number" && Number.isFinite(block.durationMinutes)) {
    return `${Math.max(0, Math.round(block.durationMinutes))}'`;
  }
  return asText(block?.time) || "-";
};

const getBlockActivities = (block: SessionBlock) => {
  if (Array.isArray(block?.activities) && block.activities.length) return block.activities;
  if (Array.isArray(block?.items) && block.items.length) return block.items;
  return [];
};

const resolveActivityDescription = (item: SessionPlanActivity) =>
  asCoachingText(buildActivityPlanText(item)).trim();

const resolvePeriod = (label: string): MonthlyLessonPlanBlockRow["period"] => {
  const normalized = label.toLocaleLowerCase("pt-BR");
  if (normalized.includes("aquec")) return "Aquecimento";
  if (normalized.includes("calma") || normalized.includes("final")) return "Volta à calma";
  return "Parte principal";
};

const formatActivityNames = (items: SessionPlanActivity[], enumerate: boolean) => {
  const names = items.map((item) => asCoachingText(item?.name).trim()).filter(Boolean);
  if (!names.length) return "-";
  if (!enumerate) return names.join("\n");
  return names.map((name, index) => `${index + 1}. ${name}`).join("\n");
};

const formatDescriptions = (block: SessionBlock, items: SessionPlanActivity[], enumerate: boolean) => {
  const descriptions = items.map(resolveActivityDescription).filter(Boolean);
  if (descriptions.length) {
    return enumerate
      ? descriptions.map((description, index) => `${index + 1}. ${description}`).join("\n")
      : descriptions.join("\n");
  }
  return asCoachingText(block?.summary).trim() || "-";
};

const lowerFirst = (value: string) => value.replace(/^./, (character) => character.toLocaleLowerCase("pt-BR"));

const buildStructuredSpecificObjective = (specificObjective: string, focus: string) => {
  if (/Conceitual:|Atitudinal:|Procedimental:/i.test(specificObjective)) return specificObjective;
  const resolvedFocus = focus || "o fundamento da aula";
  return [
    `Conceitual: Reconhecer os princípios de ${lowerFirst(resolvedFocus)} e perceber como aparecem em situações simples de jogo.`,
    "Atitudinal: Persistir nas tentativas, cooperar com os colegas e comunicar as próprias escolhas.",
    `Procedimental: ${specificObjective || `Executar ${lowerFirst(resolvedFocus)} com controle da bola durante as atividades.`}`,
  ].join("\n");
};

export const buildSessionMonthlyPlanData = (data: SessionPlanPdfData): MonthlyPlanPdfData => {
  const title = asCoachingText(data?.title);
  const weeklyFocus = asCoachingText(data?.weeklyFocus);
  const resolvedObjectives = resolveLearningObjectives({
    generalObjective: asCoachingText(data?.generalObjective),
    specificObjective: asCoachingText(data?.specificObjective) || asCoachingText(data?.objective),
    title,
    weeklyFocus,
    theme: weeklyFocus,
    technicalFocus: weeklyFocus,
    ageBand: data?.ageGroup,
  });
  const weekLabel = [asText(data?.weekLabel), title].filter(Boolean).join(" — ") || "-";
  const resolvedSpecificObjective = sanitizeVolleyballLanguage(resolvedObjectives.specificObjective);
  const focus = weeklyFocus || title;
  const blocks = (Array.isArray(data?.blocks) ? data.blocks : []).map((block) => {
    const items = getBlockActivities(block);
    const label = getBlockLabel(block);
    const period = resolvePeriod(label);
    const enumerate = period === "Parte principal";
    return {
      period,
      activities: formatActivityNames(items, enumerate),
      time: period === "Volta à calma" ? "" : getBlockTime(block),
      description: formatDescriptions(block, items, enumerate),
    } satisfies MonthlyLessonPlanBlockRow;
  });

  return {
    className: asText(data?.className),
    unitLabel: asText(data?.unitLabel),
    ageGroup: asText(data?.ageGroup),
    genderLabel: asText(data?.genderLabel),
    professorName: asText(data?.coachName) || "-",
    monthLabel: asText(data?.dateLabel),
    generatedAt: new Date().toISOString(),
    totalWeeks: 1,
    totalSessions: 1,
    lessons: [
      {
        id: "session-plan",
        weekLabel,
        dateLabel: asText(data?.dateLabel) || "-",
        timeLabel: asText(data?.timeLabel) || "-",
        generalObjective: sanitizeVolleyballLanguage(resolvedObjectives.generalObjective),
        specificObjective: buildStructuredSpecificObjective(resolvedSpecificObjective, focus),
        situationProblem:
          asCoachingText(data?.pedagogicalRule).trim() ||
          `Como aplicar ${lowerFirst(focus || "o fundamento da aula")} mantendo a continuidade e o controle da bola?`,
        blocks,
        observations: asCoachingText(data?.notes),
      },
    ],
  };
};

export const sessionPlanHtml = (data: SessionPlanPdfData) =>
  monthlyPlanHtml(buildSessionMonthlyPlanData(data));
