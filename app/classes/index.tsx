import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    Vibration,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";
import { ShimmerBlock } from "../../src/ui/Shimmer";
import { ScreenLoadingState } from "../../src/components/ui/ScreenLoadingState";

import { useCopilotContext } from "../../src/copilot/CopilotProvider";
import { resolveClassModality } from "../../src/core/class-modality";
import { compareClassesBySchedule } from "../../src/core/class-schedule-sort";
import { CLASS_MODALITY_OPTIONS } from "../../src/core/class-modality";
import type { ClassGroup, TrainingSessionIntegrationRule } from "../../src/core/models";
import { normalizeUnitKey } from "../../src/core/unit-key";
import {
  deleteClassCascade,
  getClasses,
  getTrainingIntegrationRules,
  saveClass,
  updateClass,
} from "../../src/db/seed";
import { logAction } from "../../src/observability/breadcrumbs";
import { markRender, measure, measureAsync } from "../../src/observability/perf";
import { ClassesListSection } from "../../src/screens/classes/components/ClassesListSection";
import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../src/ui/AnchoredDropdownOption";
import { animateLayout } from "../../src/ui/animate-layout";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { getClassColorOptions } from "../../src/ui/class-colors";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { DateInput } from "../../src/ui/DateInput";
import { DatePickerModal } from "../../src/ui/DatePickerModal";
import { FadeHorizontalScroll } from "../../src/ui/FadeHorizontalScroll";
import { ModalDialogFrame } from "../../src/ui/ModalDialogFrame";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { UnitFilterBar } from "../../src/ui/UnitFilterBar";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { ScreenTopChrome } from "../../src/components/ui/ScreenTopChrome";
import { usePersistedState } from "../../src/ui/use-persisted-state";

const ClassEditModalBody = lazy(() =>
  import("../../src/screens/classes/components/ClassEditModalBody").then((module) => ({
    default: module.ClassEditModalBody,
  }))
);

export default function ClassesScreen() {
  markRender("screen.classes.render.root");

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { edit, tab, prefillName, prefillModality, prefillUnit } = useLocalSearchParams<{
    edit?: string | string[];
    tab?: string | string[];
    prefillName?: string | string[];
    prefillModality?: string | string[];
    prefillUnit?: string | string[];
  }>();
  const editParam = Array.isArray(edit) ? edit[0] : edit;
  const tabParam = Array.isArray(tab) ? tab[0] : tab;
  const prefillNameParam = Array.isArray(prefillName) ? prefillName[0] : prefillName;
  const prefillModalityParam = Array.isArray(prefillModality) ? prefillModality[0] : prefillModality;
  const prefillUnitParam = Array.isArray(prefillUnit) ? prefillUnit[0] : prefillUnit;
  const { colors } = useAppTheme();
  const bottomScrollPadding = insets.bottom + 112;
  const { confirm: confirmDialog } = useConfirmDialog();
  const { confirm: confirmUndo } = useConfirmUndo();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [integrationRules, setIntegrationRules] = useState<TrainingSessionIntegrationRule[]>([]);

  useCopilotContext(
    useMemo(
      () => ({
        screen: "classes_index",
        title: "Turmas",
        subtitle: "Gestão e configuração",
      }),
      []
    )
  );

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  type SelectOptionValue = string | number;
  const formatDays = (days: number[]) =>
    days.length ? days.map((day) => dayNames[day]).join(", ") : "-";
  const formatIsoDate = (value: Date) => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newModality, setNewModality] = useState<ClassGroup["modality"] | "">("");
  const [newAgeBand, setNewAgeBand] = useState<ClassGroup["ageBand"] | "">("");
  const [newGender, setNewGender] = useState<ClassGroup["gender"] | "">("");
  const [newGoal, setNewGoal] = useState<ClassGroup["goal"] | "">("Fundamentos");
  const [newStartTime, setNewStartTime] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newDays, setNewDays] = useState<number[]>([]);
  const [newMvLevel, setNewMvLevel] = useState("");
  const [newCycleStartDate, setNewCycleStartDate] = useState("");
  const [newCycleLengthWeeks, setNewCycleLengthWeeks] = useState(0);
  const [newColorKey, setNewColorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [handledEditId, setHandledEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editModality, setEditModality] = useState<ClassGroup["modality"]>("voleibol");
  const [editAgeBand, setEditAgeBand] = useState<ClassGroup["ageBand"]>("08-09");
  const [editGender, setEditGender] = useState<ClassGroup["gender"]>("misto");
  const [editGoal, setEditGoal] = useState<ClassGroup["goal"]>("Fundamentos");
  const [editStartTime, setEditStartTime] = useState("14:00");
  const [editDuration, setEditDuration] = useState("60");
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editMvLevel, setEditMvLevel] = useState("MV1");
  const [editCycleStartDate, setEditCycleStartDate] = useState("");
  const [editCycleLengthWeeks, setEditCycleLengthWeeks] = useState(12);
  const [editColorKey, setEditColorKey] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateCloseConfirm, setShowCreateCloseConfirm] = useState(false);
  const [mainTab, setMainTab] = useState<"lista" | "criar">("lista");
  const [showCreateTabConfirm, setShowCreateTabConfirm] = useState(false);
  const [pendingMainTab, setPendingMainTab] = useState<"lista" | "criar" | null>(null);
  const mainTabAnim = useRef<Record<"lista" | "criar", Animated.Value>>({
    lista: new Animated.Value(1),
    criar: new Animated.Value(0),
  }).current;
  const [editSaving, setEditSaving] = useState(false);
  const [editFormError, setEditFormError] = useState("");
  const [editShowCustomDuration, setEditShowCustomDuration] = useState(false);
  const [editShowCustomAgeBand, setEditShowCustomAgeBand] = useState(false);
  const [editCustomAgeBand, setEditCustomAgeBand] = useState("");
  const [editShowCustomGoal, setEditShowCustomGoal] = useState(false);
  const [editCustomGoal, setEditCustomGoal] = useState("");
  const [showEditDurationPicker, setShowEditDurationPicker] = useState(false);
  const [showEditCycleLengthPicker, setShowEditCycleLengthPicker] = useState(false);
  const [showEditMvLevelPicker, setShowEditMvLevelPicker] = useState(false);
  const [showEditAgeBandPicker, setShowEditAgeBandPicker] = useState(false);
  const [showEditGenderPicker, setShowEditGenderPicker] = useState(false);
  const [showEditModalityPicker, setShowEditModalityPicker] = useState(false);
  const [showEditGoalPicker, setShowEditGoalPicker] = useState(false);
  const [editDurationTriggerLayout, setEditDurationTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
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
  const editDurationTriggerRef = useRef<View>(null);
  const editCycleLengthTriggerRef = useRef<View>(null);
  const editMvLevelTriggerRef = useRef<View>(null);
  const editAgeBandTriggerRef = useRef<View>(null);
  const editGenderTriggerRef = useRef<View>(null);
  const editModalityTriggerRef = useRef<View>(null);
  const editGoalTriggerRef = useRef<View>(null);
  const editContainerRef = useRef<View>(null);
  const [editContainerWindow, setEditContainerWindow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const editModalCardStyle = useModalCardStyle({
    maxHeight: "92%",
  });
  const [showCustomDuration, setShowCustomDuration] = usePersistedState<boolean>(
    "classes_show_custom_duration_v1",
    false
  );
  const {
    animatedStyle: customDurationAnimStyle,
    isVisible: showCustomDurationContent,
  } = useCollapsibleAnimation(showCustomDuration, { translateY: -6 });
  const [showAllGoals, setShowAllGoals] = usePersistedState<boolean>(
    "classes_show_all_goals_v1",
    false
  );
  const {
    animatedStyle: allGoalsAnimStyle,
    isVisible: showAllGoalsContent,
  } = useCollapsibleAnimation(showAllGoals, { translateY: -6 });
  const [showAllAges, setShowAllAges] = usePersistedState<boolean>(
    "classes_show_all_ages_v1",
    false
  );
  const {
    animatedStyle: allAgesAnimStyle,
    isVisible: showAllAgesContent,
  } = useCollapsibleAnimation(showAllAges, { translateY: -6 });
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
  const genderOptions: { value: ClassGroup["gender"]; label: string }[] = [
    { value: "masculino", label: "Masculino" },
    { value: "feminino", label: "Feminino" },
    { value: "misto", label: "Misto" },
  ];
  const modalityOptions = [...CLASS_MODALITY_OPTIONS];
  const goals: ClassGroup["goal"][] = [
    "Fundamentos",
    "Força Geral",
    "Potência/Agilidade",
    "Força+Potência",
    "Velocidade",
    "Agilidade",
    "Resistencia",
    "Potência",
    "Mobilidade",
    "Coordena??o",
    "Prevencao de lesoes",
  ];
  const durationOptions = ["60", "75", "90"];
  const cycleLengthOptions = [2, 3, 4, 5, 6, 8, 10, 12];
  const mvLevelOptions = [
    { value: "MV1", label: "Iniciante" },
    { value: "MV2", label: "Intermediario" },
    { value: "MV3", label: "Avancado" },
  ];
  const [showNewCycleCalendar, setShowNewCycleCalendar] = useState(false);
  const [showEditCycleCalendar, setShowEditCycleCalendar] = useState(false);
  const [showUnitFilterPicker, setShowUnitFilterPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showCycleLengthPicker, setShowCycleLengthPicker] = useState(false);
  const [showMvLevelPicker, setShowMvLevelPicker] = useState(false);
  const [showAgeBandPicker, setShowAgeBandPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showModalityPicker, setShowModalityPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const newColorOptions = useMemo(
    () => getClassColorOptions(colors, newUnit.trim() || "Sem unidade"),
    [colors, newUnit]
  );
  const editColorOptions = useMemo(
    () =>
      getClassColorOptions(
        colors,
        editUnit.trim() || editingClass?.unit || "Sem unidade"
      ),
    [colors, editUnit, editingClass]
  );
  const [unitFilterLayout, setUnitFilterLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [durationTriggerLayout, setDurationTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [cycleLengthTriggerLayout, setCycleLengthTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [mvLevelTriggerLayout, setMvLevelTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [ageBandTriggerLayout, setAgeBandTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [genderTriggerLayout, setGenderTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [modalityTriggerLayout, setModalityTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [goalTriggerLayout, setGoalTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [containerWindow, setContainerWindow] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<View>(null);
  const unitFilterTriggerRef = useRef<View>(null);
  const durationTriggerRef = useRef<View>(null);
  const cycleLengthTriggerRef = useRef<View>(null);
  const mvLevelTriggerRef = useRef<View>(null);
  const ageBandTriggerRef = useRef<View>(null);
  const genderTriggerRef = useRef<View>(null);
  const modalityTriggerRef = useRef<View>(null);
  const goalTriggerRef = useRef<View>(null);
  const {
    animatedStyle: unitFilterAnimStyle,
    isVisible: showUnitFilterPickerContent,
  } = useCollapsibleAnimation(showUnitFilterPicker);
  const { animatedStyle: durationPickerAnimStyle, isVisible: showDurationPickerContent } =
    useCollapsibleAnimation(showDurationPicker);
  const { animatedStyle: cycleLengthPickerAnimStyle, isVisible: showCycleLengthPickerContent } =
    useCollapsibleAnimation(showCycleLengthPicker);
  const { animatedStyle: mvLevelPickerAnimStyle, isVisible: showMvLevelPickerContent } =
    useCollapsibleAnimation(showMvLevelPicker);
  const { animatedStyle: ageBandPickerAnimStyle, isVisible: showAgeBandPickerContent } =
    useCollapsibleAnimation(showAgeBandPicker);
  const { animatedStyle: genderPickerAnimStyle, isVisible: showGenderPickerContent } =
    useCollapsibleAnimation(showGenderPicker);
  const { animatedStyle: modalityPickerAnimStyle, isVisible: showModalityPickerContent } =
    useCollapsibleAnimation(showModalityPicker);
  const { animatedStyle: goalPickerAnimStyle, isVisible: showGoalPickerContent } =
    useCollapsibleAnimation(showGoalPicker);
  const { animatedStyle: editDurationPickerAnimStyle, isVisible: showEditDurationPickerContent } =
    useCollapsibleAnimation(showEditDurationPicker);
  const { animatedStyle: editCycleLengthPickerAnimStyle, isVisible: showEditCycleLengthPickerContent } =
    useCollapsibleAnimation(showEditCycleLengthPicker);
  const { animatedStyle: editMvLevelPickerAnimStyle, isVisible: showEditMvLevelPickerContent } =
    useCollapsibleAnimation(showEditMvLevelPicker);
  const { animatedStyle: editAgeBandPickerAnimStyle, isVisible: showEditAgeBandPickerContent } =
    useCollapsibleAnimation(showEditAgeBandPicker);
  const { animatedStyle: editGenderPickerAnimStyle, isVisible: showEditGenderPickerContent } =
    useCollapsibleAnimation(showEditGenderPicker);
  const { animatedStyle: editModalityPickerAnimStyle, isVisible: showEditModalityPickerContent } =
    useCollapsibleAnimation(showEditModalityPicker);
  const { animatedStyle: editGoalPickerAnimStyle, isVisible: showEditGoalPickerContent } =
    useCollapsibleAnimation(showEditGoalPicker);

  const unitLabel = useCallback(
    (value: string) => (value && value.trim() ? value.trim() : "Sem unidade"),
    []
  );
  const unitKey = useCallback(
    (value: string) => normalizeUnitKey(unitLabel(value)),
    [unitLabel]
  );
  const units = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((item) => {
      const label = unitLabel(item.unit);
      const key = unitKey(label);
      if (!map.has(key)) map.set(key, label);
    });
    return ["Todas", ...Array.from(map.values()).sort((a, b) => a.localeCompare(b))];
  }, [classes, unitKey, unitLabel]);
  const [unitFilter, setUnitFilter] = useState("Todas");
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
  const getChipStyle = (
    active: boolean,
    palette?: { bg: string; text: string }
  ) => [
    chipBaseStyle,
    active ? { backgroundColor: palette?.bg ?? colors.primaryBg } : chipInactiveStyle,
  ];
  const getChipTextStyle = (
    active: boolean,
    palette?: { bg: string; text: string }
  ) => [
    chipTextBaseStyle,
    active ? { color: palette?.text ?? colors.primaryText } : chipInactiveTextStyle,
  ];
  const selectFieldStyle = {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  };
  const customOptionLabel = "Personalizar";
  const getOptionLabel = (
    value: string | undefined,
    options: { value: string; label: string }[]
  ) => options.find((option) => option.value === value)?.label ?? value ?? "";

  const filteredClasses = useMemo(() => {
    if (unitFilter === "Todas") return classes;
    const filterKey = normalizeUnitKey(unitFilter);
    return classes.filter((item) => unitKey(item.unit) === filterKey);
  }, [classes, unitFilter, unitKey]);

  const goalSuggestions = useMemo(() => {
    const key = normalizeUnitKey(newUnit);
    const matches = classes.filter((item) => {
      if (key) return unitKey(item.unit) === key;
      if (newAgeBand) return item.ageBand === newAgeBand;
      return false;
    });
    const counts = new Map<string, number>();
    matches.forEach((item) => {
      counts.set(item.goal, (counts.get(item.goal) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([goal]) => goal)
      .filter((goal) => goal && !goals.includes(goal))
      .slice(0, 4);
  }, [classes, goals, newAgeBand, newUnit]);
  const goalOptions = useMemo(() => {
    const list = [...goalSuggestions, ...goals];
    return list.filter((item, index) => list.indexOf(item) === index);
  }, [goalSuggestions, goals]);

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

  const toMinutes = (value: string) => {
    if (!isValidTime(value)) return null;
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };

  const parseDuration = (value: string) => {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) return null;
    return minutes >= 30 && minutes <= 180 ? minutes : null;
  };

  const parseCycleLength = (value: number) => {
    if (!Number.isFinite(value)) return null;
    return value >= 2 && value <= 12 ? value : null;
  };

  const parseTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
  };

  const formatTimeRange = (hour: number, minute: number, duration: number) => {
    const start = hour * 60 + minute;
    const end = start + duration;
    const endHour = Math.floor(end / 60) % 24;
    const endMinute = end % 60;
    const pad = (val: number) => String(val).padStart(2, "0");
    return `${pad(hour)}:${pad(minute)} - ${pad(endHour)}:${pad(endMinute)}`;
  };

  const isComplementaryGenderPair = useCallback(
    (a: ClassGroup["gender"], b: ClassGroup["gender"]) => {
      const normalizedA = a ?? "misto";
      const normalizedB = b ?? "misto";
      return (
        (normalizedA === "masculino" && normalizedB === "feminino") ||
        (normalizedA === "feminino" && normalizedB === "masculino")
      );
    },
    []
  );

  const buildPairKey = useCallback((leftId: string, rightId: string) => {
    const ids = [leftId, rightId]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .sort();
    return ids.join("|");
  }, []);

  const integrationPairKeys = useMemo(() => {
    const set = new Set<string>();
    for (const rule of integrationRules) {
      const classIds = Array.from(
        new Set(
          (rule.classIds ?? [])
            .map((classId) => String(classId ?? "").trim())
            .filter(Boolean)
        )
      ).sort();
      for (let i = 0; i < classIds.length; i += 1) {
        for (let j = i + 1; j < classIds.length; j += 1) {
          set.add(buildPairKey(classIds[i], classIds[j]));
        }
      }
    }
    return set;
  }, [buildPairKey, integrationRules]);

  const hasPersistedIntegrationRules = integrationRules.length > 0;

  const conflictsById = useMemo(() => {
    const map: Record<
      string,
      { name: string; day: number; modality: ClassGroup["modality"]; kind: "conflict" | "integration" }[]
    > = {};
    const classById = new Map(classes.map((item) => [item.id, item]));
    const addedIntegrationPairKeys = new Set<string>();

    for (const rule of integrationRules) {
      const classIds = Array.from(
        new Set(
          (rule.classIds ?? [])
            .map((classId) => String(classId ?? "").trim())
            .filter(Boolean)
        )
      );
      for (let i = 0; i < classIds.length; i += 1) {
        for (let j = i + 1; j < classIds.length; j += 1) {
          const pairKey = buildPairKey(classIds[i], classIds[j]);
          if (addedIntegrationPairKeys.has(pairKey)) continue;
          const left = classById.get(classIds[i]);
          const right = classById.get(classIds[j]);
          if (!left || !right) continue;
          addedIntegrationPairKeys.add(pairKey);
          if (!map[left.id]) map[left.id] = [];
          if (!map[right.id]) map[right.id] = [];
          map[left.id].push({
            name: right.name ?? "Turma sem nome",
            day: 0,
            modality: right.modality,
            kind: "integration",
          });
          map[right.id].push({
            name: left.name ?? "Turma sem nome",
            day: 0,
            modality: left.modality,
            kind: "integration",
          });
        }
      }
    }

    for (let i = 0; i < classes.length; i += 1) {
      const a = classes[i];
      const aStart = toMinutes(a.startTime || "");
      if (aStart === null) continue;
      const aDuration = a.durationMinutes || 60;
      const aEnd = aStart + (a.durationMinutes || 60);
      const aDays = Array.isArray(a.daysOfWeek) ? a.daysOfWeek : [];
      for (let j = i + 1; j < classes.length; j += 1) {
        const b = classes[j];
        if (unitKey(a.unit) !== unitKey(b.unit)) continue;
        const bStart = toMinutes(b.startTime || "");
        if (bStart === null) continue;
        const bDuration = b.durationMinutes || 60;
        const bEnd = bStart + (b.durationMinutes || 60);
        const bDays = Array.isArray(b.daysOfWeek) ? b.daysOfWeek : [];
        const sharedDays = aDays.filter((day) => bDays.includes(day));
        if (!sharedDays.length) continue;
        const overlap = aStart < bEnd && bStart < aEnd;
        if (!overlap) continue;
        const pairKey = buildPairKey(a.id, b.id);
        const isIntegration = hasPersistedIntegrationRules
          ? integrationPairKeys.has(pairKey)
          : a.modality === b.modality &&
            aDuration === bDuration &&
            (a.startTime ?? "").trim() === (b.startTime ?? "").trim() &&
            isComplementaryGenderPair(a.gender, b.gender);
        if (hasPersistedIntegrationRules && isIntegration) continue;
        sharedDays.forEach((day) => {
          if (!map[a.id]) map[a.id] = [];
          if (!map[b.id]) map[b.id] = [];
          map[a.id].push({
            name: b.name ?? "Turma sem nome",
            day,
            modality: b.modality,
            kind: isIntegration ? "integration" : "conflict",
          });
          map[b.id].push({
            name: a.name ?? "Turma sem nome",
            day,
            modality: a.modality,
            kind: isIntegration ? "integration" : "conflict",
          });
        });
      }
    }
    return map;
  }, [
    buildPairKey,
    classes,
    hasPersistedIntegrationRules,
    integrationPairKeys,
    integrationRules,
    isComplementaryGenderPair,
  ]);

  const grouped = useMemo(() => {
    const map: Record<string, ClassGroup[]> = {};
    const labels = new Map<string, string>();
    filteredClasses.forEach((item) => {
      const label = unitLabel(item.unit);
      const key = unitKey(label);
      if (!map[key]) map[key] = [];
      map[key].push(item);
      if (!labels.has(key)) labels.set(key, label);
    });
    const sortedEntries = Object.entries(map).map(([unitKeyValue, items]) => {
      const sortedItems = [...items].sort(compareClassesBySchedule);
      return [labels.get(unitKeyValue) ?? "Sem unidade", sortedItems] as [string, ClassGroup[]];
    });
    return sortedEntries.sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredClasses, unitKey, unitLabel]);

  const loadClasses = useCallback(async (alive?: { current: boolean }) => {
    const isAlive = () => !alive || alive.current;
    setLoading(true);
    try {
      const [data, rules] = await Promise.all([
        measureAsync(
          "screen.classes.load.list",
          () => getClasses(),
          { screen: "classes" }
        ),
        getTrainingIntegrationRules(),
      ]);
      if (isAlive()) setClasses(data);
      if (isAlive()) setIntegrationRules(rules);
    } finally {
      if (isAlive()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const alive = { current: true };
      loadClasses(alive);
      return () => {
        alive.current = false;
      };
    }, [loadClasses])
  );


  const toggleDay = (value: number) => {
    setNewDays((prev) =>
      prev.includes(value) ? prev.filter((day) => day !== value) : [...prev, value]
    );
  };

  const saveNewClass = async () => {
    if (!newName.trim()) return;
    if (!newModality) {
      setFormError("Selecione a modalidade.");
      Vibration.vibrate(40);
      return;
    }
    if (!newAgeBand) {
      setFormError("Selecione a faixa etária.");
      Vibration.vibrate(40);
      return;
    }
    if (!newGender) {
      setFormError("Selecione o gênero.");
      Vibration.vibrate(40);
      return;
    }
    if (!newGoal) {
      setFormError("Selecione o objetivo.");
      Vibration.vibrate(40);
      return;
    }
    if (!newMvLevel) {
      setFormError("Selecione o Nível.");
      Vibration.vibrate(40);
      return;
    }
    const timeValue = newStartTime.trim();
    if (!isValidTime(timeValue)) {
      setFormError("Horário inválido. Use HH:MM.");
      Vibration.vibrate(40);
      return;
    }
    const durationValue = parseDuration(newDuration.trim());
    if (!durationValue) {
      setFormError("Duração inválida. Use minutos entre 30 e 180.");
      Vibration.vibrate(40);
      return;
    }
    const cycleValue = parseCycleLength(newCycleLengthWeeks);
    if (!cycleValue) {
      setFormError("Ciclo inválido. Use entre 2 e 12 semanas.");
      Vibration.vibrate(40);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const createdClassId = await saveClass({
          name: newName.trim(),
          unit: newUnit.trim() || "Sem unidade",
          colorKey: newColorKey ?? null,
          modality: newModality,
          ageBand: newAgeBand,
          gender: newGender,
          daysOfWeek: newDays,
          goal: newGoal,
          startTime: timeValue,
          durationMinutes: durationValue,
        mvLevel: newMvLevel,
        cycleStartDate: newCycleStartDate || undefined,
          cycleLengthWeeks: cycleValue,
      });
      Vibration.vibrate(60);
      resetCreateForm();
      await loadClasses();
      setMainTab("lista");
      confirmDialog({
        title: "Turma criada",
        message: "A turma foi gerada com sucesso. Deseja abrir agora?",
        confirmLabel: "Ver turma",
        cancelLabel: "Ficar na lista",
        tone: "default",
        onConfirm: () => {
          router.push({
            pathname: "/class/[id]",
            params: { id: createdClassId },
          });
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setShowEditCloseConfirm(false);
    setEditingClass(null);
  };

  const requestCloseEditModal = () => {
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setShowCreateCloseConfirm(false);
  };

  const requestCloseCreateModal = () => {
    if (isCreateDirty) {
      setShowCreateCloseConfirm(true);
      return;
    }
    closeCreateModal();
  };

  const isCreateDirty = useMemo(() => {
    return (
      newName.trim() !== "" ||
      newUnit.trim() !== "" ||
      newColorKey !== null ||
      newModality !== "" ||
      newAgeBand !== "" ||
      newGender !== "" ||
      newGoal.trim() !== "Fundamentos" ||
      newStartTime.trim() !== "" ||
      newDuration.trim() !== "" ||
      newDays.length > 0 ||
      newMvLevel !== "" ||
      newCycleStartDate.trim() !== "" ||
      newCycleLengthWeeks !== 0
    );
  }, [
    newName,
    newUnit,
    newColorKey,
    newModality,
    newAgeBand,
    newGender,
    newGoal,
    newStartTime,
    newDuration,
    newDays,
    newMvLevel,
    newCycleStartDate,
    newCycleLengthWeeks,
  ]);

  const resetCreateForm = useCallback(() => {
    setNewName("");
    setNewUnit("");
    setNewColorKey(null);
    setNewModality("");
    setNewAgeBand("");
    setNewGender("");
    setNewGoal("Fundamentos");
    setNewStartTime("");
    setNewDuration("");
    setNewDays([]);
    setNewMvLevel("");
    setNewCycleStartDate("");
    setNewCycleLengthWeeks(0);
    setFormError("");
    setShowCustomDuration(false);
    setShowAllAges(false);
    setShowAllGoals(false);
    setShowDurationPicker(false);
    setShowCycleLengthPicker(false);
    setShowMvLevelPicker(false);
    setShowAgeBandPicker(false);
    setShowGenderPicker(false);
    setShowModalityPicker(false);
    setShowGoalPicker(false);
  }, []);

  const requestSwitchMainTab = useCallback(
    (nextTab: "lista" | "criar") => {
      if (nextTab === mainTab) return;
      if (mainTab === "criar" && isCreateDirty) {
        setPendingMainTab(nextTab);
        setShowCreateTabConfirm(true);
        return;
      }
      if (nextTab === "criar") {
        resetCreateForm();
      }
      if (mainTab === "criar" && !isCreateDirty) {
        resetCreateForm();
      }
      setMainTab(nextTab);
    },
    [isCreateDirty, mainTab, resetCreateForm]
  );

  useEffect(() => {
    (["lista", "criar"] as const).forEach((tabKey) => {
      Animated.timing(mainTabAnim[tabKey], {
        toValue: mainTab === tabKey ? 1 : 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [mainTab, mainTabAnim]);

  const openEditModal = useCallback((item: ClassGroup) => {
    const nextAgeBand = item.ageBand ?? "08-09";
    const goalValue = item.goal ?? "Fundamentos";
    const isAgeBandCustom = nextAgeBand.trim().length > 0 && !ageBandOptions.includes(nextAgeBand);
    const isGoalInList = goalOptions.includes(goalValue);
    setEditingClass(item);
    setEditName(item.name ?? "");
    setEditUnit(item.unit ?? "");
    setEditColorKey(item.colorKey ?? null);
    setEditModality(item.modality);
    setEditAgeBand(nextAgeBand as ClassGroup["ageBand"]);
    setEditCustomAgeBand(isAgeBandCustom ? nextAgeBand : "");
    setEditShowCustomAgeBand(isAgeBandCustom);
    setEditGender(item.gender ?? "misto");
    setEditGoal(isGoalInList ? goalValue : "Fundamentos");
    setEditShowCustomGoal(!isGoalInList && Boolean(goalValue));
    setEditCustomGoal(!isGoalInList ? goalValue : "");
    setEditStartTime(item.startTime ?? "14:00");
    setEditDuration(String(item.durationMinutes ?? 60));
    setEditDays(item.daysOfWeek ?? []);
    setEditMvLevel(item.mvLevel ?? "MV1");
    setEditCycleStartDate(item.cycleStartDate ?? "");
    setEditCycleLengthWeeks(item.cycleLengthWeeks ?? 12);
    setEditFormError("");
    setEditShowCustomDuration(false);
    setShowEditModal(true);
  }, [ageBandOptions, goalOptions]);

  useEffect(() => {
    if (tabParam !== "criar") return;
    setMainTab("criar");
    if (prefillNameParam) setNewName(prefillNameParam);
    if (prefillUnitParam) setNewUnit(prefillUnitParam);
    if (prefillModalityParam) {
      const resolved = resolveClassModality(prefillModalityParam);
      if (resolved) setNewModality(resolved);
    }
  }, [prefillModalityParam, prefillNameParam, prefillUnitParam, tabParam]);

  useEffect(() => {
    if (!editParam || editParam === handledEditId) return;
    if (classes.length === 0 || showEditModal) return;
    const classToEdit = classes.find((cls) => cls.id === editParam);
    if (classToEdit) {
      setHandledEditId(editParam);
      openEditModal(classToEdit);
    }
  }, [editParam, handledEditId, classes, showEditModal, openEditModal]);

  const isEditDirty = useMemo(() => {
    if (!editingClass) return false;
    const goalValue = editShowCustomGoal ? editCustomGoal.trim() : editGoal;
    const ageBandValue = editShowCustomAgeBand ? editCustomAgeBand.trim() : editAgeBand;
    return (
      editingClass.name !== editName ||
      (editingClass.unit ?? "") !== editUnit ||
      (editingClass.colorKey ?? null) !== editColorKey ||
      editingClass.modality !== editModality ||
      (editingClass.ageBand ?? "08-09") !== ageBandValue ||
      (editingClass.gender ?? "misto") !== editGender ||
      (editingClass.goal ?? "Fundamentos") !== goalValue ||
      (editingClass.startTime ?? "14:00") !== editStartTime ||
      String(editingClass.durationMinutes ?? 60) !== editDuration ||
      JSON.stringify(editingClass.daysOfWeek ?? []) !== JSON.stringify(editDays) ||
      (editingClass.mvLevel ?? "MV1") !== editMvLevel ||
      (editingClass.cycleStartDate ?? "") !== editCycleStartDate ||
      (editingClass.cycleLengthWeeks ?? 12) !== editCycleLengthWeeks
    );
  }, [
    editingClass,
    editName,
    editUnit,
    editColorKey,
    editModality,
    editAgeBand,
    editGender,
    editGoal,
    editShowCustomGoal,
    editCustomGoal,
    editStartTime,
    editDuration,
    editDays,
    editMvLevel,
    editCycleStartDate,
    editCycleLengthWeeks,
  ]);

  const toggleEditDay = (value: number) => {
    setEditDays((prev) =>
      prev.includes(value) ? prev.filter((day) => day !== value) : [...prev, value]
    );
  };

  const findIntegrationCandidates = useCallback(
    (sourceClassId: string, unit: string, modality: ClassGroup["modality"], startTime: string, daysOfWeek: number[]) => {
      const ruleCandidates = integrationRules
        .filter((rule) => (rule.classIds ?? []).includes(sourceClassId))
        .flatMap((rule) => rule.classIds ?? [])
        .map((classId) => classes.find((item) => item.id === classId) ?? null)
        .filter((item): item is ClassGroup => item !== null && item.id !== sourceClassId);

      const uniqueRuleCandidates = Array.from(
        new Map(ruleCandidates.map((item) => [item.id, item])).values()
      );
      if (uniqueRuleCandidates.length) {
        return uniqueRuleCandidates.filter((item) => {
          if (normalizeUnitKey(item.unit) !== normalizeUnitKey(unit)) return false;
          if (item.modality !== modality) return false;
          if ((item.startTime ?? "").trim() !== startTime.trim()) return false;
          const itemDays = Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [];
          const daySet = new Set(daysOfWeek);
          return itemDays.some((day) => daySet.has(day));
        });
      }

      const normalizedUnit = normalizeUnitKey(unit);
      const daySet = new Set(daysOfWeek);
      return classes.filter((item) => {
        if (item.id === sourceClassId) return false;
        if (integrationPairKeys.has(buildPairKey(sourceClassId, item.id))) return false;
        if (normalizeUnitKey(item.unit) !== normalizedUnit) return false;
        if (item.modality !== modality) return false;
        if ((item.startTime ?? "").trim() !== startTime.trim()) return false;
        const itemDays = Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [];
        if (!isComplementaryGenderPair(editGender, item.gender)) return false;
        return itemDays.some((day) => daySet.has(day));
      });
    },
    [buildPairKey, classes, editGender, integrationRules, integrationPairKeys, isComplementaryGenderPair]
  );

  const saveEditClass = async () => {
    if (!editingClass) return;
    if (!editName.trim()) return;
    const goalValue = editShowCustomGoal ? editCustomGoal.trim() : editGoal.trim();
    const ageBandValue = editShowCustomAgeBand ? editCustomAgeBand.trim() : editAgeBand;
    if (!goalValue) {
      setEditFormError("Defina o objetivo da turma.");
      Vibration.vibrate(40);
      return;
    }
    const timeValue = editStartTime.trim();
    if (!isValidTime(timeValue)) {
      setEditFormError("Horário inválido. Use HH:MM.");
      Vibration.vibrate(40);
      return;
    }
    const durationValue = parseDuration(editDuration.trim());
    if (!durationValue) {
      setEditFormError("Duração inválida. Use minutos entre 30 e 180.");
      Vibration.vibrate(40);
      return;
    }
    const cycleValue = parseCycleLength(editCycleLengthWeeks);
    if (!cycleValue) {
      setEditFormError("Ciclo inválido. Use entre 2 e 12 semanas.");
      Vibration.vibrate(40);
      return;
    }
    setEditFormError("");
    setEditSaving(true);
    try {
      const integrationCandidates = findIntegrationCandidates(
        editingClass.id,
        editUnit.trim() || "Sem unidade",
        editModality,
        timeValue,
        editDays
      );
      await updateClass(editingClass.id, {
        name: editName.trim(),
        unit: editUnit.trim() || "Sem unidade",
        colorKey: editColorKey ?? null,
        ageBand: ageBandValue || editAgeBand,
        gender: editGender,
        modality: editModality ?? undefined,
        daysOfWeek: editDays,
        goal: goalValue,
        startTime: timeValue,
        durationMinutes: durationValue,
        mvLevel: editMvLevel,
        cycleStartDate: editCycleStartDate || undefined,
        cycleLengthWeeks: cycleValue,
      });
      await loadClasses();
      setShowEditModal(false);
      setEditingClass(null);

      if (integrationCandidates.length) {
        const classIds = [editingClass.id, ...integrationCandidates.map((item) => item.id)];
        const classNames = integrationCandidates.map((item) => item.name).join(" + ");
        confirmDialog({
          title: "Treino integrado detectado",
          message: classNames
            ? `Encontramos turma(s) no mesmo Horário: ${classNames}. Deseja criar um treino integrado?`
            : "Encontramos turma(s) no mesmo Horário. Deseja criar um treino integrado?",
          confirmLabel: "Criar treino",
          cancelLabel: "Agora não",
          tone: "default",
          onConfirm: () => {
            router.push({
              pathname: "/training",
              params: {
                createSessionClassIds: classIds.join(","),
                createSessionStartTime: timeValue,
              },
            });
          },
        });
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteClass = () => {
    const target = editingClass;
    if (!target) return;
    setShowEditModal(false);
    setEditingClass(null);
    setTimeout(() => {
      confirmUndo({
        title: "Excluir turma?",
        message: "Isso remove a turma e todos os dados relacionados.",
        confirmLabel: "Excluir",
        cancelLabel: "Cancelar",
        undoLabel: "Desfazer",
        undoMessage: "Turma excluída. Deseja desfazer?",
        delayMs: 4500,
        onOptimistic: () => {
          setClasses((prev) => prev.filter((item) => item.id !== target.id));
        },
        onConfirm: async () => {
          await measure("deleteClassCascade", () => deleteClassCascade(target.id));
          await loadClasses();
          logAction("Excluir turma", { classId: target.id });
        },
        onUndo: async () => {
          await loadClasses();
        },
      });
    }, 10);
  };

  const closeAllPickers = useCallback(() => {
    setShowUnitFilterPicker(false);
    setShowDurationPicker(false);
    setShowCycleLengthPicker(false);
    setShowMvLevelPicker(false);
    setShowAgeBandPicker(false);
    setShowGenderPicker(false);
    setShowModalityPicker(false);
    setShowGoalPicker(false);
    setShowEditDurationPicker(false);
    setShowEditCycleLengthPicker(false);
    setShowEditMvLevelPicker(false);
    setShowEditAgeBandPicker(false);
    setShowEditGenderPicker(false);
    setShowEditModalityPicker(false);
    setShowEditGoalPicker(false);
  }, []);

  const toggleUnitFilter = useCallback(() => {
    setShowDurationPicker(false);
    setShowCycleLengthPicker(false);
    setShowMvLevelPicker(false);
    setShowAgeBandPicker(false);
    setShowGenderPicker(false);
    setShowModalityPicker(false);
    setShowGoalPicker(false);
    setShowUnitFilterPicker((prev) => !prev);
  }, []);

  const toggleNewPicker = useCallback(
    (
      target:
        | "duration"
        | "cycle"
        | "level"
        | "age"
        | "gender"
        | "modality"
        | "goal"
    ) => {
      setShowUnitFilterPicker(false);
      setShowDurationPicker((prev) => (target === "duration" ? !prev : false));
      setShowCycleLengthPicker((prev) => (target === "cycle" ? !prev : false));
      setShowMvLevelPicker((prev) => (target === "level" ? !prev : false));
      setShowAgeBandPicker((prev) => (target === "age" ? !prev : false));
      setShowGenderPicker((prev) => (target === "gender" ? !prev : false));
      setShowModalityPicker((prev) => (target === "modality" ? !prev : false));
      setShowGoalPicker((prev) => (target === "goal" ? !prev : false));
    },
    []
  );

  const handleSelectUnit = useCallback((unit: string) => {
    setUnitFilter(unit);
    setShowUnitFilterPicker(false);
  }, []);

  const handleSelectDuration = useCallback(
    (value: SelectOptionValue) => {
      if (value === customOptionLabel) {
        animateLayout();
        setShowCustomDuration(true);
        setShowDurationPicker(false);
        return;
      }
      if (showCustomDuration) {
        animateLayout();
        setShowCustomDuration(false);
      }
      setNewDuration(String(value));
      setShowDurationPicker(false);
    },
    [customOptionLabel, showCustomDuration]
  );

  const handleSelectCycleLength = useCallback((value: SelectOptionValue) => {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) setNewCycleLengthWeeks(parsed);
    setShowCycleLengthPicker(false);
  }, []);

  const handleSelectMvLevel = useCallback((value: SelectOptionValue) => {
    setNewMvLevel(String(value));
    setShowMvLevelPicker(false);
  }, []);

  const handleSelectAgeBand = useCallback(
    (value: SelectOptionValue) => {
      if (value === customOptionLabel) {
        animateLayout();
        setShowAllAges(true);
        setShowAgeBandPicker(false);
        return;
      }
      if (showAllAges) {
        animateLayout();
        setShowAllAges(false);
      }
      setNewAgeBand(String(value));
      setShowAgeBandPicker(false);
    },
    [customOptionLabel, showAllAges]
  );

  const handleSelectGender = useCallback((value: SelectOptionValue) => {
    setNewGender(value as ClassGroup["gender"]);
    setShowGenderPicker(false);
  }, []);

  const handleSelectModality = useCallback((value: SelectOptionValue) => {
    setNewModality(value as ClassGroup["modality"]);
    setShowModalityPicker(false);
  }, []);

  const handleSelectGoal = useCallback(
    (value: SelectOptionValue) => {
      if (value === customOptionLabel) {
        animateLayout();
        setShowAllGoals(true);
        setShowGoalPicker(false);
        return;
      }
      if (showAllGoals) {
        animateLayout();
        setShowAllGoals(false);
      }
      setNewGoal(String(value));
      setShowGoalPicker(false);
    },
    [customOptionLabel, showAllGoals]
  );

  const toggleEditPicker = useCallback(
    (
      target:
        | "duration"
        | "cycle"
        | "level"
        | "age"
        | "gender"
        | "modality"
        | "goal"
    ) => {
      setShowEditDurationPicker((prev) => (target === "duration" ? !prev : false));
      setShowEditCycleLengthPicker((prev) => (target === "cycle" ? !prev : false));
      setShowEditMvLevelPicker((prev) => (target === "level" ? !prev : false));
      setShowEditAgeBandPicker((prev) => (target === "age" ? !prev : false));
      setShowEditGenderPicker((prev) => (target === "gender" ? !prev : false));
      setShowEditModalityPicker((prev) => (target === "modality" ? !prev : false));
      setShowEditGoalPicker((prev) => (target === "goal" ? !prev : false));
    },
    []
  );

  const handleEditSelectDuration = useCallback(
    (value: SelectOptionValue) => {
      if (value === customOptionLabel) {
        animateLayout();
        setEditShowCustomDuration(true);
        setShowEditDurationPicker(false);
        return;
      }
      if (editShowCustomDuration) {
        animateLayout();
        setEditShowCustomDuration(false);
      }
      setEditDuration(String(value));
      setShowEditDurationPicker(false);
    },
    [customOptionLabel, editShowCustomDuration]
  );

  const handleEditSelectCycleLength = useCallback((value: SelectOptionValue) => {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) setEditCycleLengthWeeks(parsed);
    setShowEditCycleLengthPicker(false);
  }, []);

  const handleEditSelectMvLevel = useCallback((value: SelectOptionValue) => {
    setEditMvLevel(String(value));
    setShowEditMvLevelPicker(false);
  }, []);

  const handleEditSelectAgeBand = useCallback(
    (value: SelectOptionValue) => {
      if (value === customOptionLabel) {
        animateLayout();
        setEditShowCustomAgeBand(true);
        setEditCustomAgeBand(ageBandOptions.includes(editAgeBand) ? "" : editAgeBand);
        setShowEditAgeBandPicker(false);
        return;
      }
      if (editShowCustomAgeBand) {
        animateLayout();
        setEditShowCustomAgeBand(false);
      }
      const selected = String(value);
      setEditCustomAgeBand(selected);
      setEditAgeBand(selected as ClassGroup["ageBand"]);
      setShowEditAgeBandPicker(false);
    },
    [customOptionLabel, editAgeBand, editShowCustomAgeBand, ageBandOptions]
  );

  const handleEditSelectGender = useCallback((value: SelectOptionValue) => {
    setEditGender(value as ClassGroup["gender"]);
    setShowEditGenderPicker(false);
  }, []);

  const handleEditSelectModality = useCallback((value: SelectOptionValue) => {
    setEditModality(value as ClassGroup["modality"]);
    setShowEditModalityPicker(false);
  }, []);

  const handleEditSelectGoal = useCallback(
    (value: SelectOptionValue) => {
      if (value === customOptionLabel) {
        animateLayout();
        setEditShowCustomGoal(true);
        setShowEditGoalPicker(false);
        return;
      }
      if (editShowCustomGoal) {
        animateLayout();
        setEditShowCustomGoal(false);
      }
      setEditGoal(String(value));
      setEditCustomGoal("");
      setShowEditGoalPicker(false);
    },
    [customOptionLabel, editShowCustomGoal]
  );

  const syncEditPickerLayouts = useCallback(() => {
    const hasPickerOpen =
      showEditDurationPicker ||
      showEditCycleLengthPicker ||
      showEditMvLevelPicker ||
      showEditAgeBandPicker ||
      showEditGenderPicker ||
      showEditModalityPicker ||
      showEditGoalPicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showEditDurationPicker) {
        editDurationTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditDurationTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditCycleLengthPicker) {
        editCycleLengthTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditCycleLengthTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditMvLevelPicker) {
        editMvLevelTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditMvLevelTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditAgeBandPicker) {
        editAgeBandTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditAgeBandTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditGenderPicker) {
        editGenderTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditGenderTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditModalityPicker) {
        editModalityTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditModalityTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditGoalPicker) {
        editGoalTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditGoalTriggerLayout({ x, y, width, height });
        });
      }
      editContainerRef.current?.measureInWindow((x, y) => {
        setEditContainerWindow({ x, y });
      });
    });
  }, [
    showEditDurationPicker,
    showEditCycleLengthPicker,
    showEditMvLevelPicker,
    showEditAgeBandPicker,
    showEditGenderPicker,
    showEditModalityPicker,
    showEditGoalPicker,
  ]);

  useEffect(() => {
    syncEditPickerLayouts();
  }, [
    showEditDurationPicker,
    showEditCycleLengthPicker,
    showEditMvLevelPicker,
    showEditAgeBandPicker,
    showEditGenderPicker,
    showEditModalityPicker,
    showEditGoalPicker,
    syncEditPickerLayouts,
  ]);

  const syncPickerLayouts = useCallback(() => {
    const hasPickerOpen =
      showUnitFilterPicker ||
      showDurationPicker ||
      showCycleLengthPicker ||
      showMvLevelPicker ||
      showAgeBandPicker ||
      showGenderPicker ||
      showModalityPicker ||
      showGoalPicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showUnitFilterPicker) {
        unitFilterTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setUnitFilterLayout({ x, y, width, height });
        });
      }
      if (showDurationPicker) {
        durationTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setDurationTriggerLayout({ x, y, width, height });
        });
      }
      if (showCycleLengthPicker) {
        cycleLengthTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setCycleLengthTriggerLayout({ x, y, width, height });
        });
      }
      if (showMvLevelPicker) {
        mvLevelTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setMvLevelTriggerLayout({ x, y, width, height });
        });
      }
      if (showAgeBandPicker) {
        ageBandTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setAgeBandTriggerLayout({ x, y, width, height });
        });
      }
      if (showGenderPicker) {
        genderTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setGenderTriggerLayout({ x, y, width, height });
        });
      }
      if (showModalityPicker) {
        modalityTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setModalityTriggerLayout({ x, y, width, height });
        });
      }
      if (showGoalPicker) {
        goalTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setGoalTriggerLayout({ x, y, width, height });
        });
      }
      containerRef.current?.measureInWindow((x, y) => {
        setContainerWindow({ x, y });
      });
    });
  }, [
    showUnitFilterPicker,
    showDurationPicker,
    showCycleLengthPicker,
    showMvLevelPicker,
    showAgeBandPicker,
    showGenderPicker,
    showModalityPicker,
    showGoalPicker,
  ]);

  useEffect(() => {
    syncPickerLayouts();
  }, [
    showUnitFilterPicker,
    showDurationPicker,
    showCycleLengthPicker,
    showMvLevelPicker,
    showAgeBandPicker,
    showGenderPicker,
    showModalityPicker,
    showGoalPicker,
    syncPickerLayouts,
  ]);

  const handleOpenClass = useCallback(
    (item: ClassGroup) => {
      router.push({
        pathname: "/class/[id]",
        params: { id: item.id },
      });
    },
    [router]
  );
  const handleSelectNewColor = useCallback((value: string | null) => {
    setNewColorKey(value);
  }, []);
  const handleSelectEditColor = useCallback((value: string | null) => {
    setEditColorKey(value);
  }, []);

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
                fontSize: 14,
                fontWeight: active ? "700" : "500",
              }}
            >
              {unit}
            </Text>
          </AnchoredDropdownOption>
        );
      }),
    [colors]
  );

  const SelectOption = useMemo(
    () =>
      memo(function SelectOptionItem({
        label,
        value,
        active,
        onSelect,
        isFirst = false,
      }: {
        label: string;
        value: SelectOptionValue;
        active: boolean;
        onSelect: (value: SelectOptionValue) => void;
        isFirst?: boolean;
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
              {label}
            </Text>
          </AnchoredDropdownOption>
        );
      }),
    [colors]
  );

  const ColorOption = useMemo(
    () =>
      memo(function ColorOptionItem({
        label,
        value,
        active,
        palette,
        onSelect,
        isFirst,
      }: {
        label: string;
        value: string | null;
        active: boolean;
        palette: { bg: string; text: string };
        onSelect: (value: string | null) => void;
        isFirst: boolean;
      }) {
        return (
          <Pressable
            onPress={() => onSelect(value)}
            style={{
              alignItems: "center",
              gap: 4,
              marginLeft: isFirst ? 6 : 0,
              marginRight: 2,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: palette.bg,
                borderWidth: active ? 3 : 1,
                borderColor: active ? colors.text : colors.border,
              }}
            />
          </Pressable>
        );
      }),
    [colors]
  );

    const isDirty =
      newName.trim() ||
      newUnit.trim() ||
    newModality !== "" ||
      newStartTime.trim() !== "14:00" ||
      newDuration.trim() !== "60" ||
      newAgeBand.trim() !== "08-09" ||
    newMvLevel.trim() !== "MV1" ||
    newGender !== "misto" ||
    newGoal.trim() !== "Fundamentos" ||
    newDays.length > 0 ||
    newCycleStartDate.trim() ||
    newCycleLengthWeeks !== 12;

  if (loading && !classes.length) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenLoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View ref={containerRef} style={{ flex: 1, minHeight: 0, position: "relative", overflow: "visible" }}>
        <ScreenTopChrome
          style={{
            gap: 16,
            paddingBottom: 8,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
        >
          <View style={{ marginBottom: 4 }}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
                Turmas
              </Text>
            </Pressable>
          </View>

          <ConfirmCloseOverlay
            visible={showCreateTabConfirm}
            onCancel={() => {
              setShowCreateTabConfirm(false);
              setPendingMainTab(null);
            }}
            onConfirm={() => {
              setShowCreateTabConfirm(false);
              resetCreateForm();
              setMainTab(pendingMainTab ?? "lista");
              setPendingMainTab(null);
            }}
          />

          <View
            style={{
              flexDirection: "row",
              gap: 6,
              padding: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
            }}
          >
              {[
                { id: "lista" as const, label: "Lista" },
                { id: "criar" as const, label: "Criar turma" },
              ].map((tab) => {
                const tabProgress = mainTabAnim[tab.id];
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
                    onPress={() => requestSwitchMainTab(tab.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 999,
                      alignItems: "center",
                    }}
                  >
                    <Animated.Text
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
        </ScreenTopChrome>

        {mainTab === "lista" ? (
          <View style={{ flex: 1, minHeight: 0, gap: 12, paddingHorizontal: 16, paddingTop: 12 }}>
            <UnitFilterBar
              units={units}
              selectedUnit={unitFilter}
              onSelectUnit={handleSelectUnit}
            />
            <View style={{ flex: 1, minHeight: 0, paddingLeft: 10 }}>
              <ClassesListSection
                grouped={grouped}
                conflictsById={conflictsById}
                dayNames={dayNames}
                colors={colors}
                onOpenClass={handleOpenClass}
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  try {
                    await loadClasses();
                  } finally {
                    setRefreshing(false);
                  }
                }}
                onScrollBeginDrag={closeAllPickers}
                contentContainerStyle={{
                  paddingBottom: bottomScrollPadding,
                  gap: 0,
                }}
              />
            </View>
          </View>
        ) : (
        <ScrollView
          style={{ flex: 1, minHeight: 0, backgroundColor: colors.background }}
          contentContainerStyle={{
            gap: 16,
            paddingBottom: bottomScrollPadding,
            paddingHorizontal: 16,
            paddingTop: 12,
          }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={closeAllPickers}
        >
        <View style={{ gap: 12, marginTop: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Nome da turma</Text>
              <TextInput
                placeholder="Nome da turma"
                value={newName}
                onChangeText={setNewName}
                placeholderTextColor={colors.placeholder}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  color: colors.text,
                }}
              />
            </View>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Unidade</Text>
              <TextInput
                placeholder="Unidade"
                value={newUnit}
                onChangeText={setNewUnit}
                placeholderTextColor={colors.placeholder}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  color: colors.text,
                }}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>gênero</Text>
              <View ref={genderTriggerRef}>
                <Pressable
                  onPress={() => toggleNewPicker("gender")}
                  style={selectFieldStyle}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {getOptionLabel(newGender, genderOptions) || "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showGenderPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
            </View>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Objetivo</Text>
                <View ref={goalTriggerRef} style={{ width: "100%" }}>
                  <Pressable
                    onPress={() => toggleNewPicker("goal")}
                    style={[selectFieldStyle, { width: "100%" }]}
                  >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {newGoal || "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showGoalPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
              { showAllGoals ? (
                <TextInput
                  placeholder="Objetivo (ex: Força, Potência)"
                  value={newGoal}
                  onChangeText={setNewGoal}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    color: colors.inputText,
                    fontSize: 13,
                  }}
                />
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Modalidade</Text>
              <View ref={modalityTriggerRef}>
                <Pressable
                  onPress={() => toggleNewPicker("modality")}
                  style={selectFieldStyle}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {getOptionLabel(newModality, modalityOptions) || "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showModalityPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Faixa etária</Text>
              <View ref={ageBandTriggerRef}>
                <Pressable
                  onPress={() => toggleNewPicker("age")}
                  style={selectFieldStyle}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {newAgeBand || "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showAgeBandPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
              { showAllAges ? (
                <TextInput
                  placeholder="Faixa etária (ex: 14-16)"
                  value={newAgeBand}
                  onChangeText={setNewAgeBand}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    color: colors.inputText,
                    fontSize: 13,
                  }}
                />
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Horário de início</Text>
              <TextInput
                placeholder="HH:MM"
                value={newStartTime}
                onChangeText={(value) => setNewStartTime(normalizeTimeInput(value))}
                keyboardType="numeric"
                placeholderTextColor={colors.placeholder}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  color: colors.text,
                }}
              />
            </View>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Dura??o</Text>
              <View ref={durationTriggerRef}>
                <Pressable
                  onPress={() => toggleNewPicker("duration")}
                  style={selectFieldStyle}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {newDuration ? `${newDuration} min` : "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showDurationPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
              { showCustomDuration ? (
                <TextInput
                  placeholder="Dura??o (min)"
                  value={newDuration}
                  onChangeText={setNewDuration}
                  keyboardType="numeric"
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    color: colors.inputText,
                    fontSize: 13,
                  }}
                />
              ) : null}
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Dias da semana</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {dayNames.map((label, index) => {
                const active = newDays.includes(index);
                return (
                  <Pressable
                    key={label}
                    onPress={() => toggleDay(index)}
                    style={getChipStyle(active)}
                  >
                    <Text style={getChipTextStyle(active)}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Nível</Text>
              <View ref={mvLevelTriggerRef}>
                <Pressable
                  onPress={() => toggleNewPicker("level")}
                  style={selectFieldStyle}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {getOptionLabel(newMvLevel, mvLevelOptions) || "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showMvLevelPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Dura??o do ciclo</Text>
              <View ref={cycleLengthTriggerRef}>
                <Pressable
                  onPress={() => toggleNewPicker("cycle")}
                  style={selectFieldStyle}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {newCycleLengthWeeks
                      ? `${newCycleLengthWeeks} semanas`
                      : "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showCycleLengthPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Inicio do ciclo</Text>
            <DateInput
              value={newCycleStartDate}
              onChange={setNewCycleStartDate}
              onOpenCalendar={() => setShowNewCycleCalendar(true)}
              placeholder="DD/MM/AAAA"
            />
          </View>
          { formError ? (
            <Text style={{ color: colors.dangerText, fontSize: 12 }}>
              {formError}
            </Text>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          <Button
            label={saving ? "Salvando..." : "Criar turma"}
            onPress={saveNewClass}
            disabled={saving || !newName.trim()}
          />
        </View>
        </ScrollView>
        )}

        <AnchoredDropdown
          visible={showUnitFilterPickerContent}
          layout={unitFilterLayout}
          container={containerWindow}
          animationStyle={unitFilterAnimStyle}
          zIndex={300}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {units.map((unit, index) => {
            const active = unitFilter === unit;
            const palette =
              unit === "Todas"
                 ? { bg: colors.primaryBg, text: colors.primaryText }
                : getUnitPalette(unit, colors);
            return (
              <UnitOption
                key={unit}
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
          visible={showDurationPickerContent}
          layout={durationTriggerLayout}
          container={containerWindow}
          animationStyle={durationPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {durationOptions.map((value, index) => (
            <SelectOption
              key={value}
              label={`${value} min`}
              value={value}
              active={newDuration === value}
              onSelect={handleSelectDuration}
              isFirst={index === 0}
            />
          ))}
          <SelectOption
            label={customOptionLabel}
            value={customOptionLabel}
            active={showCustomDuration}
            onSelect={handleSelectDuration}
          />
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showCycleLengthPickerContent}
          layout={cycleLengthTriggerLayout}
          container={containerWindow}
          animationStyle={cycleLengthPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {cycleLengthOptions.map((value, index) => (
            <SelectOption
              key={value}
              label={`${value} semanas`}
              value={value}
              active={newCycleLengthWeeks === value}
              onSelect={handleSelectCycleLength}
              isFirst={index === 0}
            />
          ))}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showMvLevelPickerContent}
          layout={mvLevelTriggerLayout}
          container={containerWindow}
          animationStyle={mvLevelPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {mvLevelOptions.map((option, index) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={newMvLevel === option.value}
              onSelect={handleSelectMvLevel}
              isFirst={index === 0}
            />
          ))}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showAgeBandPickerContent}
          layout={ageBandTriggerLayout}
          container={containerWindow}
          animationStyle={ageBandPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {ageBandOptions.map((band, index) => (
            <SelectOption
              key={band}
              label={band}
              value={band}
              active={newAgeBand === band && !showAllAges}
              onSelect={handleSelectAgeBand}
              isFirst={index === 0}
            />
          ))}
          <SelectOption
            label={customOptionLabel}
            value={customOptionLabel}
            active={showAllAges}
            onSelect={handleSelectAgeBand}
          />
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showGenderPickerContent}
          layout={genderTriggerLayout}
          container={containerWindow}
          animationStyle={genderPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {genderOptions.map((option, index) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={newGender === option.value}
              onSelect={handleSelectGender}
              isFirst={index === 0}
            />
          ))}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showModalityPickerContent}
          layout={modalityTriggerLayout}
          container={containerWindow}
          animationStyle={modalityPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {modalityOptions.map((option, index) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={newModality === option.value}
              onSelect={handleSelectModality}
              isFirst={index === 0}
            />
          ))}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showGoalPickerContent}
          layout={goalTriggerLayout}
          container={containerWindow}
          animationStyle={goalPickerAnimStyle}
          zIndex={320}
          maxHeight={260}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}
          scrollContentStyle={{ padding: 8, gap: 6 }}
        >
          {goalOptions.map((goal, index) => (
            <SelectOption
              key={goal}
              label={goal}
              value={goal}
              active={newGoal === goal && !showAllGoals}
              onSelect={handleSelectGoal}
              isFirst={index === 0}
            />
          ))}
          <SelectOption
            label={customOptionLabel}
            value={customOptionLabel}
            active={showAllGoals}
            onSelect={handleSelectGoal}
          />
        </AnchoredDropdown>
      </View>
      </KeyboardAvoidingView>

      <ConfirmCloseOverlay
        visible={showEditCloseConfirm}
        onCancel={() => setShowEditCloseConfirm(false)}
        onConfirm={() => {
          setShowEditCloseConfirm(false);
          closeEditModal();
        }}
      />
      <ModalDialogFrame
        visible={showEditModal}
        onClose={requestCloseEditModal}
        cardStyle={[
          editModalCardStyle,
          {
            paddingBottom: 0,
            maxHeight: "92%",
            height: "92%",
            minHeight: 0,
            overflow: "hidden",
          },
        ]}
        position="center"
        colors={colors}
        title="Editar turma"
        subtitle={editingClass?.name ? editingClass.name : "Ajuste os dados, agenda e perfil da turma."}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={editSaving ? "Salvando..." : "Salvar alterações"}
                onPress={saveEditClass}
                disabled={editSaving || !editName.trim() || !isEditDirty}
                loading={editSaving}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Excluir turma"
                variant="danger"
                onPress={handleDeleteClass}
                disabled={editSaving}
                loading={false}
              />
            </View>
          </View>
        }
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingHorizontal: 12, paddingTop: 12 }}
      >
        <Suspense
          fallback={
            <View style={{ gap: 10, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 24 }}>
              <ShimmerBlock style={{ height: 22, width: 120, borderRadius: 10 }} />
              <ShimmerBlock style={{ height: 120, borderRadius: 14 }} />
              <ShimmerBlock style={{ height: 120, borderRadius: 14 }} />
            </View>
          }
        >
          <ClassEditModalBody
            refs={{
              editContainerRef,
              editDurationTriggerRef,
              editCycleLengthTriggerRef,
              editMvLevelTriggerRef,
              editAgeBandTriggerRef,
              editGenderTriggerRef,
              editModalityTriggerRef,
              editGoalTriggerRef,
            }}
            layouts={{
              editContainerWindow,
              editDurationTriggerLayout,
              editCycleLengthTriggerLayout,
              editMvLevelTriggerLayout,
              editAgeBandTriggerLayout,
              editGenderTriggerLayout,
              editModalityTriggerLayout,
              editGoalTriggerLayout,
            }}
            pickers={{
              showEditDurationPicker,
              showEditCycleLengthPicker,
              showEditMvLevelPicker,
              showEditAgeBandPicker,
              showEditGenderPicker,
              showEditModalityPicker,
              showEditGoalPicker,
              showEditDurationPickerContent,
              showEditCycleLengthPickerContent,
              showEditMvLevelPickerContent,
              showEditAgeBandPickerContent,
              showEditGenderPickerContent,
              showEditModalityPickerContent,
              showEditGoalPickerContent,
              editDurationPickerAnimStyle,
              editCycleLengthPickerAnimStyle,
              editMvLevelPickerAnimStyle,
              editAgeBandPickerAnimStyle,
              editGenderPickerAnimStyle,
              editModalityPickerAnimStyle,
              editGoalPickerAnimStyle,
              showEditCycleCalendar,
            }}
            fields={{
              editName,
              setEditName,
              editUnit,
              setEditUnit,
              editColorOptions,
              editColorKey,
              handleSelectEditColor,
              editStartTime,
              setEditStartTime,
              normalizeTimeInput,
              editDuration,
              setEditDuration,
              editShowCustomDuration,
              editCycleStartDate,
              setEditCycleStartDate,
              editCycleLengthWeeks,
              editMvLevel,
              editAgeBand,
              setEditAgeBand,
              editShowCustomAgeBand,
              editCustomAgeBand,
              setEditCustomAgeBand,
              editGender,
              editModality,
              editShowCustomGoal,
              editGoal,
              editCustomGoal,
              setEditCustomGoal,
              editDays,
              toggleEditDay,
              editFormError,
              editSaving,
              isEditDirty,
            }}
            options={{
              dayNames,
              durationOptions,
              cycleLengthOptions,
              ageBandOptions,
              genderOptions,
              modalityOptions,
              mvLevelOptions,
              goalOptions,
              customOptionLabel,
            }}
            actions={{
              closeAllPickers,
              toggleEditPicker,
              handleEditSelectDuration,
              handleEditSelectCycleLength,
              handleEditSelectMvLevel,
              handleEditSelectAgeBand,
              handleEditSelectGender,
              handleEditSelectModality,
              handleEditSelectGoal,
              saveEditClass,
              handleDeleteClass,
              setShowEditCycleCalendar,
            }}
          />
        </Suspense>
      </ModalDialogFrame>
      <DatePickerModal
        visible={showNewCycleCalendar}
        value={newCycleStartDate}
        onChange={(value) => setNewCycleStartDate(value)}
        onClose={() => setShowNewCycleCalendar(false)}
        closeOnSelect={false}
        initialViewMode="day"
      />
    </SafeAreaView>
  );
}



