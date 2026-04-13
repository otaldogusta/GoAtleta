import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
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

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenLoadingState } from "../../src/components/ui/ScreenLoadingState";
import { ScreenTopChrome } from "../../src/components/ui/ScreenTopChrome";
import { useCopilotContext } from "../../src/copilot/CopilotProvider";
import type { ClassGroup, ScoutingLog, Student, TrainingPlan } from "../../src/core/models";
import {
    ROSTER_FUNDAMENTALS,
    buildRosterFundamentalsByDay,
    buildRosterMonthEntries,
    getBlockForToday,
    getSuggestedFundamentalsForClass,
    type RosterFundamental,
} from "../../src/core/periodization";
import {
    countsFromLog,
    getFocusSuggestion,
    getSkillMetrics,
    scoutingSkills,
} from "../../src/core/scouting";
import {
    deleteClassCascade,
    duplicateClass,
    getAttendanceByClass,
    getClassById,
    getClasses,
    getLatestScoutingLog,
    getStudentsByClass,
    getTrainingPlans,
    updateClass,
    updateClassColor,
} from "../../src/db/seed";
import { logAction } from "../../src/observability/breadcrumbs";
import { markRender, measure, measureAsync } from "../../src/observability/perf";
import { ClassRosterDocument } from "../../src/pdf/class-roster-document";
import { exportPdf, safeFileName } from "../../src/pdf/export-pdf";
import { classRosterHtml } from "../../src/pdf/templates/class-roster";
import {
    ClassEditModalBody,
    ClassEditModalPickers,
} from "../../src/screens/classes/components/ClassEditModalBody";
import { useAppTheme } from "../../src/ui/app-theme";
import { getClassColorOptions, getClassPalette } from "../../src/ui/class-colors";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { DatePickerModal } from "../../src/ui/DatePickerModal";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { ShimmerBlock } from "../../src/ui/Shimmer";
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
    calculateNextClassDate,
    formatNextClassDate,
    getSuggestedTemplate,
    renderTemplate
} from "../../src/utils/whatsapp-templates";

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
  includeCourse: true,
  includeContact: false,
  includeFundamentals: true,
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
  {
    key: "includeFundamentals" as const,
    label: "Fundamentos",
    description: "Quadro automático da periodização",
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
      <MaterialCommunityIcons
        name={isSelected ? "check-circle" : "circle-outline"}
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
  const rosterModalCardStyle = useModalCardStyle({ maxHeight: "86%", maxWidth: 820 });
  const isCompactEditModal = Platform.OS !== "web" && windowWidth <= 760;
  const editModalCardStyle = useModalCardStyle({
    maxHeight: Platform.OS === "web" ? "92%" : "96%",
    maxWidth: isCompactEditModal ? 700 : 960,
    padding: 16,
    radius: 16,
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
  const [showClassFabMenu, setShowClassFabMenu] = useState(false);
  const classFabAnim = useRef(new Animated.Value(0)).current;
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoutingLoading, setScoutingLoading] = useState(true);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [showEditAgeBandPicker, setShowEditAgeBandPicker] = useState(false);
  const [showEditGenderPicker, setShowEditGenderPicker] = useState(false);
  const [showEditGoalPicker, setShowEditGoalPicker] = useState(false);
  const [editContainerWindow, setEditContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const editScrollRef = useRef<ScrollView | null>(null);
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
  const [editGoalTriggerLayout, setEditGoalTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const editContainerRef = useRef<View>(null);
  const editAgeBandTriggerRef = useRef<View>(null);
  const editGenderTriggerRef = useRef<View>(null);
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
  const [ageBand, setAgeBand] = useState<ClassGroup["ageBand"]>("08-09");
  const [gender, setGender] = useState<ClassGroup["gender"]>("misto");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:00");
  const [duration, setDuration] = useState("60");
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
  const classFabBottom = Math.max(insets.bottom + 166, 182);
  const classFabMenuBottom = classFabBottom + 74;
  const {
    animatedStyle: editAgeBandPickerAnimStyle,
    isVisible: showEditAgeBandPickerContent,
  } = useCollapsibleAnimation(showEditAgeBandPicker, { translateY: -6 });
  const {
    animatedStyle: editGenderPickerAnimStyle,
    isVisible: showEditGenderPickerContent,
  } = useCollapsibleAnimation(showEditGenderPicker, { translateY: -6 });
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

  useEffect(() => {
    const durationMinutes = parseDurationFromTimeRange(startTime, endTime);
    setDuration(durationMinutes ? String(durationMinutes) : "");
  }, [endTime, startTime]);

  const rosterMonthEntries = useMemo(
    () => (cls ? buildRosterMonthEntries(rosterMonthValue, cls.daysOfWeek) : []),
    [cls, rosterMonthValue]
  );
  const rosterPreviewDays = useMemo(
    () => rosterMonthEntries.map((entry) => entry.day),
    [rosterMonthEntries]
  );
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
  const rosterPreviewStudents = useMemo(() => classStudents.slice(0, 3), [classStudents]);
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

  const scoutingCounts = useMemo(() => {
    if (!latestScouting) return null;
    return countsFromLog(latestScouting);
  }, [latestScouting]);

  const scoutingFocus = useMemo(() => {
    if (!scoutingCounts) return null;
    return getFocusSuggestion(scoutingCounts, 10);
  }, [scoutingCounts]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setScoutingLoading(true);
      try {
        const dataResult = await measureAsync(
          "screen.classDetails.load.initial",
          () => getClassById(id),
          { screen: "classDetails", classId: id }
        );
        if (alive) {
          const data = dataResult;
          setCls(data);
          setName(data?.name ?? "");
          setUnit(data?.unit ?? "");
          setAgeBand(data?.ageBand ?? "08-09");
          setGender(data?.gender ?? "misto");
          setStartTime(data?.startTime ?? "14:00");
          setEndTime(
            data?.endTime ?? computeEndTimeFromDuration(data?.startTime ?? "14:00", data?.durationMinutes ?? 60)
          );
          setDuration(String(data?.durationMinutes ?? 60));
          setDaysOfWeek(data?.daysOfWeek ?? []);
          setGoal(data?.goal ?? "Fundamentos");
          setClassColorKey(data?.colorKey ?? null);
          setCoachNameOverride(
            data?.id ? coachNameByClass[data.id] ?? "" : ""
          );
          setLoading(false);
        }
        void (async () => {
          try {
            const scouting = await getLatestScoutingLog(id);
            if (!alive) return;
            setLatestScouting(scouting);
          } catch {
            if (!alive) return;
            setLatestScouting(null);
          } finally {
            if (alive) setScoutingLoading(false);
          }
        })();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [coachNameByClass, id]);

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
    setName(cls.name ?? "");
    setCoachNameOverride(classCoachName);
    setUnit(cls.unit ?? "");
    setAgeBand(cls.ageBand ?? "08-09");
    setGender(cls.gender ?? "misto");
    setStartTime(cls.startTime ?? "14:00");
    setEndTime(
      cls.endTime ?? computeEndTimeFromDuration(cls.startTime ?? "14:00", cls.durationMinutes ?? 60)
    );
    setDuration(String(cls.durationMinutes ?? 60));
    setDaysOfWeek(cls.daysOfWeek ?? []);
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
    setShowEditAgeBandPicker(false);
    setShowEditGenderPicker(false);
    setShowEditGoalPicker(false);
  }, []);

  const openEditPicker = useCallback(
    (target: "age" | "gender" | "goal") => {
      closeEditPickers();

      const measureAndOpen = (attempt = 0) => {
        const measureRef =
          target === "age"
            ? editAgeBandTriggerRef.current
            : target === "gender"
              ? editGenderTriggerRef.current
              : editGoalTriggerRef.current;

        measureRef?.measureInWindow((x, y, width, height) => {
          const isReady = width > 0 && height > 0;
          if (isReady) {
            if (target === "age") {
              setEditAgeBandTriggerLayout({ x, y, width, height });
              setShowEditAgeBandPicker(true);
            } else if (target === "gender") {
              setEditGenderTriggerLayout({ x, y, width, height });
              setShowEditGenderPicker(true);
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
      editAgeBandTriggerRef,
      editGenderTriggerRef,
      editGoalTriggerRef,
    ]
  );

  const toggleEditPicker = useCallback(
    (target: "age" | "gender" | "goal") => {
      const isOpen =
        (target === "age" && showEditAgeBandPicker) ||
        (target === "gender" && showEditGenderPicker) ||
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
      showEditAgeBandPicker,
      showEditGenderPicker,
      showEditGoalPicker,
    ]
  );

  const isEditDirty = useMemo(() => {
    if (!cls) return false;
    return (
      (cls.name ?? "") !== name ||
      classCoachName !== coachNameOverride.trim() ||
      (cls.unit ?? "") !== unit ||
      (cls.ageBand ?? "08-09") !== ageBand ||
      (cls.gender ?? "misto") !== gender ||
      (cls.startTime ?? "14:00") !== startTime ||
      (cls.endTime ?? computeEndTimeFromDuration(cls.startTime ?? "14:00", cls.durationMinutes ?? 60)) !== endTime ||
      String(cls.durationMinutes ?? 60) !== duration ||
      JSON.stringify(cls.daysOfWeek ?? []) !== JSON.stringify(daysOfWeek) ||
      (cls.goal ?? "Fundamentos") !== goal
    );
  }, [ageBand, classCoachName, cls, coachNameOverride, daysOfWeek, duration, endTime, gender, goal, name, startTime, unit]);

  useEffect(() => {
    if (!showEditModal) return;
    requestAnimationFrame(() => {
      if (editContainerRef.current) {
        editContainerRef.current.measureInWindow((x, y) => {
          setEditContainerWindow({ x, y });
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
    setFormError("");
    setSaving(true);
    try {
      await updateClass(cls.id, {
        name: name.trim() || cls.name,
        unit: unit.trim() || "Rede Esperança",
        daysOfWeek,
        goal: showEditCustomGoal ? editCustomGoal.trim() || goal : goal,
        ageBand: (showEditCustomAgeBand ? editCustomAgeBand.trim() || ageBand : ageBand).trim() || cls.ageBand,
        gender,
        startTime: timeValue,
        durationMinutes: durationValue,
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

  useEffect(() => {
    Animated.timing(classFabAnim, {
      toValue: showClassFabMenu ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [classFabAnim, showClassFabMenu]);

  const toggleRosterBooleanOption = useCallback(
    (
      key:
        | "includeAttendance"
        | "includeBirthDate"
        | "includeCourse"
        | "includeContact"
        | "includeFundamentals"
    ) => {
      setRosterExportOptions((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    []
  );

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
        await measure("deleteClassCascade", () => deleteClassCascade(targetClassId));
        logAction("Excluir turma", { classId: targetClassId });
        router.replace("/classes");
      },
      onUndo: async () => {
        // Nothing to revert locally because removal happens after the undo window.
      },
    });
  };

  const handleExportRoster = async () => {
    if (!cls) return;
    setRosterExportOptions(buildRosterExportOptions());
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
      const monthLabel = formatMonthLabel(monthValue);
      const monthEntries = buildRosterMonthEntries(monthValue, classDays);
      const monthDays = monthEntries.map((entry) => entry.day);
      const monthKey = formatMonthKey(monthValue);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScreenTopChrome
          style={{
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 16,
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
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/classes");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexShrink: 1,
              }}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 28,
                  fontWeight: "700",
                  color: colors.text,
                  maxWidth: 240,
                }}
              >
                {className}
              </Text>
              <ClassGenderBadge gender={classGender} size="md" />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
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
                <MaterialCommunityIcons name="pencil" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </ScreenTopChrome>

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

        <View
          style={[
            getSectionCardStyle(colors, "primary", { radius: 18 }),
            { borderLeftWidth: 1, borderLeftColor: colors.border },
          ]}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Ações rápidas
          </Text>
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/class/[id]/session", params: { id } })
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                Ver aula do dia
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Plano e cronômetro
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/attendance",
                  params: { id },
                })
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                Fazer chamada
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Presença rápida
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/prof/periodization",
                  params: { classId: cls?.id ?? "", unit: cls?.unit ?? "" },
                })
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                Periodização da turma
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Ver ciclo, semana e metas
              </Text>
            </Pressable>
            <Pressable
              onPress={handleExportRoster}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                Exportar lista da turma
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Lista de chamada mensal
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/students",
                  params: { id },
                })
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                Alunos da turma
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Ver, buscar e editar
              </Text>
            </Pressable>
            <Pressable
              onPress={handleWhatsAppGroup}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                WhatsApp
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Contato responsável
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={getSectionCardStyle(colors, "neutral", { radius: 18 })}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Scouting recente
          </Text>
          {scoutingLoading ? (
            <View style={{ gap: 8 }}>
              <ShimmerBlock style={{ height: 18, width: "42%", borderRadius: 8 }} />
              <ShimmerBlock style={{ height: 14, width: "58%", borderRadius: 8 }} />
              <ShimmerBlock style={{ height: 14, width: "72%", borderRadius: 8 }} />
              <ShimmerBlock style={{ height: 14, width: "66%", borderRadius: 8 }} />
            </View>
          ) : latestScouting && scoutingCounts ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {formatShortDate(latestScouting.date)}
                </Text>
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                    {latestScouting.mode === "jogo" ? "Jogo" : "Treino"}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                {scoutingSkills.map((skill) => {
                  const metrics = getSkillMetrics(scoutingCounts[skill.id]);
                  const goodPct = Math.round(metrics.goodPct * 100);
                  return (
                    <View key={skill.id} style={{ flexDirection: "row", gap: 10 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", minWidth: 90 }}>
                        {skill.label}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {metrics.total} ações | média {metrics.avg.toFixed(2)} | boas {goodPct}%
                      </Text>
                    </View>
                  );
                })}
              </View>
              {scoutingFocus ? (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Foco sugerido: {scoutingFocus.label}
                  </Text>
                  <Text style={{ color: colors.muted }}>{scoutingFocus.text}</Text>
                </View>
              ) : (
                <Text style={{ color: colors.muted }}>
                  Registre pelo menos 10 ações para sugerir foco.
                </Text>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.muted }}>
              Nenhum scouting registrado ainda.
            </Text>
          )}
        </View>

      </ScrollView>
      </KeyboardAvoidingView>

      {showClassFabMenu ? (
        <Pressable
          onPress={() => setShowClassFabMenu(false)}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 5310,
          }}
        />
      ) : null}

      {showClassFabMenu ? (
        <View
          style={{
            ...(Platform.OS === "web"
              ? ({ position: "fixed", right: 16, bottom: classFabMenuBottom } as any)
              : { position: "absolute" as const, right: 16, bottom: classFabMenuBottom }),
            width: 228,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 8,
            gap: 8,
            zIndex: 5320,
          }}
        >
          <Pressable
            onPress={() => {
              setShowClassFabMenu(false);
              handleExportRoster();
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
            <MaterialCommunityIcons name="file-export-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Exportar lista de chamada
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => setShowClassFabMenu((current) => !current)}
        style={{
          ...(Platform.OS === "web"
            ? ({ position: "fixed", right: 16, bottom: classFabBottom } as any)
            : { position: "absolute" as const, right: 16, bottom: classFabBottom }),
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryBg,
          borderWidth: 1,
          borderColor: colors.primaryBg,
          zIndex: 5330,
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
                rotate: classFabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "45deg"],
                }),
              },
              {
                scale: classFabAnim.interpolate({
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
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
              Editar turma
            </Text>
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
              <Ionicons name="close" size={18} color={colors.text} />
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
                compact
                renderPickers={false}
              refs={{
                editContainerRef,
                editAgeBandTriggerRef,
                editGenderTriggerRef,
                editGoalTriggerRef,
              }}
              layouts={{
                editContainerWindow,
                editAgeBandTriggerLayout,
                editGenderTriggerLayout,
                editGoalTriggerLayout,
              }}
              pickers={{
                showEditAgeBandPicker,
                showEditGenderPicker,
                showEditGoalPicker,
                showEditAgeBandPickerContent,
                showEditGenderPickerContent,
                showEditGoalPickerContent,
                editAgeBandPickerAnimStyle,
                editGenderPickerAnimStyle,
                editGoalPickerAnimStyle,
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
                editAgeBand: ageBand,
                setEditAgeBand: setAgeBand,
                editShowCustomAgeBand: showEditCustomAgeBand,
                editCustomAgeBand,
                setEditCustomAgeBand,
                editGender: gender,
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
                ageBandOptions,
                genderOptions: genderOptions.map((value) => ({
                  value,
                  label: value === 'misto' ? 'Misto' : value === 'feminino' ? 'Feminino' : 'Masculino',
                })),
                goalOptions,
                customOptionLabel: 'Personalizar',
              }}
              actions={{
                closeAllPickers: closeEditPickers,
                toggleEditPicker: (target) => {
                  if (target === "age" || target === "gender" || target === "goal") {
                    const isOpen =
                      (target === "age" && showEditAgeBandPicker) ||
                      (target === "gender" && showEditGenderPicker) ||
                      (target === "goal" && showEditGoalPicker);
                    if (isOpen) {
                      closeEditPickers();
                      return;
                    }
                    toggleEditPicker(target);
                    return;
                  }
                  closeEditPickers();
                },
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
              }}
            />

            <Pressable
              onPress={onDelete}
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                borderRadius: 14,
                backgroundColor: colors.dangerSolidBg,
              }}
            >
              <Text style={{ color: colors.dangerSolidText, fontSize: 16, fontWeight: "800" }}>
                Excluir turma
              </Text>
            </Pressable>
            </ScrollView>
          </View>

          <View style={{ gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable
              onPress={handleSaveEdit}
              disabled={!isEditDirty || saving}
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                borderRadius: 14,
                backgroundColor: !isEditDirty || saving ? colors.inputBg : colors.primaryBg,
                opacity: !isEditDirty || saving ? 0.7 : 1,
              }}
            >
              <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: "800" }}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Text>
            </Pressable>
          </View>

          <ClassEditModalPickers
            refs={{
              editContainerRef,
              editAgeBandTriggerRef,
              editGenderTriggerRef,
              editGoalTriggerRef,
            }}
            layouts={{
              editContainerWindow,
              editAgeBandTriggerLayout,
              editGenderTriggerLayout,
              editGoalTriggerLayout,
            }}
            pickers={{
              showEditAgeBandPicker,
              showEditGenderPicker,
              showEditGoalPicker,
              showEditAgeBandPickerContent,
              showEditGenderPickerContent,
              showEditGoalPickerContent,
              editAgeBandPickerAnimStyle,
              editGenderPickerAnimStyle,
              editGoalPickerAnimStyle,
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
              editAgeBand: ageBand,
              setEditAgeBand: setAgeBand,
              editShowCustomAgeBand: showEditCustomAgeBand,
              editCustomAgeBand,
              setEditCustomAgeBand,
              editGender: gender,
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
              ageBandOptions,
              genderOptions: genderOptions.map((value) => ({
                value,
                label: value === "misto" ? "Misto" : value === "feminino" ? "Feminino" : "Masculino",
              })),
              goalOptions,
              customOptionLabel: "Personalizar",
            }}
            actions={{
              closeAllPickers: closeEditPickers,
              toggleEditPicker,
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
            }}
          />
        </View>

      </ModalSheet>

            <ModalSheet
        visible={showRosterExportModal}
        onClose={() => setShowRosterExportModal(false)}
        position="center"
        cardStyle={rosterModalCardStyle}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingBottom: 6 }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              Exportar lista de chamada
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Marque as colunas e veja a prévia antes de baixar.
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
              Mês da lista
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {formatMonthLabel(rosterMonthValue)}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowRosterMonthPicker(true)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  Escolher
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
              Colunas do PDF
            </Text>
            <View style={{ gap: 8 }}>
              {ROSTER_COLUMN_OPTIONS.map((option) => {
                const active = rosterExportOptions[option.key];
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => toggleRosterBooleanOption(option.key)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: active ? colors.primaryBg : colors.border,
                      backgroundColor: active ? colors.primaryBg : colors.card,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={active ? "checkbox-marked" : "checkbox-blank-outline"}
                      size={20}
                      color={active ? colors.primaryText : colors.text}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          color: active ? colors.primaryText : colors.text,
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={{
                          color: active ? colors.primaryText : colors.muted,
                          fontSize: 11,
                        }}
                      >
                        {option.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {rosterExportOptions.includeFundamentals ? (
            <View style={{ gap: 8 }}>
              <View style={{ gap: 3 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
                    Fundamentos trabalhados
                  </Text>
                  {hasRosterFundamentalOverrides ? (
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
                  ) : null}
                </View>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  O PDF usa automaticamente os planos aplicados no mês para marcar os X.
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Toque na célula para alternar entre automático e manual. Toque no nome para editar
                  e confirme com ✓.
                </Text>
              </View>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
              Prévia
            </Text>
            <View
              style={{
                padding: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                    {className}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {formatMonthLabel(rosterMonthValue)} ? {formatDays(classDays)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>Periodização</Text>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 11,
                      fontWeight: "700",
                      textAlign: "right",
                      maxWidth: 180,
                    }}
                  >
                    {cls ? getBlockForToday(cls) : "-"}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  overflow: "hidden",
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
                  <Text style={{ width: 22, paddingVertical: 8, textAlign: "center", fontSize: 10 }}>
                    #
                  </Text>
                  <Text style={{ flex: 1, paddingVertical: 8, fontSize: 10, fontWeight: "700" }}>
                    Atletas
                  </Text>
                  {rosterExportOptions.includeBirthDate ? (
                    <Text style={{ width: 68, paddingVertical: 8, textAlign: "center", fontSize: 10 }}>
                      Nasc
                    </Text>
                  ) : null}
                  {rosterExportOptions.includeCourse ? (
                    <Text style={{ width: 90, paddingVertical: 8, textAlign: "center", fontSize: 10 }}>
                      Curso
                    </Text>
                  ) : null}
                  {rosterExportOptions.includeContact ? (
                    <Text style={{ width: 84, paddingVertical: 8, textAlign: "center", fontSize: 10 }}>
                      Contato
                    </Text>
                  ) : null}
                  {rosterExportOptions.includeAttendance
                    ? rosterPreviewDays.map((day) => (
                        <Text
                          key={`preview-day-${day}`}
                          style={{
                            width: 22,
                            paddingVertical: 8,
                            textAlign: "center",
                            fontSize: 10,
                          }}
                        >
                          {day}
                        </Text>
                      ))
                    : null}
                  {rosterExportOptions.includeAttendance ? (
                    <Text style={{ width: 34, paddingVertical: 8, textAlign: "center", fontSize: 10 }}>
                      Total
                    </Text>
                  ) : null}
                </View>

                {rosterPreviewStudents.length ? (
                  rosterPreviewStudents.map((student, index) => {
                    const contact = getContactPhone(student);
                    const contactLabel =
                      contact.status === "ok"
                        ? contact.source === "guardian"
                          ? "Resp."
                          : "Aluno"
                        : contact.status === "missing"
                          ? "Sem tel"
                          : "Inválido";
                    const contactPhone =
                      contact.status === "ok" ? formatPhoneDisplay(contact.phoneDigits) : "";
                    return (
                      <View
                        key={student.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          borderBottomWidth: index === rosterPreviewStudents.length - 1 ? 0 : 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Text style={{ width: 22, paddingVertical: 8, textAlign: "center", fontSize: 10 }}>
                          {index + 1}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            fontSize: 11,
                            fontWeight: "700",
                            color: colors.text,
                          }}
                        >
                          {student.name}
                        </Text>
                        {rosterExportOptions.includeBirthDate ? (
                          <Text style={{ width: 68, paddingVertical: 8, textAlign: "center", fontSize: 10 }}>
                            {formatBirthDate(student.birthDate)}
                          </Text>
                        ) : null}
                        {rosterExportOptions.includeCourse ? (
                          <Text
                            style={{
                              width: 90,
                              paddingVertical: 8,
                              textAlign: "center",
                              fontSize: 10,
                            }}
                          >
                            {student.collegeCourse?.trim() || "-"}
                          </Text>
                        ) : null}
                        {rosterExportOptions.includeContact ? (
                          <View style={{ width: 84, paddingVertical: 8, alignItems: "center" }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.text }}>
                              {contactLabel}
                            </Text>
                            <Text style={{ fontSize: 9, color: colors.muted }}>
                              {contactPhone || "—"}
                            </Text>
                          </View>
                        ) : null}
                        {rosterExportOptions.includeAttendance
                          ? rosterPreviewDays.map((day) => (
                              <Text
                                key={`preview-row-${student.id}-${day}`}
                                style={{
                                  width: 22,
                                  paddingVertical: 8,
                                  textAlign: "center",
                                  fontSize: 10,
                                  color: colors.muted,
                                }}
                              >
                                -
                              </Text>
                            ))
                          : null}
                        {rosterExportOptions.includeAttendance ? (
                          <Text style={{ width: 34, paddingVertical: 8, textAlign: "center", fontSize: 10 }}>
                            -
                          </Text>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      Nenhum aluno carregado para pré-visualização.
                    </Text>
                  </View>
                )}
              </View>

              {rosterExportOptions.includeFundamentals ? (
                <View
                  style={{
                    marginTop: 2,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 10,
                    gap: 8,
                    backgroundColor: colors.inputBg,
                  }}
                >
                  <View style={{ gap: 2 }}>
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                      Fundamentos trabalhados
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      X automático conforme os planos do mês.
                    </Text>
                  </View>

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
                      const isEditing = editingRosterFundamentalIndex === index;
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
                                onPress={() => toggleRosterFundamentalCell(day, fundamentalKey)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: active }}
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
              ) : null}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => {
                setShowRosterExportModal(false);
                void exportRosterPdf(rosterMonthValue, rosterExportOptions);
              }}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.primaryBg,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 14 }}>
                Baixar PDF
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowRosterExportModal(false)}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                Fechar
              </Text>
            </Pressable>
          </View>
        </ScrollView>
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
                <MaterialCommunityIcons name="chevron-left" size={18} color={colors.text} />
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
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.text} />
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

