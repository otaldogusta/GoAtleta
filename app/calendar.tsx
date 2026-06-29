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
  FlatList,
  ScrollView,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../src/ui/Pressable";

import type { EventListItem } from "../src/api/events";
import { listEvents } from "../src/api/events";
import { useAuth } from "../src/auth/auth";
import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import { ScreenLoadingState } from "../src/components/ui/ScreenLoadingState";
import type { ClassGroup, TrainingPlan } from "../src/core/models";
import { createTrainingPlanVersion } from "../src/core/training-plan-factory";
import { normalizeUnitKey } from "../src/core/unit-key";
import {
  getClasses,
  getLatestTrainingPlanByClass,
  getTrainingPlans,
  saveTrainingPlan,
} from "../src/db/seed";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { useAppTheme } from "../src/ui/app-theme";
import { getClassPalette } from "../src/ui/class-colors";
import { FadeHorizontalScroll } from "../src/ui/FadeHorizontalScroll";
import { ModalSheet } from "../src/ui/ModalSheet";
import { useSaveToast } from "../src/ui/save-toast";
import { getUnitPalette, toRgba } from "../src/ui/unit-colors";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";

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

const formatMonthTitle = (date: Date) => {
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

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

const getDateSortMinutes = (date: Date) =>
  date.getHours() * 60 + date.getMinutes();

const formatEventTimeLabel = (event: EventListItem) => {
  if (event.allDay) return "Dia todo";
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (Number.isNaN(start.getTime())) return "Horário indefinido";
  const startLabel = pad2(start.getHours()) + ":" + pad2(start.getMinutes());
  if (Number.isNaN(end.getTime())) return startLabel;
  return startLabel + " - " + pad2(end.getHours()) + ":" + pad2(end.getMinutes());
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;
const MONTH_WEEKDAY_HEADERS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const MONTH_GRID_DAY_COUNT = 42;

const eventTypeLabel: Record<EventListItem["eventType"], string> = {
  torneio: "Torneio",
  amistoso: "Amistoso",
  treino: "Evento",
  reuniao: "Reunião",
  outro: "Evento",
};

type AgendaClassItemModel = {
  kind: "class";
  id: string;
  classId: string;
  title: string;
  unitLabel: string;
  classGender: ClassGroup["gender"];
  dateIso: string;
  timeLabel: string;
  sortMinutes: number;
  classPalette: ReturnType<typeof getClassPalette>;
  hasApplied: boolean;
  cardBackground: string;
  cardBorder: string;
  dotColor: string;
  titleColor: string;
};

type AgendaEventItemModel = {
  kind: "event";
  id: string;
  eventId: string;
  title: string;
  subtitle: string;
  dateIso: string;
  timeLabel: string;
  sortMinutes: number;
  typeLabel: string;
  cardBackground: string;
  cardBorder: string;
  dotColor: string;
  titleColor: string;
};

type AgendaItemModel = AgendaClassItemModel | AgendaEventItemModel;

type MonthCalendarDayModel = {
  day: number;
  dayNumber: number;
  dayLabel: string;
  dayKey: string;
  dateIso: string;
  dateLabel: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  classCount: number;
  eventCount: number;
  countLabel: string;
  agendaItems: AgendaItemModel[];
};

export default function CalendarScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { activeOrganization } = useOrganization();
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
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [unitFilter, setUnitFilter] = useState("Todas");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const seed = targetDate ? new Date(targetDate + "T00:00:00") : new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });
  const [showApplyPicker, setShowApplyPicker] = useState(false);
  const [applyPickerClassId, setApplyPickerClassId] = useState("");
  const [applyPickerDate, setApplyPickerDate] = useState("");
  const applyPickerCardStyle = useModalCardStyle({
    gap: 12,
    maxHeight: "100%",
  });
  const isCompactLayout = width < 840;
  const baseHour = 14;
  const monthStart = useMemo(
    () => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1),
    [visibleMonth]
  );
  const monthEnd = useMemo(
    () => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0),
    [visibleMonth]
  );
  const calendarStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const calendarEnd = useMemo(() => {
    const end = new Date(calendarStart);
    end.setDate(end.getDate() + MONTH_GRID_DAY_COUNT - 1);
    end.setHours(0, 0, 0, 0);
    return end;
  }, [calendarStart]);
  const monthTitle = useMemo(() => formatMonthTitle(visibleMonth), [visibleMonth]);
  const goToPreviousMonth = useCallback(() => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }, []);
  const goToNextMonth = useCallback(() => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }, []);

  useEffect(() => {
    if (!targetDate) return;
    const seed = new Date(targetDate + "T00:00:00");
    if (Number.isNaN(seed.getTime())) return;
    setVisibleMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
  }, [targetDate]);

  const earliestClassStart = useMemo(() => {
    const parsed = classes
      .map((cls) => cls.cycleStartDate || "")
      .map((value) => (value ? new Date(value + "T00:00:00") : null))
      .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return parsed[0] ?? null;
  }, [classes]);
  const showNoTrainingNotice = useMemo(() => {
    if (!earliestClassStart) return false;
    return monthEnd.getTime() < earliestClassStart.getTime();
  }, [earliestClassStart, monthEnd]);
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
    let alive = true;
    (async () => {
      try {
        const classList = await getClasses();
        if (!alive) return;
        setClasses(classList);
        void (async () => {
          try {
            const planList = await getTrainingPlans();
            if (!alive) return;
            setPlans(planList);
          } catch {
            if (!alive) return;
            setPlans([]);
          }
        })();
      } finally {
        if (alive) setLoadingData(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!activeOrganization?.id) {
      setEvents([]);
      return () => {
        alive = false;
      };
    }

    const from = new Date(calendarStart);
    from.setHours(0, 0, 0, 0);
    const to = new Date(calendarEnd);
    to.setHours(23, 59, 59, 999);

    void listEvents({
      organizationId: activeOrganization.id,
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      userId: session?.user?.id,
    })
      .then((rows) => {
        if (alive) setEvents(rows);
      })
      .catch(() => {
        if (alive) setEvents([]);
      });

    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, calendarEnd, calendarStart, session?.user?.id]);

  const applyTargetHandled = useRef(false);
  useEffect(() => {
    if (!openApply || applyTargetHandled.current) return;
    if (!targetClassId || !targetDate) return;
    const targetClass = classById[targetClassId];
    if (!targetClass) return;
    const unitName = unitLabel(targetClass.unit);
    setUnitFilter(unitName);
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

  const filteredClassIds = useMemo(
    () => new Set(filteredClasses.map((cls) => cls.id)),
    [filteredClasses]
  );

  const visibleEvents = useMemo(() => {
    if (unitFilter === "Todas") return events;
    const filterKey = normalizeUnitKey(unitFilter);
    return events.filter((event) => {
      if (event.classIds.some((classId) => filteredClassIds.has(classId))) {
        return true;
      }
      return event.locationLabel
        ? normalizeUnitKey(event.locationLabel) === filterKey
        : false;
    });
  }, [events, filteredClassIds, unitFilter]);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventListItem[]> = {};
    visibleEvents.forEach((event) => {
      const startsAt = new Date(event.startsAt);
      if (Number.isNaN(startsAt.getTime())) return;
      const dateKey = formatIsoDate(startsAt);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    Object.values(grouped).forEach((items) => {
      items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    });
    return grouped;
  }, [visibleEvents]);

  const monthlyCalendarDays = useMemo<MonthCalendarDayModel[]>(() => {
    return Array.from({ length: MONTH_GRID_DAY_COUNT }, (_, index) => {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + index);
      const dayKey = formatIsoDate(date);
      const dateIso = dayKey;
      const dateLabel = formatDate(date);
      const day = date.getDay();
      const dayLabel = DAY_LABELS[day] ?? "Dia";
      const weekDay = date.getDay() === 0 ? 7 : date.getDay();
      const isToday = date.getTime() === todayStart.getTime();
      const isPast = date.getTime() < todayStart.getTime();
      const isCurrentMonth =
        date.getMonth() === visibleMonth.getMonth() &&
        date.getFullYear() === visibleMonth.getFullYear();
      const classesForDay = filteredClassesByDay[day] ?? [];
      const eventsForDay = eventsByDate[dateIso] ?? [];

      const classItems: AgendaClassItemModel[] = classesForDay.map((cls, index) => {
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
        const hasApplied =
          Boolean(appliedPlan?.applyDate) || (appliedPlan?.applyDays?.length ?? 0) > 0;
        const cardBackground = isPast
          ? colors.secondaryBg
          : hasApplied
            ? colors.inputBg
            : colors.card;
        const cardBorder = isPast ? toRgba(classPalette.bg, 0.35) : classPalette.bg;
        const dotColor = isPast ? toRgba(classPalette.bg, 0.45) : classPalette.bg;
        const titleColor = isPast ? colors.muted : colors.text;

        return {
          kind: "class",
          id: `class-${cls.id}-${dateIso}`,
          classId: cls.id,
          title: cls.name,
          unitLabel: classUnitLabel,
          classGender: cls.gender,
          dateIso,
          timeLabel,
          sortMinutes: startHour * 60 + startMinute,
          classPalette,
          hasApplied,
          cardBackground,
          cardBorder,
          dotColor,
          titleColor,
        };
      });

      const eventItems: AgendaEventItemModel[] = eventsForDay.map((event) => {
        const startsAt = new Date(event.startsAt);
        const sortMinutes = Number.isNaN(startsAt.getTime())
          ? 9999
          : getDateSortMinutes(startsAt);
        const typeLabel = eventTypeLabel[event.eventType] ?? "Evento";
        const linkedClassesLabel = event.classIds.length === 1
          ? "1 turma vinculada"
          : event.classIds.length > 1
            ? `${event.classIds.length} turmas vinculadas`
            : "Evento geral";
        const subtitle = event.locationLabel || linkedClassesLabel;

        return {
          kind: "event",
          id: `event-${event.id}`,
          eventId: event.id,
          title: event.title,
          subtitle,
          dateIso,
          timeLabel: formatEventTimeLabel(event),
          sortMinutes,
          typeLabel,
          cardBackground: colors.inputBg,
          cardBorder: toRgba(colors.warningText, 0.45),
          dotColor: colors.warningText,
          titleColor: colors.text,
        };
      });

      const agendaItems = [...classItems, ...eventItems].sort((a, b) => {
        if (a.sortMinutes !== b.sortMinutes) return a.sortMinutes - b.sortMinutes;
        return a.title.localeCompare(b.title);
      });

      const classCount = classesForDay.length;
      const eventCount = eventsForDay.length;
      const countParts = [
        classCount === 1 ? "1 aula" : classCount > 1 ? `${classCount} aulas` : "",
        eventCount === 1 ? "1 evento" : eventCount > 1 ? `${eventCount} eventos` : "",
      ].filter(Boolean);

      return {
        day,
        dayNumber: date.getDate(),
        dayLabel,
        dayKey,
        dateIso,
        dateLabel,
        isCurrentMonth,
        isToday,
        isPast,
        classCount,
        eventCount,
        countLabel: countParts.length ? countParts.join(" · ") : "Sem agenda",
        agendaItems,
      };
    });
  }, [
    baseHour,
    colors,
    eventsByDate,
    filteredClassesByDay,
    planLookupByClass,
    todayStart,
    unitLabel,
    calendarStart,
    visibleMonth,
  ]);

  const monthlyCalendarRows = useMemo(() => {
    const rows: MonthCalendarDayModel[][] = [];
    for (let index = 0; index < monthlyCalendarDays.length; index += 7) {
      rows.push(monthlyCalendarDays.slice(index, index + 7));
    }
    return rows;
  }, [monthlyCalendarDays]);

  const monthClassCount = useMemo(
    () =>
      monthlyCalendarDays.reduce(
        (total, day) => total + (day.isCurrentMonth ? day.classCount : 0),
        0
      ),
    [monthlyCalendarDays]
  );
  const monthEventCount = useMemo(
    () =>
      monthlyCalendarDays.reduce(
        (total, day) => total + (day.isCurrentMonth ? day.eventCount : 0),
        0
      ),
    [monthlyCalendarDays]
  );
  const monthSummaryLabel = useMemo(() => {
    const parts = [
      monthClassCount === 1 ? "1 aula" : monthClassCount > 1 ? `${monthClassCount} aulas` : "",
      monthEventCount === 1 ? "1 evento" : monthEventCount > 1 ? `${monthEventCount} eventos` : "",
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Sem compromissos";
  }, [monthClassCount, monthEventCount]);

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
    const latestVersionPlan = await getLatestTrainingPlanByClass(targetClassId);
    const latestVersion = latestVersionPlan?.version ?? 0;
    const updated: TrainingPlan = createTrainingPlanVersion({
      classId: targetClassId,
      version: Math.max(plan.version ?? 0, latestVersion) + 1,
      origin: "manual_apply",
      draft: {
        title: plan.title,
        tags: plan.tags,
        warmup: plan.warmup,
        main: plan.main,
        cooldown: plan.cooldown,
        warmupTime: plan.warmupTime,
        mainTime: plan.mainTime,
        cooldownTime: plan.cooldownTime,
      },
      applyDate: targetDate,
      applyDays: [],
      nowIso: new Date().toISOString(),
      idPrefix: "plan_apply",
      status: "final",
      finalizedAt: new Date().toISOString(),
      inputHash: plan.inputHash,
      parentPlanId: plan.id,
      previousVersionId: latestVersionPlan?.id,
    });
    await saveTrainingPlan(updated);
    setPlans((current) => {
      const next = [...current, updated];
      return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
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
          <ScreenLoadingState />
        ) : (
          <>
          <ScreenPageHeader
            title="Calendário mensal"
            onBack={() => navigateBackOrReplace({ router, fallback: "/prof/home" })}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Pressable
                accessibilityLabel="Mês anterior"
                onPress={goToPreviousMonth}
                style={({ pressed }) => [
                  {
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
              </Pressable>

              <View
                style={{
                  flex: 1,
                  minWidth: 180,
                  minHeight: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 14,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  {monthTitle}
                </Text>
              </View>

              <Pressable
                accessibilityLabel="Próximo mês"
                onPress={goToNextMonth}
                style={({ pressed }) => [
                  {
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
              </Pressable>
            </View>
          </ScreenPageHeader>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12, gap: 14 }}
            pointerEvents={showApplyPicker ? "none" : "auto"}
          >
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
                  Sem aulas neste mês
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  Início das aulas em {earliestLabel}.
                </Text>
              </View>
            ) : null}

            <View
              style={{
                flexDirection: isCompactLayout ? "column" : "row",
                alignItems: isCompactLayout ? "stretch" : "center",
                justifyContent: "space-between",
                gap: 10,
                paddingHorizontal: 2,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 9,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
                    {monthSummaryLabel}
                  </Text>
                </View>
              </View>

              <FadeHorizontalScroll
                fadeColor={colors.background}
                contentContainerStyle={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: isCompactLayout ? "flex-start" : "flex-end",
                  gap: 8,
                  flexGrow: 1,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.muted }}>
                  Unidade
                </Text>
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
                        paddingVertical: 7,
                        paddingHorizontal: 11,
                        borderRadius: 999,
                        backgroundColor: chipBg,
                        borderWidth: 1,
                        borderColor: active ? chipBg : colors.border,
                      }}
                    >
                      <Text style={{ color: chipText, fontWeight: "700", fontSize: 12 }}>
                        {unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </FadeHorizontalScroll>
            </View>

            <View
              style={{
                padding: isCompactLayout ? 8 : 12,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", gap: isCompactLayout ? 4 : 6 }}>
                {MONTH_WEEKDAY_HEADERS.map((label) => (
                  <Text
                    key={label}
                    style={{
                      flex: 1,
                      color: colors.muted,
                      fontSize: 11,
                      fontWeight: "900",
                      textAlign: "center",
                    }}
                  >
                    {label}
                  </Text>
                ))}
              </View>

              {monthlyCalendarRows.map((row, rowIndex) => (
                <View key={`month-row-${rowIndex}`} style={{ flexDirection: "row", gap: isCompactLayout ? 4 : 6 }}>
                  {row.map((dayModel) => {
                    const hasAgenda = dayModel.agendaItems.length > 0;
                    const visibleItemsLimit = isCompactLayout ? 2 : 3;
                    const hiddenItemsCount = Math.max(0, dayModel.agendaItems.length - visibleItemsLimit);
                    const dayBackground = !dayModel.isCurrentMonth
                      ? colors.backgroundSubtle
                      : hasAgenda
                        ? colors.secondaryBg
                        : colors.inputBg;
                    const dayBorder = dayModel.isToday
                      ? colors.primaryBg
                      : hasAgenda
                        ? colors.successBorder
                        : colors.border;

                    return (
                      <View
                        key={dayModel.dayKey}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: isCompactLayout ? 92 : 132,
                          gap: isCompactLayout ? 4 : 6,
                          padding: isCompactLayout ? 5 : 8,
                          borderRadius: isCompactLayout ? 10 : 12,
                          backgroundColor: dayBackground,
                          borderWidth: 1,
                          borderColor: dayBorder,
                          opacity: dayModel.isCurrentMonth ? 1 : 0.38,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              color: hasAgenda || dayModel.isToday ? colors.text : colors.muted,
                              fontSize: 13,
                              fontWeight: "900",
                            }}
                          >
                            {dayModel.dayNumber}
                          </Text>
                          {dayModel.isToday ? (
                            <View
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 999,
                                backgroundColor: colors.primaryBg,
                              }}
                            />
                          ) : null}
                        </View>

                        {dayModel.agendaItems.slice(0, visibleItemsLimit).map((item) => {
                          const isClassItem = item.kind === "class";
                          return (
                            <Pressable
                              key={item.id}
                              onPress={() => {
                                if (item.kind === "class") {
                                  router.push({
                                    pathname: "/class/[id]",
                                    params: { id: item.classId },
                                  });
                                  return;
                                }
                                router.push({
                                  pathname: "/events/[id]",
                                  params: { id: item.eventId },
                                });
                              }}
                              style={({ pressed }) => [
                                {
                                  gap: 2,
                                  paddingVertical: isCompactLayout ? 4 : 5,
                                  paddingHorizontal: isCompactLayout ? 4 : 6,
                                  borderRadius: 8,
                                  backgroundColor: item.cardBackground,
                                  borderWidth: 1,
                                  borderColor: item.cardBorder,
                                  borderLeftWidth: 3,
                                  borderLeftColor: isClassItem ? item.classPalette.bg : item.dotColor,
                                },
                                pressed && { opacity: 0.82 },
                              ]}
                            >
                              <Text
                                numberOfLines={1}
                                style={{
                                  color: colors.muted,
                                  fontSize: isCompactLayout ? 9 : 10,
                                  fontWeight: "900",
                                }}
                              >
                                {item.timeLabel}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={{
                                  color: item.titleColor,
                                  fontSize: isCompactLayout ? 10 : 11,
                                  fontWeight: "900",
                                  lineHeight: isCompactLayout ? 12 : 14,
                                }}
                              >
                                {item.title}
                              </Text>
                              {isClassItem ? null : (
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    color: colors.warningText,
                                    fontSize: 9,
                                    fontWeight: "800",
                                  }}
                                >
                                  {item.typeLabel}
                                </Text>
                              )}
                            </Pressable>
                          );
                        })}

                        {hiddenItemsCount > 0 ? (
                          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800" }}>
                            +{hiddenItemsCount} item{hiddenItemsCount === 1 ? "" : "s"}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
      </>
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
                <FlatList
                  data={filteredApplyPlans}
                  keyExtractor={(plan) => plan.id}
                  contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
                  style={{ maxHeight: "92%" }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  renderItem={({ item: plan }) => (
                    <View
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
                  )}
                />
              ) : (
                <Text style={{ color: colors.muted }}>
                  Nenhum planejamento salvo para essa faixa e unidade.
                </Text>
              )}
      </ModalSheet>
    </SafeAreaView>
  );
}
