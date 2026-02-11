import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Animated,
    ScrollView,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../src/ui/Pressable";

import type { ClassGroup, TrainingPlan } from "../src/core/models";
import { normalizeUnitKey } from "../src/core/unit-key";
import {
    getClasses,
    getTrainingPlans,
    updateTrainingPlan,
} from "../src/db/seed";
import { useAppTheme } from "../src/ui/app-theme";
import { getClassPalette } from "../src/ui/class-colors";
import { ClassGenderBadge } from "../src/ui/ClassGenderBadge";
import { FadeHorizontalScroll } from "../src/ui/FadeHorizontalScroll";
import { ModalSheet } from "../src/ui/ModalSheet";
import { ScreenHeader } from "../src/ui/ScreenHeader";
import { useSaveToast } from "../src/ui/save-toast";
import { ShimmerBlock } from "../src/ui/Shimmer";
import { getUnitPalette, toRgba } from "../src/ui/unit-colors";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";
import { usePersistedState } from "../src/ui/use-persisted-state";

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
  const [loadingData, setLoadingData] = useState(true);
  const [unitFilter, setUnitFilter] = useState("Todas");
  const [activeWeekTab, setActiveWeekTab] = useState<"prev" | "current" | "next">("current");
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
  const baseWeekStart = useMemo(
    () => startOfWeek(targetDate ? new Date(targetDate) : new Date()),
    [targetDate]
  );
  const getWeekStartForTab = useCallback(
    (tabId: "prev" | "current" | "next") => {
      const copy = new Date(baseWeekStart);
      if (tabId === "prev") copy.setDate(copy.getDate() - 7);
      if (tabId === "next") copy.setDate(copy.getDate() + 7);
      return copy;
    },
    [baseWeekStart]
  );
  const weekStart = useMemo(
    () => getWeekStartForTab(activeWeekTab),
    [activeWeekTab, getWeekStartForTab]
  );
  const weekRangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${formatDate(weekStart)} - ${formatDate(end)}`;
  }, [weekStart]);
  const earliestClassStart = useMemo(() => {
    const parsed = classes
      .map((cls) => cls.cycleStartDate || "")
      .map((value) => (value ? new Date(value + "T00:00:00") : null))
      .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return parsed[0] ?? null;
  }, [classes]);
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);
  const showNoTrainingNotice = useMemo(() => {
    if (!earliestClassStart) return false;
    return weekEnd.getTime() < earliestClassStart.getTime();
  }, [earliestClassStart, weekEnd]);
  const earliestLabel = earliestClassStart ? formatDate(earliestClassStart) : "";
  const unitLabel = useCallback((value: string) => {
    return value && value.trim() ? value.trim() : "Sem unidade";
  }, []);
  const unitKey = useCallback(
    (value: string) => normalizeUnitKey(unitLabel(value)),
    [unitLabel]
  );
  const classById = useMemo(() => {
    const map: Record<string, ClassGroup> = {};
    classes.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [classes]);
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
      try {
        const [classList, planList] = await Promise.all([
          getClasses(),
          getTrainingPlans(),
        ]);
        if (!alive) return;
        setClasses(classList);
        setPlans(planList);
      } finally {
        if (alive) setLoadingData(false);
      }
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
  }, [openApply, targetClassId, targetDate, classes, unitLabel]);

  const plansByClassId = useMemo(() => {
    const map: Record<string, TrainingPlan[]> = {};
    for (const plan of plans) {
      if (!map[plan.classId]) map[plan.classId] = [];
      map[plan.classId].push(plan);
    }
    return map;
  }, [plans]);

  const sortByTime = useCallback((a: ClassGroup, b: ClassGroup) => {
    const aParsed = parseTime(a.startTime || "");
    const bParsed = parseTime(b.startTime || "");
    const aMinutes = aParsed ? aParsed.hour * 60 + aParsed.minute : 9999;
    const bMinutes = bParsed ? bParsed.hour * 60 + bParsed.minute : 9999;
    if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    return a.name.localeCompare(b.name);
  }, []);

  const getAppliedPlan = (classId: string, date: Date) => {
    const list = plansByClassId[classId] ?? [];
    if (!list.length) return null;
    const iso = formatIsoDate(date);
    const weekDay = date.getDay() === 0 ? 7 : date.getDay();
    const byDate = list.find((plan) => plan.applyDate === iso);
    if (byDate) return byDate;
    const byWeekday = list.find((plan) =>
      ((plan.applyDays ?? []).includes(weekDay))
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
  const filteredClasses = useMemo(() => {
    if (unitFilter === "Todas") return classes;
    const filterKey = normalizeUnitKey(unitFilter);
    return classes.filter((cls) => unitKey(cls.unit) === filterKey);
  }, [classes, unitFilter, unitKey]);

  const scheduleDays = useMemo(() => {
    const unique = new Set<number>();
    filteredClasses.forEach((cls) => {
      cls.daysOfWeek.forEach((day) => unique.add(day));
    });
    const days = Array.from(unique).sort((a, b) => a - b);
    if (!days.length) return [{ day: 2 }, { day: 4 }];
    return days.map((day) => ({ day }));
  }, [filteredClasses]);

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
  const applyFilterUnitKey = normalizeUnitKey(applyFilterUnit);
  const applyFilterAge = selectedApplyClass?.ageBand ?? "";
  const filteredApplyPlans = useMemo(() => {
    if (!selectedApplyClass) return sortedPlans;
    return sortedPlans.filter((plan) => {
      const planClass = classById[plan.classId];
      if (!planClass) return false;
      return unitKey(planClass.unit) === applyFilterUnitKey &&
        planClass.ageBand === applyFilterAge;
    });
  }, [
    sortedPlans,
    classById,
    selectedApplyClass,
    applyFilterUnitKey,
    applyFilterAge,
    unitKey,
  ]);

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
      ((plan.applyDays ?? []).length === 0);
    if (isSameApply) {
      closeApplyPicker();
      showSaveToast({
        message: "Planejamento já adicionado.",
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
      message: "Planejamento aplicado com sucesso.",
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
    const map = new Map<string, string>();
    classes.forEach((cls) => {
      const label = unitLabel(cls.unit);
      const key = unitKey(label);
      if (!map.has(key)) map.set(key, label);
    });
    return ["Todas", ...Array.from(map.values()).sort((a, b) => a.localeCompare(b))];
  }, [classes, unitKey, unitLabel]);
  const baseHour = 14;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        

        {loadingData ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 16 }}>
          <View style={{ gap: 2 }}>
            <ScreenHeader
              title="Calendário semanal"
              subtitle="Dias por unidade e turmas"
            />
            <Text style={{ color: colors.muted, marginTop: 2 }}>
              {weekRangeLabel}
            </Text>
          </View>

            <ShimmerBlock style={{ height: 34, borderRadius: 999 }} />
            <ShimmerBlock style={{ height: 90, borderRadius: 18 }} />
            <ShimmerBlock style={{ height: 90, borderRadius: 18 }} />
            <ShimmerBlock style={{ height: 90, borderRadius: 18 }} />
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 16 }}
            pointerEvents={showApplyPicker ? "none" : "auto"}
          >
          <View style={{ gap: 2 }}>
            <ScreenHeader
              title="Calendário semanal"
              subtitle="Dias por unidade e turmas"
            />
            <Text style={{ color: colors.muted, marginTop: 2 }}>
              {weekRangeLabel}
            </Text>
          </View>

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
              { id: "prev", label: "Semana anterior" },
              { id: "current", label: "Semana atual" },
              { id: "next", label: "Próxima semana" },
            ].map((tab) => {
              const selected = activeWeekTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    const nextTab = tab.id as "prev" | "current" | "next";
                    setActiveWeekTab(nextTab);
                  }}
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
        {showNoTrainingNotice ? (
            <View
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                Sem aulas nesta semana
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>
                Início das aulas em {earliestLabel}.
              </Text>
            </View>
          ) : null}

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
          <FadeHorizontalScroll
            fadeColor={colors.card}
            contentContainerStyle={{ flexDirection: "row", gap: 8 }}
          >
            {unitOptions.map((unit) => {
              const active = unitFilter === unit;
              const palette = unit === "Todas" ? null : getUnitPalette(unit, colors);
              const chipBg = active
                ? (palette ? palette.bg : colors.primaryBg)
                : colors.secondaryBg;
              const chipText = active
                ? (palette ? palette.text : colors.primaryText)
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
          </FadeHorizontalScroll>
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
            const filtered = filteredClasses.filter((cls) =>
              cls.daysOfWeek.includes(day)
            );
            const groupedByUnit = filtered.reduce<
              Record<string, { label: string; items: ClassGroup[] }>
            >((acc, cls) => {
              const label = unitLabel(cls.unit);
              const key = unitKey(label);
              if (!acc[key]) acc[key] = { label, items: [] };
              acc[key].items.push(cls);
              return acc;
            }, {});
            const unitGroups = Object.entries(groupedByUnit)
              .map(([key, entry]) => ({
                key,
                label: entry.label,
                items: entry.items.sort(sortByTime),
              }))
              .sort((a, b) => a.label.localeCompare(b.label));
          const renderUnitGroups = (
            grouped: readonly { key: string; label: string; items: ClassGroup[] }[]
          ) => {
            if (!grouped.length) {
              return <Text style={{ color: colors.muted }}>Sem turmas nesse dia.</Text>;
            }

            return grouped.map(({ key, label, items }) => {
              const unitKey = `${dayKey}-${key}`;
              const isUnitExpanded = expandedUnitGroups[unitKey] ?? true;
              const palette = getUnitPalette(label, colors);
              const unitBorder = palette.bg;
              const unitBg =
                mode === "dark"
                  ? toRgba(palette.bg, 0.16)
                  : toRgba(palette.bg, 0.1);
              const buckets = items.reduce<Record<string, ClassGroup[]>>(
                (acc, cls, index) => {
                  const parsed = parseTime(cls.startTime || "");
                  const startHour = parsed ? parsed.hour : baseHour + index;
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
                  key={key}
                  style={{
                    borderRadius: 14,
                    borderWidth: 0,
                    borderColor: "transparent",
                    padding: 10,
                    gap: 10,
                    backgroundColor: "transparent",
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
                      {label}
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
                            const startHour = parsed ? parsed.hour : baseHour + index;
                            const startMinute = parsed ? parsed.minute : 0;
                            const durationMinutes = cls.durationMinutes || 60;
                            const time = formatTimeRange(
                              startHour,
                              startMinute,
                              durationMinutes
                            );
                            const classUnit = unitLabel(cls.unit);
                            const classPalette = getClassPalette(cls.colorKey, colors, classUnit);
                            const appliedPlan = getAppliedPlan(cls.id, date);
                            const isSpecificDate = Boolean(appliedPlan?.applyDate);
                            const isWeekly =
                              !isSpecificDate &&
                              (appliedPlan?.applyDays?.length ?? 0) > 0;
                            const hasApplied =
                              Boolean(appliedPlan?.applyDate) ||
                              (appliedPlan?.applyDays?.length ?? 0) > 0;
                            const cardBackground = isPast
                              ? colors.secondaryBg
                              : hasApplied
                                ? colors.inputBg
                                : colors.card;
                            const cardBorder = isPast
                              ? toRgba(classPalette.bg, 0.35)
                              : classPalette.bg;
                            return (
                              <Pressable
                                key={`${cls.id}-${dayKey}`}
                                onPress={() =>
                                  router.push({
                                    pathname: "/class/[id]/session",
                                    params: { id: cls.id, date: formatIsoDate(date) },
                                  })
                                }
                                style={{
                                  padding: 14,
                                  borderRadius: 18,
                                  backgroundColor: cardBackground,
                                  borderWidth: 1,
                                  borderColor: cardBorder,
                                  borderLeftWidth: 4,
                                  borderLeftColor: classPalette.bg,
                                  shadowColor: "#000",
                                  shadowOpacity: isPast ? 0.03 : 0.08,
                                  shadowRadius: isPast ? 6 : 12,
                                  shadowOffset: { width: 0, height: isPast ? 4 : 8 },
                                  elevation: isPast ? 1 : 3,
                                  opacity: isPast ? 0.65 : 1,
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
                                      backgroundColor: isPast
                                        ? toRgba(classPalette.bg, 0.45)
                                        : classPalette.bg,
                                    }}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 16,
                                      fontWeight: "700",
                                      color: isPast ? colors.muted : colors.text,
                                    }}
                                  >
                                    {time + " - " + cls.name}
                                  </Text>
                                  <ClassGenderBadge gender={cls.gender} size="sm" />
                                </View>
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
        )}
      <ModalSheet
        visible={showApplyPicker}
        onClose={closeApplyPicker}
        cardStyle={[applyPickerCardStyle, { paddingBottom: 12 }]}
        position="center"
      >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
                      Aplicar planejamento
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Selecione um planejamento salvo
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
                  style={{ maxHeight: "92%" }}
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
                        {plan.tags.length ? "Tags: " + plan.tags.join(", ") : "Sem tags"}
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
                  Nenhum planejamento salvo para essa faixa e unidade.
                </Text>
              )}
      </ModalSheet>
    </SafeAreaView>
  );
}
