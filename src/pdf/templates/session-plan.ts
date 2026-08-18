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
  activitiesText?: string;
  descriptionText?: string;
  // Legacy fallback for migration.
  summary?: string;
  activities?: SessionPlanActivity[];
  items?: SessionPlanActivity[];
};

export type SessionPlanPeriodizationSource = {
  weekLabel: string;
  phaseLabel: string;
  focusLabel: string;
  loadLabel: string;
  roleLabel: string;
  monthlyGameSession?: boolean;
  classLevelLabel?: string;
  objectiveLabel?: string;
  loadModelLabel?: string;
  beforeLabel?: string;
  nowLabel?: string;
  afterLabel?: string;
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
  preserveEmptyFields?: boolean;
  periodizationSource?: SessionPlanPeriodizationSource;
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

const formatActivityNames = (
  block: SessionBlock,
  items: SessionPlanActivity[],
  enumerate: boolean,
  preserveEmptyFields = false
) => {
  if (typeof block.activitiesText === "string") {
    return asCoachingText(block.activitiesText);
  }
  const names = items.map((item) => asCoachingText(item?.name).trim()).filter(Boolean);
  if (!names.length) return preserveEmptyFields ? "" : "-";
  if (!enumerate) return names.join("\n");
  return names.map((name, index) => `${index + 1}. ${name}`).join("\n");
};

const formatDescriptions = (
  block: SessionBlock,
  items: SessionPlanActivity[],
  enumerate: boolean,
  preserveEmptyFields = false
) => {
  if (typeof block.descriptionText === "string") {
    return asCoachingText(block.descriptionText);
  }
  const descriptions = items.map(resolveActivityDescription).filter(Boolean);
  if (descriptions.length) {
    return enumerate
      ? descriptions.map((description, index) => `${index + 1}. ${description}`).join("\n")
      : descriptions.join("\n");
  }
  return asCoachingText(block?.summary).trim() || (preserveEmptyFields ? "" : "-");
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
  const preserveEmptyFields = data?.preserveEmptyFields === true;
  const rawGeneralObjective = asCoachingText(data?.generalObjective);
  const rawSpecificObjective = asCoachingText(data?.specificObjective) || asCoachingText(data?.objective);
  const resolvedObjectives = preserveEmptyFields
    ? { generalObjective: rawGeneralObjective, specificObjective: rawSpecificObjective }
    : resolveLearningObjectives({
        generalObjective: rawGeneralObjective,
        specificObjective: rawSpecificObjective,
        title,
        weeklyFocus,
        theme: weeklyFocus,
        technicalFocus: weeklyFocus,
        ageBand: data?.ageGroup,
      });
  const weekLabel =
    [asText(data?.weekLabel), title].filter(Boolean).join(" — ") ||
    (preserveEmptyFields ? "" : "-");
  const resolvedSpecificObjective = sanitizeVolleyballLanguage(resolvedObjectives.specificObjective);
  const focus = weeklyFocus || title;
  const blocks = (Array.isArray(data?.blocks) ? data.blocks : []).map((block) => {
    const items = getBlockActivities(block);
    const label = getBlockLabel(block);
    const period = resolvePeriod(label);
    const enumerate = period === "Parte principal";
    return {
      period,
      activities: formatActivityNames(block, items, enumerate, preserveEmptyFields),
      time:
        period === "Volta à calma" ||
        (preserveEmptyFields && block.durationMinutes === undefined && !asText(block.time))
          ? ""
          : getBlockTime(block),
      description: formatDescriptions(block, items, enumerate, preserveEmptyFields),
      items: items.map((item) => ({
        activity: asCoachingText(item?.name).trim(),
        description: resolveActivityDescription(item),
      })),
    } satisfies MonthlyLessonPlanBlockRow;
  });

  return {
    className: asText(data?.className),
    unitLabel: asText(data?.unitLabel),
    ageGroup: asText(data?.ageGroup),
    genderLabel: asText(data?.genderLabel),
    professorName: asText(data?.coachName) || (preserveEmptyFields ? "" : "-"),
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
        specificObjective: preserveEmptyFields
          ? resolvedSpecificObjective
          : buildStructuredSpecificObjective(resolvedSpecificObjective, focus),
        situationProblem:
          asCoachingText(data?.pedagogicalRule).trim() ||
          (preserveEmptyFields
            ? ""
            : `Como aplicar ${lowerFirst(focus || "o fundamento da aula")} mantendo a continuidade e o controle da bola?`),
        periodizationSource: data.periodizationSource
          ? {
              weekLabel: asText(data.periodizationSource.weekLabel),
              phaseLabel: asText(data.periodizationSource.phaseLabel),
              focusLabel: asText(data.periodizationSource.focusLabel),
              loadLabel: asText(data.periodizationSource.loadLabel),
              roleLabel: data.periodizationSource.monthlyGameSession
                ? "Jogo consolidado do mês"
                : asText(data.periodizationSource.roleLabel),
              ...(data.periodizationSource.classLevelLabel ? { classLevelLabel: asText(data.periodizationSource.classLevelLabel) } : {}),
              ...(data.periodizationSource.objectiveLabel ? { objectiveLabel: asText(data.periodizationSource.objectiveLabel) } : {}),
              ...(data.periodizationSource.loadModelLabel ? { loadModelLabel: asText(data.periodizationSource.loadModelLabel) } : {}),
              ...(data.periodizationSource.beforeLabel ? { beforeLabel: asText(data.periodizationSource.beforeLabel) } : {}),
              ...(data.periodizationSource.nowLabel ? { nowLabel: asText(data.periodizationSource.nowLabel) } : {}),
              ...(data.periodizationSource.afterLabel ? { afterLabel: asText(data.periodizationSource.afterLabel) } : {}),
            }
          : undefined,
        blocks,
        observations: asCoachingText(data?.notes),
        preserveEmptyFields,
      },
    ],
  };
};

export const sessionPlanHtml = (data: SessionPlanPdfData, options?: { editable?: boolean }) =>
  monthlyPlanHtml(buildSessionMonthlyPlanData(data), options);
