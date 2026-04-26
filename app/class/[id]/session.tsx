import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    Image,
    InteractionManager,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackdrop } from "../../../src/components/ui/ScreenBackdrop";
import {
    buildAutoPlanForCycleDay,
    type AutoPlanForCycleDayResult,
} from "../../../src/screens/session/application/build-auto-plan-for-cycle-day";
import { buildSessionResistancePreview } from "../../../src/screens/session/application/build-session-resistance-preview";
import {
    BlockEditModal,
    type BlockEditPayload,
    type EditableBlockItem,
} from "../../../src/screens/session/components/BlockEditModal";
import { SessionContextHeader } from "../../../src/screens/session/components/SessionContextHeader";
import { SessionResistanceNotice } from "../../../src/screens/session/components/SessionResistanceNotice";
import { SessionResistanceBlock } from "../../../src/screens/session/components/SessionResistanceBlock";
import { getResistancePlanFromSessionComponents } from "../../../src/screens/session/components/get-resistance-plan-from-session-components";
import { Pressable } from "../../../src/ui/Pressable";

import {
    generateStructuredActivitiesWithAI,
    rewriteReportText,
    type ReportRewriteField,
} from "../../../src/api/ai";
import { usePedagogicalConfig } from "../../../src/bootstrap/pedagogical-config-context";
import { ScreenLoadingState } from "../../../src/components/ui/ScreenLoadingState";
import type { PedagogicalDimensionsConfig } from "../../../src/config/pedagogical-dimensions-config";
import { ptBR } from "../../../src/constants/copy/pt-br";
import { toVisibleCoachingText } from "../../../src/core/methodology/coaching-lexicon";
import type { PedagogicalApproachDetection } from "../../../src/core/methodology/pedagogical-approach-detector";
import { parseWeeklyIntegratedContext } from "../../../src/core/resistance/weekly-integrated-context";
import {
    resolveTeamTrainingContext,
    supportsResistanceTraining,
} from "../../../src/core/resistance/training-context";
import {
    buildSessionApproachAwareBlockDescription,
    buildSessionApproachAwareGeneralObjective,
    buildSessionApproachGuideline,
    buildSessionPedagogicalApproachInput,
    detectSessionPedagogicalApproach as detectSessionPedagogicalApproachCore,
    formatSessionPedagogicalRiskLabel,
} from "../../../src/core/methodology/session-pedagogical-language";
import {
    buildSessionPedagogicalPanelIntent,
    buildSessionPedagogicalPanelRisk,
    buildSessionPedagogicalPanelSecondary,
    buildSessionPedagogicalPanelSignals,
    buildSessionPedagogicalPanelSummary,
    formatSessionAdjustmentLabel,
    formatSessionDecisionReasonTypeLabel,
    formatSessionMethodologyApproachLabel,
    formatSessionMethodologyEvidenceExcerpt,
    formatSessionMethodologyEvidenceSource,
    formatSessionMethodologyScoreSummary,
    formatSessionOverrideSummary,
    formatSessionPedagogicalFocusSkill,
    type SessionMethodologyEvidence,
} from "../../../src/core/methodology/session-pedagogical-panel-language";
import type {
    ClassGroup,
    ClassPlan,
    DailyLessonPlan,
    KnowledgeSource,
    ProgressionDimension,
    ScoutingLog,
    SessionLog,
    Student,
    TrainingPlan,
    TrainingPlanActivity,
    TrainingPlanCriterion,
    TrainingPlanPedagogy,
    TrainingPlanPlanningBasis,
    VolleyballSkill,
} from "../../../src/core/models";
import {
    buildCAPFromDimensions,
    buildDimensionGuidelines,
    deriveDimensionsProfile,
    formatDimensionsProfile,
    formatRefinements,
    refineDimensionsByEvaluation,
} from "../../../src/core/pedagogical-dimensions";
import {
    evaluateSessionOutcome,
    type SessionSkillHistoryEntry,
} from "../../../src/core/pedagogical-evaluation";
import {
    type LessonPlanDraft,
    type PedagogicalObjective,
    type PedagogicalPlanBlock,
    type PedagogicalPlanPackage,
    type PlanningPhase,
} from "../../../src/core/pedagogical-planning";
import { buildPeriodizationContext } from "../../../src/core/periodization-context";
import {
    buildLogFromCounts,
    countsFromLog,
    createEmptyCounts,
    getFocusSuggestion,
    getSkillMetrics,
    getTotalActions,
    scoutingSkillHelp,
    scoutingSkills,
    type ScoutingCounts,
} from "../../../src/core/scouting";
import { createTrainingPlanVersion } from "../../../src/core/training-plan-factory";
import { resolveActiveMethodology } from "../../../src/db/knowledge-base";
import {
    deleteTrainingPlansByClassAndDate,
    getAttendanceByDate,
    getClassById,
    getClassPlansByClass,
    getDailyLessonPlanByWeekAndDate,
    getKnowledgeRuleCitations,
    getKnowledgeSources,
    getLatestTrainingPlanByClass,
    getScoutingLogByDate,
    getSessionLogByDate,
    getStudentsByClass,
    getTrainingPlans,
    saveScoutingLog,
    saveSessionLog,
    saveTrainingPlan,
} from "../../../src/db/seed";
import { logAction, logPlanGenerationDecision } from "../../../src/observability/breadcrumbs";
import { measure } from "../../../src/observability/perf";
import { exportPdf, safeFileName } from "../../../src/pdf/export-pdf";
import { SessionPlanDocument } from "../../../src/pdf/session-plan-document";
import { SessionReportDocument } from "../../../src/pdf/session-report-document";
import { sessionPlanHtml } from "../../../src/pdf/templates/session-plan";
import { sessionReportHtml } from "../../../src/pdf/templates/session-report";
import { AnchoredDropdown } from "../../../src/ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../src/ui/AnchoredDropdownOption";
import { useAppTheme } from "../../../src/ui/app-theme";
import { Button } from "../../../src/ui/Button";
import { getClassPalette } from "../../../src/ui/class-colors";
import { ClassGenderBadge } from "../../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../../src/ui/confirm-dialog";
import { LocationBadge } from "../../../src/ui/LocationBadge";
import { ModalSheet } from "../../../src/ui/ModalSheet";
import { useSaveToast } from "../../../src/ui/save-toast";
import { useCollapsibleAnimation } from "../../../src/ui/use-collapsible";
import { formatClock, formatDuration } from "../../../src/utils/format-time";
import { getLessonBlockTimes } from "../../../src/utils/lesson-block-times";
import { normalizeDisplayText } from "../../../src/utils/text-normalization";
import { calculateAdjacentClassDate } from "../../../src/utils/whatsapp-templates";

const sessionTabs = [
  { id: "treino", label: ptBR.session.tabs.training },
  { id: "relatório", label: ptBR.session.tabs.report },
  { id: "scouting", label: ptBR.session.tabs.scouting },
] as const;

type SessionTabId = (typeof sessionTabs)[number]["id"];
type SessionBlockKey = "warmup" | "main" | "cooldown";
type SessionPedagogicalApproach = NonNullable<TrainingPlanPedagogy["pedagogicalApproach"]>;
const REPORT_REWRITE_MAX_CHARS = 1200;
const REPORT_RELEVANT_MIN_CHARS = 24;
const REPORT_RELEVANT_MIN_WORDS = 5;
const REPORT_PHOTO_LIMIT = 3;

const parseReportPhotoUris = (raw: string): string[] => {
  const value = raw.trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, REPORT_PHOTO_LIMIT);
    }
  } catch {
    // ignore invalid JSON and fallback to line-based parsing
  }
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, REPORT_PHOTO_LIMIT);
};

const serializeReportPhotoUris = (uris: string[]) =>
  JSON.stringify(
    uris
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .slice(0, REPORT_PHOTO_LIMIT)
  );

const inferMimeTypeFromUri = (uri: string) => {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
};

const isLocalImageUri = (uri: string) => /^file:|^content:/i.test(uri);

const sanitizePlanDisplayItem = (value: string | null | undefined) => {
  const raw = normalizeDisplayText(value).trim();
  if (!raw) return "";
  const withoutMinutes = raw.replace(/^\s*\d+\s*min(?:utos?)?\s*[-•:]?\s*/i, "").trim();
  if (!withoutMinutes) return "";
  if (/^[a-z0-9]+(?:_[a-z0-9]+){2,}$/i.test(withoutMinutes)) return "";
  if (/(?:^|_)vwv(?:_|$)/i.test(withoutMinutes)) return "";
  return withoutMinutes;
};

const summarizePlanItems = (items: string[] | undefined, limit = 2) =>
  (items ?? [])
    .map((item) => sanitizePlanDisplayItem(item))
    .filter(Boolean)
    .slice(0, limit)
    .join(" / ");

const dedupeByNormalizedText = (items: string[]) => {
  const map = new Map<string, string>();
  for (const raw of items) {
    const cleaned = sanitizePlanDisplayItem(raw);
    if (!cleaned) continue;
    const key = normalizePedagogicalText(cleaned);
    if (!key || map.has(key)) continue;
    map.set(key, cleaned);
  }
  return Array.from(map.values());
};

const dedupeActivitiesForDisplay = (items: TrainingPlanActivity[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const name = sanitizePlanDisplayItem(item.name) || "atividade";
    const desc = sanitizePlanDisplayItem(item.description ?? "");
    const key = `${normalizePedagogicalText(name)}|${normalizePedagogicalText(desc)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildSimpleActivityFromPlan = (plan: TrainingPlan | null) => {
  if (!plan) return "";
  const title = String(plan.title ?? "").trim();
  const warmup = summarizePlanItems(plan.warmup, 1);
  const main = summarizePlanItems(plan.main, 2);
  const cooldown = summarizePlanItems(plan.cooldown, 1);

  const parts = [
    title,
    warmup ? `Aquecimento: ${warmup}` : "",
    main ? `Principal: ${main}` : "",
    cooldown ? `${ptBR.session.cooldown}: ${cooldown}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return parts.trim();
};

const formatShortDate = (value: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const sessionWeekdays = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sab" },
  { id: 7, label: "Dom" },
];

const formatSessionWeekdays = (days: number[] | undefined) => {
  if (!days?.length) return "";
  return days
    .map((day) => sessionWeekdays.find((item) => item.id === day)?.label)
    .filter(Boolean)
    .join(", ");
};

const buildCompactTrainingPlanKey = (plan: TrainingPlan) => {
  const parentPlanId = String(plan.parentPlanId ?? "").trim();
  if (parentPlanId) return `parent:${parentPlanId}`;

  const blocks = [plan.warmup ?? [], plan.main ?? [], plan.cooldown ?? []]
    .map((items) =>
      items
        .map((item) => normalizePedagogicalText(sanitizePlanDisplayItem(item)))
        .filter(Boolean)
        .join("|")
    )
    .join("::");

  return `content:${normalizePedagogicalText(plan.title)}::${blocks}`;
};

const compactTrainingPlans = (plans: TrainingPlan[], limit = 6) => {
  const uniquePlans = new Map<string, TrainingPlan>();
  for (const plan of plans) {
    const key = buildCompactTrainingPlanKey(plan);
    if (!uniquePlans.has(key)) {
      uniquePlans.set(key, plan);
    }
  }
  return Array.from(uniquePlans.values()).slice(0, limit);
};

const buildSavedPlanSummary = (plan: TrainingPlan) =>
  dedupeByNormalizedText([...(plan.main ?? []), ...(plan.warmup ?? []), ...(plan.cooldown ?? [])])
    .slice(0, 2)
    .join(" / ");

const buildSavedPlanMeta = (plan: TrainingPlan) => {
  if (plan.applyDate) {
    return `Último uso em ${formatShortDate(plan.applyDate)}`;
  }
  if (plan.applyDays?.length) {
    return `Dias: ${formatSessionWeekdays(plan.applyDays)}`;
  }
  if (plan.createdAt) {
    return `Salvo em ${formatShortDate(plan.createdAt)}`;
  }
  return "Plano salvo da turma";
};

const pedagogicalObjectiveLabels: Record<PedagogicalObjective, string> = {
  controle_bola: "Controle de bola",
  passe: "Passe",
  resistencia: "Resistência",
  jogo_reduzido: "Jogo reduzido",
};

const normalizePedagogicalText = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const arePedagogicalTextsEquivalent = (
  left: string | null | undefined,
  right: string | null | undefined
) => {
  const normalizedLeft = normalizePedagogicalText(sanitizePlanDisplayItem(left));
  const normalizedRight = normalizePedagogicalText(sanitizePlanDisplayItem(right));
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
};

const buildActivityDescription = (
  name: string,
  blockKey: SessionBlockKey,
  blockSummary?: string | null,
  pedagogicalApproach?: SessionPedagogicalApproach | null,
  focusSkill?: VolleyballSkill | null
) => {
  const activityName = sanitizePlanDisplayItem(name);
  const summary = sanitizePlanDisplayItem(blockSummary ?? "");
  const normalized = normalizePedagogicalText(activityName);

  if (blockKey === "warmup") {
    if (/aquec|ativ|mobil|estab|coord|desloc|prepar/.test(normalized)) {
      return buildApproachAwareBlockDescription({
        core: "mobilidade, coordenação e preparação para a parte principal",
        blockKey,
        pedagogicalApproach,
        fallback: summary,
        focusSkill,
        detailText: activityName,
      });
    }
    return buildApproachAwareBlockDescription({
      core: summary || "preparação física e coordenativa",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill,
      detailText: activityName,
    });
  }

  if (blockKey === "cooldown") {
    if (/feedback|retom|fech|reflex/.test(normalized)) {
      return buildApproachAwareBlockDescription({
        core: "retomada dos pontos-chave e organização final",
        blockKey,
        pedagogicalApproach,
        fallback: summary,
        focusSkill,
        detailText: activityName,
      });
    }
    if (/along|respir|recuper|volta/.test(normalized)) {
      return buildApproachAwareBlockDescription({
        core: "recuperação, controle respiratório e reorganização final",
        blockKey,
        pedagogicalApproach,
        fallback: summary,
        focusSkill,
        detailText: activityName,
      });
    }
    return buildApproachAwareBlockDescription({
      core: summary || "recuperação e consolidação do conteúdo trabalhado",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill,
      detailText: activityName,
    });
  }

  if (normalized.includes("5x1")) {
    return buildApproachAwareBlockDescription({
      core: "organização posicional da equipe no sistema 5x1",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill: focusSkill ?? "levantamento",
      detailText: activityName,
    });
  }
  if (/rodizio|rotac/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "identificação das funções em cada rotação da jogada",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill,
      detailText: activityName,
    });
  }
  if (/infiltr|levantadora/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "entrada da levantadora para organizar o segundo toque",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill: focusSkill ?? "levantamento",
      detailText: activityName,
    });
  }
  if (/3 toques|tres toques|jogada|construc/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "continuidade da jogada em passe, levantamento e ataque",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill,
      detailText: activityName,
    });
  }
  if (/saque/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "lançamento, contato e direcionamento do saque",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill: focusSkill ?? "saque",
      detailText: activityName,
    });
  }
  if (/recepc|passe|manchete/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "qualidade do primeiro contato e direcionamento do passe",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill: focusSkill ?? "passe",
      detailText: activityName,
    });
  }
  if (/ataque|cortada|finaliz/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "tempo de bola, direção e finalização do ataque",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill: focusSkill ?? "ataque",
      detailText: activityName,
    });
  }
  if (/transic|contra-ataque/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "reorganização entre defesa e ataque para continuidade da jogada",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill: focusSkill ?? "transicao",
      detailText: activityName,
    });
  }
  if (/bloque/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "tempo de salto, fechamento do corredor e coordenação do bloqueio",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill: focusSkill ?? "bloqueio",
      detailText: activityName,
    });
  }
  if (/defes|cobertura/.test(normalized)) {
    return buildApproachAwareBlockDescription({
      core: "leitura defensiva, cobertura e resposta coordenada à jogada",
      blockKey,
      pedagogicalApproach,
      fallback: summary,
      focusSkill: focusSkill ?? "defesa",
      detailText: activityName,
    });
  }

  return buildApproachAwareBlockDescription({
    core: summary || "compreensão da tarefa e tomada de decisão",
    blockKey,
    pedagogicalApproach,
    fallback: summary,
    focusSkill,
    detailText: activityName,
  });
};

const resolveActivityDescription = (options: {
  name: string;
  description?: string | null;
  blockKey: SessionBlockKey;
  blockSummary?: string | null;
  pedagogicalApproach?: SessionPedagogicalApproach | null;
  focusSkill?: VolleyballSkill | null;
}) => {
  const activityName = sanitizePlanDisplayItem(options.name);
  const providedDescription = sanitizePlanDisplayItem(options.description ?? "");
  const summary = sanitizePlanDisplayItem(options.blockSummary ?? "");

  if (providedDescription && !arePedagogicalTextsEquivalent(providedDescription, activityName)) {
    return providedDescription;
  }

  const generatedDescription = buildActivityDescription(
    activityName,
    options.blockKey,
    summary,
    options.pedagogicalApproach,
    options.focusSkill
  );

  if (generatedDescription && !arePedagogicalTextsEquivalent(generatedDescription, activityName)) {
    return generatedDescription;
  }

  if (summary && !arePedagogicalTextsEquivalent(summary, activityName)) {
    return summary;
  }

  return "";
};

const pickPedagogicalObjectiveLabel = (value: string) => {
  const normalized = normalizePedagogicalText(value);
  if (!normalized) return pedagogicalObjectiveLabels.controle_bola;
  if (normalized.includes("passe") || normalized.includes("recep")) {
    return pedagogicalObjectiveLabels.passe;
  }
  if (normalized.includes("resist") || normalized.includes("condicion")) {
    return pedagogicalObjectiveLabels.resistencia;
  }
  if (normalized.includes("jogo") || normalized.includes("reduz")) {
    return pedagogicalObjectiveLabels.jogo_reduzido;
  }
  return pedagogicalObjectiveLabels.controle_bola;
};

const buildPedagogicalApproachInput = (
  parts: Array<string | null | undefined>
) => buildSessionPedagogicalApproachInput(parts);

const detectSessionPedagogicalApproach = (
  parts: Array<string | null | undefined>
): SessionPedagogicalApproach => detectSessionPedagogicalApproachCore(parts);

const buildApproachAwareGeneralObjective = (
  targetSkill: VolleyballSkill,
  approach: SessionPedagogicalApproach,
  fallback: string
) => buildSessionApproachAwareGeneralObjective(targetSkill, approach, fallback);

const buildApproachGuideline = (approach: SessionPedagogicalApproach) =>
  buildSessionApproachGuideline(approach);

const buildApproachAwareBlockDescription = (options: {
  core: string;
  blockKey: SessionBlockKey;
  pedagogicalApproach?: SessionPedagogicalApproach | null;
  fallback?: string;
  focusSkill?: VolleyballSkill | null;
  detailText?: string;
}) => buildSessionApproachAwareBlockDescription(options);

const formatPedagogicalRiskLabel = (
  value: SessionPedagogicalApproach["traditionalConductionRisk"] | undefined
) => formatSessionPedagogicalRiskLabel(value);

const formatMethodologyApproach = (value: string | undefined) =>
  formatSessionMethodologyApproachLabel(value);

const formatMethodologyScore = (score: number) =>
  formatSessionMethodologyScoreSummary(score);

const criterionTypeLabels: Record<TrainingPlanCriterion["type"], string> = {
  consistencia: "Consistência",
  precisao: "Precisão",
  decisao: "Decisão",
  eficiencia: "Eficiência",
};

const formatCriterionTypeLabel = (type: TrainingPlanCriterion["type"] | undefined) =>
  (type ? criterionTypeLabels[type] : "Critério");

const formatCriterionSummary = (criterion: TrainingPlanCriterion) => {
  const typeLabel = formatCriterionTypeLabel(criterion.type);
  if (typeof criterion.threshold === "number") {
    return `${typeLabel} >= ${criterion.threshold}`;
  }
  return typeLabel;
};

const formatAdjustmentLabel = (value: "increase" | "maintain" | "regress") =>
  formatSessionAdjustmentLabel(value);

const decisionReasonTypeLabels: Record<"health" | "readiness" | "context" | "other", string> = {
  health: formatSessionDecisionReasonTypeLabel("health"),
  readiness: formatSessionDecisionReasonTypeLabel("readiness"),
  context: formatSessionDecisionReasonTypeLabel("context"),
  other: formatSessionDecisionReasonTypeLabel("other"),
};

const getActivityAiBadge = (activity: TrainingPlanActivity) => {
  if (activity.source !== "ai") return null;
  const score = typeof activity.confidence === "number" ? activity.confidence : 0;
  if (score >= 0.84) return { label: "IA", tone: "strong" as const };
  if (score >= 0.68) return { label: "IA*", tone: "soft" as const };
  return null;
};

const buildHumanMethodologyExplanation = (
  reasoning: MethodologyReasoning | undefined
) => {
  if (!reasoning) return "Entrou pelo padrão que mais encaixa na turma.";
  const parts: string[] = [];
  if (reasoning.matchedContext) parts.push("contexto do treino");
  if (reasoning.matchedModality) parts.push("modalidade");
  if (reasoning.matchedLevel) parts.push("nível da turma");
  if (!parts.length) return "Entrou pelo padrão que mais encaixa na turma.";
  return toVisibleCoachingText(`Entrou pela combinação de ${parts.join(", ")}.`);
};

type MethodologyReasoning = NonNullable<
  NonNullable<NonNullable<TrainingPlan["pedagogy"]>["methodology"]>["reasoning"]
>;

const buildTrainingPlanDraftFromPlan = (plan: TrainingPlan) => ({
  title: plan.title,
  tags: plan.tags,
  warmup: plan.warmup,
  main: plan.main,
  cooldown: plan.cooldown,
  warmupTime: plan.warmupTime,
  mainTime: plan.mainTime,
  cooldownTime: plan.cooldownTime,
});

const splitMaterials = (value: string) =>
  String(value ?? "")
    .split(/[\n,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseAgeBandStart = (value: string) => {
  const match = String(value ?? "").match(/(\d{1,2})/);
  return match ? Number(match[1]) : null;
};

const pickDevelopmentStage = (classGroup: ClassGroup): NonNullable<TrainingPlanPedagogy["developmentStage"]> => {
  const ageStart = parseAgeBandStart(classGroup.ageBand);
  if (ageStart !== null && ageStart <= 11) return "fundamental";
  if (ageStart !== null && ageStart <= 16) return "especializado";
  return "aplicado";
};

const pickFocusSkill = (pkg: PedagogicalPlanPackage): VolleyballSkill => {
  const text = normalizePedagogicalText(
    [
      pkg.input.objective,
      ...pkg.final.main.activities.map((activity) => activity.name),
      ...pkg.final.warmup.activities.map((activity) => activity.name),
    ].join(" ")
  );
  if (text.includes("levant")) return "levantamento";
  if (text.includes("ataq") || text.includes("cortada")) return "ataque";
  if (text.includes("bloq")) return "bloqueio";
  if (text.includes("defes") || text.includes("dig")) return "defesa";
  if (text.includes("saque") || text.includes("serv") ) return "saque";
  if (text.includes("trans") || text.includes("jogo")) return "transicao";
  if (text.includes("passe") || text.includes("recep") || text.includes("manchete")) return "passe";
  return "passe";
};

const pickProgressionDimension = (
  pkg: PedagogicalPlanPackage
): ProgressionDimension => {
  if (pkg.generated.basePlanKind === "progression") return "transferencia_jogo";
  if (pkg.analysis.heterogeneity === "alta") return "consistencia";
  if (pkg.analysis.level === "baixo") return "precisao";
  if (normalizePedagogicalText(pkg.input.objective).includes("jogo")) return "tomada_decisao";
  if (pkg.analysis.level === "alto") return "oposicao";
  return "pressao_tempo";
};

const pickObjectiveType = (
  pkg: PedagogicalPlanPackage
): NonNullable<TrainingPlanPedagogy["objective"]>["type"] => {
  const objective = normalizePedagogicalText(pkg.input.objective);
  if (objective.includes("resist") || objective.includes("condicion")) return "fisico";
  if (objective.includes("jogo") || objective.includes("tomada") || objective.includes("decis")) return "tatico";
  if (objective.includes("controle") || objective.includes("coord") || objective.includes("motor")) return "motor";
  if (objective.includes("concent") || objective.includes("percepc")) return "cognitivo";
  return "tecnico";
};

const buildPedagogicalObjectives = (
  pkg: PedagogicalPlanPackage,
  options?: { scoutingPrioritySkill?: VolleyballSkill | null }
) => {
  const focus = pickFocusSkill(pkg);
  const progression = pickProgressionDimension(pkg);
  const targetSkill = options?.scoutingPrioritySkill ?? focus;

  const levelTargetsByLevel = {
    baixo: { repsMin: 3, repsMax: 5, accuracyPct: 60 },
    medio: { repsMin: 6, repsMax: 8, accuracyPct: 70 },
    alto: { repsMin: 8, repsMax: 10, accuracyPct: 80 },
  } as const;
  const levelTargets = levelTargetsByLevel[pkg.analysis.level];
  const repsMax = pkg.analysis.heterogeneity === "alta" ? levelTargets.repsMax - 1 : levelTargets.repsMax;
  const repsRange = `${levelTargets.repsMin} a ${Math.max(levelTargets.repsMin, repsMax)}`;
  const accuracyTarget = pkg.analysis.heterogeneity === "alta"
    ? Math.max(55, levelTargets.accuracyPct - 5)
    : levelTargets.accuracyPct;

  const byFocus: Record<VolleyballSkill, { general: string; specific: string[]; success: string[] }> = {
    passe: {
      general: "Desenvolver controle de bola, precisão do passe e continuidade das trocas em situação de jogo.",
      specific: [
        "Executar plataforma estável e contato limpo no passe.",
        "Ajustar direção do corpo para enviar a bola ao alvo definido.",
        `Sustentar séries de ${repsRange} repetições corretas com regularidade.`,
      ],
      success: [
        `Alcançar >= ${repsRange} passes corretos em sequência por dupla/trio.`,
        `Atingir >= ${accuracyTarget}% de passes no alvo em blocos de 10 execuções.`,
      ],
    },
    levantamento: {
      general: "Aprimorar qualidade do levantamento para organizar a construção ofensiva.",
      specific: [
        "Estabilizar base e tempo de contato no levantamento.",
        "Direcionar a bola para zona-alvo com trajetória consistente.",
        "Tomar decisão de distribuição conforme leitura do contexto.",
      ],
      success: [
        `Atingir >= ${accuracyTarget}% de levantamentos na zona-alvo em séries de 10 bolas.`,
        `Manter continuidade ofensiva em >= ${Math.max(60, accuracyTarget - 5)}% das sequências de jogo reduzido.`,
      ],
    },
    ataque: {
      general: "Desenvolver eficiência do ataque com melhor tempo, direção e tomada de decisão.",
      specific: [
        "Sincronizar aproximação, salto e contato com a bola.",
        "Variar direção do ataque para explorar espaços livres.",
        "Escolher solução ofensiva adequada à configuração defensiva.",
      ],
      success: [
        `Atingir >= ${accuracyTarget}% de ataques em alvo em séries de 10 tentativas.`,
        `Reduzir para <= ${Math.max(10, 35 - Math.round(accuracyTarget / 4))}% os ataques sem controle sob pressão.`,
      ],
    },
    bloqueio: {
      general: "Melhorar leitura e coordenação do bloqueio para reduzir efetividade do ataque adversário.",
      specific: [
        "Ajustar deslocamento lateral e tempo de salto no bloqueio.",
        "Alinhar mãos ao corredor de ataque com postura estável.",
        "Coordenar bloqueio simples/duplo conforme leitura da jogada.",
      ],
      success: [
        `Fechar corredor principal em >= ${Math.max(55, accuracyTarget - 10)}% das ações de bloqueio avaliadas.`,
        `Reduzir atrasos de tempo para <= ${Math.max(10, 30 - Math.round(accuracyTarget / 5))}% das situações de transição defensiva.`,
      ],
    },
    defesa: {
      general: "Aprimorar organização defensiva para ampliar recuperação de bolas e transição.",
      specific: [
        "Manter base ativa e ajustes rápidos de posicionamento.",
        "Controlar manchete defensiva com direção ao levantador.",
        "Responder com decisão adequada em bolas de difícil leitura.",
      ],
      success: [
        `Retornar >= ${accuracyTarget}% das bolas defendidas em condição jogável para levantamento.`,
        `Reduzir erros de postura para <= ${Math.max(10, 35 - Math.round(accuracyTarget / 4))}% das ações defensivas.`,
      ],
    },
    saque: {
      general: "Desenvolver saque consistente e orientado por alvo para gerar vantagem inicial.",
      specific: [
        "Estabilizar rotina de preparação e contato no saque.",
        "Direcionar bola para zonas estratégicas pré-definidas.",
        "Regular força e margem de segurança conforme objetivo tático.",
      ],
      success: [
        `Atingir a zona-alvo em >= ${accuracyTarget}% de séries com 10 saques.`,
        `Manter erros diretos de saque em <= ${Math.max(10, 30 - Math.round(accuracyTarget / 5))}% das tentativas.`,
      ],
    },
    transicao: {
      general: "Qualificar transições entre defesa e ataque com maior velocidade e organização coletiva.",
      specific: [
        "Executar reposicionamento imediato após ação defensiva.",
        "Manter comunicação para continuidade da jogada.",
        "Escolher solução de transição adequada ao contexto do rally.",
      ],
      success: [
        `Concluir >= ${Math.max(55, accuracyTarget - 10)}% das transições com ataque organizado.`,
        `Reduzir perdas após primeira defesa para <= ${Math.max(10, 35 - Math.round(accuracyTarget / 4))}%.`,
      ],
    },
  };

  const focusObjective = byFocus[targetSkill] ?? byFocus.passe;
  const pedagogicalApproach = detectSessionPedagogicalApproach([
    pkg.input.objective,
    focusObjective.general,
    ...focusObjective.specific,
  ]);
  const progressionHint: Record<ProgressionDimension, string> = {
    consistencia: "Priorizar repetibilidade técnica antes de aumentar complexidade.",
    precisao: "Elevar exigência de alvo e qualidade de execução.",
    pressao_tempo: "Reduzir tempo de decisão e execução progressivamente.",
    oposicao: "Introduzir oposição gradual mantendo controle da tarefa.",
    tomada_decisao: "Forçar leitura de jogo e escolha de solução eficiente.",
    transferencia_jogo: "Transferir o padrão treinado para situação real de jogo.",
  };

  return {
    general: buildApproachAwareGeneralObjective(
      targetSkill,
      pedagogicalApproach,
      focusObjective.general
    ),
    specific: focusObjective.specific,
    successCriteria: focusObjective.success,
    pedagogicalGuidelines: [
      progressionHint[progression],
      buildApproachGuideline(pedagogicalApproach),
    ],
    pedagogicalApproach,
  };
};

const getScoutingPrioritySkill = (
  counts: ScoutingCounts
): VolleyballSkill | null => {
  const metrics = scoutingSkills.map((skill) => ({
    id: skill.id,
    goodPct: getSkillMetrics(counts[skill.id]).goodPct,
  }));

  const candidate = [...metrics].sort((a, b) => a.goodPct - b.goodPct)[0];
  if (!candidate) return null;

  const mapToSkill: Record<(typeof scoutingSkills)[number]["id"], VolleyballSkill> = {
    serve: "saque",
    receive: "passe",
    set: "levantamento",
    attack_send: "ataque",
  };

  return mapToSkill[candidate.id] ?? null;
};

const buildSkillHistoryBySkill = (plans: TrainingPlan[]) => {
  const history: Partial<Record<VolleyballSkill, SessionSkillHistoryEntry[]>> = {};
  for (const planItem of plans) {
    const skill = planItem.pedagogy?.focus?.skill;
    const performanceScore = planItem.pedagogy?.adaptation?.performanceScore;
    if (!skill || typeof performanceScore !== "number" || !Number.isFinite(performanceScore)) {
      continue;
    }
    if (!history[skill]) history[skill] = [];
    history[skill]?.push({
      date: planItem.applyDate || planItem.createdAt || "",
      performanceScore,
    });
  }
  return history;
};

const pickLoad = (
  pkg: PedagogicalPlanPackage
): NonNullable<TrainingPlanPedagogy["load"]> => {
  const computedRpe = pkg.analysis.level === "alto" ? 7 : pkg.analysis.level === "medio" ? 6 : 4;
  const durationBoost = pkg.input.duration >= 90 ? 1 : 0;
  const intendedRPE = Math.min(10,
    pkg.input.rpeTarget != null
      ? pkg.input.rpeTarget
      : computedRpe + durationBoost
  );
  const volume = pkg.input.duration >= 85 ? "alto" : pkg.input.duration >= 60 ? "moderado" : "baixo";
  return { intendedRPE, volume };
};

const pickClassPlanForSessionDate = (plans: ClassPlan[], sessionDateValue: string) => {
  if (!plans.length) return null;
  const targetTime = Date.parse(`${sessionDateValue}T00:00:00`);
  const sorted = [...plans].sort((a, b) => {
    const aTime = Date.parse(`${a.startDate}T00:00:00`);
    const bTime = Date.parse(`${b.startDate}T00:00:00`);
    return aTime - bTime;
  });
  const candidate = [...sorted]
    .reverse()
    .find((plan) => Date.parse(`${plan.startDate}T00:00:00`) <= targetTime);
  return candidate ?? sorted[0] ?? null;
};

const hasMeaningfulText = (value?: string | null) => String(value ?? "").trim().length > 0;

const hasUsablePeriodization = (classPlan?: ClassPlan | null) => {
  if (!classPlan) return false;

  const hasWeekContext =
    Number.isFinite(classPlan.weekNumber) && Number(classPlan.weekNumber) > 0;
  const hasCycleSignal =
    hasWeekContext ||
    hasMeaningfulText(classPlan.startDate) ||
    hasMeaningfulText(classPlan.phase) ||
    hasMeaningfulText(classPlan.rpeTarget);
  const hasFocusSignal =
    hasMeaningfulText(classPlan.theme) ||
    hasMeaningfulText(classPlan.technicalFocus) ||
    hasMeaningfulText(classPlan.physicalFocus);

  return hasCycleSignal && hasFocusSignal;
};

const toGenerationMode = (planningBasis: TrainingPlanPlanningBasis) =>
  planningBasis === "cycle_based" ? "periodized" : "class_bootstrap";

const toStructuredActivities = (
  block: PedagogicalPlanBlock,
  sessionObjective: string,
  progressionLabel: ProgressionDimension,
  blockKey: SessionBlockKey,
  blockSummary?: string,
  pedagogicalApproach?: SessionPedagogicalApproach | null,
  focusSkill?: VolleyballSkill | null
): TrainingPlanActivity[] =>
  block.activities.map((activity) => {
    const text = String(activity.description || activity.name || "").trim();
    const activityName = sanitizePlanDisplayItem(activity.name || text || "Atividade") || "Atividade";
    const activityDescription = resolveActivityDescription({
      name: activityName,
      description: text,
      blockKey,
      blockSummary,
      pedagogicalApproach,
      focusSkill,
    });

    const inferCriterionType = (value: string): TrainingPlanCriterion["type"] => {
      if (/erro|qualidade|precis|acert|controle/i.test(value)) return "precisao";
      if (/decis|escolha|leitura|opcao|situacao/i.test(value)) return "decisao";
      if (/tempo|execu|pontua|ritmo|veloc|cadenc/i.test(value)) return "eficiencia";
      return "consistencia";
    };

    const extractCriterionThreshold = (value: string) => {
      const explicitMatch = value.match(/(\d{1,3})(?:\s*(?:x(?!\s*\d)|vezes|execu(?:coes|ções)?|repet(?:icoes|ições)?|passes?|acertos?))/i);
      if (explicitMatch) {
        const parsed = Number(explicitMatch[1]);
        return Number.isFinite(parsed) ? parsed : undefined;
      }

      const percentMatch = value.match(/(\d{1,3})\s*%/);
      if (percentMatch) {
        const parsed = Number(percentMatch[1]);
        return Number.isFinite(parsed) ? parsed : undefined;
      }

      const fallbackMatch = value.match(/\b(\d{1,3})\b(?!\s*(?:x|vs|contra)\b)/i);
      if (fallbackMatch) {
        const parsed = Number(fallbackMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      return undefined;
    };

    const criteria: TrainingPlanCriterion[] = /(alcan|meta|criter|pontua|execu|erro|consist|acert|\d+\s*%|\d+\s*(?:x|vezes))/i.test(text)
      ? [
          {
            type: inferCriterionType(text),
            description: text,
            threshold: extractCriterionThreshold(text),
          },
        ]
      : [];

    return {
      name: activityName,
      description: activityDescription,
      objective: sessionObjective,
      criteria,
      source: "fallback",
      confidence: 0,
      progression: progressionLabel,
    };
  });

const toStructuredActivitiesWithAiFallback = async (
  block: PedagogicalPlanBlock,
  sessionObjective: string,
  progressionLabel: ProgressionDimension,
  blockKey: SessionBlockKey,
  blockSummary?: string,
  pedagogicalApproach?: SessionPedagogicalApproach | null,
  focusSkill?: VolleyballSkill | null,
  aiCache?: {
    organizationId?: string | null;
    periodLabel?: string | null;
    scope?: string | null;
  }
): Promise<TrainingPlanActivity[]> => {
  const fallback = toStructuredActivities(
    block,
    sessionObjective,
    progressionLabel,
    blockKey,
    blockSummary,
    pedagogicalApproach,
    focusSkill
  );

  const normalizeActivityKey = (value: string) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const tokenize = (value: string) =>
    normalizeActivityKey(value)
      .split(/[^a-z0-9]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  const overlapScore = (left: string, right: string) => {
    const leftTokens = tokenize(left);
    const rightTokens = tokenize(right);
    if (!leftTokens.length || !rightTokens.length) return 0;

    const leftSet = new Set(leftTokens);
    const rightSet = new Set(rightTokens);
    const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
    const union = new Set([...leftSet, ...rightSet]).size;
    if (!union) return 0;
    return intersection / union;
  };

  const rankMatchConfidence = (fallbackName: string, aiName: string) => {
    const fallbackKey = normalizeActivityKey(fallbackName);
    const aiKey = normalizeActivityKey(aiName);
    if (!fallbackKey || !aiKey) return 0;
    if (fallbackKey === aiKey) return 1;
    if (fallbackKey.includes(aiKey) || aiKey.includes(fallbackKey)) return 0.84;
    const tokenScore = overlapScore(fallbackName, aiName);
    if (tokenScore >= 0.75) return 0.76;
    if (tokenScore >= 0.55) return 0.68;
    if (tokenScore >= 0.4) return 0.6;
    return 0;
  };

  const scoreAiStructuredActivitySemanticQuality = (value: {
    description: string;
    objective: string;
    criteria: Array<{ description: string }>;
  }) => {
    const descriptionLength = value.description.length;
    const objectiveLength = value.objective.length;
    const hasShortCriterion = value.criteria.some((criterion) => criterion.description.length < 6);

    const baselineValid = descriptionLength >= 10 && objectiveLength >= 4 && !hasShortCriterion;
    if (!baselineValid) {
      return { score: 0.5, bucket: "poor" as const };
    }

    const richDescription = descriptionLength >= 24;
    const richObjective = objectiveLength >= 12;
    if (richDescription && richObjective) {
      return { score: 1, bucket: "good" as const };
    }

    return { score: 0.75, bucket: "medium" as const };
  };

  try {
    const response = await generateStructuredActivitiesWithAI(
      {
        objective: sessionObjective,
        progression: progressionLabel,
        activities: block.activities.map((activity) => ({
          name: String(activity.name || "").trim(),
          description: String(activity.description || "").trim(),
        })),
      },
      {
        cache: {
          organizationId: aiCache?.organizationId ?? null,
          periodLabel: aiCache?.periodLabel ?? null,
          scope: aiCache?.scope ?? "session-structured-activities",
        },
      }
    );

    if (!response.activities.length) {
      logAction("structuredActivities fallback", {
        reason: "empty_ai_response",
        activities: fallback.length,
      });
      return fallback;
    }

    const aiByName = new Map(
      response.activities
        .map((activity) => [normalizeActivityKey(activity.name), activity] as const)
        .filter(([key]) => Boolean(key))
    );

    const aiCandidates = response.activities
      .map((activity) => ({
        key: normalizeActivityKey(activity.name),
        activity,
      }))
      .filter((item) => Boolean(item.key));

    const usedAiKeys = new Set<string>();

    let aiAppliedCount = 0;
    let exactMatchCount = 0;
    let fuzzyMatchCount = 0;
    let invalidAiContentCount = 0;
    let goodSemanticCount = 0;
    let mediumSemanticCount = 0;
    let poorSemanticCount = 0;
    let matchConfidenceSum = 0;
    let semanticQualitySum = 0;
    let finalConfidenceSum = 0;
    const merged = fallback.map((fallbackActivity) => {
      const key = normalizeActivityKey(fallbackActivity.name);
      const exactMatch = key ? aiByName.get(key) : undefined;

      let selectedActivity: (typeof response.activities)[number] | undefined = exactMatch;
      let matchConfidence = exactMatch ? 1 : 0;
      let selectedKey = exactMatch && key ? key : "";

      if (!selectedActivity) {
        let best: {
          key: string;
          activity: (typeof response.activities)[number];
          confidence: number;
        } | null = null;
        for (const candidate of aiCandidates) {
          if (usedAiKeys.has(candidate.key)) continue;
          const confidence = rankMatchConfidence(fallbackActivity.name, candidate.activity.name);
          if (confidence <= 0) continue;
          if (!best || confidence > best.confidence) {
            best = { key: candidate.key, activity: candidate.activity, confidence };
          }
        }
        if (best) {
          selectedActivity = best.activity;
          matchConfidence = best.confidence;
          selectedKey = best.key;
        }
      }

      if (!selectedActivity) {
        return {
          ...fallbackActivity,
          source: "fallback" as const,
          confidence: 0,
        };
      }

      if (selectedKey) {
        usedAiKeys.add(selectedKey);
      }

      if (matchConfidence >= 0.99) {
        exactMatchCount += 1;
      } else {
        fuzzyMatchCount += 1;
      }

      aiAppliedCount += 1;
      const rawName = String(selectedActivity.name || fallbackActivity.name || "Atividade").trim();
      const aiDescription = String(selectedActivity.description || "").trim();
      const resolvedDescription = resolveActivityDescription({
        name: rawName,
        description: aiDescription || fallbackActivity.description,
        blockKey,
        blockSummary,
        pedagogicalApproach,
        focusSkill,
      });
      const aiObjective = String(selectedActivity.objective || "").trim();
      const normalizedCriteria = Array.isArray(selectedActivity.criteria)
        ? selectedActivity.criteria.map((criterion) => ({
            type: criterion.type,
            description:
              String(criterion.description || "").trim() ||
              resolvedDescription ||
              rawName,
            threshold:
              typeof criterion.threshold === "number" && Number.isFinite(criterion.threshold)
                ? criterion.threshold
                : undefined,
          }))
        : [];
      const semanticQualityResult = scoreAiStructuredActivitySemanticQuality({
        description: aiDescription,
        objective: aiObjective,
        criteria: normalizedCriteria.map((criterion) => ({
          description: criterion.description,
        })),
      });
      if (semanticQualityResult.bucket === "good") {
        goodSemanticCount += 1;
      } else if (semanticQualityResult.bucket === "medium") {
        mediumSemanticCount += 1;
      } else {
        poorSemanticCount += 1;
        invalidAiContentCount += 1;
      }

      const semanticQuality = semanticQualityResult.score;
      const finalConfidence = Number((matchConfidence * semanticQuality).toFixed(2));
      matchConfidenceSum += matchConfidence;
      semanticQualitySum += semanticQuality;
      finalConfidenceSum += finalConfidence;

      return {
        name: rawName,
        description: resolvedDescription,
        objective: aiObjective || sessionObjective,
        criteria: normalizedCriteria,
        source: "ai" as const,
        confidence: finalConfidence,
        progression: progressionLabel,
      };
    });

    const avgFinalConfidence = aiAppliedCount
      ? Number((finalConfidenceSum / aiAppliedCount).toFixed(3))
      : 0;
    const invalidAiContentRatio = aiAppliedCount
      ? Number((invalidAiContentCount / aiAppliedCount).toFixed(3))
      : 0;
    const reviewRecommended =
      aiAppliedCount > 0 && (avgFinalConfidence < 0.7 || invalidAiContentRatio > 0.3);

    logAction("structuredActivities ai used", {
      total: merged.length,
      aiApplied: aiAppliedCount,
      fallbackUsed: merged.length - aiAppliedCount,
      aiCoverage: merged.length ? Number((aiAppliedCount / merged.length).toFixed(3)) : 0,
      exactMatches: exactMatchCount,
      fuzzyMatches: fuzzyMatchCount,
      invalidAiContent: invalidAiContentCount,
      invalidAiContentRatio,
      semanticGood: goodSemanticCount,
      semanticMedium: mediumSemanticCount,
      semanticPoor: poorSemanticCount,
      avgMatchConfidence: aiAppliedCount
        ? Number((matchConfidenceSum / aiAppliedCount).toFixed(3))
        : 0,
      avgSemanticQuality: aiAppliedCount
        ? Number((semanticQualitySum / aiAppliedCount).toFixed(3))
        : 0,
      avgFinalConfidence,
      reviewRecommended,
    });

    return merged;
  } catch {
    logAction("structuredActivities fallback", {
      reason: "ai_error",
      activities: fallback.length,
    });
    return fallback;
  }
};

const buildAutoPlanPedagogy = (
  pkg: PedagogicalPlanPackage,
  methodology: TrainingPlanPedagogy["methodology"] | null,
  classPlan?: ClassPlan | null,
  structuredBlocks?: NonNullable<TrainingPlanPedagogy["blocks"]>,
  pedagogicalConfig?: PedagogicalDimensionsConfig | null,
  options?: {
    sessionId?: string;
    scoutingPrioritySkill?: VolleyballSkill | null;
    scoutingCounts?: ScoutingCounts;
    skillHistoryBySkill?: Partial<Record<VolleyballSkill, SessionSkillHistoryEntry[]>>;
    generationExplanation?: TrainingPlanPedagogy["generationExplanation"];
    decisionOverride?: {
      appliedAdjustment: "increase" | "maintain" | "regress";
      reasonType?: "health" | "readiness" | "context" | "other";
      note?: string;
    };
  }
): TrainingPlanPedagogy => {
  const explicitObjectives = buildPedagogicalObjectives(pkg, options);
  const pedagogicalApproach = explicitObjectives.pedagogicalApproach;
  const resolvedFocusSkill = options?.scoutingPrioritySkill ?? pickFocusSkill(pkg);
  const skillHistory = options?.skillHistoryBySkill?.[resolvedFocusSkill] ?? [];
  const outcome = options?.scoutingCounts
    ? evaluateSessionOutcome({
        focusSkill: resolvedFocusSkill,
        successCriteria: explicitObjectives.successCriteria ?? [],
        scoutingCounts: options.scoutingCounts,
        history: skillHistory,
      })
    : null;

  // ========== PEDAGOGICAL DIMENSIONS INTEGRATION ==========
  // Derive base dimensions profile from age, level, phase
  let dimensionsResult = null;
  if (pedagogicalConfig) {
    try {
      const ageBand = String(pkg.input.classGroup.ageBand ?? "");
      const ageMatches = ageBand.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
      const studentAge = ageMatches.length ? ageMatches[ageMatches.length - 1] : 12;
      const classLevel = pkg.input.classGroup.level;
      const rawPhase = String(classPlan?.phase ?? "fundamentos").toLowerCase();
      const periodizationPhase =
        rawPhase === "consolidacao" || rawPhase === "consolidação"
          ? "consolidacao"
          : rawPhase === "especializacao" || rawPhase === "especialização"
          ? "especializacao"
          : rawPhase === "competicao" || rawPhase === "competição"
          ? "competicao"
          : "fundamentos";

      const mappedGapLevel = outcome?.gap.level
        ? outcome.gap.level
        : undefined;

      dimensionsResult = deriveDimensionsProfile(
        {
          studentAge,
          classLevel,
          periodizationPhase,
          performanceState: outcome
            ? {
                gap: mappedGapLevel ? { level: mappedGapLevel } : undefined,
                trend: outcome.skillLearningState?.trend,
                consistencyScore: outcome.consistencyScore,
                sampleConfidence: outcome.sampleConfidence,
              }
            : undefined,
        },
        pedagogicalConfig
      );

      // Refine profile based on evaluation
      if (outcome) {
        dimensionsResult.refinedProfile = refineDimensionsByEvaluation(
          dimensionsResult.baseProfile,
          outcome,
          pedagogicalConfig
        );
      }

      if (__DEV__) {
        logAction("pedagogical dimensions derived", {
          classId: pkg.input.classGroup.id,
          base: formatDimensionsProfile(dimensionsResult.baseProfile),
          refined: dimensionsResult.refinedProfile
            ? formatDimensionsProfile(dimensionsResult.refinedProfile)
            : "none",
          adjustments: dimensionsResult.refinedProfile?.adjustments
            ? formatRefinements(dimensionsResult.refinedProfile.adjustments)
            : "none",
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.warn("Failed to derive pedagogical dimensions:", error);
      }
    }
  }
  // ========== END DIMENSIONS INTEGRATION ==========

  const activeDimensionsProfile =
    dimensionsResult?.refinedProfile ?? dimensionsResult?.baseProfile;
  const dimensionGuidelines = activeDimensionsProfile
    ? buildDimensionGuidelines(activeDimensionsProfile)
    : [];
  const capObjectives = activeDimensionsProfile
    ? buildCAPFromDimensions(activeDimensionsProfile)
    : { conceitual: [], procedimental: [], atitudinal: [] };

  const learningObjectives = {
    ...explicitObjectives,
    specific: explicitObjectives.specific ?? [],
    cap: {
      conceitual: capObjectives.conceitual,
      procedimental: capObjectives.procedimental,
      atitudinal: capObjectives.atitudinal,
    },
    pedagogicalGuidelines: Array.from(
      new Set([
        ...(explicitObjectives.pedagogicalGuidelines ?? []),
        ...dimensionGuidelines,
        ...(outcome
          ? [
              `Ajuste sugerido: ${
                outcome.adjustment === "increase"
                  ? "aumentar"
                  : outcome.adjustment === "regress"
                  ? "regredir"
                  : "manter"
              } progressao no proximo treino.`,
            ]
          : []),
      ])
    ),
  };

  const periodizationContext = buildPeriodizationContext({
    objective: explicitObjectives.general,
    focus: resolvedFocusSkill,
    classPlan,
    constraints: [
      ...(pkg.input.constraints ?? []),
      ...(classPlan?.constraints ? [classPlan.constraints] : []),
      ...(classPlan?.rpeTarget ? [`RPE alvo ${classPlan.rpeTarget}`] : []),
    ],
    pedagogicalIntent: explicitObjectives.general,
    load: pickLoad(pkg),
    planningMode: null,
  });

  const suggestedAdjustment = outcome?.adjustment;
  const appliedAdjustment =
    options?.decisionOverride?.appliedAdjustment ?? suggestedAdjustment;
  const wasFollowed =
    suggestedAdjustment !== undefined && appliedAdjustment !== undefined
      ? suggestedAdjustment === appliedAdjustment
      : true;
  const decisionReason = !wasFollowed
    ? {
        type: options?.decisionOverride?.reasonType,
        note: options?.decisionOverride?.note?.trim() || undefined,
      }
    : undefined;
  const classId = pkg.input.classGroup.id;
  const sessionId = options?.sessionId ?? `${classId}:${new Date().toISOString().slice(0, 10)}`;

  return {
    generationExplanation: options?.generationExplanation,
    sessionObjective: explicitObjectives.general,
    learningObjectives,
    adaptation: outcome
      ? {
          achieved: outcome.achieved,
          performanceScore: outcome.performanceScore,
          targetScore: outcome.targetScore,
          adjustment: outcome.adjustment,
          evidence: outcome.evidence,
          sampleConfidence: outcome.sampleConfidence,
          learningVelocity: outcome.learningVelocity,
          consistencyScore: outcome.consistencyScore,
          deltaFromPrevious: outcome.deltaFromPrevious,
          gap: outcome.gap,
          telemetry: {
            decisionId: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            decision: {
              suggested: outcome.adjustment,
              applied: appliedAdjustment ?? outcome.adjustment,
              wasFollowed,
            },
            context: {
              gapLevel: outcome.gap.level,
              trend: outcome.skillLearningState.trend,
              sampleConfidence: outcome.sampleConfidence,
              consistencyScore: outcome.consistencyScore,
              learningVelocity: outcome.learningVelocity,
            },
            reason:
              decisionReason && (decisionReason.type || decisionReason.note)
                ? decisionReason
                : undefined,
            meta: {
              sessionId,
              classId,
            },
            timestamp: new Date().toISOString(),
          },
        }
      : undefined,
    skillLearningState: outcome?.skillLearningState,
    blocks:
      structuredBlocks ?? {
        warmup: {
          summary: pkg.final.warmup.summary,
          activities: toStructuredActivities(
            pkg.final.warmup,
            explicitObjectives.general,
            pickProgressionDimension(pkg),
            "warmup",
            pkg.final.warmup.summary,
            pedagogicalApproach,
            resolvedFocusSkill
          ),
        },
        main: {
          summary: pkg.final.main.summary,
          activities: toStructuredActivities(
            pkg.final.main,
            explicitObjectives.general,
            pickProgressionDimension(pkg),
            "main",
            pkg.final.main.summary,
            pedagogicalApproach,
            resolvedFocusSkill
          ),
        },
        cooldown: {
          summary: pkg.final.cooldown.summary,
          activities: toStructuredActivities(
            pkg.final.cooldown,
            explicitObjectives.general,
            pickProgressionDimension(pkg),
            "cooldown",
            pkg.final.cooldown.summary,
            pedagogicalApproach,
            resolvedFocusSkill
          ),
        },
      },
    periodizationContext,
    periodization: classPlan
      ? {
          phase: classPlan.phase,
          theme: classPlan.theme,
          technicalFocus: classPlan.technicalFocus,
          physicalFocus: classPlan.physicalFocus,
          constraints: classPlan.constraints,
          rpeTarget: classPlan.rpeTarget,
          weekNumber: classPlan.weekNumber,
          startDate: classPlan.startDate,
        }
      : undefined,
    objective: {
      type: pickObjectiveType(pkg),
      description: explicitObjectives.general,
    },
    focus: {
      skill: resolvedFocusSkill,
    },
    progression: {
      dimension: pickProgressionDimension(pkg),
    },
    developmentStage: pickDevelopmentStage(pkg.input.classGroup),
    load: pickLoad(pkg),
    methodology: methodology ?? undefined,
    pedagogicalApproach,
    dimensions: dimensionsResult
      ? {
          base: dimensionsResult.baseProfile,
          refined: dimensionsResult.refinedProfile,
          derivedAt: dimensionsResult.derivedAt,
          confidenceLevel: dimensionsResult.confidenceLevel,
        }
      : undefined,
  };
};

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const normalizePlanningPhase = (phase?: string): PlanningPhase | undefined => {
  if (!phase) return undefined;
  const s = phase.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/competi/.test(s)) return /pre/.test(s) ? "pre_competitivo" : "competitivo";
  if (/desenvolv|tatico|tecnico/.test(s)) return "desenvolvimento";
  if (/base|fundament|coordenac|padroes|exploracao|ludic|consolidac/.test(s)) return "base";
  return undefined;
};

const parseRpeTarget = (rpeTarget?: string): number | undefined => {
  if (!rpeTarget) return undefined;
  const match = rpeTarget.match(/(\d+)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const toDimensionPhase = (
  phase?: PlanningPhase
): "fundamentos" | "consolidacao" | "especializacao" | "competicao" => {
  if (phase === "competitivo") return "competicao";
  if (phase === "pre_competitivo") return "especializacao";
  if (phase === "desenvolvimento") return "consolidacao";
  return "fundamentos";
};

const computeBaseDimensionGuidelines = (
  classGroup: ClassGroup,
  classPlan: ClassPlan | null | undefined,
  pedagogicalConfig: PedagogicalDimensionsConfig | null | undefined
): string[] => {
  if (!pedagogicalConfig) return [];
  try {
    const ageBand = String(classGroup.ageBand ?? "");
    const ageMatches = ageBand.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
    const studentAge = ageMatches.length ? ageMatches[ageMatches.length - 1] : 12;
    const result = deriveDimensionsProfile(
      {
        studentAge,
        classLevel: classGroup.level,
        periodizationPhase: toDimensionPhase(normalizePlanningPhase(classPlan?.phase)),
      },
      pedagogicalConfig
    );
    return buildDimensionGuidelines(result.baseProfile);
  } catch {
    return [];
  }
};

const buildPedagogicalInputHash = (pkg: PedagogicalPlanPackage) => {
  const students = (pkg.input.students ?? []).map((student) => student.id);
  const payload = {
    classId: pkg.input.classGroup.id,
    students: [...students].sort(),
    objective: pkg.input.objective,
    duration: pkg.input.duration,
    materials: [...(pkg.input.materials ?? [])].map((item) => String(item ?? "").trim()),
    constraints: [...(pkg.input.constraints ?? [])].map((item) => String(item ?? "").trim()),
    context: pkg.input.context ?? "",
    periodization: {
      phase: pkg.input.periodizationPhase ?? null,
      week: pkg.input.weekNumber ?? null,
      rpeTarget: pkg.input.rpeTarget ?? null,
    },
    analysis: {
      level: pkg.analysis.level,
      heterogeneity: pkg.analysis.heterogeneity,
    },
    final: {
      warmup: pkg.final.warmup.activities.map((activity) => activity.name),
      main: pkg.final.main.activities.map((activity) => activity.name),
      cooldown: pkg.final.cooldown.activities.map((activity) => activity.name),
      warmupDuration: pkg.final.warmup.duration,
      mainDuration: pkg.final.main.duration,
      cooldownDuration: pkg.final.cooldown.duration,
    },
  };
  return stableSerialize(payload);
};

const getLatestFinalPlanForSession = async (
  organizationId: string | null,
  classId: string,
  sessionDateValue: string,
  weekdayValue: number
) => {
  const baseQuery = {
    organizationId,
    classId,
    status: "final" as const,
    orderBy: "version_desc" as const,
    limit: 1,
  };
  const byDate = await getTrainingPlans({
    ...baseQuery,
    applyDate: sessionDateValue,
  });
  if (byDate[0]) {
    return byDate[0];
  }
  const byWeekday = await getTrainingPlans({
    ...baseQuery,
    applyWeekday: weekdayValue,
  });
  return byWeekday[0] ?? null;
};

const convertPedagogicalPlanToTrainingPlan = (
  pkg: PedagogicalPlanPackage,
  classId: string,
  sessionDateValue: string,
  existingPlan: TrainingPlan | null,
  version: number,
  pedagogy?: TrainingPlanPedagogy
): TrainingPlan => {
  const nowIso = new Date().toISOString();
  const title = `${pkg.input.classGroup.name} · ${pickPedagogicalObjectiveLabel(pkg.input.objective)}`;
  const blockTimes = getLessonBlockTimes(pkg.input.duration ?? 60);
  return createTrainingPlanVersion({
    classId,
    version,
    origin: "auto",
    draft: {
      title,
      tags: [
        `modo:${pkg.generated.basePlanKind}`,
        `nivel:${pkg.analysis.level}`,
        `heterogeneidade:${pkg.analysis.heterogeneity}`,
        `contexto:${pkg.input.context ?? "treinamento"}`,
      ],
      warmup: pkg.final.warmup.activities.map((activity) => activity.name),
      main: pkg.final.main.activities.map((activity) => activity.name),
      cooldown: pkg.final.cooldown.activities.map((activity) => activity.name),
      warmupTime: `${blockTimes.warmupMinutes} min`,
      mainTime: `${blockTimes.mainMinutes} min`,
      cooldownTime: `${blockTimes.cooldownMinutes} min`,
    },
    applyDays: existingPlan?.applyDays ?? [],
    applyDate: existingPlan?.applyDate ?? sessionDateValue,
    inputHash: buildPedagogicalInputHash(pkg),
    nowIso,
    idPrefix: "plan_pedagogical",
    status: "final",
    generatedAt: nowIso,
    finalizedAt: nowIso,
    pedagogy,
  });
};

const pedagogicalPlanToAiDraft = (pkg: PedagogicalPlanPackage) => {
  const blockTimes = getLessonBlockTimes(pkg.input.duration ?? 60);
  return {
    title: `${pkg.input.classGroup.name} · ${pickPedagogicalObjectiveLabel(pkg.input.objective)}`,
    tags: [
      `modo:${pkg.generated.basePlanKind}`,
      `nivel:${pkg.analysis.level}`,
      `heterogeneidade:${pkg.analysis.heterogeneity}`,
      `contexto:${pkg.input.context ?? "treinamento"}`,
    ],
    warmup: pkg.final.warmup.activities.map((activity) => activity.name),
    main: pkg.final.main.activities.map((activity) => activity.name),
    cooldown: pkg.final.cooldown.activities.map((activity) => activity.name),
    warmupTime: `${blockTimes.warmupMinutes} min`,
    mainTime: `${blockTimes.mainMinutes} min`,
    cooldownTime: `${blockTimes.cooldownMinutes} min`,
  };
};

const buildPedagogicalAiDraft = (pkg: PedagogicalPlanPackage) =>
  JSON.stringify(pedagogicalPlanToAiDraft(pkg));

const applyEditedDraftToPackage = (
  pkg: PedagogicalPlanPackage,
  editedDraft?: LessonPlanDraft
): PedagogicalPlanPackage => {
  if (!editedDraft) return pkg;
  return {
    ...pkg,
    final: {
      ...pkg.final,
      ...editedDraft,
      edited: true,
      finalizedAt: new Date().toISOString(),
    },
  };
};

  const buildSessionTrainingPlan = (
  pkg: PedagogicalPlanPackage,
  classId: string,
  sessionDateValue: string,
  existingPlan: TrainingPlan | null,
  version: number,
  pedagogy?: TrainingPlanPedagogy
): TrainingPlan =>
  convertPedagogicalPlanToTrainingPlan(
    pkg,
    classId,
    sessionDateValue,
    existingPlan,
    version,
    pedagogy
  );

const toPersistedGenerationExplanation = (
  explanation: AutoPlanForCycleDayResult["explanation"],
  planningBasis: TrainingPlanPlanningBasis
): NonNullable<TrainingPlanPedagogy["generationExplanation"]> => ({
  historyMode: explanation.historyMode,
  summary: explanation.summary,
  coachSummary: explanation.coachSummary,
  planningBasis,
  generationMode: toGenerationMode(planningBasis),
});

const waitForInteractionIdle = () =>
  new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      resolve();
    });
  });

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("empty_data_url"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("file_reader_error"));
    reader.readAsDataURL(blob);
  });

const convertWebImageUriForPdf = async (uri: string) => {
  const normalized = String(uri ?? "").trim();
  if (!normalized) return normalized;
  if (/^data:image\//i.test(normalized)) return normalized;
  try {
    const response = await fetch(normalized);
    if (!response.ok) return normalized;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return normalized;
  }
};

const shiftIsoDate = (isoDate: string, deltaDays: number) => {
  const base = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + deltaDays);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeClassDaysOfWeek = (daysOfWeek: number[] | undefined) =>
  (daysOfWeek ?? [])
    .map((value) => Number(value))
    .map((value) => (value === 7 ? 0 : value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

export default function SessionScreen() {
  const { id, date, tab, autogenerate, source } = useLocalSearchParams<{
    id: string;
    date?: string;
    tab?: string;
    autogenerate?: string;
    source?: string;
  }>();
  const router = useRouter();
  const { config: pedagogicalConfig } = usePedagogicalConfig();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useAppTheme();
  const { confirm } = useConfirmDialog();
  const { showSaveToast } = useSaveToast();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [savedClassPlans, setSavedClassPlans] = useState<TrainingPlan[]>([]);
  const [sessionStudents, setSessionStudents] = useState<Student[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingSessionExtras, setIsLoadingSessionExtras] = useState(true);
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const [scoutingLog, setScoutingLog] = useState<ScoutingLog | null>(null);
  const [scoutingCounts, setScoutingCounts] = useState(createEmptyCounts());
  const [scoutingBaseline, setScoutingBaseline] = useState(createEmptyCounts());
  const [scoutingSaving, setScoutingSaving] = useState(false);
  const [scoutingMode, setScoutingMode] = useState<"treino" | "jogo">("treino");
  const [showScoutingGuide, setShowScoutingGuide] = useState(false);
  const [studentsCount, setStudentsCount] = useState(0);
  const [sessionTab, setSessionTab] = useState<SessionTabId>("treino");
  const sessionTabAnim = useRef<Record<SessionTabId, Animated.Value>>({
    treino: new Animated.Value(1),
    relatório: new Animated.Value(0),
    scouting: new Animated.Value(0),
  }).current;
  const [showAppliedPreview, setShowAppliedPreview] = useState(false);
  const [PSE, setPSE] = useState<number>(0);
  const [technique, setTechnique] = useState<"boa" | "ok" | "ruim" | "nenhum">(
    "nenhum"
  );
  const [activity, setActivity] = useState("");
  const [autoActivity, setAutoActivity] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [isRewritingActivity, setIsRewritingActivity] = useState(false);
  const [isRewritingConclusion, setIsRewritingConclusion] = useState(false);
  const [participantsCount, setParticipantsCount] = useState("");
  const [photos, setPhotos] = useState("");
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [photoActionIndex, setPhotoActionIndex] = useState<number | null>(null);
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [showPsePicker, setShowPsePicker] = useState(false);
  const [showTechniquePicker, setShowTechniquePicker] = useState(false);
  const [showPlanFabMenu, setShowPlanFabMenu] = useState(false);
  const [showSavedClassPlans, setShowSavedClassPlans] = useState(false);
  const [isApplyingSavedPlanId, setIsApplyingSavedPlanId] = useState<string | null>(null);
  const [isRemovingAppliedPlan, setIsRemovingAppliedPlan] = useState(false);
  const planFabAnim = useRef(new Animated.Value(0)).current;
  const planGenerationAnim = useRef(new Animated.Value(0)).current;
  const planGenerationLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [pedagogicalPlanPackage, setPedagogicalPlanPackage] = useState<PedagogicalPlanPackage | null>(null);
  const [currentClassPlan, setCurrentClassPlan] = useState<ClassPlan | null>(null);
  const [currentDailyLessonPlan, setCurrentDailyLessonPlan] = useState<DailyLessonPlan | null>(null);
  const [isResolvingCurrentClassPlan, setIsResolvingCurrentClassPlan] = useState(false);
  const [planGenerationPhase, setPlanGenerationPhase] = useState<
    "idle" | "generating" | "saving" | "settling"
  >("idle");
  const [selectedBlockKey, setSelectedBlockKey] = useState<"warmup" | "main" | "cooldown" | null>(null);
  const [isSavingBlockEdit, setIsSavingBlockEdit] = useState(false);
  const [lastUpdatedBlockKey, setLastUpdatedBlockKey] = useState<"warmup" | "main" | "cooldown" | null>(null);
  const [methodologyEvidence, setMethodologyEvidence] = useState<SessionMethodologyEvidence | null>(null);
  const [showPedagogicalPanel, setShowPedagogicalPanel] = useState(false);
  const pedagogicalPanelCollapse = useCollapsibleAnimation(showPedagogicalPanel, {
    translateY: -6,
  });
  const [showDecisionOverrideModal, setShowDecisionOverrideModal] = useState(false);
  const [showMissingPeriodizationModal, setShowMissingPeriodizationModal] = useState(false);
  const hasUsableCurrentClassPlan = useMemo(
    () => hasUsablePeriodization(currentClassPlan),
    [currentClassPlan]
  );
  const [isApplyingDecisionOverride, setIsApplyingDecisionOverride] = useState(false);
  const [decisionAppliedAdjustment, setDecisionAppliedAdjustment] = useState<
    "increase" | "maintain" | "regress"
  >("maintain");
  const [decisionReasonType, setDecisionReasonType] = useState<
    "health" | "readiness" | "context" | "other" | null
  >(null);
  const [decisionReasonNote, setDecisionReasonNote] = useState("");
  const [containerWindow, setContainerWindow] = useState<{ x: number; y: number } | null>(null);
  const [pseTriggerLayout, setPseTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [techniqueTriggerLayout, setTechniqueTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [reportBaseline, setReportBaseline] = useState({
    PSE: 0,
    technique: "nenhum" as "boa" | "ok" | "ruim" | "nenhum",
    activity: "",
    conclusion: "",
    participantsCount: "",
    photos: "",
  });
  const containerRef = useRef<View>(null);
  const pseTriggerRef = useRef<View>(null);
  const techniqueTriggerRef = useRef<View>(null);
  const lastRewriteAppliedRef = useRef<{
    field: ReportRewriteField;
    previousText: string;
    nextText: string;
  } | null>(null);
  const periodizationAutoGenerateKeyRef = useRef<string | null>(null);
  const { animatedStyle: psePickerAnimStyle, isVisible: showPsePickerContent } =
    useCollapsibleAnimation(showPsePicker, { translateY: -6 });
  const { animatedStyle: techniquePickerAnimStyle, isVisible: showTechniquePickerContent } =
    useCollapsibleAnimation(showTechniquePicker, { translateY: -6 });
  const planFabBottom = Math.max(insets.bottom + 166, 182);
  const planFabMenuBottom = planFabBottom + 74;
  const hasExplicitSessionDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const sessionDate =
    hasExplicitSessionDate
      ? date
      : (() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        })();
  const shouldAutoGenerateFromPeriodization =
    autogenerate === "1" && source === "periodization";

  useEffect(() => {
    if (hasExplicitSessionDate || !cls) return;

    const classDays = normalizeClassDaysOfWeek(cls.daysOfWeek);
    if (!classDays.length) return;

    const today = new Date();
    const todayWeekday = today.getDay();
    const targetDate = classDays.includes(todayWeekday)
      ? today
      : calculateAdjacentClassDate(classDays, today, 1);

    if (!targetDate) return;
    const targetIsoDate = formatIsoDate(targetDate);
    if (targetIsoDate === sessionDate) return;

    router.replace({
      pathname: "/class/[id]/session",
      params: {
        id: cls.id,
        date: targetIsoDate,
        tab: typeof tab === "string" ? tab : undefined,
        autogenerate: typeof autogenerate === "string" ? autogenerate : undefined,
        source: typeof source === "string" ? source : undefined,
      },
    });
  }, [
    autogenerate,
    cls,
    hasExplicitSessionDate,
    router,
    sessionDate,
    source,
    tab,
  ]);

  const parseTime = (value: string) => {
    const parts = value.split(":");
    const hour = Number(parts[0]);
    const minute = Number(parts[1] ?? "0");
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
  };
  const formatRange = (hour: number, minute: number, durationMinutes: number) => {
    const start = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
    const endTotal = hour * 60 + minute + durationMinutes;
    const endHour = Math.floor(endTotal / 60) % 24;
    const endMinute = endTotal % 60;
    const end = String(endHour).padStart(2, "0") + ":" + String(endMinute).padStart(2, "0");
    return start + " - " + end;
  };
  const weekdayId = useMemo(() => {
    const dateObj = new Date(sessionDate);
    const day = dateObj.getDay();
    return day === 0 ? 7 : day;
  }, [sessionDate]);
  const isGeneratingPedagogicalPlan = planGenerationPhase === "generating";
  const isSavingPedagogicalPlan =
    planGenerationPhase === "saving" || planGenerationPhase === "settling";
  const isPlanGenerationBusy = planGenerationPhase !== "idle";
  const planGenerationLabel = planGenerationPhase === "generating"
    ? "Gerando plano"
    : "Salvando plano";
  const planGenerationSubtitle = planGenerationPhase === "settling"
    ? "Atualizando a aula do dia com o novo treino."
    : planGenerationPhase === "saving"
      ? "Aplicando o treino na aula do dia."
      : "Montando os blocos da sessao para esta turma.";
  const generationExplanation = plan?.pedagogy?.generationExplanation;
  const generationHistoryLabel =
    generationExplanation?.historyMode === "bootstrap"
      ? "Bootstrap do ciclo"
      : generationExplanation?.historyMode === "strong_history"
        ? "Historico forte"
        : generationExplanation?.historyMode === "partial_history"
          ? "Historico parcial"
          : null;
  const planGenerationPulse = useMemo(
    () =>
      planGenerationAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.38, 1, 0.38],
      }),
    [planGenerationAnim]
  );
  const planGenerationDotOne = useMemo(
    () =>
      planGenerationAnim.interpolate({
        inputRange: [0, 0.2, 1],
        outputRange: [0.3, 1, 0.3],
      }),
    [planGenerationAnim]
  );
  const planGenerationDotTwo = useMemo(
    () =>
      planGenerationAnim.interpolate({
        inputRange: [0, 0.18, 0.38, 1],
        outputRange: [0.3, 0.3, 1, 0.3],
      }),
    [planGenerationAnim]
  );
  const planGenerationDotThree = useMemo(
    () =>
      planGenerationAnim.interpolate({
        inputRange: [0, 0.36, 0.56, 1],
        outputRange: [0.3, 0.3, 1, 0.3],
      }),
    [planGenerationAnim]
  );

  useEffect(() => {
    Animated.timing(planFabAnim, {
      toValue: showPlanFabMenu ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [planFabAnim, showPlanFabMenu]);

  useEffect(() => {
    if (!isPlanGenerationBusy) {
      planGenerationLoopRef.current?.stop();
      planGenerationLoopRef.current = null;
      planGenerationAnim.stopAnimation();
      planGenerationAnim.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(planGenerationAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    planGenerationAnim.setValue(0);
    planGenerationLoopRef.current = animation;
    animation.start();

    return () => {
      animation.stop();
      if (planGenerationLoopRef.current === animation) {
        planGenerationLoopRef.current = null;
      }
      planGenerationAnim.stopAnimation();
      planGenerationAnim.setValue(0);
    };
  }, [isPlanGenerationBusy, planGenerationAnim]);

  useEffect(() => {
    setReportBaseline({
      PSE: 0,
      technique: "nenhum",
      activity: "",
      conclusion: "",
      participantsCount: "",
      photos: "",
    });
    setPSE(0);
    setTechnique("nenhum");
    setActivity("");
    setConclusion("");
    setParticipantsCount("");
    setPhotos("");
    setShowSavedClassPlans(false);
    setIsApplyingSavedPlanId(null);
  }, [id, sessionDate]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentClassPlan = async () => {
      if (!cls) {
        setCurrentClassPlan(null);
        setIsResolvingCurrentClassPlan(false);
        return;
      }
      setIsResolvingCurrentClassPlan(true);
      try {
        const plans = await getClassPlansByClass(cls.id, {
          organizationId: cls.organizationId ?? null,
        });
        if (cancelled) return;
        setCurrentClassPlan(pickClassPlanForSessionDate(plans, sessionDate));
      } catch {
        if (!cancelled) setCurrentClassPlan(null);
      } finally {
        if (!cancelled) setIsResolvingCurrentClassPlan(false);
      }
    };

    void loadCurrentClassPlan();

    return () => {
      cancelled = true;
    };
  }, [cls?.id, cls?.organizationId, sessionDate]);

  useEffect(() => {
    periodizationAutoGenerateKeyRef.current = null;
  }, [id, sessionDate, shouldAutoGenerateFromPeriodization]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentDailyLessonPlan = async () => {
      if (!currentClassPlan?.id) {
        setCurrentDailyLessonPlan(null);
        return;
      }

      try {
        const dailyPlan = await getDailyLessonPlanByWeekAndDate(
          currentClassPlan.id,
          sessionDate,
        );
        if (!cancelled) {
          setCurrentDailyLessonPlan(dailyPlan);
        }
      } catch {
        if (!cancelled) {
          setCurrentDailyLessonPlan(null);
        }
      }
    };

    void loadCurrentDailyLessonPlan();

    return () => {
      cancelled = true;
    };
  }, [currentClassPlan?.id, sessionDate]);

  useEffect(() => {
    let cancelled = false;

    const loadMethodologyEvidence = async () => {
      const methodology = plan?.pedagogy?.methodology;
      const kbRuleKey = methodology?.kbRuleKey?.trim();
      const knowledgeBaseVersionId = methodology?.reasoning?.knowledgeBaseVersionId?.trim();
      if (!kbRuleKey || !knowledgeBaseVersionId) {
        setMethodologyEvidence(null);
        return;
      }

      try {
        const citations = await getKnowledgeRuleCitations({ knowledgeRuleId: kbRuleKey });
        const sourceIds = citations
          .map((citation) => citation.knowledgeSourceId ?? "")
          .filter(Boolean);
        if (!sourceIds.length) {
          if (!cancelled) setMethodologyEvidence(null);
          return;
        }

        const sources = await getKnowledgeSources({ knowledgeBaseVersionId });
        const sourceById = new Map(sources.map((source) => [source.id, source] as const));
        const firstSource = sourceIds
          .map((sourceId) => sourceById.get(sourceId))
          .find((source): source is KnowledgeSource => Boolean(source));
        const firstCitation = citations.find((citation) => citation.knowledgeSourceId === firstSource?.id);

        if (!cancelled) {
          setMethodologyEvidence(
            firstSource
              ? {
                  title: firstSource.title,
                  authors: firstSource.authors,
                  sourceYear: firstSource.sourceYear ?? null,
                  citationText: firstCitation?.evidence || firstSource.citationText || firstSource.title,
                  url: firstSource.sourceUrl,
                }
              : null
          );
        }
      } catch {
        if (!cancelled) setMethodologyEvidence(null);
      }
    };

    void loadMethodologyEvidence();

    return () => {
      cancelled = true;
    };
  }, [
    plan?.pedagogy?.methodology?.kbRuleKey,
    plan?.pedagogy?.methodology?.reasoning?.knowledgeBaseVersionId,
  ]);

  useEffect(() => {
    setShowDecisionOverrideModal(false);
    setDecisionReasonType(null);
    setDecisionReasonNote("");
  }, [plan?.id]);

  const togglePicker = (target: "pse" | "technique") => {
    setShowPsePicker((prev) => (target === "pse" ? !prev : false));
    setShowTechniquePicker((prev) => (target === "technique" ? !prev : false));
  };

  const closePickers = () => {
    setShowPsePicker(false);
    setShowTechniquePicker(false);
  };

  const handleSelectPse = (value: number) => {
    setPSE(value);
    setShowPsePicker(false);
  };

  const handleSelectTechnique = (value: "boa" | "ok" | "ruim" | "nenhum") => {
    setTechnique(value);
    setShowTechniquePicker(false);
  };

  const handleApplyAutoActivity = () => {
    if (!autoActivity.trim()) return;
    if (activity.trim()) return;
    setActivity(autoActivity);
    closePickers();
    showSaveToast({
      message: "Atividade preenchida a partir do treino.",
      variant: "info",
    });
  };
  const canApplyAutoActivity = !!autoActivity.trim() && !activity.trim();
  const normalizeRewriteInput = (value: string) => value.trim().replace(/\s+/g, " ");
  const isRelevantForRewrite = (value: string) => {
    const normalized = normalizeRewriteInput(value);
    if (!normalized) return false;
    if (normalized.length < REPORT_RELEVANT_MIN_CHARS) return false;
    const words = normalized.split(" ").filter(Boolean);
    return words.length >= REPORT_RELEVANT_MIN_WORDS;
  };
  const canSuggestActivity = isRelevantForRewrite(activity);
  const canSuggestConclusion = isRelevantForRewrite(conclusion);
  const reportPhotoUris = useMemo(() => parseReportPhotoUris(photos), [photos]);

  const getRewriteFieldLabel = (field: ReportRewriteField) =>
    field === "activity" ? "Atividade" : "Conclusão";

  const applyPickedPhoto = (uri: string, replaceIndex?: number) => {
    setPhotos((previous) => {
      const list = parseReportPhotoUris(previous);
      if (
        typeof replaceIndex === "number" &&
        replaceIndex >= 0 &&
        replaceIndex < list.length
      ) {
        list[replaceIndex] = uri;
      } else if (list.length < REPORT_PHOTO_LIMIT) {
        list.push(uri);
      }
      return serializeReportPhotoUris(list);
    });
  };

  const pickReportPhoto = async (
    source: "camera" | "library",
    replaceIndex?: number
  ) => {
    if (isPickingPhoto) return;
    if (
      typeof replaceIndex !== "number" &&
      reportPhotoUris.length >= REPORT_PHOTO_LIMIT
    ) {
      showSaveToast({
        message: `Limite de ${REPORT_PHOTO_LIMIT} fotos por relatório.`,
        variant: "info",
      });
      return;
    }

    setIsPickingPhoto(true);
    try {
      if (source === "camera") {
        if (Platform.OS === "web") {
          showSaveToast({
            message: "Câmera indisponível no navegador. Use a galeria.",
            variant: "info",
          });
          return;
        }
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          showSaveToast({
            message: "Permissão de câmera não concedida.",
            variant: "error",
          });
          return;
        }
      } else if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== "granted") {
          showSaveToast({
            message: "Permissão da galeria não concedida.",
            variant: "error",
          });
          return;
        }
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
              aspect: [4, 3],
              base64: Platform.OS === "web",
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
              aspect: [4, 3],
              base64: Platform.OS === "web",
            });

      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      let photoUri = asset.uri;
      if (Platform.OS === "web" && asset.base64) {
        const mimeType =
          typeof asset.mimeType === "string" && asset.mimeType.trim()
            ? asset.mimeType
            : inferMimeTypeFromUri(asset.uri);
        photoUri = `data:${mimeType};base64,${asset.base64}`;
      }
      applyPickedPhoto(photoUri, replaceIndex);
    } catch {
      showSaveToast({
        message: ptBR.session.errors.photoSelectFailed,
        variant: "error",
      });
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const removePhotoAtIndex = (index: number) => {
    setPhotos((previous) => {
      const list = parseReportPhotoUris(previous);
      list.splice(index, 1);
      return serializeReportPhotoUris(list);
    });
  };

  const serializePhotosForPdf = async (rawPhotos: string) => {
    const uris = parseReportPhotoUris(rawPhotos).slice(0, 6);
    if (!uris.length) return rawPhotos;
    const resolved = await Promise.all(
      uris.map(async (uri) => {
        if (Platform.OS === "web") {
          return convertWebImageUriForPdf(uri);
        }
        if (!isLocalImageUri(uri)) return uri;
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: (FileSystem as any).EncodingType?.Base64 ?? "base64",
          });
          const mime = inferMimeTypeFromUri(uri);
          return `data:${mime};base64,${base64}`;
        } catch {
          return "";
        }
      })
    );
    return JSON.stringify(resolved.filter(Boolean));
  };

  const handleRewriteField = async (field: ReportRewriteField) => {
    const rawValue = field === "activity" ? activity : conclusion;
    const trimmed = normalizeRewriteInput(rawValue);
    const fieldLabel = getRewriteFieldLabel(field);

    if (!trimmed) {
      showSaveToast({
        message: `Preencha ${fieldLabel.toLowerCase()} antes de melhorar o texto.`,
        variant: "info",
      });
      return;
    }

    if (trimmed.length > REPORT_REWRITE_MAX_CHARS) {
      showSaveToast({
        message: `Limite de ${REPORT_REWRITE_MAX_CHARS} caracteres em ${fieldLabel.toLowerCase()}.`,
        variant: "error",
      });
      return;
    }

    if (field === "activity") {
      setIsRewritingActivity(true);
    } else {
      setIsRewritingConclusion(true);
    }

    logAction("IA melhorar texto iniciado", {
      classId: id,
      field,
      chars: trimmed.length,
      trigger: "manual",
    });

    try {
      const { rewrittenText } = await rewriteReportText({
        field,
        text: trimmed,
        mode: "projeto_social",
        maxChars: REPORT_REWRITE_MAX_CHARS,
        classId: typeof id === "string" ? id : undefined,
      });

      const currentText = normalizeRewriteInput(
        field === "activity" ? activity : conclusion
      );
      if (currentText !== trimmed) {
        return;
      }

      const previousText = field === "activity" ? activity : conclusion;
      if (field === "activity") {
        setActivity(rewrittenText);
      } else {
        setConclusion(rewrittenText);
      }
      lastRewriteAppliedRef.current = {
        field,
        previousText,
        nextText: rewrittenText,
      };
      showSaveToast({
        message: ptBR.session.success.textImproved,
        variant: "success",
        actionLabel: "Desfazer",
        onAction: () => {
          const snapshot = lastRewriteAppliedRef.current;
          if (!snapshot) return;
          if (snapshot.field === "activity") {
            setActivity(snapshot.previousText);
          } else {
            setConclusion(snapshot.previousText);
          }
        },
        durationMs: 4200,
      });
      logAction("IA melhorar texto sucesso", { classId: id, field, trigger: "manual" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      showSaveToast({
        message: message || ptBR.session.errors.textImproveFailed,
        variant: "error",
      });
      logAction("IA melhorar texto falha", {
        classId: id,
        field,
        trigger: "manual",
        reason: message || "unknown",
      });
    } finally {
      if (field === "activity") {
        setIsRewritingActivity(false);
      } else {
        setIsRewritingConclusion(false);
      }
    }
  };

  const syncPickerLayouts = () => {
    const hasPickerOpen = showPsePicker || showTechniquePicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showPsePicker) {
        pseTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setPseTriggerLayout({ x, y, width, height });
        });
      }
      if (showTechniquePicker) {
        techniqueTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setTechniqueTriggerLayout({ x, y, width, height });
        });
      }
      containerRef.current?.measureInWindow((x, y) => {
        setContainerWindow({ x, y });
      });
    });
  };

  useEffect(() => {
    let alive = true;
    setIsLoadingSession(true);
    (async () => {
      try {
        const data = await getClassById(id);
        if (alive) setCls(data);
        if (data) {
          const [classStudents, currentPlan, classTrainingPlans] = await Promise.all([
            getStudentsByClass(data.id),
            getLatestFinalPlanForSession(
              data.organizationId ?? null,
              data.id,
              sessionDate,
              weekdayId
            ),
            getTrainingPlans({
              organizationId: data.organizationId ?? null,
              classId: data.id,
              status: "final",
              orderBy: "createdat_desc",
              limit: 24,
            }),
          ]);
          if (alive) {
            setStudentsCount(classStudents.length);
            setSessionStudents(classStudents);
            setSavedClassPlans(compactTrainingPlans(classTrainingPlans));
          }
          if (alive) setPlan(currentPlan);
          if (!alive) return;
        } else if (alive) {
          setSavedClassPlans([]);
        }
        if (id) {
          const [log, scouting] = await Promise.all([
            getSessionLogByDate(id, sessionDate),
            getScoutingLogByDate(id, sessionDate, scoutingMode),
          ]);
          if (alive) {
            setSessionLog(log);
            if (log) {
              setPSE(typeof log.PSE === "number" ? log.PSE : 0);
              setTechnique(
                (log.technique as "boa" | "ok" | "ruim" | "nenhum") ?? "nenhum"
              );
              setActivity(log.activity ?? "");
              setConclusion(log.conclusion ?? "");
              setParticipantsCount(
                typeof log.participantsCount === "number"
                  ? String(log.participantsCount)
                  : ""
              );
              setPhotos(log.photos ?? "");
              setReportBaseline({
                PSE: typeof log.PSE === "number" ? log.PSE : 0,
                technique:
                  (log.technique as "boa" | "ok" | "ruim" | "nenhum") ?? "nenhum",
                activity: log.activity ?? "",
                conclusion: log.conclusion ?? "",
                participantsCount:
                  typeof log.participantsCount === "number"
                    ? String(log.participantsCount)
                    : "",
                photos: log.photos ?? "",
              });
            }
            const counts = scouting ? countsFromLog(scouting) : createEmptyCounts();
            setScoutingLog(scouting);
            setScoutingCounts(counts);
            setScoutingBaseline(counts);
          }
        }
      } finally {
        if (alive) setIsLoadingSession(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, sessionDate, scoutingMode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoadingSessionExtras(true);
      try {
        if (!id) return;
        const attendanceRecords = await getAttendanceByDate(id, sessionDate);
        if (!alive) return;
        if (attendanceRecords.length) {
          const present = attendanceRecords.filter(
            (record) => record.status === "presente"
          ).length;
          const total = attendanceRecords.length;
          const percent = total > 0 ? Math.round((present / total) * 100) : 0;
          setAttendancePercent(percent);
        } else if (studentsCount > 0) {
          setAttendancePercent(0);
        } else {
          setAttendancePercent(null);
        }
        if (!plan) return;
        const fallback = buildSimpleActivityFromPlan(plan);
        if (fallback) {
          setAutoActivity(fallback);
        }
      } finally {
        if (alive) setIsLoadingSessionExtras(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    id,
    sessionDate,
    plan,
    studentsCount,
  ]);

  useEffect(() => {
    syncPickerLayouts();
  }, [showPsePicker, showTechniquePicker]);

  const saveReport = async () => {
    if (!cls) return null;
    const dateValue =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;
    const createdAt =
      sessionLog?.createdAt ??
      (dateValue
        ? new Date(`${dateValue}T12:00:00`).toISOString()
        : new Date().toISOString());
    const participantsRaw = participantsCount.trim();
    const participantsValue = participantsRaw ? Number(participantsRaw) : Number.NaN;
    const parsedParticipants =
      Number.isFinite(participantsValue) && participantsValue >= 0
        ? participantsValue
        : undefined;
    const activityValue = activity.trim() || autoActivity.trim();
    const attendanceValue =
      typeof attendancePercent === "number" ? attendancePercent : 0;
    await saveSessionLog({
      id: sessionLog?.id,
      clientId: sessionLog?.clientId,
      classId: cls.id,
      PSE,
      technique,
      attendance: attendanceValue,
      activity: activityValue,
      conclusion,
      participantsCount: parsedParticipants,
      photos,
      createdAt,
    });
    setActivity(activityValue);
    setReportBaseline({
      PSE,
      technique,
      activity: activityValue,
      conclusion,
      participantsCount: parsedParticipants !== undefined ? String(parsedParticipants) : "",
      photos,
    });
    setSessionLog({
      id: sessionLog?.id,
      clientId: sessionLog?.clientId,
      classId: cls.id,
      PSE,
      technique,
      attendance: attendanceValue,
      activity: activityValue,
      conclusion,
      participantsCount: parsedParticipants,
      photos,
      createdAt,
    });
    return dateValue ?? new Date().toISOString().slice(0, 10);
  };

  const reportHasChanges =
    PSE !== reportBaseline.PSE ||
    technique !== reportBaseline.technique ||
    activity.trim() !== reportBaseline.activity.trim() ||
    conclusion.trim() !== reportBaseline.conclusion.trim() ||
    participantsCount.trim() !== reportBaseline.participantsCount.trim() ||
    photos.trim() !== reportBaseline.photos.trim();

  async function handleSaveReport() {
    try {
      await saveReport();
      showSaveToast({ message: ptBR.session.success.reportSaved, variant: "success" });
    } catch (error) {
      showSaveToast({ message: ptBR.session.errors.reportSaveFailed, variant: "error" });
      Alert.alert(ptBR.session.alerts.saveFailedTitle, ptBR.session.alerts.tryAgain);
    }
  }

  async function handleSaveAndGenerateReport() {
    try {
      await saveReport();
      await handleExportReportPdf();
    } catch (error) {
      showSaveToast({ message: ptBR.session.errors.reportSaveFailed, variant: "error" });
      Alert.alert(ptBR.session.alerts.saveFailedTitle, ptBR.session.alerts.tryAgain);
    }
  }

  const title = ptBR.session.title;
  const block = plan?.title ?? "";
  const warmup = (plan?.warmup ?? []).map((item) => sanitizePlanDisplayItem(item)).filter(Boolean);
  const main = (plan?.main ?? []).map((item) => sanitizePlanDisplayItem(item)).filter(Boolean);
  const cooldown = (plan?.cooldown ?? []).map((item) => sanitizePlanDisplayItem(item)).filter(Boolean);
  const defaultBlockTimes = getLessonBlockTimes(cls?.durationMinutes ?? 60);
  const warmupLabel = plan?.warmupTime
    ? `${ptBR.session.warmup} • ` + formatDuration(plan.warmupTime)
    : `${ptBR.session.warmup} • ${defaultBlockTimes.warmupMinutes} min`;
  const mainLabel = plan?.mainTime
    ? `${ptBR.session.main} • ` + formatClock(plan.mainTime)
    : `${ptBR.session.main} • ${defaultBlockTimes.mainMinutes} min`;
  const cooldownLabel = plan?.cooldownTime
    ? `${ptBR.session.cooldown} • ` + formatDuration(plan.cooldownTime)
    : `${ptBR.session.cooldown} • ${defaultBlockTimes.cooldownMinutes} min`;
  const showNoPlanNotice = !plan;
  const className = cls?.name ?? "";
  const classAgeBand = cls?.ageBand ?? "";
  const classGender = cls?.gender ?? "misto";
  const classPalette = getClassPalette(cls?.colorKey ?? null, colors, cls?.unit ?? "");
  const dateLabel = sessionDate.split("-").reverse().join("/");
  const parsedStart = cls?.startTime ? parseTime(cls.startTime) : null;
  const timeLabel =
    parsedStart && cls
    ? formatRange(parsedStart.hour, parsedStart.minute, cls.durationMinutes ?? 60)
    : "";

  const parseMinutes = (value: string, fallback: number) => {
    const match = value.match(/\d+/);
    if (!match) return fallback;
    const minutes = Number(match[0]);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
  };

  const durations = useMemo(() => {
    if (!plan) return [0, 0, 0];
    return [
      plan.warmupTime ? parseMinutes(plan.warmupTime, defaultBlockTimes.warmupMinutes) : defaultBlockTimes.warmupMinutes,
      plan.mainTime ? parseMinutes(plan.mainTime, defaultBlockTimes.mainMinutes) : defaultBlockTimes.mainMinutes,
      plan.cooldownTime ? parseMinutes(plan.cooldownTime, defaultBlockTimes.cooldownMinutes) : defaultBlockTimes.cooldownMinutes,
    ];
  }, [defaultBlockTimes.cooldownMinutes, defaultBlockTimes.mainMinutes, defaultBlockTimes.warmupMinutes, plan]);

  const totalMinutes = durations.reduce((sum, value) => sum + value, 0);
  const activeDimensions = plan?.pedagogy?.dimensions?.refined ?? plan?.pedagogy?.dimensions?.base ?? null;
  const highlightedGuideline = plan?.pedagogy?.learningObjectives?.pedagogicalGuidelines?.[0] ?? "";
  const sessionPedagogicalApproach = useMemo<PedagogicalApproachDetection | null>(() => {
    if (plan?.pedagogy?.pedagogicalApproach) {
      return plan.pedagogy.pedagogicalApproach;
    }

    const fallbackText = buildPedagogicalApproachInput([
      plan?.pedagogy?.sessionObjective,
      plan?.pedagogy?.learningObjectives?.general,
      plan?.pedagogy?.objective?.description,
      plan?.title,
    ]);

    return fallbackText ? detectSessionPedagogicalApproach([fallbackText]) : null;
  }, [
    plan?.pedagogy?.pedagogicalApproach,
    plan?.pedagogy?.sessionObjective,
    plan?.pedagogy?.learningObjectives?.general,
    plan?.pedagogy?.objective?.description,
    plan?.title,
  ]);
  const pedagogicalPanelSummary = sessionPedagogicalApproach
    ? buildSessionPedagogicalPanelSummary(sessionPedagogicalApproach)
    : "";
  const pedagogicalPanelIntent = sessionPedagogicalApproach
    ? buildSessionPedagogicalPanelIntent(sessionPedagogicalApproach)
    : "";
  const pedagogicalPanelSecondary = sessionPedagogicalApproach
    ? buildSessionPedagogicalPanelSecondary(sessionPedagogicalApproach)
    : "";
  const pedagogicalPanelRisk = sessionPedagogicalApproach
    ? buildSessionPedagogicalPanelRisk(sessionPedagogicalApproach)
    : "";
  const pedagogicalPanelSignals = sessionPedagogicalApproach
    ? buildSessionPedagogicalPanelSignals(sessionPedagogicalApproach)
    : "";
  const pedagogicalFocusSkillLabel = formatSessionPedagogicalFocusSkill(
    plan?.pedagogy?.focus?.skill ?? null
  );
  const progressionCriterionLabel = toVisibleCoachingText(
    plan?.pedagogy?.learningObjectives?.successCriteria?.[0] ?? ""
  );
  const methodologyEvidenceSourceLabel = formatSessionMethodologyEvidenceSource(
    methodologyEvidence
  );
  const methodologyEvidenceExcerptLabel = formatSessionMethodologyEvidenceExcerpt(
    methodologyEvidence
  );
  const lastOverrideLabel = formatSessionOverrideSummary(plan?.pedagogy?.override);
  const suggestedAdjustmentLabel = plan?.pedagogy?.adaptation
    ? formatAdjustmentLabel(plan.pedagogy.adaptation.adjustment)
    : "";
  const suggestedDecisionAdjustmentLabel = plan?.pedagogy?.adaptation
    ? formatAdjustmentLabel(
        plan.pedagogy.adaptation.telemetry?.decision.suggested ??
          plan.pedagogy.adaptation.adjustment
      )
    : "";
  const [dismissResistanceUnavailable, setDismissResistanceUnavailable] = useState(false);
  const teamTrainingContext = useMemo(
    () => (cls ? resolveTeamTrainingContext(cls) : null),
    [cls],
  );
  const persistedResistanceData = useMemo(
    () => getResistancePlanFromSessionComponents(currentDailyLessonPlan?.sessionComponents),
    [currentDailyLessonPlan?.sessionComponents],
  );
  const persistedWeeklyContext = useMemo(
    () => parseWeeklyIntegratedContext(currentClassPlan?.weeklyIntegratedContextJson),
    [currentClassPlan?.weeklyIntegratedContextJson],
  );
  const shouldShowResistanceGuardNotice = Boolean(
    cls &&
      teamTrainingContext?.hasGymAccess &&
      !supportsResistanceTraining(teamTrainingContext, cls),
  );
  const hasUnavailableResistanceSession = Boolean(
    !dismissResistanceUnavailable &&
      currentDailyLessonPlan?.sessionEnvironment &&
      currentDailyLessonPlan.sessionEnvironment !== "quadra" &&
      !persistedResistanceData,
  );

  useEffect(() => {
    setDismissResistanceUnavailable(false);
  }, [currentDailyLessonPlan?.id, sessionDate]);

  const resistancePreview = useMemo(() => {
    if (currentDailyLessonPlan?.sessionEnvironment) {
      if (
        currentDailyLessonPlan.sessionEnvironment !== "quadra" &&
        persistedResistanceData
      ) {
        return {
          sessionEnvironment: currentDailyLessonPlan.sessionEnvironment,
          weeklyContext: persistedWeeklyContext,
          resistancePlan: persistedResistanceData.resistancePlan,
          durationMin: persistedResistanceData.durationMin,
        };
      }

      if (currentDailyLessonPlan.sessionEnvironment !== "quadra") {
        return null;
      }
    }

    const preview = buildSessionResistancePreview({
      classGroup: cls,
      classPlan: currentClassPlan,
      sessionDate,
    });

    const resistanceData = getResistancePlanFromSessionComponents(
      preview?.sessionComponents,
    );

    if (!preview || preview.sessionEnvironment === "quadra" || !resistanceData) {
      return null;
    }

    return {
      sessionEnvironment: preview.sessionEnvironment,
      weeklyContext: preview.weeklyContext,
      resistancePlan: resistanceData.resistancePlan,
      durationMin: resistanceData.durationMin,
    };
  }, [
    cls,
    currentClassPlan,
    currentDailyLessonPlan,
    persistedResistanceData,
    persistedWeeklyContext,
    sessionDate,
  ]);

  const mixedSessionBridgeDescription = useMemo(() => {
    if (!resistancePreview || resistancePreview.sessionEnvironment !== "mista") {
      return "";
    }
    const transferTarget = String(resistancePreview.resistancePlan.transferTarget ?? "").trim();
    if (transferTarget) {
      return `Após o bloco resistido, aplicar na quadra com foco em ${transferTarget.toLowerCase()}.`;
    }
    return "Após o bloco resistido, aplicar na quadra em situações curtas e específicas do jogo.";
  }, [resistancePreview]);

  const blockTitleMap = {
    warmup: ptBR.session.warmup,
    main: ptBR.session.main,
    cooldown: ptBR.session.cooldown,
  } as const;

  const getBlockActivities = (blockKey: SessionBlockKey) => {
    if (!plan) return [];
    if (blockKey === "warmup") return plan.warmup ?? [];
    if (blockKey === "main") return plan.main ?? [];
    return plan.cooldown ?? [];
  };

  const getStructuredBlockActivities = (blockKey: SessionBlockKey) => {
    if (!plan?.pedagogy?.blocks) return [];
    if (blockKey === "warmup") return plan.pedagogy.blocks.warmup?.activities ?? [];
    if (blockKey === "main") return plan.pedagogy.blocks.main?.activities ?? [];
    return plan.pedagogy.blocks.cooldown?.activities ?? [];
  };

  const getBlockDurationMinutes = (blockKey: SessionBlockKey) => {
    if (!plan) return 0;
    if (blockKey === "warmup") return parseMinutes(plan.warmupTime ?? "", defaultBlockTimes.warmupMinutes);
    if (blockKey === "main") return parseMinutes(plan.mainTime ?? "", defaultBlockTimes.mainMinutes);
    return parseMinutes(plan.cooldownTime ?? "", defaultBlockTimes.cooldownMinutes);
  };

  const getBlockSummary = (blockKey: SessionBlockKey) => {
    if (!plan) return "";
    const pedagogySummary =
      blockKey === "warmup"
        ? plan.pedagogy?.blocks?.warmup?.summary
        : blockKey === "main"
          ? plan.pedagogy?.blocks?.main?.summary
          : plan.pedagogy?.blocks?.cooldown?.summary;
    return pedagogySummary ?? "";
  };

  const buildPdfBlockItems = (blockKey: SessionBlockKey) => {
    const blockSummary = getBlockSummary(blockKey);
    const structuredActivities = getStructuredBlockActivities(blockKey);
    const sourceItems = structuredActivities.length
      ? structuredActivities.map((activity) => ({
          name: activity.name,
          description: activity.description ?? "",
        }))
      : getBlockActivities(blockKey).map((name) => ({ name, description: "" }));

    return sourceItems
      .map((item) => {
        const activityName = sanitizePlanDisplayItem(item.name);
        if (!activityName) return null;
        const manualDescription = String(item.description ?? "").trim();
        return {
          name: normalizeDisplayText(activityName),
          description: normalizeDisplayText(
            manualDescription ||
              resolveActivityDescription({
                name: activityName,
                description: "",
                blockKey,
                blockSummary,
                pedagogicalApproach: sessionPedagogicalApproach,
                focusSkill: plan?.pedagogy?.focus?.skill,
              })
          ),
        };
      })
        .filter((item): item is { name: string; description: string } => Boolean(item));
  };

  const buildEditableBlockActivities = (blockKey: SessionBlockKey): EditableBlockItem[] => {
    const structuredActivities = getStructuredBlockActivities(blockKey);
    const sourceItems = structuredActivities.length
      ? structuredActivities.map((activity) => ({
          name: activity.name,
          description: activity.description ?? "",
        }))
      : getBlockActivities(blockKey).map((name) => ({ name, description: "" }));

    return sourceItems
      .map((item) => ({
        name: sanitizePlanDisplayItem(item.name),
        description: String(item.description ?? "").trim(),
      }))
      .filter((item) => item.name);
  };

  const selectedBlockData =
    plan && selectedBlockKey
      ? {
          key: selectedBlockKey,
          title: blockTitleMap[selectedBlockKey],
          durationMinutes: getBlockDurationMinutes(selectedBlockKey),
          activities: buildEditableBlockActivities(selectedBlockKey),
        }
      : null;

  const navigateSessionDate = (deltaDays: number) => {
    if (!cls) return;
    const classDays = normalizeClassDaysOfWeek(cls.daysOfWeek);
    const adjacentClassDate = calculateAdjacentClassDate(
      classDays,
      new Date(`${sessionDate}T00:00:00`),
      deltaDays < 0 ? -1 : 1
    );
    const targetDate = adjacentClassDate
      ? `${adjacentClassDate.getFullYear()}-${String(adjacentClassDate.getMonth() + 1).padStart(2, "0")}-${String(adjacentClassDate.getDate()).padStart(2, "0")}`
      : shiftIsoDate(sessionDate, deltaDays);
    router.replace({
      pathname: "/class/[id]/session",
      params: {
        id: cls.id,
        date: targetDate,
        tab: sessionTab,
      },
    });
  };

  const handleApplySavedPlan = async (savedPlan: TrainingPlan) => {
    if (!cls) return;
    setIsApplyingSavedPlanId(savedPlan.id);
    try {
      const nowIso = new Date().toISOString();
      const latestVersionPlan = await getLatestTrainingPlanByClass(cls.id, {
        organizationId: cls.organizationId ?? null,
      });
      const latestVersion = latestVersionPlan?.version ?? 0;
      const updatedPlan = createTrainingPlanVersion({
        classId: cls.id,
        version: Math.max(savedPlan.version ?? 0, latestVersion) + 1,
        origin: "manual",
        draft: buildTrainingPlanDraftFromPlan(savedPlan),
        applyDays: [],
        applyDate: sessionDate,
        inputHash: savedPlan.inputHash,
        nowIso,
        idPrefix: "plan_apply",
        status: "final",
        finalizedAt: nowIso,
        parentPlanId: savedPlan.parentPlanId ?? savedPlan.id,
        previousVersionId: savedPlan.id,
        pedagogy: savedPlan.pedagogy,
      });
      await saveTrainingPlan(updatedPlan);
      setPlan(updatedPlan);
      setShowSavedClassPlans(false);
      setAutoActivity(buildSimpleActivityFromPlan(updatedPlan));
      showSaveToast({
        message: "Treino aplicado para esta aula.",
        variant: "success",
      });
      logAction("Aplicar treino salvo na aula do dia", {
        classId: cls.id,
        sourcePlanId: savedPlan.id,
        appliedPlanId: updatedPlan.id,
        applyDate: sessionDate,
      });
    } catch {
      showSaveToast({
        message: "Não foi possível aplicar este treino.",
        variant: "error",
      });
    } finally {
      setIsApplyingSavedPlanId((current) =>
        current === savedPlan.id ? null : current
      );
    }
  };

  const handleRemoveAppliedPlan = () => {
    if (!cls || !plan || isRemovingAppliedPlan) return;
    confirm({
      title: "Remover plano deste dia?",
      message: `Isso remove o treino aplicado em ${dateLabel} e a aula volta para sem plano aplicado.`,
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {
        setIsRemovingAppliedPlan(true);
        try {
          await measure("deleteTrainingPlansByClassAndDate", () =>
            deleteTrainingPlansByClassAndDate(cls.id, sessionDate, {
              organizationId: cls.organizationId ?? null,
            })
          );
          const remainingClassPlans = await getTrainingPlans({
            organizationId: cls.organizationId ?? null,
            classId: cls.id,
            status: "final",
            orderBy: "createdat_desc",
            limit: 24,
          });
          setPlan(null);
          setSavedClassPlans(compactTrainingPlans(remainingClassPlans));
          setAutoActivity("");
          setShowPedagogicalPanel(false);
          setShowSavedClassPlans(false);
          setSelectedBlockKey(null);
          setLastUpdatedBlockKey(null);
          setPedagogicalPlanPackage(null);
          showSaveToast({
            message: "Plano removido desta aula.",
            variant: "success",
          });
          logAction("Remover plano da aula do dia", {
            classId: cls.id,
            planId: plan.id,
            applyDate: sessionDate,
          });
        } catch {
          showSaveToast({
            message: "Não foi possível remover o plano desta aula.",
            variant: "error",
          });
        } finally {
          setIsRemovingAppliedPlan(false);
        }
      },
    });
  };

  const handleBackToClass = () => {
    if (!cls) return;
    router.replace({
      pathname: "/class/[id]",
      params: { id: cls.id },
    });
  };

  const updateScoutingCount = (
    skillId: (typeof scoutingSkills)[number]["id"],
    score: 0 | 1 | 2,
    delta: 1 | -1
  ) => {
    setScoutingCounts((prev) => {
      const current = prev[skillId][score];
      const nextValue = Math.max(0, current + delta);
      return {
        ...prev,
        [skillId]: {
          ...prev[skillId],
          [score]: nextValue,
        },
      };
    });
  };

  const scoutingHasChanges = useMemo(() => {
    return scoutingSkills.some((skill) => {
      const current = scoutingCounts[skill.id];
      const base = scoutingBaseline[skill.id];
      return current[0] !== base[0] || current[1] !== base[1] || current[2] !== base[2];
    });
  }, [scoutingBaseline, scoutingCounts]);

  const scoutingTotals = useMemo(
    () => scoutingSkills.map((skill) => getSkillMetrics(scoutingCounts[skill.id])),
    [scoutingCounts]
  );

  const totalActions = useMemo(
    () => getTotalActions(scoutingCounts),
    [scoutingCounts]
  );

  const focusSuggestion = useMemo(
    () => getFocusSuggestion(scoutingCounts, 10),
    [scoutingCounts]
  );

  const studentsSignature = useMemo(
    () => sessionStudents.map((student) => student.id).sort().join(","),
    [sessionStudents]
  );
  const scoutingSignature = useMemo(() => JSON.stringify(scoutingCounts), [scoutingCounts]);
  const recentPlansSignature = useMemo(
    () =>
      savedClassPlans
        .slice(0, 5)
        .map((item) => [
          item.id,
          item.inputHash ?? "",
          item.pedagogy?.focus?.skill ?? "",
          item.pedagogy?.progression?.dimension ?? "",
          item.pedagogy?.sessionObjective ?? "",
        ].join("|"))
        .join("||"),
    [savedClassPlans]
  );
  const classPedagogicalSignature = useMemo(
    () =>
      cls
        ? [
            cls.id,
            cls.goal,
            cls.modality,
            cls.equipment,
            cls.durationMinutes,
            currentClassPlan?.id,
            currentClassPlan?.phase,
            currentClassPlan?.theme,
            currentClassPlan?.technicalFocus,
            currentClassPlan?.physicalFocus,
            currentClassPlan?.rpeTarget,
          ].join("|")
        : "",
    [
      cls?.id,
      cls?.goal,
      cls?.modality,
      cls?.equipment,
      cls?.durationMinutes,
      currentClassPlan?.id,
      currentClassPlan?.phase,
      currentClassPlan?.theme,
      currentClassPlan?.technicalFocus,
      currentClassPlan?.physicalFocus,
      currentClassPlan?.rpeTarget,
    ]
  );

  const buildAutoPlanResultFromSessionContext = useCallback(
    (variationSeed?: number, dimensionGuidelines?: string[]): AutoPlanForCycleDayResult | null => {
      if (!cls) return null;
      return buildAutoPlanForCycleDay({
        classGroup: cls,
        classPlan: currentClassPlan,
        students: sessionStudents,
        sessionDate,
        scoutingCounts,
        recentPlans: savedClassPlans,
        variationSeed,
        dimensionGuidelines,
      });
    },
    [cls, currentClassPlan, savedClassPlans, scoutingCounts, sessionDate, sessionStudents]
  );

  const buildPedagogicalPackageFromSessionContext = useCallback(
    (variationSeed?: number, dimensionGuidelines?: string[]) =>
      buildAutoPlanResultFromSessionContext(variationSeed, dimensionGuidelines)?.package ?? null,
    [buildAutoPlanResultFromSessionContext]
  );

  const memoizedPedagogicalPackage = useMemo(() => {
    if (!cls) return null;
    const startedAt = Date.now();
    const guidelines = computeBaseDimensionGuidelines(cls, currentClassPlan, pedagogicalConfig);
    const pkg = buildPedagogicalPackageFromSessionContext(undefined, guidelines);
    if (__DEV__) {
      logAction("buildPedagogicalPlan memo", {
        classId: cls.id,
        students: sessionStudents.length,
        guidelines: guidelines.length,
        ms: Date.now() - startedAt,
      });
    }
    return pkg;
  }, [
    buildPedagogicalPackageFromSessionContext,
    classPedagogicalSignature,
    pedagogicalConfig,
    recentPlansSignature,
    scoutingSignature,
    studentsSignature,
  ]);

  const buildFreshAutoPlanResult = async (
    variationSeed?: number,
    planningBasis: TrainingPlanPlanningBasis = "cycle_based"
  ) => {
    if (!cls) return null;
    return measure(
      "buildPedagogicalPlan",
      async () => {
        const guidelines = computeBaseDimensionGuidelines(
          cls,
          currentClassPlan,
          pedagogicalConfig
        );
        const autoPlanResult = buildAutoPlanResultFromSessionContext(variationSeed, guidelines);
        if (!autoPlanResult) return null;
        logPlanGenerationDecision({
          classId: cls.id,
          sessionDate,
          variationSeed,
          explanation: autoPlanResult.explanation,
          planningBasis,
          generationMode: toGenerationMode(planningBasis),
          ageBand: autoPlanResult.ageSanitizer.ageBand,
          developmentStage: autoPlanResult.ageSanitizer.developmentStage,
          warmupSummary: autoPlanResult.ageSanitizer.warmupSummary,
          warmupSource: autoPlanResult.ageSanitizer.warmupSource,
          usedAgeSanitizer: autoPlanResult.ageSanitizer.usedAgeSanitizer,
          ageSanitizerReasons: autoPlanResult.ageSanitizer.ageSanitizerReasons,
          pedagogyTone: autoPlanResult.pedagogyEnvelope.tone,
          pedagogyLanguageProfile: autoPlanResult.pedagogyEnvelope.languageProfile,
          pedagogyFeedbackStyle: autoPlanResult.pedagogyEnvelope.feedbackStyle,
          pedagogyMainStyle: autoPlanResult.pedagogyEnvelope.mainStyle,
          pedagogyCooldownStyle: autoPlanResult.pedagogyEnvelope.cooldownStyle,
        });
        return autoPlanResult;
      },
      {
        classId: cls.id,
        sessionDate,
        variationSeed: variationSeed ?? null,
        hasExistingPlan: Boolean(plan),
        recentPlans: savedClassPlans.length,
        students: sessionStudents.length,
      }
    );
  };

  const buildFreshPedagogicalPackage = async (
    variationSeed?: number,
    planningBasis: TrainingPlanPlanningBasis = "cycle_based"
  ) => {
    const autoPlanResult = await buildFreshAutoPlanResult(variationSeed, planningBasis);
    return autoPlanResult?.package ?? null;
  };

  const persistPedagogicalPlanPackage = async (
    packageToSave: PedagogicalPlanPackage,
    editedDraft?: LessonPlanDraft,
    options?: {
      successMessage?: string;
      generationExplanation?: TrainingPlanPedagogy["generationExplanation"];
      targetPrimarySkill?: VolleyballSkill;
      targetSecondarySkill?: VolleyballSkill;
    }
  ) => {
    if (!cls) return;
    const latestVersionPlan = await getLatestTrainingPlanByClass(cls.id, {
      organizationId: cls.organizationId ?? null,
    });
    const latestVersion = latestVersionPlan?.version ?? 0;
    const latestPlan = plan;
    const methodology = await resolveActiveMethodology({
      organizationId: cls.organizationId ?? null,
      classId: cls.id,
      preferredDomains: ["youth_training", "general"],
      context: packageToSave.input.context ?? "treinamento",
    });
    const inferredFocusSkill = pickFocusSkill(packageToSave);
    const resolvedPrimarySkill =
      options?.targetPrimarySkill ?? getScoutingPrioritySkill(scoutingCounts) ?? inferredFocusSkill;
    const resolvedSecondarySkill = options?.targetSecondarySkill;

    if (__DEV__) {
      logAction("plan coherence anchor", {
        classId: cls.id,
        sessionDate,
        inferredFocusSkill,
        resolvedPrimarySkill,
        resolvedSecondarySkill: resolvedSecondarySkill ?? null,
      });
    }

    const explicitObjectives = buildPedagogicalObjectives(packageToSave, {
      scoutingPrioritySkill: resolvedPrimarySkill,
    });
    const sessionObjectiveLabel = explicitObjectives.general;
    const progressionDimension = pickProgressionDimension(packageToSave);
    const nonMainFocusSkill = resolvedSecondarySkill ?? resolvedPrimarySkill;

    const [warmupActivities, mainActivities, cooldownActivities] = await Promise.all([
      toStructuredActivitiesWithAiFallback(
        packageToSave.final.warmup,
        sessionObjectiveLabel,
        progressionDimension,
        "warmup",
        packageToSave.final.warmup.summary,
        explicitObjectives.pedagogicalApproach,
        nonMainFocusSkill,
        {
          organizationId: cls.organizationId ?? null,
          periodLabel: sessionDate,
          scope: `class:${cls.id}:warmup`,
        }
      ),
      toStructuredActivitiesWithAiFallback(
        packageToSave.final.main,
        sessionObjectiveLabel,
        progressionDimension,
        "main",
        packageToSave.final.main.summary,
        explicitObjectives.pedagogicalApproach,
        resolvedPrimarySkill,
        {
          organizationId: cls.organizationId ?? null,
          periodLabel: sessionDate,
          scope: `class:${cls.id}:main`,
        }
      ),
      toStructuredActivitiesWithAiFallback(
        packageToSave.final.cooldown,
        sessionObjectiveLabel,
        progressionDimension,
        "cooldown",
        packageToSave.final.cooldown.summary,
        explicitObjectives.pedagogicalApproach,
        nonMainFocusSkill,
        {
          organizationId: cls.organizationId ?? null,
          periodLabel: sessionDate,
          scope: `class:${cls.id}:cooldown`,
        }
      ),
    ]);

    const structuredBlocks: NonNullable<TrainingPlanPedagogy["blocks"]> = {
      warmup: {
        summary: packageToSave.final.warmup.summary,
        activities: warmupActivities,
      },
      main: {
        summary: packageToSave.final.main.summary,
        activities: mainActivities,
      },
      cooldown: {
        summary: packageToSave.final.cooldown.summary,
        activities: cooldownActivities,
      },
    };

    const historicalPlans = await getTrainingPlans({
      organizationId: cls.organizationId ?? null,
      classId: cls.id,
      status: "final",
      orderBy: "createdat_desc",
      limit: 12,
    });
    const skillHistoryBySkill = buildSkillHistoryBySkill(historicalPlans);

    const nextPlan = buildSessionTrainingPlan(
      packageToSave,
      cls.id,
      sessionDate,
      latestPlan,
      latestVersion + 1,
      buildAutoPlanPedagogy(
        packageToSave,
        methodology,
        currentClassPlan,
        structuredBlocks,
        pedagogicalConfig,
        {
          sessionId: `${cls.id}:${sessionDate}`,
          scoutingPrioritySkill: resolvedPrimarySkill,
          scoutingCounts,
          skillHistoryBySkill,
          generationExplanation: options?.generationExplanation,
        }
      )
    );
    const versionedPlan: TrainingPlan = nextPlan;
    if (
      latestPlan?.inputHash &&
      versionedPlan.inputHash &&
      latestPlan.inputHash === versionedPlan.inputHash
    ) {
      showSaveToast({
        message:
          "Sugestao do sistema mantida: os dados desta sessao indicam o mesmo plano como opcao principal.",
        variant: "warning",
      });
      return;
    }
    await saveTrainingPlan(versionedPlan);
    setPlan(versionedPlan);
    if (editedDraft) {
      setPedagogicalPlanPackage(packageToSave);
    }
    showSaveToast({
      message:
        options?.successMessage ??
        (latestPlan ? ptBR.session.success.planVersionCreated : ptBR.session.success.planCreated),
      variant: "success",
    });
  };

  const generatePedagogicalPlanAndSave = async (
    variationSeed?: number,
    planningBasis: TrainingPlanPlanningBasis = "cycle_based"
  ) => {
    if (!cls) return;
    setShowPlanFabMenu(false);
    setPlanGenerationPhase("generating");
    try {
      await waitForInteractionIdle();
      const autoPlanResult = await buildFreshAutoPlanResult(variationSeed, planningBasis);
      if (!autoPlanResult) return;
      setPedagogicalPlanPackage(autoPlanResult.package);
      setPlanGenerationPhase("saving");
      const successMessage =
        plan && variationSeed
          ? "Nova variação aplicada."
          : undefined;
      await persistPedagogicalPlanPackage(autoPlanResult.package, undefined, {
        successMessage,
        generationExplanation: toPersistedGenerationExplanation(
          autoPlanResult.explanation,
          planningBasis
        ),
        targetPrimarySkill: autoPlanResult.strategy.primarySkill,
        targetSecondarySkill: autoPlanResult.strategy.secondarySkill,
      });
      setPlanGenerationPhase("settling");
      await waitForInteractionIdle();
      await waitForNextPaint();
    } catch {
      logAction("buildPedagogicalPlan failed", {
        classId: cls.id,
        sessionDate,
        variationSeed: variationSeed ?? null,
      });
      showSaveToast({ message: ptBR.session.errors.planGenerateFailed, variant: "error" });
    } finally {
      setPlanGenerationPhase("idle");
    }
  };

  const handleGeneratePedagogicalPlan = () => {
    if (!isResolvingCurrentClassPlan && !hasUsableCurrentClassPlan) {
      setShowMissingPeriodizationModal(true);
      return;
    }
    void generatePedagogicalPlanAndSave(undefined, "cycle_based");
  };

  useEffect(() => {
    if (!shouldAutoGenerateFromPeriodization) return;
    if (!cls || isLoadingSession || isResolvingCurrentClassPlan) return;
    if (!hasUsableCurrentClassPlan) return;
    if (plan || isPlanGenerationBusy) return;

    const generationKey = `${cls.id}:${sessionDate}`;
    if (periodizationAutoGenerateKeyRef.current === generationKey) return;
    periodizationAutoGenerateKeyRef.current = generationKey;

    void generatePedagogicalPlanAndSave(undefined, "cycle_based");
  }, [
    cls,
    generatePedagogicalPlanAndSave,
    hasUsableCurrentClassPlan,
    isLoadingSession,
    isPlanGenerationBusy,
    isResolvingCurrentClassPlan,
    plan,
    sessionDate,
    shouldAutoGenerateFromPeriodization,
  ]);

  const handleEditPedagogicalPlan = async () => {
    if (!cls) return;
    const pkg =
      pedagogicalPlanPackage ?? (await buildFreshPedagogicalPackage(undefined, "cycle_based"));
    if (!pkg) return;
    setPedagogicalPlanPackage(pkg);
    router.push({
      pathname: "/prof/planning",
      params: {
        targetClassId: cls.id,
        targetDate: sessionDate,
        openForm: "1",
        aiDraft: buildPedagogicalAiDraft(pkg),
      },
    });
  };

  const handleSaveBlockEdit = async (payload: BlockEditPayload) => {
    if (!plan || !cls || !selectedBlockKey) return false;
    setIsSavingBlockEdit(true);
    try {
      const safeDuration =
        Number.isFinite(payload.durationMinutes) && payload.durationMinutes > 0
          ? payload.durationMinutes
          : getBlockDurationMinutes(selectedBlockKey);
      const activities = (payload.activities ?? [])
        .map((item) => ({
          name: sanitizePlanDisplayItem(item?.name),
          description: String(item?.description ?? "").trim(),
        }))
        .filter((item) => item.name);

      const resolveLegacySummaryFromActivities = (
        items: EditableBlockItem[],
        fallback: string
      ) => {
        const fromDescription = items
          .map((item) => String(item.description ?? "").trim())
          .find(Boolean);
        const fromName = items
          .map((item) => String(item.name ?? "").trim())
          .find(Boolean);
        return fromDescription || fromName || fallback;
      };

      const buildSavedActivities = (
        blockKey: SessionBlockKey,
        items: EditableBlockItem[],
        blockSummary: string
      ) =>
        items.map((item) => ({
          name: item.name,
          description:
            String(item.description ?? "").trim() ||
            resolveActivityDescription({
              name: item.name,
              description: "",
              blockKey,
              blockSummary,
              pedagogicalApproach: plan.pedagogy?.pedagogicalApproach,
              focusSkill: plan.pedagogy?.focus?.skill,
            }),
        }));

      const currentWarmupSummary =
        selectedBlockKey === "warmup"
          ? resolveLegacySummaryFromActivities(activities, getBlockSummary("warmup"))
          : getBlockSummary("warmup");
      const currentMainSummary =
        selectedBlockKey === "main"
          ? resolveLegacySummaryFromActivities(activities, getBlockSummary("main"))
          : getBlockSummary("main");
      const currentCooldownSummary =
        selectedBlockKey === "cooldown"
          ? resolveLegacySummaryFromActivities(activities, getBlockSummary("cooldown"))
          : getBlockSummary("cooldown");

      const currentWarmupActivities =
        selectedBlockKey === "warmup" ? activities : buildEditableBlockActivities("warmup");
      const currentMainActivities =
        selectedBlockKey === "main" ? activities : buildEditableBlockActivities("main");
      const currentCooldownActivities =
        selectedBlockKey === "cooldown" ? activities : buildEditableBlockActivities("cooldown");

      const nextPedagogyBlocks = {
        warmup: {
          summary: currentWarmupSummary,
          activities: buildSavedActivities("warmup", currentWarmupActivities, currentWarmupSummary),
        },
        main: {
          summary: currentMainSummary,
          activities: buildSavedActivities("main", currentMainActivities, currentMainSummary),
        },
        cooldown: {
          summary: currentCooldownSummary,
          activities: buildSavedActivities(
            "cooldown",
            currentCooldownActivities,
            currentCooldownSummary
          ),
        },
      };

      const activityNames = activities.map((item) => item.name);

      const nextPlan: TrainingPlan = {
        ...plan,
        warmup: selectedBlockKey === "warmup" ? activityNames : plan.warmup,
        main: selectedBlockKey === "main" ? activityNames : plan.main,
        cooldown: selectedBlockKey === "cooldown" ? activityNames : plan.cooldown,
        warmupTime:
          selectedBlockKey === "warmup"
            ? `${safeDuration} min`
            : plan.warmupTime,
        mainTime:
          selectedBlockKey === "main"
            ? `${safeDuration} min`
            : plan.mainTime,
        cooldownTime:
          selectedBlockKey === "cooldown"
            ? `${safeDuration} min`
            : plan.cooldownTime,
        pedagogy: {
          ...(plan.pedagogy ?? {}),
          blocks: nextPedagogyBlocks,
        },
      };

      const latestVersionPlan = await getLatestTrainingPlanByClass(cls.id, {
        organizationId: cls.organizationId ?? null,
      });
      const latestVersion = latestVersionPlan?.version ?? 0;
      const nowIso = new Date().toISOString();
      const versionedPlan = createTrainingPlanVersion({
        classId: nextPlan.classId,
        version: Math.max(nextPlan.version ?? 0, latestVersion) + 1,
        origin: "manual",
        draft: buildTrainingPlanDraftFromPlan(nextPlan),
        applyDays: nextPlan.applyDays ?? [],
        applyDate: nextPlan.applyDate ?? sessionDate,
        inputHash: nextPlan.inputHash,
        nowIso,
        idPrefix: "plan_manual",
        status: "final",
        generatedAt: nextPlan.generatedAt,
        finalizedAt: nowIso,
        parentPlanId: nextPlan.parentPlanId ?? nextPlan.id,
        previousVersionId: nextPlan.id,
        pedagogy: nextPlan.pedagogy,
      });

      await saveTrainingPlan(versionedPlan);
      setPlan(versionedPlan);
      setLastUpdatedBlockKey(selectedBlockKey);
      setTimeout(() => {
        setLastUpdatedBlockKey((current) =>
          current === selectedBlockKey ? null : current
        );
      }, 2500);
      showSaveToast({
        message: ptBR.session.success.blockUpdated,
        variant: "success",
      });
      return true;
    } catch {
      showSaveToast({
        message: ptBR.session.errors.blockSaveFailed,
        variant: "error",
      });
      return false;
    } finally {
      setIsSavingBlockEdit(false);
    }
  };

  const openDecisionOverrideModal = () => {
    const adaptation = plan?.pedagogy?.adaptation;
    if (!adaptation) return;
    const suggested = adaptation.telemetry?.decision.suggested ?? adaptation.adjustment;
    const applied = adaptation.telemetry?.decision.applied ?? suggested;
    setDecisionAppliedAdjustment(applied);
    setDecisionReasonType(adaptation.telemetry?.reason?.type ?? null);
    setDecisionReasonNote(adaptation.telemetry?.reason?.note ?? "");
    setShowDecisionOverrideModal(true);
  };

  const handleApplyDecisionOverride = async () => {
    if (!plan || !cls || !plan.pedagogy?.adaptation) return;

    const adaptation = plan.pedagogy.adaptation;
    const telemetry = adaptation.telemetry;
    const suggested = telemetry?.decision.suggested ?? adaptation.adjustment;
    const applied = decisionAppliedAdjustment;
    const wasFollowed = suggested === applied;
    const reasonType = wasFollowed ? undefined : decisionReasonType ?? undefined;
    const reasonNote = wasFollowed ? undefined : decisionReasonNote.trim() || undefined;

    setIsApplyingDecisionOverride(true);
    try {
      const latestVersionPlan = await getLatestTrainingPlanByClass(cls.id, {
        organizationId: cls.organizationId ?? null,
      });
      const latestVersion = latestVersionPlan?.version ?? 0;
      const nowIso = new Date().toISOString();
      const sessionId = `${cls.id}:${sessionDate}`;

      const updatedPedagogy: TrainingPlanPedagogy = {
        ...(plan.pedagogy ?? {}),
        adaptation: {
          ...adaptation,
          adjustment: applied,
          telemetry: {
            decisionId:
              telemetry?.decisionId ??
              `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            decision: {
              suggested,
              applied,
              wasFollowed,
            },
            context: telemetry?.context ?? {
              gapLevel: adaptation.gap?.level ?? "moderado",
              trend: plan.pedagogy?.skillLearningState?.trend ?? "estagnado",
              sampleConfidence: adaptation.sampleConfidence ?? "medio",
              consistencyScore: adaptation.consistencyScore ?? 0,
              learningVelocity: adaptation.learningVelocity ?? 0,
            },
            reason:
              reasonType || reasonNote
                ? {
                    type: reasonType,
                    note: reasonNote,
                  }
                : undefined,
            meta: {
              sessionId,
              classId: cls.id,
            },
            timestamp: nowIso,
          },
        },
      };

      const nextPlan = createTrainingPlanVersion({
        classId: plan.classId,
        version: Math.max(plan.version ?? 0, latestVersion) + 1,
        origin: "edited_auto",
        draft: buildTrainingPlanDraftFromPlan(plan),
        applyDays: plan.applyDays ?? [],
        applyDate: plan.applyDate ?? "",
        inputHash: plan.inputHash,
        nowIso,
        idPrefix: "plan_override",
        status: "final",
        generatedAt: plan.generatedAt,
        finalizedAt: nowIso,
        parentPlanId: plan.parentPlanId ?? plan.id,
        previousVersionId: plan.id,
        pedagogy: updatedPedagogy,
      });

      await saveTrainingPlan(nextPlan);
      setPlan(nextPlan);
      setShowDecisionOverrideModal(false);
      showSaveToast({
        message: wasFollowed
          ? ptBR.session.success.decisionSaved
          : ptBR.session.success.decisionAdjusted,
        variant: "success",
      });
      logAction("pedagogical decision override applied", {
        classId: cls.id,
        sessionId,
        suggested,
        applied,
        wasFollowed,
        reasonType,
      });
    } catch {
      showSaveToast({
        message: ptBR.session.errors.decisionSaveFailed,
        variant: "error",
      });
    } finally {
      setIsApplyingDecisionOverride(false);
    }
  };

  const monthLabel = (value: string) => {
    const [year, month] = value.split("-");
    const names = [
      "Janeiro",
      "Fevereiro",
      "Marco",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const index = Math.max(0, Math.min(11, Number(month) - 1));
    return `${names[index]}/${year}`;
  };

  const handleExportPdf = async () => {
    if (!plan || !cls) return;
    const dateLabel = sessionDate.split("-").reverse().join("/");
    const dateObj = new Date(sessionDate + "T00:00:00");
    const weekdayLabel = dateObj.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const safePlanTitle = normalizeDisplayText(plan.title);
    const safeClassName = normalizeDisplayText(cls.name);
    const safeAgeGroup = normalizeDisplayText(cls.ageBand);
    const safeUnitLabel = normalizeDisplayText(cls.unit);
    const genderLabel =
      cls.gender === "masculino"
        ? "Masculino"
        : cls.gender === "feminino"
          ? "Feminino"
          : "Misto";
    const pdfData = {
      className: safeClassName,
      ageGroup: safeAgeGroup,
      unitLabel: safeUnitLabel,
      genderLabel,
      dateLabel: weekdayLabel,
      title: safePlanTitle,
      totalTime: `${totalMinutes} min`,
      blocks: [
        {
          title: ptBR.session.warmup,
          time: plan.warmupTime ? formatDuration(plan.warmupTime) : `${durations[0]} min`,
          items: buildPdfBlockItems("warmup"),
        },
        {
          title: ptBR.session.main,
          time: plan.mainTime ? formatClock(plan.mainTime) : `${durations[1]} min`,
          items: buildPdfBlockItems("main"),
        },
        {
          title: ptBR.session.cooldown,
          time: plan.cooldownTime ? formatDuration(plan.cooldownTime) : `${durations[2]} min`,
          items: buildPdfBlockItems("cooldown"),
        },
      ],
    };
    const html = sessionPlanHtml(pdfData);
    const webDocument =
      Platform.OS === "web" ? <SessionPlanDocument data={pdfData} /> : undefined;

    try {
      const safeClass = safeFileName(cls.name);
      const safeDate = safeFileName(sessionDate);
      const fileName = `plano-aula-${safeClass}-${safeDate}.pdf`;
      await measure("exportSessionPdf", () =>
        exportPdf({
          html,
          fileName,
          webDocument,
        })
      );
      logAction("Exportar PDF", { classId: cls.id, date: sessionDate });
      showSaveToast({ message: ptBR.session.success.pdfGenerated, variant: "success" });
    } catch (error) {
      showSaveToast({ message: ptBR.session.errors.pdfGenerateFailed, variant: "error" });
      Alert.alert(ptBR.session.alerts.exportPdfFailedTitle, ptBR.session.alerts.tryAgain);
    }
  };

  const handleExportReportPdf = async () => {
    if (!cls) return;
    const dateLabel = sessionDate.split("-").reverse().join("/");
    const reportMonth = monthLabel(sessionDate);
    const attendanceFromLog =
      typeof sessionLog?.attendance === "number" ? sessionLog.attendance : 0;
    const estimatedParticipants =
      studentsCount > 0
        ? Math.round((attendanceFromLog / 100) * studentsCount)
        : 0;
    const participantsRaw = participantsCount.trim();
    const participantsValue = participantsRaw ? Number(participantsRaw) : Number.NaN;
    const participantsForPdf =
      Number.isFinite(participantsValue) && participantsValue >= 0
        ? participantsValue
        : sessionLog?.participantsCount && sessionLog.participantsCount > 0
        ? sessionLog.participantsCount
        : estimatedParticipants || undefined;
    const photosForPdf = await serializePhotosForPdf(photos);
    const activityValue = normalizeDisplayText(
      activity.trim() || autoActivity.trim() || (sessionLog?.activity ?? "")
    );
    const conclusionValue = normalizeDisplayText(
      conclusion.trim() || (sessionLog?.conclusion ?? "")
    );
    const reportData = {
      monthLabel: reportMonth,
      dateLabel,
      className: normalizeDisplayText(cls.name),
      unitLabel: normalizeDisplayText(cls.unit),
      activity: activityValue,
      conclusion: conclusionValue,
      participantsCount: participantsForPdf ?? 0,
      photos: photosForPdf,
      deadlineLabel: "último dia da escolinha do mês",
    };
    const html = sessionReportHtml(reportData);
    const webDocument =
      Platform.OS === "web" ? <SessionReportDocument data={reportData} /> : undefined;
    try {
      const safeClass = safeFileName(cls.name);
      const safeDate = safeFileName(sessionDate);
      const fileName = `relatório-${safeClass}-${safeDate}.pdf`;
      await measure("exportSessionReportPdf", () =>
        exportPdf({
          html,
          fileName,
          webDocument,
        })
      );
      logAction("Exportar relatório PDF", { classId: cls.id, date: sessionDate });
      showSaveToast({ message: ptBR.session.success.reportGenerated, variant: "success" });
    } catch (error) {
      showSaveToast({ message: ptBR.session.errors.reportGenerateFailed, variant: "error" });
      Alert.alert(ptBR.session.alerts.exportPdfFailedTitle, ptBR.session.alerts.tryAgain);
    }
  };

  const handleSaveScouting = async () => {
    if (!cls) return;
    setScoutingSaving(true);
    try {
      const now = new Date().toISOString();
      const base: Omit<ScoutingLog, "serve0" | "serve1" | "serve2" | "receive0" | "receive1" | "receive2" | "set0" | "set1" | "set2" | "attackSend0" | "attackSend1" | "attackSend2"> =
        scoutingLog ?? {
          id: "scout_" + Date.now(),
          classId: cls.id,
          unit: cls.unit,
          mode: scoutingMode,
          date: sessionDate,
          createdAt: now,
        };
      const payload = {
        ...buildLogFromCounts(base, scoutingCounts),
        mode: scoutingMode,
      } as Parameters<typeof saveScoutingLog>[0];
      const saved = await saveScoutingLog(payload);
      setScoutingLog(saved);
      setScoutingBaseline(countsFromLog(saved));
      showSaveToast({ message: ptBR.session.success.scoutingSaved, variant: "success" });
    } catch (error) {
      showSaveToast({ message: ptBR.session.errors.scoutingSaveFailed, variant: "error" });
      Alert.alert(ptBR.session.alerts.saveFailedTitle, ptBR.session.alerts.tryAgain);
    } finally {
      setScoutingSaving(false);
    }
  };

  useEffect(() => {
    if (!tab) return;
    if (tab === "treino" || tab === "relatório" || tab === "scouting") {
      setSessionTab(tab);
    }
  }, [tab]);

  useEffect(() => {
    (Object.keys(sessionTabAnim) as SessionTabId[]).forEach((tabKey) => {
      Animated.timing(sessionTabAnim[tabKey], {
        toValue: sessionTab === tabKey ? 1 : 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [sessionTab, sessionTabAnim]);

  if (isLoadingSession) {
    return <ScreenLoadingState />;
  }

  if (isLoadingSessionExtras) {
    return <ScreenLoadingState />;
  }

  if (!cls) {
    return <ScreenLoadingState />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackdrop />
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
        >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={handleBackToClass}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>
            {title}
          </Text>
          </View>
          {showNoPlanNotice ? (
            <Text style={{ color: colors.warningText, fontSize: 12 }}>
              {ptBR.session.noPlanNotice}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end", gap: 6, minWidth: 120 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: classPalette.bg }} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Turma {classAgeBand || "-"}
            </Text>
            <ClassGenderBadge gender={classGender} size="md" />
          </View>
          <LocationBadge
            location={cls?.unit || "Unidade"}
            palette={classPalette}
            size="sm"
            showIcon
          />
        </View>
      </View>

      <View
        style={{
          padding: 16,
          borderRadius: 20,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 12,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Pressable
            onPress={() => navigateSessionDate(-1)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
              {dateLabel}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
              {timeLabel || "Horário não definido"}
            </Text>
          </View>

          <Pressable
            onPress={() => navigateSessionDate(1)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 6,
          backgroundColor: colors.secondaryBg,
          padding: 6,
          borderRadius: 999,
          marginBottom: 12,
        }}
      >
        {sessionTabs.map((tab) => {
          const tabProgress = sessionTabAnim[tab.id];
          const tabScale = tabProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.95, 1],
          });
          const tabOpacity = tabProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.68, 1],
          });
          const tabBackground = tabProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.card, colors.primaryBg],
          });
          const tabTextColor = tabProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.text, colors.primaryText],
          });
          return (
            <Animated.View
              key={tab.id}
              style={{
                flex: 1,
                borderRadius: 999,
                opacity: tabOpacity,
                transform: [{ scale: tabScale }],
                backgroundColor: tabBackground,
              }}
            >
            <Pressable
              onPress={() => {
                closePickers();
                setSessionTab(tab.id);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 999,
                alignItems: "center",
              }}
            >
              <Animated.Text
                numberOfLines={1}
                style={{
                  color: tabTextColor,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {tab.label}
              </Animated.Text>
            </Pressable>
            </Animated.View>
          );
        })}
      </View>

      </View>

      <ScrollView
        contentContainerStyle={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          paddingBottom: Math.max(136, insets.bottom + 112),
          gap: 12,
        }}
        onScrollBeginDrag={() => {
          closePickers();
          setShowPlanFabMenu(false);
        }}
        scrollEnabled={!showPsePicker && !showTechniquePicker}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {sessionTab === "treino" && plan ? (
          <View
            style={{
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
              {ptBR.session.objective}
            </Text>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              {plan.pedagogy?.sessionObjective || block || "Conduzir treino do dia"}
            </Text>
            {highlightedGuideline ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {highlightedGuideline}
              </Text>
            ) : null}
          </View>
        ) : null}
        {sessionTab === "treino" && isPlanGenerationBusy && plan ? (
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                {planGenerationLabel}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {[planGenerationDotOne, planGenerationDotTwo, planGenerationDotThree].map(
                  (dotOpacity, index) => (
                    <Animated.View
                      key={`plan-generation-dot-${index}`}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.primaryBg,
                        opacity: dotOpacity,
                      }}
                    />
                  )
                )}
              </View>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {planGenerationSubtitle}
            </Text>
          </View>
        ) : null}
        {sessionTab === "treino" && isPlanGenerationBusy && !plan ? (
          <>
            <View
              style={{
                padding: 14,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                  {planGenerationLabel}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {[planGenerationDotOne, planGenerationDotTwo, planGenerationDotThree].map(
                    (dotOpacity, index) => (
                      <Animated.View
                        key={`plan-generation-empty-dot-${index}`}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.primaryBg,
                          opacity: dotOpacity,
                        }}
                      />
                    )
                  )}
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {planGenerationSubtitle}
              </Text>
            </View>

            {([
              { key: "warmup", label: "Aquecimento", accent: colors.warningText, width: "52%" },
              { key: "main", label: "Parte principal", accent: colors.primaryBg, width: "68%" },
              { key: "cooldown", label: "Volta a calma", accent: colors.successText, width: "46%" },
            ] as const).map((section, index) => (
              <Animated.View
                key={section.key}
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: section.accent,
                  gap: 10,
                  opacity: planGenerationPulse,
                  transform: [
                    {
                      translateY: planGenerationAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, index % 2 === 0 ? -2 : 2, 0],
                      }),
                    },
                  ],
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    {section.label}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View
                      style={{
                        width: 54,
                        height: 24,
                        borderRadius: 999,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                    <View
                      style={{
                        width: 68,
                        height: 24,
                        borderRadius: 999,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                  </View>
                </View>
                <View
                  style={{
                    width: section.width,
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                />
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      width: "82%",
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  />
                  <View
                    style={{
                      width: "61%",
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  />
                </View>
              </Animated.View>
            ))}
          </>
        ) : null}
        {sessionTab === "treino" && plan?.pedagogy ? (
          <Pressable
            onPress={() => setShowPedagogicalPanel((prev) => !prev)}
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
              {showPedagogicalPanel ? ptBR.session.hideSuggestionLogic : ptBR.session.viewSuggestionLogic}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={colors.muted}
              style={{ transform: [{ rotate: showPedagogicalPanel ? "180deg" : "0deg" }] }}
            />
          </Pressable>
        ) : null}
        {sessionTab === "treino" && plan?.pedagogy && pedagogicalPanelCollapse.isVisible ? (
          <Animated.View
            style={{
              ...pedagogicalPanelCollapse.animatedStyle,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 8,
            }}
          >
            {plan.pedagogy?.methodology ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {ptBR.session.suggestionLogic.methodology}: {formatMethodologyApproach(plan.pedagogy.methodology.approach)}
              </Text>
            ) : null}
            {plan.pedagogy?.methodology?.reasoning ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {ptBR.session.suggestionLogic.rationale}: {buildHumanMethodologyExplanation(plan.pedagogy.methodology.reasoning)}
              </Text>
            ) : null}
            {methodologyEvidenceSourceLabel ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Base consultada: {methodologyEvidenceSourceLabel}
              </Text>
            ) : null}
            {methodologyEvidenceExcerptLabel ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Trecho usado: {methodologyEvidenceExcerptLabel}
              </Text>
            ) : null}
            {sessionPedagogicalApproach ? (
              <>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Leitura pedagógica: {pedagogicalPanelSummary}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Condução sugerida: {pedagogicalPanelIntent}
                </Text>
                {pedagogicalPanelSecondary ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Traços secundários: {pedagogicalPanelSecondary}
                  </Text>
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Ponto de atenção: {pedagogicalPanelRisk || formatPedagogicalRiskLabel(sessionPedagogicalApproach.traditionalConductionRisk)}
                </Text>
                {pedagogicalPanelSignals ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Sinais lidos: {pedagogicalPanelSignals}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {ptBR.session.suggestionLogic.sessionFocus}: {pedagogicalFocusSkillLabel || ptBR.session.suggestionLogic.noData}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {ptBR.session.suggestionLogic.progressionCriterion}: {progressionCriterionLabel || ptBR.session.suggestionLogic.noData}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {ptBR.session.suggestionLogic.adherenceScore}: {typeof plan.pedagogy?.methodology?.reasoning?.score === "number"
                ? formatMethodologyScore(plan.pedagogy.methodology.reasoning.score)
                : ptBR.session.suggestionLogic.noData}
            </Text>
            {plan.pedagogy?.override?.type ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {ptBR.session.suggestionLogic.lastOverride}: {lastOverrideLabel || ptBR.session.suggestionLogic.noData}
              </Text>
            ) : null}
            {plan.pedagogy?.adaptation ? (
              <>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Sugestão do sistema: {suggestedAdjustmentLabel}
                </Text>
                <Pressable
                  onPress={openDecisionOverrideModal}
                  style={{
                    alignSelf: "flex-start",
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                    {ptBR.session.applyManualAdjustment}
                  </Text>
                </Pressable>
              </>
            ) : null}
            {activeDimensions ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Variabilidade: {activeDimensions.variability}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Decisão: {activeDimensions.decisionMaking}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Feedback: {activeDimensions.feedbackFrequency}</Text>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
        {sessionTab === "treino" && plan ? (
          <>
            {!resistancePreview && shouldShowResistanceGuardNotice ? (
              <SessionResistanceNotice
                colors={colors}
                tone="warning"
                title="Academia não priorizada nesta sessão"
                description="Apesar do acesso à academia, o foco permanece em quadra porque este momento da turma pede controle corporal, coordenação e aprendizagem do jogo."
              />
            ) : null}
            {hasUnavailableResistanceSession ? (
              <SessionResistanceNotice
                colors={colors}
                tone="warning"
                title="Sessão resistida indisponível"
                description="O contexto da semana indica academia, mas os exercícios ainda não foram gerados. Você pode regenerar a sessão ou seguir com treino de quadra."
                actions={[
                  {
                    label:
                      isSavingPedagogicalPlan || isGeneratingPedagogicalPlan
                        ? "Gerando plano..."
                        : "Regenerar sessão",
                    onPress: handleGeneratePedagogicalPlan,
                    variant: "primary",
                  },
                  {
                    label: "Usar treino de quadra",
                    onPress: () => setDismissResistanceUnavailable(true),
                  },
                ]}
              />
            ) : null}
            {resistancePreview ? (
              <>
                <SessionContextHeader
                  colors={colors}
                  environment={resistancePreview.sessionEnvironment}
                  weeklyPhysicalEmphasis={resistancePreview.weeklyContext?.weeklyPhysicalEmphasis}
                  courtGymRelationship={resistancePreview.weeklyContext?.courtGymRelationship}
                  transferTarget={resistancePreview.resistancePlan.transferTarget}
                  durationMin={resistancePreview.durationMin}
                />
                <SessionResistanceBlock
                  colors={colors}
                  resistancePlan={resistancePreview.resistancePlan}
                  durationMin={resistancePreview.durationMin}
                />
                {resistancePreview.sessionEnvironment === "mista" ? (
                  <SessionResistanceNotice
                    colors={colors}
                    title="Ponte para a quadra"
                    description={mixedSessionBridgeDescription}
                  />
                ) : null}
              </>
            ) : null}
            {([
              { key: "warmup", label: warmupLabel },
              { key: "main", label: mainLabel },
              { key: "cooldown", label: cooldownLabel },
            ] as const).map((section) => {
              const previewItems = dedupeByNormalizedText(getBlockActivities(section.key)).slice(0, 2);
              const phaseMeta =
                section.key === "warmup"
                  ? { tint: colors.card, border: colors.warningText }
                  : section.key === "main"
                    ? { tint: colors.card, border: colors.primaryBg }
                    : { tint: colors.card, border: colors.successText };
              return (
                <Pressable
                  key={section.label}
                  onPress={() => setSelectedBlockKey(section.key)}
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    backgroundColor: phaseMeta.tint,
                    borderWidth: 1,
                    borderColor: phaseMeta.border,
                    shadowColor: colors.background,
                    shadowOpacity: 0.04,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 2,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                        {section.label}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {lastUpdatedBlockKey === section.key ? (
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                            backgroundColor: colors.successBg,
                          }}
                        >
                          <Text style={{ color: colors.successText, fontSize: 10, fontWeight: "700" }}>
                            Atualizado
                          </Text>
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    </View>
                  </View>
                  {previewItems.length ? (
                    <View style={{ gap: 4 }}>
                      {previewItems.map((item, index) => (
                        <Text key={`${section.key}-preview-${index}`} style={{ color: colors.text, fontSize: 12 }}>
                          • {item}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={handleRemoveAppliedPlan}
              disabled={isRemovingAppliedPlan}
              style={{
                alignSelf: "flex-start",
                marginTop: 4,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: isRemovingAppliedPlan
                  ? colors.secondaryBg
                  : colors.dangerSolidBg,
                opacity: isRemovingAppliedPlan ? 0.75 : 1,
              }}
            >
              <Text
                style={{
                  color: isRemovingAppliedPlan
                    ? colors.muted
                    : colors.dangerSolidText,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {isRemovingAppliedPlan ? "Removendo..." : "Remover plano do dia"}
              </Text>
            </Pressable>
          </>
        ) : null}
        {sessionTab === "treino" && !plan && !isPlanGenerationBusy ? (
          <>
            {!resistancePreview && shouldShowResistanceGuardNotice ? (
              <SessionResistanceNotice
                colors={colors}
                tone="warning"
                title="Academia não priorizada nesta sessão"
                description="Apesar do acesso à academia, o foco permanece em quadra porque este momento da turma pede controle corporal, coordenação e aprendizagem do jogo."
              />
            ) : null}
            {hasUnavailableResistanceSession ? (
              <SessionResistanceNotice
                colors={colors}
                tone="warning"
                title="Sessão resistida indisponível"
                description="O contexto da semana indica academia, mas os exercícios ainda não foram gerados. Você pode regenerar a sessão ou seguir com treino de quadra."
                actions={[
                  {
                    label:
                      isSavingPedagogicalPlan || isGeneratingPedagogicalPlan
                        ? "Gerando plano..."
                        : "Regenerar sessão",
                    onPress: handleGeneratePedagogicalPlan,
                    variant: "primary",
                  },
                  {
                    label: "Usar treino de quadra",
                    onPress: () => setShowSavedClassPlans(true),
                  },
                ]}
              />
            ) : null}
            {resistancePreview ? (
              <>
                <SessionContextHeader
                  colors={colors}
                  environment={resistancePreview.sessionEnvironment}
                  weeklyPhysicalEmphasis={resistancePreview.weeklyContext?.weeklyPhysicalEmphasis}
                  courtGymRelationship={resistancePreview.weeklyContext?.courtGymRelationship}
                  transferTarget={resistancePreview.resistancePlan.transferTarget}
                  durationMin={resistancePreview.durationMin}
                />
                <SessionResistanceBlock
                  colors={colors}
                  resistancePlan={resistancePreview.resistancePlan}
                  durationMin={resistancePreview.durationMin}
                />
                {resistancePreview.sessionEnvironment === "mista" ? (
                  <SessionResistanceNotice
                    colors={colors}
                    title="Ponte para a quadra"
                    description={mixedSessionBridgeDescription}
                  />
                ) : null}
              </>
            ) : null}
            {!resistancePreview ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: "#000",
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 2,
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                  {ptBR.session.emptyPlan.title}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {ptBR.session.emptyPlan.description}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Pressable
                    onPress={() => setShowSavedClassPlans((current) => !current)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: colors.primaryBg,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                      {showSavedClassPlans ? "Ocultar planos" : ptBR.session.emptyPlan.applyTraining}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleGeneratePedagogicalPlan}
                    disabled={isGeneratingPedagogicalPlan || isSavingPedagogicalPlan}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                      opacity: isGeneratingPedagogicalPlan || isSavingPedagogicalPlan ? 0.65 : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {isSavingPedagogicalPlan
                        ? "Salvando plano..."
                        : isGeneratingPedagogicalPlan
                          ? "Gerando plano..."
                          : ptBR.session.actions.generateAutomaticPlan}
                    </Text>
                  </Pressable>
                </View>
                {showSavedClassPlans ? (
                  <View
                    style={{
                      gap: 10,
                      paddingTop: 4,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <View style={{ gap: 2 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                        Planos salvos desta turma
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Escolha um plano já salvo para aplicar somente nesta aula.
                      </Text>
                    </View>
                    {savedClassPlans.length ? (
                      savedClassPlans.map((savedPlan) => {
                        const preview = buildSavedPlanSummary(savedPlan);
                        const isApplying = isApplyingSavedPlanId === savedPlan.id;
                        return (
                          <View
                            key={savedPlan.id}
                            style={{
                              gap: 8,
                              padding: 12,
                              borderRadius: 14,
                              backgroundColor: colors.secondaryBg,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <View style={{ gap: 4 }}>
                              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                                {savedPlan.title || "Plano salvo"}
                              </Text>
                              <Text style={{ color: colors.muted, fontSize: 12 }}>
                                {buildSavedPlanMeta(savedPlan)}
                                {typeof savedPlan.version === "number" ? ` • v${savedPlan.version}` : ""}
                              </Text>
                              {preview ? (
                                <Text style={{ color: colors.text, fontSize: 12 }}>
                                  {preview}
                                </Text>
                              ) : null}
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <Text style={{ color: colors.muted, fontSize: 11, flex: 1 }}>
                                Aplicação direta em {dateLabel}.
                              </Text>
                              <Pressable
                                onPress={() => {
                                  void handleApplySavedPlan(savedPlan);
                                }}
                                disabled={isApplying}
                                style={{
                                  paddingVertical: 8,
                                  paddingHorizontal: 12,
                                  borderRadius: 999,
                                  backgroundColor: isApplying ? colors.border : colors.primaryBg,
                                }}
                              >
                                <Text
                                  style={{
                                    color: isApplying ? colors.muted : colors.primaryText,
                                    fontSize: 12,
                                    fontWeight: "800",
                                  }}
                                >
                                  {isApplying ? "Aplicando..." : "Aplicar neste dia"}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <View
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          Esta turma ainda não tem planos finais salvos para reutilizar aqui.
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
        {sessionTab === "scouting" ? (
        <View
          style={{
            padding: 14,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
            gap: 10,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              {ptBR.scouting.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {ptBR.scouting.operationHint}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              {(["treino", "jogo"] as const).map((mode) => {
                const isActive = scoutingMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setScoutingMode(mode)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isActive ? colors.primaryBg : colors.border,
                      backgroundColor: isActive ? colors.primaryBg : colors.secondaryBg,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? colors.primaryText : colors.text,
                        fontWeight: "700",
                      }}
                    >
                      {mode === "treino" ? ptBR.scouting.modeTrain : ptBR.scouting.modeMatch}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {ptBR.scouting.totalActions}: {totalActions}
            </Text>
            <Pressable
              onPress={() => setShowScoutingGuide((prev) => !prev)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
            >
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                {showScoutingGuide ? ptBR.scouting.hideGuide : ptBR.scouting.showGuide}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.muted}
                style={{ transform: [{ rotate: showScoutingGuide ? "180deg" : "0deg" }] }}
              />
            </Pressable>
          </View>
          {showScoutingGuide ? (
            <View
              style={{
                padding: 10,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 6,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 12 }}>
                {ptBR.scouting.quickGuideTitle}
              </Text>
              <FlatList
                data={scoutingSkills}
                keyExtractor={(skill) => skill.id}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 2 }}
                renderItem={({ item: skill }) => (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {skill.label}: {scoutingSkillHelp[skill.id].join(" | ")}
                  </Text>
                )}
              />
            </View>
          ) : null}
          <View style={{ gap: 10 }}>
            <FlatList
              data={scoutingSkills}
              keyExtractor={(skill) => skill.id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item: skill, index }) => {
                const metrics = scoutingTotals[index];
                const counts = scoutingCounts[skill.id];
                const goodPct = Math.round(metrics.goodPct * 100);
                const shortGuide = scoutingSkillHelp[skill.id]
                  .map((line, idx) => `${idx} ${line}`)
                  .join(" • ");
                return (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontWeight: "700", color: colors.text }}>
                        {skill.label}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {metrics.total} ações | {ptBR.scouting.averageLabel} {metrics.avg.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{shortGuide}</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {([0, 1, 2] as const).map((score) => {
                        const palette =
                          score === 2
                            ? { bg: colors.successBg, text: colors.successText }
                            : score === 1
                              ? { bg: colors.inputBg, text: colors.text }
                              : { bg: colors.dangerSolidBg, text: colors.dangerSolidText };
                        return (
                          <Pressable
                            key={score}
                            onPress={() => updateScoutingCount(skill.id, score, 1)}
                            onLongPress={() => updateScoutingCount(skill.id, score, -1)}
                            onContextMenu={(event) => {
                              if (event && typeof (event as { preventDefault?: () => void }).preventDefault === "function") {
                                (event as { preventDefault: () => void }).preventDefault();
                              }
                              updateScoutingCount(skill.id, score, -1);
                            }}
                            delayLongPress={200}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: 12,
                              alignItems: "center",
                              backgroundColor: palette.bg,
                            }}
                          >
                            <Text style={{ color: palette.text, fontWeight: "700" }}>
                              {score}
                            </Text>
                            <Text style={{ color: palette.text, fontSize: 11, opacity: 0.9 }}>
                              x{counts[score]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {ptBR.scouting.goodRateLabel}: {goodPct}%
                    </Text>
                  </View>
                );
              }}
            />
          </View>
          {focusSuggestion ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {ptBR.scouting.nextSessionFocus}: {focusSuggestion.label}
              </Text>
              <Text style={{ color: colors.muted }}>{focusSuggestion.text}</Text>
            </View>
          ) : (
            <Text style={{ color: colors.muted }}>
              {ptBR.scouting.minimumActionsHint}
            </Text>
          )}
          <Pressable
            onPress={handleSaveScouting}
            disabled={!scoutingHasChanges || scoutingSaving}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor:
                !scoutingHasChanges || scoutingSaving
                  ? colors.primaryDisabledBg
                  : colors.primaryBg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color:
                  !scoutingHasChanges || scoutingSaving
                    ? colors.secondaryText
                    : colors.primaryText,
                fontWeight: "700",
              }}
            >
              {ptBR.scouting.saveAction}
            </Text>
          </Pressable>
        </View>
        ) : null}
        {sessionTab === "relatório" ? (
        <View
          ref={containerRef}
          onLayout={syncPickerLayouts}
          style={{
            padding: 14,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            position: "relative",
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            {ptBR.session.report.title}
          </Text>
          <Text style={{ color: colors.muted }}>
            {sessionDate.split("-").reverse().join("/")}
          </Text>
          {!sessionLog ? (
            <Text style={{ color: colors.muted }}>
              {ptBR.session.report.noReportYet}
            </Text>
          ) : null}
          {sessionLog ? (
            <View
              style={{
                alignSelf: "flex-start",
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 10,
                backgroundColor: colors.successBg,
                marginTop: 4,
              }}
            >
              <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "700" }}>
                {ptBR.session.report.editingExisting}
              </Text>
            </View>
          ) : null}
          <View style={{ gap: 12, marginTop: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {ptBR.session.report.pse}
              </Text>
              <View ref={pseTriggerRef}>
                <Pressable
                  onPress={() => togglePicker("pse")}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {String(PSE)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: showPsePicker ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
              </View>
              </View>

              <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {ptBR.session.report.technique}
              </Text>
              <View ref={techniqueTriggerRef}>
                <Pressable
                  onPress={() => togglePicker("technique")}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {technique}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [{ rotate: showTechniquePicker ? "180deg" : "0deg" }],
                    }}
                  />
                </Pressable>
              </View>
            </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {ptBR.session.report.participants}
              </Text>
                <TextInput
                  placeholder={ptBR.session.report.participantsPlaceholder}
                  value={participantsCount}
                  onChangeText={setParticipantsCount}
                  keyboardType="numeric"
                  placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
            </View>

              <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {ptBR.session.report.activity}
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder={ptBR.session.report.activityPlaceholder}
                  value={activity}
                  onChangeText={(value) => {
                    setActivity(value);
                    closePickers();
                  }}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    paddingRight: 52,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                  }}
                />
                {(canSuggestActivity || isRewritingActivity) ? (
                  <Pressable
                    onPress={() => void handleRewriteField("activity")}
                    disabled={isRewritingActivity}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      marginTop: -15,
                      borderRadius: 999,
                      width: 30,
                      height: 30,
                      backgroundColor: colors.primaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isRewritingActivity ? 0.65 : 1,
                    }}
                  >
                    <Ionicons
                      name={isRewritingActivity ? "hourglass-outline" : "sparkles-outline"}
                      size={14}
                      color={colors.primaryText}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
            </View>
            {autoActivity ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                      {ptBR.session.report.previewAppliedTraining}
                    </Text>
                    <Pressable
                      onPress={handleApplyAutoActivity}
                      disabled={!canApplyAutoActivity}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: canApplyAutoActivity
                          ? colors.primaryBg
                          : colors.secondaryBg,
                        opacity: canApplyAutoActivity ? 1 : 0.6,
                      }}
                    >
                      <Text
                        style={{
                          color: canApplyAutoActivity ? colors.primaryText : colors.muted,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Aplicar
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={() => setShowAppliedPreview((prev) => !prev)}>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [{ rotate: showAppliedPreview ? "180deg" : "0deg" }],
                      }}
                    />
                  </Pressable>
                </View>
                {showAppliedPreview ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {autoActivity}
                  </Text>
                ) : null}
                {!canApplyAutoActivity ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {ptBR.session.report.clearToApplyHint}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {ptBR.session.report.conclusion}
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder={ptBR.session.report.conclusionPlaceholder}
                  value={conclusion}
                  onChangeText={(value) => {
                    setConclusion(value);
                    closePickers();
                  }}
                  placeholderTextColor={colors.placeholder}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    paddingRight: 52,
                    borderRadius: 12,
                    minHeight: 90,
                    textAlignVertical: "top",
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                  }}
                />
                {(canSuggestConclusion || isRewritingConclusion) ? (
                  <Pressable
                    onPress={() => void handleRewriteField("conclusion")}
                    disabled={isRewritingConclusion}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: 8,
                      borderRadius: 999,
                      width: 30,
                      height: 30,
                      backgroundColor: colors.primaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isRewritingConclusion ? 0.65 : 1,
                    }}
                  >
                    <Ionicons
                      name={isRewritingConclusion ? "hourglass-outline" : "sparkles-outline"}
                      size={14}
                      color={colors.primaryText}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {ptBR.session.report.photos}
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  padding: 10,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      void pickReportPhoto("camera");
                    }}
                    disabled={isPickingPhoto || reportPhotoUris.length >= REPORT_PHOTO_LIMIT}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingVertical: 9,
                      alignItems: "center",
                      opacity:
                        isPickingPhoto || reportPhotoUris.length >= REPORT_PHOTO_LIMIT
                          ? 0.6
                          : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {isPickingPhoto ? ptBR.session.actions.opening : ptBR.session.actions.takePhoto}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void pickReportPhoto("library");
                    }}
                    disabled={isPickingPhoto || reportPhotoUris.length >= REPORT_PHOTO_LIMIT}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingVertical: 9,
                      alignItems: "center",
                      opacity:
                        isPickingPhoto || reportPhotoUris.length >= REPORT_PHOTO_LIMIT
                          ? 0.6
                          : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {ptBR.session.actions.gallery}
                    </Text>
                  </Pressable>
                </View>

                {reportPhotoUris.length ? (
                  <FlatList
                    data={reportPhotoUris}
                    keyExtractor={(uri, index) => `${uri}_${index}`}
                    numColumns={Platform.OS === "web" ? 4 : 3}
                    scrollEnabled={false}
                    contentContainerStyle={{ gap: 8 }}
                    columnWrapperStyle={{ gap: 8 }}
                    renderItem={({ item: uri, index }) => (
                      <Pressable
                        onPress={() => setPhotoActionIndex(index)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: Platform.OS === "web" ? 112 : undefined,
                          aspectRatio: Platform.OS === "web" ? undefined : 1,
                          borderRadius: 10,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: colors.border,
                          position: "relative",
                          backgroundColor: colors.secondaryBg,
                        }}
                      >
                        <Image
                          source={{ uri }}
                          resizeMode="cover"
                          style={{ width: "100%", height: "100%" }}
                        />
                        <View
                          style={{
                            position: "absolute",
                            right: 6,
                            bottom: 6,
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            backgroundColor: "rgba(0,0,0,0.72)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="create-outline" size={12} color={colors.primaryText} />
                        </View>
                      </Pressable>
                    )}
                  />
                ) : null}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Button
                label={sessionLog ? ptBR.session.actions.saveChanges : ptBR.session.actions.save}
                variant="secondary"
                onPress={handleSaveReport}
                disabled={!reportHasChanges}
              />
              <Button
                label={ptBR.session.actions.generateReport}
                onPress={handleSaveAndGenerateReport}
              />
            </View>
          </View>

          <AnchoredDropdown
            visible={showPsePickerContent}
            layout={pseTriggerLayout}
            container={containerWindow}
            animationStyle={psePickerAnimStyle}
            zIndex={420}
            maxHeight={220}
            nestedScrollEnabled
            onRequestClose={closePickers}
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <AnchoredDropdownOption
                key={n}
                active={PSE === n}
                onPress={() => handleSelectPse(n)}
              >
                <Text
                  style={{
                    color: PSE === n ? colors.primaryText : colors.text,
                    fontSize: 14,
                    fontWeight: PSE === n ? "700" : "500",
                  }}
                >
                  {n}
                </Text>
              </AnchoredDropdownOption>
            ))}
          </AnchoredDropdown>

          <AnchoredDropdown
            visible={showTechniquePickerContent}
            layout={techniqueTriggerLayout}
            container={containerWindow}
            animationStyle={techniquePickerAnimStyle}
            zIndex={420}
            maxHeight={160}
            nestedScrollEnabled
            onRequestClose={closePickers}
            scrollContentStyle={{ padding: 8, gap: 6 }}
          >
            {(["nenhum", "boa", "ok", "ruim"] as const).map((value) => (
              <AnchoredDropdownOption
                key={value}
                active={technique === value}
                onPress={() => handleSelectTechnique(value)}
              >
                <Text
                  style={{
                    color: technique === value ? colors.primaryText : colors.text,
                    fontSize: 14,
                    fontWeight: technique === value ? "700" : "500",
                    textTransform: "capitalize",
                  }}
                >
                  {value}
                </Text>
              </AnchoredDropdownOption>
            ))}
          </AnchoredDropdown>

          <ModalSheet
            visible={photoActionIndex !== null}
            onClose={() => setPhotoActionIndex(null)}
            position="center"
            overlayZIndex={30000}
            backdropOpacity={0.7}
            cardStyle={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 18,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              {ptBR.session.report.photoActionTitle}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {ptBR.session.report.photoActionSubtitle}
            </Text>
            <View style={{ gap: 8, marginTop: 6 }}>
              <Pressable
                onPress={() => {
                  if (photoActionIndex === null) return;
                  setPhotoActionIndex(null);
                  void pickReportPhoto("camera", photoActionIndex);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {ptBR.session.actions.replaceCamera}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (photoActionIndex === null) return;
                  setPhotoActionIndex(null);
                  void pickReportPhoto("library", photoActionIndex);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {ptBR.session.actions.replaceGallery}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (photoActionIndex === null) return;
                  removePhotoAtIndex(photoActionIndex);
                  setPhotoActionIndex(null);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.dangerBorder,
                  backgroundColor: colors.dangerBg,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
                  {ptBR.session.actions.remove}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPhotoActionIndex(null)}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {ptBR.session.actions.cancel}
                </Text>
              </Pressable>
            </View>
          </ModalSheet>
        </View>
        ) : null}
      </ScrollView>

      <BlockEditModal
        visible={!!selectedBlockData}
        title={selectedBlockData?.title ?? ""}
        durationMinutes={selectedBlockData?.durationMinutes ?? 0}
        activities={selectedBlockData?.activities ?? []}
        saving={isSavingBlockEdit}
        onClose={() => setSelectedBlockKey(null)}
        onSave={handleSaveBlockEdit}
      />

      <ModalSheet
        visible={showDecisionOverrideModal}
        onClose={() => setShowDecisionOverrideModal(false)}
        position="center"
        overlayZIndex={30000}
        backdropOpacity={0.7}
        cardStyle={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 18,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 10,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          {ptBR.session.decisionOverride.title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {ptBR.session.decisionOverride.description}
        </Text>
        {suggestedDecisionAdjustmentLabel ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Leitura do sistema para esta aula: {suggestedDecisionAdjustmentLabel}
          </Text>
        ) : null}

        <View style={{ gap: 8, marginTop: 4 }}>
          {(["increase", "maintain", "regress"] as const).map((value) => {
            const selected = decisionAppliedAdjustment === value;
            return (
              <Pressable
                key={value}
                onPress={() => setDecisionAppliedAdjustment(value)}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selected ? colors.primaryBg : colors.border,
                  backgroundColor: selected ? colors.secondaryBg : colors.card,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {formatAdjustmentLabel(value)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {plan?.pedagogy?.adaptation &&
        decisionAppliedAdjustment !==
          (plan.pedagogy.adaptation.telemetry?.decision.suggested ?? plan.pedagogy.adaptation.adjustment) ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              {ptBR.session.decisionOverride.reason}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["health", "readiness", "context", "other"] as const).map((item) => {
                const selected = decisionReasonType === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setDecisionReasonType(item)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? colors.primaryBg : colors.border,
                      backgroundColor: selected ? colors.secondaryBg : colors.card,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      {decisionReasonTypeLabels[item]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={decisionReasonNote}
              onChangeText={setDecisionReasonNote}
              placeholder={ptBR.session.decisionOverride.optionalNote}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
        ) : null}

        <View style={{ gap: 8, marginTop: 6 }}>
          <Pressable
            onPress={() => void handleApplyDecisionOverride()}
            disabled={isApplyingDecisionOverride}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.primaryBg,
              backgroundColor: colors.primaryBg,
              paddingVertical: 10,
              alignItems: "center",
              opacity: isApplyingDecisionOverride ? 0.65 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              {isApplyingDecisionOverride ? ptBR.session.actions.saving : ptBR.session.decisionOverride.saveFinalDecision}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowDecisionOverrideModal(false)}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {ptBR.session.actions.cancel}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>

      {sessionTab === "treino" && showPlanFabMenu ? (
        <Pressable
          onPress={() => setShowPlanFabMenu(false)}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 3180,
          }}
        />
      ) : null}

      {sessionTab === "treino" && showPlanFabMenu ? (
        <View
          style={{
            ...(Platform.OS === "web"
              ? ({ position: "fixed", right: 16, bottom: planFabMenuBottom } as any)
              : { position: "absolute" as const, right: 16, bottom: planFabMenuBottom }),
            width: 210,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 8,
            gap: 8,
            zIndex: 3190,
          }}
        >
          {plan ? (
            <Pressable
              onPress={() => {
                setShowPlanFabMenu(false);
                if (!cls) return;
                router.push({
                  pathname: "/class/[id]/attendance",
                  params: { id: cls.id, date: sessionDate },
                });
              }}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 9,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="play-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {ptBR.session.actions.startTraining}
              </Text>
            </Pressable>
          ) : null}

          {plan ? (
            <Pressable
              onPress={() => {
                setShowPlanFabMenu(false);
                handleExportPdf();
              }}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 9,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="download-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {ptBR.session.actions.export}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              setShowPlanFabMenu(false);
              router.push({
                pathname: "/prof/planning",
                params: {
                  targetClassId: cls?.id ?? "",
                  openImport: "1",
                },
              });
            }}
            disabled={!cls}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 9,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: cls ? 1 : 0.65,
            }}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              {ptBR.session.actions.importPlan}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {sessionTab === "treino" ? (
        <Pressable
          onPress={() => setShowPlanFabMenu((current) => !current)}
          style={{
            ...(Platform.OS === "web"
              ? ({ position: "fixed", right: 16, bottom: planFabBottom } as any)
              : { position: "absolute" as const, right: 16, bottom: planFabBottom }),
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primaryBg,
            borderWidth: 1,
            borderColor: colors.primaryBg,
            zIndex: 3200,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: planFabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "45deg"],
                  }),
                },
                {
                  scale: planFabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.05],
                  }),
                },
              ],
            }}
          >
            <MaterialCommunityIcons name="plus" size={24} color={colors.primaryText} />
          </Animated.View>
        </Pressable>
      ) : null}

      <ModalSheet
        visible={showMissingPeriodizationModal}
        onClose={() => setShowMissingPeriodizationModal(false)}
        position="center"
        overlayZIndex={30000}
        backdropOpacity={0.7}
        cardStyle={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 18,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
          gap: 14,
        }}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            {currentClassPlan
              ? "A periodização desta turma ainda não está pronta para servir de base"
              : "Esta turma ainda não tem periodização gerada"}
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            {currentClassPlan
              ? "Você pode completar ou gerar a periodização primeiro para usar a progressão semanal do ciclo como base, ou gerar a aula agora com base apenas no perfil da turma e no histórico disponível."
              : "Você pode gerar a periodização primeiro para usar a progressão semanal do ciclo como base, ou gerar a aula agora com base apenas no perfil da turma e no histórico disponível."}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => {
              setShowMissingPeriodizationModal(false);
              if (!cls) return;
              router.push({
                pathname: "/prof/periodization",
                params: { classId: cls.id, unit: cls.unit ?? "" },
              });
            }}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              Gerar periodização
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowMissingPeriodizationModal(false);
              void generatePedagogicalPlanAndSave(undefined, "class_based_bootstrap");
            }}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Gerar aula agora
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowMissingPeriodizationModal(false)}
            style={{
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancelar</Text>
          </Pressable>
        </View>
      </ModalSheet>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
