import * as Clipboard from "expo-clipboard";

import { Link, useFocusEffect, useRouter } from "expo-router";

import { Image } from "expo-image";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    Suspense,
    lazy,
    useCallback,
    useEffect,
    useMemo,

    useRef,

    useState
} from "react";

import {
    Animated,

    FlatList,
    PanResponder,

    Platform,

    ScrollView,
    Text,

    View,
    useWindowDimensions
} from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "../../ui/Pressable";

import { EventListItem, listUpcomingEvents } from "../../api/events";
import { getMyProfilePhoto, setMyProfilePhoto } from "../../api/profile-photo";
import { uploadMyProfilePhoto } from "../../api/profile-photo-storage";



import type { ClassGroup } from "../../core/models";

import { useAuth } from "../../auth/auth";

import { useRole } from "../../auth/role";
import { useEffectiveProfile } from "../../hooks/use-effective-profile";

import { useSmartSync } from "../../hooks/use-smart-sync";

import {
    getClasses,

    seedIfEmpty,
} from "../../db/seed";

import { requestNotificationPermission } from "../../notifications";

import {
    AppNotification,

    clearNotifications,

    getNotifications,

    markAllRead,
    markNotificationRead,

    subscribeNotifications,
} from "../../notificationsInbox";
import { notificationScopeForEffectiveProfile } from "../../notifications/inbox-scope";

import { useOrganization } from "../../providers/OrganizationProvider";


import { SyncStatusBadge } from "../../ui/SyncStatusBadge";


import { ScreenLoadingState } from "../../components/ui/ScreenLoadingState";
import { SectionLoadingState } from "../../components/ui/SectionLoadingState";
import { ShimmerBlock } from "../../ui/Shimmer";

import { useAppTheme } from "../../ui/app-theme";
import { AppRefreshControl } from "../../ui/AppRefreshControl";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useNativeSidebarController } from "../../ui/native-sidebar-controller";

import { getScopedProfilePath } from "../../navigation/profile-routes";
import { markRender, measureAsync } from "../../observability/perf";
import { useSaveToast } from "../../ui/save-toast";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { AgendaCard } from "./components/AgendaCard";
import { CurrentLessonCarousel } from "./components/CurrentLessonCarousel";
import { useHorizontalGestureArbitration } from "./components/horizontal-gesture-arbitration";
import {
  resolveHomeScheduleRequestKey,
  shouldShowInitialHomeLoading,
} from "./home-loading-state";
import { TodayScheduleRail } from "./components/TodayScheduleRail";
import { WeekDaySelector } from "./components/WeekDaySelector";
import type { HomeScheduleItem } from "./components/homeScheduleTypes";
import { buildClassAttendanceWorkspaceHref } from "../classes/class-workspace-route";
const HomeProfessorBelowFold = lazy(() =>
  import("./HomeProfessorBelowFold").then((module) => ({
    default: module.HomeProfessorBelowFold,
  }))
);

function HomeProfessorBelowFoldFallback() {
  return (
    <SectionLoadingState />
  );
}

function buildScheduleSlots(items: HomeScheduleItem[]) {
  const slotMap = new Map<
    string,
    {
      key: string;
      timeLabel: string;
      startTime: number;
      endTime: number;
      items: HomeScheduleItem[];
    }
  >();

  items.forEach((item) => {
    const key = `${item.dateKey}-${item.startTime}-${item.endTime}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, {
        key,
        timeLabel: item.timeLabel,
        startTime: item.startTime,
        endTime: item.endTime,
        items: [],
      });
    }
    slotMap.get(key)?.items.push(item);
  });

  return Array.from(slotMap.values())
    .map((slot) => ({
      ...slot,
      items: [...slot.items].sort((a, b) => a.className.localeCompare(b.className)),
    }))
    .sort((a, b) => a.startTime - b.startTime);
}



export function HomeProfessorScreen({
  adminHeader,
  adminMode = false,
}: {
  adminHeader?: import("react").ReactNode;
  adminMode?: boolean;
} = {}) {
  markRender("screen.home.render.root");

  const router = useRouter();

  const { colors, mode } = useAppTheme();
  const responsiveLayout = useResponsiveLayout("dashboard");
  const { openMobileSidebar } = useNativeSidebarController();

  // Glass overlay function no longer needed - using native component styling instead

  const insets = useSafeAreaInsets();

  const { session, loading: authLoading } = useAuth();

  const { role, loading: roleLoading } = useRole();
  const profileScopePath = adminMode
    ? "/coord/dashboard"
    : role === "student"
      ? "/student/home"
      : "/prof/home";
  const profilePath = getScopedProfilePath(profileScopePath);
  const effectiveProfile = useEffectiveProfile();
  const notificationInboxScope = adminMode
    ? "coord"
    : notificationScopeForEffectiveProfile(effectiveProfile);

  const {
    activeOrganization,
    isLoading: organizationLoading,
    memberPermissions,
  } = useOrganization();
  const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const canRenderCoordinationDashboard = isOrgAdmin || effectiveProfile === "admin";
  const canOpenClassesShortcut =
    isOrgAdmin ||
    memberPermissions.classes === true;
  const canOpenStudentsShortcut =
    isOrgAdmin ||
    memberPermissions.students === true;
  const canOpenTrainingShortcut =
    isOrgAdmin ||
    memberPermissions.training === true;
  const canOpenCalendarShortcut =
    isOrgAdmin ||
    memberPermissions.calendar === true;
  const canOpenAbsenceNoticesShortcut =
    isOrgAdmin ||
    memberPermissions.absence_notices === true;
  const canOpenPeriodizationShortcut =
    isOrgAdmin ||
    memberPermissions.periodization === true;
  const canOpenRegulationHistoryShortcut =
    isOrgAdmin ||
    memberPermissions.org_members === true;
  const canOpenAssistantShortcut =
    isOrgAdmin ||
    memberPermissions.assistant === true;
  const canOpenReportsShortcut =
    isOrgAdmin ||
    memberPermissions.reports === true;
  const isAdminDashboardContext = adminMode && canRenderCoordinationDashboard;
  const upcomingWindowDays = 7;

  const [inbox, setInbox] = useState<AppNotification[]>([]);

  const [showInbox, setShowInbox] = useState(false);
  const [notificationControlHighlighted, setNotificationControlHighlighted] = useState(false);
  const [profileControlHighlighted, setProfileControlHighlighted] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [horizontalGestureActive, setHorizontalGestureActive] = useState(false);
  const handleHorizontalGestureChange = useCallback((active: boolean) => {
    setHorizontalGestureActive(active);
  }, []);
  const legacyAgendaGestureHandlers = useHorizontalGestureArbitration(
    handleHorizontalGestureChange
  );

  const agendaScrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profilePhotoCacheRef = useRef<{ uri: string | null; updatedAt: number }>({
    uri: null,
    updatedAt: 0,
  });

  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const [upcomingEvents, setUpcomingEvents] = useState<EventListItem[]>([]);
  const [resolvedScheduleRequestKey, setResolvedScheduleRequestKey] = useState<string | null>(null);

  const [agendaRefreshToken, setAgendaRefreshToken] = useState(0);
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const [heroManualIndex, setHeroManualIndex] = useState<number | null>(null);

  const didInitialAgendaScroll = useRef(false);
  const hasSeededRef = useRef(false);

  // Use smart sync instead of manual pending writes management
  const { syncing, pendingCount, lastError, syncNow } = useSmartSync();

  const { showSaveToast } = useSaveToast();
  const { confirm: confirmDialog } = useConfirmDialog();

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const panelWidth = Math.min(screenWidth * 0.85, 360);
  const inboxPanelWebGlassStyle =
    Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px) saturate(165%)",
          WebkitBackdropFilter: "blur(20px) saturate(165%)",
          backgroundImage:
            mode === "light"
              ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,250,255,0.92) 100%)"
              : "linear-gradient(180deg, rgba(22,32,54,0.72) 0%, rgba(16,25,46,0.62) 100%)",
        } as const)
      : null;
  const inboxUnreadBg =
    mode === "dark" ? "#1e293b" : "rgba(238, 242, 255, 0.94)";
  const inboxUnreadBorder =
    mode === "dark" ? "#334155" : "rgba(99, 102, 241, 0.34)";

  const homeContextLoading = authLoading || roleLoading || organizationLoading;
  const scheduleRequestKey = resolveHomeScheduleRequestKey({
    userId: session?.user?.id,
    role,
    organizationId: activeOrganization?.id,
    contextLoading: homeContextLoading,
    adminMode,
  });
  const showInitialLoading = shouldShowInitialHomeLoading({
    contextLoading: homeContextLoading,
    requestKey: scheduleRequestKey,
    resolvedRequestKey: resolvedScheduleRequestKey,
  });

  const [inboxX] = useState(() => new Animated.Value(panelWidth));

  const agendaScrollRef = useRef<FlatList<(typeof scheduleWindow)[number]> | null>(null);

  const [agendaWidth, setAgendaWidth] = useState(0);

  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);



  const [now, setNow] = useState(() => new Date());



  useEffect(() => {

    const interval = setInterval(() => setNow(new Date()), 60000);

    return () => clearInterval(interval);

  }, []);

  useEffect(() => {
    return () => {
      if (agendaScrollEndTimer.current) {
        clearTimeout(agendaScrollEndTimer.current);
        agendaScrollEndTimer.current = null;
      }
    };
  }, []);



  const todayLabel = useMemo(() => {

    const label = now.toLocaleDateString("pt-BR", {

      weekday: "long",

      day: "2-digit",

      month: "long",

    });

    return label.charAt(0).toUpperCase() + label.slice(1);

  }, [now]);

  const LEGACY_PHOTO_STORAGE_KEY = "profile_photo_uri_v1";

  const resolveProfilePhoto = useCallback(async (): Promise<string | null> => {
    if (role !== "trainer") return null;
    try {
      const remotePhoto = await getMyProfilePhoto();
      if (remotePhoto) return remotePhoto;

      const legacyPhoto = await AsyncStorage.getItem(LEGACY_PHOTO_STORAGE_KEY);
      if (!legacyPhoto) return null;

      if (Platform.OS === "web" && legacyPhoto.startsWith("blob:")) {
        await AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY);
        return null;
      }

      const userId = session?.user?.id ?? "";
      if (!userId) return legacyPhoto;

      const migratedPhoto = legacyPhoto.startsWith("http")
        ? legacyPhoto
        : await uploadMyProfilePhoto({
            userId,
            uri: legacyPhoto,
            contentType: "image/jpeg",
          });
      await setMyProfilePhoto(migratedPhoto);
      await AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY);
      return migratedPhoto;
    } catch {
      return null;
    }
  }, [role, session]);

  const ensureSeedData = useCallback(async () => {
    if (hasSeededRef.current) return;
    await seedIfEmpty();
    hasSeededRef.current = true;
  }, []);
  const loadHomeSchedule = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || role !== "trainer") {
      return { classes: [] as ClassGroup[], events: [] as EventListItem[] };
    }

    if (!adminMode) await ensureSeedData();

    const organizationId = activeOrganization?.id ?? null;
    const [classListResult, eventsListResult] = await Promise.allSettled([
      getClasses({ organizationId }),
      organizationId
        ? listUpcomingEvents({
            organizationId,
            userId,
            days: upcomingWindowDays,
          })
        : Promise.resolve([] as EventListItem[]),
    ]);

    return {
      classes: classListResult.status === "fulfilled" ? classListResult.value : [],
      events: eventsListResult.status === "fulfilled" ? eventsListResult.value : [],
    };
  }, [activeOrganization?.id, adminMode, ensureSeedData, role, session?.user?.id, upcomingWindowDays]);
  const loadProfilePhoto = useCallback(
    async (force = false): Promise<string | null> => {
      const nowTs = Date.now();
      if (
        !force &&
        profilePhotoCacheRef.current.updatedAt > 0 &&
        nowTs - profilePhotoCacheRef.current.updatedAt < 5 * 60 * 1000
      ) {
        return profilePhotoCacheRef.current.uri;
      }
      const uri = await resolveProfilePhoto();
      profilePhotoCacheRef.current = { uri, updatedAt: nowTs };
      return uri;
    },
    [resolveProfilePhoto]
  );
  const loadInbox = useCallback(async () => {
    try {
      const items = await getNotifications(
        notificationInboxScope,
        activeOrganization?.id,
      );
      setInbox(items);
    } catch {
      setInbox([]);
    }
  }, [notificationInboxScope, activeOrganization]);
  useEffect(() => {
    profilePhotoCacheRef.current = { uri: null, updatedAt: 0 };
  }, [role, session?.user?.id]);



  useEffect(() => {

    let alive = true;

    (async () => {

      if (!scheduleRequestKey) {
        return;
      }

      if (alive) {
        setClasses([]);
        setUpcomingEvents([]);
        setManualIndex(null);
        didInitialAgendaScroll.current = false;
      }
      if (agendaScrollEndTimer.current) {
        clearTimeout(agendaScrollEndTimer.current);
        agendaScrollEndTimer.current = null;
      }

      try {
        await measureAsync(
          "screen.home.load.schedule",
          async () => {
            const result = await loadHomeSchedule();

            if (alive) {
              setClasses(result.classes);
              setUpcomingEvents(result.events);
              setResolvedScheduleRequestKey(scheduleRequestKey);
              setAgendaRefreshToken((value) => value + 1);
            }
          },
          {
            screen: "home",
            role,
            hasOrganization: Boolean(activeOrganization?.id),
          }
        );
      } catch (error) {
        console.warn("[HomeProfessor] Failed to load home schedule", error);
        if (alive) {
          setClasses([]);
          setUpcomingEvents([]);
          setResolvedScheduleRequestKey(scheduleRequestKey);
        }
      }

    })();

    const unsubscribe = subscribeNotifications(
      (items) => {

        if (!alive) return;

        setInbox(items);

      },
      notificationInboxScope,
      activeOrganization?.id,
    );

    return () => {

      alive = false;

      unsubscribe();

    };

  }, [
    activeOrganization?.id,
    loadHomeSchedule,
    notificationInboxScope,
    role,
    scheduleRequestKey,
  ]);

  useEffect(() => {
    if (!showInbox) return;
    let alive = true;
    Promise.resolve().then(() => {
      void loadInbox().finally(() => {
            if (!alive) return;
          });
    });
    return () => {
      alive = false;
    };
  }, [loadInbox, showInbox]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadInbox();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadInbox]);



  useFocusEffect(

    useCallback(() => {

      let active = true;

      void loadProfilePhoto()
        .then((uri) => {
          if (active) setProfilePhotoUri(uri);
        })
        .catch(() => {
          if (active) setProfilePhotoUri(null);
        });

      return () => {

        active = false;

      };

    }, [loadProfilePhoto])

  );



  const unreadCount = inbox.filter((item) => !item.read).length;
  const unreadBadgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const notificationsAccessibilityLabel =
    unreadCount > 0
      ? `Abrir notificações, ${unreadCount} ${unreadCount === 1 ? "não lida" : "não lidas"}`
      : "Abrir notificações";



  const openInbox = async () => {

    await requestNotificationPermission();

    setShowInbox(true);

    Animated.timing(inboxX, {

      toValue: 0,

      duration: 220,

      useNativeDriver: true,

    }).start();

    await markAllRead(notificationInboxScope, activeOrganization?.id);

  };



  const closeInbox = () => {

    Animated.timing(inboxX, {

      toValue: panelWidth,

      duration: 200,

      useNativeDriver: true,

    }).start(() => {

      setShowInbox(false);

    });

  };



  const [openSwipe] = useState(() =>

    PanResponder.create({

      onMoveShouldSetPanResponder: (_, gesture) => gesture.dx < -12,

      onPanResponderRelease: (_, gesture) => {

        if (gesture.dx < -30) {

          void openInbox();

        }

      },

    })

  );



  const [closeSwipe] = useState(() =>

    PanResponder.create({

      onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 12,

      onPanResponderRelease: (_, gesture) => {

        if (gesture.dx > 30) {

          closeInbox();

        }

      },

    })

  );



  const formatTime = (value: string) => {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("pt-BR", {

      day: "2-digit",

      month: "2-digit",

      hour: "2-digit",

      minute: "2-digit",

    });

  };



  const truncateBody = (value: string, max = 140) => {

    if (value.length <= max) return value;

    return value.slice(0, max).trimEnd() + "...";

  };



  const formatIsoDate = (value: Date) => {

    const y = value.getFullYear();

    const m = String(value.getMonth() + 1).padStart(2, "0");

    const d = String(value.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;

  };



  const parseTime = (value: string) => {

    if (!value) return null;

    const match = value.match(/^(\d{2}):(\d{2})$/);

    if (!match) return null;

    return { hour: Number(match[1]), minute: Number(match[2]) };

  };



  const formatRange = (hour: number, minute: number, durationMinutes: number) => {

    const start = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");

    const endTotal = hour * 60 + minute + durationMinutes;

    const endHour = Math.floor(endTotal / 60) % 24;

    const endMinute = endTotal % 60;

    const end = String(endHour).padStart(2, "0") + ":" + String(endMinute).padStart(2, "0");

    return start + " - " + end;

  };



  const formatShortDate = (iso: string) => {

    const parsed = new Date(iso + "T00:00:00");

    if (Number.isNaN(parsed.getTime())) return iso;

    const weekday = parsed.toLocaleDateString("pt-BR", {

      weekday: "short",

    });

    const date = parsed.toLocaleDateString("pt-BR", {

      day: "2-digit",

      month: "2-digit",

    });

    const weekdayCapitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);

    return `${weekdayCapitalized} | ${date}`;

  };



  const todayDateKey = useMemo(() => formatIsoDate(now), [now]);
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);

  const nowTime = useMemo(() => now.getTime(), [now]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSelectedDateKey(todayDateKey);
    });
  }, [todayDateKey]);

  const scheduleBaseDate = useMemo(() => {
    const parsed = new Date(todayDateKey + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }, [todayDateKey]);

  const classesByWeekday = useMemo(() => {
    const byDay: Record<number, ClassGroup[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };

    classes.forEach((cls) => {
      const days = cls.daysOfWeek ?? [];
      days.forEach((day) => {
        if (day >= 0 && day <= 6) byDay[day].push(cls);
      });
    });

    return byDay;
  }, [classes]);



  const scheduleWindow = useMemo(() => {

    if (!classes.length) return [];

    const items: {

      classId: string;

      className: string;

      unit: string;

      gender: ClassGroup["gender"] | null;

      dateKey: string;

      dateLabel: string;

      startTime: number;

      endTime: number;

      timeLabel: string;

    }[] = [];

    for (let offset = -1; offset <= 7; offset += 1) {

      const dayDate = new Date(scheduleBaseDate);

      dayDate.setDate(scheduleBaseDate.getDate() + offset);

      dayDate.setHours(0, 0, 0, 0);

      const dayIndex = dayDate.getDay();

      const dayClasses = classesByWeekday[dayIndex] ?? [];

      dayClasses.forEach((cls) => {

        const time = parseTime(cls.startTime);

        if (!time) return;

        const start = new Date(dayDate);

        start.setHours(time.hour, time.minute, 0, 0);

        const duration = cls.durationMinutes ?? 60;

        const end = new Date(start.getTime() + duration * 60000);

        items.push({

          classId: cls.id,

          className: cls.name,

          unit: cls.unit || "Sem unidade",

          gender: cls.gender ?? null,

          dateKey: formatIsoDate(start),

          dateLabel: formatShortDate(formatIsoDate(start)),

          startTime: start.getTime(),

          endTime: end.getTime(),

          timeLabel: formatRange(time.hour, time.minute, duration),

        });

      });

    }

    return items.sort((a, b) => a.startTime - b.startTime);

  }, [classes.length, classesByWeekday, scheduleBaseDate]);



  const agendaScrollItems = useMemo(() => {
    const sortByStartTime = (
      a: (typeof scheduleWindow)[number],
      b: (typeof scheduleWindow)[number]
    ) => a.startTime - b.startTime;

    const buckets = {
      pastDays: [] as (typeof scheduleWindow)[number][],
      pastToday: [] as (typeof scheduleWindow)[number][],
      currentToday: [] as (typeof scheduleWindow)[number][],
      upcomingToday: [] as (typeof scheduleWindow)[number][],
      futureDays: [] as (typeof scheduleWindow)[number][],
    };

    scheduleWindow.forEach((item) => {
      if (item.dateKey < todayDateKey) {
        buckets.pastDays.push(item);
        return;
      }

      if (item.dateKey > todayDateKey) {
        buckets.futureDays.push(item);
        return;
      }

      if (item.endTime <= nowTime) {
        buckets.pastToday.push(item);
        return;
      }

      if (item.startTime <= nowTime && item.endTime > nowTime) {
        buckets.currentToday.push(item);
        return;
      }

      buckets.upcomingToday.push(item);
    });

    buckets.pastDays.sort(sortByStartTime);
    buckets.pastToday.sort(sortByStartTime);
    buckets.currentToday.sort(sortByStartTime);
    buckets.upcomingToday.sort(sortByStartTime);
    buckets.futureDays.sort(sortByStartTime);

    return [
      ...buckets.pastDays,
      ...buckets.pastToday,
      ...buckets.currentToday,
      ...buckets.upcomingToday,
      ...buckets.futureDays,
    ];
  }, [nowTime, scheduleWindow, todayDateKey]);



  const autoIndex = useMemo(() => {

    if (!agendaScrollItems.length) return null;

    const firstCurrentIndex = agendaScrollItems.findIndex(
      (item) =>
        item.dateKey === todayDateKey &&
        item.startTime <= nowTime &&
        item.endTime > nowTime
    );
    if (firstCurrentIndex !== -1) return firstCurrentIndex;

    const firstUpcomingTodayIndex = agendaScrollItems.findIndex(
      (item) => item.dateKey === todayDateKey && item.startTime > nowTime
    );
    if (firstUpcomingTodayIndex !== -1) return firstUpcomingTodayIndex;

    const firstFutureIndex = agendaScrollItems.findIndex((item) => item.dateKey > todayDateKey);
    if (firstFutureIndex !== -1) return firstFutureIndex;

    const firstPastIndex = agendaScrollItems.findIndex((item) => item.dateKey < todayDateKey);
    return firstPastIndex !== -1 ? firstPastIndex : agendaScrollItems.length - 1;

  }, [agendaScrollItems, nowTime, todayDateKey]);

  useEffect(() => {

    if (!agendaScrollItems.length || autoIndex === null) {
      Promise.resolve().then(() => {
        setManualIndex(null);
      });

      return;

    }

    if (manualIndex == null) {
      Promise.resolve().then(() => {
        setManualIndex(autoIndex);
      });

    }

  }, [autoIndex, manualIndex, agendaScrollItems.length]);



  useEffect(() => {

    if (manualIndex == null) return;

    if (!agendaScrollItems.length) {
      Promise.resolve().then(() => {
        setManualIndex(null);
      });

      return;

    }

    if (manualIndex >= agendaScrollItems.length) {
      Promise.resolve().then(() => {
        setManualIndex(null);
      });

      return;

    }

  }, [manualIndex, agendaScrollItems.length]);



  const activeIndex = manualIndex ?? autoIndex;

  const activeItem = activeIndex !== null ? agendaScrollItems[activeIndex] : null;
  const isWebHome = Platform.OS === "web";
  // Web e native compartilham a Home atual. Os componentes internos já tratam
  // as capacidades de cada plataforma; esta rota não deve cair no painel
  // legado apenas por estar rodando no Android ou iOS.
  const usesCurrentHomeExperience = true;

  const isUx2CWideDesktop = responsiveLayout.supportsDenseGrid;
  const isUx2CUltraWide = responsiveLayout.tier === "ultrawide";
  const isUx2CCompact = usesCurrentHomeExperience && !isUx2CWideDesktop;
  const isUx2CMobile = usesCurrentHomeExperience && responsiveLayout.isMobile;
  const ux2CRailWidth = isUx2CUltraWide ? 420 : isUx2CWideDesktop ? 380 : 320;
  const ux2CGap = isUx2CUltraWide ? 28 : isUx2CWideDesktop ? 24 : 16;
  const ux2CRailHeight = Math.max(
    isUx2CCompact ? 520 : 560,
    Math.min(isUx2CCompact ? 680 : 760, screenHeight - (isUx2CCompact ? 132 : 148))
  );
  const ux2CPageBackground = colors.background;
  const ux2CShortcutSurface = colors.card;
  const ux2CShortcutBorder = colors.border;
  const ux2CShortcutShadow = mode === "dark" ? 0.12 : 0.04;

  const agendaCardGap = isWebHome ? 8 : 10;

  const agendaCardWidth = useMemo(() => {

    if (!agendaWidth) return 210;

    const target =
      Platform.OS === "web"
        ? Math.max(220, Math.min(agendaWidth * 0.42, 252))
        : Math.max(160, Math.min(agendaWidth * 0.62, 220));

    return Math.round(target);

  }, [agendaWidth]);

  const homeContentContainerStyle = useMemo(
    () =>
      ({
        padding: usesCurrentHomeExperience ? (isUx2CCompact ? 16 : 22) : isWebHome ? 14 : 16,
        gap: usesCurrentHomeExperience ? (isUx2CCompact ? 12 : 14) : isWebHome ? 12 : 14,
        paddingBottom: insets.bottom + (isWebHome ? 280 : 240),
        width: "100%",
        maxWidth: usesCurrentHomeExperience
          ? (isUx2CUltraWide ? 1600 : isUx2CWideDesktop ? 1460 : undefined)
          : isAdminDashboardContext && isWebHome
            ? (isUx2CUltraWide ? 1600 : isUx2CWideDesktop ? 1460 : 1320)
            : isWebHome
              ? 1120
              : undefined,
        alignSelf: "center",
      }) as const,
    [insets.bottom, isAdminDashboardContext, isUx2CCompact, isUx2CUltraWide, isUx2CWideDesktop, isWebHome, usesCurrentHomeExperience]
  );

  const agendaScrollStyle = useMemo(() => {

    if (Platform.OS !== "web") return undefined;

    return { scrollSnapType: "x mandatory", scrollBehavior: "smooth" } as any;

  }, []);

  const agendaContentContainerStyle = useMemo(
    () => ({ paddingRight: isWebHome ? 28 : agendaCardGap } as const),
    [agendaCardGap, isWebHome]
  );

  const agendaLoadingRowStyle = useMemo(
    () => ({ flexDirection: "row", gap: agendaCardGap, paddingVertical: 2 } as const),
    [agendaCardGap]
  );

  const agendaShimmerCardStyle = useMemo(
    () => ({ width: agendaCardWidth, height: 112, borderRadius: 14 } as const),
    [agendaCardWidth]
  );

  const getStatusLabelForItem = useCallback(

    (item: (typeof scheduleWindow)[number]) => {

      if (item.dateKey === todayDateKey) {

        if (nowTime >= item.startTime && nowTime < item.endTime) {

          return "Aula de hoje";

        }

        if (item.endTime <= nowTime) return "Concluída";

        return "Próxima de hoje";

      }

      return item.dateKey < todayDateKey ? "Aula anterior" : "Próximos dias";

    },

    [nowTime, todayDateKey]

  );

  const agendaDivider = useMemo(() => {
    if (!agendaScrollItems.length) return null as null | { index: number; label: string };
    const hasPastToday = agendaScrollItems.some(
      (item) => item.dateKey === todayDateKey && item.endTime <= nowTime
    );
    if (!hasPastToday) return null;

    const firstAfterTodayIndex = agendaScrollItems.findIndex((item) => item.dateKey > todayDateKey);
    if (firstAfterTodayIndex !== -1) {
      return { index: firstAfterTodayIndex, label: "Próximos dias" };
    }

    return null;
  }, [agendaScrollItems, todayDateKey, nowTime]);



  const handleAgendaScrollEnd = (event: any) => {

      if (!agendaScrollItems.length) return;

      const offset = event.nativeEvent.contentOffset.x;

      const size = agendaCardWidth + agendaCardGap;

      if (!size) return;

      const index = Math.max(0, Math.min(agendaScrollItems.length - 1, Math.round(offset / size)));

      setManualIndex(index);

    };

  const handleAgendaCardPress = (index: number) => {

      setManualIndex(index);

      const size = agendaCardWidth + agendaCardGap;

      if (!size) return;

    agendaScrollRef.current?.scrollToOffset({ offset: index * size, animated: true });

    };

  useEffect(() => {

    if (didInitialAgendaScroll.current) return;

    if (manualIndex != null) return;

    if (autoIndex == null || !agendaWidth) return;

    didInitialAgendaScroll.current = true;

    const offset = (agendaCardWidth + agendaCardGap) * autoIndex;

    requestAnimationFrame(() => {

      agendaScrollRef.current?.scrollToOffset({ offset, animated: false });

    });

  }, [agendaCardGap, agendaCardWidth, agendaWidth, autoIndex, manualIndex]);



  useEffect(() => {

    didInitialAgendaScroll.current = false;

  }, [activeOrganization?.id, agendaScrollItems.length, todayDateKey]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setManualIndex(null);
    });
    didInitialAgendaScroll.current = false;
    requestAnimationFrame(() => {
      agendaScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [activeOrganization?.id]);



  useEffect(() => {

    if (agendaRefreshToken === 0) return;

    if (autoIndex == null || !agendaWidth) return;

    const offset = (agendaCardWidth + agendaCardGap) * autoIndex;

    requestAnimationFrame(() => {

      agendaScrollRef.current?.scrollToOffset({ offset, animated: true });

    });

  }, [agendaCardGap, agendaCardWidth, agendaRefreshToken, autoIndex, agendaWidth]);

  const activeAttendanceTarget = useMemo(() => {
    const classId = activeItem?.classId;
    const date = activeItem?.dateKey;
    if (!classId || !date) return null;
    return {
      classId,
      date,
    };
  }, [activeItem]);

  const handleOpenPlanningForActiveClass = useCallback(() => {
    if (!activeAttendanceTarget) {
      showSaveToast({ message: "Selecione uma turma na agenda para abrir o planejamento.", variant: "info" });
      return;
    }

    router.push({
      pathname: "/class/[id]",
      params: {
        id: activeAttendanceTarget.classId,
      },
    });
  }, [activeAttendanceTarget, router, showSaveToast]);

  const handleOpenAttendanceForActiveClass = useCallback(() => {
    if (!activeAttendanceTarget) {
      showSaveToast({ message: "Selecione uma turma na agenda para abrir a chamada.", variant: "info" });
      return;
    }

    router.push(buildClassAttendanceWorkspaceHref(activeAttendanceTarget.classId, activeAttendanceTarget.date));
  }, [activeAttendanceTarget, router, showSaveToast]);

  const handleOpenReportsForActiveClass = useCallback(() => {
    if (!activeAttendanceTarget) {
      showSaveToast({ message: "Selecione uma turma na agenda para abrir os relatórios.", variant: "info" });
      return;
    }

    router.push({
      pathname: "/class/[id]/session",
      params: {
        id: activeAttendanceTarget.classId,
        date: activeAttendanceTarget.date,
        tab: "relatorio",
      },
    });
  }, [activeAttendanceTarget, router, showSaveToast]);

  const handleOpenLesson = useCallback(
    (item: HomeScheduleItem | null) => {
      if (!item) {
        showSaveToast({ message: "Selecione uma turma na agenda para abrir a aula.", variant: "info" });
        return;
      }

      router.push({
        pathname: "/class/[id]/session",
        params: {
          id: item.classId,
          date: item.dateKey,
        },
      });
    },
    [router, showSaveToast]
  );

  const handleOpenAttendance = useCallback(
    (item: HomeScheduleItem | null) => {
      if (!item) {
        showSaveToast({ message: "Selecione uma turma na agenda para abrir a chamada.", variant: "info" });
        return;
      }

      router.push(buildClassAttendanceWorkspaceHref(item.classId, item.dateKey));
    },
    [router, showSaveToast]
  );

  const showToast = (message: string, type: "info" | "success" | "error") => {

    showSaveToast({ message, variant: type });

  };

  const showErrorToast = useCallback(
    (error: unknown) => {
      showSaveToast({ error, variant: "error" });
    },
    [showSaveToast]
  );



  const handleSyncPending = async () => {
    try {
      const result = await syncNow();
      if (result.flushed) {
        showToast(`Sincronizado: ${result.flushed} item(s).`, "success");
      } else if (result.remaining === 0) {
        showToast("Tudo sincronizado!", "success");
      } else {
        showToast("Nenhum item foi sincronizado.", "info");
      }
    } catch (error) {
      showErrorToast(error);
    }
  };



  const refreshHomeData = async () => {

    const tasks: Promise<unknown>[] = [
      loadInbox(),
    ];

    tasks.push(
      loadProfilePhoto()
        .then(setProfilePhotoUri)
        .catch(() => setProfilePhotoUri(null))
    );

    if (scheduleRequestKey) {
      tasks.push(
        loadHomeSchedule()
          .then((result) => {
            setClasses(result.classes);
            setUpcomingEvents(result.events);
            setResolvedScheduleRequestKey(scheduleRequestKey);
          })
          .catch(() => {
            setClasses([]);
            setUpcomingEvents([]);
            setResolvedScheduleRequestKey(scheduleRequestKey);
          })
      );
    }

    await measureAsync("screen.home.load.refresh", () => Promise.allSettled(tasks), {
      screen: "home",
      hasSession: Boolean(session),
      hasOrganization: Boolean(activeOrganization?.id),
    });

    setNow(new Date());

  };



  const onRefresh = async () => {

    if (refreshing) return;

    setRefreshing(true);

    try {

      await refreshHomeData();

      setManualIndex(null);

      setAgendaRefreshToken((value) => value + 1);

    } catch (error) {

      showErrorToast(error);

    } finally {

      setRefreshing(false);

    }

  };

  const todayAgendaItems = useMemo<HomeScheduleItem[]>(
    () =>
      scheduleWindow.filter(
        (item): item is (typeof scheduleWindow)[number] =>
          Boolean(item?.classId) && Boolean(item?.dateKey) && item.dateKey === todayDateKey
      ),
    [scheduleWindow, todayDateKey]
  );

  const selectedDayItems = useMemo<HomeScheduleItem[]>(
    () =>
      scheduleWindow.filter(
        (item): item is (typeof scheduleWindow)[number] =>
          Boolean(item?.classId) && Boolean(item?.dateKey) && item.dateKey === selectedDateKey
      ),
    [scheduleWindow, selectedDateKey]
  );

  const weekDaySummaries = useMemo(() => {
    const days = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const dayDate = new Date(scheduleBaseDate);
      dayDate.setDate(scheduleBaseDate.getDate() + offset);
      dayDate.setHours(0, 0, 0, 0);
      const dateKey = formatIsoDate(dayDate);
      const dayItems = scheduleWindow.filter((item) => item.dateKey === dateKey);
      const weekday = dayDate.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const weekdayLabel = weekday.slice(0, 3).toUpperCase();
      days.push({
        dateKey,
        weekdayLabel,
        dateLabel: dayDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        fullLabel: dayDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }),
        lessonCount: dayItems.length,
        durationMinutes: dayItems.reduce(
          (total, item) => total + Math.max(0, Math.round((item.endTime - item.startTime) / 60000)),
          0
        ),
        isToday: dateKey === todayDateKey,
      });
    }
    return days;
  }, [scheduleBaseDate, scheduleWindow, todayDateKey]);

  const selectedDaySummary = useMemo(
    () => weekDaySummaries.find((day) => day.dateKey === selectedDateKey) ?? weekDaySummaries[0] ?? null,
    [selectedDateKey, weekDaySummaries]
  );

  const heroScheduleSlots = useMemo(() => {
    const firstDateKey = weekDaySummaries[0]?.dateKey;
    const lastDateKey = weekDaySummaries[weekDaySummaries.length - 1]?.dateKey;
    if (!firstDateKey || !lastDateKey) return [];

    return buildScheduleSlots(
      scheduleWindow.filter(
        (item) => item.dateKey >= firstDateKey && item.dateKey <= lastDateKey
      )
    );
  }, [scheduleWindow, weekDaySummaries]);

  const heroAutoIndex = useMemo(() => {
    if (!heroScheduleSlots.length) return 0;
    const nextIndex = heroScheduleSlots.findIndex((slot) => slot.endTime > nowTime);
    return nextIndex >= 0 ? nextIndex : heroScheduleSlots.length - 1;
  }, [heroScheduleSlots, nowTime]);

  const currentHeroIndex = heroScheduleSlots.length
    ? Math.max(
        0,
        Math.min(heroScheduleSlots.length - 1, heroManualIndex ?? heroAutoIndex)
      )
    : 0;
  const nextScheduleSlot = useMemo(() => {
    const reference =
      scheduleWindow.find((item) => item.endTime > nowTime) ??
      scheduleWindow.find((item) => item.dateKey >= todayDateKey) ??
      null;
    if (!reference) return null;
    return {
      reference,
      items: scheduleWindow
        .filter(
          (item) =>
            item.dateKey === reference.dateKey &&
            item.startTime === reference.startTime &&
            item.endTime === reference.endTime
        )
        .sort((a, b) => a.className.localeCompare(b.className)),
    };
  }, [nowTime, scheduleWindow, todayDateKey]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setHeroManualIndex(null);
    });
  }, [activeOrganization?.id, todayDateKey]);

  useEffect(() => {
    if (!heroScheduleSlots.length || heroManualIndex !== null) return;
    const initialDateKey = heroScheduleSlots[heroAutoIndex]?.items[0]?.dateKey;
    Promise.resolve().then(() => {
      setHeroManualIndex(heroAutoIndex);
      if (initialDateKey) setSelectedDateKey(initialDateKey);
    });
  }, [heroAutoIndex, heroManualIndex, heroScheduleSlots]);

  const selectHeroIndex = useCallback(
    (nextIndex: number) => {
      if (!heroScheduleSlots.length) return;
      const boundedIndex = Math.max(0, Math.min(heroScheduleSlots.length - 1, nextIndex));
      setHeroManualIndex(boundedIndex);
      const nextDateKey = heroScheduleSlots[boundedIndex]?.items[0]?.dateKey;
      if (nextDateKey) setSelectedDateKey(nextDateKey);
    },
    [heroScheduleSlots]
  );

  const handleSelectWeekDay = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(dateKey);
      const firstSlotIndex = heroScheduleSlots.findIndex(
        (slot) => slot.items[0]?.dateKey === dateKey
      );
      if (firstSlotIndex >= 0) setHeroManualIndex(firstSlotIndex);
    },
    [heroScheduleSlots]
  );

  const todayScheduleSlots = useMemo(() => buildScheduleSlots(todayAgendaItems), [todayAgendaItems]);
  const selectedDaySlots = useMemo(() => buildScheduleSlots(selectedDayItems), [selectedDayItems]);

  const todayScheduleSlotPreview = useMemo(() => todayScheduleSlots.slice(0, 4), [todayScheduleSlots]);
  const todayRemainingSlots = Math.max(0, todayScheduleSlots.length - todayScheduleSlotPreview.length);

  const adminRailActions = useMemo(
    () =>
      [
        { id: "coordination", label: "Coordenação", route: "/coord/management", icon: "management" },
        { id: "planning", label: "Planejamento", route: "/coord/planning", icon: "planning" },
        { id: "events", label: "Eventos", route: "/coord/events", icon: "events" },
        { id: "nfc", label: "Presença NFC", route: "/coord/nfc-attendance", icon: "nfc" },
      ] as const,
    []
  );
  const adminRailActionStyle = useMemo(
    () => ({
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    }),
    [colors.border, colors.card]
  );
  const adminRailActionTextStyle = useMemo(
    () => ({
      color: colors.text,
      fontSize: 12,
      fontWeight: "700" as const,
    }),
    [colors.text]
  );

  if (showInitialLoading) {
    return <ScreenLoadingState />;
  }

  return (

    <SafeAreaView

      style={{ flex: 1, backgroundColor: usesCurrentHomeExperience ? ux2CPageBackground : colors.background }}

    >

      <ScrollView
        style={Platform.OS === "web" ? ({ scrollbarGutter: "auto" } as any) : undefined}

        contentContainerStyle={homeContentContainerStyle}

        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={!horizontalGestureActive}
          />
        }

      >

        <View

        style={{

          flexDirection: "row",

          alignItems: "center",

          justifyContent: "space-between",

          marginBottom: isWebHome ? 4 : 8,

        }}

      >

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {responsiveLayout.isMobile ? (
            <Pressable
              onPress={() => {
                if (Platform.OS === "web" && typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("goatleta:toggle-sidebar"));
                } else {
                  openMobileSidebar();
                }
              }}
              accessibilityLabel="Abrir menu principal"
              style={({ pressed, hovered }: any) => ({
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: hovered ? colors.secondaryBg : colors.card,
                borderWidth: 1,
                borderColor: hovered ? colors.primaryBg : colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <GoAtletaIcon name="align" size={18} color={colors.text} />
            </Pressable>
          ) : null}
          <View>
            <Text
              style={{
                fontSize: responsiveLayout.density.pageTitleFontSize,
                lineHeight: responsiveLayout.density.pageTitleLineHeight,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              Hoje
            </Text>
            <Text style={{ fontSize: responsiveLayout.density.metadataFontSize, color: colors.muted, marginTop: 2 }}>
              {todayLabel}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>

          <View style={{ position: "relative" }}>
            <Pressable

              onPress={openInbox}
              suppressWebHoverFeedback
              accessibilityLabel={notificationsAccessibilityLabel}
              onHoverIn={() => setNotificationControlHighlighted(true)}
              onHoverOut={() => setNotificationControlHighlighted(false)}
              onFocus={() => setNotificationControlHighlighted(true)}
              onBlur={() => setNotificationControlHighlighted(false)}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                opacity: notificationControlHighlighted ? 0.78 : 1,
              }}

            >

              <GoAtletaIcon name="notifications" size={24} color={colors.text} />

            </Pressable>

            {unreadCount > 0 ? (

              <View

                style={{

                  position: "absolute",

                  right: 0,

                  top: 0,

                  minWidth: 18,

                  height: 18,

                  paddingHorizontal: 4,

                  borderRadius: 9,

                  backgroundColor: colors.dangerSolidBg,

                  alignItems: "center",

                  justifyContent: "center",

                  zIndex: 10,

                  borderWidth: 2,

                  borderColor: colors.background,

                  pointerEvents: "none",

                }}

              >

                <Text
                  style={{
                    color: colors.dangerSolidText,
                    fontSize: 10,
                    lineHeight: 12,
                    fontWeight: "800",
                  }}
                >

                  {unreadBadgeLabel}

                </Text>

              </View>

            ) : null}
          </View>

          <Link href={profilePath} asChild>

            <Pressable

              suppressWebHoverFeedback
              accessibilityLabel="Abrir perfil"
              onHoverIn={() => setProfileControlHighlighted(true)}
              onHoverOut={() => setProfileControlHighlighted(false)}
              onFocus={() => setProfileControlHighlighted(true)}
              onBlur={() => setProfileControlHighlighted(false)}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                opacity: profileControlHighlighted ? 0.78 : 1,
              }}

          >

            <View

              style={{

                width: 28,

                height: 28,

                borderRadius: 999,
                alignItems: "center",

                justifyContent: "center",
                overflow: "hidden",
              }}

            >

              <GoAtletaIcon name="profile" size={24} color={colors.text} />

              { profilePhotoUri ? (

                <Image

                  source={{ uri: profilePhotoUri }}

                  style={{

                    position: "absolute",

                    top: 0,

                    left: 0,

                    right: 0,

                    bottom: 0,

                  }}

                  contentFit="cover"

                />

              ) : null}

            </View>

            </Pressable>

          </Link>

        </View>

      </View>



        <View style={{ gap: 14 }}>

        {adminHeader ? adminHeader : null}

        { pendingCount > 0 ? (

          <View

            style={{

              padding: 14,

              borderRadius: 18,

              backgroundColor: colors.card,

              borderWidth: 1,

              borderColor: colors.border,
              gap: 8,

            }}

          >

            <Text style={{ color: colors.text, fontWeight: "700" }}>

              Sincronizacao pendente

            </Text>

            <Text style={{ color: colors.muted }}>

              {pendingCount} item(s) aguardando envio.

            </Text>

            <SyncStatusBadge
              status={
                lastError
                  ? "error"
                  : syncing
                  ? "saving"
                  : pendingCount === 0
                  ? "synced"
                  : "saved_local"
              }
              message={
                lastError
                  ? `Erro: ${lastError}`
                  : syncing
                  ? "Sincronizando..."
                  : pendingCount === 0
                  ? "Tudo sincronizado"
                  : `${pendingCount} itens locais`
              }
            />

            <Pressable

              onPress={handleSyncPending}

              disabled={syncing}

              style={{

                alignSelf: "flex-start",

                paddingVertical: 6,

                paddingHorizontal: 12,

                borderRadius: 999,

                backgroundColor: syncing ? colors.primaryDisabledBg : colors.primaryBg,

              }}

            >

              <Text

                style={{

                  color: syncing ? colors.secondaryText : colors.primaryText,

                  fontWeight: "700",

                }}

              >

                {syncing ? "Sincronizando..." : "Sincronizar agora"}

              </Text>

            </Pressable>

          </View>

        ) : null}

        {usesCurrentHomeExperience ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: ux2CGap,
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 0,
                width: "100%",
                maxWidth: isUx2CUltraWide ? 980 : isUx2CWideDesktop ? 920 : undefined,
                alignSelf: "auto",
                gap: isUx2CCompact ? 12 : 14,
              }}
            >
              <CurrentLessonCarousel
                slots={heroScheduleSlots}
                currentIndex={currentHeroIndex}
                selectedDateLabel={todayLabel}
                todayDateKey={todayDateKey}
                nowTime={nowTime}
                compact={isUx2CCompact}
                mobile={isUx2CMobile}
                onIndexChange={selectHeroIndex}
                onOpenLesson={handleOpenLesson}
                onOpenAttendance={handleOpenAttendance}
                onHorizontalGestureChange={handleHorizontalGestureChange}
              />

              <WeekDaySelector
                days={weekDaySummaries}
                selectedDateKey={selectedDateKey}
                colors={colors}
                compact={isUx2CCompact}
                mobile={isUx2CMobile}
                onSelect={handleSelectWeekDay}
                onHorizontalGestureChange={handleHorizontalGestureChange}
              />

              <View
                style={{
                  backgroundColor: ux2CShortcutSurface,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: ux2CShortcutBorder,
                  padding: isUx2CCompact ? 12 : 16,
                  ...(Platform.OS === "web"
                    ? { boxShadow: `0px 8px 18px rgba(15, 23, 42, ${ux2CShortcutShadow})` }
                    : {
                        shadowColor: "#0F172A",
                        shadowOpacity: ux2CShortcutShadow,
                        shadowRadius: 18,
                        shadowOffset: { width: 0, height: 8 },
                      }),
                }}
              >
                <Suspense fallback={<HomeProfessorBelowFoldFallback />}>
                  <HomeProfessorBelowFold
                    variant={isAdminDashboardContext ? "coordination" : "professor"}
                    mobile={isUx2CMobile}
                    canOpenClassesShortcut={canOpenClassesShortcut}
                    canOpenStudentsShortcut={canOpenStudentsShortcut}
                    canOpenTrainingShortcut={canOpenTrainingShortcut}
                    canOpenCalendarShortcut={canOpenCalendarShortcut}
                    canOpenAbsenceNoticesShortcut={canOpenAbsenceNoticesShortcut}
                    canOpenPeriodizationShortcut={canOpenPeriodizationShortcut}
                    canOpenRegulationHistoryShortcut={canOpenRegulationHistoryShortcut}
                    canOpenAssistantShortcut={canOpenAssistantShortcut}
                  />
                </Suspense>
              </View>

            </View>

            {responsiveLayout.supportsSplitView ? (
              <TodayScheduleRail
                title={`Aulas de ${selectedDaySummary?.fullLabel ?? "hoje"}`}
                subtitle={selectedDaySummary?.dateLabel ?? ""}
                slots={selectedDaySlots}
                totalDurationMinutes={selectedDaySummary?.durationMinutes ?? 0}
                compact={isUx2CCompact}
                width={ux2CRailWidth}
                height={ux2CRailHeight}
                onOpenLesson={handleOpenLesson}
                onOpenAttendance={handleOpenAttendance}
              />
            ) : null}
          </View>
        ) : null}

        {!isAdminDashboardContext && !usesCurrentHomeExperience ? (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
            overflow: "hidden",
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Agenda do dia
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Arraste para ver a semana anterior e a próxima.
            </Text>
          </View>

          <FlatList
            ref={agendaScrollRef}
            horizontal
            {...legacyAgendaGestureHandlers}
            directionalLockEnabled
            data={agendaScrollItems}
            keyExtractor={(item, index) => `${item.classId}-${item.dateKey}-${index}`}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            decelerationRate="fast"
            snapToAlignment="start"
            snapToInterval={agendaCardWidth + agendaCardGap}
            contentContainerStyle={agendaContentContainerStyle}
            onMomentumScrollEnd={handleAgendaScrollEnd}
            onScrollEndDrag={handleAgendaScrollEnd}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (width > 0) {
                setAgendaWidth((currentWidth) => (currentWidth === width ? currentWidth : width));
              }
            }}
            scrollEventThrottle={16}
            style={[{ width: "100%" }, agendaScrollStyle]}
            ListEmptyComponent={<View style={agendaLoadingRowStyle}><ShimmerBlock style={agendaShimmerCardStyle} /><ShimmerBlock style={agendaShimmerCardStyle} /><ShimmerBlock style={agendaShimmerCardStyle} /></View>}
            renderItem={({ item, index }) => {
              if (!item?.classId || !item?.dateKey) return null;
              const label = getStatusLabelForItem(item);
              const isPast = item.endTime <= nowTime;
              const isActive = activeIndex === index;
              return (
                <AgendaCard
                  index={index}
                  item={item}
                  label={label}
                  isPast={isPast}
                  isActive={isActive}
                  isLast={index === agendaScrollItems.length - 1}
                  showDivider={agendaDivider?.index === index}
                  agendaCardWidth={agendaCardWidth}
                  agendaCardGap={agendaCardGap}
                  colors={colors}
                  mode={mode}
                  onCardPress={handleAgendaCardPress}
                />
              );
            }}
          />

          <View
            style={{
              flexDirection: isWebHome ? "row" : "column",
              alignItems: "stretch",
              gap: isWebHome ? 8 : 10,
            }}
          >
            <View style={{ flex: 1, flexDirection: isWebHome ? "row" : "column", gap: isWebHome ? 8 : 10 }}>
              {canOpenTrainingShortcut ? (
              <Pressable
                onPress={handleOpenPlanningForActiveClass}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: isWebHome ? 10 : 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.primaryBg,
                  backgroundColor: colors.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                <Text numberOfLines={1} style={{ color: colors.primaryText, fontWeight: "800", fontSize: 13 }}>Ir pra aula do dia</Text>
              </Pressable>
              ) : null}
              {canOpenClassesShortcut ? (
              <Pressable
                onPress={handleOpenAttendanceForActiveClass}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: isWebHome ? 10 : 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Chamada</Text>
              </Pressable>
              ) : null}
              {canOpenReportsShortcut ? (
              <Pressable
                onPress={handleOpenReportsForActiveClass}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: isWebHome ? 10 : 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Relatórios</Text>
              </Pressable>
              ) : null}
            </View>
          </View>

        </View>
        ) : null}

        {isAdminDashboardContext && !usesCurrentHomeExperience ? (
        <View
          style={{
            padding: 14,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View
            style={{
              flexDirection: Platform.OS === "web" ? "row" : "column",
              gap: 12,
            }}
          >
            {Platform.OS !== "web" ? (
              <View
                style={{
                  width: "100%",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  padding: 12,
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                  Painel gerencial
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Visão ampla da operação e atalhos de coordenação.
                </Text>
                <View style={{ gap: 6, marginTop: 4 }}>
                  <FlatList
                    data={adminRailActions}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    contentContainerStyle={{ gap: 6 }}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => router.push({ pathname: item.route })}
                        style={adminRailActionStyle}
                      >
                        <GoAtletaIcon name={item.icon} size={14} color={colors.text} />
                        <Text style={adminRailActionTextStyle}>
                          {item.label}
                        </Text>
                      </Pressable>
                    )}
                  />
                </View>
              </View>
            ) : null}

            <View style={{ flex: 1, gap: 12 }}>
              <View
                style={{
                  flexDirection: Platform.OS === "web" ? "row" : "column",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 150,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
                    Turmas no ciclo
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
                    {classes.length}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minWidth: 150,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
                    Próximo horário
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
                    {nextScheduleSlot
                      ? nextScheduleSlot.items.length > 1
                        ? `${nextScheduleSlot.items.length} turmas em paralelo`
                        : nextScheduleSlot.reference.className
                      : "Sem aulas futuras"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                    {nextScheduleSlot
                      ? `${nextScheduleSlot.reference.dateLabel} ⬢ ${nextScheduleSlot.reference.timeLabel}`
                      : "Sem horário no momento"}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minWidth: 150,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
                    Eventos próximos
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
                    {upcomingEvents.length}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minWidth: 150,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
                    Aulas hoje
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
                    {todayAgendaItems.length}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: Platform.OS === "web" ? "row" : "column",
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 12,
                    gap: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                    Aulas de hoje
                  </Text>
                  {todayAgendaItems.length === 0 ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Nenhuma aula programada para hoje.
                    </Text>
                  ) : (
                    <FlatList
                      data={todayScheduleSlotPreview}
                      keyExtractor={(slot) => slot.key}
                      scrollEnabled={false}
                      contentContainerStyle={{ gap: 8 }}
                      renderItem={({ item: slot }) => (
                        <View
                          style={{
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            paddingVertical: 8,
                            paddingHorizontal: 10,
                            gap: 2,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                            {slot.items.length > 1
                              ? `${slot.items.length} turmas ⬢ ${slot.timeLabel}`
                              : `${slot.items[0]?.className ?? "Turma"} ⬢ ${slot.timeLabel}`}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            {slot.items
                              .slice(0, 2)
                              .map((item) => item.className)
                              .join(", ")}
                            {slot.items.length > 2 ? ` +${slot.items.length - 2}` : ""}
                          </Text>
                        </View>
                      )}
                    />
                  )}
                  {todayRemainingSlots > 0 ? (
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
                      +{todayRemainingSlots} horários restantes no dia.
                    </Text>
                  ) : null}
                </View>

                <View
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 12,
                    gap: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                    Próximos eventos
                  </Text>
                  {upcomingEvents.length === 0 ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Nenhum evento cadastrado para os próximos dias.
                    </Text>
                  ) : (
                    <FlatList
                      data={upcomingEvents.slice(0, 4)}
                      keyExtractor={(event) => event.id}
                      scrollEnabled={false}
                      contentContainerStyle={{ gap: 8 }}
                      renderItem={({ item: event }) => (
                        <Pressable
                          onPress={() => router.push({ pathname: "/events/[id]", params: { id: event.id } })}
                          style={{
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            paddingVertical: 8,
                            paddingHorizontal: 10,
                            gap: 2,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                            {event.title}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                            {new Date(event.startsAt).toLocaleDateString("pt-BR")} ⬢ {event.eventType}
                          </Text>
                        </Pressable>
                      )}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
        ) : null}

        {!isAdminDashboardContext && !usesCurrentHomeExperience ? (
          <Suspense fallback={<HomeProfessorBelowFoldFallback />}>
            <HomeProfessorBelowFold
              canOpenClassesShortcut={canOpenClassesShortcut}
              canOpenStudentsShortcut={canOpenStudentsShortcut}
              canOpenTrainingShortcut={canOpenTrainingShortcut}
              canOpenCalendarShortcut={canOpenCalendarShortcut}
              canOpenAbsenceNoticesShortcut={canOpenAbsenceNoticesShortcut}
              canOpenPeriodizationShortcut={canOpenPeriodizationShortcut}
              canOpenRegulationHistoryShortcut={canOpenRegulationHistoryShortcut}
              canOpenAssistantShortcut={canOpenAssistantShortcut}
            />
          </Suspense>
        ) : null}

      </View>

      </ScrollView>



      {Platform.OS === "web" ? null : (
        <View
          {...openSwipe.panHandlers}
          style={{
            position: "absolute",
            top: insets.top + 90,
            right: 0,
            width: 24,
            height: "100%",
          }}
        />
      )}
      { showInbox ? (

        <View

          style={{

            position: "absolute",

            top: 0,

            right: 0,

            bottom: 0,

            left: 0,

            backgroundColor: "rgba(0,0,0,0.5)",

          }}

        >

          <Pressable
            suppressWebHoverFeedback
            style={
              [
                { flex: 1 },
                Platform.OS === "web" ? ({ cursor: "default", outlineStyle: "none" } as any) : null,
              ]
            }
            onPress={closeInbox}
          />

          <Animated.View

            {...closeSwipe.panHandlers}

            style={{

              position: "absolute",

              top: insets.top,

              right: 0,

              bottom: insets.bottom,

              width: panelWidth,

              transform: [{ translateX: inboxX }],

              backgroundColor: colors.card,

              padding: 14,

              borderTopLeftRadius: 22,

              borderBottomLeftRadius: 22,
              ...(Platform.OS === "web"
                ? { boxShadow: "-6px 0px 12px rgba(0, 0, 0, 0.2)" }
                : {
                    shadowColor: "#000",
                    shadowOpacity: 0.2,
                    shadowRadius: 12,
                    shadowOffset: { width: -6, height: 0 },
                    elevation: 6,
                  }),

              gap: 12,

              paddingTop: insets.top + 12,

              paddingBottom: insets.bottom + 12,
              ...inboxPanelWebGlassStyle,

            }}

            >

            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>

              <View>

                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                  Notificações

                </Text>

              </View>

                <View style={{ flexDirection: "row", gap: 8 }}>

                  <Pressable

                    onPress={() => {

                      const handleClear = async () => {
                        await clearNotifications(
                          notificationInboxScope,
                          activeOrganization?.id,
                        );
                        const items = await getNotifications(
                          notificationInboxScope,
                          activeOrganization?.id,
                        );
                        setInbox(items);
                        setExpandedId(null);
                      };

                      void (async () => {
                        const shouldClear = await confirmDialog({
                          title: "Limpar notificações?",
                          message: "Isso remove todas as notificações do inbox.",
                          confirmLabel: "Limpar",
                          cancelLabel: "Cancelar",
                          tone: "danger",
                          onConfirm: async () => {},
                        });
                        if (!shouldClear) return;
                        await handleClear();
                      })();

                    }}

                    style={{

                      width: 36,

                      height: 36,

                      borderRadius: 18,

                      backgroundColor: colors.secondaryBg,

                      alignItems: "center",

                      justifyContent: "center",

                      borderWidth: 1,

                      borderColor: colors.border,
                    }}

                  >

                    <View

                      style={{

                        width: 14,

                        height: 12,

                        borderWidth: 2,

                        borderColor: colors.secondaryText,

                        borderRadius: 2,

                        position: "relative",

                      }}

                    >

                      <View

                        style={{

                          position: "absolute",

                          top: -6,

                          left: -2,

                          right: -2,

                          height: 3,

                          borderRadius: 2,

                          backgroundColor: colors.secondaryText,

                        }}

                      />

                      <View

                        style={{

                          position: "absolute",

                          top: -8,

                          left: 4,

                          width: 6,

                          height: 2,

                          borderRadius: 2,

                          backgroundColor: colors.secondaryText,

                        }}

                      />

                    </View>

                  </Pressable>

                  <Pressable

                    onPress={closeInbox}

                    style={{

                      width: 36,

                      height: 36,

                      borderRadius: 18,

                      backgroundColor: colors.primaryBg,

                      alignItems: "center",

                      justifyContent: "center",

                    }}

                  >

                    <View

                      style={{

                        width: 12,

                        height: 12,

                        position: "relative",

                      }}

                    >

                      <View

                        style={{

                          position: "absolute",

                          top: 5,

                          left: -1,

                          right: -1,

                          height: 2,

                          borderRadius: 2,

                          backgroundColor: colors.primaryText,

                          transform: [{ rotate: "45deg" }],

                        }}

                      />

                      <View

                        style={{

                          position: "absolute",

                          top: 5,

                          left: -1,

                          right: -1,

                          height: 2,

                          borderRadius: 2,

                          backgroundColor: colors.primaryText,

                          transform: [{ rotate: "-45deg" }],

                        }}

                      />

                    </View>

                  </Pressable>

                </View>

              </View>

              <View style={{ height: 1, backgroundColor: colors.border }} />

            { inbox.length === 0 ? (

              <Text style={{ color: colors.muted }}>Sem notificações.</Text>

            ) : (

              <View style={{ flex: 1 }}>
                <FlatList
                  data={inbox}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                  renderItem={({ item }) => {
                    const isExpanded = expandedId === item.id;
                    const preview = truncateBody(item.body, 160);
                    const showMore = !isExpanded && preview !== item.body;
                    return (
                      <View>
                        <Pressable
                          onPress={() => {
                            if (item.actionUrl) {
                              void (async () => {
                                await markNotificationRead(
                                  item.id,
                                  notificationInboxScope,
                                  activeOrganization?.id,
                                );
                                closeInbox();
                                router.push(item.actionUrl as never);
                              })();
                              return;
                            }
                            setExpandedId((prev) => (prev === item.id ? null : item.id));
                          }}
                          onLongPress={async () => {
                            await Clipboard.setStringAsync(item.body);
                          }}
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            backgroundColor: item.read ? colors.inputBg : inboxUnreadBg,
                            borderWidth: 1,
                            borderColor: item.read ? colors.border : inboxUnreadBorder,
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "700",
                              color: colors.text,
                              fontSize: 14,
                            }}
                          >
                            {item.title}
                          </Text>

                          <Text style={{ color: colors.text, fontSize: 13 }}>
                            {isExpanded ? item.body : preview}
                          </Text>

                          {showMore ? (
                            <Text style={{ color: colors.muted, fontSize: 12 }}>
                              Ler mais
                            </Text>
                          ) : null}

                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            {formatTime(item.createdAt)}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }}
                />

              </View>

            )}

          </Animated.View>

        </View>

      ) : null}

    </SafeAreaView>

  );

}

export default function HomeProfessor() {
  return <HomeProfessorScreen />;
}
