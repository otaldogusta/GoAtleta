import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.js";

import { useLocalSearchParams, useRouter } from "expo-router";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert, Animated, FlatList, Platform, ScrollView, Text, View } from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedSegmentedTabs } from "../../src/ui/AnimatedSegmentedTabs";
import { Pressable } from "../../src/ui/Pressable";


import { useCopilotActions, useCopilotContext } from "../../src/copilot/CopilotProvider";
import { normalizeAgeBand, parseAgeBandRange } from "../../src/core/age-band";
import { resolveWeeklyAutopilotKnowledgeDomain } from "../../src/core/autopilot/weekly-autopilot";
import {
    buildCompetitiveClassPlan,
    buildCompetitiveWeekMeta,
    isCompetitivePlanningMode,
    toCompetitiveClassPlans,
} from "../../src/core/competitive-periodization";
import {
    ageBands,
    annualCycleOptions,
    cycleOptions,
    getDemandIndexForModel,
    getLoadLabelForModel,
    getSportLabel,
    type PeriodizationModel,
    resolveSportProfile,
    sessionsOptions,
    splitSegmentLengths,
    type SportProfile,
    type VolumeLevel,
    volumeToRatio
} from "../../src/core/periodization-basics";
import {
    buildClassPlan,
    getMvFormat,
    getPhysicalFocus,
    resolvePlanBand,
    validateAcwrLimits
} from "../../src/core/periodization-generator";
import {
    formatPlannedLoad,
} from "../../src/core/periodization-load";
import {
    buildPlanDiff,
    buildPlanReviewSummary,
    toPlanningGraphFromClassPlans,
} from "../../src/core/plan-engine";
import { buildPeriodizationWeekSchedule } from "../../src/screens/periodization/application/build-auto-plan-for-cycle-day";
import { useAcwrState } from "../../src/screens/periodization/hooks/useAcwrState";
import { useClassPlansLoader } from "../../src/screens/periodization/hooks/useClassPlansLoader";
import { useGeneratePlansMode } from "../../src/screens/periodization/hooks/useGeneratePlansMode";
import { useImportPlansFile } from "../../src/screens/periodization/hooks/useImportPlansFile";
import { usePeriodizationCopilotActions } from "../../src/screens/periodization/hooks/usePeriodizationCopilotActions";
import { usePickerLayout } from "../../src/screens/periodization/hooks/usePickerLayout";
import { useSaveWeek } from "../../src/screens/periodization/hooks/useSaveWeek";
import { useWeekEditor } from "../../src/screens/periodization/hooks/useWeekEditor";
import { getPlansWithinCycle, useWeekPlans } from "../../src/screens/periodization/hooks/useWeekPlans";
import { buildMonthSegments, buildMonthWeekNumbers } from "../../src/screens/periodization/month-segments";
import { buildRecentSessionSummary } from "../../src/screens/session/application/build-recent-session-summary";

  const DEFAULT_ANNUAL_CYCLE_LENGTH = annualCycleOptions[annualCycleOptions.length - 1];

import type {
    ClassCalendarException,
    ClassCompetitiveProfile,
    ClassGroup,
    ClassPlan,
    DailyLessonPlan,
    PeriodizationContext,
    PlanningCycle,
    RecentSessionSummary,
    WeeklyAutopilotKnowledgeContext,
    WeeklyAutopilotPlanReview,
} from "../../src/core/models";

import { normalizeUnitKey } from "../../src/core/unit-key";

import {
    deleteClassCalendarException,
    deleteClassCompetitiveProfile,
    deleteClassPlansByClass,
    getClassCalendarExceptions,
    getClassCompetitiveProfile,
    getClasses,

    getClassPlansByClass,
    getKnowledgeBaseSnapshot,
    getSessionLogsByClass,
    getTrainingPlans,
    getTrainingSessionEvidenceByClass,
    listRecentDailyLessonPlansByClass,
    saveClassCalendarException,
    saveClassCompetitiveProfile,
    updateClassAcwrLimits
} from "../../src/db/seed";
import { useOptionalOrganization } from "../../src/providers/OrganizationProvider";

import { ensureActiveCycleForYear, getPlanningCycles } from "../../src/db/cycles";

import { logAction } from "../../src/observability/breadcrumbs";

import { markRender, measure, measureAsync } from "../../src/observability/perf";

import { exportPdf, safeFileName } from "../../src/pdf/export-pdf";

import { PeriodizationDocument } from "../../src/pdf/periodization-document";

import { periodizationHtml } from "../../src/pdf/templates/periodization";

import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";

import { type ThemeColors, useAppTheme } from "../../src/ui/app-theme";

import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";



import { CycleTab } from "../../src/screens/periodization/CycleTab";
import { WeekTab } from "../../src/screens/periodization/WeekTab";

import { getUnitPalette } from "../../src/ui/unit-colors";

import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";

import { useModalCardStyle } from "../../src/ui/use-modal-card-style";

import { getSectionCardStyle } from "../../src/ui/section-styles";
import { usePersistedState } from "../../src/ui/use-persisted-state";

import type {
    DriftFrequencyByClassItem,
  ObservabilityInsight,
    ObservabilityTrendByClass,
    PlanObservabilityRecord,
    UnstableObservabilityWeek,
} from "../../src/db/observability-summaries";
import {
  buildObservabilityInsightsFromRecords,
    computeDriftFrequencyFromRecords,
    computeObservabilityTrendFromRecords,
    computeRecentUnstableWeeksFromRecords,
    listPlanObservabilitySummariesByClass,
    upsertPlanObservabilitySummary,
} from "../../src/db/observability-summaries";
import { buildWeekSessionPreview } from "../../src/screens/periodization/application/build-week-session-preview";
import { buildWeeklyObservabilitySummary } from "../../src/screens/periodization/application/build-weekly-observability-summary";
import {
    formatWeeklyOperationalIntentForTeacher,
    parseWeeklyOperationalStrategySnapshot,
} from "../../src/screens/periodization/application/format-weekly-operational-intent-for-teacher";
import { buildAutoWeekPlan } from "../../src/screens/periodization/build-auto-week-plan";
import { CompetitiveAgendaCard } from "../../src/screens/periodization/CompetitiveAgendaCard";
import { DayModal } from "../../src/screens/periodization/modals/DayModal";
import { WeekEditorModal } from "../../src/screens/periodization/modals/WeekEditorModal";
import { OverviewTab } from "../../src/screens/periodization/OverviewTab";
import { resolvePeriodizationScreenContext } from "../../src/screens/periodization/resolve-periodization-screen-context";
import { AnchoredDropdownOption } from "../../src/ui/AnchoredDropdownOption";

type WeekPlan = {

  week: number;

  title: string;

  focus: string;

  volume: VolumeLevel;

  notes: string[];

  dateRange?: string;

  sessionDatesLabel?: string;

  jumpTarget: string;

  PSETarget: string;

  plannedSessionLoad: number;

  plannedWeeklyLoad: number;

  source: "AUTO" | "MANUAL";

};

// WeekTemplate is imported from periodization-generator

const xlsxWithCodepage = XLSX as typeof XLSX & {
  set_cptable?: (value: unknown) => void;
};
if (typeof xlsxWithCodepage.set_cptable === "function") {
  xlsxWithCodepage.set_cptable(cptable);
}


const volumeToPSE: Record<VolumeLevel, string> = {

  baixo: "PSE 4-5",

  "médio": "PSE 5-6",

  alto: "PSE 6-7",

};


const emptyWeek: WeekPlan = {

  week: 1,

  title: "Semana",

  focus: "Sem foco definido",

  volume: "baixo",

  notes: [],

  jumpTarget: "-",

  PSETarget: "PSE 4-5",

  plannedSessionLoad: 0,

  plannedWeeklyLoad: 0,

  source: "AUTO",

};

const planReviewFieldLabels: Record<string, string> = {
  phase: "Fase",
  objective: "Objetivo",
  loadTarget: "Carga",
  intensityTarget: "Intensidade",
  technicalFocus: "Foco técnico",
  physicalFocus: "Foco físico",
  constraints: "Restrições",
  progressionModel: "Progressão",
};

const formatPlanReviewValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(String(item ?? "")))
      .filter(Boolean)
      .join(" • ") || "Sem valor";
  }
  if (value == null) return "Sem valor";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "Sem valor";
    }
  }
  return normalizeText(String(value)) || "Sem valor";
};

const formatPeriodizationContextModel = (
  value: PeriodizationContext["model"]
) => {
  if (value === "rendimento") return "Rendimento";
  if (value === "hibrido") return "Híbrido";
  return "Formação";
};

const formatPeriodizationContextLoad = (context: PeriodizationContext) => {
  if (!context.load) return null;
  const levelLabel =
    context.load.level === "alto"
      ? "Alta"
      : context.load.level === "medio"
        ? "Média"
        : "Baixa";
  const trendLabel =
    context.load.trend === "subindo"
      ? "subindo"
      : context.load.trend === "descendo"
        ? "descendo"
        : context.load.trend === "estavel"
          ? "estável"
          : "";
  return trendLabel ? `${levelLabel} (${trendLabel})` : levelLabel;
};

const parsePseTarget = (value: string | undefined) => {
  const match = String(value ?? "").match(/\d+/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
};


type SectionKey =

  | "load"

  | "guides"

  | "cycle"

  | "week";

type CompetitiveBlockKey = "profile" | "calendar" | "exceptions";


type PeriodizationTab = "geral" | "ciclo" | "semana";


const getVolumePalette = (level: VolumeLevel, colors: ThemeColors) => {

  if (level === "baixo") {

    return {

      bg: colors.successBg,

      text: colors.successText,

      border: colors.successBg,

    };

  }

  if (level === "médio") {

    return {

      bg: colors.warningBg,

      text: colors.warningText,

      border: colors.warningBg,

    };

  }

  return {

    bg: colors.dangerBg,

    text: colors.dangerText,

    border: colors.dangerBorder,

  };

};

const getPhaseTrackPalette = (phase: string, colors: ThemeColors) => {
  const normalized = normalizeText(phase).toLowerCase();
  if (normalized.includes("recuper")) {
    return { bg: colors.successBg, text: colors.successText };
  }
  if (
    normalized.includes("base") ||
    normalized.includes("prepara") ||
    normalized.includes("desenvol") ||
    normalized.includes("consol")
  ) {
    return { bg: colors.warningBg, text: colors.warningText };
  }
  if (normalized.includes("compet")) {
    return { bg: colors.dangerBg, text: colors.dangerText };
  }
  return { bg: colors.secondaryBg, text: colors.text };
};


const formatIsoDate = (value: Date) => {

  const y = value.getFullYear();

  const m = String(value.getMonth() + 1).padStart(2, "0");

  const d = String(value.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;

};

const formatDateInputMask = (value: string) => {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseDateInputToIso = (value: string | null) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  const isValid =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
  if (!isValid) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const formatDateForInput = (value: string | null) => {
  if (!value) return "";
  const iso = parseDateInputToIso(value);
  if (!iso) return value;
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};


const nextDateForDayNumber = (dayNumber: number) => {

  const now = new Date();

  const diff = (dayNumber - now.getDay() + 7) % 7;

  const target = new Date(now);

  target.setDate(now.getDate() + diff);

  return target;

};


const parseIsoDate = (value: string | null) => {

  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;

};


const decodeUnicodeEscapes = (value: string) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    const next = current
      .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\\\U([0-9a-fA-F]{8})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\U([0-9a-fA-F]{8})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      );
    if (next === current) break;
    current = next;
  }
  return current;
};

const tryJsonDecode = (value: string) => {
  try {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return JSON.parse(`"${escaped}"`) as string;
  } catch {
    return value;
  }
};

const normalizeText = (value: string) => {
  if (!value) return value;
  let current = String(value);
  for (let i = 0; i < 2; i += 1) {
    current = current.replace(/\\\\u/gi, "\\u").replace(/\\\\U/gi, "\\U");
  }
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeUnicodeEscapes(tryJsonDecode(current));
    if (decoded === current) break;
    current = decoded;
  }
  if (/\\u[0-9a-fA-F]{4}/.test(current) || /\\U[0-9a-fA-F]{8}/.test(current)) {
    current = decodeUnicodeEscapes(current);
  }
  if (!/[\uFFFD?]/.test(current)) return current;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      current = decodeURIComponent(escape(current));
    } catch {
      break;
    }
    if (!/[\uFFFD?]/.test(current)) break;
  }
  return current;
};


const isIsoDateValue = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());


export default function PeriodizationScreen() {
  markRender("screen.periodization.render.root");

  const router = useRouter();
  const { classId: initialClassId, unit: initialUnit } = useLocalSearchParams<{
    classId: string;
    unit: string;
  }>();
  const hasInitialClass =
    typeof initialClassId === "string" && initialClassId.trim().length > 0;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const organization = useOptionalOrganization();
  const activeOrganization = organization?.activeOrganization ?? null;
  const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;

  const { confirm: confirmDialog } = useConfirmDialog();

  const modalCardStyle = useModalCardStyle({ maxHeight: "100%" });

  const [activeTab, setActiveTab] = useState<PeriodizationTab>("geral");

  useCopilotContext(
    useMemo(
      () => ({
        screen: "periodization_index",
        title: "Periodização",
        subtitle: "Macrociclo, blocos dominantes e demanda semanal",
      }),
      []
    )
  );

  const [sectionOpen, setSectionOpen] = usePersistedState<Record<SectionKey, boolean>>(

    "periodization_sections_v1",

    {

      load: true,

      guides: false,

      cycle: false,

      week: true,

    }

  );
  const [competitiveBlocksOpen, setCompetitiveBlocksOpen] = usePersistedState<
    Record<CompetitiveBlockKey, boolean>
  >("periodization_competitive_blocks_v1", {
    profile: true,
    calendar: true,
    exceptions: true,
  });
  const [customCycleTitles, setCustomCycleTitles] = usePersistedState<Record<string, string>>(
    "periodization_cycle_titles_v1",
    {}
  );
  const [isEditingCycleTitle, setIsEditingCycleTitle] = useState(false);
  const [cycleTitleDraft, setCycleTitleDraft] = useState("");

  const [ageBand, setAgeBand] = useState<(typeof ageBands)[number]>("09-11");

  const [cycleLength, setCycleLength] = useState<(typeof cycleOptions)[number]>(DEFAULT_ANNUAL_CYCLE_LENGTH);

  const [sessionsPerWeek, setSessionsPerWeek] = useState<(typeof sessionsOptions)[number]>(2);

  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const [selectedUnit, setSelectedUnit] = useState("");

  const [selectedClassId, setSelectedClassId] = useState("");

  const [competitiveProfile, setCompetitiveProfile] = useState<ClassCompetitiveProfile | null>(
    null
  );
  const [calendarExceptions, setCalendarExceptions] = useState<ClassCalendarException[]>([]);
  const [isSavingCompetitiveProfile, setIsSavingCompetitiveProfile] = useState(false);
  const [isSavingCalendarException, setIsSavingCalendarException] = useState(false);
  const [exceptionDateInput, setExceptionDateInput] = useState("");
  const [exceptionReasonInput, setExceptionReasonInput] = useState("");
  const [competitiveTargetDateInput, setCompetitiveTargetDateInput] = useState("");
  const [competitiveCycleStartDateInput, setCompetitiveCycleStartDateInput] = useState("");

  const [allowEmptyClass, setAllowEmptyClass] = useState(false);

  const [didApplyParams, setDidApplyParams] = useState(false);

  const [unitMismatchWarning, setUnitMismatchWarning] = useState("");

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const [showDayModal, setShowDayModal] = useState(false);

  const [classPlans, setClassPlans] = useState<ClassPlan[]>([]);
  const [planningCycles, setPlanningCycles] = useState<PlanningCycle[]>([]);
  const [recentDailyLessonPlans, setRecentDailyLessonPlans] = useState<DailyLessonPlan[]>([]);
  const [recentSessionSummaries, setRecentSessionSummaries] = useState<RecentSessionSummary[]>([]);
  const [planObservabilityHistory, setPlanObservabilityHistory] = useState<PlanObservabilityRecord[]>([]);
  const [periodizationKnowledgeSnapshot, setPeriodizationKnowledgeSnapshot] =
    useState<WeeklyAutopilotKnowledgeContext | null>(null);
  const [isLoadingPeriodizationKnowledge, setIsLoadingPeriodizationKnowledge] = useState(false);

  const [isSavingPlans, setIsSavingPlans] = useState(false);

  const [showWeekEditor, setShowWeekEditor] = useState(false);
  const [agendaWeekNumber, setAgendaWeekNumber] = useState<number | null>(null);

  const {
    editor,
    setEditingWeek,
    setEditingPlanId,
    setEditPhase,
    setEditTheme,
    setEditPedagogicalRule,
    setEditTechnicalFocus,
    setEditPhysicalFocus,
    setEditConstraints,
    setEditMvFormat,
    setEditWarmupProfile,
    setEditJumpTarget,
    setEditPSETarget,
    setEditSource,
    setIsSavingWeek,
    resetWeekEditor,
  } = useWeekEditor();
  const {
    editingWeek,
    editingPlanId,
    editPhase,
    editTheme,
    editPedagogicalRule,
    editTechnicalFocus,
    editPhysicalFocus,
    editConstraints,
    editMvFormat,
    editWarmupProfile,
    editJumpTarget,
    editPSETarget,
    editSource,
    isSavingWeek,
  } = editor;

  const [cycleFilter, setCycleFilter] = useState<"all" | "manual" | "auto">("all");

  const {
    acwr,
    setAcwrRatio,
    setAcwrMessage,
    setAcwrLimitError,
    setAcwrLimits,
    setPainAlert,
    setPainAlertDates,
  } = useAcwrState();
  const { acwrRatio, acwrMessage, acwrLimitError, acwrLimits, painAlert, painAlertDates } = acwr;

  const acwrSavedRef = useRef({ high: "1.3", low: "0.8" });

  const {
    pickers,
    isPickerOpen,
    setShowUnitPicker,
    setShowClassPicker,
    setShowMesoPicker,
    setShowMicroPicker,
    setClassPickerTop,
    setUnitPickerTop,
    setClassTriggerLayout,
    setUnitTriggerLayout,
    setMesoTriggerLayout,
    setMicroTriggerLayout,
    setContainerWindow,
    closeAllPickers: closeAllPickersFromHook,
    togglePicker,
  } = usePickerLayout();
  const {
    showUnitPicker,
    showClassPicker,
    showMesoPicker,
    showMicroPicker,
    classPickerTop,
    unitPickerTop,
    classTriggerLayout,
    unitTriggerLayout,
    mesoTriggerLayout,
    microTriggerLayout,
    containerWindow,
  } = pickers;
  const [isImportingPlansFile, setIsImportingPlansFile] = useState(false);
  const [showPlanFabMenu, setShowPlanFabMenu] = useState(false);
  const planFabAnim = useRef(new Animated.Value(0)).current;

  const containerRef = useRef<View>(null);

  const classTriggerRef = useRef<View>(null);

  const unitTriggerRef = useRef<View>(null);

  const mesoTriggerRef = useRef<View>(null);

  const microTriggerRef = useRef<View>(null);
  const competitiveScrollRef = useRef<ScrollView>(null);


  const toggleSection = useCallback((key: SectionKey) => {

    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  }, [setSectionOpen]);

  const scrollToCompetitiveBlock = useCallback((key: CompetitiveBlockKey) => {
    const targetByKey: Record<CompetitiveBlockKey, number> = {
      profile: 0,
      calendar: 120,
      exceptions: 260,
    };
    setTimeout(() => {
      competitiveScrollRef.current?.scrollTo({ y: targetByKey[key], animated: true });
    }, 220);
  }, []);

  const toggleCompetitiveBlock = useCallback((key: CompetitiveBlockKey) => {
    setCompetitiveBlocksOpen((prev) => {
      const nextValue = !prev[key];
      if (nextValue) {
        scrollToCompetitiveBlock(key);
      }
      return {
        profile: false,
        calendar: false,
        exceptions: false,
        [key]: nextValue,
      };
    });
  }, [scrollToCompetitiveBlock, setCompetitiveBlocksOpen]);


  const { animatedStyle: loadAnimStyle, isVisible: showLoadContent } =

    useCollapsibleAnimation(sectionOpen.load);

  const { animatedStyle: guideAnimStyle, isVisible: showGuideContent } =

    useCollapsibleAnimation(sectionOpen.guides);

  const { animatedStyle: cycleAnimStyle, isVisible: showCycleContent } =

    useCollapsibleAnimation(sectionOpen.cycle);

  const { animatedStyle: weekAnimStyle, isVisible: showWeekContent } =

    useCollapsibleAnimation(sectionOpen.week);

  const {
    animatedStyle: competitiveProfileAnimStyle,
    isVisible: showCompetitiveProfileContent,
  } = useCollapsibleAnimation(competitiveBlocksOpen.profile);

  const {
    animatedStyle: competitiveCalendarAnimStyle,
    isVisible: showCompetitiveCalendarContent,
  } = useCollapsibleAnimation(competitiveBlocksOpen.calendar);

  const {
    animatedStyle: competitiveExceptionsAnimStyle,
    isVisible: showCompetitiveExceptionsContent,
  } = useCollapsibleAnimation(competitiveBlocksOpen.exceptions);

  const { animatedStyle: unitPickerAnimStyle, isVisible: showUnitPickerContent } =

    useCollapsibleAnimation(showUnitPicker);

  const { animatedStyle: classPickerAnimStyle, isVisible: showClassPickerContent } =

    useCollapsibleAnimation(showClassPicker);

  const { animatedStyle: mesoPickerAnimStyle, isVisible: showMesoPickerContent } =

    useCollapsibleAnimation(showMesoPicker);

  const { animatedStyle: microPickerAnimStyle, isVisible: showMicroPickerContent } =

    useCollapsibleAnimation(showMicroPicker);


  const syncPickerLayouts = useCallback(() => {

    if (!isPickerOpen) return;

    requestAnimationFrame(() => {

      if (showClassPicker) {

        classTriggerRef.current?.measureInWindow((x, y, width, height) => {

          setClassTriggerLayout({ x, y, width, height });

        });

      }

      if (showUnitPicker) {

        unitTriggerRef.current?.measureInWindow((x, y, width, height) => {

          setUnitTriggerLayout({ x, y, width, height });

        });

      }

      if (showMesoPicker) {

        mesoTriggerRef.current?.measureInWindow((x, y, width, height) => {

          setMesoTriggerLayout({ x, y, width, height });

        });

      }

      if (showMicroPicker) {

        microTriggerRef.current?.measureInWindow((x, y, width, height) => {

          setMicroTriggerLayout({ x, y, width, height });

        });

      }

      containerRef.current?.measureInWindow((x, y) => {

        setContainerWindow({ x, y });

      });

    });

  }, [

    isPickerOpen,

    showClassPicker,

    showUnitPicker,

    showMesoPicker,

    showMicroPicker,

  ]);


  const closeAllPickers = closeAllPickersFromHook;


  useEffect(() => {

    if (!showClassPicker) return;

    requestAnimationFrame(() => {

      classTriggerRef.current?.measureInWindow((x, y, width, height) => {

        setClassTriggerLayout({ x, y, width, height });

      });

    });

  }, [showClassPicker]);


  useEffect(() => {

    if (!showUnitPicker) return;

    requestAnimationFrame(() => {

      unitTriggerRef.current?.measureInWindow((x, y, width, height) => {

        setUnitTriggerLayout({ x, y, width, height });

      });

    });

  }, [showUnitPicker]);


  useEffect(() => {

    if (!showMesoPicker) return;

    requestAnimationFrame(() => {

      mesoTriggerRef.current?.measureInWindow((x, y, width, height) => {

        setMesoTriggerLayout({ x, y, width, height });

      });

    });

  }, [showMesoPicker]);


  useEffect(() => {

    if (!showMicroPicker) return;

    requestAnimationFrame(() => {

      microTriggerRef.current?.measureInWindow((x, y, width, height) => {

        setMicroTriggerLayout({ x, y, width, height });

      });

    });

  }, [showMicroPicker]);


  useEffect(() => {

    if (!showUnitPicker && !showClassPicker && !showMesoPicker && !showMicroPicker) return;

    requestAnimationFrame(() => {

      containerRef.current?.measureInWindow((x, y) => {

        setContainerWindow({ x, y });

      });

    });

  }, [showUnitPicker, showClassPicker, showMesoPicker, showMicroPicker]);


  useEffect(() => {

    let alive = true;

    (async () => {

      const data = await measureAsync(
        "screen.periodization.load.classes",
        () => getClasses(),
        { screen: "periodization" }
      );

      if (!alive) return;

      setClasses(data);

    })();

    return () => {

      alive = false;

    };

  }, []);


  useEffect(() => {
    let alive = true;
    const currentClass = classes.find((item) => item.id === selectedClassId) ?? null;
    if (!currentClass?.id) {
      setPlanningCycles([]);
      return;
    }
    (async () => {
      try {
        const year = new Date().getFullYear();
        const classStartDate = currentClass.cycleStartDate || currentClass.createdAt || null;
        await ensureActiveCycleForYear(currentClass.id, year, classStartDate);
      } catch {
        // Non-blocking; we still load the current cycle list.
      }

      const cycles = await getPlanningCycles(currentClass.id);
      if (!alive) return;
      setPlanningCycles(cycles);
    })();
    return () => { alive = false; };
  }, [classes, selectedClassId]);


  useEffect(() => {

    if (didApplyParams) return;

    if (!classes.length) return;

    const classParam = typeof initialClassId === "string" ? initialClassId : "";

    const unitParam = typeof initialUnit === "string" ? initialUnit : "";

    if (classParam) {

      const match = classes.find((item) => item.id === classParam);

      if (match) {

        if (match.unit) setSelectedUnit(match.unit);

        setSelectedClassId(match.id);

        setAllowEmptyClass(false);

        setDidApplyParams(true);

        return;

      }

      setDidApplyParams(true);

      return;

    }

    if (unitParam) {

      setSelectedUnit(unitParam);

    }

    setDidApplyParams(true);

  }, [classes, didApplyParams, initialClassId, initialUnit]);


  const unitOptions = useMemo(() => {

    const map = new Map<string, string>();

    classes.forEach((item) => {

      const label = (item.unit ?? "").trim() || "Sem unidade";

      const key = normalizeUnitKey(label);

      if (!map.has(key)) map.set(key, label);

    });

    return ["", ...Array.from(map.values()).sort((a, b) => a.localeCompare(b))];

  }, [classes]);


  const hasUnitSelected = selectedUnit.trim() !== "";


  const filteredClasses = useMemo(() => {

    const selectedKey = normalizeUnitKey(selectedUnit);

    if (!hasUnitSelected) return [];

    const list = classes.filter(

      (item) => normalizeUnitKey(item.unit) === selectedKey

    );

    return [...list].sort((a, b) => {

      const aRange = parseAgeBandRange(a.ageBand || a.name);

      const bRange = parseAgeBandRange(b.ageBand || b.name);

      if (aRange.start !== bRange.start) return aRange.start - bRange.start;

      if (aRange.end !== bRange.end) return aRange.end - bRange.end;

      return aRange.label.localeCompare(bRange.label);

    });

  }, [classes, hasUnitSelected, selectedUnit]);


  const selectedClass = useMemo(

    () => classes.find((item) => item.id === selectedClassId) ?? null,

    [classes, selectedClassId]

  );
  const periodizationKnowledgeDomain = useMemo(
    () => (selectedClass ? resolveWeeklyAutopilotKnowledgeDomain(selectedClass) : null),
    [
      selectedClass?.ageBand,
      selectedClass?.equipment,
      selectedClass?.goal,
      selectedClass?.level,
      selectedClass?.mvLevel,
    ]
  );
  const isCompetitiveMode = isCompetitivePlanningMode(competitiveProfile?.planningMode);
  const activeCycleStartDateCandidate =
    competitiveProfile?.cycleStartDate?.trim() ||
    selectedClass?.cycleStartDate ||
    formatIsoDate(new Date());

  useEffect(() => {
    let alive = true;

    if (!selectedClass || !periodizationKnowledgeDomain) {
      setPeriodizationKnowledgeSnapshot(null);
      setIsLoadingPeriodizationKnowledge(false);
      return;
    }

    setPeriodizationKnowledgeSnapshot(null);
    setIsLoadingPeriodizationKnowledge(true);

    const timer = setTimeout(() => {
      (async () => {
        try {
          const snapshot = await measureAsync(
            "screen.periodization.load.knowledgeSnapshot",
            () =>
              getKnowledgeBaseSnapshot({
                organizationId: activeOrganization?.id ?? null,
                domain: periodizationKnowledgeDomain,
              }),
            {
              screen: "periodization",
              classId: selectedClass.id,
              domain: periodizationKnowledgeDomain,
            }
          );

          if (!alive) return;

          setPeriodizationKnowledgeSnapshot(snapshot);
        } finally {
          if (alive) setIsLoadingPeriodizationKnowledge(false);
        }
      })().catch(() => {
        if (!alive) return;
        setPeriodizationKnowledgeSnapshot(null);
        setIsLoadingPeriodizationKnowledge(false);
      });
    }, 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [activeOrganization?.id, periodizationKnowledgeDomain, selectedClass]);

  const chatbotConflictBottom = Math.max(insets.bottom + 92, 108);
  const plansFabBottom = Math.max(insets.bottom + 166, 182);
  const plansFabMenuBottom = plansFabBottom + 74;
  const plansFabRight = 16;
  const plansFabPositionStyle =
    Platform.OS === "web"
      ? ({ position: "fixed", right: plansFabRight, bottom: plansFabBottom } as any)
      : { position: "absolute" as const, right: plansFabRight, bottom: plansFabBottom };
  const plansFabMenuPositionStyle =
    Platform.OS === "web"
      ? ({ position: "fixed", right: plansFabRight, bottom: plansFabMenuBottom } as any)
      : { position: "absolute" as const, right: plansFabRight, bottom: plansFabMenuBottom };

  useEffect(() => {
    Animated.timing(planFabAnim, {
      toValue: showPlanFabMenu ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [planFabAnim, showPlanFabMenu]);

  const classNameLabel = normalizeText(selectedClass?.name ?? "Turma");
  const classUnitLabel = normalizeText(
    selectedClass?.unit ?? (selectedUnit || "Selecione")
  );
  const classAgeBandLabel = normalizeText(selectedClass?.ageBand ?? "09-11");
  const classGenderLabel = selectedClass?.gender ?? "misto";
  const classStartTimeLabel = selectedClass?.startTime
    ? normalizeText(`Horário ${selectedClass.startTime}`)
    : normalizeText("Horário indefinido");
  const sportProfile = useMemo<SportProfile>(
    () => resolveSportProfile(selectedClass?.modality ?? "voleibol"),
    [selectedClass?.modality]
  );
  const sportLabel = useMemo(() => getSportLabel(sportProfile), [sportProfile]);
  const weeklySessions = useMemo(() => {
    const classDays = selectedClass?.daysOfWeek?.length ?? 0;
    return Math.max(1, classDays || sessionsPerWeek || 2);
  }, [selectedClass, sessionsPerWeek]);

  const activeCycle = useMemo(
    () => planningCycles.find((c) => c.status === "active") ?? null,
    [planningCycles]
  );
  const effectiveCycleLength = useMemo(() => {
    const cycleStart = parseIsoDate(activeCycle?.startDate ?? null);
    const cycleEnd = parseIsoDate(activeCycle?.endDate ?? null);

    if (!cycleStart || !cycleEnd) return cycleLength;

    const startUtc = Date.UTC(
      cycleStart.getFullYear(),
      cycleStart.getMonth(),
      cycleStart.getDate()
    );
    const endUtc = Date.UTC(
      cycleEnd.getFullYear(),
      cycleEnd.getMonth(),
      cycleEnd.getDate()
    );

    if (endUtc < startUtc) return cycleLength;

    const daysInclusive = Math.floor((endUtc - startUtc) / (24 * 60 * 60 * 1000)) + 1;
    const weeks = Math.round(daysInclusive / 7);
    return Math.max(1, Math.min(52, weeks));
  }, [activeCycle?.endDate, activeCycle?.startDate, cycleLength]);

  const visibleClassPlans = useMemo(
    () => getPlansWithinCycle(classPlans, effectiveCycleLength),
    [classPlans, effectiveCycleLength]
  );

  const activeCycleStartDate =
    activeCycle?.startDate?.trim() ||
    activeCycleStartDateCandidate;
  const historyCycles = useMemo(
    () => planningCycles.filter((c) => c.status === "archived"),
    [planningCycles]
  );

  const weekSessions = useMemo(() => {
    if (!editingWeek || !selectedClass || !activeCycleStartDate) return [];
    const existingPlan = visibleClassPlans.find((p) => p.weekNumber === editingWeek);
    const planStartDate = existingPlan?.startDate ?? (() => {
      const base = new Date(`${activeCycleStartDate}T00:00:00`);
      base.setDate(base.getDate() + (editingWeek - 1) * 7);
      const y = base.getFullYear();
      const m = String(base.getMonth() + 1).padStart(2, "0");
      const d = String(base.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();
    return buildWeekSessionPreview({
      startDate: planStartDate,
      daysOfWeek: selectedClass.daysOfWeek ?? [],
      weeklySessions,
    });
  }, [activeCycleStartDate, editingWeek, selectedClass, visibleClassPlans, weeklySessions]);

  const periodizationKnowledgeGraph = useMemo(() => {
    if (!selectedClass || !periodizationKnowledgeSnapshot) return null;
    return toPlanningGraphFromClassPlans({
      classId: selectedClass.id,
      organizationId: selectedClass.organizationId,
      cycleStartDate: activeCycleStartDate,
      classPlans: visibleClassPlans,
      knowledgeSnapshot: periodizationKnowledgeSnapshot,
    });
  }, [
    activeCycleStartDate,
    visibleClassPlans,
    periodizationKnowledgeSnapshot,
    selectedClass,
  ]);

  const periodizationKnowledgeBaselineGraph = useMemo(() => {
    if (!selectedClass) return null;
    return toPlanningGraphFromClassPlans({
      classId: selectedClass.id,
      organizationId: selectedClass.organizationId,
      cycleStartDate: activeCycleStartDate,
      classPlans: visibleClassPlans,
      knowledgeSnapshot: null,
    });
  }, [activeCycleStartDate, selectedClass, visibleClassPlans]);

  const periodizationPlanReview = useMemo(() => {
    if (!periodizationKnowledgeGraph || !periodizationKnowledgeSnapshot || !periodizationKnowledgeBaselineGraph) {
      return null;
    }

    const review = buildPlanReviewSummary(periodizationKnowledgeGraph, periodizationKnowledgeSnapshot);
    const diffs = periodizationKnowledgeGraph.weeks
      .map((week, index) => {
        const baselineWeek = periodizationKnowledgeBaselineGraph.weeks[index];
        if (!baselineWeek) return null;
        const diff = buildPlanDiff(baselineWeek, week);
        return diff.changes.length > 0 ? diff : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 3);

    return {
      ...review,
      diffs,
      warnings: review.issues
        .filter((issue) => issue.severity !== "info")
        .map((issue) => issue.message),
    };
  }, [
    periodizationKnowledgeBaselineGraph,
    periodizationKnowledgeGraph,
    periodizationKnowledgeSnapshot,
  ]);

  const periodizationModel = useMemo<PeriodizationModel>(() => {
    if (isCompetitiveMode) return "competitivo";
    if (ageBand === "12-14") return "formacao";
    return "iniciacao";
  }, [ageBand, isCompetitiveMode]);
  const baseCyclePanelTitle = useMemo(() => {
    if (periodizationModel === "iniciacao") {
      return `Macrociclo — Desenvolvimento motor da ${classNameLabel}`;
    }
    if (periodizationModel === "formacao") {
      return `Macrociclo — Formação técnico-tática da ${classNameLabel}`;
    }
    const target = normalizeText(competitiveProfile?.targetCompetition ?? "").trim();
    if (target) return `Macrociclo — Preparação para ${target}`;
    return `Macrociclo — Preparação competitiva de ${sportLabel} da ${classNameLabel}`;
  }, [classNameLabel, competitiveProfile?.targetCompetition, periodizationModel, sportLabel]);
  const cyclePanelTitle = useMemo(() => {
    const custom = selectedClassId ? normalizeText(customCycleTitles[selectedClassId] ?? "").trim() : "";
    return custom || baseCyclePanelTitle;
  }, [baseCyclePanelTitle, customCycleTitles, selectedClassId]);

  const openCycleTitleEditor = useCallback(() => {
    if (!selectedClassId) return;
    setCycleTitleDraft(cyclePanelTitle);
    setIsEditingCycleTitle(true);
  }, [cyclePanelTitle, selectedClassId]);

  const cancelCycleTitleEditor = useCallback(() => {
    setCycleTitleDraft(cyclePanelTitle);
    setIsEditingCycleTitle(false);
  }, [cyclePanelTitle]);

  const saveCycleTitleEditor = useCallback(() => {
    if (!selectedClassId) {
      setIsEditingCycleTitle(false);
      return;
    }
    const next = normalizeText(cycleTitleDraft).trim();
    setCustomCycleTitles((prev) => {
      const copy = { ...prev };
      if (!next || next === baseCyclePanelTitle) {
        delete copy[selectedClassId];
      } else {
        copy[selectedClassId] = next;
      }
      return copy;
    });
    setIsEditingCycleTitle(false);
  }, [baseCyclePanelTitle, cycleTitleDraft, selectedClassId, setCustomCycleTitles]);

  useEffect(() => {
    if (!selectedClassId) {
      setCompetitiveProfile(null);
      setCalendarExceptions([]);
      setExceptionDateInput("");
      setExceptionReasonInput("");
      setCompetitiveTargetDateInput("");
      setCompetitiveCycleStartDateInput("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [profile, exceptions] = await Promise.all([
          getClassCompetitiveProfile(selectedClassId, {
            organizationId: activeOrganization?.id ?? null,
          }),
          getClassCalendarExceptions(selectedClassId, {
            organizationId: activeOrganization?.id ?? null,
          }),
        ]);
        if (cancelled) return;
        setCompetitiveProfile(profile);
        setCalendarExceptions(exceptions);
        setExceptionDateInput("");
        setExceptionReasonInput("");
      } catch (error) {
        if (cancelled) return;
        setCompetitiveProfile(null);
        setCalendarExceptions([]);
        logAction("periodization_competitive_load_failed", {
          classId: selectedClassId,
          organizationId: activeOrganization?.id ?? null,
          error: String(error),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeOrganization?.id, selectedClassId]);

  useEffect(() => {
    if (!selectedClass) {
      setCompetitiveTargetDateInput("");
      setCompetitiveCycleStartDateInput("");
      return;
    }

    setCompetitiveTargetDateInput(formatDateForInput(competitiveProfile?.targetDate ?? ""));
    setCompetitiveCycleStartDateInput(
      formatDateForInput(
        competitiveProfile?.cycleStartDate ?? selectedClass.cycleStartDate ?? formatIsoDate(new Date())
      )
    );
  }, [competitiveProfile?.cycleStartDate, competitiveProfile?.targetDate, selectedClass]);

  useEffect(() => {
    if (!selectedClass) {
      setRecentSessionSummaries([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [plans, sessionEvidence, sessionLogs] = await Promise.all([
          getTrainingPlans({
            organizationId: selectedClass.organizationId ?? activeOrganization?.id ?? null,
            classId: selectedClass.id,
            status: "final",
            orderBy: "createdat_desc",
            limit: 24,
          }),
          getTrainingSessionEvidenceByClass(selectedClass.id, {
            organizationId: selectedClass.organizationId ?? activeOrganization?.id ?? null,
          }),
          getSessionLogsByClass(selectedClass.id, {
            organizationId: selectedClass.organizationId ?? activeOrganization?.id ?? null,
            limit: 24,
          }),
        ]);

        if (cancelled) return;

        setRecentSessionSummaries(
          buildRecentSessionSummary({
            classId: selectedClass.id,
            plans,
            sessions: sessionEvidence.sessions,
            attendance: sessionEvidence.attendance,
            sessionLogs,
            limit: 6,
          })
        );
      } catch (error) {
        if (cancelled) return;
        setRecentSessionSummaries([]);
        logAction("periodization_recent_history_load_failed", {
          classId: selectedClass.id,
          organizationId: selectedClass.organizationId ?? activeOrganization?.id ?? null,
          error: String(error),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeOrganization?.id, selectedClass]);

  useEffect(() => {

    if (hasInitialClass) return;

    if (!hasUnitSelected) {

      setSelectedClassId("");

      return;

    }

    if (!filteredClasses.length) {

      setSelectedClassId("");

      return;

    }

    if (allowEmptyClass && !selectedClassId) {

      return;

    }

    if (selectedClassId && filteredClasses.some((item) => item.id === selectedClassId)) {

      return;

    }

    setSelectedClassId(filteredClasses[0].id);

  }, [allowEmptyClass, filteredClasses, hasUnitSelected, selectedClassId]);


  useEffect(() => {

    if (!hasUnitSelected) {

      setUnitMismatchWarning("");

      return;

    }

    if (

      selectedClass &&

      normalizeUnitKey(selectedClass.unit) !== normalizeUnitKey(selectedUnit)

    ) {

      setSelectedClassId("");

      setUnitMismatchWarning(

        "A turma selecionada pertence a outra unidade. Selecione uma turma desta unidade."

      );

      return;

    }

    setUnitMismatchWarning("");

  }, [hasUnitSelected, selectedClass, selectedUnit]);


  useEffect(() => {

    if (!selectedClass) return;

    const next = resolvePlanBand(normalizeAgeBand(selectedClass.ageBand));

    setAgeBand(next);

    if (typeof selectedClass.cycleLengthWeeks === "number") {

      const cycleValue = selectedClass.cycleLengthWeeks as (typeof cycleOptions)[number];

      if (annualCycleOptions.includes(cycleValue as (typeof annualCycleOptions)[number])) {

        setCycleLength(cycleValue);

      } else {

        setCycleLength(DEFAULT_ANNUAL_CYCLE_LENGTH);

      }

    } else {

      setCycleLength(DEFAULT_ANNUAL_CYCLE_LENGTH);

    }

    if (selectedClass.daysOfWeek.length) {

      const nextSessions =

        selectedClass.daysOfWeek.length as (typeof sessionsOptions)[number];

      if (sessionsOptions.includes(nextSessions)) {

        setSessionsPerWeek(nextSessions);

      }

    }

  }, [selectedClass]);


  useEffect(() => {

    if (!selectedClass) {

      setAcwrLimits({ high: "1.3", low: "0.8" });

      acwrSavedRef.current = { high: "1.3", low: "0.8" };

      return;

    }

    const nextHigh =

      typeof selectedClass.acwrHigh === "number"
      ? String(selectedClass.acwrHigh)

        : "1.3";

    const nextLow =

      typeof selectedClass.acwrLow === "number" ? String(selectedClass.acwrLow) : "0.8";

    const next = { high: nextHigh, low: nextLow };

    setAcwrLimits(next);

    acwrSavedRef.current = next;

  }, [selectedClass]);


  useEffect(() => {

    const validation = validateAcwrLimits(acwrLimits);

    setAcwrLimitError(validation.ok ? "" : validation.message);

  }, [acwrLimits.high, acwrLimits.low]);


  const persistAcwrLimits = useCallback(

    async (next: { high: string; low: string }) => {

      if (!selectedClassId) return;

      const validation = validateAcwrLimits(next);

      if (!validation.ok) return;

      const { highValue, lowValue } = validation;

      if (

        acwrSavedRef.current.high === next.high &&

        acwrSavedRef.current.low === next.low

      ) {

        return;

      }

      try {

        await updateClassAcwrLimits(selectedClassId, {

          high: highValue,

          low: lowValue,

        });

        acwrSavedRef.current = { high: next.high, low: next.low };

        setClasses((prev) =>

          prev.map((item) =>

            item.id === selectedClassId
            ? { ...item, acwrHigh: highValue, acwrLow: lowValue }
            : item

          )

        );

      } catch (error) {

        logAction("acwr_limits_save_failed", {

          classId: selectedClassId,

          high: next.high,

          low: next.low,

        });

      }

    },

    [selectedClassId]

  );


  useEffect(() => {

    if (!selectedClassId) return;

    const handle = setTimeout(() => {

      void persistAcwrLimits(acwrLimits);

    }, 600);

    return () => clearTimeout(handle);

  }, [acwrLimits.high, acwrLimits.low, persistAcwrLimits, selectedClassId]);


  useClassPlansLoader({
    selectedClassId,
    selectedClass,
    activeCycle,
    activeCycleYear: activeCycle?.year ?? (Number(activeCycleStartDate.slice(0, 4)) || null),
    acwrLimits,
    setClassPlans,
    setCycleLength,
    setAcwrRatio,
    setAcwrMessage,
    setPainAlert,
    setPainAlertDates,
  });


  const competitivePreviewPlans = useMemo(() => {
    if (!selectedClass || !isCompetitiveMode) return [];
    return toCompetitiveClassPlans({
      classId: selectedClass.id,
      cycleLength: effectiveCycleLength,
      cycleStartDate: activeCycleStartDate,
      daysOfWeek: selectedClass.daysOfWeek,
      exceptions: calendarExceptions,
      profile: {
        planningMode: "adulto-competitivo",
        targetCompetition: competitiveProfile?.targetCompetition ?? "",
        tacticalSystem: competitiveProfile?.tacticalSystem ?? "5x1",
      },
    });
  }, [
    activeCycleStartDate,
    calendarExceptions,
    competitiveProfile?.targetCompetition,
    competitiveProfile?.tacticalSystem,
    effectiveCycleLength,
    isCompetitiveMode,
    selectedClass,
  ]);

  const weekPlans = useWeekPlans({
    activeCycleStartDate,
    ageBand,
    calendarExceptions,
    classPlans,
    competitivePreviewPlans,
    cycleLength: effectiveCycleLength,
    isCompetitiveMode,
    periodizationModel,
    sportProfile,
    selectedClass,
    weeklySessions,
  });

  const visibleCompetitivePreviewPlans = useMemo(
    () => getPlansWithinCycle(competitivePreviewPlans, effectiveCycleLength),
    [competitivePreviewPlans, effectiveCycleLength]
  );

  const hasWeekPlans = visibleClassPlans.length > 0;
  const displayedCyclePanelTitle = hasWeekPlans
    ? cyclePanelTitle
    : normalizeText("Painel do ciclo");


  const filteredWeekPlans = useMemo(() => {

    if (!hasWeekPlans) return [];

    if (cycleFilter === "all") return weekPlans;

    const target = cycleFilter === "manual" ? "MANUAL" : "AUTO";

    return weekPlans.filter((week) => week.source === target);

  }, [cycleFilter, hasWeekPlans, weekPlans]);


  const periodizationRows = useMemo(() => {
    if (!selectedClass) return [];

    const sourcePlans = visibleClassPlans.length ? visibleClassPlans : visibleCompetitivePreviewPlans;
    const sourcePlansByWeek = new Map(sourcePlans.map((plan) => [plan.weekNumber, plan]));

    return weekPlans.map((week) => {
      const plan = sourcePlansByWeek.get(week.week);

      if (plan) {
        const meta = isCompetitiveMode
          ? buildCompetitiveWeekMeta({
              weekNumber: week.week,
              cycleStartDate: activeCycleStartDate,
              daysOfWeek: selectedClass.daysOfWeek,
              exceptions: calendarExceptions,
            })
          : null;

        return {
          week: week.week,
          dateRange: meta?.dateRangeLabel ?? week.dateRange ?? "",
          sessionDates: meta?.sessionDatesLabel ?? week.sessionDatesLabel ?? "",
          phase: normalizeText(plan.phase),
          theme: normalizeText(plan.theme),
          technicalFocus: normalizeText(plan.technicalFocus),
          physicalFocus: normalizeText(plan.physicalFocus),
          constraints: normalizeText(plan.constraints),
          mvFormat: normalizeText(plan.mvFormat),
          jumpTarget: normalizeText(plan.jumpTarget),
          rpeTarget: normalizeText(plan.rpeTarget),
          source: plan.source,
        };
      }

      return {
        week: week.week,
        dateRange: week.dateRange ?? "",
        sessionDates: week.sessionDatesLabel ?? "",
        phase: normalizeText(week.title),
        theme: normalizeText(week.focus),
        technicalFocus: normalizeText(week.focus),
        physicalFocus: normalizeText(getPhysicalFocus(ageBand)),
        constraints: normalizeText(week.notes.join(" | ")),
        mvFormat: normalizeText(getMvFormat(ageBand)),
        jumpTarget: normalizeText(week.jumpTarget),
        rpeTarget: normalizeText(week.PSETarget),
        source: week.source,
      };
    });
  }, [
    activeCycleStartDate,
    ageBand,
    calendarExceptions,
    isCompetitiveMode,
    selectedClass,
    visibleClassPlans,
    visibleCompetitivePreviewPlans,
    weekPlans,
  ]);

  const hasPeriodizationRows = periodizationRows.length > 0;
  const canExportPlans = Boolean(selectedClass) && hasPeriodizationRows && hasWeekPlans;


  const summary = useMemo(() => {
    if (isCompetitiveMode) {
      return [
        "Planejamento competitivo por turma com datas reais",
        `Sistema tatico: ${competitiveProfile?.tacticalSystem?.trim() || "5x1"}`,
        competitiveProfile?.targetCompetition?.trim()
          ? `Competicao-alvo: ${competitiveProfile.targetCompetition.trim()}`
          : "Sem competicao-alvo definida",
      ];
    }

    if (ageBand === "06-08") {

      return [

        "Foco em alfabetização motora e jogo",

        "Sessões curtas e lúdicas",

        "Sem cargas externas",

      ];

    }

    if (ageBand === "09-11") {

      return [

        "Fundamentos + tomada de decisão",

        "Controle de volume e saltos",

        "Aquecimento preventivo simples",

      ];

    }

    return [

      "Técnica eficiente + sistema de jogo",

      "Força moderada e pliometria controlada",

      "Monitorar PSE e recuperação",

    ];

  }, [ageBand, competitiveProfile?.targetCompetition, competitiveProfile?.tacticalSystem, isCompetitiveMode]);


  const progressBars = weekPlans.map((week) => volumeToRatio[week.volume]);

  const {
    currentWeek,
    currentClassPlanForContext,
    currentWeekPlanForContext,
    periodizationContext,
  } = useMemo(
    () =>
      resolvePeriodizationScreenContext({
        activeCycleStartDate,
        visibleClassPlans,
        weekPlans,
        competitiveProfile,
        periodizationModel,
        ageBand,
        selectedClassGoal: selectedClass?.goal ?? null,
        normalizeText,
        parsePseTarget,
      }),
    [
      activeCycleStartDate,
      ageBand,
      competitiveProfile,
      periodizationModel,
      selectedClass?.goal,
      visibleClassPlans,
      weekPlans,
    ]
  );

  const cyclePanelCellWidth = 64;
  const cyclePanelCellGap = 6;
  const cyclePanelLabelWidth = 100;
  const cyclePanelRowHeight = 32;
  const cyclePanelRowGap = 5;

  const cyclePanelScrollRef = useRef<ScrollView>(null);
  const weekSwitchOpacity = useRef(new Animated.Value(1)).current;
  const weekSwitchTranslateX = useRef(new Animated.Value(0)).current;
  const weekSwitchDirectionRef = useRef<-1 | 1>(1);
  const shouldRealignCurrentWeekRef = useRef(false);

  const monthSegments = useMemo(() => {
    return buildMonthSegments({
      weekCount: weekPlans.length,
      cycleStartDate: activeCycleStartDate || visibleClassPlans[0]?.startDate || null,
      plans: visibleClassPlans,
    });
  }, [activeCycleStartDate, visibleClassPlans, weekPlans.length]);

  const macroSegments = useMemo(() => {
    if (!weekPlans.length) return [] as Array<{ label: string; length: number }>;
    const lengths = splitSegmentLengths(weekPlans.length, 3);
    if (periodizationModel === "iniciacao") {
      return [
        { label: normalizeText("Período de Exploração Motora"), length: lengths[0] ?? 1 },
        { label: normalizeText("Período de Fundamentos Básicos"), length: lengths[1] ?? 1 },
        { label: normalizeText("Período de Consolidação Lúdica"), length: lengths[2] ?? 1 },
      ];
    }
    if (periodizationModel === "formacao") {
      return [
        { label: normalizeText("Período de Base Técnica"), length: lengths[0] ?? 1 },
        { label: normalizeText("Período de Desenvolvimento Técnico"), length: lengths[1] ?? 1 },
        { label: normalizeText("Período de Integração de Jogo"), length: lengths[2] ?? 1 },
      ];
    }
    return [
      { label: normalizeText("Período Preparatório Geral"), length: lengths[0] ?? 1 },
      { label: normalizeText("Período Preparatório Específico"), length: lengths[1] ?? 1 },
      { label: normalizeText("Período Competitivo"), length: lengths[2] ?? 1 },
    ];
  }, [periodizationModel, weekPlans.length]);

  const mesoSegments = useMemo(() => {
    if (!weekPlans.length) return [] as Array<{ label: string; length: number }>;
    const desiredBlocks = Math.min(4, Math.max(2, Math.ceil(weekPlans.length / 4)));
    const baseSize = Math.floor(weekPlans.length / desiredBlocks);
    let remainder = weekPlans.length % desiredBlocks;
    const segments: Array<{ label: string; length: number }> = [];

    for (let i = 0; i < desiredBlocks; i += 1) {
      const extra = remainder > 0 ? 1 : 0;
      remainder = Math.max(0, remainder - 1);
      const length = Math.max(1, baseSize + extra);
      segments.push({ label: `Meso ${i + 1}`, length });
    }

    return segments;
  }, [weekPlans.length]);

  const monthWeekNumbers = useMemo(() => {
    return buildMonthWeekNumbers({
      weekCount: weekPlans.length,
      cycleStartDate: activeCycleStartDate || visibleClassPlans[0]?.startDate || null,
      plans: visibleClassPlans,
    });
  }, [activeCycleStartDate, visibleClassPlans, weekPlans.length]);

  const dominantBlockSegments = useMemo(() => {
    if (!weekPlans.length) return [] as Array<{ label: string; length: number }>;

    if (periodizationModel === "iniciacao") {
      const lengths = splitSegmentLengths(weekPlans.length, 4);
      return [
        { label: normalizeText("Exploração motora"), length: lengths[0] ?? 1 },
        { label: normalizeText("Fundamentos básicos"), length: lengths[1] ?? 1 },
        { label: normalizeText("Jogos reduzidos"), length: lengths[2] ?? 1 },
        { label: normalizeText("Consolidação"), length: lengths[3] ?? 1 },
      ].filter((seg) => seg.length > 0);
    }

    if (periodizationModel === "formacao") {
      const lengths = splitSegmentLengths(weekPlans.length, 3);
      return [
        { label: normalizeText("Base técnica"), length: lengths[0] ?? 1 },
        { label: normalizeText("Desenvolvimento técnico"), length: lengths[1] ?? 1 },
        { label: normalizeText("Integração tática"), length: lengths[2] ?? 1 },
      ].filter((seg) => seg.length > 0);
    }

    const prepGeneral = macroSegments[0]?.length ?? 0;
    const prepSpecific = macroSegments[1]?.length ?? 0;
    const competitive = macroSegments[2]?.length ?? 0;

    const specificDev = Math.max(1, Math.round(prepSpecific * 0.5));
    const specificPower = Math.max(1, prepSpecific - specificDev);
    const compPre = Math.max(1, Math.round(competitive * 0.65));
    const compMain = Math.max(1, competitive - compPre);

    return [
      { label: normalizeText("Base estrutural"), length: Math.max(1, prepGeneral) },
      { label: normalizeText("Desenvolvimento"), length: specificDev },
      { label: normalizeText("Potência específica"), length: specificPower },
      { label: normalizeText("Pré-competitivo"), length: compPre },
      { label: normalizeText("Competitivo"), length: compMain },
    ].filter((seg) => seg.length > 0);
  }, [macroSegments, periodizationModel, weekPlans.length]);

  const periodizationCopilotSnapshot = useMemo(() => {
    const classLabel = normalizeText(selectedClass?.name ?? "Turma ativa");
    const periodSummary = macroSegments
      .map((seg) => `${seg.label} (${seg.length} sem)`)
      .join(" | ");
    const dominantSummary = dominantBlockSegments
      .map((seg) => `${seg.label} (${seg.length} sem)`)
      .join(" | ");
    const nextWeek = weekPlans.find((week) => week.week >= currentWeek) ?? weekPlans[weekPlans.length - 1];
    const nextDemand = nextWeek
      ? `${getDemandIndexForModel(nextWeek.volume, periodizationModel, weeklySessions, sportProfile)}/10`
      : "sem dados";
    const durationMinutes = Math.max(15, Number(selectedClass?.durationMinutes ?? 60));

    return {
      classLabel,
      model: periodizationModel,
      sport: sportProfile,
      sportLabel,
      durationMinutes,
      periodSummary,
      dominantSummary,
      weeks: weekPlans.length,
      currentWeek,
      nextWeekLabel: nextWeek ? `Semana ${nextWeek.week}` : "sem semana ativa",
      nextDemand,
      nextPse: nextWeek ? normalizeText(nextWeek.PSETarget) : "sem meta",
      nextPlannedLoad: nextWeek ? formatPlannedLoad(nextWeek.plannedWeeklyLoad) : "sem carga",
      nextLoad: nextWeek ? getLoadLabelForModel(nextWeek.volume, periodizationModel) : "Baixa",
      periodizationContext: {
        ...periodizationContext,
        constraints: periodizationContext.constraints ?? [],
      },
    };
  }, [
    currentWeek,
    dominantBlockSegments,
    macroSegments,
    periodizationModel,
    periodizationContext,
    selectedClass?.durationMinutes,
    selectedClass?.name,
    sportLabel,
    sportProfile,
    weekPlans,
    weeklySessions,
  ]);

  const periodizationCopilotActions = usePeriodizationCopilotActions({
    periodizationCopilotSnapshot,
    weekPlansLength: weekPlans.length,
  });

  useCopilotActions(periodizationCopilotActions);

  const scrollCyclePanelToWeek = useCallback(
    (weekNumber: number, animated = true) => {
      if (!hasWeekPlans) return;
      const clampedWeek = Math.max(1, Math.min(weekNumber, weekPlans.length));
      const scrollToX = Math.max(
        0,
        (clampedWeek - 1) * (cyclePanelCellWidth + cyclePanelCellGap)
      );
      cyclePanelScrollRef.current?.scrollTo({ x: scrollToX, animated });
    },
    [
      cyclePanelCellGap,
      cyclePanelCellWidth,
      hasWeekPlans,
      weekPlans.length,
    ]
  );

  const focusedWeekNumber = hasWeekPlans
    ? Math.max(1, Math.min(agendaWeekNumber ?? currentWeek, weekPlans.length))
    : currentWeek;

  useEffect(() => {
    if (!hasWeekPlans) return;
    const timer = setTimeout(() => {
      scrollCyclePanelToWeek(focusedWeekNumber, false);
    }, 180);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek, hasWeekPlans, scrollCyclePanelToWeek]);

  useFocusEffect(
    useCallback(() => {
      if (!hasWeekPlans) return undefined;

      const fallbackWeek = Math.max(1, Math.min(currentWeek, weekPlans.length));
      setAgendaWeekNumber(fallbackWeek);
      shouldRealignCurrentWeekRef.current = true;

      const timer = setTimeout(() => {
        scrollCyclePanelToWeek(fallbackWeek, false);
      }, 180);

      return () => clearTimeout(timer);
    }, [currentWeek, hasWeekPlans, scrollCyclePanelToWeek, weekPlans.length])
  );

  useEffect(() => {
    if (!hasWeekPlans || activeTab !== "ciclo" || !shouldRealignCurrentWeekRef.current) return;

    const fallbackWeek = Math.max(1, Math.min(agendaWeekNumber ?? currentWeek, weekPlans.length));
    let innerTimer: ReturnType<typeof setTimeout> | null = null;

    const outerTimer = setTimeout(() => {
      innerTimer = setTimeout(() => {
        scrollCyclePanelToWeek(fallbackWeek, false);
        shouldRealignCurrentWeekRef.current = false;
      }, 60);
    }, 0);

    return () => {
      clearTimeout(outerTimer);
      if (innerTimer) clearTimeout(innerTimer);
    };
  }, [activeTab, agendaWeekNumber, currentWeek, hasWeekPlans, scrollCyclePanelToWeek, weekPlans.length]);

  useEffect(() => {
    if (!hasWeekPlans || activeTab !== "semana") return;
    const fallbackWeek = Math.max(1, Math.min(currentWeek, weekPlans.length));
    setAgendaWeekNumber((prev) => {
      if (prev == null) return fallbackWeek;
      return Math.max(1, Math.min(prev, weekPlans.length));
    });
  }, [activeTab, currentWeek, hasWeekPlans, weekPlans.length]);

  const activeWeekIndex = hasWeekPlans
    ? Math.max(
        0,
        Math.min(
          (agendaWeekNumber ?? currentWeek) - 1,
          weekPlans.length - 1
        )
      )
    : 0;

  const activeWeek = hasWeekPlans ? weekPlans[activeWeekIndex] : emptyWeek;
  const activeClassPlan = hasWeekPlans
    ? visibleClassPlans.find((plan) => plan.weekNumber === activeWeek.week) ?? null
    : null;

  const resolveSegmentLabelForWeek = useCallback(
    (segments: Array<{ label: string; length: number }>, weekNumber: number) => {
      let cursor = 0;
      for (const segment of segments) {
        cursor += segment.length;
        if (weekNumber <= cursor) return segment.label;
      }
      return segments[segments.length - 1]?.label ?? "";
    },
    []
  );

  const activeMacroLabel = hasWeekPlans
    ? resolveSegmentLabelForWeek(macroSegments, activeWeek.week)
    : "";
  const activeMesoLabel = hasWeekPlans
    ? resolveSegmentLabelForWeek(mesoSegments, activeWeek.week)
    : "";
  const activeDominantBlockLabel = hasWeekPlans
    ? resolveSegmentLabelForWeek(dominantBlockSegments, activeWeek.week)
    : "";

  useEffect(() => {
    if (!hasWeekPlans) {
      setAgendaWeekNumber(null);
      return;
    }

    const fallbackWeek = Math.max(1, Math.min(currentWeek, weekPlans.length));
    setAgendaWeekNumber((prev) => {
      if (prev == null) return fallbackWeek;
      return Math.max(1, Math.min(prev, weekPlans.length));
    });
  }, [currentWeek, hasWeekPlans, weekPlans.length]);

  useEffect(() => {
    setSelectedDayIndex(null);
  }, [activeWeek.week]);

  useEffect(() => {
    if (!hasWeekPlans) return;
    weekSwitchOpacity.setValue(0.65);
    weekSwitchTranslateX.setValue(weekSwitchDirectionRef.current * 12);
    Animated.parallel([
      Animated.timing(weekSwitchOpacity, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(weekSwitchTranslateX, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeWeek.week, hasWeekPlans, weekSwitchOpacity, weekSwitchTranslateX]);

  const goToPreviousAgendaWeek = useCallback(() => {
    weekSwitchDirectionRef.current = -1;
    setAgendaWeekNumber((prev) => {
      if (!hasWeekPlans) return prev;
      const current = prev ?? currentWeek;
      return Math.max(1, current - 1);
    });
  }, [currentWeek, hasWeekPlans]);

  const goToNextAgendaWeek = useCallback(() => {
    weekSwitchDirectionRef.current = 1;
    setAgendaWeekNumber((prev) => {
      if (!hasWeekPlans) return prev;
      const current = prev ?? currentWeek;
      return Math.min(weekPlans.length, current + 1);
    });
  }, [currentWeek, hasWeekPlans, weekPlans.length]);

  const goToWeek = useCallback(
    (weekNumber: number) => {
      weekSwitchDirectionRef.current = 0;
      setAgendaWeekNumber(Math.max(1, Math.min(weekPlans.length, weekNumber)));
    },
    [weekPlans.length]
  );


  // Removido: criação automática de semanas ao entrar na tela.


  const highLoadStreak = useMemo(() => {

    let streak = 0;

    for (let i = 0; i < weekPlans.length; i += 1) {

      if (weekPlans[i].volume === "alto") {

        streak += 1;

      } else {

        streak = 0;

      }

      if (streak >= 2) return true;

    }

    return false;

  }, [weekPlans]);


  const warningMessage = useMemo(() => {

    if (highLoadStreak) {

      return "Duas semanas seguidas em carga alta. Considere uma semana de recuperação.";

    }

    if (activeWeek.volume === "alto") {

      return "Semana atual com carga alta. Monitore recuperação e PSE.";

    }

    return "";

  }, [highLoadStreak, activeWeek.volume]);


  const openWeekEditor = useCallback((weekNumber: number) => {

    if (!selectedClass) return;

    setAgendaWeekNumber(weekNumber);

    const existing = visibleClassPlans.find((plan) => plan.weekNumber === weekNumber);
    const plan: ClassPlan =
      existing ??
      (isCompetitiveMode
        ? buildCompetitiveClassPlan({
            classId: selectedClass.id,
            weekNumber,
            cycleLength: effectiveCycleLength,
            cycleStartDate: activeCycleStartDate,
            daysOfWeek: selectedClass.daysOfWeek ?? [],
            exceptions: calendarExceptions,
            profile: competitiveProfile,
            source: "AUTO",
          })
        : buildClassPlan({
            classId: selectedClass.id,
            ageBand,
            startDate: activeCycleStartDate,
            weekNumber,
            source: "AUTO",
            mvLevel: selectedClass.mvLevel,
            cycleLength: effectiveCycleLength,
            model: periodizationModel,
            sessionsPerWeek: weeklySessions,
            sport: sportProfile,
          }));

    setEditingWeek(weekNumber);

    setEditingPlanId(existing?.id ?? null);

    setEditPhase(normalizeText(plan.phase));

    setEditTheme(normalizeText(plan.theme));

    setEditPedagogicalRule(normalizeText(plan.pedagogicalRule ?? ""));

    setEditTechnicalFocus(normalizeText(plan.technicalFocus));

    setEditPhysicalFocus(normalizeText(plan.physicalFocus));

    setEditConstraints(normalizeText(plan.constraints));

    setEditMvFormat(plan.mvFormat);

    setEditWarmupProfile(normalizeText(plan.warmupProfile));

    setEditJumpTarget(normalizeText(plan.jumpTarget));

    setEditPSETarget(normalizeText(plan.rpeTarget));

    setEditSource(existing ? plan.source : "AUTO");

    setShowWeekEditor(true);

  }, [
    activeCycleStartDate,
    ageBand,
    calendarExceptions,
    competitiveProfile,
    effectiveCycleLength,
    isCompetitiveMode,
    periodizationModel,
    sportProfile,
    selectedClass,
    visibleClassPlans,
    weeklySessions,
  ]);


  const buildManualPlanForWeek = useCallback(

    (weekNumber: number, existing: ClassPlan | null): ClassPlan | null => {

      if (!selectedClass) return null;

      const autoPlan = isCompetitiveMode
        ? buildCompetitiveClassPlan({
            classId: selectedClass.id,
            weekNumber,
            cycleLength: effectiveCycleLength,
            cycleStartDate: activeCycleStartDate,
            daysOfWeek: selectedClass.daysOfWeek ?? [],
            exceptions: calendarExceptions,
            profile: competitiveProfile,
            source: existing?.source === "MANUAL" ? "MANUAL" : "AUTO",
            existingId: existing?.id,
            existingCreatedAt: existing?.createdAt,
          })
        : buildClassPlan({
            classId: selectedClass.id,
            ageBand,
            startDate: activeCycleStartDate,
            weekNumber,
            source: existing?.source === "MANUAL" ? "MANUAL" : "AUTO",
            mvLevel: selectedClass.mvLevel,
            cycleLength: effectiveCycleLength,
            model: periodizationModel,
            sessionsPerWeek: weeklySessions,
            sport: sportProfile,
          });

      const nowIso = new Date().toISOString();

      return {
        id: existing?.id ?? `cp_${selectedClass.id}_${Date.now()}_${weekNumber}`,

        classId: selectedClass.id,

        startDate: autoPlan.startDate,

        weekNumber,

        phase: editPhase.trim() || autoPlan.phase,

        theme: editTheme.trim() || autoPlan.theme,

        pedagogicalRule: editPedagogicalRule.trim(),

        technicalFocus: editTechnicalFocus.trim() || editTheme.trim() || autoPlan.technicalFocus,

        physicalFocus: editPhysicalFocus.trim() || autoPlan.physicalFocus,

        constraints: editConstraints.trim(),

        mvFormat: editMvFormat.trim() || autoPlan.mvFormat,

        warmupProfile: editWarmupProfile.trim() || autoPlan.warmupProfile,

        jumpTarget: editJumpTarget.trim() || autoPlan.jumpTarget,

        rpeTarget: editPSETarget.trim() || autoPlan.rpeTarget,

        source: "MANUAL",

        createdAt: existing?.createdAt ?? nowIso,

        updatedAt: nowIso,

      };

    },

    [

      activeCycleStartDate,

      ageBand,

      calendarExceptions,

      effectiveCycleLength,

      competitiveProfile,

      editConstraints,

      editJumpTarget,

      editMvFormat,

      editPSETarget,

      editPedagogicalRule,

      editPhase,

      editPhysicalFocus,

      editTechnicalFocus,

      editTheme,

      editWarmupProfile,

      isCompetitiveMode,

      periodizationModel,

      sportProfile,

      selectedClass,

      weeklySessions,

    ]

  );


  const hasPlanChanges = useCallback(

    (existing: ClassPlan | null, draft: ClassPlan) => {

      if (!existing) return true;

      return (

        existing.phase !== draft.phase ||

        existing.theme !== draft.theme ||

        (existing.pedagogicalRule ?? "") !== (draft.pedagogicalRule ?? "") ||

        existing.technicalFocus !== draft.technicalFocus ||

        existing.physicalFocus !== draft.physicalFocus ||

        existing.constraints !== draft.constraints ||

        existing.mvFormat !== draft.mvFormat ||

        existing.warmupProfile !== draft.warmupProfile ||

        existing.jumpTarget !== draft.jumpTarget ||

        existing.rpeTarget !== draft.rpeTarget

      );

    },

    []

  );


  const refreshPlans = useCallback(async () => {

    if (!selectedClass) {
      setClassPlans([]);
      setRecentDailyLessonPlans([]);
      return;
    }

    const [plans, recentDailyPlans] = await Promise.all([
      getClassPlansByClass(selectedClass.id, {
        cycleId: activeCycle?.id ?? null,
        cycleYear: activeCycle?.year ?? (Number(activeCycleStartDate.slice(0, 4)) || null),
      }),
      listRecentDailyLessonPlansByClass(selectedClass.id, 12),
    ]);

    setClassPlans(plans);
    setRecentDailyLessonPlans(recentDailyPlans);

  }, [activeCycle?.id, activeCycle?.year, activeCycleStartDate, selectedClass]);

  useEffect(() => {
    let alive = true;

    if (!selectedClass) {
      setRecentDailyLessonPlans([]);
      return;
    }

    (async () => {
      const plans = await measureAsync(
        "screen.periodization.load.recentDailyLessonPlans",
        () => listRecentDailyLessonPlansByClass(selectedClass.id, 12),
        { screen: "periodization", classId: selectedClass.id }
      );

      if (!alive) return;
      setRecentDailyLessonPlans(plans);
    })();

    return () => {
      alive = false;
    };
  }, [selectedClass?.id]);

  // Load observability history for the selected class from local SQLite
  useEffect(() => {
    if (!selectedClass?.id) {
      setPlanObservabilityHistory([]);
      return;
    }
    listPlanObservabilitySummariesByClass(selectedClass.id).then(setPlanObservabilityHistory).catch(() => {});
  }, [selectedClass?.id]);


  const buildAutoPlanForWeek = useCallback(

    (weekNumber: number, existing: ClassPlan | null = null) => {

      return buildAutoWeekPlan({
        selectedClass,
        weekNumber,
        existing,
        cycleLength: effectiveCycleLength,
        activeCycleStartDate,
        isCompetitiveMode,
        calendarExceptions,
        competitiveProfile,
        ageBand,
        periodizationModel,
        weeklySessions,
        sportProfile,
        recentDailyLessonPlans,
      });

    },

    [
      activeCycleStartDate,
      ageBand,
      calendarExceptions,
      competitiveProfile,
      effectiveCycleLength,
      isCompetitiveMode,
      periodizationModel,
      recentDailyLessonPlans,
      sportProfile,
      selectedClass,
      weeklySessions,
    ]

  );


  const weekEditorPlanReview = useMemo<WeeklyAutopilotPlanReview | null>(() => {
    if (!selectedClass || !periodizationKnowledgeSnapshot) return null;

    const existing = visibleClassPlans.find((plan) => plan.weekNumber === editingWeek) ?? null;
    const draftPlan = buildManualPlanForWeek(editingWeek, existing);
    if (!draftPlan) return null;

    const editedPlans = visibleClassPlans.some((plan) => plan.weekNumber === editingWeek)
      ? visibleClassPlans.map((plan) => (plan.weekNumber === editingWeek ? draftPlan : plan))
      : [...visibleClassPlans, draftPlan];

    const draftGraph = toPlanningGraphFromClassPlans({
      classId: selectedClass.id,
      organizationId: selectedClass.organizationId,
      cycleStartDate: activeCycleStartDate,
      classPlans: editedPlans,
      knowledgeSnapshot: periodizationKnowledgeSnapshot,
    });
    const baselineGraph = toPlanningGraphFromClassPlans({
      classId: selectedClass.id,
      organizationId: selectedClass.organizationId,
      cycleStartDate: activeCycleStartDate,
      classPlans: visibleClassPlans,
      knowledgeSnapshot: null,
    });

    const review = buildPlanReviewSummary(draftGraph, periodizationKnowledgeSnapshot);
    const draftWeek = draftGraph.weeks.find((week) => week.weekNumber === editingWeek) ?? null;
    const baselineWeek = baselineGraph.weeks.find((week) => week.weekNumber === editingWeek) ?? null;
    const diff = draftWeek && baselineWeek ? buildPlanDiff(baselineWeek, draftWeek) : null;

    return {
      ok: review.ok,
      versionLabel: review.versionLabel,
      domain: review.domain,
      diffs: diff ? [diff] : [],
      issues: review.issues,
      warnings: review.issues
        .filter((issue) => issue.severity !== "info")
        .map((issue) => issue.message),
      citations: [...new Set(review.issues.map((issue) => issue.reference).filter(Boolean) as string[])],
    };
  }, [
    activeCycleStartDate,
    buildManualPlanForWeek,
    editingWeek,
    periodizationKnowledgeSnapshot,
    selectedClass,
    visibleClassPlans,
  ]);


  const resetWeekToAuto = useCallback(() => {

    if (!selectedClass) return;

    const existing = visibleClassPlans.find((plan) => plan.weekNumber === editingWeek) ?? null;

    const plan = buildAutoPlanForWeek(editingWeek, existing);

    if (!plan) return;

    setEditPhase(normalizeText(plan.phase));

    setEditTheme(normalizeText(plan.theme));

    setEditTechnicalFocus(normalizeText(plan.technicalFocus));

    setEditPhysicalFocus(normalizeText(plan.physicalFocus));

    setEditConstraints(normalizeText(plan.constraints));

    setEditMvFormat(plan.mvFormat);

    setEditWarmupProfile(normalizeText(plan.warmupProfile));

    setEditJumpTarget(normalizeText(plan.jumpTarget));

    setEditPSETarget(normalizeText(plan.rpeTarget));

    setEditSource("AUTO");

  }, [buildAutoPlanForWeek, editingWeek, selectedClass, visibleClassPlans]);


  const { handleSaveWeek } = useSaveWeek({
    selectedClass,
    classPlans,
    activeCycleId: activeCycle?.id ?? "",
    editingPlanId,
    editingWeek,
    cycleLength: effectiveCycleLength,
    activeCycleStartDate,
    calendarExceptions,
    competitiveProfile,
    isCompetitiveMode,
    editSource,
    ageBand,
    periodizationModel,
    weeklySessions,
    sportProfile,
    editPhase,
    editTheme,
    editPedagogicalRule,
    editTechnicalFocus,
    editPhysicalFocus,
    editConstraints,
    editMvFormat,
    editWarmupProfile,
    editJumpTarget,
    editPSETarget,
    hasPlanChanges,
    setEditSource,
    setIsSavingWeek,
    setShowWeekEditor,
    setEditingPlanId,
    setClassPlans,
  });


  const handleSelectDay = useCallback((index: number) => {

    setSelectedDayIndex(index);

    setShowDayModal(true);

  }, []);


  const handleSelectUnit = useCallback((unit: string) => {

    if (!unit) {

      setSelectedUnit("");

      setSelectedClassId("");

      setAllowEmptyClass(true);

      setUnitMismatchWarning("");

      setShowUnitPicker(false);

      return;

    }

    const nextKey = normalizeUnitKey(unit);

    const currentKey = normalizeUnitKey(selectedUnit);

    const changed = nextKey !== currentKey;


    if (changed) {

      setSelectedClassId("");

      setAllowEmptyClass(true);

      setUnitMismatchWarning("");

    } else {

      setAllowEmptyClass(false);

    }

    setSelectedUnit(unit);

    setShowUnitPicker(false);

    if (!changed && selectedClass && normalizeUnitKey(selectedClass.unit) !== nextKey) {

      setSelectedClassId("");

      setUnitMismatchWarning(

        "A turma selecionada pertence a outra unidade. Selecione uma turma desta unidade."

      );

    } else if (!changed) {

      setUnitMismatchWarning("");

    }

  }, [selectedClass, selectedUnit]);


  const handleSelectClass = useCallback((cls: ClassGroup) => {

    setSelectedClassId(cls.id);

    setAllowEmptyClass(false);

    if (cls.unit) setSelectedUnit(cls.unit);

    setUnitMismatchWarning("");

    setShowClassPicker(false);

  }, []);


  const handleClearClass = useCallback(() => {

    setSelectedClassId("");

    setAllowEmptyClass(true);

    setUnitMismatchWarning("");

    setShowClassPicker(false);

  }, []);


  const handleSelectMeso = useCallback((value: (typeof cycleOptions)[number]) => {

    setCycleLength(value);

    setShowMesoPicker(false);

  }, []);


  const handleSelectMicro = useCallback(

    (value: (typeof sessionsOptions)[number]) => {

      setSessionsPerWeek(value);

      setShowMicroPicker(false);

    },

    []

  );


  const UnitOption = useMemo(

    () =>

      memo(function UnitOptionItem({

        unit,

        active,

        palette,

        onSelect,

        isFirst,

      }: {

        unit: string;

        active: boolean;

        palette: { bg: string; text: string };

        onSelect: (value: string) => void;

        isFirst: boolean;

      }) {

        return (

          <AnchoredDropdownOption
            active={active}
            onPress={() => onSelect(unit)}
          >
            <Text

              style={{

                color: active ? palette.text : colors.text,

                fontSize: 12,

                fontWeight: active ? "700" : "500",

              }}

            >

              {unit || "Selecione"}

            </Text>

          </AnchoredDropdownOption>

        );

      }),

    [colors]

  );


  const ClassOption = useMemo(

    () =>

      memo(function ClassOptionItem({

        cls,

        active,

        onSelect,

        isFirst,

      }: {

        cls: ClassGroup;

        active: boolean;

        onSelect: (value: ClassGroup) => void;

        isFirst: boolean;

      }) {

          return (

            <AnchoredDropdownOption active={active} onPress={() => onSelect(cls)}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>

                <Text

                  style={{

                    color: active ? colors.primaryText : colors.text,

                    fontSize: 14,

                    fontWeight: active ? "700" : "500",

                  }}

                >

                  {cls.name}

                </Text>

                <ClassGenderBadge gender={cls.gender} />

              </View>

            </AnchoredDropdownOption>

          );

        }),

    [colors]

  );


  const MesoOption = useMemo(

    () =>

      memo(function MesoOptionItem({

        value,

        active,

        onSelect,

        isFirst,

      }: {

        value: (typeof cycleOptions)[number];

        active: boolean;

        onSelect: (value: (typeof cycleOptions)[number]) => void;

        isFirst: boolean;

      }) {

        return (

          <AnchoredDropdownOption active={active} onPress={() => onSelect(value)}>
            <Text

              style={{

                color: active ? colors.primaryText : colors.text,

                fontSize: 14,

                fontWeight: active ? "700" : "500",

              }}

            >

              {value} semanas

            </Text>

          </AnchoredDropdownOption>

        );

      }),

    [colors]

  );


  const MicroOption = useMemo(

    () =>

      memo(function MicroOptionItem({

        value,

        active,

        onSelect,

        isFirst,

      }: {

        value: (typeof sessionsOptions)[number];

        active: boolean;

        onSelect: (value: (typeof sessionsOptions)[number]) => void;

        isFirst: boolean;

      }) {

        return (

          <AnchoredDropdownOption active={active} onPress={() => onSelect(value)}>
            <Text

              style={{

                color: active ? colors.primaryText : colors.text,

                fontSize: 14,

                fontWeight: active ? "700" : "500",

              }}

            >

              {value} dias

            </Text>

          </AnchoredDropdownOption>

        );

      }),

    [colors]

  );


  const { handleGenerateMode } = useGeneratePlansMode({
    selectedClass,
    activeCycleId: activeCycle?.id ?? "",
    activeCycleYear: activeCycle?.year ?? (Number(activeCycleStartDate.slice(0, 4)) || null),
    cycleLength: effectiveCycleLength,
    activeCycleStartDate,
    isCompetitiveMode,
    ageBand,
    periodizationModel,
    weeklySessions,
    sportProfile,
    calendarExceptions,
    competitiveProfile,
    buildAutoPlanForWeek,
    refreshPlans,
    setClassPlans,
    setIsSavingPlans,
  });

  const handleGenerateAction = useCallback(

    (mode: "fill" | "auto" | "all") => {

      if (mode === "all") {

        confirmDialog({

          title: "Regerar tudo?",

          message:

            "Isso substitui semanas AUTO e MANUAL. Use apenas se quiser recriar todo o ciclo.",

          confirmLabel: "Regerar tudo",

          cancelLabel: "Cancelar",

          tone: "danger",

          onConfirm: () => handleGenerateMode("all"),

        });

        return;

      }

      handleGenerateMode(mode);

    },

    [confirmDialog, handleGenerateMode]

  );

  const handleGenerateCycle = useCallback(async () => {
    if (selectedClass) {
      const year = new Date().getFullYear();
      const classStartDate = selectedClass.cycleStartDate || selectedClass.createdAt || null;
      try {
        await ensureActiveCycleForYear(selectedClass.id, year, classStartDate);
        const cycles = await getPlanningCycles(selectedClass.id);
        setPlanningCycles(cycles);
      } catch {
        // Non-blocking — cycle creation is best-effort
      }
    }
    handleGenerateAction("all");
  }, [handleGenerateAction, selectedClass]);

  const handleRemoveCycle = useCallback(() => {
    if (!selectedClass || isSavingPlans) return;

    confirmDialog({
      title: "Remover ciclo?",
      message: "Isso vai apagar todo o planejamento da turma atual.",
      confirmLabel: "Remover ciclo",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {
        setIsSavingPlans(true);
        try {
          await measure("deleteClassPlansByClass", () =>
            deleteClassPlansByClass(selectedClass.id, {
              cycleId: activeCycle?.id ?? null,
              cycleYear: activeCycle?.year ?? (Number(activeCycleStartDate.slice(0, 4)) || null),
            })
          );
          await refreshPlans();
          setActiveTab("geral");
          Alert.alert("Ciclo removido", "O planejamento da turma foi removido com sucesso.");
        } finally {
          setIsSavingPlans(false);
        }
      },
    });
  }, [activeCycle?.id, activeCycle?.year, activeCycleStartDate, confirmDialog, isSavingPlans, refreshPlans, selectedClass]);


  const getWeekSchedule = (week: WeekPlan | undefined, sessions: number) => {
    if (!week) return [];

    if (isCompetitiveMode && week.week) {
      const meta = buildCompetitiveWeekMeta({
        weekNumber: week.week,
        cycleStartDate: activeCycleStartDate,
        daysOfWeek: selectedClass?.daysOfWeek ?? [],
        exceptions: calendarExceptions,
      });
      const sessionDateByDayNumber = new Map<number, string>();
      meta.sessionDates.forEach((sessionDate) => {
        const parsed = parseIsoDate(sessionDate);
        if (!parsed) return;
        sessionDateByDayNumber.set(parsed.getDay(), sessionDate);
      });

      return buildPeriodizationWeekSchedule({
        classGroup: selectedClass,
        classPlan: activeClassPlan,
        weekPlan: week,
        cycleStartDate: activeCycleStartDate,
        periodizationModel,
        sportProfile,
        weeklySessions: sessions,
        dominantBlock: activeDominantBlockLabel,
        macroLabel: activeMacroLabel,
        mesoLabel: activeMesoLabel,
        recentSessions: recentSessionSummaries,
      }).map((item) => ({
        ...item,
        date: sessionDateByDayNumber.get(item.dayNumber) ?? item.date,
      }));
    }

    return buildPeriodizationWeekSchedule({
      classGroup: selectedClass,
      classPlan: activeClassPlan,
      weekPlan: week,
      cycleStartDate: activeCycleStartDate,
      periodizationModel,
      sportProfile,
      weeklySessions: sessions,
      dominantBlock: activeDominantBlockLabel,
      macroLabel: activeMacroLabel,
      mesoLabel: activeMesoLabel,
      recentSessions: recentSessionSummaries,
    });
  };

  const weekSchedule = useMemo(
    () => getWeekSchedule(activeWeek, sessionsPerWeek),
    [
      activeClassPlan,
      activeCycleStartDate,
      activeDominantBlockLabel,
      activeMacroLabel,
      activeMesoLabel,
      activeWeek,
      calendarExceptions,
      isCompetitiveMode,
      periodizationModel,
      recentSessionSummaries,
      selectedClass,
      sessionsPerWeek,
      sportProfile,
    ]
  );

  const [qaModeEnabled, setQaModeEnabled] = usePersistedState<boolean>(
    __DEV__ ? "periodization.qa.mode" : null,
    false
  );
  const [showQaDebugPanel, setShowQaDebugPanel] = useState(false);

  useEffect(() => {
    if (!qaModeEnabled && showQaDebugPanel) {
      setShowQaDebugPanel(false);
    }
  }, [qaModeEnabled, showQaDebugPanel]);

  const weeklyOperationalSnapshot = useMemo(
    () => parseWeeklyOperationalStrategySnapshot(activeClassPlan?.generationContextSnapshotJson),
    [activeClassPlan?.generationContextSnapshotJson]
  );

  const weeklyTeacherIntent = useMemo(() => {
    return formatWeeklyOperationalIntentForTeacher(weeklyOperationalSnapshot);
  }, [weeklyOperationalSnapshot]);

  const weeklyObservabilitySummary = useMemo(
    () =>
      buildWeeklyObservabilitySummary({
        weeklySnapshot: weeklyOperationalSnapshot,
        weekSchedule,
      }),
    [weekSchedule, weeklyOperationalSnapshot]
  );

  const classObservabilityTrend = useMemo<ObservabilityTrendByClass>(
    () => computeObservabilityTrendFromRecords(planObservabilityHistory),
    [planObservabilityHistory]
  );

  const classObservabilityDriftFrequency = useMemo<DriftFrequencyByClassItem[]>(
    () => computeDriftFrequencyFromRecords(planObservabilityHistory),
    [planObservabilityHistory]
  );

  const classRecentUnstableWeeks = useMemo<UnstableObservabilityWeek[]>(
    () => computeRecentUnstableWeeksFromRecords(planObservabilityHistory, 5),
    [planObservabilityHistory]
  );

  const classObservabilityInsights = useMemo<ObservabilityInsight[]>(
    () => buildObservabilityInsightsFromRecords(planObservabilityHistory),
    [planObservabilityHistory]
  );

  // Persist observability summary to local SQLite whenever it's (re)computed for the active plan
  useEffect(() => {
    if (!activeClassPlan || !weeklyObservabilitySummary) return;
    upsertPlanObservabilitySummary({
      planId: activeClassPlan.id,
      classId: activeClassPlan.classId,
      cycleId: activeClassPlan.cycleId ?? "",
      weekNumber: activeClassPlan.weekNumber,
      summary: weeklyObservabilitySummary,
    }).then(() => {
      // Refresh the in-memory history after upsert
      if (activeClassPlan.classId) {
        listPlanObservabilitySummariesByClass(activeClassPlan.classId)
          .then(setPlanObservabilityHistory)
          .catch(() => {});
      }
    }).catch(() => {});
  }, [activeClassPlan?.id, weeklyObservabilitySummary]);


  const isSelectedDayRest = selectedDay ? !normalizeText(selectedDay.session ?? "").trim() : false;

  const selectedDayDate = selectedDay
    ? (selectedDay.date ? parseIsoDate(selectedDay.date) : nextDateForDayNumber(selectedDay.dayNumber))
    : null;


  const volumeCounts = useMemo(() => {

    return weekPlans.reduce(

      (acc, week) => {

        acc[week.volume] += 1;

        return acc;

      },

      { baixo: 0, "médio": 0, alto: 0 } as Record<VolumeLevel, number>

    );

  }, [weekPlans]);


  const nextSessionDate = useMemo(() => {

    const classDays = selectedClass?.daysOfWeek ?? [];

    if (!classDays.length) return null;

    const dates = classDays.map((day) => nextDateForDayNumber(day));

    dates.sort((a, b) => a.getTime() - b.getTime());

    return dates[0] ?? null;

  }, [selectedClass]);


  function formatShortDate(value: Date | null) {
    return value
      ? value.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : "--";
  }


  const formatDisplayDate = (value: string | null) => {

    if (!value) return "";

    const parsed = parseIsoDate(value);

    if (!parsed) return value;

    return parsed.toLocaleDateString("pt-BR");

  };

  const formatWeekSessionLabel = (value: string) => {
    const normalized = normalizeText(value).trim();
    if (!normalized || normalized.toLowerCase() === "descanso") return "Descanso";
    if (normalized.length <= 18) return normalized;

    const midpoint = Math.floor(normalized.length / 2);
    let splitIndex = normalized.indexOf(" ", midpoint);
    if (splitIndex < 0) splitIndex = normalized.lastIndexOf(" ", midpoint);
    if (splitIndex < 0) return normalized;

    return `${normalized.slice(0, splitIndex)}\n${normalized.slice(splitIndex + 1)}`;
  };


  const buildPdfData = (rows: typeof periodizationRows) => ({
    className: normalizeText(selectedClass?.name ?? "Turma"),

    unitLabel: normalizeText(selectedClass?.unit ?? ""),

    ageGroup: normalizeText(selectedClass?.ageBand ?? ""),

    cycleStart: activeCycleStartDate || visibleClassPlans[0]?.startDate || undefined,

    cycleLength: rows.length,

    generatedAt: new Date().toLocaleDateString("pt-BR"),

    planningMode: competitiveProfile?.planningMode ?? undefined,

    targetCompetition: competitiveProfile?.targetCompetition?.trim() || undefined,

    targetDate: competitiveProfile?.targetDate?.trim() || undefined,

    tacticalSystem: competitiveProfile?.tacticalSystem?.trim() || undefined,

    currentPhase: competitiveProfile?.currentPhase?.trim() || undefined,

    contextModel: formatPeriodizationContextModel(periodizationContext.model),
    contextObjective: normalizeText(periodizationContext.objective || ""),
    contextFocus: normalizeText(periodizationContext.focus || ""),
    contextCyclePhase: normalizeText(periodizationContext.cyclePhase || ""),
    contextPedagogicalIntent: normalizeText(periodizationContext.pedagogicalIntent || ""),
    contextLoad: normalizeText(formatPeriodizationContextLoad(periodizationContext) ?? ""),
    contextConstraints: normalizeText(
      (periodizationContext.constraints ?? []).join(" • ")
    ),

    rows,

  });


  const handleExportCycle = async () => {

    if (!selectedClass || !periodizationRows.length || !hasWeekPlans) return;

    const data = buildPdfData(periodizationRows);

    const fileName = safeFileName(

      `periodizacao_${selectedClass.name}_${formatDisplayDate(data.cycleStart ?? null)}`

    );

    await exportPdf({

      html: periodizationHtml(data),

      fileName: `${fileName || "periodizacao"}.pdf`,

      webDocument: <PeriodizationDocument data={data} />,

    });

  };


  const handleExportWeek = async () => {

    if (!selectedClass || !periodizationRows.length || !hasWeekPlans) return;

    const weekRow = periodizationRows.find((row) => row.week === activeWeek.week);

    if (!weekRow) return;

    const data = buildPdfData([weekRow]);

    const fileName = safeFileName(

      `periodizacao_semana_${weekRow.week}_${selectedClass.name}`

    );

    await exportPdf({

      html: periodizationHtml(data),

      fileName: `${fileName || "periodizacao"}.pdf`,

      webDocument: <PeriodizationDocument data={data} />,

    });

  };

  const { handleImportPlansFile } = useImportPlansFile({
    selectedClass,
    setIsImportingPlansFile,
  });

  const updateCompetitiveProfileDraft = useCallback(
    (
      patch: Partial<
        Omit<ClassCompetitiveProfile, "classId" | "organizationId" | "createdAt" | "updatedAt">
      >
    ) => {
      if (!selectedClass) return;
      setCompetitiveProfile((prev) => ({
        classId: selectedClass.id,
        organizationId: selectedClass.organizationId,
        planningMode: "adulto-competitivo",
        cycleStartDate: prev?.cycleStartDate ?? selectedClass.cycleStartDate ?? formatIsoDate(new Date()),
        targetCompetition: prev?.targetCompetition ?? "",
        targetDate: prev?.targetDate ?? "",
        tacticalSystem: prev?.tacticalSystem ?? "",
        currentPhase: prev?.currentPhase ?? "Base",
        notes: prev?.notes ?? "",
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...prev,
        ...patch,
      }));
    },
    [selectedClass]
  );

  const handleSaveCompetitiveProfile = useCallback(async () => {
    if (!selectedClass) return;
    const cycleStartDateIso =
      parseDateInputToIso(competitiveCycleStartDateInput) ||
      competitiveProfile?.cycleStartDate?.trim() ||
      selectedClass.cycleStartDate ||
      formatIsoDate(new Date());
    const targetDateIso = parseDateInputToIso(competitiveTargetDateInput) || "";

    const payload: ClassCompetitiveProfile = {
      classId: selectedClass.id,
      organizationId: selectedClass.organizationId,
      planningMode: "adulto-competitivo",
      cycleStartDate: cycleStartDateIso,
      targetCompetition: competitiveProfile?.targetCompetition?.trim() || "",
      targetDate: targetDateIso,
      tacticalSystem: competitiveProfile?.tacticalSystem?.trim() || "",
      currentPhase: competitiveProfile?.currentPhase?.trim() || "Base",
      notes: competitiveProfile?.notes?.trim() || "",
      createdAt: competitiveProfile?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setIsSavingCompetitiveProfile(true);
    try {
      await saveClassCompetitiveProfile(payload);
      setCompetitiveProfile(payload);
      Alert.alert("Periodização", "Perfil competitivo salvo para a turma.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar perfil competitivo.";
      Alert.alert("Periodização", message);
    } finally {
      setIsSavingCompetitiveProfile(false);
    }
  }, [competitiveCycleStartDateInput, competitiveProfile, competitiveTargetDateInput, selectedClass]);

  const handleDisableCompetitiveMode = useCallback(async () => {
    if (!selectedClass) return;
    const shouldDisable = await confirmDialog({
      title: "Desativar modo competitivo",
      message: "O perfil competitivo desta turma sera removido. Os planos ja salvos permanecem.",
      confirmLabel: "Desativar",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {},
    });
    if (!shouldDisable) return;
    setIsSavingCompetitiveProfile(true);
    try {
      await deleteClassCompetitiveProfile(selectedClass.id);
      setCompetitiveProfile(null);
      Alert.alert("Periodização", "Modo competitivo desativado para a turma.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao desativar modo competitivo.";
      Alert.alert("Periodização", message);
    } finally {
      setIsSavingCompetitiveProfile(false);
    }
  }, [confirmDialog, selectedClass]);

  const handleAddCalendarException = useCallback(async () => {
    if (!selectedClass) return;
    const date = parseDateInputToIso(exceptionDateInput.trim());
    if (!date || !isIsoDateValue(date)) {
      Alert.alert("Periodização", "Informe uma data válida no formato DD/MM/AAAA.");
      return;
    }
    const payload: ClassCalendarException = {
      id: `exc_${selectedClass.id}_${date}_${Date.now()}`,
      classId: selectedClass.id,
      organizationId: selectedClass.organizationId,
      date,
      reason: exceptionReasonInput.trim() || "Sem treino",
      kind: "no_training",
      createdAt: new Date().toISOString(),
    };
    setIsSavingCalendarException(true);
    try {
      await saveClassCalendarException(payload);
      setCalendarExceptions((prev) =>
        [...prev.filter((item) => !(item.date === payload.date && item.kind === payload.kind)), payload].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );
      setExceptionDateInput("");
      setExceptionReasonInput("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar excecao.";
      Alert.alert("Periodização", message);
    } finally {
      setIsSavingCalendarException(false);
    }
  }, [exceptionDateInput, exceptionReasonInput, selectedClass]);

  const handleDeleteCalendarException = useCallback(async (exceptionId: string) => {
    setIsSavingCalendarException(true);
    try {
      await deleteClassCalendarException(exceptionId);
      setCalendarExceptions((prev) => prev.filter((item) => item.id !== exceptionId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao remover excecao.";
      Alert.alert("Periodização", message);
    } finally {
      setIsSavingCalendarException(false);
    }
  }, []);

  const competitiveBlockPadding = 14;
  const competitiveExceptionsMaxHeight = 180;
  const competitiveContentHeight = 220;

  const competitiveAgendaCard = selectedClass ? (
    <CompetitiveAgendaCard
      colors={colors}
      normalizeText={normalizeText}
      isCompetitiveMode={isCompetitiveMode}
      handleDisableCompetitiveMode={handleDisableCompetitiveMode}
      isSavingCompetitiveProfile={isSavingCompetitiveProfile}
      competitiveScrollRef={competitiveScrollRef}
      competitiveContentHeight={competitiveContentHeight}
      competitiveBlockPadding={competitiveBlockPadding}
      toggleCompetitiveBlock={toggleCompetitiveBlock}
      competitiveBlocksOpen={competitiveBlocksOpen}
      competitiveProfileAnimStyle={competitiveProfileAnimStyle}
      showCompetitiveProfileContent={showCompetitiveProfileContent}
      competitiveCalendarAnimStyle={competitiveCalendarAnimStyle}
      showCompetitiveCalendarContent={showCompetitiveCalendarContent}
      competitiveExceptionsAnimStyle={competitiveExceptionsAnimStyle}
      showCompetitiveExceptionsContent={showCompetitiveExceptionsContent}
      competitiveExceptionsMaxHeight={competitiveExceptionsMaxHeight}
      competitiveProfile={competitiveProfile}
      updateCompetitiveProfileDraft={updateCompetitiveProfileDraft}
      competitiveTargetDateInput={competitiveTargetDateInput}
      setCompetitiveTargetDateInput={setCompetitiveTargetDateInput}
      competitiveCycleStartDateInput={competitiveCycleStartDateInput}
      setCompetitiveCycleStartDateInput={setCompetitiveCycleStartDateInput}
      handleSaveCompetitiveProfile={handleSaveCompetitiveProfile}
      formatDateInputMask={formatDateInputMask}
      calendarExceptions={calendarExceptions}
      exceptionDateInput={exceptionDateInput}
      setExceptionDateInput={setExceptionDateInput}
      exceptionReasonInput={exceptionReasonInput}
      setExceptionReasonInput={setExceptionReasonInput}
      isSavingCalendarException={isSavingCalendarException}
      handleAddCalendarException={handleAddCalendarException}
      handleDeleteCalendarException={handleDeleteCalendarException}
      formatDisplayDate={formatDisplayDate}
      confirmDialog={confirmDialog}
    />
  ) : null;


  return (

    <SafeAreaView

      style={{ flex: 1, backgroundColor: colors.background, overflow: "visible" }}

    >

      <View ref={containerRef} style={{ flex: 1, position: "relative", overflow: "visible" }}>

        <Pressable

          onPress={() => {

            if (!isPickerOpen) return;

            closeAllPickers();

          }}

          pointerEvents={

            showUnitPicker || showClassPicker || showMesoPicker || showMicroPicker

              ? "auto"

              : "none"

          }

          style={{

            position: "absolute",

            top: 0,

            right: 0,

            bottom: 0,

            left: 0,

            zIndex: 0,

          }}

        />

        <ScrollView

          contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }}

          style={{ zIndex: 1, backgroundColor: colors.background }}
          stickyHeaderIndices={[0]}

          onScrollBeginDrag={() => {
            closeAllPickers();
          }}
        >

        <View
          style={{
            gap: 16,
            backgroundColor: colors.background,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.background,
            position: "relative",
            zIndex: 20,
          }}
        >

        <View style={{ gap: 10, position: "relative", zIndex: 40 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, position: "relative", zIndex: 40 }}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
                {normalizeText("Periodização")}
              </Text>
            </Pressable>

            {selectedClass ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, position: "relative" }}>
                <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "700", color: colors.text, maxWidth: 130 }}>
                  {classNameLabel}
                </Text>
                <ClassGenderBadge gender={classGenderLabel} size="md" />
              </View>
            ) : null}
          </View>

          {!selectedClass ? (
            <Text style={{ color: colors.muted }}>
              {normalizeText("Estrutura do ciclo, cargas e foco semanal")}
            </Text>
          ) : null}
        </View>


        <AnimatedSegmentedTabs
          tabs={[
            { id: "geral", label: normalizeText("Visão geral") },
            { id: "ciclo", label: normalizeText("Ciclo") },
            { id: "semana", label: normalizeText("Agenda") },
          ]}
          activeTab={activeTab}
          onChange={(tab) => {
            closeAllPickers();
            setActiveTab(tab);
          }}
        />

  </View>

        { activeTab === "geral" ? (
          <OverviewTab
            colors={colors}
            normalizeText={normalizeText}
            formatShortDate={formatShortDate}
            nextSessionDate={nextSessionDate}
            classStartTimeLabel={classStartTimeLabel}
            hasInitialClass={hasInitialClass}
            showClassPicker={showClassPicker}
            classTriggerRef={classTriggerRef}
            hasUnitSelected={hasUnitSelected}
            togglePicker={togglePicker}
            setClassPickerTop={setClassPickerTop}
            selectedClass={selectedClass}
            showUnitPicker={showUnitPicker}
            unitTriggerRef={unitTriggerRef}
            setUnitPickerTop={setUnitPickerTop}
            selectedUnit={selectedUnit}
            mesoTriggerRef={mesoTriggerRef}
            showMesoPicker={showMesoPicker}
            cycleLength={effectiveCycleLength}
            microTriggerRef={microTriggerRef}
            showMicroPicker={showMicroPicker}
            sessionsPerWeek={sessionsPerWeek}
            painAlert={painAlert}
            painAlertDates={painAlertDates}
            isOrgAdmin={isOrgAdmin}
            router={router}
            classPlans={classPlans}
            hasWeekPlans={hasWeekPlans}
            isSavingPlans={isSavingPlans}
            activeCycle={activeCycle}
            historyCycles={historyCycles}
            onCompleteMissingCoverage={() => handleGenerateAction("fill")}
            onGenerateCycle={handleGenerateCycle}
            onRemoveCycle={handleRemoveCycle}
            unitMismatchWarning={unitMismatchWarning}
          />
        ) : null}

        {activeTab === "geral" && selectedClass ? (
          <View
            style={[
              getSectionCardStyle(colors, "info", { padding: 12, radius: 16, shadow: false }),
              { gap: 8, marginBottom: 12 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="layers-outline" size={18} color={colors.primaryText} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Contexto pedagógico
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText(
                  `${formatPeriodizationContextModel(periodizationContext.model)} · ${
                    periodizationContext.objective || "Sem objetivo definido"
                  }`
                )}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText(
                  `${periodizationContext.focus || "Sem foco"}${
                    formatPeriodizationContextLoad(periodizationContext)
                      ? ` · ${formatPeriodizationContextLoad(periodizationContext)}`
                      : ""
                  }${
                    periodizationContext.cyclePhase
                      ? ` · ${periodizationContext.cyclePhase}`
                      : ""
                  }`
                )}
              </Text>
              {periodizationContext.constraints?.length ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {normalizeText(
                    `${periodizationContext.constraints.length} restrição(ões) ativas no momento`
                  )}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {activeTab === "geral" && selectedClass ? (
          <View
            style={[
              getSectionCardStyle(colors, "info", { padding: 12, radius: 16, shadow: false }),
              { gap: 10 },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryText} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  Revisão científica
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: isLoadingPeriodizationKnowledge
                    ? colors.secondaryBg
                    : periodizationKnowledgeSnapshot
                      ? periodizationPlanReview?.ok
                        ? colors.successBg
                        : colors.warningBg
                      : colors.secondaryBg,
                }}
              >
                <Text
                  style={{
                    color: isLoadingPeriodizationKnowledge
                      ? colors.muted
                      : periodizationKnowledgeSnapshot
                        ? periodizationPlanReview?.ok
                          ? colors.successText
                          : colors.warningText
                        : colors.muted,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {isLoadingPeriodizationKnowledge
                    ? "Carregando base"
                    : periodizationKnowledgeSnapshot
                      ? periodizationPlanReview?.ok
                        ? "Plano validado"
                        : `${periodizationPlanReview?.issues.length ?? 0} alerta(s)`
                      : "Base ausente"}
                </Text>
              </View>
            </View>

            {isLoadingPeriodizationKnowledge ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Carregando snapshot científico da turma.
              </Text>
            ) : periodizationKnowledgeSnapshot ? (
              <>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {normalizeText(
                    `Base ${periodizationKnowledgeSnapshot.versionLabel} · ${periodizationKnowledgeSnapshot.domain}`
                  )}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {periodizationPlanReview
                    ? normalizeText(
                        periodizationPlanReview.issues.length
                          ? `${periodizationPlanReview.issues.length} alerta(s) para revisar antes de fechar o ciclo.`
                          : "Plano alinhado com a base científica ativa."
                      )
                    : normalizeText("Base ativa, sem resumo de revisão disponível neste momento.")}
                </Text>
              </>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Nenhuma base científica ativa para esta turma.
              </Text>
            )}
          </View>
        ) : null}


        { activeTab === "ciclo" ? (
          <CycleTab
          colors={colors}
          cyclePanelCellWidth={cyclePanelCellWidth}
          cyclePanelCellGap={cyclePanelCellGap}
          cyclePanelLabelWidth={cyclePanelLabelWidth}
          cyclePanelRowHeight={cyclePanelRowHeight}
          cyclePanelRowGap={cyclePanelRowGap}
          cyclePanelScrollRef={cyclePanelScrollRef}
          isEditingCycleTitle={isEditingCycleTitle}
          cycleTitleDraft={cycleTitleDraft}
          setCycleTitleDraft={setCycleTitleDraft}
          saveCycleTitleEditor={saveCycleTitleEditor}
          cancelCycleTitleEditor={cancelCycleTitleEditor}
          openCycleTitleEditor={openCycleTitleEditor}
          cyclePanelTitle={displayedCyclePanelTitle}
          hasWeekPlans={hasWeekPlans}
          weekPlans={weekPlans}
          currentWeek={currentWeek}
          selectedWeekNumber={focusedWeekNumber}
          monthWeekNumbers={monthWeekNumbers}
          monthSegments={monthSegments}
          macroSegments={macroSegments}
          mesoSegments={mesoSegments}
          dominantBlockSegments={dominantBlockSegments}
          weeklySessions={weeklySessions}
          periodizationModel={periodizationModel}
          sportProfile={sportProfile}
          onSelectedWeekChange={setAgendaWeekNumber}
          openWeekEditor={openWeekEditor}
          sectionOpen={sectionOpen}
          toggleSection={toggleSection}
          showLoadContent={showLoadContent}
          loadAnimStyle={loadAnimStyle}
          progressBars={progressBars}
          acwrLimits={acwrLimits}
          setAcwrLimits={setAcwrLimits}
          acwrLimitError={acwrLimitError}
          acwrMessage={acwrMessage}
          volumeToPSE={volumeToPSE}
          sessionsPerWeek={sessionsPerWeek}
          showGuideContent={showGuideContent}
          guideAnimStyle={guideAnimStyle}
          summary={summary}
          showCycleContent={showCycleContent}
          cycleAnimStyle={cycleAnimStyle}
          cycleFilter={cycleFilter}
          setCycleFilter={setCycleFilter}
          selectedClass={selectedClass}
          filteredWeekPlans={filteredWeekPlans}
        />
        ) : null}


        { activeTab === "semana" ? (
          <WeekTab
            colors={colors}
            weekSchedule={weekSchedule}
            activeWeek={activeWeek}
            weeklyTeacherIntent={weeklyTeacherIntent}
            weeklyObservabilitySummary={weeklyObservabilitySummary}
            qaModeEnabled={__DEV__ && qaModeEnabled}
            showQaModeToggle={__DEV__}
            onToggleQaMode={() => setQaModeEnabled((current) => !current)}
            showQaDebugPanel={showQaDebugPanel}
            onToggleQaDebugPanel={() => setShowQaDebugPanel((current) => !current)}
            classObservabilityTrend={__DEV__ && qaModeEnabled ? classObservabilityTrend : null}
            classObservabilityDriftFrequency={__DEV__ && qaModeEnabled ? classObservabilityDriftFrequency : []}
            classRecentUnstableWeeks={__DEV__ && qaModeEnabled ? classRecentUnstableWeeks : []}
            classObservabilityInsights={__DEV__ && qaModeEnabled ? classObservabilityInsights : []}
            onGoToWeek={goToWeek}
            weekPlans={weekPlans}
            weekSwitchOpacity={weekSwitchOpacity}
            weekSwitchTranslateX={weekSwitchTranslateX}
            goToPreviousAgendaWeek={goToPreviousAgendaWeek}
            goToNextAgendaWeek={goToNextAgendaWeek}
            handleSelectDay={handleSelectDay}
            formatWeekSessionLabel={formatWeekSessionLabel}
            hasWeekPlans={hasWeekPlans}
            competitiveAgendaCard={competitiveAgendaCard}
          />
        ) : null}

        </ScrollView>

        {showPlanFabMenu ? (
          <Pressable
            onPress={() => setShowPlanFabMenu(false)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 6180,
            }}
          />
        ) : null}

        {showPlanFabMenu ? (
          <Animated.View
            style={[
              plansFabMenuPositionStyle,
              {
                width: 220,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 8,
                gap: 8,
                zIndex: 6190,
                opacity: planFabAnim,
                transform: [
                  {
                    translateY: planFabAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                  {
                    scale: planFabAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              onPress={() => {
                setShowPlanFabMenu(false);
                void handleExportWeek();
              }}
              disabled={!canExportPlans}
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
                opacity: canExportPlans ? 1 : 0.65,
              }}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                Exportar semana
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowPlanFabMenu(false);
                void handleExportCycle();
              }}
              disabled={!canExportPlans}
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
                opacity: canExportPlans ? 1 : 0.65,
              }}
            >
              <Ionicons name="download-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                Exportar ciclo
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowPlanFabMenu(false);
                void handleImportPlansFile();
              }}
              disabled={!selectedClass || isImportingPlansFile}
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
                opacity: !selectedClass || isImportingPlansFile ? 0.65 : 1,
              }}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {isImportingPlansFile ? "Importando..." : "Importar planejamento"}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <Pressable
          onPress={() => setShowPlanFabMenu((current) => !current)}
          disabled={!selectedClass && !showPlanFabMenu}
          style={[
            plansFabPositionStyle,
            {
              width: 56,
              height: 56,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primaryBg,
              borderWidth: 1,
              borderColor: colors.primaryBg,
              zIndex: 6200,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
              opacity: !selectedClass && !showPlanFabMenu ? 0.7 : 1,
            },
          ]}
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
            <Ionicons name="add" size={24} color={colors.primaryText} />
          </Animated.View>
        </Pressable>


        <AnchoredDropdown

          visible={showClassPickerContent}

          layout={classTriggerLayout}

          container={containerWindow}

          animationStyle={classPickerAnimStyle}

          zIndex={300}

          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}

          scrollContentStyle={{ padding: 8, gap: 6 }}

        >

          { filteredClasses.length ? (

            <>

              <Pressable

                onPress={handleClearClass}

                style={{

                  paddingVertical: 12,

                  paddingHorizontal: 12,

                  borderRadius: 14,

                  marginVertical: 3,

                  backgroundColor: !selectedClassId ? colors.primaryBg : colors.card,

                }}

              >

                <Text

                  style={{

                    color: !selectedClassId ? colors.primaryText : colors.text,

                    fontSize: 14,

                    fontWeight: !selectedClassId ? "700" : "500",

                  }}

                >

                  Selecione

                </Text>

              </Pressable>

              <FlatList
                data={filteredClasses}
                keyExtractor={(cls) => cls.id}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 0 }}
                renderItem={({ item: cls, index }) => (
                  <ClassOption
                    cls={cls}
                    active={cls.id === selectedClassId}
                    onSelect={handleSelectClass}
                    isFirst={index === 0}
                  />
                )}
              />

            </>

          ) : (

            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>

              {hasUnitSelected ? "Nenhuma turma cadastrada." : "Selecione uma unidade."}

            </Text>

          )}

        </AnchoredDropdown>


        <AnchoredDropdown

          visible={showUnitPickerContent}

          layout={unitTriggerLayout}

          container={containerWindow}

          animationStyle={unitPickerAnimStyle}

          zIndex={300}

          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}

          scrollContentStyle={{ padding: 8, gap: 6 }}

        >

          {unitOptions.map((unit, index) => {

            const active = unit === selectedUnit;

            const palette = unit

              ? getUnitPalette(unit, colors)

              : { bg: colors.secondaryBg, text: colors.text };

            return (

              <UnitOption

                key={unit || "select"}

                unit={unit}

                active={active}

                palette={palette}

                onSelect={handleSelectUnit}

                isFirst={index === 0}

              />

            );

          })}

        </AnchoredDropdown>


        <AnchoredDropdown

          visible={showMesoPickerContent}

          layout={mesoTriggerLayout}

          container={containerWindow}

          animationStyle={mesoPickerAnimStyle}

          zIndex={999}

          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}

          scrollContentStyle={{ padding: 8, gap: 6 }}

        >

          {cycleOptions.map((value, index) => (

            <MesoOption

              key={value}

              value={value}

              active={value === cycleLength}

              onSelect={handleSelectMeso}

              isFirst={index === 0}

            />

          ))}

        </AnchoredDropdown>


        <AnchoredDropdown

          visible={showMicroPickerContent}

          layout={microTriggerLayout}

          container={containerWindow}

          animationStyle={microPickerAnimStyle}

          zIndex={999}

          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}

          scrollContentStyle={{ padding: 8, gap: 6 }}

        >

          {sessionsOptions.map((value, index) => (

            <MicroOption

              key={value}

              value={value}

              active={value === sessionsPerWeek}

              onSelect={handleSelectMicro}

              isFirst={index === 0}

            />

          ))}

        </AnchoredDropdown>

      </View>

      <DayModal
        visible={showDayModal}
        onClose={() => setShowDayModal(false)}
        modalCardStyle={modalCardStyle}
        colors={colors}
        selectedDay={selectedDay}
        isSelectedDayRest={isSelectedDayRest}
        selectedClass={selectedClass}
        selectedDayDate={selectedDayDate}
        activeWeek={activeWeek}
        formatDisplayDate={formatDisplayDate}
        formatIsoDate={formatIsoDate}
        getVolumePalette={getVolumePalette}
        volumeToPSE={volumeToPSE}
        normalizeText={normalizeText}
      />

      <WeekEditorModal
        visible={showWeekEditor}
        onClose={() => setShowWeekEditor(false)}
        modalCardStyle={modalCardStyle}
        colors={colors}
        editingWeek={editingWeek}
        selectedClassName={selectedClass?.name ?? "Turma"}
        daysOfWeek={selectedClass?.daysOfWeek ?? []}
        weeklySessions={weeklySessions}
        weekSessions={weekSessions}
        cycleLength={effectiveCycleLength}
        editPhase={editPhase}
        setEditPhase={setEditPhase}
        editTheme={editTheme}
        setEditTheme={setEditTheme}
        editPedagogicalRule={editPedagogicalRule}
        setEditPedagogicalRule={setEditPedagogicalRule}
        editJumpTarget={editJumpTarget}
        setEditJumpTarget={setEditJumpTarget}
        editPSETarget={editPSETarget}
        setEditPSETarget={setEditPSETarget}
        editTechnicalFocus={editTechnicalFocus}
        setEditTechnicalFocus={setEditTechnicalFocus}
        editPhysicalFocus={editPhysicalFocus}
        setEditPhysicalFocus={setEditPhysicalFocus}
        editConstraints={editConstraints}
        setEditConstraints={setEditConstraints}
        isSavingWeek={isSavingWeek}
        onSave={handleSaveWeek}
        onResetToAuto={resetWeekToAuto}
      onConfirmDialog={confirmDialog}
      normalizeText={normalizeText}
      planReview={weekEditorPlanReview}
    />

    </SafeAreaView>

  );

}

