import {
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import { Animated,
  ScrollView,
  Text,
  View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  getClasses,
  getSessionLogsByRange,
  getTrainingPlans,
  updateTrainingPlan,
} from "../src/db/seed";
import type { ClassGroup, SessionLog, TrainingPlan } from "../src/core/models";
import { useAppTheme } from "../src/ui/app-theme";
import { usePersistedState } from "../src/ui/use-persisted-state";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";
import { ModalSheet } from "../src/ui/ModalSheet";
import { getUnitPalette, toRgba } from "../src/ui/unit-colors";
import { useSaveToast } from "../src/ui/save-toast";

const CALENDAR_EXPANDED_DAYS_KEY = "calendar_weekly_expanded_days_v1";
const CALENDAR_EXPANDED_UNITS_KEY = "calendar_weekly_expanded_units_v1";

const pad2 = (value: number) => String(value).padStart(2, "0");

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const formatDate = (date: Date) =>
  pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1);

const formatIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseTime = (value: string) => {
  const parts = value.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const formatTimeRange = (
  hour: number,
  minute: number,
  durationMinutes: number
) => {
  const start = pad2(hour) + ":" + pad2(minute);
  const endTotal = hour * 60 + minute + durationMinutes;
  const endHour = Math.floor(endTotal / 60) % 24;
  const endMinute = endTotal % 60;
  const end = pad2(endHour) + ":" + pad2(endMinute);
  return start + " - " + end;
};

export default function CalendarScreen() {
  const router = useRouter();
  const { colors, mode } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const params = useLocalSearchParams();
  const targetClassId =
    typeof params.targetClassId === "string" ? params.targetClassId : "";
  const targetDateParam =
    typeof params.targetDate === "string" ? params.targetDate : "";
  const targetDate =
    targetDateParam && !Number.isNaN(new Date(targetDateParam).getTime())
      ? targetDateParam
      : "";
  const openApply =
    typeof params.openApply === "string" ? params.openApply === "1" : false;
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [unitFilter, setUnitFilter] = useState("Todas");
  const [expandedPastDays, setExpandedPastDays, expandedPastDaysLoaded] =
    usePersistedState<Record<string, boolean>>(CALENDAR_EXPANDED_DAYS_KEY, {});
  const [expandedUnitGroups, setExpandedUnitGroups] = usePersistedState<
    Record<string, boolean>
  >(CALENDAR_EXPANDED_UNITS_KEY, {});
  const [, setPendingPlanCreate] = usePersistedState<{
    classId: string;
    date: string;
  } | null>("training_pending_plan_create_v1", null);
  const expandAnimRef = useRef<Record<string, Animated.Value>>({});
  const [showApplyPicker, setShowApplyPicker] = useState(false);
  const [applyPickerClassId, setApplyPickerClassId] = useState("");
  const [applyPickerDate, setApplyPickerDate] = useState("");
  const applyPickerCardStyle = useModalCardStyle({
    gap: 12,
    maxHeight: "100%",
  });
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const weekLabels = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
  const weekStart = useMemo(
    () => startOfWeek(targetDate ? new Date(targetDate) : new Date()),
    [targetDate]
  );
  const classById = useMemo(() => {
    const map: Record<string, ClassGroup> = {};
    classes.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [classes]);
  const formatAppliedLabel = (plan?: TrainingPlan | null) => {
    if (!plan?.applyDate && !(plan?.applyDays?.length ?? 0)) return "";
    return (
      "Aplicado: " +
      [
        plan.applyDays?.length
          ? plan.applyDays
              .map((day) => weekLabels[day] ?? String(day))
              .join("/")
          : null,
        plan.applyDate ? formatDate(new Date(plan.applyDate)) : null,
      ]
        .filter(Boolean)
        .join(" | ")
    );
  };

  useEffect(() => {
    if (!expandedPastDaysLoaded) return;
    Object.entries(expandedPastDays).forEach(([key, expanded]) => {
      const anim = getExpandAnim(key, expanded ? 1 : 0);
      anim.setValue(expanded ? 1 : 0);
    });
  }, [expandedPastDays, expandedPastDaysLoaded]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [classList, planList] = await Promise.all([
        getClasses(),
        getTrainingPlans(),
      ]);
      if (!alive) return;
      setClasses(classList);
      setPlans(planList);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const applyTargetHandled = useRef(false);
  useEffect(() => {
    if (!openApply || applyTargetHandled.current) return;
    if (!targetClassId || !targetDate) return;
    if (!classes.length) return;
    const targetClass = classes.find((item) => item.id === targetClassId);
    if (!targetClass) return;
    const dayKey = targetDate;
    const unitName = unitLabel(targetClass.unit);
    setUnitFilter(unitName);
    setExpandedPastDays((prev) => ({
      ...prev,
      [dayKey]: true,
    }));
    setExpandedUnitGroups((prev) => ({
      ...prev,
      [`${dayKey}-${unitName}`]: true,
    }));
    getExpandAnim(dayKey, 1).setValue(1);
    setApplyPickerClassId(targetClassId);
    setApplyPickerDate(targetDate);
    setShowApplyPicker(true);
    applyTargetHandled.current = true;
  }, [openApply, targetClassId, targetDate, classes]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const start = new Date(weekStart);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 7);
      const logs = await getSessionLogsByRange(
        start.toISOString(),
        end.toISOString()
      );
      if (!alive) return;
      setSessionLogs(logs);
    })();
    return () => {
      alive = false;
    };
  }, [weekStart]);

  const plansByClassId = useMemo(() => {
    const map: Record<string, TrainingPlan[]> = {};
    for (const plan of plans) {
      if (!map[plan.classId]) map[plan.classId] = [];
      map[plan.classId].push(plan);
    }
    return map;
  }, [plans]);

  const sessionLogMap = useMemo(() => {
    const map = new Map<string, SessionLog>();
    sessionLogs.forEach((log) => {
      const date = log.createdAt.slice(0, 10);
      map.set(`${log.classId}-${date}`, log);
    });
    return map;
  }, [sessionLogs]);

  const unitLabel = (value?: string) =>
    value && value.trim() ? value.trim() : "Sem unidade";


  const sortByTime = (a: ClassGroup, b: ClassGroup) => {
    const aParsed = parseTime(a.startTime || "");
    const bParsed = parseTime(b.startTime || "");
    const aMinutes = aParsed ? aParsed.hour * 60 + aParsed.minute : 9999;
    const bMinutes = bParsed ? bParsed.hour * 60 + bParsed.minute : 9999;
    if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    return a.name.localeCompare(b.name);
  };

  const getAppliedPlan = (classId: string, date: Date) => {
    const list = plansByClassId[classId] ?? [];
    if (!list.length) return null;
    const iso = formatIsoDate(date);
    const weekDay = date.getDay() === 0 ? 7 : date.getDay();
    const byDate = list.find((plan) => plan.applyDate === iso);
    if (byDate) return byDate;
    const byWeekday = list.find((plan) =>
      (plan.applyDays ?? []).includes(weekDay)
    );
    return byWeekday ?? null;
  };

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const getExpandAnim = (key: string, initial: number) => {
    const current = expandAnimRef.current[key];
    if (current) return current;
    const value = new Animated.Value(initial);
    expandAnimRef.current[key] = value;
    return value;
  };
  const getBucketLabel = (hour: number) => {
    if (hour >= 5 && hour <= 11) return "Manha";
    if (hour >= 12 && hour <= 17) return "Tarde";
    if (hour >= 18 && hour <= 23) return "Noite";
    return "Madrugada";
  };
  const scheduleDays = useMemo(() => {
    const unique = new Set<number>();
    const filteredClasses =
      unitFilter === "Todas"
        ? classes
        : classes.filter((cls) => (cls.unit || "Sem unidade") === unitFilter);
    filteredClasses.forEach((cls) => {
      cls.daysOfWeek.forEach((day) => unique.add(day));
    });
    const days = Array.from(unique).sort((a, b) => a - b);
    if (!days.length) return [{ day: 2 }, { day: 4 }];
    return days.map((day) => ({ day }));
  }, [classes, unitFilter]);

  const sortedPlans = useMemo(() => {
    return plans
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [plans]);
  const selectedApplyClass = applyPickerClassId
    ? classById[applyPickerClassId]
    : null;
  const applyFilterUnit = selectedApplyClass
    ? unitLabel(selectedApplyClass.unit)
    : "";
  const applyFilterAge = selectedApplyClass?.ageBand ?? "";
  const filteredApplyPlans = useMemo(() => {
    if (!selectedApplyClass) return sortedPlans;
    return sortedPlans.filter((plan) => {
      const planClass = classById[plan.classId];
      if (!planClass) return false;
      return (
        unitLabel(planClass.unit) === applyFilterUnit &&
        planClass.ageBand === applyFilterAge
      );
    });
  }, [sortedPlans, classById, selectedApplyClass, applyFilterUnit, applyFilterAge]);

  const closeApplyPicker = () => {
    setShowApplyPicker(false);
    setApplyPickerClassId("");
    setApplyPickerDate("");
  };

  const applyPlanToDay = async (plan: TrainingPlan) => {
    if (!applyPickerClassId || !applyPickerDate) return;
    const targetClassId = applyPickerClassId;
    const targetDate = applyPickerDate;
    const isSameApply =
      plan.classId === targetClassId &&
      plan.applyDate === targetDate &&
      (plan.applyDays ?? []).length === 0;
    if (isSameApply) {
      closeApplyPicker();
      showSaveToast({
        message: "Planejamento ja adicionado.",
        actionLabel: "Ver aula do dia",
        variant: "warning",
        onAction: () => {
          router.push({
            pathname: "/class/[id]/session",
            params: { id: targetClassId, date: targetDate },
          });
        },
      });
      return;
    }
    const updated: TrainingPlan = {
      ...plan,
      classId: targetClassId,
      applyDate: targetDate,
      applyDays: [],
    };
    await updateTrainingPlan(updated);
    const nextPlans = await getTrainingPlans();
    setPlans(nextPlans);
    closeApplyPicker();
    showSaveToast({
      message: "Treino aplicado com sucesso.",
      actionLabel: "Ver aula do dia",
      variant: "success",
      onAction: () => {
        router.push({
          pathname: "/class/[id]/session",
          params: { id: targetClassId, date: targetDate },
        });
      },
    });
  };

  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    classes.forEach((cls) => {
      units.add(cls.unit || "Sem unidade");
    });
    return ["Todas", ...Array.from(units).sort((a, b) => a.localeCompare(b))];
  }, [classes]);
  const baseHour = 14;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
          Calendario semanal
        </Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          Dias por unidade e turmas
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingVertical: 12, gap: 16 }}
        pointerEvents={showApplyPicker ? "none" : "auto"}
      >
        <View
          style={{
            padding: 12,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            Unidade
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {unitOptions.map((unit) => {
                const active = unitFilter === unit;
                const palette = unit === "Todas" ? null : getUnitPalette(unit, colors);
                const chipBg = active
                  ? palette?.bg ?? colors.primaryBg
                  : colors.secondaryBg;
                const chipText = active
                  ? palette?.text ?? colors.primaryText
                  : colors.text;
                return (
                  <Pressable
                    key={unit}
                    onPress={() => setUnitFilter(unit)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: chipBg,
                    }}
                  >
                    <Text style={{ color: chipText }}>
                      {unit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
        {scheduleDays.map((dayInfo) => {
          const date = new Date(weekStart);
          const day = dayInfo.day;
          const offset = day === 0 ? 6 : day - 1;
          date.setDate(weekStart.getDate() + offset);
          const dayKey = formatIsoDate(date);
          const isPast = date.getTime() < todayStart.getTime();
          const isExpanded = expandedPastDays[dayKey] ?? !isPast;
          const expandAnim = getExpandAnim(dayKey, isExpanded ? 1 : 0);
          const filteredClasses =
            unitFilter === "Todas"
              ? classes
              : classes.filter((cls) => (cls.unit || "Sem unidade") === unitFilter);
          const filtered = filteredClasses.filter((cls) =>
            cls.daysOfWeek.includes(day)
          );
          const groupedByUnit = filtered.reduce<Record<string, ClassGroup[]>>(
            (acc, cls) => {
              const key = unitLabel(cls.unit);
              if (!acc[key]) acc[key] = [];
              acc[key].push(cls);
              return acc;
            },
            {}
          );
          const unitGroups = Object.entries(groupedByUnit)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([unit, items]) => [unit, items.sort(sortByTime)] as const);
          const renderUnitGroups = (grouped: readonly [string, ClassGroup[]][]) => {
            if (!grouped.length) {
              return <Text style={{ color: colors.muted }}>Sem turmas nesse dia.</Text>;
            }

            return grouped.map(([unit, items]) => {
              const unitKey = `${dayKey}-${unit}`;
              const isUnitExpanded = expandedUnitGroups[unitKey] ?? true;
              const palette = getUnitPalette(unit, colors);
              const unitBorder = palette.bg;
              const unitBg =
                mode === "dark"
                  ? toRgba(palette.bg, 0.16)
                  : toRgba(palette.bg, 0.1);
              const buckets = items.reduce<Record<string, ClassGroup[]>>(
                (acc, cls, index) => {
                  const parsed = parseTime(cls.startTime || "");
                  const startHour = parsed?.hour ?? baseHour + index;
                  const label = getBucketLabel(startHour);
                  if (!acc[label]) acc[label] = [];
                  acc[label].push(cls);
                  return acc;
                },
                {}
              );
              const bucketOrder = ["Manha", "Tarde", "Noite", "Madrugada"];
              const orderedBuckets = bucketOrder
                .map((label) => [label, buckets[label]] as const)
                .filter((entry) => entry[1]?.length);
              const countLabel = items.length === 1 ? "1 turma" : `${items.length} turmas`;

              return (
                <View
                  key={unit}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: unitBorder,
                    padding: 10,
                    gap: 10,
                    backgroundColor: unitBg,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      setExpandedUnitGroups((prev) => ({
                        ...prev,
                        [unitKey]: !isUnitExpanded,
                      }))
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      borderRadius: 10,
                      backgroundColor: colors.inputBg,
                    }}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {unit}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{countLabel}</Text>
                    </View>
                    <MaterialCommunityIcons
                      name={isUnitExpanded ? "chevron-down" : "chevron-right"}
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                  {isUnitExpanded ? (
                    <View style={{ gap: 12 }}>
                      {orderedBuckets.map(([label, bucketItems]) => (
                        <View key={label} style={{ gap: 8 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View
                              style={{
                                paddingVertical: 2,
                                paddingHorizontal: 8,
                                borderRadius: 999,
                                backgroundColor: colors.inputBg,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.muted,
                                  fontSize: 11,
                                  fontWeight: "700",
                                }}
                              >
                                {label}
                              </Text>
                            </View>
                            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                          </View>
                          {bucketItems.map((cls, index) => {
                            const parsed = parseTime(cls.startTime || "");
                            const startHour = parsed?.hour ?? baseHour + index;
                            const startMinute = parsed?.minute ?? 0;
                            const durationMinutes = cls.durationMinutes || 60;
                            const time = formatTimeRange(
                              startHour,
                              startMinute,
                              durationMinutes
                            );
                            const classUnit = unitLabel(cls.unit);
                            const classPalette = getUnitPalette(classUnit, colors);
                            const appliedPlan = getAppliedPlan(cls.id, date);
                            const subtitle = appliedPlan ? "Treino: " + appliedPlan.title : "";
                            const isSpecificDate = Boolean(appliedPlan?.applyDate);
                            const isWeekly =
                              !isSpecificDate &&
                              (appliedPlan?.applyDays?.length ?? 0) > 0;
                            const hasApplied =
                              Boolean(appliedPlan?.applyDate) ||
                              (appliedPlan?.applyDays?.length ?? 0) > 0;
                            const appliedLabel = hasApplied
                              ? formatAppliedLabel(appliedPlan)
                              : "";
                            const log = sessionLogMap.get(`${cls.id}-${dayKey}`);
                            const hasLog = Boolean(log);
                            return (
                              <Pressable
                                key={`${cls.id}-${day}`}
                                onPress={() =>
                                  router.push({
                                    pathname: "/class/[id]/session",
                                    params: { id: cls.id, date: formatIsoDate(date) },
                                  })
                                }
                                style={{
                                  padding: 14,
                                  borderRadius: 18,
                                  backgroundColor: isPast
                                    ? colors.secondaryBg
                                    : hasApplied
                                    ? colors.inputBg
                                    : colors.card,
                                  borderWidth: 1,
                                  borderColor: hasApplied
                                    ? isPast
                                      ? colors.border
                                      : colors.primaryBg
                                    : colors.border,
                                  borderLeftWidth: 3,
                                  borderLeftColor: classPalette.bg,
                                  shadowColor: "#000",
                                  shadowOpacity: 0.05,
                                  shadowRadius: 10,
                                  shadowOffset: { width: 0, height: 6 },
                                  elevation: 2,
                                }}
                              >
                                {isWeekly ? (
                                  <View
                                    style={{
                                      alignSelf: "flex-start",
                                      paddingVertical: 2,
                                      paddingHorizontal: 8,
                                      borderRadius: 999,
                                      backgroundColor: colors.infoBg,
                                      marginBottom: 6,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: colors.infoText,
                                        fontWeight: "700",
                                        fontSize: 11,
                                      }}
                                    >
                                      Semanal
                                    </Text>
                                  </View>
                                ) : null}
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                  <View
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: 999,
                                      backgroundColor: classPalette.bg,
                                    }}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 16,
                                      fontWeight: "700",
                                      color: colors.text,
                                    }}
                                  >
                                    {time + " - " + cls.name}
                                  </Text>
                                </View>
                                {subtitle ? (
                                  <Text style={{ color: colors.muted, marginTop: 6 }}>
                                    {subtitle}
                                  </Text>
                                ) : null}
                                {appliedLabel ? (
                                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                                    {appliedLabel}
                                  </Text>
                                ) : null}
                                {hasLog ? (
                                  <View
                                    style={{
                                      marginTop: 8,
                                      padding: 8,
                                      borderRadius: 12,
                                      backgroundColor: colors.inputBg,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: colors.text,
                                        fontWeight: "700",
                                        fontSize: 12,
                                      }}
                                    >
                                      Relatorio da aula
                                    </Text>
                                    <Text
                                      style={{
                                        color: colors.muted,
                                        fontSize: 12,
                                        marginTop: 2,
                                      }}
                                    >
                                      {"RPE " +
                                        log?.rpe +
                                        " ƒ?½ Tec: " +
                                        log?.technique +
                                        " ƒ?½ Presenca: " +
                                        log?.attendance +
                                        "%"}
                                    </Text>
                                  </View>
                                ) : null}
                                {!hasApplied ? (
                                  <View style={{ marginTop: 10, gap: 8 }}>
                                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                                      Sem plano aplicado
                                    </Text>
                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                      <Pressable
                                        onPress={(event) => {
                                          event?.stopPropagation?.();
                                          setApplyPickerClassId(cls.id);
                                          setApplyPickerDate(formatIsoDate(date));
                                          setShowApplyPicker(true);
                                        }}
                                        style={({ pressed }) => [
                                          {
                                            flex: 1,
                                            paddingVertical: 8,
                                            borderRadius: 10,
                                            alignItems: "center",
                                            backgroundColor: colors.primaryBg,
                                          },
                                          pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
                                        ]}
                                      >
                                        <Text
                                          style={{
                                            color: colors.primaryText,
                                            fontWeight: "700",
                                            fontSize: 12,
                                          }}
                                        >
                                          Aplicar treino
                                        </Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={(event) => {
                                          event?.stopPropagation?.();
                                          setPendingPlanCreate({
                                            classId: cls.id,
                                            date: formatIsoDate(date),
                                          });
                                          router.push({
                                            pathname: "/training",
                                            params: {
                                              targetClassId: cls.id,
                                              targetDate: formatIsoDate(date),
                                              openForm: "1",
                                            },
                                          });
                                        }}
                                        style={({ pressed }) => [
                                          {
                                            flex: 1,
                                            paddingVertical: 8,
                                            borderRadius: 10,
                                            alignItems: "center",
                                            backgroundColor: colors.secondaryBg,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                          },
                                          pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
                                        ]}
                                      >
                                        <Text
                                          style={{
                                            color: colors.text,
                                            fontWeight: "700",
                                            fontSize: 12,
                                          }}
                                        >
                                          Criar plano
                                        </Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                ) : null}
                                {hasLog ? (
                                  <Pressable
                                    onPress={(event) => {
                                      event?.stopPropagation?.();
                                      router.push({
                                        pathname: "/class/[id]/log",
                                        params: { id: cls.id, date: formatIsoDate(date) },
                                      });
                                    }}
                                    style={{
                                      marginTop: 10,
                                      paddingVertical: 8,
                                      borderRadius: 10,
                                      alignItems: "center",
                                      backgroundColor: colors.secondaryBg,
                                      opacity: isPast ? 0.7 : 1,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: colors.secondaryText,
                                        fontWeight: "700",
                                      }}
                                    >
                                      Relatorio da aula
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            });
          };
          const classCount = filtered.length;
          const countLabel = classCount === 1 ? "1 turma" : `${classCount} turmas`;
          return (
            <View
              key={String(day)}
              style={{
                padding: 12,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => {
                  Animated.timing(expandAnim, {
                    toValue: isExpanded ? 0 : 1,
                    duration: 180,
                    useNativeDriver: false,
                  }).start();
                  setExpandedPastDays((prev) => ({
                    ...prev,
                    [dayKey]: !isExpanded,
                  }));
                }}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                }}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
                    {dayLabels[day]}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        paddingVertical: 2,
                        paddingHorizontal: 8,
                        borderRadius: 999,
                        backgroundColor: colors.secondaryBg,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.secondaryText,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {formatDate(date)}
                      </Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{countLabel}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons
                  name={isExpanded ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  opacity: 0.6,
                }}
              />
              <Animated.View
                style={{
                  gap: 10,
                  opacity: expandAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                  maxHeight: expandAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1200],
                  }),
                  overflow: "hidden",
                }}
              >
                <View style={{ gap: 12 }}>{renderUnitGroups(unitGroups)}</View>
              </Animated.View>
            </View>
          );
        })}
      </ScrollView>
      <ModalSheet
        visible={showApplyPicker}
        onClose={closeApplyPicker}
        cardStyle={[applyPickerCardStyle, { paddingBottom: 12 }]}
        position="center"
      >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
                      Aplicar treino
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Selecione um treino salvo
                    </Text>
                  </View>
                  <Pressable
                  onPress={closeApplyPicker}
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
              {selectedApplyClass ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12 }}>
                      Unidade: {applyFilterUnit || "Sem unidade"}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12 }}>
                      Faixa: {applyFilterAge || "Sem faixa"}
                    </Text>
                  </View>
                </View>
              ) : null}
              {filteredApplyPlans.length ? (
                <ScrollView
                  contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
                  style={{ maxHeight: "94%" }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {filteredApplyPlans.map((plan) => (
                    <View
                      key={plan.id}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        backgroundColor: colors.inputBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        gap: 6,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                        {plan.title}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {plan.tags?.length ? "Tags: " + plan.tags.join(", ") : "Sem tags"}
                      </Text>
                      <Pressable
                        onPress={() => applyPlanToDay(plan)}
                        style={({ pressed }) => [
                          {
                            marginTop: 6,
                            paddingVertical: 8,
                            borderRadius: 10,
                            alignItems: "center",
                            backgroundColor: colors.primaryBg,
                          },
                          pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
                        ]}
                      >
                        <Text
                          style={{
                            color: colors.primaryText,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          Aplicar na aula do dia
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ color: colors.muted }}>
                  Nenhum treino salvo para essa faixa e unidade.
                </Text>
              )}
      </ModalSheet>
    </SafeAreaView>
  );
}




