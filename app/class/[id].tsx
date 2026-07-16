import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    Vibration,
    View,
    useWindowDimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import { InsightCard } from "../../src/components/ui/InsightCard";
import { type ContextualInsight, useContextualInsight } from "../../src/copilot/hooks/useContextualInsight";

import { ScreenLoadingState } from "../../src/components/ui/ScreenLoadingState";
import { ScreenPageHeader } from "../../src/components/ui/ScreenPageHeader";
import { resolveResponsiveLayout } from "../../src/ui/responsive-layout";
import { useCopilotContext } from "../../src/copilot/CopilotProvider";
import { CLASS_MODALITY_OPTIONS } from "../../src/core/class-modality";
import type { ClassGroup, ScoutingLog, TrainingPlan } from "../../src/core/models";
import { annualCycleOptions } from "../../src/core/periodization-basics";
import { createTrainingPlanVersion } from "../../src/core/training-plan-factory";
import {
    ROSTER_FUNDAMENTALS,
    buildRosterFundamentalsByDay,
    buildRosterMonthEntries,
    getBlockForToday,
    getSuggestedFundamentalsForClass,
    type RosterFundamental,
} from "../../src/core/periodization";
import {
    deleteClassCascade,
    deleteTrainingPlan,
    deleteTrainingPlansByClassAndDate,
    duplicateClass,
    getAttendanceByClass,
    getClassById,
    getClasses,
    getLatestScoutingLog,
    getLatestTrainingPlanByClass,
    getStudentsByClass,
    getTrainingPlans,
    saveTrainingPlan,
    updateClass,
    updateClassColor,
} from "../../src/db/seed";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { logAction } from "../../src/observability/breadcrumbs";
import { markRender, measure, measureAsync } from "../../src/observability/perf";
import { ClassRosterDocument } from "../../src/pdf/class-roster-document";
import { exportPdf, safeFileName } from "../../src/pdf/export-pdf";
import { classRosterHtml } from "../../src/pdf/templates/class-roster";
import {
    ClassEditModalBody,
    ClassEditModalPickers,
} from "../../src/screens/classes/components/ClassEditModalBody";
import {
    ClassContextStrip,
    ClassOperationsWorkspace,
} from "../../src/screens/classes/components/ClassOperationsWorkspace";
import { ClassPlanPreviewModal } from "../../src/screens/classes/components/ClassPlanPreviewModal";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { GoAtletaIcon } from "../../src/ui/icon-registry";
import { getClassColorOptions, getClassPalette } from "../../src/ui/class-colors";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";
import { DatePickerModal } from "../../src/ui/DatePickerModal";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { useSaveToast } from "../../src/ui/save-toast";
import { getUnitPalette, toRgba } from "../../src/ui/unit-colors";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { useWhatsAppSettings } from "../../src/ui/whatsapp-settings-context";
import {
    buildWaMeLink,
    getContactPhone,
    getDefaultMessage,
    openWhatsApp,
} from "../../src/utils/whatsapp";
import {
    WHATSAPP_TEMPLATES,
    WhatsAppTemplateId,
    calculateAdjacentClassDate,
    calculateCurrentOrNextClassDate,
    calculateNextClassDate,
    formatNextClassDate,
    getSuggestedTemplate,
    renderTemplate
} from "../../src/utils/whatsapp-templates";
import { buildAutoPlanForCycleDay } from "../../src/screens/session/application/build-auto-plan-for-cycle-day";
import { convertPedagogicalPackageToTrainingPlan } from "../../src/screens/session/application/convert-pedagogical-package-to-training-plan";
import { SessionScreen } from "./[id]/session";

type AvailableContact = {
  studentName: string;
  phone: string;
  source: "guardian" | "student";
};

type RosterExportOptions = {
  includeAttendance: boolean;
  includeBirthDate: boolean;
  includeCourse: boolean;
  includeContact: boolean;
  includeFundamentals: boolean;
};

type RosterFundamentalOverrides = Record<number, Partial<Record<RosterFundamental, boolean>>>;

const buildRosterExportOptions = (): RosterExportOptions => ({
  includeAttendance: true,
  includeBirthDate: true,
  includeCourse: false,
  includeContact: false,
  includeFundamentals: false,
});

const ROSTER_COLUMN_OPTIONS = [
  {
    key: "includeAttendance" as const,
    label: "Presenças",
    description: "Dias e total da chamada",
  },
  {
    key: "includeBirthDate" as const,
    label: "Nascimento",
    description: "Data de nascimento do aluno",
  },
  {
    key: "includeCourse" as const,
    label: "Curso",
    description: "Curso do aluno",
  },
  {
    key: "includeContact" as const,
    label: "Contato",
    description: "Telefone do aluno ou responsável",
  },
] as const;

const WhatsAppContactRow = memo(function WhatsAppContactRow({
  contact,
  index,
  isSelected,
  onSelect,
  colors,
  subtleSurface,
  borderColor,
  mutedColor,
}: {
  contact: AvailableContact;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
  subtleSurface: string;
  borderColor: string;
  mutedColor: string;
}) {
  return (
    <Pressable
      onPress={() => onSelect(index)}
      style={{
        padding: 10,
        borderRadius: 10,
        backgroundColor: isSelected ? colors.primaryBg : subtleSurface,
        borderWidth: 1,
        borderColor: isSelected ? colors.primaryBg : borderColor,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: isSelected ? colors.primaryText : colors.text,
          }}
        >
          {contact.studentName}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: isSelected ? colors.primaryText : mutedColor,
            marginTop: 2,
          }}
        >
          {contact.source === "guardian" ? "Responsável" : "Aluno"} •{" "}
          {contact.phone.replace(/^55/, "").replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
        </Text>
      </View>
      <GoAtletaIcon
        name={isSelected ? "checkmarkCircle" : "circleOutline"}
        size={18}
        color={isSelected ? colors.primaryText : mutedColor}
      />
    </Pressable>
  );
});

export default function ClassDetails() {
  markRender("screen.classDetails.render.root");

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, mode } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const insets = useSafeAreaInsets();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { confirm } = useConfirmUndo();
  const {
    defaultMessageEnabled,
    setDefaultMessageEnabled,
    coachName,
    coachNameByClass,
    setCoachNameForClass,
    groupInviteLinks,
  } = useWhatsAppSettings();
  const whatsappModalCardStyle = useModalCardStyle({
    maxHeight: "82%",
    maxWidth: 520,
  });
  const rosterModalCardStyle = useModalCardStyle({
    maxHeight: Platform.OS === "web" ? "90%" : "94%",
    maxWidth: 820,
    padding: 16,
    radius: 18,
  });
  const rosterModalHeight = Platform.OS === "web" ? "82%" : "90%";
  const rosterColumnsHeaderWidth = Math.min(260, Math.max(170, windowWidth * 0.34));
  const isCompactEditModal = Platform.OS !== "web" && windowWidth <= 760;
  const editModalCardStyle = useModalCardStyle({
    maxHeight: Platform.OS === "web" ? "92%" : "96%",
    maxWidth: isCompactEditModal ? 700 : 960,
    padding: 16,
    radius: 16,
  });
  const reportModalCardStyle = useModalCardStyle({
    maxHeight: Platform.OS === "web" ? "90%" : "96%",
    maxWidth: 720,
    padding: 0,
    radius: 18,
  });
  const [showWhatsAppSettingsModal, setShowWhatsAppSettingsModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<WhatsAppTemplateId | null>(null);
  const [customWhatsAppMessage, setCustomWhatsAppMessage] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [availableContacts, setAvailableContacts] = useState<AvailableContact[]>([]);
  const [selectedContactIndex, setSelectedContactIndex] = useState(-1);
  const [contactSearch, setContactSearch] = useState("");
  const whatsappSelectedBg = mode === "dark" ? toRgba(colors.successBg, 0.28) : toRgba(colors.successBg, 0.18);
  const whatsappSelectedBorder = mode === "dark" ? toRgba(colors.successBg, 0.7) : toRgba(colors.successBg, 0.55);
  const whatsappSelectedText = mode === "dark" ? colors.text : colors.successText;
  const whatsappModalSurface = colors.card;
  const whatsappModalSubtleSurface = colors.inputBg;
  const whatsappModalBorder = colors.border;
  const whatsappModalMuted = mode === "light" ? toRgba(colors.text, 0.72) : colors.muted;
  const [rosterMonthValue, setRosterMonthValue] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  });
  const [rosterExportOptions, setRosterExportOptions] = useState<RosterExportOptions>(() =>
    buildRosterExportOptions()
  );
  const [rosterPlans, setRosterPlans] = useState<TrainingPlan[]>([]);
  const [rosterFundamentalOverrides, setRosterFundamentalOverrides] =
    useState<RosterFundamentalOverrides>({});
  const [rosterFundamentalLabels, setRosterFundamentalLabels] = useState<string[]>(() => [
    ...ROSTER_FUNDAMENTALS,
  ]);
  const [editingRosterFundamentalIndex, setEditingRosterFundamentalIndex] = useState<number | null>(
    null
  );
  const [editingRosterFundamentalValue, setEditingRosterFundamentalValue] = useState("");
  const [showRosterMonthPicker, setShowRosterMonthPicker] = useState(false);
  const [showRosterExportModal, setShowRosterExportModal] = useState(false);
  const [showRosterColumnsPicker, setShowRosterColumnsPicker] = useState(false);
  const [rosterColumnsTriggerLayout, setRosterColumnsTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const rosterColumnsTriggerRef = useRef<View>(null);
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [missingContactCount, setMissingContactCount] = useState<number | null>(null);
  const [appliedPlan, setAppliedPlan] = useState<TrainingPlan | null>(null);
  const [lessonDate, setLessonDate] = useState<Date | null>(null);
  const [isLoadingLessonPlan, setIsLoadingLessonPlan] = useState(false);
  const [showPlanPreviewModal, setShowPlanPreviewModal] = useState(false);
  const [planPreviewMode, setPlanPreviewMode] = useState<"preview" | "edit">("preview");
  const [showReportModal, setShowReportModal] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isOperationalInsightDismissed, setIsOperationalInsightDismissed] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [showEditCycleLengthPicker, setShowEditCycleLengthPicker] = useState(false);
  const [showEditMvLevelPicker, setShowEditMvLevelPicker] = useState(false);
  const [showEditAgeBandPicker, setShowEditAgeBandPicker] = useState(false);
  const [showEditGenderPicker, setShowEditGenderPicker] = useState(false);
  const [showEditModalityPicker, setShowEditModalityPicker] = useState(false);
  const [showEditGoalPicker, setShowEditGoalPicker] = useState(false);
  const [showEditCycleCalendar, setShowEditCycleCalendar] = useState(false);
  const [editContainerWindow, setEditContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const editScrollRef = useRef<ScrollView | null>(null);
  const [editCycleLengthTriggerLayout, setEditCycleLengthTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editMvLevelTriggerLayout, setEditMvLevelTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editAgeBandTriggerLayout, setEditAgeBandTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editGenderTriggerLayout, setEditGenderTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editModalityTriggerLayout, setEditModalityTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editGoalTriggerLayout, setEditGoalTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const editContainerRef = useRef<View>(null);
  const editCycleLengthTriggerRef = useRef<View>(null);
  const editMvLevelTriggerRef = useRef<View>(null);
  const editAgeBandTriggerRef = useRef<View>(null);
  const editGenderTriggerRef = useRef<View>(null);
  const editModalityTriggerRef = useRef<View>(null);
  const editGoalTriggerRef = useRef<View>(null);
  const [classColorKey, setClassColorKey] = useState<string | null>(null);
  const [classColorSaving, setClassColorSaving] = useState(false);
  const filteredContacts = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    if (!term) {
      return availableContacts.map((contact, index) => ({ contact, index }));
    }
    return availableContacts
      .map((contact, index) => ({ contact, index }))
      .filter(({ contact }) => {
        const name = contact.studentName.toLowerCase();
        const phone = contact.phone.replace(/\D/g, "");
        return name.includes(term) || phone.includes(term);
      });
  }, [availableContacts, contactSearch]);
  const handleSelectContact = useCallback((index: number) => {
    setSelectedContactIndex(index);
  }, []);
  const [name, setName] = useState("");
  const [coachNameOverride, setCoachNameOverride] = useState("");
  const [unit, setUnit] = useState("");
  const [modality, setModality] = useState<ClassGroup["modality"]>("voleibol");
  const [ageBand, setAgeBand] = useState<ClassGroup["ageBand"]>("08-09");
  const [gender, setGender] = useState<ClassGroup["gender"]>("misto");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:00");
  const [duration, setDuration] = useState("60");
  const [mvLevel, setMvLevel] = useState("MV1");
  const [cycleStartDate, setCycleStartDate] = useState("");
  const [cycleLengthWeeks, setCycleLengthWeeks] = useState<number>(
    annualCycleOptions[annualCycleOptions.length - 1]
  );
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [latestScouting, setLatestScouting] = useState<ScoutingLog | null>(null);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [goal, setGoal] = useState<ClassGroup["goal"]>("Fundamentos");
  const [editCustomGoal, setEditCustomGoal] = useState("");
  const [showEditCustomGoal, setShowEditCustomGoal] = useState(false);
  const [editCustomAgeBand, setEditCustomAgeBand] = useState("");
  const [showEditCustomAgeBand, setShowEditCustomAgeBand] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  if (showWhatsAppSettingsModal) {
    markRender("screen.classDetails.render.whatsappModal");
  }
  const {
    animatedStyle: editCycleLengthPickerAnimStyle,
    isVisible: showEditCycleLengthPickerContent,
  } = useCollapsibleAnimation(showEditCycleLengthPicker, { translateY: -6 });
  const {
    animatedStyle: editMvLevelPickerAnimStyle,
    isVisible: showEditMvLevelPickerContent,
  } = useCollapsibleAnimation(showEditMvLevelPicker, { translateY: -6 });
  const {
    animatedStyle: editAgeBandPickerAnimStyle,
    isVisible: showEditAgeBandPickerContent,
  } = useCollapsibleAnimation(showEditAgeBandPicker, { translateY: -6 });
  const {
    animatedStyle: editGenderPickerAnimStyle,
    isVisible: showEditGenderPickerContent,
  } = useCollapsibleAnimation(showEditGenderPicker, { translateY: -6 });
  const {
    animatedStyle: editModalityPickerAnimStyle,
    isVisible: showEditModalityPickerContent,
  } = useCollapsibleAnimation(showEditModalityPicker, { translateY: -6 });
  const {
    animatedStyle: editGoalPickerAnimStyle,
    isVisible: showEditGoalPickerContent,
  } = useCollapsibleAnimation(showEditGoalPicker, { translateY: -6 });
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
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
  const ageBandOptions = [
    "06-08",
    "08-09",
    "08-11",
    "09-11",
    "10-12",
    "12-14",
    "13-15",
    "16-18",
  ];
  const goals: ClassGroup["goal"][] = [
    "Fundamentos",
    "Força Geral",
    "Potência/Agilidade",
    "Força+Potência",
    "Velocidade",
    "Agilidade",
    "Resistência",
    "Potência",
    "Mobilidade",
    "Coordenação",
    "Prevenção de lesões",
  ];
  const genderOptions: ClassGroup["gender"][] = ["feminino", "masculino", "misto"];
  const DEFAULT_CLASS_CYCLE_LENGTH_WEEKS = annualCycleOptions[annualCycleOptions.length - 1];
  const cycleLengthOptions = [...annualCycleOptions];
  const modalityOptions = [...CLASS_MODALITY_OPTIONS];
  const mvLevelOptions = [
    { value: "MV1", label: "Iniciante" },
    { value: "MV2", label: "Intermediário" },
    { value: "MV3", label: "Avançado" },
  ];
  const parseCycleLength = (value: number) => {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    return cycleLengthOptions.includes(value as (typeof annualCycleOptions)[number])
      ? value
      : null;
  };
  const formatDays = (days: number[]) =>
    days.length ? days.map((day) => dayNames[day]).join(", ") : "-";
  const chipBaseStyle = useMemo(
    () => ({
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
    }),
    []
  );
  const chipTextBaseStyle = useMemo(
    () => ({
      fontWeight: "600" as const,
      fontSize: 12,
    }),
    []
  );
  const chipInactiveStyle = useMemo(
    () => ({ backgroundColor: colors.secondaryBg }),
    [colors.secondaryBg]
  );
  const chipInactiveTextStyle = useMemo(() => ({ color: colors.text }), [colors.text]);
  const getChipStyle = useCallback(
    (active: boolean, palette?: { bg: string; text: string }) => [
      chipBaseStyle,
      active
        ? { backgroundColor: palette?.bg ?? colors.primaryBg }
        : chipInactiveStyle,
    ],
    [chipBaseStyle, chipInactiveStyle, colors.primaryBg]
  );
  const getChipTextStyle = useCallback(
    (active: boolean, palette?: { bg: string; text: string }) => [
      chipTextBaseStyle,
      active ? { color: palette?.text ?? colors.primaryText } : chipInactiveTextStyle,
    ],
    [chipInactiveTextStyle, chipTextBaseStyle, colors.primaryText]
  );
  const selectFieldStyle = useMemo(
    () => ({
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: 8,
    }),
    [colors.border, colors.inputBg]
  );
  const normalizeTimeInput = (value: string) => {
    const digits = value.replace(/[^\d]/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + ":" + digits.slice(2);
  };
  const isValidTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return false;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  };
  const parseDuration = (value: string) => {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) return null;
    return minutes >= 30 && minutes <= 180 ? minutes : null;
  };
  const parseTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
  };
  const formatTimeRange = (hour: number, minute: number, durationMinutes: number) => {
    const start = hour * 60 + minute;
    const end = start + durationMinutes;
    const endHour = Math.floor(end / 60) % 24;
    const endMinute = end % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(hour)}:${pad(minute)} - ${pad(endHour)}:${pad(endMinute)}`;
  };
  const formatShortDate = (value: string) =>
    value.includes("-") ? value.split("-").reverse().join("/") : value;

  useCopilotContext(
    useMemo(
      () => ({
        screen: "class_detail",
        title: cls?.name?.trim() || "Detalhes da turma",
        subtitle: cls?.unit?.trim() || "Turma",
      }),
      [cls?.name, cls?.unit]
    )
  );

  // Proactive AI contextual insight — silent request after screen loads
  const classSnapshotForInsight = useMemo(
    () =>
      cls
        ? {
            name: cls.name,
            ageBand: cls.ageBand,
            modality: cls.modality,
            goal: cls.goal,
            daysOfWeek: cls.daysOfWeek,
            mvLevel: cls.mvLevel,
          }
        : null,
    [cls]
  );
  const {
    insight: contextualInsight,
    dismiss: dismissContextualInsight,
  } = useContextualInsight(
    cls?.organizationId,
    cls?.id,
    classSnapshotForInsight
  );
  const contactCoverageInsight = useMemo<ContextualInsight | null>(() => {
    if (!cls || !missingContactCount) return null;
    const studentsLabel = missingContactCount === 1 ? "aluno está" : "alunos estão";
    return {
      insight: `${missingContactCount} ${studentsLabel} sem contato cadastrado. Atualize antes da próxima aula.`,
      confidence: 1,
      based_on: [`${missingContactCount} ${studentsLabel} sem telefone de responsável ou aluno.`],
      action: null,
    };
  }, [cls, missingContactCount]);
  const displayedInsight = contextualInsight ?? (
    isOperationalInsightDismissed ? null : contactCoverageInsight
  );
  const dismissDisplayedInsight = useCallback(() => {
    if (contextualInsight) {
      dismissContextualInsight();
      return;
    }
    setIsOperationalInsightDismissed(true);
  }, [contextualInsight, dismissContextualInsight]);

  useEffect(() => {
    setIsOperationalInsightDismissed(false);
  }, [id]);
  const parseIsoDate = (value?: string) => {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const local = new Date(year, month - 1, day);
      return Number.isNaN(local.getTime()) ? null : local;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const formatMonthLabel = (value: string) => {
    const date = parseIsoDate(value) ?? new Date();
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };
  const formatBirthDate = (value?: string | null) =>
    value ? formatShortDate(value) : "-";
  const formatMonthKey = (value: string) => {
    const date = parseIsoDate(value) ?? new Date();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
  };
  const getGenderCode = (value?: ClassGroup["gender"] | null) => {
    if (value === "feminino") return "fem";
    if (value === "masculino") return "masc";
    return "misto";
  };
  const formatPhoneDisplay = (digits: string) => {
    if (!digits) return "-";
    let cleaned = String(digits).replace(/\D/g, "");
    if (cleaned.startsWith("55")) cleaned = cleaned.slice(2);
    if (cleaned.length < 10) return digits;
    const ddd = cleaned.slice(0, 2);
    const rest = cleaned.slice(2);
    if (rest.length === 8) {
      return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    if (rest.length === 9) {
      return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    return `(${ddd}) ${rest}`;
  };
  const toMinutes = (value: string) => {
    if (!isValidTime(value)) return null;
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const computeEndTimeFromDuration = (value: string, durationMinutes: number) => {
    const start = toMinutes(value.trim());
    if (start === null) return "";
    const total = start + durationMinutes;
    const endHour = Math.floor(total / 60) % 24;
    const endMinute = total % 60;
    return `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
  };
  const parseDurationFromTimeRange = (startValue: string, endValue: string) => {
    const start = toMinutes(startValue.trim());
    const end = toMinutes(endValue.trim());
    if (start === null || end === null) return null;
    const durationMinutes = end - start;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
    return durationMinutes;
  };
  const resolveEndTime = (
    startValue: string,
    endValue: string | undefined,
    durationMinutes: number
  ) =>
    endValue && isValidTime(endValue)
      ? endValue
      : computeEndTimeFromDuration(startValue, durationMinutes);
  const normalizeDaysKey = (days: number[]) =>
    JSON.stringify([...days].sort((a, b) => a - b));

  useEffect(() => {
    const durationMinutes = parseDurationFromTimeRange(startTime, endTime);
    setDuration(durationMinutes ? String(durationMinutes) : "");
  }, [endTime, startTime]);

  const rosterMonthKey = formatMonthKey(rosterMonthValue);
  const rosterMonthEntries = useMemo(
    () => (cls ? buildRosterMonthEntries(rosterMonthKey, cls.daysOfWeek) : []),
    [cls, rosterMonthKey]
  );
  const rosterPreviewDays = useMemo(
    () => rosterMonthEntries.map((entry) => entry.day),
    [rosterMonthEntries]
  );
  const selectedRosterColumnsLabel =
    ROSTER_COLUMN_OPTIONS.filter((option) => rosterExportOptions[option.key])
      .map((option) => option.label)
      .join(", ") || "Nenhuma coluna selecionada";
  const rosterAutoFundamentalsByDay = useMemo(
    () =>
      cls
        ? buildRosterFundamentalsByDay({
            classId: cls.id,
            monthEntries: rosterMonthEntries,
            plans: rosterPlans,
            fallback: [],
          })
        : {},
    [cls, rosterMonthEntries, rosterPlans]
  );
  const rosterFundamentalsByDay = useMemo(
    () =>
      cls
        ? rosterPreviewDays.reduce<Record<number, RosterFundamental[]>>((acc, day) => {
            const auto = rosterAutoFundamentalsByDay[day] ?? [];
            const overrides = rosterFundamentalOverrides[day] ?? {};
            const selected = new Set<RosterFundamental>(auto as RosterFundamental[]);
            (Object.entries(overrides) as Array<[RosterFundamental, boolean]>).forEach(
              ([fundamental, value]) => {
                if (value) {
                  selected.add(fundamental);
                } else {
                  selected.delete(fundamental);
                }
              }
            );
            acc[day] = Array.from(selected);
            return acc;
          }, {})
        : {},
    [cls, rosterAutoFundamentalsByDay, rosterFundamentalOverrides, rosterPreviewDays]
  );
  const hasRosterFundamentalOverrides = useMemo(
    () => Object.keys(rosterFundamentalOverrides).length > 0,
    [rosterFundamentalOverrides]
  );
  const clsId = cls?.id ?? "";
  const clsUnit = cls?.unit ?? "";
  const currentUnit = unit.trim() || clsUnit || "Sem unidade";
  const unitLabel = clsUnit || "Sem unidade";
  const className = cls?.name || "Turma";
  const classAgeBand = cls?.ageBand || ageBand;
  const classGender = cls?.gender || gender;
  const classDays = cls?.daysOfWeek ?? [];
  const classStartTime = cls?.startTime || "-";
  const classDuration = cls?.durationMinutes ?? 60;
  const classGoal = cls?.goal || goal;
  const compactClassWorkspace =
    Platform.OS !== "web" || !resolveResponsiveLayout(windowWidth, "dashboard").isDesktop;
  const scheduleDayLabels = classDays.map((day) => dayNames[day]).filter(Boolean);
  const scheduleDaysLabel = scheduleDayLabels.length <= 1
    ? scheduleDayLabels[0] ?? "Sem dias definidos"
    : `${scheduleDayLabels.slice(0, -1).join(", ")} e ${scheduleDayLabels.at(-1)}`;
  const scheduleLabel = `${scheduleDaysLabel} · ${classStartTime}`;
  const nextClassDate = calculateCurrentOrNextClassDate(classDays, classStartTime, classDuration);
  const nextClassLabel = nextClassDate ? formatNextClassDate(nextClassDate) : "Não definida";
  const selectedLessonDate = lessonDate ?? nextClassDate;
  const selectedLessonDateKey = selectedLessonDate
    ? `${selectedLessonDate.getFullYear()}-${String(selectedLessonDate.getMonth() + 1).padStart(2, "0")}-${String(selectedLessonDate.getDate()).padStart(2, "0")}`
    : "";
  const selectedLessonWeekday = selectedLessonDate
    ? selectedLessonDate.getDay() === 0
      ? 7
      : selectedLessonDate.getDay()
    : undefined;
  const lessonDateLabel = selectedLessonDate
    ? `${String(selectedLessonDate.getDate()).padStart(2, "0")}/${String(selectedLessonDate.getMonth() + 1).padStart(2, "0")}/${selectedLessonDate.getFullYear()}`
    : "Próxima aula";
  const contactStatusValue = missingContactCount === null
    ? "—"
    : missingContactCount > 0
      ? `${missingContactCount} pendentes`
      : "Em dia";
  const contactStatusLabel = missingContactCount === null
    ? "contatos a verificar"
    : missingContactCount > 0
      ? "contatos para atualizar"
      : "contatos atualizados";
  const reportStatusValue = latestScouting ? formatShortDate(latestScouting.date) : "Pendente";
  const reportStatusLabel = latestScouting ? "último relatório" : "registre a última aula";
  const handleShiftLessonDate = useCallback((direction: -1 | 1) => {
    const baseDate = lessonDate ?? nextClassDate;
    if (!baseDate || classDays.length === 0) return;
    const nextDate = calculateAdjacentClassDate(classDays, baseDate, direction);
    if (nextDate) {
      setIsLoadingLessonPlan(true);
      setLessonDate(nextDate);
    }
  }, [classDays, lessonDate, nextClassDate]);
  const classCoachName = clsId ? coachNameByClass[clsId] ?? "" : "";
  const resolvedCoachName = classCoachName || coachName;
  const unitPalette = getUnitPalette(unitLabel, colors);
  const classPalette =
    getClassPalette(classColorKey, colors, currentUnit) ?? {
      bg: colors.primaryBg,
      text: colors.primaryText,
    };
  const colorOptions = useMemo(
    () => getClassColorOptions(colors, currentUnit),
    [colors, currentUnit]
  );
  const conflictSummary = useMemo(() => {
    if (!clsId) return [];
    const start = toMinutes(startTime.trim());
    const durationValue = parseDurationFromTimeRange(startTime, endTime);
    if (start === null || !durationValue) return [];
    const end = start + durationValue;
    return allClasses
      .filter((item) => item.id !== clsId)
      .filter((item) => (item.unit || "Sem unidade") === currentUnit)
      .filter((item) => item.daysOfWeek.some((day) => daysOfWeek.includes(day)))
      .filter((item) => {
        const otherStart = toMinutes(item.startTime || "");
        if (otherStart === null) return false;
        const otherEnd = otherStart + (item.durationMinutes || 60);
        return start < otherEnd && otherStart < end;
      })
      .map((item) => {
        const sharedDays = item.daysOfWeek.filter((day) =>
          daysOfWeek.includes(day)
        );
        return `${item.name} (${sharedDays.map((day) => dayNames[day]).join(", ")})`;
      });
  }, [allClasses, clsId, currentUnit, daysOfWeek, endTime, startTime]);
  const goalSuggestions = useMemo(() => {
    if (!clsUnit) return [];
    const matches = allClasses.filter((item) => item.unit === clsUnit);
    const counts = new Map<string, number>();
    matches.forEach((item) => {
      counts.set(item.goal, (counts.get(item.goal) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([goal]) => goal)
      .filter((goal) => goal && !goals.includes(goal))
      .slice(0, 4);
  }, [allClasses, clsUnit, goals]);
  const goalOptions = useMemo(() => {
    const merged = [...goals, ...goalSuggestions];
    return Array.from(new Set(merged));
  }, [goalSuggestions, goals]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const dataResult = await measureAsync(
          "screen.classDetails.load.initial",
          () => getClassById(id),
          { screen: "classDetails", classId: id }
        );
        if (alive) {
          const data = dataResult;
          const nextStartTime = data?.startTime ?? "14:00";
          const nextDuration = data?.durationMinutes ?? 60;
          const nextEndTime = resolveEndTime(nextStartTime, data?.endTime, nextDuration);
          setCls(data);
          setLessonDate(null);
          setAppliedPlan(null);
          setIsLoadingLessonPlan(false);
          setIsGeneratingPlan(false);
          setName(data?.name ?? "");
          setUnit(data?.unit ?? "");
          setModality(data?.modality ?? "voleibol");
          setAgeBand(data?.ageBand ?? "08-09");
          setGender(data?.gender ?? "misto");
          setStartTime(nextStartTime);
          setEndTime(nextEndTime);
          setDuration(String(parseDurationFromTimeRange(nextStartTime, nextEndTime) ?? nextDuration));
          setDaysOfWeek(data?.daysOfWeek ?? []);
          setGoal(data?.goal ?? "Fundamentos");
          setMvLevel(data?.mvLevel ?? "MV1");
          setCycleStartDate(data?.cycleStartDate ?? "");
          setCycleLengthWeeks(
            parseCycleLength(data?.cycleLengthWeeks ?? Number.NaN) ?? DEFAULT_CLASS_CYCLE_LENGTH_WEEKS
          );
          setClassColorKey(data?.colorKey ?? null);
          setCoachNameOverride(
            data?.id ? coachNameByClass[data.id] ?? "" : ""
          );
          setLoading(false);
        }
        void Promise.all([
          getLatestScoutingLog(id).catch(() => null),
          getStudentsByClass(id).catch(() => []),
        ]).then(([scouting, students]) => {
          if (!alive) return;
          setLatestScouting(scouting);
          setStudentCount(students.length);
          setMissingContactCount(
            students.filter((student) => getContactPhone(student).status !== "ok").length
          );
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [coachNameByClass, id]);

  useEffect(() => {
    if (!id || !selectedLessonDateKey) {
      setAppliedPlan(null);
      setIsLoadingLessonPlan(false);
      return;
    }
    let alive = true;
    setIsLoadingLessonPlan(true);
    (async () => {
      try {
        const byDate = await getTrainingPlans({
          classId: id,
          status: "final",
          applyDate: selectedLessonDateKey,
          orderBy: "version_desc",
          limit: 1,
        });
        let plan = byDate[0] ?? null;
        if (!plan && selectedLessonWeekday) {
          const byWeekday = await getTrainingPlans({
            classId: id,
            status: "final",
            applyWeekday: selectedLessonWeekday,
            orderBy: "version_desc",
            limit: 40,
          });
          // A recurring plan has no date of its own. Plans generated/applied
          // for a specific lesson must stay scoped to that lesson date.
          const recurringPlan = byWeekday.find((candidate) => !candidate.applyDate);
          if (recurringPlan) plan = recurringPlan;
        }
        if (alive) setAppliedPlan(plan);
      } catch {
        if (alive) setAppliedPlan(null);
      } finally {
        if (alive) setIsLoadingLessonPlan(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, selectedLessonDateKey, selectedLessonWeekday]);

  useEffect(() => {
    if (!showEditModal) return;
    let alive = true;
    (async () => {
      try {
        const list = await getClasses();
        if (alive) {
          setAllClasses(list);
        }
      } catch {
        if (alive) {
          setAllClasses([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [showEditModal]);

  useEffect(() => {
    if (!showRosterExportModal || !cls) return;
    let alive = true;
    (async () => {
      try {
        const plans = await getTrainingPlans({ classId: id });
        if (alive) {
          setRosterPlans(plans);
        }
      } catch {
        if (alive) {
          setRosterPlans([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [cls, showRosterExportModal]);

  const resetEditFields = useCallback(() => {
    if (!cls) return;
    const nextStartTime = cls.startTime ?? "14:00";
    const nextDuration = cls.durationMinutes ?? 60;
    const nextEndTime = resolveEndTime(nextStartTime, cls.endTime, nextDuration);
    setName(cls.name ?? "");
    setCoachNameOverride(classCoachName);
    setUnit(cls.unit ?? "");
    setModality(cls.modality ?? "voleibol");
    setAgeBand(cls.ageBand ?? "08-09");
    setGender(cls.gender ?? "misto");
    setStartTime(nextStartTime);
    setEndTime(nextEndTime);
    setDuration(String(parseDurationFromTimeRange(nextStartTime, nextEndTime) ?? nextDuration));
    setDaysOfWeek(cls.daysOfWeek ?? []);
    setMvLevel(cls.mvLevel ?? "MV1");
    setCycleStartDate(cls.cycleStartDate ?? "");
    setCycleLengthWeeks(
      parseCycleLength(cls.cycleLengthWeeks ?? Number.NaN) ?? DEFAULT_CLASS_CYCLE_LENGTH_WEEKS
    );
    const nextAgeBand = cls.ageBand ?? "08-09";
    const nextGoal = cls.goal ?? "Fundamentos";
    const customAgeBandSelected = nextAgeBand.trim().length > 0 && !ageBandOptions.includes(nextAgeBand);
    setAgeBand(nextAgeBand as ClassGroup["ageBand"]);
    setEditCustomAgeBand(customAgeBandSelected ? nextAgeBand : "");
    setShowEditCustomAgeBand(customAgeBandSelected);
    const customGoalSelected = nextGoal.trim().length > 0 && !goalOptions.includes(nextGoal);
    setGoal(nextGoal);
    setEditCustomGoal(customGoalSelected ? nextGoal : "");
    setShowEditCustomGoal(customGoalSelected);
    setFormError("");
  }, [ageBandOptions, classCoachName, cls, goalOptions]);

  const closeEditPickers = useCallback(() => {
    setShowEditCycleLengthPicker(false);
    setShowEditMvLevelPicker(false);
    setShowEditAgeBandPicker(false);
    setShowEditGenderPicker(false);
    setShowEditModalityPicker(false);
    setShowEditGoalPicker(false);
  }, []);

  const openEditPicker = useCallback(
    (target: "cycle" | "level" | "age" | "gender" | "modality" | "goal") => {
      closeEditPickers();

      const measureAndOpen = (attempt = 0) => {
        const measureRef =
          target === "cycle"
            ? editCycleLengthTriggerRef.current
            : target === "level"
              ? editMvLevelTriggerRef.current
              : target === "age"
                ? editAgeBandTriggerRef.current
                : target === "gender"
                  ? editGenderTriggerRef.current
                  : target === "modality"
                    ? editModalityTriggerRef.current
                    : editGoalTriggerRef.current;

        measureRef?.measureInWindow((x, y, width, height) => {
          const isReady = width > 0 && height > 0;
          if (isReady) {
            if (target === "cycle") {
              setEditCycleLengthTriggerLayout({ x, y, width, height });
              setShowEditCycleLengthPicker(true);
            } else if (target === "level") {
              setEditMvLevelTriggerLayout({ x, y, width, height });
              setShowEditMvLevelPicker(true);
            } else if (target === "age") {
              setEditAgeBandTriggerLayout({ x, y, width, height });
              setShowEditAgeBandPicker(true);
            } else if (target === "gender") {
              setEditGenderTriggerLayout({ x, y, width, height });
              setShowEditGenderPicker(true);
            } else if (target === "modality") {
              setEditModalityTriggerLayout({ x, y, width, height });
              setShowEditModalityPicker(true);
            } else {
              setEditGoalTriggerLayout({ x, y, width, height });
              setShowEditGoalPicker(true);
            }
            return;
          }

          if (attempt < 3) {
            requestAnimationFrame(() => measureAndOpen(attempt + 1));
          }
        });
      };

      requestAnimationFrame(() => requestAnimationFrame(() => measureAndOpen()));
    },
    [
      closeEditPickers,
      editCycleLengthTriggerRef,
      editMvLevelTriggerRef,
      editAgeBandTriggerRef,
      editGenderTriggerRef,
      editModalityTriggerRef,
      editGoalTriggerRef,
    ]
  );

  const toggleEditPicker = useCallback(
    (target: "cycle" | "level" | "age" | "gender" | "modality" | "goal") => {
      const isOpen =
        (target === "cycle" && showEditCycleLengthPicker) ||
        (target === "level" && showEditMvLevelPicker) ||
        (target === "age" && showEditAgeBandPicker) ||
        (target === "gender" && showEditGenderPicker) ||
        (target === "modality" && showEditModalityPicker) ||
        (target === "goal" && showEditGoalPicker);

      if (isOpen) {
        closeEditPickers();
        return;
      }

      openEditPicker(target);
    },
    [
      closeEditPickers,
      openEditPicker,
      showEditCycleLengthPicker,
      showEditMvLevelPicker,
      showEditAgeBandPicker,
      showEditGenderPicker,
      showEditModalityPicker,
      showEditGoalPicker,
    ]
  );

  const handleEditSelectCycleLength = useCallback((value: string | number) => {
    const parsed = typeof value === "number" ? value : Number(value);
    const nextCycleLength = parseCycleLength(parsed);
    if (nextCycleLength) setCycleLengthWeeks(nextCycleLength);
    closeEditPickers();
  }, [closeEditPickers]);

  const handleEditSelectMvLevel = useCallback((value: string | number) => {
    setMvLevel(String(value));
    closeEditPickers();
  }, [closeEditPickers]);

  const handleEditSelectModality = useCallback((value: string | number) => {
    setModality(String(value) as ClassGroup["modality"]);
    closeEditPickers();
  }, [closeEditPickers]);

  const editBaselineSnapshot = useMemo(() => {
    if (!cls) return null;
    const baselineStartTime = cls.startTime ?? "14:00";
    const baselineDuration = cls.durationMinutes ?? 60;
    const baselineEndTime = resolveEndTime(
      baselineStartTime,
      cls.endTime,
      baselineDuration
    );
    return {
      ageBand: cls.ageBand ?? "08-09",
      coachName: classCoachName.trim(),
      cycleLengthWeeks:
        parseCycleLength(cls.cycleLengthWeeks ?? Number.NaN) ??
        DEFAULT_CLASS_CYCLE_LENGTH_WEEKS,
      cycleStartDate: cls.cycleStartDate ?? "",
      daysOfWeek: normalizeDaysKey(cls.daysOfWeek ?? []),
      duration: String(
        parseDurationFromTimeRange(baselineStartTime, baselineEndTime) ??
          baselineDuration
      ),
      endTime: baselineEndTime,
      gender: cls.gender ?? "misto",
      goal: cls.goal ?? "Fundamentos",
      modality: cls.modality ?? "voleibol",
      mvLevel: cls.mvLevel ?? "MV1",
      name: cls.name ?? "",
      startTime: baselineStartTime,
      unit: cls.unit ?? "",
    };
  }, [classCoachName, cls]);

  const editCurrentSnapshot = useMemo(
    () => ({
      ageBand: showEditCustomAgeBand ? editCustomAgeBand.trim() : ageBand,
      coachName: coachNameOverride.trim(),
      cycleLengthWeeks,
      cycleStartDate,
      daysOfWeek: normalizeDaysKey(daysOfWeek),
      duration,
      endTime,
      gender,
      goal: showEditCustomGoal ? editCustomGoal.trim() : goal,
      modality,
      mvLevel,
      name,
      startTime,
      unit,
    }),
    [
      ageBand,
      coachNameOverride,
      cycleLengthWeeks,
      cycleStartDate,
      daysOfWeek,
      duration,
      editCustomAgeBand,
      editCustomGoal,
      endTime,
      gender,
      goal,
      modality,
      mvLevel,
      name,
      showEditCustomAgeBand,
      showEditCustomGoal,
      startTime,
      unit,
    ]
  );

  const isEditDirty = useMemo(() => {
    if (!editBaselineSnapshot) return false;
    return JSON.stringify(editBaselineSnapshot) !== JSON.stringify(editCurrentSnapshot);
  }, [editBaselineSnapshot, editCurrentSnapshot]);

  useEffect(() => {
    if (!showEditModal) return;
    requestAnimationFrame(() => {
      if (editContainerRef.current) {
        editContainerRef.current.measureInWindow((x, y) => {
          setEditContainerWindow({ x, y });
        });
      }
      if (editCycleLengthTriggerRef.current) {
        editCycleLengthTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditCycleLengthTriggerLayout({ x, y, width, height });
        });
      }
      if (editMvLevelTriggerRef.current) {
        editMvLevelTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditMvLevelTriggerLayout({ x, y, width, height });
        });
      }
      if (editAgeBandTriggerRef.current) {
        editAgeBandTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditAgeBandTriggerLayout({ x, y, width, height });
        });
      }
      if (editGenderTriggerRef.current) {
        editGenderTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditGenderTriggerLayout({ x, y, width, height });
        });
      }
      if (editModalityTriggerRef.current) {
        editModalityTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditModalityTriggerLayout({ x, y, width, height });
        });
      }
      if (editGoalTriggerRef.current) {
        editGoalTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditGoalTriggerLayout({ x, y, width, height });
        });
      }
    });
  }, [showEditModal]);

  useEffect(() => {
    if (Platform.OS !== "web" || !showEditModal) return;

    let cancelled = false;
    let rafId = 0;
    let cleanupStyles: (() => void) | null = null;

    const applyScrollbarStyles = () => {
      if (cancelled) return;

      const scrollNode = (editScrollRef.current as unknown as { getScrollableNode?: () => unknown } | null)
        ?.getScrollableNode?.();
      const element = (scrollNode ?? editScrollRef.current) as unknown as HTMLElement | null;

      if (!element || typeof element.addEventListener !== "function") {
        rafId = requestAnimationFrame(applyScrollbarStyles);
        return;
      }

      const style = element.style as CSSStyleDeclaration & { scrollbarGutter?: string };
      const previous = {
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollbarWidth: style.scrollbarWidth,
        scrollbarColor: style.scrollbarColor,
        scrollbarGutter: style.scrollbarGutter ?? "",
      };

      style.overflowX = "hidden";
      style.overflowY = "scroll";
      style.scrollbarWidth = "thin";
      style.scrollbarColor = `${colors.border} transparent`;
      style.scrollbarGutter = "stable";

      cleanupStyles = () => {
        style.overflowX = previous.overflowX;
        style.overflowY = previous.overflowY;
        style.scrollbarWidth = previous.scrollbarWidth;
        style.scrollbarColor = previous.scrollbarColor;
        style.scrollbarGutter = previous.scrollbarGutter;
      };
    };

    applyScrollbarStyles();

    return () => {
      cancelled = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      cleanupStyles?.();
    };
  }, [colors.border, showEditModal, editContainerWindow]);

  const toggleDay = (value: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(value) ? prev.filter((day) => day !== value) : [...prev, value]
    );
  };

  const saveUnit = async (): Promise<boolean> => {
    if (!cls) return false;
    const timeValue = startTime.trim();
    if (!isValidTime(timeValue)) {
      setFormError("Horário inválido. Use HH:MM.");
      Vibration.vibrate(40);
      return false;
    }
    const endTimeValue = endTime.trim();
    if (!isValidTime(endTimeValue)) {
      setFormError("Horário de término inválido. Use HH:MM.");
      Vibration.vibrate(40);
      return false;
    }
    const durationValue = parseDurationFromTimeRange(timeValue, endTimeValue);
    if (!durationValue) {
      setFormError("O horário de término deve ser maior que o horário de início.");
      Vibration.vibrate(40);
      return false;
    }
    if (durationValue < 30 || durationValue > 180) {
      setFormError("A duração calculada deve ficar entre 30 e 180 minutos.");
      Vibration.vibrate(40);
      return false;
    }
    const cycleValue = parseCycleLength(cycleLengthWeeks);
    if (!cycleValue) {
      setFormError("Macrociclo inválido. Selecione 36, 40, 44, 48 ou 52 semanas.");
      Vibration.vibrate(40);
      return false;
    }
    setFormError("");
    setSaving(true);
    try {
      await updateClass(cls.id, {
        name: name.trim() || cls.name,
        unit: unit.trim() || "Rede Esperança",
        modality,
        daysOfWeek,
        goal: showEditCustomGoal ? editCustomGoal.trim() || goal : goal,
        ageBand: (showEditCustomAgeBand ? editCustomAgeBand.trim() || ageBand : ageBand).trim() || cls.ageBand,
        gender,
        startTime: timeValue,
        durationMinutes: durationValue,
        mvLevel,
        cycleStartDate: cycleStartDate || undefined,
        cycleLengthWeeks: cycleValue,
      });
      await setCoachNameForClass(cls.id, coachNameOverride);
      Vibration.vibrate(60);
      const fresh = await getClassById(cls.id);
      setCls(fresh);
      setClassColorKey(fresh?.colorKey ?? null);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setShowEditCloseConfirm(false);
    closeEditPickers();
    setShowEditCycleCalendar(false);
    setShowEditCustomAgeBand(false);
    setEditCustomAgeBand("");
    setShowEditCustomGoal(false);
    setEditCustomGoal("");
    resetEditFields();
  }, [closeEditPickers, resetEditFields]);

  const requestCloseEditModal = useCallback(() => {
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  }, [closeEditModal, isEditDirty]);

  const handleSaveEdit = useCallback(async () => {
    const saved = await saveUnit();
    if (saved) {
      setShowEditModal(false);
    }
  }, [saveUnit]);

  const toggleRosterBooleanOption = useCallback(
    (
      key:
        | "includeAttendance"
        | "includeBirthDate"
        | "includeCourse"
        | "includeContact"
    ) => {
      setRosterExportOptions((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    []
  );

  const toggleRosterFundamentalsExport = useCallback(() => {
    setRosterExportOptions((prev) => {
      const nextEnabled = !prev.includeFundamentals;
      if (!nextEnabled) {
        setEditingRosterFundamentalIndex(null);
        setEditingRosterFundamentalValue("");
      }

      return {
        ...prev,
        includeFundamentals: nextEnabled,
      };
    });
  }, []);

  const closeRosterExportModal = useCallback(() => {
    setShowRosterColumnsPicker(false);
    setShowRosterExportModal(false);
  }, []);

  const toggleRosterColumnsPicker = useCallback(() => {
    if (showRosterColumnsPicker) {
      setShowRosterColumnsPicker(false);
      return;
    }

    const measureTrigger = () => {
      rosterColumnsTriggerRef.current?.measureInWindow((x, y, width, height) => {
        setRosterColumnsTriggerLayout({ x, y, width, height });
        setShowRosterColumnsPicker(true);
      });
    };

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(measureTrigger);
      return;
    }

    measureTrigger();
  }, [showRosterColumnsPicker]);

  const openRosterMonthPicker = useCallback(() => {
    setShowRosterColumnsPicker(false);
    setShowRosterMonthPicker(true);
  }, []);

  const toggleRosterFundamentalCell = useCallback(
    (day: number, fundamental: RosterFundamental) => {
      setRosterFundamentalOverrides((prev) => {
        const current = rosterFundamentalsByDay[day]?.includes(fundamental) ?? false;
        const auto = rosterAutoFundamentalsByDay[day]?.includes(fundamental) ?? false;
        const next = !current;
        const dayOverrides = { ...(prev[day] ?? {}) };

        if (next === auto) {
          delete dayOverrides[fundamental];
        } else {
          dayOverrides[fundamental] = next;
        }

        const nextState = { ...prev };
        if (Object.keys(dayOverrides).length) {
          nextState[day] = dayOverrides;
        } else {
          delete nextState[day];
        }
        return nextState;
      });
    },
    [rosterAutoFundamentalsByDay, rosterFundamentalsByDay]
  );
  const beginRosterFundamentalEdit = useCallback(
    (index: number) => {
      setEditingRosterFundamentalIndex(index);
      setEditingRosterFundamentalValue(
        rosterFundamentalLabels[index] ?? ROSTER_FUNDAMENTALS[index] ?? ""
      );
    },
    [rosterFundamentalLabels]
  );
  const saveRosterFundamentalLabel = useCallback(() => {
    if (editingRosterFundamentalIndex === null) return;
    const targetIndex = editingRosterFundamentalIndex;
    const fallback = ROSTER_FUNDAMENTALS[targetIndex] ?? rosterFundamentalLabels[targetIndex] ?? "";
    const nextValue = editingRosterFundamentalValue.trim() || fallback;
    setRosterFundamentalLabels((prev) => {
      const next = [...prev];
      next[targetIndex] = nextValue;
      return next;
    });
    setEditingRosterFundamentalIndex(null);
    setEditingRosterFundamentalValue("");
  }, [editingRosterFundamentalIndex, editingRosterFundamentalValue, rosterFundamentalLabels]);
  const cancelRosterFundamentalLabelEdit = useCallback(() => {
    setEditingRosterFundamentalIndex(null);
    setEditingRosterFundamentalValue("");
  }, []);
  const clearRosterFundamentalOverrides = useCallback(() => {
    setRosterFundamentalOverrides({});
  }, []);

  useEffect(() => {
    setRosterFundamentalOverrides({});
  }, [rosterMonthValue]);

  useEffect(() => {
    if (!showRosterExportModal) {
      cancelRosterFundamentalLabelEdit();
    }
  }, [cancelRosterFundamentalLabelEdit, showRosterExportModal]);

  const handleViewAppliedPlan = useCallback(() => {
    if (!appliedPlan) return;
    setPlanPreviewMode("preview");
    setShowPlanPreviewModal(true);
  }, [appliedPlan]);

  const handleSaveAppliedPlan = useCallback(
    async (draft: TrainingPlan) => {
      if (!cls || !selectedLessonDateKey) {
        throw new Error("Turma ou data da aula indisponível.");
      }
      const latestPlan = await getLatestTrainingPlanByClass(cls.id, {
        organizationId: cls.organizationId ?? null,
      });
      const nowIso = new Date().toISOString();
      const nextPlan = createTrainingPlanVersion({
        classId: cls.id,
        version: Math.max(draft.version ?? 0, latestPlan?.version ?? 0) + 1,
        origin: draft.origin === "auto" ? "edited_auto" : "manual",
        draft: {
          title: draft.title,
          tags: draft.tags,
          warmup: draft.warmup,
          main: draft.main,
          cooldown: draft.cooldown,
          warmupTime: draft.warmupTime,
          mainTime: draft.mainTime,
          cooldownTime: draft.cooldownTime,
        },
        applyDays: [],
        applyDate: selectedLessonDateKey,
        inputHash: draft.inputHash,
        nowIso,
        idPrefix: "plan_edit",
        status: "final",
        generatedAt: draft.generatedAt,
        finalizedAt: nowIso,
        parentPlanId: draft.parentPlanId ?? draft.id,
        previousVersionId: draft.id,
        pedagogy: draft.pedagogy,
      });
      await saveTrainingPlan(nextPlan, {
        organizationId: cls.organizationId ?? undefined,
      });
      setAppliedPlan(nextPlan);
      return nextPlan;
    },
    [cls, selectedLessonDateKey]
  );

  const handleRemoveAppliedPlan = useCallback(async () => {
    if (!cls || !appliedPlan || !selectedLessonDateKey) return;
    if (appliedPlan.applyDate) {
      await deleteTrainingPlansByClassAndDate(cls.id, selectedLessonDateKey, {
        organizationId: cls.organizationId ?? null,
      });
    } else {
      await deleteTrainingPlan(appliedPlan.id, {
        organizationId: cls.organizationId ?? null,
      });
    }
    setAppliedPlan(null);
  }, [appliedPlan, cls, selectedLessonDateKey]);

  const handleGeneratePlan = useCallback(async () => {
    if (!cls || !selectedLessonDateKey || isGeneratingPlan) return;
    setIsGeneratingPlan(true);
    try {
      const [students, recentPlans] = await Promise.all([
        getStudentsByClass(cls.id),
        getTrainingPlans({
          classId: cls.id,
          status: "final",
          orderBy: "createdat_desc",
          limit: 12,
        }),
      ]);
      const autoPlanResult = buildAutoPlanForCycleDay({
        classGroup: cls,
        students,
        sessionDate: selectedLessonDateKey,
        recentPlans,
      });
      const latestVersion = recentPlans.reduce(
        (max, plan) => Math.max(max, plan.version ?? 0),
        0
      );
      const generatedPlan = {
        ...convertPedagogicalPackageToTrainingPlan({
          pkg: autoPlanResult.package,
          classId: cls.id,
          sessionDate: selectedLessonDateKey,
          existingPlan: null,
          version: latestVersion + 1,
        }),
        // Auto-generated plans belong to this lesson only. Repeating them on
        // every class day would make different dates show the same plan.
        applyDays: [],
      };
      await saveTrainingPlan(generatedPlan, {
        organizationId: cls.organizationId ?? undefined,
      });
      setAppliedPlan(generatedPlan);
      showSaveToast({ message: "Plano preparado para esta aula.", variant: "success" });
    } catch (error) {
      showSaveToast({
        error,
        message: "Não foi possível preparar o plano agora.",
        variant: "error",
      });
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [
    classDays,
    cls,
    getStudentsByClass,
    isGeneratingPlan,
    selectedLessonDateKey,
    showSaveToast,
  ]);

  if (loading) {
    return <ScreenLoadingState />;
  }

  if (!cls) {
    return (
      <SafeAreaView
        style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          Turma não encontrada
        </Text>
      </SafeAreaView>
    );
  }


  const onDuplicate = async () => {
    if (!cls) return;
    const shouldDuplicate = await confirmDialog({
      title: "Duplicar turma",
      message: "Deseja criar uma cópia desta turma?",
      confirmLabel: "Duplicar",
      cancelLabel: "Cancelar",
      tone: "default",
      onConfirm: async () => {},
    });
    if (!shouldDuplicate) return;
    await duplicateClass(cls);
    router.replace("/classes");
  };

  const onDelete = () => {
    if (!cls) return;
    const targetClassId = cls.id;
    Vibration.vibrate([0, 80, 60, 80]);
    setShowEditModal(false);
    setShowEditCloseConfirm(false);
    confirm({
      title: "Excluir turma?",
      message:
        "Isso remove planejamentos, chamadas e alunos da turma. Deseja excluir?",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      undoLabel: "Desfazer",
      undoMessage: "Sua turma será apagada em {seconds}...",
      delayMs: 8000,
      onOptimistic: () => {
        // Keep state unchanged; deletion is committed only after undo window.
      },
      onConfirm: async () => {
        try {
          await measure("deleteClassCascade", () => deleteClassCascade(targetClassId));
          logAction("Excluir turma", { classId: targetClassId });
          router.replace("/classes");
        } catch (error) {
          showSaveToast({
            error,
            variant: "error",
            message: "Não foi possível excluir a turma.",
          });
        }
      },
      onUndo: async () => {
        // Nothing to revert locally because removal happens after the undo window.
      },
    });
  };

  const handleExportRoster = async () => {
    if (!cls) return;
    setRosterExportOptions(buildRosterExportOptions());
    setShowRosterColumnsPicker(false);
    setShowRosterExportModal(true);
  };

  const handleSelectClassColor = async (value: string | null) => {
    if (!cls || classColorSaving) return;
    const previous = classColorKey;
    setClassColorKey(value);
    setClassColorSaving(true);
    try {
      await updateClassColor(cls.id, value);
      setCls((prev) => (prev ? { ...prev, colorKey: value ?? "" } : prev));
    } catch (error) {
      setClassColorKey(previous ?? null);
      Alert.alert("Falha ao atualizar cor", "Tente novamente.");
    } finally {
      setClassColorSaving(false);
    }
  };

  const exportRosterPdf = async (
    monthValue = rosterMonthValue,
    options: RosterExportOptions = rosterExportOptions
  ) => {
    if (!cls) return;
    try {
      const list = await getStudentsByClass(cls.id);
      const exportDate = new Date().toLocaleDateString("pt-BR");
      const timeParts = parseTime(classStartTime);
      const timeLabel = timeParts
        ? formatTimeRange(timeParts.hour, timeParts.minute, classDuration)
        : classStartTime;
      const monthKey = formatMonthKey(monthValue);
      const monthLabel = formatMonthLabel(monthValue);
      const monthEntries = buildRosterMonthEntries(monthKey, classDays);
      const monthDays = monthEntries.map((entry) => entry.day);
      const todayKey = new Date().toISOString().split("T")[0];
      const attendanceByStudentDay: Record<string, Record<number, "P" | "F">> = {};
      const firstAttendanceByStudent: Record<string, string> = {};
      if (options.includeAttendance) {
        const records = await getAttendanceByClass(cls.id);
        records.forEach((record) => {
          const firstDate = firstAttendanceByStudent[record.studentId];
          if (!firstDate || record.date < firstDate) {
            firstAttendanceByStudent[record.studentId] = record.date;
          }
        });
        records
          .filter((record) => record.date.startsWith(monthKey))
          .forEach((record) => {
            const day = Number(record.date.split("-")[2]);
            if (!Number.isFinite(day)) return;
            if (!monthDays.includes(day)) return;
            if (!attendanceByStudentDay[record.studentId]) {
              attendanceByStudentDay[record.studentId] = {};
            }
            attendanceByStudentDay[record.studentId][day] =
              record.status === "presente" ? "P" : "F";
          });
      }
      const periodizationLabel = getBlockForToday(cls);
      const plans = rosterPlans.length ? rosterPlans : await getTrainingPlans({ classId: cls.id });
      if (!rosterPlans.length) {
        setRosterPlans(plans);
      }
      const fundamentals = [...rosterFundamentalLabels];
      const autoFundamentalsByDay = buildRosterFundamentalsByDay({
        classId: cls.id,
        monthEntries,
        plans,
        fallback: getSuggestedFundamentalsForClass(cls),
      });
      const fundamentalsByDay = monthEntries.reduce<Record<number, RosterFundamental[]>>((acc, entry) => {
        const auto = autoFundamentalsByDay[entry.day] ?? [];
        const overrides = rosterFundamentalOverrides[entry.day] ?? {};
        const selected = new Set<RosterFundamental>(auto as RosterFundamental[]);
        (Object.entries(overrides) as Array<[RosterFundamental, boolean]>).forEach(([fundamental, value]) => {
          if (value) {
            selected.add(fundamental);
          } else {
            selected.delete(fundamental);
          }
        });
        acc[entry.day] = Array.from(selected);
        return acc;
      }, {});
      const rows = list.map((student, index) => {
        const contact = getContactPhone(student);
        const contactLabel =
          contact.status === "ok"
            ? contact.source === "guardian"
              ? "Resp."
              : "Aluno"
            : contact.status === "missing"
              ? "Sem tel"
              : "Telefone inválido";
        const contactPhone =
          contact.status === "ok" ? formatPhoneDisplay(contact.phoneDigits) : "";
        const dayAttendance = options.includeAttendance
          ? attendanceByStudentDay[student.id] ?? {}
          : undefined;
        const total = options.includeAttendance
          ? monthDays.reduce(
              (acc, day) => acc + (dayAttendance?.[day] === "P" ? 1 : 0),
              0
            )
          : undefined;
        const studentCreatedAt = student.createdAt?.split("T")[0];
        const firstAttendanceDate = options.includeAttendance
          ? firstAttendanceByStudent[student.id]
          : undefined;
        const startDateKey = firstAttendanceDate || studentCreatedAt || "";
        return {
          index: index + 1,
          studentName: student.name,
          birthDate: formatBirthDate(student.birthDate),
          collegeCourse: options.includeCourse ? student.collegeCourse ?? "" : "",
          contactLabel: options.includeContact ? contactLabel : "",
          contactPhone: options.includeContact ? contactPhone : "",
          attendance: options.includeAttendance
            ? monthDays.reduce<Record<number, "P" | "F" | "-" | "">>(
                (acc, day) => {
                  const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
                  if (startDateKey && dateKey < startDateKey) {
                    acc[day] = "-";
                    return acc;
                  }
                  if (todayKey && dateKey > todayKey) {
                    acc[day] = "";
                    return acc;
                  }
                  acc[day] = dayAttendance?.[day] ?? "-";
                  return acc;
                },
                {}
              )
            : undefined,
          total,
        };
      });

      const data = {
        title: "Lista de chamada",
        className,
        ageBand: classAgeBand,
        unitLabel,
        daysLabel: formatDays(classDays),
        timeLabel,
        monthLabel,
        exportDate,
        mode: "full" as const,
        includeAttendance: options.includeAttendance,
        totalStudents: list.length,
        monthDays,
        fundamentals,
        fundamentalKeys: [...ROSTER_FUNDAMENTALS],
        fundamentalsByDay,
        includeBirthDate: options.includeBirthDate,
        includeCourse: options.includeCourse,
        includeContact: options.includeContact,
        includeFundamentals: options.includeFundamentals,
        periodizationLabel,
        coachName: resolvedCoachName?.trim() || "",
        rows,
      };

      const fileDate = exportDate.replaceAll("/", "-");
      const genderCode = getGenderCode(cls.gender);
      const fileName = options.includeAttendance
        ? `lista_chamada_presencas_${safeFileName(className)}_${genderCode}_${fileDate}.pdf`
        : `lista_chamada_${safeFileName(className)}_${genderCode}_${fileDate}.pdf`;

      await exportPdf({
        html: classRosterHtml(data),
        fileName,
        webDocument: <ClassRosterDocument data={data} />,
      });
      logAction("Exportar lista da turma", {
        classId: cls.id,
        month: monthKey,
        includeAttendance: options.includeAttendance,
      });
    } catch (error) {
      Alert.alert("Falha ao exportar lista", "Tente novamente.");
    }
  };

  const handleRosterMonthChange = (value: string) => {
    setRosterMonthValue(value);
  };

  const shiftRosterMonth = (direction: -1 | 1) => {
    setShowRosterColumnsPicker(false);
    setRosterMonthValue((current) => {
      const date = parseIsoDate(current) ?? new Date();
      const next = new Date(date.getFullYear(), date.getMonth() + direction, 1);
      const year = next.getFullYear();
      const month = String(next.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}-01`;
    });
  };

  const handleWhatsAppGroup = async () => {
    if (!cls) return;
    const list = await getStudentsByClass(cls.id);
    const validContacts = list
      .map((student) => {
        const contact = getContactPhone(student);
        return { student, contact };
      })
      .filter((item) => item.contact.status === "ok")
      .map((item) => ({
        studentName: item.student.name,
        phone: item.contact.phoneDigits,
        source: item.contact.source as "guardian" | "student",
      }));

    if (validContacts.length === 0) {
      Alert.alert(
        "Nenhum telefone válido encontrado",
        "Adicione telefones dos responsáveis ou alunos (com DDD) para usar o WhatsApp."
      );
      return;
    }

    setAvailableContacts(validContacts);
    setSelectedContactIndex(-1);

    // Suggest template based on context
    const suggestedTemplate = getSuggestedTemplate({ screen: "class" });
    setSelectedTemplateId(suggestedTemplate);

    // Generate template message if enabled
    if (defaultMessageEnabled) {
      const nextClassDate = calculateNextClassDate(daysOfWeek);
      const message = renderTemplate(suggestedTemplate, {
        coachName: resolvedCoachName,
        className: name || cls.name,
        unitLabel,
        dateLabel: new Date().toLocaleDateString("pt-BR"),
        nextClassDate: nextClassDate ? formatNextClassDate(nextClassDate) : "",
        nextClassTime: startTime,
        groupInviteLink: groupInviteLinks[cls.id] || "",
      });
      setCustomWhatsAppMessage(message);
    } else {
      setCustomWhatsAppMessage("");
    }

    setCustomFields({});
    setShowWhatsAppSettingsModal(true);
  };

  const sendWhatsAppMessage = async () => {
    if (availableContacts.length === 0 || selectedContactIndex < 0) {
      Alert.alert("Selecione um contato", "Por favor, escolha um contato para enviar a mensagem.");
      return;
    }
    const selectedContact = availableContacts[selectedContactIndex];
    if (!selectedContact) return;

    // Usar mensagem customizada se fornecida, se não usar padrão
    let messageText = customWhatsAppMessage.trim();
    if (!messageText) {
      messageText = getDefaultMessage("global", { className, unitLabel, enabledOverride: defaultMessageEnabled });
    }

    const url = buildWaMeLink(selectedContact.phone, messageText);
    await openWhatsApp(url);
    setShowWhatsAppSettingsModal(false);
    setCustomWhatsAppMessage(""); // Limpar a mensagem customizada após envio
  };

  const handleOpenSession = () => {
    if (appliedPlan) {
      setPlanPreviewMode("edit");
      setShowPlanPreviewModal(true);
      return;
    }
    router.push({ pathname: "/class/[id]/planning", params: { id } });
  };

  const handleOpenAttendance = () => {
    router.push({ pathname: "/class/[id]/attendance", params: { id } });
  };

  const handleOpenReport = () => {
    setShowReportModal(true);
  };

  const handleOpenPeriodization = () => {
    const targetClassId = cls?.id ?? id;
    router.push({
      pathname: "/class/[id]/periodization",
      params: {
        id: targetClassId,
        classId: targetClassId,
        unit: cls?.unit ?? "",
        backTo: targetClassId ? `/class/${targetClassId}` : "",
      },
    });
  };

  const handleOpenPlanning = () => {
    router.push({ pathname: "/class/[id]/planning", params: { id } });
  };

  const handleOpenVisualTech = () => {
    if (!cls) return;
    router.push({ pathname: "/class/[id]/visual-tech", params: { id: cls.id } });
  };

  const handleOpenScouting = () => {
    if (!cls) return;
    router.push({ pathname: "/class/[id]/scouting", params: { id: cls.id } });
  };

  const handleOpenStudents = () => {
    router.push({ pathname: "/class/[id]/students", params: { id } });
  };

  const handleOpenAssistant = () => {
    if (!displayedInsight) return;
    router.push({
      pathname: "/assistant",
      params: { classId: id, prefilledInsight: displayedInsight.insight },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScreenPageHeader
          title={className}
          titleAccessory={<ClassGenderBadge gender={classGender} size="md" />}
          onBack={() => navigateBackOrReplace({ router, fallback: "/classes" })}
          right={
            <Pressable
              onPress={() => {
                resetEditFields();
                setShowEditModal(true);
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.secondaryBg,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <GoAtletaIcon name="pencil" size={18} color={colors.text} />
            </Pressable>
          }
          contentStyle={{ paddingTop: 16, paddingBottom: 8 }}
        >
          <ClassContextStrip
            colors={colors}
            compact={compactClassWorkspace}
            unitLabel={unitLabel}
            scheduleLabel={scheduleLabel}
            studentCount={studentCount}
            nextClassLabel={nextClassLabel}
          />
        </ScreenPageHeader>

      <ScrollView
        ref={editScrollRef}
        contentContainerStyle={{
          gap: 16,
          paddingBottom: Math.max(insets.bottom + 220, 236),
          paddingHorizontal: 16,
          paddingTop: 0,
        }}
        keyboardShouldPersistTaps="handled"
      >

        <ClassOperationsWorkspace
          colors={colors}
          compact={compactClassWorkspace}
          scheduleLabel={scheduleLabel}
          lessonDateLabel={lessonDateLabel}
          appliedPlan={appliedPlan}
          isLoadingLessonPlan={isLoadingLessonPlan}
          onPreviousLesson={() => handleShiftLessonDate(-1)}
          onNextLesson={() => handleShiftLessonDate(1)}
          onViewPlan={handleViewAppliedPlan}
          onGeneratePlan={handleGeneratePlan}
          isGeneratingPlan={isGeneratingPlan}
          contextualInsight={displayedInsight ? (
            <InsightCard
              compact
              embedded
              insight={displayedInsight}
              onDismiss={dismissDisplayedInsight}
              onOpenAssistant={handleOpenAssistant}
            />
          ) : null}
          studentCount={studentCount}
          contactStatusValue={contactStatusValue}
          contactStatusLabel={contactStatusLabel}
          reportStatusValue={reportStatusValue}
          reportStatusLabel={reportStatusLabel}
          onOpenSession={handleOpenSession}
          onOpenAttendance={handleOpenAttendance}
          onOpenReport={handleOpenReport}
          onOpenPeriodization={handleOpenPeriodization}
          onOpenPlanning={handleOpenPlanning}
          onOpenVisualTech={handleOpenVisualTech}
          onOpenScouting={handleOpenScouting}
          onOpenStudents={handleOpenStudents}
          onExportRoster={handleExportRoster}
          onOpenWhatsApp={handleWhatsAppGroup}
        />

      </ScrollView>

      <ModalSheet
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        position="center"
        cardStyle={[
          reportModalCardStyle,
          {
            height: compactClassWorkspace ? "94%" : "88%",
            overflow: "hidden",
          },
        ]}
      >
        {showReportModal ? (
          <SessionScreen
            embeddedReport
            embeddedDate={selectedLessonDateKey}
            onCloseEmbeddedReport={() => setShowReportModal(false)}
          />
        ) : null}
      </ModalSheet>

      {appliedPlan && cls ? (
        <ClassPlanPreviewModal
          visible={showPlanPreviewModal}
          onClose={() => setShowPlanPreviewModal(false)}
          plan={appliedPlan}
          classGroup={cls}
          lessonDate={selectedLessonDateKey}
          coachName={resolvedCoachName}
          initialMode={planPreviewMode}
          onSavePlan={handleSaveAppliedPlan}
          onRemovePlan={handleRemoveAppliedPlan}
        />
      ) : null}
      </KeyboardAvoidingView>

      <ModalSheet
        visible={showEditModal}
        onClose={requestCloseEditModal}
        position="center"
        cardStyle={[editModalCardStyle, { height: Platform.OS === "web" ? "92%" : "96%" }]}
      >
        <View
          ref={editContainerRef}
          onLayout={() => {
            editContainerRef.current?.measureInWindow((x, y) => {
              setEditContainerWindow({ x, y });
            });
          }}
          style={{ flex: 1, minHeight: 0, gap: 12, position: "relative" }}
        >
          <ConfirmCloseOverlay
            visible={showEditCloseConfirm}
            onCancel={() => setShowEditCloseConfirm(false)}
            onConfirm={closeEditModal}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
                Editar turma
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {cls?.name ? cls.name : "Ajuste os dados, agenda e perfil da turma."}
              </Text>
            </View>
            <Pressable
              onPress={requestCloseEditModal}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <GoAtletaIcon name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <ScrollView
              style={[
                { width: "100%", flex: 1 },
                Platform.OS === "web"
                  ? ({
                      overflowX: "hidden",
                      overflowY: "scroll",
                      scrollbarWidth: "thin",
                      scrollbarColor: `${colors.border} transparent`,
                      scrollbarGutter: "stable",
                    } as any)
                  : null,
              ]}
              contentContainerStyle={{ gap: 10, paddingBottom: 24, paddingRight: 8 }}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={closeEditPickers}
              showsVerticalScrollIndicator
            >
              <ClassEditModalBody
                renderPickers={false}
              refs={{
                editContainerRef,
                editCycleLengthTriggerRef,
                editMvLevelTriggerRef,
                editAgeBandTriggerRef,
                editGenderTriggerRef,
                editModalityTriggerRef,
                editGoalTriggerRef,
              }}
              layouts={{
                editContainerWindow,
                editCycleLengthTriggerLayout,
                editMvLevelTriggerLayout,
                editAgeBandTriggerLayout,
                editGenderTriggerLayout,
                editModalityTriggerLayout,
                editGoalTriggerLayout,
              }}
              pickers={{
                showEditCycleLengthPicker,
                showEditMvLevelPicker,
                showEditAgeBandPicker,
                showEditGenderPicker,
                showEditModalityPicker,
                showEditGoalPicker,
                showEditCycleLengthPickerContent,
                showEditMvLevelPickerContent,
                showEditAgeBandPickerContent,
                showEditGenderPickerContent,
                showEditModalityPickerContent,
                showEditGoalPickerContent,
                editCycleLengthPickerAnimStyle,
                editMvLevelPickerAnimStyle,
                editAgeBandPickerAnimStyle,
                editGenderPickerAnimStyle,
                editModalityPickerAnimStyle,
                editGoalPickerAnimStyle,
                showEditCycleCalendar,
              }}
              fields={{
                editName: name,
                setEditName: setName,
                editUnit: unit,
                setEditUnit: setUnit,
                editColorOptions: colorOptions,
                editColorKey: classColorKey,
                handleSelectEditColor: handleSelectClassColor,
                editStartTime: startTime,
                setEditStartTime: setStartTime,
                normalizeTimeInput,
                editEndTime: endTime,
                setEditEndTime: setEndTime,
                editDuration: duration,
                editCycleStartDate: cycleStartDate,
                setEditCycleStartDate: setCycleStartDate,
                editCycleLengthWeeks: cycleLengthWeeks,
                editMvLevel: mvLevel,
                editAgeBand: ageBand,
                setEditAgeBand: setAgeBand,
                editShowCustomAgeBand: showEditCustomAgeBand,
                editCustomAgeBand,
                setEditCustomAgeBand,
                editGender: gender,
                editModality: modality,
                editGoal: goal,
                editCustomGoal,
                setEditCustomGoal,
                setEditGoal: setGoal,
                editDays: daysOfWeek,
                toggleEditDay: toggleDay,
                editFormError: formError,
                editSaving: saving,
                isEditDirty,
                editShowCustomGoal: showEditCustomGoal,
              }}
              options={{
                dayNames,
                cycleLengthOptions,
                ageBandOptions,
                genderOptions: genderOptions.map((value) => ({
                  value,
                  label: value === 'misto' ? 'Misto' : value === 'feminino' ? 'Feminino' : 'Masculino',
                })),
                modalityOptions,
                mvLevelOptions,
                goalOptions,
                customOptionLabel: 'Personalizar',
              }}
              actions={{
                closeAllPickers: closeEditPickers,
                toggleEditPicker,
                handleEditSelectCycleLength,
                handleEditSelectMvLevel,
                handleEditSelectAgeBand: (value) => {
                  const selected = String(value);
                  if (selected === "Personalizar") {
                    setShowEditCustomAgeBand(true);
                    setEditCustomAgeBand(ageBandOptions.includes(ageBand) ? "" : ageBand);
                  } else {
                    setShowEditCustomAgeBand(false);
                    setEditCustomAgeBand(selected);
                    setAgeBand(selected as ClassGroup["ageBand"]);
                  }
                  closeEditPickers();
                },
                handleEditSelectGender: (value) => {
                  setGender(String(value) as ClassGroup['gender']);
                  closeEditPickers();
                },
                handleEditSelectModality,
                handleEditSelectGoal: (value) => {
                  const selected = String(value);
                  if (selected === "Personalizar") {
                    setShowEditCustomGoal(true);
                    setEditCustomGoal(goal && goalOptions.includes(goal) ? "" : goal);
                  } else {
                    setShowEditCustomGoal(false);
                    setEditCustomGoal(selected);
                    setGoal(selected);
                  }
                  closeEditPickers();
                },
                saveEditClass: handleSaveEdit,
                handleDeleteClass: onDelete,
                setShowEditCycleCalendar,
              }}
            />
            </ScrollView>
          </View>

          <View
            style={{
              gap: 10,
              paddingTop: 12,
              paddingBottom: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={saving ? "Salvando..." : "Salvar alterações"}
                  onPress={handleSaveEdit}
                  disabled={saving || !name.trim() || !isEditDirty}
                  loading={saving}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Excluir turma"
                  variant="danger"
                  onPress={onDelete}
                  disabled={saving}
                  loading={false}
                />
              </View>
            </View>
          </View>

          <ClassEditModalPickers
            refs={{
              editContainerRef,
              editCycleLengthTriggerRef,
              editMvLevelTriggerRef,
              editAgeBandTriggerRef,
              editGenderTriggerRef,
              editModalityTriggerRef,
              editGoalTriggerRef,
            }}
            layouts={{
              editContainerWindow,
              editCycleLengthTriggerLayout,
              editMvLevelTriggerLayout,
              editAgeBandTriggerLayout,
              editGenderTriggerLayout,
              editModalityTriggerLayout,
              editGoalTriggerLayout,
            }}
            pickers={{
              showEditCycleLengthPicker,
              showEditMvLevelPicker,
              showEditAgeBandPicker,
              showEditGenderPicker,
              showEditModalityPicker,
              showEditGoalPicker,
              showEditCycleLengthPickerContent,
              showEditMvLevelPickerContent,
              showEditAgeBandPickerContent,
              showEditGenderPickerContent,
              showEditModalityPickerContent,
              showEditGoalPickerContent,
              editCycleLengthPickerAnimStyle,
              editMvLevelPickerAnimStyle,
              editAgeBandPickerAnimStyle,
              editGenderPickerAnimStyle,
              editModalityPickerAnimStyle,
              editGoalPickerAnimStyle,
              showEditCycleCalendar,
            }}
            fields={{
              editName: name,
              setEditName: setName,
              editUnit: unit,
              setEditUnit: setUnit,
              editColorOptions: colorOptions,
              editColorKey: classColorKey,
              handleSelectEditColor: handleSelectClassColor,
              editStartTime: startTime,
              setEditStartTime: setStartTime,
              normalizeTimeInput,
              editEndTime: endTime,
              setEditEndTime: setEndTime,
              editDuration: duration,
              editCycleStartDate: cycleStartDate,
              setEditCycleStartDate: setCycleStartDate,
              editCycleLengthWeeks: cycleLengthWeeks,
              editMvLevel: mvLevel,
              editAgeBand: ageBand,
              setEditAgeBand: setAgeBand,
              editShowCustomAgeBand: showEditCustomAgeBand,
              editCustomAgeBand,
              setEditCustomAgeBand,
              editGender: gender,
              editModality: modality,
              editGoal: goal,
              editCustomGoal,
              setEditCustomGoal,
              setEditGoal: setGoal,
              editDays: daysOfWeek,
              toggleEditDay: toggleDay,
              editFormError: formError,
              editSaving: saving,
              isEditDirty,
              editShowCustomGoal: showEditCustomGoal,
            }}
            options={{
              dayNames,
              cycleLengthOptions,
              ageBandOptions,
              genderOptions: genderOptions.map((value) => ({
                value,
                label: value === "misto" ? "Misto" : value === "feminino" ? "Feminino" : "Masculino",
              })),
              modalityOptions,
              mvLevelOptions,
              goalOptions,
              customOptionLabel: "Personalizar",
            }}
            actions={{
              closeAllPickers: closeEditPickers,
              toggleEditPicker,
              handleEditSelectCycleLength,
              handleEditSelectMvLevel,
              handleEditSelectAgeBand: (value) => {
                const selected = String(value);
                if (selected === "Personalizar") {
                  setShowEditCustomAgeBand(true);
                  setEditCustomAgeBand(ageBandOptions.includes(ageBand) ? "" : ageBand);
                } else {
                  setShowEditCustomAgeBand(false);
                  setEditCustomAgeBand(selected);
                  setAgeBand(selected as ClassGroup["ageBand"]);
                }
                closeEditPickers();
              },
              handleEditSelectGender: (value) => {
                setGender(String(value) as ClassGroup["gender"]);
                closeEditPickers();
              },
              handleEditSelectModality,
                handleEditSelectGoal: (value) => {
                const selected = String(value);
                if (selected === "Personalizar") {
                  setShowEditCustomGoal(true);
                  setEditCustomGoal(goal && goalOptions.includes(goal) ? "" : goal);
                } else {
                  setShowEditCustomGoal(false);
                  setEditCustomGoal(selected);
                  setGoal(selected);
                }
                closeEditPickers();
              },
              saveEditClass: handleSaveEdit,
              handleDeleteClass: onDelete,
              setShowEditCycleCalendar,
            }}
          />
        </View>

      </ModalSheet>

      <DatePickerModal
        visible={showEditCycleCalendar}
        value={cycleStartDate}
        onChange={(value) => setCycleStartDate(value)}
        onClose={() => setShowEditCycleCalendar(false)}
        closeOnSelect={false}
        initialViewMode="day"
      />

      <ModalSheet
        visible={showRosterExportModal}
        onClose={closeRosterExportModal}
        position="center"
        cardStyle={[
          rosterModalCardStyle,
          {
            height: rosterModalHeight,
            minHeight: 560,
            overflow: "hidden",
          },
        ]}
      >
        <View style={{ flex: 1, minHeight: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Exportar lista de chamada
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View ref={rosterColumnsTriggerRef} style={{ width: rosterColumnsHeaderWidth }}>
                <Pressable
                  onPress={toggleRosterColumnsPicker}
                  accessibilityRole="button"
                  accessibilityLabel="Selecionar colunas do PDF"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                gap: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                borderRadius: 12,
                borderWidth: 1,
                    borderColor: showRosterColumnsPicker ? colors.primaryBg : colors.border,
                backgroundColor: colors.inputBg,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      Colunas do PDF
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>
                      {selectedRosterColumnsLabel}
                    </Text>
                  </View>
                  <GoAtletaIcon
                    name={showRosterColumnsPicker ? "chevronUp" : "chevronDown"}
                    size={16}
                    color={colors.muted}
                  />
                </Pressable>
              </View>
              <Pressable
                onPress={closeRosterExportModal}
                accessibilityRole="button"
                accessibilityLabel="Fechar exportação da lista"
                style={{
                  height: 34,
                  width: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <GoAtletaIcon name="close" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            showsVerticalScrollIndicator
            onScrollBeginDrag={() => setShowRosterColumnsPicker(false)}
            contentContainerStyle={{ gap: 14, paddingBottom: 18, paddingTop: 14 }}
          >

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
              Mês da lista
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Pressable
                onPress={() => shiftRosterMonth(-1)}
                accessibilityRole="button"
                accessibilityLabel="Mês anterior"
                hitSlop={8}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <GoAtletaIcon name="chevronBack" size={20} color={colors.muted} />
              </Pressable>
              <Pressable
                onPress={openRosterMonthPicker}
                accessibilityRole="button"
                accessibilityLabel="Escolher mês da lista"
                style={{
                  flex: 1,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", textAlign: "center" }}>
                  {formatMonthLabel(rosterMonthValue)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => shiftRosterMonth(1)}
                accessibilityRole="button"
                accessibilityLabel="Próximo mês"
                hitSlop={8}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <GoAtletaIcon name="chevronForward" size={20} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          {rosterExportOptions.includeFundamentals && hasRosterFundamentalOverrides ? (
            <View style={{ alignItems: "flex-end" }}>
              <Pressable
                onPress={clearRosterFundamentalOverrides}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                  Limpar ajustes
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 10,
              gap: 8,
              backgroundColor: colors.inputBg,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                  Matriz de fundamentos
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                  {rosterExportOptions.includeFundamentals
                    ? "Vai para o PDF e pode ser editada."
                    : "Fora do PDF e bloqueada para edição."}
                </Text>
              </View>
              <Pressable
                onPress={toggleRosterFundamentalsExport}
                accessibilityRole="switch"
                accessibilityState={{ checked: rosterExportOptions.includeFundamentals }}
                accessibilityLabel="Incluir matriz de fundamentos no PDF"
                style={{
                  width: 54,
                  height: 30,
                  alignItems: rosterExportOptions.includeFundamentals ? "flex-end" : "flex-start",
                  justifyContent: "center",
                  padding: 3,
                  borderRadius: 999,
                  backgroundColor: rosterExportOptions.includeFundamentals
                    ? colors.primaryBg
                    : colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: rosterExportOptions.includeFundamentals
                    ? colors.primaryBg
                    : colors.border,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    backgroundColor: rosterExportOptions.includeFundamentals
                      ? colors.primaryText
                      : colors.muted,
                  }}
                />
              </Pressable>
            </View>
            <View style={{ opacity: rosterExportOptions.includeFundamentals ? 1 : 0.42 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: colors.card,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.secondaryBg,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      width: 132,
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      fontSize: 10,
                      fontWeight: "700",
                      color: colors.text,
                      borderRightWidth: 1,
                      borderRightColor: colors.border,
                    }}
                  >
                    Fundamento
                  </Text>
                  {rosterPreviewDays.map((day) => (
                    <Text
                      key={`matrix-head-${day}`}
                      style={{
                        width: 28,
                        paddingVertical: 8,
                        textAlign: "center",
                        fontSize: 10,
                        fontWeight: "700",
                        color: colors.text,
                        borderRightWidth: 1,
                        borderRightColor: colors.border,
                      }}
                    >
                      {day}
                    </Text>
                  ))}
                </View>

                {rosterFundamentalLabels.map((fundamentalLabel, index) => {
                  const fundamentalKey = ROSTER_FUNDAMENTALS[index] ?? fundamentalLabel;
                  const isEditing =
                    rosterExportOptions.includeFundamentals &&
                    editingRosterFundamentalIndex === index;
                  return (
                    <View
                      key={`matrix-row-${fundamentalKey}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderBottomWidth:
                          index === rosterFundamentalLabels.length - 1 ? 0 : 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      {isEditing ? (
                        <View
                          style={{
                            width: 132,
                            paddingVertical: 7,
                            paddingHorizontal: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            borderRightWidth: 1,
                            borderRightColor: colors.border,
                            backgroundColor: colors.card,
                          }}
                        >
                          <TextInput
                            autoFocus
                            value={editingRosterFundamentalValue}
                            onChangeText={setEditingRosterFundamentalValue}
                            onSubmitEditing={saveRosterFundamentalLabel}
                            onBlur={saveRosterFundamentalLabel}
                            blurOnSubmit
                            placeholder="Nome do fundamento"
                            placeholderTextColor={colors.muted}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: 0,
                              margin: 0,
                              fontSize: 10,
                              color: colors.text,
                            }}
                          />
                        </View>
                      ) : (
                        <Pressable
                          disabled={!rosterExportOptions.includeFundamentals}
                          onPress={() => beginRosterFundamentalEdit(index)}
                          style={{
                            width: 132,
                            paddingVertical: 7,
                            paddingHorizontal: 8,
                            borderRightWidth: 1,
                            borderRightColor: colors.border,
                            backgroundColor: colors.card,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 10,
                              color: colors.text,
                            }}
                          >
                            {fundamentalLabel}
                          </Text>
                        </Pressable>
                      )}
                      {rosterPreviewDays.map((day) => {
                        const active = rosterFundamentalsByDay[day]?.includes(fundamentalKey) ?? false;
                        return (
                          <Pressable
                            key={`matrix-${fundamentalKey}-${day}`}
                            disabled={!rosterExportOptions.includeFundamentals}
                            onPress={() => toggleRosterFundamentalCell(day, fundamentalKey)}
                            accessibilityRole="checkbox"
                            accessibilityState={{
                              checked: active,
                              disabled: !rosterExportOptions.includeFundamentals,
                            }}
                            style={{
                              width: 28,
                              minHeight: 28,
                              alignItems: "center",
                              justifyContent: "center",
                              borderRightWidth: 1,
                              borderRightColor: colors.border,
                              backgroundColor: active ? colors.primaryBg : colors.card,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "800",
                                color: active ? colors.primaryText : colors.muted,
                              }}
                            >
                              {active ? "X" : ""}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

        </ScrollView>
        <View
          style={{
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => {
              closeRosterExportModal();
              void exportRosterPdf(rosterMonthValue, rosterExportOptions);
            }}
            style={{
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 14 }}>
              Baixar PDF
            </Text>
          </Pressable>
        </View>
        <AnchoredDropdown
          visible={showRosterColumnsPicker}
          layout={rosterColumnsTriggerLayout}
          container={null}
          animationStyle={{ opacity: 1 }}
          zIndex={5000}
          maxHeight={240}
          nestedScrollEnabled
          onRequestClose={() => setShowRosterColumnsPicker(false)}
          interactiveRefs={[rosterColumnsTriggerRef]}
          portalToBodyOnWeb
          panelStyle={{ borderRadius: 14 }}
          scrollContentStyle={{ padding: 6, gap: 4 }}
        >
          {ROSTER_COLUMN_OPTIONS.map((option) => {
            const active = rosterExportOptions[option.key];
            return (
              <Pressable
                key={option.key}
                onPress={() => toggleRosterBooleanOption(option.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 9,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: active ? colors.primaryBg : colors.card,
                  borderWidth: 1,
                  borderColor: active ? colors.primaryBg : colors.border,
                }}
              >
                <GoAtletaIcon
                  name={active ? "checkbox" : "square"}
                  size={18}
                  color={active ? colors.primaryText : colors.text}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: active ? colors.primaryText : colors.text,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </AnchoredDropdown>
        </View>
      </ModalSheet>

      <ModalSheet
        visible={showWhatsAppSettingsModal}
        onClose={() => setShowWhatsAppSettingsModal(false)}
        cardStyle={[
          whatsappModalCardStyle,
          {
            overflow: "hidden",
          },
        ]}
        position="center"
      >
        <ScrollView
          style={{ maxHeight: "100%" }}
          contentContainerStyle={{ gap: 12, paddingBottom: 6 }}
          showsVerticalScrollIndicator
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Configurar WhatsApp
          </Text>

          {/* Template Selector */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: whatsappModalMuted }}>
              Modelo de mensagem:
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web" || typeof document === "undefined") return;
                  const scrollView = document.querySelector('[data-template-scroll-class]');
                  if (scrollView) scrollView.scrollBy({ left: -200, behavior: 'smooth' });
                }}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: whatsappModalSubtleSurface,
                  borderWidth: 1,
                  borderColor: whatsappModalBorder,
                }}
              >
                <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
              </Pressable>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingRight: 8 }}
                {...(Platform.OS === "web" ? { "data-template-scroll-class": true } : {})}
              >
              {Object.values(WHATSAPP_TEMPLATES)
                .filter((template) => template.id !== "student_invite")
                .map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const nextClassDate = calculateNextClassDate(daysOfWeek);

                let canUse = true;
                let missingRequirement = "";

                if (template.requires) {
                  for (const req of template.requires) {
                    if ((req === "nextClassDate" || req === "nextClassTime") && !nextClassDate) {
                      canUse = false;
                      missingRequirement = "Dias da semana não configurados";
                      break;
                    }
                    if (req === "groupInviteLink" && !groupInviteLinks[cls?.id || ""]) {
                      canUse = false;
                      missingRequirement = "Link do grupo não configurado";
                      break;
                    }
                  }
                }

                return (
                  <Pressable
                    key={template.id}
                    disabled={!canUse}
                    onPress={() => {
                      if (!canUse) {
                        alert(missingRequirement);
                        return;
                      }
                      setSelectedTemplateId(template.id);
                      if (defaultMessageEnabled) {
                        const message = renderTemplate(template.id, {
                          coachName,
                          className: name || cls?.name || "",
                          unitLabel,
                          dateLabel: new Date().toLocaleDateString("pt-BR"),
                          studentName: selectedContactIndex >= 0 ? availableContacts[selectedContactIndex]?.studentName : "",
                          nextClassDate: nextClassDate ? formatNextClassDate(nextClassDate) : "",
                          nextClassTime: startTime,
                          groupInviteLink: groupInviteLinks[cls?.id || ""] || "",
                          ...customFields,
                        });
                        setCustomWhatsAppMessage(message);
                      }
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: isSelected ? whatsappSelectedBg : whatsappModalSubtleSurface,
                      borderWidth: 1,
                      borderColor: isSelected ? whatsappSelectedBorder : whatsappModalBorder,
                      marginRight: 6,
                      opacity: canUse ? 1 : 0.4,
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: isSelected ? whatsappSelectedText : colors.text
                    }}>
                      {template.title}
                    </Text>
                    {!canUse && (
                      <Text style={{ fontSize: 9, color: colors.dangerText, marginTop: 2 }}>
                        Aviso: {missingRequirement}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
              </ScrollView>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web" || typeof document === "undefined") return;
                  const scrollView = document.querySelector('[data-template-scroll-class]');
                  if (scrollView) scrollView.scrollBy({ left: 200, behavior: 'smooth' });
                }}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: whatsappModalSubtleSurface,
                  borderWidth: 1,
                  borderColor: whatsappModalBorder,
                }}
              >
                <GoAtletaIcon name="chevronForward" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Custom Fields for Templates */}
          {selectedTemplateId && WHATSAPP_TEMPLATES[selectedTemplateId].requires && (
            <View style={{ gap: 6 }}>
              {WHATSAPP_TEMPLATES[selectedTemplateId].requires?.map((field) => {
                if (field === "nextClassDate" || field === "nextClassTime" || field === "groupInviteLink") return null;

                const labels: Record<string, string> = {
                  highlightNote: "Destaque (opcional):",
                  customText: "Mensagem do aviso:",
                };

                return (
                  <View key={field}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: whatsappModalMuted, marginBottom: 4 }}>
                      {labels[field] || field}
                    </Text>
                    <TextInput
                      placeholder={field === "highlightNote" ? "Ex.: evolução na técnica" : "Digite sua mensagem..."}
                      placeholderTextColor={whatsappModalMuted}
                      value={customFields[field] || ""}
                      onChangeText={(text) => {
                        const updated = { ...customFields, [field]: text };
                        setCustomFields(updated);
                        if (defaultMessageEnabled && selectedTemplateId) {
                          const nextClassDate = calculateNextClassDate(daysOfWeek);
                          const message = renderTemplate(selectedTemplateId, {
                            coachName,
                            className: name || cls?.name || "",
                            unitLabel,
                            dateLabel: new Date().toLocaleDateString("pt-BR"),
                            studentName: selectedContactIndex >= 0 ? availableContacts[selectedContactIndex]?.studentName : "",
                            nextClassDate: nextClassDate ? formatNextClassDate(nextClassDate) : "",
                            nextClassTime: startTime,
                            groupInviteLink: groupInviteLinks[cls?.id || ""] || "",
                            ...updated,
                          });
                          setCustomWhatsAppMessage(message);
                        }
                      }}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: whatsappModalSubtleSurface,
                        borderWidth: 1,
                        borderColor: whatsappModalBorder,
                        color: colors.text,
                        fontSize: 12,
                      }}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Lista da turma */}
          {availableContacts.length > 0 && (
            <View style={{ gap: 8 }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                  Lista da turma
                </Text>
                <Text style={{ fontSize: 11, color: whatsappModalMuted }}>
                  Selecione quem vai receber a mensagem.
                </Text>
              </View>
              <TextInput
                placeholder="Buscar por nome ou telefone"
                placeholderTextColor={whatsappModalMuted}
                value={contactSearch}
                onChangeText={setContactSearch}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: whatsappModalSubtleSurface,
                  borderWidth: 1,
                  borderColor: whatsappModalBorder,
                  color: colors.text,
                  fontSize: 12,
                }}
              />
              <View
                style={{
                  maxHeight: 260,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: whatsappModalBorder,
                  backgroundColor: colors.background,
                  overflow: "hidden",
                }}
              >
                <FlatList
                  data={filteredContacts}
                  keyExtractor={({ contact }) => `${contact.studentName}-${contact.phone}-${contact.source}`}
                  style={{ maxHeight: 260 }}
                  contentContainerStyle={{ padding: 6, gap: 6 }}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  ListEmptyComponent={
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: whatsappModalMuted, fontSize: 12 }}>
                        Nenhum contato encontrado.
                      </Text>
                    </View>
                  }
                  renderItem={({ item: { contact, index } }) => (
                    <View style={{ marginBottom: 6 }}>
                      <WhatsAppContactRow
                        contact={contact}
                        index={index}
                        isSelected={selectedContactIndex === index}
                        onSelect={handleSelectContact}
                        colors={colors}
                        subtleSurface={whatsappModalSubtleSurface}
                        borderColor={whatsappModalBorder}
                        mutedColor={whatsappModalMuted}
                      />
                    </View>
                  )}
                />
              </View>
            </View>
          )}

          {/* Toggle */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                Mensagem padrão
              </Text>
              <Text style={{ fontSize: 12, color: whatsappModalMuted }}>
                {defaultMessageEnabled ? "Ativada" : "Desativada"}
              </Text>
            </View>
            <Pressable
              onPress={() => setDefaultMessageEnabled(!defaultMessageEnabled)}
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                backgroundColor: defaultMessageEnabled ? colors.successBg : colors.secondaryBg,
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  marginLeft: defaultMessageEnabled ? 22 : 2,
                  position: "absolute",
                }}
              />
            </Pressable>
          </View>

          {/* Message Input */}
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: whatsappModalMuted }}>
              {defaultMessageEnabled ? "Mensagem (deixe em branco para usar padrão):" : "Mensagem personalizada:"}
            </Text>
            <TextInput
              placeholder={defaultMessageEnabled ? `Exemplo: Olá! Sou o professor Gustavo da turma ${className} (${unitLabel}).` : "Digite sua mensagem..."}
              placeholderTextColor={whatsappModalMuted}
              value={customWhatsAppMessage}
              onChangeText={setCustomWhatsAppMessage}
              multiline
              numberOfLines={3}
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: whatsappModalSubtleSurface,
                borderWidth: 1,
                borderColor: whatsappModalBorder,
                color: colors.text,
                fontSize: 12,
                textAlignVertical: "top",
              }}
            />
            {defaultMessageEnabled && !customWhatsAppMessage.trim() && (
              <Text style={{ fontSize: 10, color: whatsappModalMuted, fontStyle: "italic" }}>
                {`Mensagem padrão: "Olá! Sou o professor Gustavo da turma ${className} (${unitLabel})."`}
              </Text>
            )}
          </View>

          {/* Send Button */}
          <Pressable
            onPress={selectedContactIndex >= 0 ? sendWhatsAppMessage : undefined}
            disabled={selectedContactIndex < 0}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: selectedContactIndex >= 0 ? colors.successBg : colors.primaryDisabledBg,
              alignItems: "center",
              marginTop: 8,
              opacity: selectedContactIndex >= 0 ? 1 : 0.6,
            }}
          >
            <Text style={{ color: selectedContactIndex >= 0 ? colors.primaryText : whatsappModalMuted, fontWeight: "700", fontSize: 14 }}>
              Enviar via WhatsApp
            </Text>
          </Pressable>

          {/* Close Button */}
          <Pressable
            onPress={() => setShowWhatsAppSettingsModal(false)}
            style={{
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
              Fechar
            </Text>
          </Pressable>
        </ScrollView>
      </ModalSheet>
      <DatePickerModal
        visible={showRosterMonthPicker}
        value={rosterMonthValue}
        onChange={handleRosterMonthChange}
        onClose={() => {
          setShowRosterMonthPicker(false);
        }}
        closeOnSelect
        initialViewMode="month"
      />
    </SafeAreaView>
  );
}
