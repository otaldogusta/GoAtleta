import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  Vibration,
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { deleteClassCascade, getClasses, saveClass } from "../../src/db/seed";
import type { ClassGroup } from "../../src/core/models";
import { animateLayout } from "../../src/ui/animate-layout";
import { Button } from "../../src/ui/Button";
import { DateInput } from "../../src/ui/DateInput";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { useAppTheme } from "../../src/ui/app-theme";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { normalizeUnitKey } from "../../src/core/unit-key";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { updateClass } from "../../src/db/seed";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { DatePickerModal } from "../../src/ui/DatePickerModal";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { logAction } from "../../src/observability/breadcrumbs";
import { measure } from "../../src/observability/perf";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";

export default function ClassesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { confirm: confirmUndo } = useConfirmUndo();
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const formatDays = (days: number[]) =>
    days.length ? days.map((day) => dayNames[day]).join(", ") : "-";
  const formatIsoDate = (value: Date) => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [showNew, setShowNew] = usePersistedState<boolean>(
    "classes_show_new_v1",
    false
  );
  const {
    animatedStyle: newFormAnimStyle,
    isVisible: showNewContent,
  } = useCollapsibleAnimation(showNew);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newModality, setNewModality] = useState<ClassGroup["modality"]>("voleibol");
  const [newAgeBand, setNewAgeBand] = useState<ClassGroup["ageBand"]>("08-09");
  const [newGender, setNewGender] = useState<ClassGroup["gender"]>("misto");
  const [newGoal, setNewGoal] = useState<ClassGroup["goal"]>("Fundamentos");
  const [newStartTime, setNewStartTime] = useState("14:00");
  const [newDuration, setNewDuration] = useState("60");
  const [newDays, setNewDays] = useState<number[]>([]);
  const [newMvLevel, setNewMvLevel] = useState("MV1");
  const [newCycleStartDate, setNewCycleStartDate] = useState("");
  const [newCycleLengthWeeks, setNewCycleLengthWeeks] = useState(12);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
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
  const [editSaving, setEditSaving] = useState(false);
  const [editFormError, setEditFormError] = useState("");
  const [editShowCustomDuration, setEditShowCustomDuration] = useState(false);
  const [editShowAllAges, setEditShowAllAges] = useState(false);
  const [editShowAllGoals, setEditShowAllGoals] = useState(false);
  const editModalCardStyle = useModalCardStyle({
    maxHeight: Platform.OS === "web" ? "85%" : "100%",
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

  const unitLabel = useCallback(
    (value?: string) => (value && value.trim() ? value.trim() : "Sem unidade"),
    []
  );
  const unitKey = useCallback(
    (value?: string) => normalizeUnitKey(unitLabel(value)),
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
    palette?: { bg: string; text: string }
  ) => ({
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: active ? palette?.bg ?? colors.primaryBg : colors.secondaryBg,
  });
  const getChipTextStyle = (
    active: boolean,
    palette?: { bg: string; text: string }
  ) => ({
    color: active ? palette?.text ?? colors.primaryText : colors.text,
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
  const editGoalSuggestions = useMemo(() => {
    const key = normalizeUnitKey(editUnit);
    const matches = classes.filter((item) => {
      if (key) return unitKey(item.unit) === key;
      if (editAgeBand) return item.ageBand === editAgeBand;
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
  }, [classes, editAgeBand, editUnit, goals]);

  const inferModality = useCallback((item?: ClassGroup | null) => {
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
      for (let j = i + 1; j < classes.length; j += 1) {
        const b = classes[j];
        if (unitKey(a.unit) !== unitKey(b.unit)) continue;
        const bStart = toMinutes(b.startTime || "");
        if (bStart === null) continue;
        const bEnd = bStart + (b.durationMinutes || 60);
        const sharedDays = a.daysOfWeek.filter((day) =>
          b.daysOfWeek.includes(day)
        );
        if (!sharedDays.length) continue;
        const overlap = aStart < bEnd && bStart < aEnd;
        if (!overlap) continue;
        sharedDays.forEach((day) => {
          if (!map[a.id]) map[a.id] = [];
          if (!map[b.id]) map[b.id] = [];
          map[a.id].push({ name: b.name, day });
          map[b.id].push({ name: a.name, day });
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
      const sortedItems = [...items].sort((a, b) => {
        const aDay = a.daysOfWeek.length ? Math.min(...a.daysOfWeek) : 7;
        const bDay = b.daysOfWeek.length ? Math.min(...b.daysOfWeek) : 7;
        if (aDay !== bDay) return aDay - bDay;
        const aStart = toMinutes(a.startTime || "") ?? 9999;
        const bStart = toMinutes(b.startTime || "") ?? 9999;
        if (aStart !== bStart) return aStart - bStart;
        return a.name.localeCompare(b.name);
      });
      return [labels.get(unitKeyValue) ?? "Sem unidade", sortedItems] as [string, ClassGroup[]];
    });
    return sortedEntries.sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredClasses, unitKey, unitLabel]);

  const loadClasses = useCallback(async (alive?: { current: boolean }) => {
    const data = await getClasses();
    if (!alive || alive.current) setClasses(data);
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
    const timeValue = newStartTime.trim();
    if (!isValidTime(timeValue)) {
      setFormError("Horario invalido. Use HH:MM.");
      Vibration.vibrate(40);
      return;
    }
    const durationValue = parseDuration(newDuration.trim());
    if (!durationValue) {
      setFormError("Duracao invalida. Use minutos entre 30 e 180.");
      Vibration.vibrate(40);
      return;
    }
    const cycleValue = parseCycleLength(newCycleLengthWeeks);
    if (!cycleValue) {
      setFormError("Ciclo invalido. Use entre 2 e 12 semanas.");
      Vibration.vibrate(40);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
        await saveClass({
          name: newName.trim(),
          unit: newUnit.trim() || "Sem unidade",
          modality: newModality ?? "voleibol",
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
        setNewName("");
        setNewUnit("");
        setNewModality("voleibol");
        setNewAgeBand("08-09");
      setNewGender("misto");
      setNewGoal("Fundamentos");
      setNewDays([]);
      setNewStartTime("14:00");
      setNewDuration("60");
      setNewMvLevel("MV1");
      setNewCycleStartDate("");
      setNewCycleLengthWeeks(12);
      setShowNew(false);
      await loadClasses();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = useCallback((item: ClassGroup) => {
    setEditingClass(item);
    setEditName(item.name ?? "");
    setEditUnit(item.unit ?? "");
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
      setEditFormError("Horario invalido. Use HH:MM.");
      Vibration.vibrate(40);
      return;
    }
    const durationValue = parseDuration(editDuration.trim());
    if (!durationValue) {
      setEditFormError("Duracao invalida. Use minutos entre 30 e 180.");
      Vibration.vibrate(40);
      return;
    }
    const cycleValue = parseCycleLength(editCycleLengthWeeks);
    if (!cycleValue) {
      setEditFormError("Ciclo invalido. Use entre 2 e 12 semanas.");
      Vibration.vibrate(40);
      return;
    }
    setEditFormError("");
    setEditSaving(true);
      try {
        await updateClass(editingClass.id, {
          name: editName.trim(),
          unit: editUnit.trim() || "Sem unidade",
          ageBand: editAgeBand,
          gender: editGender,
          modality: editModality ?? "fitness",
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
        undoMessage: "Turma excluida. Deseja desfazer?",
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
        isFirst?: boolean;
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
        isFirst?: boolean;
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

  const ClassCard = useMemo(
    () =>
      memo(function ClassCardItem({
        item,
        palette,
        conflicts,
        onOpen,
        onEdit,
        onAttendance,
      }: {
        item: ClassGroup;
        palette: { bg: string; text: string };
        conflicts?: { name: string; day: number }[];
        onOpen: (value: ClassGroup) => void;
        onEdit: (value: ClassGroup) => void;
        onAttendance: (value: ClassGroup) => void;
      }) {
        const parsed = parseTime(item.startTime || "");
        const duration = item.durationMinutes || 60;
        const timeLabel = parsed
          ? `${formatTimeRange(parsed.hour, parsed.minute, duration)} - ${item.name}`
          : item.name;
        const hasConflicts = Boolean(conflicts?.length);
        return (
          <Pressable
            onPress={() => onOpen(item)}
            onLongPress={() => onEdit(item)}
            delayLongPress={250}
            style={[
              getSectionCardStyle(colors, "neutral", { radius: 16, padding: 12 }),
              { borderLeftWidth: 3, borderLeftColor: palette.bg },
            ]}
          >
            {hasConflicts ? (
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
                  Conflito de horario
                </Text>
              </View>
            ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: palette.bg,
                  }}
                />
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                  {timeLabel}
                </Text>
                <ClassGenderBadge gender={item.gender} />
              </View>
            <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
              {"Faixa: " + item.ageBand}
            </Text>
            <Pressable
              onPress={(event) => {
                event?.stopPropagation?.();
                onAttendance(item);
              }}
              style={{
                marginTop: 10,
                paddingVertical: 8,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: palette.bg,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: "700", fontSize: 12 }}>
                Fazer chamada
              </Text>
            </Pressable>
            {hasConflicts ? (
              <Text style={{ color: colors.dangerText, marginTop: 6 }}>
                {"Conflitos: " +
                  conflicts
                    ?.map(
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

  const confirmCloseForm = () => {
    if (!isDirty) {
      setShowNew(false);
      return;
    }
    confirmDialog({
      title: "Sair sem salvar?",
      message: "Voce tem alteracoes nao salvas.",
      confirmLabel: "Descartar",
      cancelLabel: "Continuar",
      onConfirm: () => setShowNew(false),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View ref={containerRef} style={{ flex: 1, position: "relative", overflow: "visible" }}>
        <ScrollView
          contentContainerStyle={{
            gap: 16,
            paddingBottom: showNew ? 120 : 24,
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

        <View style={{ gap: 12 }}>
          <View
            style={[
              getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16 }),
              { borderLeftWidth: 3, borderLeftColor: "#ffffff" },
            ]}
          >
            <Pressable
              onPress={() => (showNew ? confirmCloseForm() : setShowNew(true))}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 14,
                backgroundColor: showNew ? colors.secondaryBg : colors.primaryBg,
                borderWidth: showNew ? 1 : 0,
                borderColor: colors.border,
              }}
            >
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    color: showNew ? colors.text : colors.primaryText,
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  {showNew ? "Fechar cadastro" : "+ Nova turma"}
                </Text>
                <Text
                  style={{
                    color: showNew ? colors.muted : colors.primaryText,
                    fontSize: 12,
                  }}
                >
                  {showNew ? "Voltar para a lista" : "Cadastre uma nova turma agora"}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {showNewContent ? (
          <View style={getSectionCardStyle(colors, "neutral")}>
            <Animated.View style={[newFormAnimStyle, { gap: 12 }]}>
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  overflow: "hidden",
                }}
              >
                <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Nome da turma</Text>
                    <TextInput
                      placeholder="Nome da turma"
                      value={newName}
                      onChangeText={setNewName}
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
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Unidade</Text>
                    <TextInput
                      placeholder="Unidade (ex: Rede Esperanca)"
                      value={newUnit}
                      onChangeText={setNewUnit}
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
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Horario</Text>
                    <TextInput
                      placeholder="Horario (HH:MM)"
                      value={newStartTime}
                      onChangeText={(value) => setNewStartTime(normalizeTimeInput(value))}
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
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Duracao</Text>
                    <View ref={durationTriggerRef}>
                      <Pressable
                        onPress={() => toggleNewPicker("duration")}
                        style={selectFieldStyle}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
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
                    {showCustomDurationContent ? (
                      <Animated.View style={customDurationAnimStyle}>
                        <TextInput
                          placeholder="Duracao (min)"
                          value={newDuration}
                          onChangeText={setNewDuration}
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
                      </Animated.View>
                    ) : null}
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Data inicio do ciclo</Text>
                    <DateInput
                      value={newCycleStartDate}
                      onChange={setNewCycleStartDate}
                      onOpenCalendar={() => setShowNewCycleCalendar(true)}
                      placeholder="DD/MM/AAAA"
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      Duracao do ciclo (semanas)
                    </Text>
                    <View ref={cycleLengthTriggerRef}>
                      <Pressable
                        onPress={() => toggleNewPicker("cycle")}
                        style={selectFieldStyle}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                          {newCycleLengthWeeks + " semanas"}
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
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Nivel</Text>
                    <View ref={mvLevelTriggerRef}>
                      <Pressable
                        onPress={() => toggleNewPicker("level")}
                        style={selectFieldStyle}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                          {getOptionLabel(newMvLevel, mvLevelOptions)}
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
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Faixa etaria</Text>
                    <View ref={ageBandTriggerRef}>
                      <Pressable
                        onPress={() => toggleNewPicker("age")}
                        style={selectFieldStyle}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                          {newAgeBand || customOptionLabel}
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
                    {showAllAgesContent ? (
                      <Animated.View style={allAgesAnimStyle}>
                        <TextInput
                          placeholder="Faixa etaria (ex: 14-16)"
                          value={newAgeBand}
                          onChangeText={setNewAgeBand}
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
                      </Animated.View>
                    ) : null}
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Genero</Text>
                    <View ref={genderTriggerRef}>
                      <Pressable
                        onPress={() => toggleNewPicker("gender")}
                        style={selectFieldStyle}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                          {getOptionLabel(newGender, genderOptions)}
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
                  <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Modalidade</Text>
                    <View ref={modalityTriggerRef}>
                      <Pressable
                        onPress={() => toggleNewPicker("modality")}
                        style={selectFieldStyle}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                          {getOptionLabel(newModality, modalityOptions)}
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
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ padding: 10, gap: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Dias da semana</Text>
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
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ padding: 10, gap: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Objetivo</Text>
                  <View ref={goalTriggerRef}>
                    <Pressable
                      onPress={() => toggleNewPicker("goal")}
                      style={selectFieldStyle}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {newGoal || customOptionLabel}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.muted}
                        style={{
                          transform: [{ rotate: showGoalPicker ? "180deg" : "0deg" }],
                        }}
                      />
                    </Pressable>
                  </View>
                  {showAllGoalsContent ? (
                    <Animated.View style={allGoalsAnimStyle}>
                      <TextInput
                        placeholder="Objetivo (ex: Forca, Potencia)"
                        value={newGoal}
                        onChangeText={setNewGoal}
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
                    </Animated.View>
                  ) : null}
                </View>
              </View>
              {formError ? (
                <Text style={{ color: colors.dangerText, fontSize: 12 }}>{formError}</Text>
              ) : null}
            </Animated.View>
          </View>
        ) : null}

        <View style={getSectionCardStyle(colors, "info", { padding: 0, radius: 16 })}>
          <View style={{ padding: 10 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Unidades</Text>
            <View ref={unitFilterTriggerRef} style={{ position: "relative" }}>
              <Pressable
                onPress={toggleUnitFilter}
                style={{
                  marginTop: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                  {unitFilter}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={colors.muted}
                  style={{ transform: [{ rotate: showUnitFilterPicker ? "180deg" : "0deg" }] }}
                />
              </Pressable>
            </View>
          </View>
        </View>
        {grouped.map(([unit, items]) => {
          const palette = getUnitPalette(unit, colors);
          return (
            <View key={unit} style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: palette.bg,
                  }}
                />
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    {unit}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {"Turmas: " + items.length}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 12 }}>
                {items.map((item) => (
                  <ClassCard
                    key={item.id}
                    item={item}
                    palette={palette}
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
      {showNew ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            borderRadius: 16,
          }}
        >
          <Button
            label={saving ? "Salvando..." : "Salvar turma"}
            onPress={saveNewClass}
            disabled={saving || !newName.trim()}
          />
        </View>
      ) : null}
      <ModalSheet
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingClass(null);
        }}
        cardStyle={editModalCardStyle}
        position="center"
      >
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Editar turma
          </Text>

          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              overflow: "hidden",
            }}
          >
            <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Nome da turma</Text>
                <TextInput
                  placeholder="Nome da turma"
                  value={editName}
                  onChangeText={setEditName}
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
              <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Unidade</Text>
                <TextInput
                  placeholder="Unidade"
                  value={editUnit}
                  onChangeText={setEditUnit}
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
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Horario</Text>
                <TextInput
                  placeholder="Horario (HH:MM)"
                  value={editStartTime}
                  onChangeText={(value) => setEditStartTime(normalizeTimeInput(value))}
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
              <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Duracao</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {durationOptions.map((item) => {
                    const active = editDuration === item;
                    return (
                      <Pressable
                        key={item}
                        onPress={() => setEditDuration(item)}
                        style={getChipStyle(active)}
                      >
                        <Text style={getChipTextStyle(active)}>{item + " min"}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => {
                      animateLayout();
                      setEditShowCustomDuration((prev) => !prev);
                    }}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {editShowCustomDuration ? "−" : "+"}
                    </Text>
                  </Pressable>
                </View>
                {editShowCustomDuration ? (
                  <TextInput
                    placeholder="Duracao (min)"
                    value={editDuration}
                    onChangeText={setEditDuration}
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
                ) : null}
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Data inicio do ciclo</Text>
                <DateInput
                  value={editCycleStartDate}
                  onChange={setEditCycleStartDate}
                  onOpenCalendar={() => setShowEditCycleCalendar(true)}
                  placeholder="DD/MM/AAAA"
                />
              </View>
              <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Duracao do ciclo</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {cycleLengthOptions.map((value) => {
                    const active = editCycleLengthWeeks === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setEditCycleLengthWeeks(value)}
                        style={getChipStyle(active)}
                      >
                        <Text style={getChipTextStyle(active)}>
                          {value + "sem"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Nivel</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {mvLevelOptions.map((option) => {
                    const active = editMvLevel === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setEditMvLevel(option.value)}
                        style={getChipStyle(active)}
                      >
                        <Text style={getChipTextStyle(active)}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Faixa etaria</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {ageBandOptions.slice(0, 3).map((band) => {
                    const active = editAgeBand === band;
                    return (
                      <Pressable
                        key={band}
                        onPress={() => setEditAgeBand(band)}
                        style={getChipStyle(active)}
                      >
                        <Text style={getChipTextStyle(active)}>{band}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => {
                      animateLayout();
                      setEditShowAllAges((prev) => !prev);
                    }}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {editShowAllAges ? "−" : "+"}
                    </Text>
                  </Pressable>
                </View>
                {editShowAllAges ? (
                  <TextInput
                    placeholder="Faixa etaria (ex: 14-16)"
                    value={editAgeBand}
                    onChangeText={setEditAgeBand}
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
                ) : null}
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ padding: 10, gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>Genero</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {genderOptions.map((option) => {
                  const active = editGender === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setEditGender(option.value)}
                      style={getChipStyle(active)}
                    >
                      <Text style={getChipTextStyle(active)}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ padding: 10, gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>Dias da semana</Text>
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
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ padding: 10, gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>Modalidade</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {modalityOptions.map((option) => {
                  const active = editModality === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setEditModality(option.value)}
                      style={getChipStyle(active)}
                    >
                      <Text style={getChipTextStyle(active)}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ padding: 10, gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>Objetivo</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {goals.slice(0, 4).map((item) => {
                  const active = editGoal === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setEditGoal(item)}
                      style={getChipStyle(active)}
                    >
                      <Text style={getChipTextStyle(active)}>{item}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    animateLayout();
                    setEditShowAllGoals((prev) => !prev);
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    {editShowAllGoals ? "−" : "+"}
                  </Text>
                </Pressable>
              </View>
              {editGoalSuggestions.length ? (
                <>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                    Sugestoes da turma
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {editGoalSuggestions.map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => setEditGoal(item)}
                        style={getChipStyle(false)}
                      >
                        <Text style={getChipTextStyle(false)}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
              {editShowAllGoals ? (
                <TextInput
                  placeholder="Objetivo (ex: Forca, Potencia)"
                  value={editGoal}
                  onChangeText={setEditGoal}
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
              ) : null}
            </View>
          </View>
          {editFormError ? (
            <Text style={{ color: colors.dangerText, fontSize: 12 }}>
              {editFormError}
            </Text>
          ) : null}
          
          <Button
            label={editSaving ? "Salvando..." : "Salvar alteracoes"}
            onPress={saveEditClass}
            disabled={editSaving || !editName.trim()}
          />
          
          <Button
            label="Excluir turma"
            variant="danger"
            onPress={handleDeleteClass}
            disabled={editSaving}
          />
          
          <Pressable
            onPress={() => {
              setShowEditModal(false);
              setEditingClass(null);
            }}
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
        </View>
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




