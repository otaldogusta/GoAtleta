import { useCallback, useMemo, useState } from "react";
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

import { getClasses, saveClass } from "../../src/db/seed";
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
import { ModalSheet } from "../../src/ui/ModalSheet";
import { updateClass } from "../../src/db/seed";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { DatePickerModal } from "../../src/ui/DatePickerModal";

export default function ClassesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm: confirmDialog } = useConfirmDialog();
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
  const [newAgeBand, setNewAgeBand] = useState<ClassGroup["ageBand"]>("8-9");
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
  const [editAgeBand, setEditAgeBand] = useState<ClassGroup["ageBand"]>("8-9");
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
  const ageBandOptions = ["8-9", "10-12", "13-15", "16-18"];
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
  const mvLevelOptions = ["MV1", "MV2", "MV3"];
  const [showNewCycleCalendar, setShowNewCycleCalendar] = useState(false);
  const [showEditCycleCalendar, setShowEditCycleCalendar] = useState(false);

  const units = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((item) => {
      if (item.unit) set.add(item.unit);
    });
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [classes]);
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

  const filteredClasses = useMemo(() => {
    if (unitFilter === "Todas") return classes;
    return classes.filter((item) => item.unit === unitFilter);
  }, [classes, unitFilter]);

  const goalSuggestions = useMemo(() => {
    const key = newUnit.trim();
    const matches = classes.filter((item) => {
      if (key) return item.unit === key;
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
  const editGoalSuggestions = useMemo(() => {
    const key = editUnit.trim();
    const matches = classes.filter((item) => {
      if (key) return item.unit === key;
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
        if ((a.unit || "Sem unidade") !== (b.unit || "Sem unidade")) continue;
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
    filteredClasses.forEach((item) => {
      const key = item.unit || "Sem unidade";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    const sortedEntries = Object.entries(map).map(([unit, items]) => {
      const sortedItems = [...items].sort((a, b) => {
        const aDay = a.daysOfWeek.length ? Math.min(...a.daysOfWeek) : 7;
        const bDay = b.daysOfWeek.length ? Math.min(...b.daysOfWeek) : 7;
        if (aDay !== bDay) return aDay - bDay;
        const aStart = toMinutes(a.startTime || "") ?? 9999;
        const bStart = toMinutes(b.startTime || "") ?? 9999;
        if (aStart !== bStart) return aStart - bStart;
        return a.name.localeCompare(b.name);
      });
      return [unit, sortedItems] as [string, ClassGroup[]];
    });
    return sortedEntries.sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredClasses]);

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
        ageBand: newAgeBand,
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
      setNewAgeBand("8-9");
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

  const openEditModal = (item: ClassGroup) => {
    setEditingClass(item);
    setEditName(item.name ?? "");
    setEditUnit(item.unit ?? "");
    setEditAgeBand(item.ageBand ?? "8-9");
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
  };

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

  const isDirty =
    newName.trim() ||
    newUnit.trim() ||
    newStartTime.trim() !== "14:00" ||
    newDuration.trim() !== "60" ||
    newAgeBand.trim() !== "8-9" ||
    newMvLevel.trim() !== "MV1" ||
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
      <ScrollView
        contentContainerStyle={{
          gap: 16,
          paddingBottom: showNew ? 120 : 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Turmas
          </Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Lista completa</Text>
        </View>

        <View
          style={[
            getSectionCardStyle(colors, "neutral"),
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
          {showNewContent ? (
            <Animated.View style={[newFormAnimStyle, { gap: 12 }]}>
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
              <TextInput
                placeholder="Horario (HH:MM)"
                value={newStartTime}
                onChangeText={(value) =>
                  setNewStartTime(normalizeTimeInput(value))
                }
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
              <Text style={{ fontSize: 13, color: colors.muted }}>Duracao</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {durationOptions.map((item) => {
                  const active = newDuration === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setNewDuration(item);
                        setShowCustomDuration(false);
                      }}
                      style={getChipStyle(active)}
                    >
                      <Text style={getChipTextStyle(active)}>
                        {item + " min"}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    animateLayout();
                    setShowCustomDuration((prev) => !prev);
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
                    {showCustomDuration ? "−" : "+"}
                  </Text>
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
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Data inicio do ciclo
              </Text>
              <DateInput
                value={newCycleStartDate}
                onChange={setNewCycleStartDate}
                onOpenCalendar={() => setShowNewCycleCalendar(true)}
                placeholder="DD/MM/AAAA"
              />
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Duracao do ciclo (semanas)
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {cycleLengthOptions.map((value) => {
                  const active = newCycleLengthWeeks === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setNewCycleLengthWeeks(value)}
                      style={getChipStyle(active)}
                    >
                      <Text style={getChipTextStyle(active)}>
                        {value + " semanas"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 13, color: colors.muted }}>Nivel MV</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {mvLevelOptions.map((value) => {
                  const active = newMvLevel === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setNewMvLevel(value)}
                      style={getChipStyle(active)}
                    >
                      <Text style={getChipTextStyle(active)}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 13, color: colors.muted }}>Faixa etaria</Text>
              {showAllAges ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {ageBandOptions.map((band) => {
                    const active = newAgeBand === band;
                    return (
                      <Pressable
                        key={band}
                        onPress={() => setNewAgeBand(band)}
                        style={getChipStyle(active)}
                      >
                        <Text style={getChipTextStyle(active)}>
                          {band}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => {
                      animateLayout();
                      setShowAllAges((prev) => !prev);
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
                      {showAllAges ? "−" : "+"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {ageBandOptions.slice(0, 3).map((band) => {
                      const active = newAgeBand === band;
                      return (
                        <Pressable
                          key={band}
                          onPress={() => setNewAgeBand(band)}
                          style={getChipStyle(active)}
                        >
                          <Text style={getChipTextStyle(active)}>
                            {band}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => {
                        animateLayout();
                        setShowAllAges((prev) => !prev);
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
                        {showAllAges ? "−" : "+"}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
              )}
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
              <Text style={{ fontSize: 13, color: colors.muted }}>Dias da semana</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {dayNames.map((label, index) => {
                  const active = newDays.includes(index);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => toggleDay(index)}
                      style={getChipStyle(active)}
                    >
                      <Text style={getChipTextStyle(active)}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 13, color: colors.muted }}>Objetivo</Text>
              {showAllGoals ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {goals.map((item) => {
                    const active = newGoal === item;
                    return (
                      <Pressable
                        key={item}
                        onPress={() => setNewGoal(item)}
                        style={getChipStyle(active)}
                      >
                        <Text style={getChipTextStyle(active)}>
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => {
                      animateLayout();
                      setShowAllGoals((prev) => !prev);
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
                      {showAllGoals ? "−" : "+"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {goals.slice(0, 4).map((item) => {
                      const active = newGoal === item;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => setNewGoal(item)}
                          style={getChipStyle(active)}
                        >
                          <Text style={getChipTextStyle(active)}>
                            {item}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => {
                        animateLayout();
                        setShowAllGoals((prev) => !prev);
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
                        {showAllGoals ? "−" : "+"}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
              )}
              {goalSuggestions.length ? (
                <>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    Sugestoes da turma
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {goalSuggestions.map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => setNewGoal(item)}
                        style={getChipStyle(false)}
                      >
                        <Text style={getChipTextStyle(false)}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
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
              {formError ? (
                <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                  {formError}
                </Text>
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        <View style={getSectionCardStyle(colors, "info", { padding: 12 })}>
          <Text style={{ fontSize: 13, color: colors.muted }}>Unidades</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {units.map((unit) => {
              const active = unitFilter === unit;
              const palette =
                unit === "Todas"
                  ? { bg: colors.primaryBg, text: colors.primaryText }
                  : getUnitPalette(unit, colors);
              return (
                <Pressable
                  key={unit}
                  onPress={() => setUnitFilter(unit)}
                  style={getChipStyle(active, palette)}
                >
                  <Text style={getChipTextStyle(active, palette)}>{unit}</Text>
                </Pressable>
              );
            })}
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
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      suppressNextPress
                        ? setSuppressNextPress(false)
                        : router.push({
                            pathname: "/class/[id]",
                            params: { id: item.id },
                          })
                    }
                    onLongPress={() => {
                      setSuppressNextPress(true);
                      openEditModal(item);
                    }}
                    delayLongPress={250}
                    style={[
                      getSectionCardStyle(colors, "neutral", { radius: 16, padding: 12 }),
                      { borderLeftWidth: 3, borderLeftColor: palette.bg },
                    ]}
                  >
                    {conflictsById[item.id]?.length ? (
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: palette.bg,
                        }}
                      />
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                        {(() => {
                          const parsed = parseTime(item.startTime || "");
                          const duration = item.durationMinutes || 60;
                          if (!parsed) return item.name;
                          return `${formatTimeRange(parsed.hour, parsed.minute, duration)} - ${item.name}`;
                        })()}
                      </Text>
                    </View>
                    <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
                      {"Faixa: " + item.ageBand}
                    </Text>
                    <Pressable
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        router.push({
                          pathname: "/class/[id]/attendance",
                          params: { id: item.id, date: formatIsoDate(new Date()) },
                        });
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
                    {conflictsById[item.id]?.length ? (
                      <Text style={{ color: colors.dangerText, marginTop: 6 }}>
                        {"Conflitos: " +
                        conflictsById[item.id]
                          .map(
                            (conflict) =>
                              `${conflict.name} (${dayNames[conflict.day]})`
                          )
                          .join(", ")}
                    </Text>
                  ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
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
        cardStyle={[editModalCardStyle, { paddingBottom: 12 }]}
        position="center"
        backdropOpacity={0.6}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
              Editar turma
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {editingClass?.name ?? "Turma"}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setShowEditModal(false);
              setEditingClass(null);
            }}
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
          contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
          style={{ maxHeight: "94%" }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
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
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              placeholder="Unidade"
              value={editUnit}
              onChangeText={setEditUnit}
              placeholderTextColor={colors.placeholder}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
            <TextInput
              placeholder="Horario (HH:MM)"
              value={editStartTime}
              onChangeText={(value) => setEditStartTime(normalizeTimeInput(value))}
              keyboardType="numeric"
              placeholderTextColor={colors.placeholder}
              style={{
                width: 130,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
          <Text style={{ fontSize: 13, color: colors.muted }}>Duracao</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Data inicio do ciclo
          </Text>
          <DateInput
            value={editCycleStartDate}
            onChange={setEditCycleStartDate}
            onOpenCalendar={() => setShowEditCycleCalendar(true)}
            placeholder="DD/MM/AAAA"
          />
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Duracao do ciclo (semanas)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {cycleLengthOptions.map((value) => {
              const active = editCycleLengthWeeks === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setEditCycleLengthWeeks(value)}
                  style={getChipStyle(active)}
                >
                  <Text style={getChipTextStyle(active)}>
                    {value + " semanas"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 13, color: colors.muted }}>Nivel MV</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {mvLevelOptions.map((value) => {
              const active = editMvLevel === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setEditMvLevel(value)}
                  style={getChipStyle(active)}
                >
                  <Text style={getChipTextStyle(active)}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 13, color: colors.muted }}>Faixa etaria</Text>
          {editShowAllAges ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ageBandOptions.map((band) => {
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
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
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
            </ScrollView>
          )}
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
          <Text style={{ fontSize: 13, color: colors.muted }}>Dias da semana</Text>
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
          <Text style={{ fontSize: 13, color: colors.muted }}>Objetivo</Text>
          {editShowAllGoals ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {goals.map((item) => {
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
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
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
            </ScrollView>
          )}
          {editGoalSuggestions.length ? (
            <>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Sugestoes da turma
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
          {editFormError ? (
            <Text style={{ color: colors.dangerText, fontSize: 12 }}>
              {editFormError}
            </Text>
          ) : null}
          <View style={{ marginTop: 8 }}>
            <Button
              label={editSaving ? "Salvando..." : "Salvar alteracoes"}
              onPress={saveEditClass}
              disabled={editSaving || !editName.trim()}
            />
          </View>
        </ScrollView>
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



