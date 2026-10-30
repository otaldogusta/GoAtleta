import { requestPendingEditsNavigation } from "../src/navigation/pending-edits-navigation";
import type { EventDraft } from "../src/screens/calendar/application/event-draft";
import { eventCalendarDates } from "../src/screens/calendar/application/event-draft";
import type { ReactNode } from "react";
import { CalendarMonthPicker } from "../src/screens/calendar/CalendarMonthPicker";
import { CalendarUnitSelect } from "../src/screens/calendar/CalendarUnitSelect";
import { CalendarEventSheet } from "../src/screens/calendar/CalendarEventSheet";
import { CalendarClassDetails, type CalendarClassOpenOptions } from "../src/screens/calendar/CalendarClassDetails";
import { useCalendarWheel, useEventSheetGesture } from "../src/screens/calendar/useEventSheetGesture";
import { NativeCalendarFold } from "../src/screens/calendar/NativeCalendarFold";
import { CalendarFold } from "../src/screens/calendar/CalendarFold";
import { selectCalendarDay } from "../src/screens/calendar/application/calendar-selection";
import { listCalendarPauses } from "../src/api/holiday-decisions";
import { isPaused, type CalendarPause } from "../src/core/holidays";
import { markRender, measureAsync } from "../src/observability/perf";
import { useLocalSearchParams, useNavigationContainerRef, usePathname, useRoute, useRouter } from "expo-router";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { OperationalText as Text } from "../src/ui/OperationalText";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "../src/ui/Pressable";

import type { EventListItem } from "../src/api/events";
import { listEvents } from "../src/api/events";
import { useAuth } from "../src/auth/auth";
import { getSessionIdentity } from "../src/auth/session";
import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import { ScreenLoadingState } from "../src/components/ui/ScreenLoadingState";
import type { ClassGroup, TrainingPlan } from "../src/core/models";
import { createTrainingPlanVersion } from "../src/core/training-plan-factory";
import { normalizeUnitKey } from "../src/core/unit-key";
import {
  getClasses,
  getLatestTrainingPlanByClass,
  saveTrainingPlan,
} from "../src/db/seed";
import { getReadCacheGeneration } from "../src/db/client";
import { getCalendarTrainingPlanApplications, getTrainingPlanById, getTrainingPlanSummaries, type CalendarTrainingPlanApplication, type TrainingPlanSummary } from "../src/db/training";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { navigateToDetailRoute } from "../src/navigation/primary-route-navigation";
import { useOrganization } from "../src/providers/organization-context";
import { useAppTheme } from "../src/ui/app-theme";
import { getClassPalette } from "../src/ui/class-colors";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import { ModalSheet } from "../src/ui/ModalSheet";
import { useSaveToast } from "../src/ui/save-toast";
import { toRgba } from "../src/ui/unit-colors";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";
import { compactUiMetrics as metrics } from "../src/theme/tokens";
import { responsiveBreakpoints } from "../src/ui/responsive-layout";

const CalendarEventEditor = lazy(() => import("../src/screens/calendar/CalendarEventEditor").then(module => ({ default: module.CalendarEventEditor })));

const pad2 = (value: number) => String(value).padStart(2, "0");

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay(); // 0=Sun, 1=Mon
  const diff = -day;
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
const MONTH_WEEKDAY_HEADERS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"] as const;
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
type CalendarClassSelection = { scope: string; classId: string; date: string; timeLabel: string; unitLabel: string; accentColor: string; filterUnit: string; source: "prof" | "shared"; originKey?: string };

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

type ScopedCalendarRead<T> = { scope: string; rows: T[]; error: string | null };

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
  const rootNavigationRef = useNavigationContainerRef();
  const calendarRoute = useRoute();
  const calendarPath = usePathname();
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { activeOrganization } = useOrganization();
  const identity = getSessionIdentity();
  const readGeneration = getReadCacheGeneration();
  const readScope = JSON.stringify([identity.userId, identity.generation, readGeneration, activeOrganization?.id]);
  const isCurrentRead = useCallback(() => {
    const current = getSessionIdentity();
    return current.userId === identity.userId && current.generation === identity.generation && getReadCacheGeneration() === readGeneration;
  }, [identity.userId, identity.generation, readGeneration]);
  const [calendarPauses, setCalendarPauses] = useState<{ scope: string; rows: CalendarPause[] }>({ scope: "", rows: [] });
  const [pauseRevision, setPauseRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    const organizationId = activeOrganization?.id;
    if (studentMode || !organizationId) return;
    void listCalendarPauses(organizationId).then(rows => {
      if (alive && isCurrentRead()) setCalendarPauses({ scope: readScope, rows });
    }).catch(() => { /* Keep the last verified calendar; retry on organization change. */ });
    return () => { alive = false; };
  }, [activeOrganization?.id, readScope, isCurrentRead, studentMode, pauseRevision]);

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
  const canManageEvents = !studentMode && (activeOrganization?.role_level ?? 0) >= 50;
  const [eventEditor, setEventEditor] = useState<{ scope: string; date: string; event?: EventListItem; seed?: EventDraft; resumeId?: string; instanceId?: number } | null>(null);
  const eventEditorSequence = useRef(0);
  const [classDetails, setClassDetails] = useState<CalendarClassSelection | null>(null);
  if (classDetails && classDetails.scope !== readScope) setClassDetails(null);
  const [quickAdd, setQuickAdd] = useState<{ scope: string; date: string } | null>(null);
  const [eventRevision, setEventRevision] = useState(0);
  const [monthPickerScope, setMonthPickerScope] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [classSnapshot, setClassSnapshot] = useState<ScopedCalendarRead<ClassGroup>>({ scope: "", rows: [], error: null });
  const classes = useMemo(() => studentClasses ?? (classSnapshot.scope === readScope ? classSnapshot.rows : []), [studentClasses, classSnapshot, readScope]);
  const loadingData = Boolean(activeOrganization?.id) && classSnapshot.scope !== readScope;
  const classesError = classSnapshot.scope === readScope ? classSnapshot.error : null;
  const [planSnapshot, setPlanSnapshot] = useState<ScopedCalendarRead<CalendarTrainingPlanApplication>>({ scope: "", rows: [], error: null });
  const [eventSnapshot, setEventSnapshot] = useState<ScopedCalendarRead<EventListItem>>({ scope: "", rows: [], error: null });
  const events = useMemo(() => !studentMode && eventSnapshot.scope === readScope ? eventSnapshot.rows : [], [eventSnapshot, readScope, studentMode]);
  const eventsError = eventSnapshot.scope === readScope ? eventSnapshot.error : null;
  const [pickerSnapshot, setPickerSnapshot] = useState<ScopedCalendarRead<TrainingPlanSummary>>({ scope: "", rows: [], error: null });
  const applyRequestSequence = useRef(0);
  const applyRequestPending = useRef(false);
  const [applyPending, setApplyPending] = useState<{ scope: string; id: string } | null>(null);
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
  const mobileAgenda = width < responsiveBreakpoints.workspace;
  const [calendarCollapsed, setCalendarCollapsed] = useState(true);
  const [agendaHeight, setAgendaHeight] = useState(0);
  const eventListRef = useRef<ScrollView>(null);
  const eventOffsetRef = useRef(0);
  const calendarWeekCount = Math.ceil((new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()) / 7);
  const calendarRowHeight = Math.max(40, Math.min(46, Math.floor((agendaHeight - 300) / calendarWeekCount)));
  const calendarMotion = useEventSheetGesture(calendarCollapsed, setCalendarCollapsed, (calendarWeekCount - 1) * calendarRowHeight, eventListRef, eventOffsetRef);
  const calendarGridRef = useRef<View>(null);
  useCalendarWheel(calendarGridRef, calendarMotion.wheel);
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
  const planRangeStart = formatIsoDate(calendarStart);
  const planRangeEnd = formatIsoDate(calendarEnd);
  const planScope = JSON.stringify([readScope, planRangeStart, planRangeEnd]);
  const currentPlanScopeRef = useRef(planScope);
  useEffect(() => { currentPlanScopeRef.current = planScope; }, [planScope]);
  const plans = useMemo(() => !studentMode && planSnapshot.scope === planScope ? planSnapshot.rows : [], [planSnapshot, planScope, studentMode]);
  const plansError = planSnapshot.scope === planScope ? planSnapshot.error : null;
  const loadingPlans = !studentMode && Boolean(activeOrganization?.id) && planSnapshot.scope !== planScope;
  const goToPreviousMonth = useCallback(() => {
    requestPendingEditsNavigation(() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)));
  }, []);
  const goToNextMonth = useCallback(() => {
    requestPendingEditsNavigation(() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)));
  }, []);

  useEffect(() => {
    if (!targetDate) return;
    const seed = new Date(targetDate + "T00:00:00");
    if (Number.isNaN(seed.getTime())) return;
    Promise.resolve().then(() => {
      setVisibleMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
      setSelectedDate(targetDate);
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
  const classDetailsOwner = useRef({ scope: readScope, selection: classDetails, classes: classById, canManage: canManageEvents });
  useLayoutEffect(() => { classDetailsOwner.current = { scope: readScope, selection: classDetails, classes: classById, canManage: canManageEvents }; }, [readScope, classDetails, classById, canManageEvents]);
  const openSelectedClass = (selection: CalendarClassSelection, options?: CalendarClassOpenOptions) => {
    const owner = classDetailsOwner.current;
    if (owner.scope !== selection.scope || owner.selection !== selection || !owner.classes[selection.classId] || !isCurrentRead()) return;
    if (options?.settings && !owner.canManage) return;
    classDetailsOwner.current = { ...owner, selection: null };
    setClassDetails(null);
    // Persist the clicked occurrence before the shared shell opens/remounts its class route.
    if (Platform.OS === "web") router.setParams({ targetDate: selection.date, unit: selection.filterUnit });
    navigateToDetailRoute({ router, navigationState: () => rootNavigationRef.current?.getRootState(), href: { pathname: "/class/[id]", params: { id: selection.classId, date: selection.date, calendarSource: selection.source, calendarDate: selection.date, calendarUnit: selection.filterUnit, ...(selection.originKey ? { calendarOriginKey: selection.originKey } : {}), ...(options?.settings === "1" ? { settings: "1", settingsSection: options.settingsSection ?? "basics" } : {}) } } });
  };
  const duplicateEventDraft = (seed: EventDraft) => {
    const owner = classDetailsOwner.current;
    if (owner.scope !== readScope || !owner.canManage || !isCurrentRead()) return;
    setClassDetails(null);
    classDetailsOwner.current = { ...owner, selection: null };
    setEventEditor({ scope: readScope, date: seed.startDate, seed, instanceId: ++eventEditorSequence.current });
  };
  const changeSelectedClass = (selection: CalendarClassSelection) => {
    const owner = classDetailsOwner.current;
    if (owner.scope !== selection.scope || owner.selection !== selection || !owner.canManage || !isCurrentRead()) return;
    setCalendarPauses(current => ({ scope: readScope, rows: [...(current.scope === readScope ? current.rows : []).filter(item => item.class_id !== selection.classId || item.date !== selection.date), { class_id: selection.classId, date: selection.date }] }));
    setPauseRevision(value => value + 1);
  };
  useEffect(() => {
    let alive = true;
    const organizationId = activeOrganization?.id;
    if (studentMode || !organizationId) return;
    (async () => {
      try {
        const rows = await measureAsync("screen.calendar.load.classes", () => getClasses({ organizationId }));
        if (alive && isCurrentRead()) setClassSnapshot({ scope: readScope, rows, error: null });
      } catch {
        if (alive && isCurrentRead()) setClassSnapshot({ scope: readScope, rows: [], error: "Não foi possível carregar as turmas." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, readScope, isCurrentRead, studentMode]);

  useEffect(() => {
    const organizationId = activeOrganization?.id;
    if (studentMode || !organizationId) return;
    const controller = new AbortController();
    void measureAsync("screen.calendar.load.plans", () => getCalendarTrainingPlanApplications({
      organizationId, startDate: planRangeStart, endDate: planRangeEnd, signal: controller.signal,
    })).then(rows => {
      if (!controller.signal.aborted && isCurrentRead()) setPlanSnapshot({ scope: planScope, rows, error: null });
    }).catch(() => {
      if (!controller.signal.aborted && isCurrentRead()) setPlanSnapshot({ scope: planScope, rows: [], error: "Não foi possível carregar os planejamentos." });
    });
    return () => controller.abort();
  }, [activeOrganization?.id, planRangeStart, planRangeEnd, planScope, isCurrentRead, studentMode]);

  useEffect(() => {
    let alive = true;
    if (studentMode || !activeOrganization?.id) {
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
      overlap: true,
      userId: session?.user?.id,
    }))
      .then((rows) => {
        if (alive && isCurrentRead()) setEventSnapshot({ scope: readScope, rows, error: null });
      })
      .catch(() => {
        if (alive && isCurrentRead()) setEventSnapshot({ scope: readScope, rows: [], error: "Não foi possível carregar os eventos." });
      });

    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, calendarEnd, calendarStart, session?.user?.id, readScope, isCurrentRead, studentMode, eventRevision]);

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
        byDate: Record<string, CalendarTrainingPlanApplication>;
        byWeekday: Record<number, CalendarTrainingPlanApplication>;
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
      for (const dateKey of eventCalendarDates(event, calendarStart, calendarEnd)) {
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(event);
      }
    });
    Object.values(grouped).forEach((items) => {
      items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    });
    return grouped;
  }, [visibleEvents, calendarStart, calendarEnd]);

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
      const classesForDay = (filteredClassesByDay[day] ?? []).filter(cls => !isPaused(calendarPauses.scope === readScope ? calendarPauses.rows : [], cls.id, dayKey));
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
    readScope,
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
    return rows.filter(row => row.some(day => day.isCurrentMonth));
  }, [monthlyCalendarDays]);

  const selectedDay = selectCalendarDay(monthlyCalendarDays, selectedDate);
  const searchText = searchQuery.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const displayedItems = searchText ? monthlyCalendarDays.filter(day => day.isCurrentMonth).flatMap(day => day.agendaItems).filter(item =>
    `${item.title} ${item.kind === "class" ? item.unitLabel : item.subtitle || item.typeLabel}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(searchText)
  ) : selectedDay?.agendaItems ?? [];
  const agendaStyles = useMemo(() => StyleSheet.create({
    weekday: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 10, fontWeight: "600" },
    row: { flexDirection: "row", gap: 3 },
    firstRow: { borderTopWidth: 0 },
    day: { flex: 1, minWidth: 0, height: calendarRowHeight, alignItems: "center", justifyContent: "flex-start", paddingTop: 2, gap: 2, borderRadius: 7, borderWidth: 1, borderColor: "transparent", backgroundColor: "transparent" },
    selectedDay: { borderColor: "transparent" },
    otherMonth: { opacity: 0.3 },
    pastDay: { opacity: 0.8 },
    number: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderColor: colors.primaryBg },
    selectedNumber: { backgroundColor: colors.text },
    todayNumber: { borderWidth: 1 },
    numberText: { color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "500" },
    emphasizedNumberText: { fontWeight: "700" },
    selectedNumberText: { color: colors.background, fontWeight: "700" },
    markers: { flexDirection: "row", justifyContent: "center", gap: 3, height: 8 },
    sunday: { color: colors.dangerText },
    moreMarkers: { color: colors.muted, fontSize: 8 },
    hint: { color: colors.muted, fontSize: 11, marginTop: 14 },
    events: { width: "100%", flex: 1, minHeight: 0 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    headerText: { gap: 4 },
    monthTrigger: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
    monthLabel: { flexShrink: 1 },
    monthMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    monthYear: { color: colors.muted, fontSize: 10 },
    monthPending: { width: 14, height: 14 },
    composerDock: { paddingTop: 8, paddingBottom: Math.max(8, insets.bottom), paddingHorizontal: 8, backgroundColor: colors.background },
    quickAdd: { width: "100%", maxWidth: 360, alignSelf: "center", minHeight: metrics.touchTarget, paddingLeft: 12, paddingRight: 2, borderRadius: 22, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" },
    quickTrigger: { flex: 1, minHeight: metrics.touchTarget, justifyContent: "center" },
    quickDetails: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
    quickAddText: { color: colors.muted, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight },
    title: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "700" },
    dayHeading: { flexDirection: "row", alignItems: "center", gap: metrics.gap },
    weekdayHeading: { color: colors.text, fontSize: metrics.metadataFontSize, fontWeight: "700" },
    count: { color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight },
    toggle: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    event: { flexDirection: "row", alignItems: "flex-start", minHeight: 48, paddingVertical: metrics.gap, paddingHorizontal: metrics.smallGap, borderRadius: 8, gap: metrics.gap },
    time: { width: 42, gap: 2 },
    timeText: { color: colors.text, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight, fontWeight: "600" },
    eventContent: { flex: 1, minWidth: 0, gap: 2 },
    eventTitle: { color: colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "600" },
    empty: { color: colors.muted, fontSize: metrics.bodyFontSize, paddingVertical: 16 },
  }), [colors, calendarRowHeight, insets.bottom]);
  const agendaColorStyles = useMemo(() => Object.fromEntries(
    [...new Set(monthlyCalendarDays.flatMap(day => day.agendaItems.map(item => item.dotColor)))].map(color => [color, StyleSheet.create({
      dot: { height: 4, width: 4, borderRadius: 2, backgroundColor: color },
      cell: { backgroundColor: toRgba(color, 0.1) },
      bar: { width: 2, minHeight: 28, alignSelf: "stretch", borderRadius: 1, backgroundColor: color },
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

  const selectedApplyClass = applyPickerClassId
    ? classById[applyPickerClassId]
    : null;
  const applyFilterUnit = selectedApplyClass
    ? unitLabel(selectedApplyClass.unit)
    : "";
  const applyFilterUnitKey = normalizeUnitKey(applyFilterUnit);
  const applyFilterAge = selectedApplyClass?.ageBand ?? "";
  const compatibleApplyClassIds = useMemo(() => selectedApplyClass ? classes.filter(cls =>
    unitKey(cls.unit) === applyFilterUnitKey && cls.ageBand === applyFilterAge,
  ).map(cls => cls.id).sort() : [], [selectedApplyClass, classes, unitKey, applyFilterUnitKey, applyFilterAge]);
  const pickerScope = JSON.stringify([readScope, compatibleApplyClassIds]);
  const applyContext = JSON.stringify([pickerScope, showApplyPicker, applyPickerClassId, applyPickerDate]);
  const currentApplyContext = useRef(applyContext);
  useLayoutEffect(() => {
    currentApplyContext.current = applyContext;
    return () => {
      applyRequestSequence.current += 1;
      applyRequestPending.current = false;
    };
  }, [applyContext]);
  const applyingPlanId = applyPending?.scope === applyContext ? applyPending.id : null;
  const loadingApplyPlans = showApplyPicker && pickerSnapshot.scope !== pickerScope;
  const applyPlansError = pickerSnapshot.scope === pickerScope ? pickerSnapshot.error : null;
  const sortedPlans = useMemo(() => pickerSnapshot.scope === pickerScope ? pickerSnapshot.rows
    .slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [], [pickerSnapshot, pickerScope]);
  useEffect(() => {
    const organizationId = activeOrganization?.id;
    if (studentMode || !showApplyPicker || !organizationId || !compatibleApplyClassIds.length) return;
    const controller = new AbortController();
    void measureAsync("screen.calendar.load.applyPlans", () => getTrainingPlanSummaries({
      organizationId, classIds: compatibleApplyClassIds, signal: controller.signal,
    })).then(rows => {
      if (!controller.signal.aborted && isCurrentRead()) setPickerSnapshot({ scope: pickerScope, rows, error: null });
    }).catch(() => {
      if (!controller.signal.aborted && isCurrentRead()) setPickerSnapshot({ scope: pickerScope, rows: [], error: "Não foi possível carregar os planos disponíveis." });
    });
    return () => controller.abort();
  }, [activeOrganization?.id, showApplyPicker, compatibleApplyClassIds, pickerScope, isCurrentRead, studentMode]);
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
    applyRequestSequence.current += 1;
    applyRequestPending.current = false;
    setApplyPending(null);
    setShowApplyPicker(false);
    setApplyPickerClassId("");
    setApplyPickerDate("");
  };

  const applyPlanToDay = async (summary: TrainingPlanSummary) => {
    if (studentMode) return;
    const organizationId = activeOrganization?.id;
    if (!applyPickerClassId || !applyPickerDate || !organizationId || !isCurrentRead() || applyRequestPending.current) return;
    const targetClassId = applyPickerClassId;
    const targetDate = applyPickerDate;
    const request = ++applyRequestSequence.current;
    applyRequestPending.current = true;
    setApplyPending({ scope: applyContext, id: summary.id });
    const isCurrentSelection = () => request === applyRequestSequence.current &&
      currentApplyContext.current === applyContext && isCurrentRead();
    try {
      const plan = await getTrainingPlanById(summary.id, { organizationId });
      if (!isCurrentSelection()) return;
      if (!plan || plan.id !== summary.id || !compatibleApplyClassIds.includes(plan.classId)) {
        showSaveToast({ message: "O planejamento não está disponível para esta turma.", variant: "warning" });
        return;
      }
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
      if (!isCurrentSelection()) return;
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
      await saveTrainingPlan(updated, { organizationId });
      if (!isCurrentSelection()) return;
      setPlanSnapshot((current) => {
        if (currentPlanScopeRef.current !== planScope) return current;
        const application: CalendarTrainingPlanApplication = {
          id: updated.id, classId: updated.classId, applyDate: updated.applyDate,
          applyDays: updated.applyDays, createdAt: updated.createdAt,
        };
        const rows = [...(current.scope === planScope ? current.rows : []), application];
        return { scope: planScope, rows: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), error: null };
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
    } catch {
      if (isCurrentSelection()) showSaveToast({ message: "Não foi possível aplicar o planejamento.", variant: "error" });
    } finally {
      if (request === applyRequestSequence.current) {
        applyRequestPending.current = false;
        setApplyPending(null);
      }
    }
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

    const quickAddBar = <View style={agendaStyles.quickAdd}>
        <Pressable suppressWebHoverFeedback disableWebPressScale disabled={quickAdd?.scope === readScope} accessibilityRole="button" accessibilityLabel="Adicionar evento rápido" onPress={() => setQuickAdd({ scope: readScope, date: selectedDay?.dateIso ?? selectedDate })} style={agendaStyles.quickTrigger}><Text style={agendaStyles.quickAddText}>Adicionar em {new Date((selectedDay?.dateIso ?? selectedDate) + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</Text></Pressable>
        <Pressable disabled={quickAdd?.scope === readScope} accessibilityRole="button" accessibilityLabel="Criar evento com detalhes" onPress={() => setEventEditor({ scope: readScope, date: selectedDay?.dateIso ?? selectedDate })} style={agendaStyles.quickDetails}><GoAtletaIcon name="add" size={20} color={colors.text} /></Pressable>
      </View>;
    const quickFooter = canManageEvents ? <View style={agendaStyles.composerDock}>
      {quickAdd?.scope === readScope ? <Suspense fallback={quickAddBar}><CalendarEventEditor key={`${quickAdd.scope}-${quickAdd.date}`} quick date={quickAdd.date} classes={classes} suggestedTimes={(selectedDay?.agendaItems ?? []).map(item => item.timeLabel.split(" - ")[0])} onClose={() => setQuickAdd(null)} onSaved={() => setEventRevision(value => value + 1)} onExpand={(seed, resumeId) => { setEventEditor({ scope: readScope, date: quickAdd.date, seed, resumeId }); setQuickAdd(null); }} /></Suspense> : quickAddBar}
    </View> : null;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {(studentMode ? studentLoading : loadingData) ? (
          <ScreenLoadingState />
        ) : (
          <>
          {!mobileAgenda ? <ScreenPageHeader title="Agenda" horizontalBleed={0} right={headerActions} onBack={() => navigateBackOrReplace({ router, fallback: studentMode ? "/student/home" : calendarPath.startsWith("/coord") ? "/coord/dashboard" : "/prof/home" })} /> : null}
          <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", paddingHorizontal: 12, paddingTop: mobileAgenda ? 6 : 0, paddingBottom: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
            {mobileAgenda ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar de Agenda" onPress={() => navigateBackOrReplace({ router, fallback: studentMode ? "/student/home" : calendarPath.startsWith("/coord") ? "/coord/dashboard" : "/prof/home" })} style={agendaStyles.toggle}><GoAtletaIcon name="chevronBack" size={20} color={colors.text} /></Pressable> : null}
            <Pressable suppressWebHoverFeedback accessibilityRole="button" accessibilityHint={monthSummaryLabel} accessibilityLabel="Escolher mês e ano" onPress={() => setMonthPickerScope(readScope)} style={agendaStyles.monthTrigger}><View style={agendaStyles.monthLabel}><Text numberOfLines={1} style={agendaStyles.title}>{visibleMonth.toLocaleDateString("pt-BR", { month: "long" })}</Text><View style={agendaStyles.monthMeta}><Text style={agendaStyles.monthYear}>{visibleMonth.getFullYear()}</Text><View style={agendaStyles.monthPending}>{loadingPlans ? <ActivityIndicator accessibilityLabel="Atualizando agenda" size={12} color={colors.muted} /> : null}</View></View></View><GoAtletaIcon name="chevronDown" size={12} color={colors.muted} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Pesquisar na agenda" onPress={() => { setSearchOpen(value => !value); setSearchQuery(""); }} style={agendaStyles.toggle}><GoAtletaIcon name="search" size={metrics.iconSize} color={colors.text} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Hoje" onPress={() => requestPendingEditsNavigation(() => { setSearchQuery(""); const now = new Date(); setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(formatIsoDate(now)); })} style={agendaStyles.toggle}><View style={{ width: 22, height: 23, borderWidth: 1.5, borderColor: colors.text, borderRadius: 4, alignItems: "center", justifyContent: "flex-end", paddingBottom: 1 }}><View style={{ position: "absolute", top: 5, width: "100%", borderTopWidth: 1.5, borderColor: colors.text }} /><Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>{new Date().getDate()}</Text></View></Pressable>
          </View>

          {classesError || plansError || eventsError ? (
            <Text accessibilityRole="alert" style={{ color: colors.dangerText, paddingHorizontal: 16, paddingBottom: 8 }}>
              {[classesError, plansError, eventsError].filter(Boolean).join(" ")}
            </Text>
          ) : null}

          <ScrollView
            scrollEnabled={false}
            style={{ flex: 1, minHeight: 0, ...(Platform.OS === "web" && !mobileAgenda ? { scrollbarGutter: "stable", scrollbarWidth: "thin" } as object : {}) }}
            contentContainerStyle={{
              flex: 1,
              width: "100%", maxWidth: 440, alignSelf: "center",
              paddingHorizontal: 12,
              paddingTop: 2,
              paddingBottom: 8,
              gap: 4,
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

            {searchOpen ? <View style={{ minHeight: 50, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.inputBg, flexDirection: "row", alignItems: "center", gap: 8 }}><GoAtletaIcon name="search" size={18} color={colors.muted} /><TextInput autoFocus accessibilityLabel="Pesquisar neste mês" placeholder="Pesquisar neste mês" placeholderTextColor={colors.muted} value={searchQuery} onChangeText={setSearchQuery} style={{ flex: 1, minWidth: 0, color: colors.text, borderRadius: 0, fontSize: 14 }} /><Pressable accessibilityRole="button" accessibilityLabel="Fechar pesquisa" onPress={() => { setSearchOpen(false); setSearchQuery(""); }} style={agendaStyles.toggle}><GoAtletaIcon name="close" size={18} color={colors.text} /></Pressable></View> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ flex: 1, minWidth: 0 }}>{!studentMode ? <CalendarUnitSelect compact value={unitFilter} options={unitOptions} onChange={value => { setUnitFilter(value); router.setParams({ unit: value, ...(Platform.OS === "web" ? { targetDate: selectedDay?.dateIso ?? selectedDate } : {}) }); }} /> : null}</View>
              {mobileAgenda ? headerActions : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={goToPreviousMonth} style={agendaStyles.toggle}><GoAtletaIcon name="chevronBack" size={16} color={colors.muted} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={goToNextMonth} style={agendaStyles.toggle}><GoAtletaIcon name="chevronForward" size={16} color={colors.muted} /></Pressable>
            </View>

            <View onLayout={event => setAgendaHeight(event.nativeEvent.layout.height)} style={{ position: "relative", width: "100%", flexDirection: "column", gap: 4, alignItems: "flex-start", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <View ref={calendarGridRef} tabIndex={Platform.OS === "web" ? 0 : undefined} accessibilityLabel={calendarCollapsed ? "Calendário semanal. Enter para expandir o mês." : "Calendário mensal. Enter para recolher para a semana."} {...(Platform.OS === "web" ? { onKeyDown: (event: { key: string; target: unknown; currentTarget: unknown; preventDefault: () => void }) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setCalendarCollapsed(value => !value); } } } : {})} style={{ width: "100%", minWidth: 0, paddingHorizontal: 4, flexShrink: 0 }}>
                <View>
                <View style={{ flexDirection: "row", marginBottom: 4 }}>
                  {MONTH_WEEKDAY_HEADERS.map((label, index) => <Text key={label} style={[agendaStyles.weekday, index === 0 && agendaStyles.sunday]}>{label}</Text>)}
                </View>
                {(rows => {
                  const selectedRow = monthlyCalendarRows.findIndex(row => row.some(day => day.dateIso === selectedDay?.dateIso));
                  const onWeekChange = (index: number) => {
                    const next = monthlyCalendarRows[index]?.find(day => day.day === selectedDay?.day);
                    if (next) requestPendingEditsNavigation(() => { setSelectedDate(next.dateIso); if (!next.isCurrentMonth) setVisibleMonth(new Date(next.dateIso + "T00:00:00")); });
                  };
                  if (calendarMotion.nativeMotion) return <NativeCalendarFold rows={rows} selectedRow={selectedRow} rowHeight={calendarRowHeight} motion={calendarMotion.nativeMotion} onWeekChange={onWeekChange} weekActive={calendarCollapsed && !calendarMotion.interacting} />;
                  return <CalendarFold rowHeight={calendarRowHeight} rows={rows} selectedRow={selectedRow} collapsed={calendarCollapsed} progress={calendarMotion.progress} onWeekChange={onWeekChange} weekActive={calendarCollapsed && !calendarMotion.interacting} />;
                })(monthlyCalendarRows.map((row, index) => <View key={index} style={[agendaStyles.row, !index && agendaStyles.firstRow]}>
                  {row.map(day => {
                    const selected = day.dateIso === selectedDay?.dateIso;
                    return <Pressable key={day.dayKey} accessibilityRole="button" accessibilityLabel={`${day.dateIso}, ${day.countLabel}${day.isToday ? ", hoje" : ""}`} accessibilityState={{ selected }} onPress={() => requestPendingEditsNavigation(() => { setSelectedDate(day.dateIso); if (mobileAgenda) setCalendarCollapsed(true); if (!day.isCurrentMonth) setVisibleMonth(new Date(day.dateIso + "T00:00:00")); })} style={[agendaStyles.day, selected && agendaStyles.selectedDay, !selected && !day.isToday && (!day.isCurrentMonth ? agendaStyles.otherMonth : day.isPast ? agendaStyles.pastDay : null)]}>
                      <View style={[agendaStyles.number, selected ? agendaStyles.selectedNumber : day.isToday ? agendaStyles.todayNumber : null]}><Text style={[agendaStyles.numberText, day.day === 0 && agendaStyles.sunday, selected ? agendaStyles.selectedNumberText : day.isToday ? agendaStyles.emphasizedNumberText : null]}>{day.dayNumber}</Text></View>
                      <View style={agendaStyles.markers}>{day.agendaItems.slice(0, 4).map(item => <View key={item.id} style={agendaColorStyles[item.dotColor].dot} />)}</View>
                    </Pressable>;
                  })}
                </View>))}
                </View>
              </View>
              <View style={agendaStyles.events}>
                <CalendarEventSheet mobile={mobileAgenda} collapsed={calendarCollapsed} onCollapsedChange={setCalendarCollapsed} motion={calendarMotion} listRef={eventListRef} offsetRef={eventOffsetRef} footer={searchText && quickAdd?.scope !== readScope ? null : quickFooter} header={<View style={agendaStyles.header}>
                  {searchText ? <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{displayedItems.length} resultados neste mês</Text> : <View style={agendaStyles.headerText}><View style={agendaStyles.dayHeading}><Text accessibilityRole="header" accessibilityLabel={selectedDay ? new Date(selectedDay.dateIso + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : "Agenda do dia"} style={agendaStyles.title}>{selectedDay ? new Date(selectedDay.dateIso + "T00:00:00").getDate() : ""}</Text><Text style={agendaStyles.weekdayHeading}>{selectedDay ? new Date(selectedDay.dateIso + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase() : "Agenda do dia"}</Text><Text style={agendaStyles.count}>{selectedDay?.countLabel}</Text></View></View>}
                </View>}>
                {displayedItems.length ? displayedItems.map(item => <View key={`${item.dateIso}-${item.id}`} style={{ borderBottomWidth: 1, borderColor: colors.border }}><Pressable accessibilityRole="button" accessibilityLabel={`${searchText ? item.dateIso + ", " : ""}${item.timeLabel}, ${item.title}`} onPress={() => {
                  if (!studentMode && item.kind === "event") {
                    const event = events.find(row => row.id === item.eventId);
                    if (event) setEventEditor({ scope: readScope, date: item.dateIso, event });
                    return;
                  }
                  if (!studentMode && item.kind === "class") {
                    setClassDetails({ scope: readScope, classId: item.classId, date: item.dateIso, timeLabel: item.timeLabel, unitLabel: item.unitLabel, accentColor: item.dotColor, filterUnit: unitFilter, source: calendarPath === "/prof/calendar" ? "prof" : "shared", ...(Platform.OS === "web" ? { originKey: calendarRoute.key } : {}) });
                    return;
                  }
                  // The shared web shell may remount this screen without changing its route key.
                  if (studentMode && item.kind === "class") { router.push({ pathname: "/student-plan", params: { classId: item.classId, date: item.dateIso } }); return; }
                  if (Platform.OS === "web") router.setParams({ targetDate: item.dateIso, unit: unitFilter });
                  if (item.kind === "event") navigateToDetailRoute({ router, navigationState: () => rootNavigationRef.current?.getRootState(), href: { pathname: "/events/[id]", params: { id: item.eventId } } });
                }} style={agendaStyles.event}>
                  <View style={agendaStyles.time}><Text style={agendaStyles.timeText}>{item.timeLabel.split(" - ")[0]}</Text>{item.timeLabel.includes(" - ") ? <Text style={agendaStyles.count}>{item.timeLabel.split(" - ")[1]}</Text> : null}</View>
                  <View style={agendaColorStyles[item.dotColor].bar} />
                  <View style={agendaStyles.eventContent}>{searchText ? <Text style={agendaStyles.count}>{new Date(item.dateIso + "T00:00:00").toLocaleDateString("pt-BR")}</Text> : null}<Text numberOfLines={1} style={agendaStyles.eventTitle}>{item.title}</Text><Text numberOfLines={1} style={agendaStyles.count}>{item.kind === "class" ? item.unitLabel : item.subtitle || item.typeLabel}</Text></View>
                  <GoAtletaIcon name="chevronForward" size={14} color={colors.muted} />
                </Pressable></View>) : <Text style={agendaStyles.empty}>{searchText ? "Nenhum resultado neste mês." : studentMode ? studentError ? "Não foi possível carregar seus treinos." : "Nenhum treino neste dia." : "Nenhuma aula ou evento neste dia."}</Text>}

                </CalendarEventSheet>
              </View>
            </View>
          </ScrollView>
      </>
        )}
      <CalendarMonthPicker visible={monthPickerScope === readScope} value={selectedDay?.dateIso ?? selectedDate} onClose={() => setMonthPickerScope(null)} onChange={value => requestPendingEditsNavigation(() => { setSelectedDate(value); setVisibleMonth(new Date(value + "T00:00:00")); })} />
      {!studentMode && eventEditor?.scope === readScope ? <Suspense fallback={null}><CalendarEventEditor key={`${eventEditor.scope}-${eventEditor.instanceId ?? eventEditor.event?.id ?? eventEditor.date}`} date={eventEditor.date} event={eventEditor.event} seed={eventEditor.seed} resumeId={eventEditor.resumeId} classes={classes} onClose={() => setEventEditor(null)} onSaved={() => setEventRevision(value => value + 1)} onDuplicate={duplicateEventDraft} /></Suspense> : null}
      {!studentMode && classDetails?.scope === readScope && classById[classDetails.classId] ? <CalendarClassDetails key={`${classDetails.scope}-${classDetails.classId}-${classDetails.date}`} classGroup={classById[classDetails.classId]} date={classDetails.date} timeLabel={classDetails.timeLabel} unitLabel={classDetails.unitLabel} accentColor={classDetails.accentColor} onClose={() => setClassDetails(null)} onOpenClass={options => openSelectedClass(classDetails, options)} onDuplicate={seed => { if (classDetailsOwner.current.selection === classDetails) duplicateEventDraft(seed); }} onChanged={() => changeSelectedClass(classDetails)} /> : null}
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
              {loadingApplyPlans ? <ScreenLoadingState /> : applyPlansError ? (
                <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{applyPlansError}</Text>
              ) : filteredApplyPlans.length ? (
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
                        disabled={Boolean(applyingPlanId)}
                        onPress={() => { void applyPlanToDay(plan); }}
                        style={({ pressed }) => [
                          {
                            marginTop: 6,
                            paddingVertical: 8,
                            borderRadius: 10,
                            alignItems: "center",
                            backgroundColor: colors.primaryBg,
                            opacity: applyingPlanId ? 0.55 : 1,
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
                          {applyingPlanId === plan.id ? "Aplicando..." : "Aplicar na aula do dia"}
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
