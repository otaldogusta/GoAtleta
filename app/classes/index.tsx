import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    Vibration,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";
import { ShimmerBlock } from "../../src/ui/Shimmer";

import { compareClassesBySchedule } from "../../src/core/class-schedule-sort";
import type { ClassGroup } from "../../src/core/models";
import { normalizeUnitKey } from "../../src/core/unit-key";
import { deleteClassCascade, getClasses, saveClass, updateClass } from "../../src/db/seed";
import { logAction } from "../../src/observability/breadcrumbs";
import { measure } from "../../src/observability/perf";
import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";
import { animateLayout } from "../../src/ui/animate-layout";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { getClassColorOptions, getClassPalette } from "../../src/ui/class-colors";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { DateInput } from "../../src/ui/DateInput";
import { DatePickerModal } from "../../src/ui/DatePickerModal";
import { FadeHorizontalScroll } from "../../src/ui/FadeHorizontalScroll";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { usePersistedState } from "../../src/ui/use-persisted-state";

export default function ClassesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { confirm: confirmUndo } = useConfirmUndo();
  const [classes, setClasses] = useState<ClassGroup[]>([]);

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
  const [loading, setLoading] = useState(true);
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
  const [editSaving, setEditSaving] = useState(false);
  const [editFormError, setEditFormError] = useState("");
  const [editShowCustomDuration, setEditShowCustomDuration] = useState(false);
  const [editShowAllAges, setEditShowAllAges] = useState(false);
  const [editShowAllGoals, setEditShowAllGoals] = useState(false);
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
  const [suppressNextPress, setSuppressNextPress] = useState(false);
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
  const modalityOptions: { value: NonNullable<ClassGroup["modality"]>; label: string }[] =
    [
      { value: "voleibol", label: "Voleibol" },
      { value: "fitness", label: "Fitness" },
    ];
  const goals: ClassGroup["goal"][] = [
    "Fundamentos",
    "Forca Geral",
    "Potencia/Agilidade",
    "Forca+Potencia",
    "Velocidade",
    "Agilidade",
    "Resistencia",
    "Potencia",
    "Mobilidade",
    "Coordenacao",
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
  const getChipStyle = (
    active: boolean,
    palette: { bg: string; text: string }
  ) => ({
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: active ? palette.bg ?? colors.primaryBg : colors.secondaryBg,
  });
  const getChipTextStyle = (
    active: boolean,
    palette: { bg: string; text: string }
  ) => ({
    color: active ? palette.text ?? colors.primaryText : colors.text,
    fontWeight: "600" as const,
    fontSize: 12,
  });
  const selectFieldStyle = {
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

  const inferModality = useCallback((item: ClassGroup | null) => {
    if (!item) return "voleibol";
    if (item.modality) return item.modality;
    const goal = (item.goal ?? "").toLowerCase();
    const unit = normalizeUnitKey(item.unit);
    if (goal.includes("fundamentos")) {
      if (unit.includes("esperanca") || unit.includes("pinhais")) {
        return "voleibol";
      }
    }
    return "fitness";
  }, []);

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

  const conflictsById = useMemo(() => {
    const map: Record<string, { name: string; day: number }[]> = {};
    for (let i = 0; i < classes.length; i += 1) {
      const a = classes[i];
      const aStart = toMinutes(a.startTime || "");
      if (aStart === null) continue;
      const aEnd = aStart + (a.durationMinutes || 60);
      const aDays = Array.isArray(a.daysOfWeek) ? a.daysOfWeek : [];
      for (let j = i + 1; j < classes.length; j += 1) {
        const b = classes[j];
        if (unitKey(a.unit) !== unitKey(b.unit)) continue;
        const bStart = toMinutes(b.startTime || "");
        if (bStart === null) continue;
        const bEnd = bStart + (b.durationMinutes || 60);
        const bDays = Array.isArray(b.daysOfWeek) ? b.daysOfWeek : [];
        const sharedDays = aDays.filter((day) => bDays.includes(day));
        if (!sharedDays.length) continue;
        const overlap = aStart < bEnd && bStart < aEnd;
        if (!overlap) continue;
        sharedDays.forEach((day) => {
          if (!map[a.id]) map[a.id] = [];
          if (!map[b.id]) map[b.id] = [];
          map[a.id].push({ name: b.name ?? "Turma sem nome", day });
          map[b.id].push({ name: a.name ?? "Turma sem nome", day });
        });
      }
    }
    return map;
  }, [classes]);

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

  const loadClasses = useCallback(async (alive: { current: boolean }) => {
    const isAlive = () => !alive || alive.current;
    setLoading(true);
    try {
      const data = await getClasses();
      if (isAlive()) setClasses(data);
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
      setFormError("Selecione o nível.");
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
        await saveClass({
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
      router.back();
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

  const openEditModal = useCallback((item: ClassGroup) => {
    setEditingClass(item);
    setEditName(item.name ?? "");
    setEditUnit(item.unit ?? "");
    setEditColorKey(item.colorKey ?? null);
    setEditModality(inferModality(item));
    setEditAgeBand(item.ageBand ?? "08-09");
    setEditGender(item.gender ?? "misto");
    setEditGoal(item.goal ?? "Fundamentos");
    setEditStartTime(item.startTime ?? "14:00");
    setEditDuration(String(item.durationMinutes ?? 60));
    setEditDays(item.daysOfWeek ?? []);
    setEditMvLevel(item.mvLevel ?? "MV1");
    setEditCycleStartDate(item.cycleStartDate ?? "");
    setEditCycleLengthWeeks(item.cycleLengthWeeks ?? 12);
    setEditFormError("");
    setEditShowCustomDuration(false);
    setEditShowAllAges(false);
    setEditShowAllGoals(false);
    setShowEditModal(true);
  }, []);

  const isEditDirty = useMemo(() => {
    if (!editingClass) return false;
    return (
      editingClass.name !== editName ||
      (editingClass.unit ?? "") !== editUnit ||
      (editingClass.colorKey ?? null) !== editColorKey ||
      inferModality(editingClass) !== editModality ||
      (editingClass.ageBand ?? "08-09") !== editAgeBand ||
      (editingClass.gender ?? "misto") !== editGender ||
      (editingClass.goal ?? "Fundamentos") !== editGoal ||
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

  const saveEditClass = async () => {
    if (!editingClass) return;
    if (!editName.trim()) return;
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
        await updateClass(editingClass.id, {
          name: editName.trim(),
          unit: editUnit.trim() || "Sem unidade",
          colorKey: editColorKey ?? null,
          ageBand: editAgeBand,
          gender: editGender,
          modality: editModality ?? undefined,
          daysOfWeek: editDays,
          goal: editGoal,
          startTime: timeValue,
          durationMinutes: durationValue,
          mvLevel: editMvLevel,
          cycleStartDate: editCycleStartDate || undefined,
          cycleLengthWeeks: cycleValue,
      });
      await loadClasses();
      setShowEditModal(false);
      setEditingClass(null);
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
        undoMessage: "Turma excluída. Deseja desfazer?",
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
        setEditShowAllAges(true);
        setShowEditAgeBandPicker(false);
        return;
      }
      if (editShowAllAges) {
        animateLayout();
        setEditShowAllAges(false);
      }
      setEditAgeBand(String(value));
      setShowEditAgeBandPicker(false);
    },
    [customOptionLabel, editShowAllAges]
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
        setEditShowAllGoals(true);
        setShowEditGoalPicker(false);
        return;
      }
      if (editShowAllGoals) {
        animateLayout();
        setEditShowAllGoals(false);
      }
      setEditGoal(String(value));
      setShowEditGoalPicker(false);
    },
    [customOptionLabel, editShowAllGoals]
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
        editDurationTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditDurationTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditCycleLengthPicker) {
        editCycleLengthTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditCycleLengthTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditMvLevelPicker) {
        editMvLevelTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditMvLevelTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditAgeBandPicker) {
        editAgeBandTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditAgeBandTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditGenderPicker) {
        editGenderTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditGenderTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditModalityPicker) {
        editModalityTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditModalityTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditGoalPicker) {
        editGoalTriggerRef.current.measureInWindow((x, y, width, height) => {
          setEditGoalTriggerLayout({ x, y, width, height });
        });
      }
      editContainerRef.current.measureInWindow((x, y) => {
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
        unitFilterTriggerRef.current.measureInWindow((x, y, width, height) => {
          setUnitFilterLayout({ x, y, width, height });
        });
      }
      if (showDurationPicker) {
        durationTriggerRef.current.measureInWindow((x, y, width, height) => {
          setDurationTriggerLayout({ x, y, width, height });
        });
      }
      if (showCycleLengthPicker) {
        cycleLengthTriggerRef.current.measureInWindow((x, y, width, height) => {
          setCycleLengthTriggerLayout({ x, y, width, height });
        });
      }
      if (showMvLevelPicker) {
        mvLevelTriggerRef.current.measureInWindow((x, y, width, height) => {
          setMvLevelTriggerLayout({ x, y, width, height });
        });
      }
      if (showAgeBandPicker) {
        ageBandTriggerRef.current.measureInWindow((x, y, width, height) => {
          setAgeBandTriggerLayout({ x, y, width, height });
        });
      }
      if (showGenderPicker) {
        genderTriggerRef.current.measureInWindow((x, y, width, height) => {
          setGenderTriggerLayout({ x, y, width, height });
        });
      }
      if (showModalityPicker) {
        modalityTriggerRef.current.measureInWindow((x, y, width, height) => {
          setModalityTriggerLayout({ x, y, width, height });
        });
      }
      if (showGoalPicker) {
        goalTriggerRef.current.measureInWindow((x, y, width, height) => {
          setGoalTriggerLayout({ x, y, width, height });
        });
      }
      containerRef.current.measureInWindow((x, y) => {
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
      if (suppressNextPress) {
        setSuppressNextPress(false);
        return;
      }
      router.push({
        pathname: "/class/[id]",
        params: { id: item.id },
      });
    },
    [router, suppressNextPress]
  );

  const handleEditClass = useCallback(
    (item: ClassGroup) => {
      setSuppressNextPress(true);
      openEditModal(item);
    },
    [openEditModal]
  );

  const handleOpenAttendance = useCallback(
    (item: ClassGroup) => {
      router.push({
        pathname: "/class/[id]/attendance",
        params: { id: item.id, date: formatIsoDate(new Date()) },
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
          <Pressable
            onPress={() => onSelect(unit)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              margin: isFirst ? 6 : 2,
              backgroundColor: active ? palette.bg : "transparent",
            }}
          >
            <Text
              style={{
                color: active ? palette.text : colors.text,
                fontSize: 12,
                fontWeight: active ? "700" : "500",
              }}
            >
              {unit}
            </Text>
          </Pressable>
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
        isFirst,
      }: {
        label: string;
        value: SelectOptionValue;
        active: boolean;
        onSelect: (value: SelectOptionValue) => void;
        isFirst: boolean;
      }) {
        return (
          <Pressable
            onPress={() => onSelect(value)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              margin: isFirst ? 6 : 2,
              backgroundColor: active ? colors.primaryBg : "transparent",
            }}
          >
            <Text
              style={{
                color: active ? colors.primaryText : colors.text,
                fontSize: 12,
                fontWeight: active ? "700" : "500",
              }}
            >
              {label}
            </Text>
          </Pressable>
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

  const ClassCard = useMemo(
    () =>
      memo(function ClassCardItem({
        item,
        conflicts,
        onOpen,
        onEdit,
        onAttendance,
      }: {
        item: ClassGroup;
        conflicts: { name: string; day: number }[] | null | undefined;
        onOpen: (value: ClassGroup) => void;
        onEdit: (value: ClassGroup) => void;
        onAttendance: (value: ClassGroup) => void;
      }) {
        const palette = getClassPalette(item.colorKey, colors, item.unit);
        const parsed = parseTime(item.startTime || "");
        const duration = item.durationMinutes || 60;
        const safeConflicts = conflicts ?? [];
        const timeLabel = parsed
           ? `${formatTimeRange(parsed.hour, parsed.minute, duration)} - ${item.name}`
          : item.name;
        const hasConflicts = safeConflicts.length > 0;
        return (
          <Pressable
            onPress={() => onOpen(item)}
            onLongPress={() => onEdit(item)}
            delayLongPress={250}
            style={{
              padding: 14,
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: palette.bg,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            }}
          >
            { hasConflicts ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingVertical: 2,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: colors.dangerBg,
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.dangerText,
                    fontWeight: "700",
                    fontSize: 11,
                  }}
                >
                  Conflito de horário
                </Text>
              </View>
            ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    {timeLabel}
                  </Text>
                  <ClassGenderBadge gender={item.gender} />
                </View>
              </View>
            { hasConflicts ? (
              <Text style={{ color: colors.dangerText, marginTop: 6 }}>
                {"Conflitos: " +
                  safeConflicts
                    .map(
                      (conflict) =>
                        `${conflict.name} (${dayNames[conflict.day]})`
                    )
                    .join(", ")}
              </Text>
            ) : null}
          </Pressable>
        );
      }),
    [colors]
  );

    const isDirty =
      newName.trim() ||
      newUnit.trim() ||
      newModality !== "voleibol" ||
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ gap: 10 }}>
            <ShimmerBlock style={{ height: 28, width: 140, borderRadius: 12 }} />
            <ShimmerBlock style={{ height: 16, width: 220, borderRadius: 8 }} />
          </View>
          <View style={{ gap: 10 }}>
            <ShimmerBlock style={{ height: 42, borderRadius: 22 }} />
            <ShimmerBlock style={{ height: 42, borderRadius: 22 }} />
          </View>
          <View style={{ gap: 12 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <ShimmerBlock key={`class-shimmer-${index}`} style={{ height: 90, borderRadius: 18 }} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View ref={containerRef} style={{ flex: 1, position: "relative", overflow: "visible" }}>
        <ScrollView
          contentContainerStyle={{
            gap: 16,
            paddingBottom: 24,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
          keyboardShouldPersistTaps="handled"
          onScroll={syncPickerLayouts}
          scrollEventThrottle={16}
        >
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Turmas
          </Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Lista completa</Text>
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
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
            {[
              { id: "lista" as const, label: "Lista" },
              { id: "criar" as const, label: "Criar turma" },
            ].map((tab) => {
              const selected = mainTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => requestSwitchMainTab(tab.id)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: selected ? colors.primaryBg : colors.card,
                    borderWidth: selected ? 0 : 1,
                    borderColor: selected ? "transparent" : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primaryText : colors.muted,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
        </View>

        {mainTab === "lista" && (
        <View style={{ gap: 12, marginTop: 12 }}>
          <View style={[getSectionCardStyle(colors, "info", { padding: 10, radius: 16 })]}>
            <FadeHorizontalScroll
              fadeColor={colors.card}
              contentContainerStyle={{ flexDirection: "row", gap: 8 }}
            >
              {units.map((unit) => {
                const active = unitFilter === unit;
                const palette =
                  unit === "Todas"
                     ? { bg: colors.primaryBg, text: colors.primaryText }
                    : getUnitPalette(unit, colors);
                return (
                  <Pressable
                    key={unit}
                    onPress={() => handleSelectUnit(unit)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: active ? palette.bg : colors.secondaryBg,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? palette.text : colors.text,
                        fontSize: 12,
                      }}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                );
              })}
            </FadeHorizontalScroll>
          </View>
          {grouped.map(([unit, items]) => {
            return (
              <View
                key={unit}
                style={{
                  gap: 10,
                  paddingLeft: 10,
                }}
              >
                <View
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    borderRadius: 10,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                    {unit}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {"Turmas: " + items.length}
                  </Text>
                </View>
                <View style={{ gap: 12 }}>
                  {items.map((item) => (
                    <ClassCard
                      key={item.id}
                      item={item}
                      conflicts={conflictsById[item.id]}
                      onOpen={handleOpenClass}
                      onEdit={handleEditClass}
                      onAttendance={handleOpenAttendance}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
        )}

        {mainTab === "criar" && (
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
                  backgroundColor: colors.inputBg,
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
                  backgroundColor: colors.inputBg,
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
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Cor da turma</Text>
            <FadeHorizontalScroll
              fadeColor={colors.background}
              contentContainerStyle={{ flexDirection: "row", gap: 8 }}
            >
              {newColorOptions.map((option, index) => {
                const value = option.key === "default" ? null : option.key;
                const active = (newColorKey ?? null) === value;
                return (
                  <ColorOption
                    key={option.key}
                    label={option.label}
                    value={value}
                    active={active}
                    palette={option.palette}
                    onSelect={handleSelectNewColor}
                    isFirst={index === 0}
                  />
                );
              })}
            </FadeHorizontalScroll>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Gênero</Text>
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
                    backgroundColor: colors.inputBg,
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
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    fontSize: 13,
                  }}
                />
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Horário de inicio</Text>
              <TextInput
                placeholder="HH:MM"
                value={newStartTime}
                onChangeText={(value) => setNewStartTime(normalizeTimeInput(value))}
                keyboardType="numeric"
                placeholderTextColor={colors.placeholder}
                style={{
                  backgroundColor: colors.inputBg,
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
              <Text style={{ color: colors.muted, fontSize: 11 }}>Duração</Text>
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
                  placeholder="Duração (min)"
                  value={newDuration}
                  onChangeText={setNewDuration}
                  keyboardType="numeric"
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
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
              <Text style={{ color: colors.muted, fontSize: 11 }}>Duração do ciclo</Text>
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
        )}
        </ScrollView>

        <AnchoredDropdown
          visible={showUnitFilterPickerContent}
          layout={unitFilterLayout}
          container={containerWindow}
          animationStyle={unitFilterAnimStyle}
          zIndex={300}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
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
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
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
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
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
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
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
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
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
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
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
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
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
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
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

      <ModalSheet
        visible={showEditModal}
        onClose={requestCloseEditModal}
        cardStyle={editModalCardStyle}
        position="center"
      >
        <ConfirmCloseOverlay
          visible={showEditCloseConfirm}
          onCancel={() => setShowEditCloseConfirm(false)}
          onConfirm={() => {
            setShowEditCloseConfirm(false);
            closeEditModal();
          }}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Editar turma
          </Text>
          <Pressable
            onPress={requestCloseEditModal}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
              Fechar
            </Text>
          </Pressable>
        </View>
        <ScrollView
          style={{ maxHeight: "92%" }}
          contentContainerStyle={{ gap: 4, paddingHorizontal: 12, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onScroll={syncEditPickerLayouts}
          scrollEventThrottle={16}
        >
        <View ref={editContainerRef} style={{ position: "relative", gap: 4, marginTop: 16 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Nome da turma</Text>
                <TextInput
                  placeholder="Nome da turma"
                  value={editName}
                  onChangeText={setEditName}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    fontSize: 13,
                  }}
                />
              </View>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Unidade</Text>
                <TextInput
                  placeholder="Unidade"
                  value={editUnit}
                  onChangeText={setEditUnit}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    fontSize: 13,
                  }}
                />
              </View>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Cor da turma</Text>
              <FadeHorizontalScroll
                fadeColor={colors.card}
                contentContainerStyle={{ flexDirection: "row", gap: 8 }}
              >
                {editColorOptions.map((option, index) => {
                  const value = option.key === "default" ? null : option.key;
                  const active = (editColorKey ?? null) === value;
                  return (
                    <ColorOption
                      key={option.key}
                      label={option.label}
                      value={value}
                      active={active}
                      palette={option.palette}
                      onSelect={handleSelectEditColor}
                      isFirst={index === 0}
                    />
                  );
                })}
              </FadeHorizontalScroll>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Horário</Text>
                <TextInput
                  placeholder="Horário (HH:MM)"
                  value={editStartTime}
                  onChangeText={(value) => setEditStartTime(normalizeTimeInput(value))}
                  keyboardType="numeric"
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    fontSize: 13,
                  }}
                />
              </View>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Duração</Text>
                <View ref={editDurationTriggerRef}>
                  <Pressable
                    onPress={() => toggleEditPicker("duration")}
                    style={selectFieldStyle}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {editDuration ? `${editDuration} min` : "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: showEditDurationPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Pressable>
                </View>
                { editShowCustomDuration ? (
                  <TextInput
                    placeholder="Duração (min)"
                    value={editDuration}
                    onChangeText={setEditDuration}
                    keyboardType="numeric"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      fontSize: 13,
                    }}
                  />
                ) : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Data inicio do ciclo</Text>
                <DateInput
                  value={editCycleStartDate}
                  onChange={setEditCycleStartDate}
                  onOpenCalendar={() => setShowEditCycleCalendar(true)}
                  placeholder="DD/MM/AAAA"
                />
              </View>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Duração do ciclo</Text>
                <View ref={editCycleLengthTriggerRef}>
                  <Pressable
                    onPress={() => toggleEditPicker("cycle")}
                    style={selectFieldStyle}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {editCycleLengthWeeks ? `${editCycleLengthWeeks} semanas` : "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: showEditCycleLengthPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Nível</Text>
                <View ref={editMvLevelTriggerRef}>
                  <Pressable
                    onPress={() => toggleEditPicker("level")}
                    style={selectFieldStyle}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {getOptionLabel(editMvLevel, mvLevelOptions) || "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: showEditMvLevelPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Pressable>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Faixa etária</Text>
                <View ref={editAgeBandTriggerRef}>
                  <Pressable
                    onPress={() => toggleEditPicker("age")}
                    style={selectFieldStyle}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {editAgeBand || "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: showEditAgeBandPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Pressable>
                </View>
                { editShowAllAges ? (
                  <TextInput
                    placeholder="Faixa etária (ex: 14-16)"
                    value={editAgeBand}
                    onChangeText={setEditAgeBand}
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      fontSize: 13,
                    }}
                  />
                ) : null}
              </View>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Gênero</Text>
              <View ref={editGenderTriggerRef}>
                <Pressable
                  onPress={() => toggleEditPicker("gender")}
                  style={selectFieldStyle}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {getOptionLabel(editGender, genderOptions) || "Selecione"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [
                        { rotate: showEditGenderPicker ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </Pressable>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Modalidade</Text>
                <View ref={editModalityTriggerRef}>
                  <Pressable
                    onPress={() => toggleEditPicker("modality")}
                    style={selectFieldStyle}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {getOptionLabel(editModality, modalityOptions) || "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: showEditModalityPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Pressable>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Objetivo</Text>
                <View ref={editGoalTriggerRef} style={{ width: "100%" }}>
                  <Pressable
                    onPress={() => toggleEditPicker("goal")}
                    style={[selectFieldStyle, { width: "100%" }]}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      {editGoal || "Selecione"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.muted}
                      style={{
                        transform: [
                          { rotate: showEditGoalPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Pressable>
              </View>
              { editShowAllGoals ? (
                <TextInput
                  placeholder="Objetivo (ex: Força, Potência)"
                  value={editGoal}
                  onChangeText={setEditGoal}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
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
                  const active = editDays.includes(index);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => toggleEditDay(index)}
                      style={getChipStyle(active)}
                    >
                      <Text style={getChipTextStyle(active)}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            { editFormError ? (
              <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                {editFormError}
              </Text>
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
            <Button
              label={editSaving ? "Salvando..." : "Salvar alterações"}
              onPress={saveEditClass}
              disabled={editSaving || !editName.trim() || !isEditDirty}
            />
            <Button
              label="Excluir turma"
              variant="danger"
              onPress={handleDeleteClass}
              disabled={editSaving}
            />
          </View>
        </ScrollView>

        <AnchoredDropdown
          visible={showEditDurationPickerContent}
          layout={editDurationTriggerLayout}
          container={editContainerWindow}
          animationStyle={editDurationPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {durationOptions.map((item, index) => (
            <SelectOption
              key={item}
              label={item + " min"}
              value={item}
              active={editDuration === item && !editShowCustomDuration}
              onSelect={handleEditSelectDuration}
              isFirst={index === 0}
            />
          ))}
          <SelectOption
            label={customOptionLabel}
            value={customOptionLabel}
            active={editShowCustomDuration}
            onSelect={handleEditSelectDuration}
          />
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showEditCycleLengthPickerContent}
          layout={editCycleLengthTriggerLayout}
          container={editContainerWindow}
          animationStyle={editCycleLengthPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {cycleLengthOptions.map((value, index) => (
            <SelectOption
              key={value}
              label={`${value} semanas`}
              value={value}
              active={editCycleLengthWeeks === value}
              onSelect={handleEditSelectCycleLength}
              isFirst={index === 0}
            />
          ))}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showEditMvLevelPickerContent}
          layout={editMvLevelTriggerLayout}
          container={editContainerWindow}
          animationStyle={editMvLevelPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {mvLevelOptions.map((option, index) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={editMvLevel === option.value}
              onSelect={handleEditSelectMvLevel}
              isFirst={index === 0}
            />
          ))}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showEditAgeBandPickerContent}
          layout={editAgeBandTriggerLayout}
          container={editContainerWindow}
          animationStyle={editAgeBandPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {ageBandOptions.map((band, index) => (
            <SelectOption
              key={band}
              label={band}
              value={band}
              active={editAgeBand === band && !editShowAllAges}
              onSelect={handleEditSelectAgeBand}
              isFirst={index === 0}
            />
          ))}
          <SelectOption
            label={customOptionLabel}
            value={customOptionLabel}
            active={editShowAllAges}
            onSelect={handleEditSelectAgeBand}
          />
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showEditGenderPickerContent}
          layout={editGenderTriggerLayout}
          container={editContainerWindow}
          animationStyle={editGenderPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {genderOptions.map((option, index) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={editGender === option.value}
              onSelect={handleEditSelectGender}
              isFirst={index === 0}
            />
          ))}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showEditModalityPickerContent}
          layout={editModalityTriggerLayout}
          container={editContainerWindow}
          animationStyle={editModalityPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {modalityOptions.map((option, index) => (
            <SelectOption
              key={option.value}
              label={option.label}
              value={option.value}
              active={editModality === option.value}
              onSelect={handleEditSelectModality}
              isFirst={index === 0}
            />
          ))}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showEditGoalPickerContent}
          layout={editGoalTriggerLayout}
          container={editContainerWindow}
          animationStyle={editGoalPickerAnimStyle}
          zIndex={320}
          maxHeight={260}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {goalOptions.map((goal, index) => (
            <SelectOption
              key={goal}
              label={goal}
              value={goal}
              active={editGoal === goal && !editShowAllGoals}
              onSelect={handleEditSelectGoal}
              isFirst={index === 0}
            />
          ))}
          <SelectOption
            label={customOptionLabel}
            value={customOptionLabel}
            active={editShowAllGoals}
            onSelect={handleEditSelectGoal}
          />
        </AnchoredDropdown>
      </ModalSheet>
      <DatePickerModal
        visible={showNewCycleCalendar}
        value={newCycleStartDate || undefined}
        onChange={(value) => setNewCycleStartDate(value)}
        onClose={() => setShowNewCycleCalendar(false)}
        closeOnSelect={false}
      />
      <DatePickerModal
        visible={showEditCycleCalendar}
        value={editCycleStartDate || undefined}
        onChange={(value) => setEditCycleStartDate(value)}
        onClose={() => setShowEditCycleCalendar(false)}
        closeOnSelect={false}
      />
    </SafeAreaView>
  );
}




