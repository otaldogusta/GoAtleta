import { CalendarUnitSelect } from "../src/screens/calendar/CalendarUnitSelect";
import { CalendarWeekPager } from "../src/screens/calendar/CalendarWeekPager";
import { CalendarEventSheet } from "../src/screens/calendar/CalendarEventSheet";
import { useEventSheetGesture } from "../src/screens/calendar/useEventSheetGesture";
import { NativeCalendarFold } from "../src/screens/calendar/NativeCalendarFold";
import { CalendarFold } from "../src/screens/calendar/CalendarFold";
import { selectCalendarDay } from "../src/screens/calendar/application/calendar-selection";
import { listCalendarPauses } from "../src/api/holiday-decisions";
import { isPaused, type CalendarPause } from "../src/core/holidays";
import { markRender, measureAsync } from "../src/observability/perf";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  ScrollView,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useOrganization } from "../src/providers/organization-context";
import { useAppTheme } from "../src/ui/app-theme";
import { getClassPalette } from "../src/ui/class-colors";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import { ModalSheet } from "../src/ui/ModalSheet";
import { useSaveToast } from "../src/ui/save-toast";
import { toRgba } from "../src/ui/unit-colors";
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

type StudentCalendarProps = {
  studentClasses?: ClassGroup[];
  studentLoading?: boolean;
  studentError?: boolean;
  onMonthChange?: (month: Date) => void;
  headerActions?: ReactNode;
};

export default function CalendarScreen({ studentClasses, studentLoading = false, studentError = false, onMonthChange, headerActions }: StudentCalendarProps = {}) {
  const studentMode = studentClasses !== undefined;
  markRender("screen.calendar.render.root");
  const router = useRouter();
  const calendarPath = usePathname();
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { activeOrganization } = useOrganization();
  const [calendarPauses, setCalendarPauses] = useState<{ organizationId: string; rows: CalendarPause[] }>({ organizationId: "", rows: [] });
  useEffect(() => {
    let alive = true;
    const organizationId = activeOrganization?.id;
    if (studentMode || !organizationId) return;
    void listCalendarPauses(organizationId).then(rows => {
      if (alive) setCalendarPauses({ organizationId, rows });
    }).catch(() => { /* Keep the last verified calendar; retry on organization change. */ });
    return () => { alive = false; };
  }, [activeOrganization?.id, studentMode]);

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
    !studentMode && typeof params.openApply === "string" ? params.openApply === "1" : false;
  const [staffClasses, setClasses] = useState<ClassGroup[]>([]);
  const classes = studentClasses ?? staffClasses;
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [unitFilter, setUnitFilter] = useState(() => !studentMode && typeof params.unit === "string" ? params.unit : "Todas");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const seed = targetDate ? new Date(targetDate + "T00:00:00") : new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => targetDate || formatIsoDate(new Date()));
  useEffect(() => { onMonthChange?.(visibleMonth); }, [visibleMonth, onMonthChange]);
  const [showApplyPicker, setShowApplyPicker] = useState(false);
  const [applyPickerClassId, setApplyPickerClassId] = useState("");
  const [applyPickerDate, setApplyPickerDate] = useState("");
  const applyPickerCardStyle = useModalCardStyle({
    gap: 12,
    maxHeight: "100%",
  });
  const isCompactLayout = width < 840;
  const splitAgenda = width >= 960;
  const mobileAgenda = width < 600;
  const [calendarCollapsed, setCalendarCollapsed] = useState(true);
  const [agendaHeight, setAgendaHeight] = useState(0);
  const eventListRef = useRef<ScrollView>(null);
  const eventOffsetRef = useRef(0);
  const calendarRowHeight = Math.max(44, Math.min(59, Math.floor((agendaHeight - 160) / 6)));
  const calendarMotion = useEventSheetGesture(calendarCollapsed, setCalendarCollapsed, 5 * calendarRowHeight, eventListRef, eventOffsetRef);
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
    Promise.resolve().then(() => {
      setVisibleMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
    });
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
        if (studentMode) return;
        const classList = await measureAsync("screen.calendar.load.classes", () => getClasses());
        if (!alive) return;
        setClasses(classList);
        void (async () => {
          try {
            const planList = await measureAsync("screen.calendar.load.plans", () => getTrainingPlans());
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
  }, [studentMode]);

  useEffect(() => {
    let alive = true;
    if (studentMode || !activeOrganization?.id) {
      Promise.resolve().then(() => {
        setEvents([]);
      });
      return () => {
        alive = false;
      };
    }

    const from = new Date(calendarStart);
    from.setHours(0, 0, 0, 0);
    const to = new Date(calendarEnd);
    to.setHours(23, 59, 59, 999);

    void measureAsync("screen.calendar.load.events", () => listEvents({
      organizationId: activeOrganization.id,
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      userId: session?.user?.id,
    }))
      .then((rows) => {
        if (alive) setEvents(rows);
      })
      .catch(() => {
        if (alive) setEvents([]);
      });

    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, calendarEnd, calendarStart, session?.user?.id, studentMode]);

  const applyTargetHandled = useRef(false);
  useEffect(() => {
    if (!openApply || applyTargetHandled.current) return;
    if (!targetClassId || !targetDate) return;
    const targetClass = classById[targetClassId];
    if (!targetClass) return;
    const unitName = unitLabel(targetClass.unit);
    Promise.resolve().then(() => {
      setUnitFilter(unitName);
    });
    Promise.resolve().then(() => {
      setApplyPickerClassId(targetClassId);
    });
    Promise.resolve().then(() => {
      setApplyPickerDate(targetDate);
    });
    Promise.resolve().then(() => {
      setShowApplyPicker(true);
    });
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
      const classesForDay = (filteredClassesByDay[day] ?? []).filter(cls => !isPaused(calendarPauses.organizationId === activeOrganization?.id ? calendarPauses.rows : [], cls.id, dayKey));
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
        const dotColor = cls.colorKey === "blue" ? colors.primaryBg : classPalette.text;
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
    calendarPauses,
    activeOrganization?.id,
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

  const selectedDay = selectCalendarDay(monthlyCalendarDays, selectedDate);
  const agendaStyles = useMemo(() => StyleSheet.create({
    weekday: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 10, fontWeight: "600" },
    row: { flexDirection: "row", borderTopWidth: 1, borderColor: colors.border },
    firstRow: { borderTopWidth: 0 },
    day: { flex: 1, minWidth: 0, minHeight: mobileAgenda ? calendarRowHeight : isCompactLayout ? 58 : 68, alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 10, backgroundColor: "transparent" },
    otherMonth: { opacity: 0.3 },
    pastDay: { opacity: 0.5 },
    number: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderColor: colors.primaryBg },
    selectedNumber: { backgroundColor: colors.primaryBg },
    todayNumber: { borderWidth: 1 },
    numberText: { color: colors.text, fontSize: 13, fontWeight: "500" },
    emphasizedNumberText: { fontWeight: "700" },
    selectedNumberText: { color: colors.primaryText, fontWeight: "700" },
    markers: { flexDirection: "row", gap: 3, minHeight: 6, alignItems: "center" },
    moreMarkers: { color: colors.muted, fontSize: 8 },
    hint: { color: colors.muted, fontSize: 11, marginTop: 14 },
    events: { width: mobileAgenda ? "100%" : splitAgenda ? 300 : "100%", ...(mobileAgenda ? { flex: 1, minHeight: 0 } : {}) },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    headerText: { gap: 4 },
    title: { color: colors.text, fontSize: 20, fontWeight: "600" },
    count: { color: colors.muted, fontSize: 12 },
    toggle: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    event: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 14, gap: 16, borderBottomWidth: 1, borderColor: colors.border },
    time: { width: 64, gap: 4 },
    timeText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    eventContent: { flex: 1, minWidth: 0, gap: 6 },
    eventTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
    empty: { color: colors.muted, fontSize: 14, paddingVertical: 24 },
  }), [colors, mobileAgenda, calendarRowHeight, isCompactLayout, splitAgenda]);
  const agendaColorStyles = useMemo(() => Object.fromEntries(
    [...new Set(monthlyCalendarDays.flatMap(day => day.agendaItems.map(item => item.dotColor)))].map(color => [color, StyleSheet.create({
      dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color },
      bar: { width: 3, minHeight: 44, alignSelf: "stretch", borderRadius: 2, backgroundColor: color },
    })]),
  ), [monthlyCalendarDays]);

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
    if (studentMode) return;
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
        {(studentMode ? studentLoading : loadingData) ? (
          <ScreenLoadingState />
        ) : (
          <>
          <ScreenPageHeader
            title="Calendário mensal"
            right={headerActions}
            onBack={() => navigateBackOrReplace({ router, fallback: studentMode ? "/student/home" : "/prof/home" })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text style={{ color: colors.text, fontSize: mobileAgenda ? 18 : 20, fontWeight: "600" }}>{monthTitle}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{monthSummaryLabel}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={goToPreviousMonth} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}><GoAtletaIcon name="chevronBack" size={18} color={colors.text} /></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { const now = new Date(); setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(formatIsoDate(now)); }} style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>Hoje</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={goToNextMonth} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}><GoAtletaIcon name="chevronForward" size={18} color={colors.text} /></Pressable>
            </View>
          </ScreenPageHeader>

          <ScrollView
            scrollEnabled={!mobileAgenda}
            style={{ flex: 1, minHeight: 0, ...(Platform.OS === "web" && !mobileAgenda ? { scrollbarGutter: "stable", scrollbarWidth: "thin" } as object : {}) }}
            contentContainerStyle={{
              ...(mobileAgenda ? { flex: 1 } : { flexGrow: 1 }),
              paddingHorizontal: isCompactLayout ? 12 : 16,
              paddingTop: 2,
              paddingBottom: mobileAgenda ? insets.bottom + 12 : 28,
              gap: 10,
            }}
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

            {!studentMode ? <CalendarUnitSelect value={unitFilter} options={unitOptions} onChange={value => { setUnitFilter(value); router.setParams({ unit: value }); }} /> : null}

            <View onLayout={event => setAgendaHeight(event.nativeEvent.layout.height)} style={{ position: "relative", width: "100%", flexDirection: splitAgenda ? "row" : "column", gap: mobileAgenda ? 12 : 20, alignItems: "flex-start", ...(mobileAgenda ? { flex: 1, minHeight: 0, overflow: "hidden" } : {}) }}>
              <View style={{ width: "100%", flex: splitAgenda ? 1 : undefined, minWidth: 0, backgroundColor: colors.card, borderRadius: 16, padding: isCompactLayout ? 12 : 20, borderWidth: 1, borderColor: colors.border, ...(mobileAgenda ? { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, paddingHorizontal: 4, paddingVertical: 0, flexShrink: 0 } : {}) }}>
                <View>
                <View style={{ flexDirection: "row", marginBottom: 8 }}>
                  {MONTH_WEEKDAY_HEADERS.map(label => <Text key={label} style={agendaStyles.weekday}>{label}</Text>)}
                </View>
                {(rows => {
                  const selectedRow = monthlyCalendarRows.findIndex(row => row.some(day => day.dateIso === selectedDay?.dateIso));
                  const onWeekChange = (index: number) => {
                    const next = monthlyCalendarRows[index]?.find(day => day.day === selectedDay?.day);
                    if (next) { setSelectedDate(next.dateIso); if (!next.isCurrentMonth) setVisibleMonth(new Date(next.dateIso + "T00:00:00")); }
                  };
                  if (!mobileAgenda) return rows;
                  if (calendarMotion.nativeMotion) return <NativeCalendarFold rows={rows} selectedRow={selectedRow} rowHeight={calendarRowHeight} motion={calendarMotion.nativeMotion} onWeekChange={onWeekChange} weekActive={calendarCollapsed && !calendarMotion.interacting} />;
                  return calendarCollapsed && !calendarMotion.interacting
                    ? <CalendarWeekPager rowHeight={calendarRowHeight} rows={rows} selectedRow={selectedRow} onChange={onWeekChange} />
                    : <CalendarFold rowHeight={calendarRowHeight} rows={rows} selectedRow={selectedRow} collapsed={false} progress={calendarMotion.progress} />;
                })(monthlyCalendarRows.map((row, index) => <View key={index} style={[agendaStyles.row, !index && agendaStyles.firstRow]}>
                  {row.map(day => {
                    const selected = day.dateIso === selectedDay?.dateIso;
                    return <Pressable key={day.dayKey} accessibilityRole="button" accessibilityLabel={`${day.dateIso}, ${day.countLabel}${day.isToday ? ", hoje" : ""}`} accessibilityState={{ selected }} onPress={() => { setSelectedDate(day.dateIso); if (mobileAgenda) setCalendarCollapsed(true); if (!day.isCurrentMonth) setVisibleMonth(new Date(day.dateIso + "T00:00:00")); }} style={[agendaStyles.day, !selected && !day.isToday && (!day.isCurrentMonth ? agendaStyles.otherMonth : day.isPast ? agendaStyles.pastDay : null)]}>
                      <View style={[agendaStyles.number, selected ? agendaStyles.selectedNumber : day.isToday ? agendaStyles.todayNumber : null]}><Text style={[agendaStyles.numberText, selected ? agendaStyles.selectedNumberText : day.isToday ? agendaStyles.emphasizedNumberText : null]}>{day.dayNumber}</Text></View>
                      <View style={agendaStyles.markers}>{day.agendaItems.slice(0, 3).map(item => <View key={item.id} style={agendaColorStyles[item.dotColor].dot} />)}{day.agendaItems.length > 3 ? <Text style={agendaStyles.moreMarkers}>+{day.agendaItems.length - 3}</Text> : null}</View>
                    </Pressable>;
                  })}
                </View>))}
                {!mobileAgenda ? <Text style={agendaStyles.hint}>Selecione um dia para ver a agenda.</Text> : null}
                </View>
              </View>
              <View style={agendaStyles.events}>
                <CalendarEventSheet mobile={mobileAgenda} collapsed={calendarCollapsed} onCollapsedChange={setCalendarCollapsed} motion={calendarMotion} listRef={eventListRef} offsetRef={eventOffsetRef} header={<View style={agendaStyles.header}>
                  <View style={agendaStyles.headerText}><Text accessibilityRole="header" style={agendaStyles.title}>{selectedDay ? new Date(selectedDay.dateIso + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : "Agenda do dia"}</Text><Text style={agendaStyles.count}>{selectedDay?.countLabel}</Text></View>
                  {mobileAgenda ? <Pressable accessibilityRole="button" accessibilityLabel={calendarCollapsed ? "Mostrar mês completo" : "Mostrar semana"} onPress={() => { setCalendarCollapsed(value => !value); }} style={agendaStyles.toggle}><GoAtletaIcon name="calendar" size={20} color={colors.muted} /></Pressable> : <GoAtletaIcon name="calendar" size={20} color={colors.muted} />}
                </View>}>
                {selectedDay?.agendaItems.length ? selectedDay.agendaItems.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.timeLabel}, ${item.title}`} onPress={() => { if (studentMode && item.kind === "class") { router.push({ pathname: "/student-plan", params: { classId: item.classId, date: item.dateIso } }); return; } if (item.kind === "class") router.push({ pathname: "/class/[id]", params: { id: item.classId, calendarSource: calendarPath === "/prof/calendar" ? "prof" : "shared", calendarDate: item.dateIso, calendarUnit: unitFilter } }); else router.push({ pathname: "/events/[id]", params: { id: item.eventId } }); }} style={agendaStyles.event}>
                  <View style={agendaStyles.time}><Text style={agendaStyles.timeText}>{item.timeLabel.split(" - ")[0]}</Text>{item.timeLabel.includes(" - ") ? <Text style={agendaStyles.count}>{item.timeLabel.split(" - ")[1]}</Text> : null}</View>
                  <View style={agendaColorStyles[item.dotColor].bar} />
                  <View style={agendaStyles.eventContent}><Text style={agendaStyles.eventTitle}>{item.title}</Text><Text style={agendaStyles.count}>{item.kind === "class" ? item.unitLabel : item.subtitle || item.typeLabel}</Text></View>
                  <GoAtletaIcon name="chevronForward" size={14} color={colors.muted} />
                </Pressable>) : <Text style={agendaStyles.empty}>{studentMode ? studentError ? "Não foi possível carregar seus treinos." : "Nenhum treino neste dia." : "Nenhuma aula ou evento neste dia."}</Text>}
                </CalendarEventSheet>
              </View>
            </View>
          </ScrollView>
      </>
        )}
      <ModalSheet
        visible={!studentMode && showApplyPicker}
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
