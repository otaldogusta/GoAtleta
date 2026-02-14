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

const BUCKET_ORDER = ["Manhã", "Tarde", "Noite", "Madrugada"] as const;
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;
type BucketLabel = (typeof BUCKET_ORDER)[number];

type GridClassItemModel = {
  classId: string;
  className: string;
  classGender: ClassGroup["gender"];
  dateIso: string;
  timeLabel: string;
  classPalette: ReturnType<typeof getClassPalette>;
  isWeekly: boolean;
  hasApplied: boolean;
  cardBackground: string;
  cardBorder: string;
  dotColor: string;
  titleColor: string;
};

type GridBucketModel = {
  label: BucketLabel;
  items: GridClassItemModel[];
};

type GridUnitModel = {
  unitKey: string;
  label: string;
  countLabel: string;
  buckets: GridBucketModel[];
};

type GridDayModel = {
  day: number;
  dayLabel: string;
  dayKey: string;
  dateIso: string;
  dateLabel: string;
  isPast: boolean;
  countLabel: string;
  unitGroups: GridUnitModel[];
};

export default function CalendarScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
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
  const expandAnimRef = useRef<Record<string, Animated.Value>>({});
  const [showApplyPicker, setShowApplyPicker] = useState(false);
  const [applyPickerClassId, setApplyPickerClassId] = useState("");
  const [applyPickerDate, setApplyPickerDate] = useState("");
  const applyPickerCardStyle = useModalCardStyle({
    gap: 12,
    maxHeight: "100%",
  });
  const baseHour = 14;
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
    const targetClass = classById[targetClassId];
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
  }, [
    openApply,
    targetClassId,
    targetDate,
    classById,
    unitLabel,
    setExpandedPastDays,
    setExpandedUnitGroups,
  ]);

  const planLookupByClass = useMemo(() => {
    const map: Record<
      string,
      {
        byDate: Record<string, TrainingPlan>;
        byWeekday: Record<number, TrainingPlan>;
      }
    > = {};
    plans.forEach((plan) => {
      if (!map[plan.classId]) {
        map[plan.classId] = { byDate: {}, byWeekday: {} };
      }
      const entry = map[plan.classId];
      if (plan.applyDate && !entry.byDate[plan.applyDate]) {
        entry.byDate[plan.applyDate] = plan;
      }
      (plan.applyDays ?? []).forEach((weekday) => {
        if (!entry.byWeekday[weekday]) {
          entry.byWeekday[weekday] = plan;
        }
      });
    });
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
  const getBucketLabel = useCallback((hour: number): BucketLabel => {
    if (hour >= 5 && hour <= 11) return "Manhã";
    if (hour >= 12 && hour <= 17) return "Tarde";
    if (hour >= 18 && hour <= 23) return "Noite";
    return "Madrugada";
  }, []);
  const filteredClasses = useMemo(() => {
    if (unitFilter === "Todas") return classes;
    const filterKey = normalizeUnitKey(unitFilter);
    return classes.filter((cls) => unitKey(cls.unit) === filterKey);
  }, [classes, unitFilter, unitKey]);

  const filteredClassesByDay = useMemo(() => {
    const grouped: Record<number, ClassGroup[]> = {};
    filteredClasses.forEach((cls) => {
      cls.daysOfWeek.forEach((day) => {
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(cls);
      });
    });
    Object.values(grouped).forEach((items) => {
      items.sort(sortByTime);
    });
    return grouped;
  }, [filteredClasses, sortByTime]);

  const scheduleDays = useMemo(() => {
    const days = Object.keys(filteredClassesByDay)
      .map((day) => Number(day))
      .sort((a, b) => a - b);
    if (!days.length) return [{ day: 2 }, { day: 4 }];
    return days.map((day) => ({ day }));
  }, [filteredClassesByDay]);

  const weeklyGridModel = useMemo<GridDayModel[]>(() => {
    return scheduleDays.map((dayInfo) => {
      const date = new Date(weekStart);
      const day = dayInfo.day;
      const offset = day === 0 ? 6 : day - 1;
      date.setDate(weekStart.getDate() + offset);
      const dayKey = formatIsoDate(date);
      const dateIso = dayKey;
      const dateLabel = formatDate(date);
      const dayLabel = DAY_LABELS[day] ?? "Dia";
      const weekDay = date.getDay() === 0 ? 7 : date.getDay();
      const isPast = date.getTime() < todayStart.getTime();
      const classesForDay = filteredClassesByDay[day] ?? [];

      const groupedByUnit = classesForDay.reduce<
        Record<string, { label: string; items: ClassGroup[] }>
      >((acc, cls) => {
        const label = unitLabel(cls.unit);
        const key = unitKey(label);
        if (!acc[key]) acc[key] = { label, items: [] };
        acc[key].items.push(cls);
        return acc;
      }, {});

      const unitGroups = Object.entries(groupedByUnit)
        .map(([groupUnitKey, entry]) => {
          const buckets: Record<BucketLabel, GridClassItemModel[]> = {
            "Manhã": [],
            "Tarde": [],
            "Noite": [],
            "Madrugada": [],
          };

          entry.items.forEach((cls, index) => {
            const parsed = parseTime(cls.startTime || "");
            const startHour = parsed ? parsed.hour : baseHour + index;
            const startMinute = parsed ? parsed.minute : 0;
            const durationMinutes = cls.durationMinutes || 60;
            const timeLabel = formatTimeRange(startHour, startMinute, durationMinutes);
            const classUnitLabel = unitLabel(cls.unit);
            const classPalette = getClassPalette(cls.colorKey, colors, classUnitLabel);
            const planLookup = planLookupByClass[cls.id];
            const appliedPlan = planLookup
              ? planLookup.byDate[dateIso] ?? planLookup.byWeekday[weekDay] ?? null
              : null;
            const isSpecificDate = Boolean(appliedPlan?.applyDate);
            const isWeekly = !isSpecificDate && (appliedPlan?.applyDays?.length ?? 0) > 0;
            const hasApplied = Boolean(appliedPlan?.applyDate) || (appliedPlan?.applyDays?.length ?? 0) > 0;
            const cardBackground = isPast
              ? colors.secondaryBg
              : hasApplied
                ? colors.inputBg
                : colors.card;
            const cardBorder = isPast ? toRgba(classPalette.bg, 0.35) : classPalette.bg;
            const dotColor = isPast ? toRgba(classPalette.bg, 0.45) : classPalette.bg;
            const titleColor = isPast ? colors.muted : colors.text;
            const bucketLabel = getBucketLabel(startHour);

            buckets[bucketLabel].push({
              classId: cls.id,
              className: cls.name,
              classGender: cls.gender,
              dateIso,
              timeLabel,
              classPalette,
              isWeekly,
              hasApplied,
              cardBackground,
              cardBorder,
              dotColor,
              titleColor,
            });
          });

          const orderedBuckets = BUCKET_ORDER.map((label) => ({
            label,
            items: buckets[label],
          })).filter((bucket) => bucket.items.length > 0);

          return {
            unitKey: groupUnitKey,
            label: entry.label,
            countLabel: entry.items.length === 1 ? "1 turma" : `${entry.items.length} turmas`,
            buckets: orderedBuckets,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      const classCount = classesForDay.length;

      return {
        day,
        dayLabel,
        dayKey,
        dateIso,
        dateLabel,
        isPast,
        countLabel: classCount === 1 ? "1 turma" : `${classCount} turmas`,
        unitGroups,
      };
    });
  }, [
    baseHour,
    colors,
    filteredClassesByDay,
    getBucketLabel,
    planLookupByClass,
    scheduleDays,
    todayStart,
    unitKey,
    unitLabel,
    weekStart,
  ]);

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
        {weeklyGridModel.map((dayModel) => {
          const isExpanded = expandedPastDays[dayModel.dayKey] ?? !dayModel.isPast;
          const expandAnim = getExpandAnim(dayModel.dayKey, isExpanded ? 1 : 0);

          return (
            <View
              key={String(dayModel.day)}
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
                    [dayModel.dayKey]: !isExpanded,
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
                    {dayModel.dayLabel}
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
                        {dayModel.dateLabel}
                      </Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{dayModel.countLabel}</Text>
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
                <View style={{ gap: 12 }}>
                  {!dayModel.unitGroups.length ? (
                    <Text style={{ color: colors.muted }}>Sem turmas nesse dia.</Text>
                  ) : (
                    dayModel.unitGroups.map((unitGroup) => {
                      const expandedUnitKey = `${dayModel.dayKey}-${unitGroup.unitKey}`;
                      const isUnitExpanded = expandedUnitGroups[expandedUnitKey] ?? true;

                      return (
                        <View
                          key={unitGroup.unitKey}
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
                                [expandedUnitKey]: !isUnitExpanded,
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
                                {unitGroup.label}
                              </Text>
                              <Text style={{ color: colors.muted, fontSize: 12 }}>
                                {unitGroup.countLabel}
                              </Text>
                            </View>
                            <MaterialCommunityIcons
                              name={isUnitExpanded ? "chevron-down" : "chevron-right"}
                              size={18}
                              color={colors.muted}
                            />
                          </Pressable>
                          {isUnitExpanded ? (
                            <View style={{ gap: 12 }}>
                              {unitGroup.buckets.map((bucket) => (
                                <View key={bucket.label} style={{ gap: 8 }}>
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
                                        {bucket.label}
                                      </Text>
                                    </View>
                                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                                  </View>
                                  {bucket.items.map((item) => (
                                    <Pressable
                                      key={`${item.classId}-${dayModel.dayKey}`}
                                      onPress={() =>
                                        router.push({
                                          pathname: "/class/[id]/session",
                                          params: { id: item.classId, date: item.dateIso },
                                        })
                                      }
                                      style={{
                                        padding: 14,
                                        borderRadius: 18,
                                        backgroundColor: item.cardBackground,
                                        borderWidth: 1,
                                        borderColor: item.cardBorder,
                                        borderLeftWidth: 4,
                                        borderLeftColor: item.classPalette.bg,
                                        shadowColor: "#000",
                                        shadowOpacity: dayModel.isPast ? 0.03 : 0.08,
                                        shadowRadius: dayModel.isPast ? 6 : 12,
                                        shadowOffset: { width: 0, height: dayModel.isPast ? 4 : 8 },
                                        elevation: dayModel.isPast ? 1 : 3,
                                        opacity: dayModel.isPast ? 0.65 : 1,
                                      }}
                                    >
                                      {item.isWeekly ? (
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
                                            backgroundColor: item.dotColor,
                                          }}
                                        />
                                        <Text
                                          style={{
                                            fontSize: 16,
                                            fontWeight: "700",
                                            color: item.titleColor,
                                          }}
                                        >
                                          {item.timeLabel + " - " + item.className}
                                        </Text>
                                        <ClassGenderBadge gender={item.classGender} size="sm" />
                                      </View>
                                    </Pressable>
                                  ))}
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
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
