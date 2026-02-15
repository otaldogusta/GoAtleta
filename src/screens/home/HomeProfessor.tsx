import { Ionicons } from "@expo/vector-icons";


import * as Clipboard from "expo-clipboard";

import { Link, useRouter } from "expo-router";

import { useFocusEffect } from "@react-navigation/native";

import * as Updates from "expo-updates";

import { Image } from "expo-image";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    useCallback,
    useEffect,
    useMemo,

    useRef,

    useState
} from "react";

import {
    Alert,

    Animated,

    Dimensions,

    PanResponder,

    Platform,

    RefreshControl,

    ScrollView,
    Text,

    View
} from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "../../ui/Pressable";

import { EventListItem, listUpcomingEvents } from "../../api/events";
import { getMyProfilePhoto, setMyProfilePhoto } from "../../api/profile-photo";
import { uploadMyProfilePhoto } from "../../api/profile-photo-storage";



import type { ClassGroup } from "../../core/models";

import { useAuth } from "../../auth/auth";

import { useRole } from "../../auth/role";
import { useEffectiveProfile } from "../../core/effective-profile";

import { useSmartSync } from "../../core/use-smart-sync";

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

    subscribeNotifications,
} from "../../notificationsInbox";

import { useOrganization } from "../../providers/OrganizationProvider";

import { Card } from "../../ui/Card";

import { ClassGenderBadge } from "../../ui/ClassGenderBadge";

import { LocationBadge } from "../../ui/LocationBadge";

import { SyncStatusBadge } from "../../ui/SyncStatusBadge";

import { FadeHorizontalScroll } from "../../ui/FadeHorizontalScroll";

import { ShimmerBlock } from "../../ui/Shimmer";

import { useAppTheme } from "../../ui/app-theme";

import { getUnitPalette } from "../../ui/unit-colors";

import { useSaveToast } from "../../ui/save-toast";



export function HomeProfessorScreen({
  adminHeader,
}: {
  adminHeader?: import("react").ReactNode;
} = {}) {

  const router = useRouter();

  const { colors, mode } = useAppTheme();

  // Glass overlay function no longer needed - using native component styling instead

  const insets = useSafeAreaInsets();

  const { session } = useAuth();

  const { role } = useRole();
  const effectiveProfile = useEffectiveProfile();

  const {
    activeOrganization,
    isLoading: organizationLoading,
  } = useOrganization();
  const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const canSeeCoordination = isOrgAdmin || effectiveProfile === "admin";

  const [inbox, setInbox] = useState<AppNotification[]>([]);

  const [showInbox, setShowInbox] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const agendaScrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(false);

  const [upcomingEvents, setUpcomingEvents] = useState<EventListItem[]>([]);

  const [loadingEvents, setLoadingEvents] = useState(false);

  const [agendaRefreshToken, setAgendaRefreshToken] = useState(0);

  const didInitialAgendaScroll = useRef(false);

  // Use smart sync instead of manual pending writes management
  const { syncing, pendingCount, lastSyncAt, lastError, syncNow } = useSmartSync();

  const { showSaveToast } = useSaveToast();

  const screenWidth = Dimensions.get("window").width;

  const panelWidth = Math.min(screenWidth * 0.85, 360);

  const inboxX = useRef(new Animated.Value(panelWidth)).current;

  const agendaScrollRef = useRef<ScrollView>(null);

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
  }, [role, session?.user?.id]);



  useEffect(() => {

    let alive = true;

    (async () => {
      try {
        const items = await getNotifications();
        if (alive) setInbox(items);
      } catch {
        if (alive) setInbox([]);
      }

      if (!session || role !== "trainer") {
        if (alive) {
          setLoadingClasses(false);
          setLoadingEvents(false);
        }
        return;
      }

      if (organizationLoading) {
        if (alive) {
          setLoadingClasses(true);
          setLoadingEvents(true);
        }
        return;
      }

      if (alive) {
        setLoadingClasses(true);
        setLoadingEvents(true);
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

        await seedIfEmpty();

        const organizationId = activeOrganization?.id ?? null;

        const [classListResult, eventsListResult] = await Promise.allSettled([
          getClasses({ organizationId }),
          organizationId
            ? listUpcomingEvents({
                organizationId,
                userId: session.user.id,
                days: 7,
              })
            : Promise.resolve([] as EventListItem[]),
        ]);

        if (alive) {
          setClasses(classListResult.status === "fulfilled" ? classListResult.value : []);
          setUpcomingEvents(eventsListResult.status === "fulfilled" ? eventsListResult.value : []);
          setAgendaRefreshToken((value) => value + 1);
        }

      } finally {

        if (alive) setLoadingClasses(false);
        if (alive) setLoadingEvents(false);

      }

    })();

    void resolveProfilePhoto().then((uri) => {
      if (alive) setProfilePhotoUri(uri);
    });

    const unsubscribe = subscribeNotifications((items) => {

      if (!alive) return;

      setInbox(items);

    });

    return () => {

      alive = false;

      unsubscribe();

    };

  }, [session, role, activeOrganization?.id, organizationLoading, resolveProfilePhoto]);



  useFocusEffect(

    useCallback(() => {

      let active = true;

      void resolveProfilePhoto().then((uri) => {
        if (active) setProfilePhotoUri(uri);
      });

      return () => {

        active = false;

      };

    }, [resolveProfilePhoto])

  );



  const unreadCount = inbox.filter((item) => !item.read).length;



  const openInbox = async () => {

    await requestNotificationPermission();

    setShowInbox(true);

    Animated.timing(inboxX, {

      toValue: 0,

      duration: 220,

      useNativeDriver: true,

    }).start();

    await markAllRead();

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



  const openSwipe = useRef(

    PanResponder.create({

      onMoveShouldSetPanResponder: (_, gesture) => gesture.dx < -12,

      onPanResponderRelease: (_, gesture) => {

        if (gesture.dx < -30) {

          void openInbox();

        }

      },

    })

  ).current;



  const closeSwipe = useRef(

    PanResponder.create({

      onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 12,

      onPanResponderRelease: (_, gesture) => {

        if (gesture.dx > 30) {

          closeInbox();

        }

      },

    })

  ).current;



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

  const nowTime = useMemo(() => now.getTime(), [now]);

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

    for (let offset = -7; offset <= 7; offset += 1) {

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

  }, [classesByWeekday, scheduleBaseDate]);



  const autoIndex = useMemo(() => {

    if (!scheduleWindow.length) return null;

    let nextIndex = -1;
    for (let index = 0; index < scheduleWindow.length; index += 1) {
      const item = scheduleWindow[index];
      if (nowTime >= item.startTime && nowTime < item.endTime) {
        return index;
      }
      if (nextIndex === -1 && item.startTime > nowTime) {
        nextIndex = index;
      }
    }
    if (nextIndex !== -1) return nextIndex;

    return scheduleWindow.length ? scheduleWindow.length - 1 : null;

  }, [scheduleWindow, nowTime]);

  const [manualIndex, setManualIndex] = useState<number | null>(null);



  useEffect(() => {

    if (!scheduleWindow.length || autoIndex === null) {

      setManualIndex(null);

      return;

    }

    if (manualIndex == null) {

      setManualIndex(autoIndex);

    }

  }, [autoIndex, manualIndex, scheduleWindow.length]);



  useEffect(() => {

    if (manualIndex == null) return;

    if (!scheduleWindow.length) {

      setManualIndex(null);

      return;

    }

    if (manualIndex >= scheduleWindow.length) {

      setManualIndex(null);

      return;

    }

  }, [manualIndex, scheduleWindow.length]);



  const activeIndex = manualIndex ?? autoIndex;

  const activeItem = activeIndex !== null ? scheduleWindow[activeIndex] : null;

  const agendaCardGap = 10;

  const agendaCardWidth = useMemo(() => {

    if (!agendaWidth) return 240;

    const target = Math.max(180, Math.min(agendaWidth * 0.72, 260));

    return Math.round(target);

  }, [agendaWidth]);

  const agendaScrollStyle = useMemo(() => {

    if (Platform.OS !== "web") return undefined;

    return { scrollSnapType: "x mandatory", scrollBehavior: "smooth" } as const;

  }, []);

  const agendaSnapOffsets = useMemo(() => {

    if (!agendaWidth || !scheduleWindow.length) return undefined;

    const size = agendaCardWidth + agendaCardGap;

    return scheduleWindow.map((_, index) => index * size);

  }, [agendaCardGap, agendaCardWidth, agendaWidth, scheduleWindow]);

  const getStatusLabelForItem = useCallback(

    (item: (typeof scheduleWindow)[number]) => {

      if (item.dateKey === todayDateKey) {

        if (nowTime >= item.startTime && nowTime < item.endTime) {

          return "Aula de hoje";

        }

        if (item.endTime <= nowTime) return "Aula anterior";

        return "Próxima aula";

      }

      return item.dateKey < todayDateKey ? "Aula anterior" : "Próxima aula";

    },

    [nowTime, todayDateKey]

  );



  const handleAgendaScrollEnd = useCallback(

    (event: any) => {

      if (!scheduleWindow.length) return;

      const offset = event.nativeEvent.contentOffset.x;

      const size = agendaCardWidth + agendaCardGap;

      if (!size) return;

      const index = Math.max(0, Math.min(scheduleWindow.length - 1, Math.round(offset / size)));

      setManualIndex(index);

    },

    [agendaCardGap, agendaCardWidth, scheduleWindow.length]

  );

  const handleAgendaCardPress = useCallback(

    (index: number) => {

      setManualIndex(index);

      const size = agendaCardWidth + agendaCardGap;

      if (!size) return;

      agendaScrollRef.current.scrollTo({ x: index * size, animated: true });

    },

    [agendaCardGap, agendaCardWidth]

  );

  const handleAgendaScroll = useCallback(

    (event: any) => {

      if (Platform.OS !== "web" || !scheduleWindow.length) return;

      const offset = event.nativeEvent.contentOffset.x;

      const size = agendaCardWidth + agendaCardGap;

      if (!size) return;

      const index = Math.max(0, Math.min(scheduleWindow.length - 1, Math.round(offset / size)));

      if (agendaScrollEndTimer.current) {

        clearTimeout(agendaScrollEndTimer.current);

      }

      agendaScrollEndTimer.current = setTimeout(() => {

        if (manualIndex !== index) setManualIndex(index);

      }, 120);

    },

    [agendaCardGap, agendaCardWidth, manualIndex, scheduleWindow.length]

  );



  useEffect(() => {

    if (didInitialAgendaScroll.current) return;

    if (manualIndex != null) return;

    if (autoIndex == null || !agendaWidth) return;

    didInitialAgendaScroll.current = true;

    const offset = (agendaCardWidth + agendaCardGap) * autoIndex;

    requestAnimationFrame(() => {

      agendaScrollRef.current.scrollTo({ x: offset, animated: false });

    });

  }, [agendaCardGap, agendaCardWidth, agendaWidth, autoIndex, manualIndex]);



  useEffect(() => {

    didInitialAgendaScroll.current = false;

  }, [activeOrganization?.id, scheduleWindow.length, todayDateKey]);

  useEffect(() => {
    setManualIndex(null);
    didInitialAgendaScroll.current = false;
    requestAnimationFrame(() => {
      agendaScrollRef.current?.scrollTo({ x: 0, animated: false });
    });
  }, [activeOrganization?.id]);



  useEffect(() => {

    if (agendaRefreshToken === 0) return;

    if (autoIndex == null || !agendaWidth) return;

    const offset = (agendaCardWidth + agendaCardGap) * autoIndex;

    requestAnimationFrame(() => {

      agendaScrollRef.current.scrollTo({ x: offset, animated: true });

    });

  }, [agendaCardGap, agendaCardWidth, agendaRefreshToken, autoIndex, agendaWidth]);

  const activeAttendanceTarget = useMemo(() => {

    if (!activeItem) return null;

    return {

      classId: activeItem.classId,

      date: activeItem.dateKey,

    };

  }, [activeItem]);
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



  const refreshHomeData = useCallback(async () => {

    const tasks: Promise<unknown>[] = [
      getNotifications().then(setInbox).catch(() => setInbox([])),
    ];

    tasks.push(
      resolveProfilePhoto()
        .then(setProfilePhotoUri)
        .catch(() => setProfilePhotoUri(null))
    );

    if (session && role === "trainer" && !organizationLoading) {

      setLoadingClasses(true);
      setLoadingEvents(true);

      tasks.push(

        seedIfEmpty()

          .then(() =>
            getClasses({ organizationId: activeOrganization?.id ?? null })
          )

          .then(setClasses)
          .catch(() => setClasses([]))

          .finally(() => setLoadingClasses(false))

      );

      tasks.push(
        (activeOrganization?.id
          ? listUpcomingEvents({
              organizationId: activeOrganization.id,
              userId: session.user.id,
              days: 7,
            })
          : Promise.resolve([] as EventListItem[])
        )
          .then(setUpcomingEvents)
          .catch(() => setUpcomingEvents([]))
          .finally(() => setLoadingEvents(false))
      );

    } else if (organizationLoading) {
      setLoadingClasses(true);
      setLoadingEvents(true);
    } else {
      setLoadingClasses(false);
      setLoadingEvents(false);
    }

    await Promise.allSettled(tasks);

    setNow(new Date());

  }, [
    role,
    session,
    activeOrganization?.id,
    organizationLoading,
    resolveProfilePhoto,
  ]);



  const onRefresh = async () => {

    if (refreshing) return;

    setRefreshing(true);

    try {

      if (Updates.isEnabled && Platform.OS !== "web") {

        try {

          const update = await Updates.checkForUpdateAsync();

          if (update.isAvailable) {

            await Updates.fetchUpdateAsync();

            showToast("Atualização encontrada. Reiniciando...", "success");

            await Updates.reloadAsync();

            return;

          }

        } catch {

          // ignore update check errors in dev

        }

      }

      await refreshHomeData();

      setManualIndex(null);

      setAgendaRefreshToken((value) => value + 1);

      showToast("Atualizado.", "success");

    } catch (error) {

      showErrorToast(error);

    } finally {

      setRefreshing(false);

    }

  };

  const isAndroidLight = Platform.OS === "android" && mode === "light";
  const shortcutCardSurfaceStyle = isAndroidLight
    ? {
        backgroundColor: "#ffffff",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }
      : {
        backgroundColor: colors.card,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOpacity: mode === "dark" ? 0.28 : 0.08,
        shadowRadius: mode === "dark" ? 10 : 6,
        shadowOffset: { width: 0, height: 4 },
        elevation: mode === "dark" ? 6 : 2,
      };

  return (

    <SafeAreaView

      style={{ flex: 1, backgroundColor: colors.background }}

    >

      <ScrollView

        contentContainerStyle={{ padding: 16, gap: 14 }}

        refreshControl={
          Platform.OS === "web"
            ? undefined
            : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }

      >

        <View

        style={{

          flexDirection: "row",

          alignItems: "center",

          justifyContent: "space-between",

          marginBottom: 14,

        }}

      >

        <View>

          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>

            Hoje

          </Text>

          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>

            {todayLabel}

          </Text>

        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>

          <View style={{ position: "relative" }}>
            <Pressable

              onPress={openInbox}

              style={{

                paddingHorizontal: 12,

                paddingVertical: 8,

                borderRadius: 999,

                backgroundColor: colors.primaryBg,

              }}

            >

              <Ionicons name="notifications-outline" size={18} color={colors.primaryText} />

            </Pressable>

            { unreadCount > 0 ? (

              <View

                style={{

                  position: "absolute",

                  right: -12,

                  top: -12,

                  minWidth: 20,

                  height: 20,

                  borderRadius: 10,

                  backgroundColor: colors.warningBg,

                  alignItems: "center",

                  justifyContent: "center",

                  zIndex: 10,

                  borderWidth: 1,

                  borderColor: "rgba(17, 26, 45, 0.5)",

                  pointerEvents: "none",

                }}

              >

                <Text style={{ color: colors.text, fontSize: 10, fontWeight: "800" }}>

                  !

                </Text>

              </View>

            ) : null}
          </View>

          <Link href="/profile" asChild>

            <Pressable

            style={{

              width: 56,

              height: 56,

              borderRadius: 999,

              backgroundColor: colors.card,

              borderWidth: 1,

              borderColor: colors.border,
              alignItems: "center",

              justifyContent: "center",

              shadowColor: "#000",

              shadowOpacity: 0.1,

              shadowRadius: 10,

              shadowOffset: { width: 0, height: 6 },

              elevation: 4,

            }}

          >

            <View

              style={{

                width: 44,

                height: 44,

                borderRadius: 999,

                backgroundColor: colors.secondaryBg,

                alignItems: "center",

                justifyContent: "center",
              }}

            >

              <Ionicons name="person" size={22} color={colors.text} />

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

        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Agenda do dia
            </Text>
          </View>
          <View
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (width && width !== agendaWidth) setAgendaWidth(width);
            }}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <FadeHorizontalScroll
              key={`agenda-${activeOrganization?.id ?? "none"}-${todayDateKey}`}
              ref={agendaScrollRef}
              scrollEnabled={scheduleWindow.length > 1}
              scrollStyle={agendaScrollStyle}
              onMomentumScrollEnd={handleAgendaScrollEnd}
              onScroll={handleAgendaScroll}
              snapToOffsets={agendaSnapOffsets}
              snapToAlignment="start"
              disableIntervalMomentum
              decelerationRate="fast"
              fadeColor={colors.secondaryBg}
              fadeWidth={8}
              contentContainerStyle={{ paddingRight: agendaCardGap }}
            >
              { loadingClasses && scheduleWindow.length === 0 ? (
                <View style={{ flexDirection: "row", gap: agendaCardGap, paddingVertical: 2 }}>
                  <ShimmerBlock
                    style={{ width: agendaCardWidth, height: 92, borderRadius: 14 }}
                  />
                  <ShimmerBlock
                    style={{ width: agendaCardWidth, height: 92, borderRadius: 14 }}
                  />
                </View>
              ) : scheduleWindow.length === 0 ? (
                <View style={{ paddingVertical: 6 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Nenhuma aula programada no período.
                  </Text>
                </View>
              ) : (
                scheduleWindow.map((item, idx) => {
                  if (!item) return null;
                  const label = getStatusLabelForItem(item);
                  const isPast = item.endTime <= nowTime;
                  const isActive = activeIndex === idx;
                  const activeBorderColor =
                    isAndroidLight
                      ? "rgba(15,23,42,0.16)"
                      : mode === "light"
                        ? colors.border
                        : colors.primaryBg;
                  return (
                    <Pressable
                      key={`${item.classId}-${item.dateKey}`}
                      onPress={() => handleAgendaCardPress(idx)}
                      style={{
                        width: agendaCardWidth,
                        marginRight: idx === scheduleWindow.length - 1 ? 0 : agendaCardGap,
                        ...(Platform.OS === "web"
                           ? ({ scrollSnapAlign: "start" } as const)
                          : null),
                      }}
                    >
                      <View
                        style={{
                          borderRadius: 14,
                          backgroundColor: "transparent",
                          ...(isActive
                            && Platform.OS !== "android"
                            ? {
                                shadowColor: mode === "dark" ? colors.primaryBg : "#000",
                                shadowOpacity: mode === "dark" ? 0.42 : 0.12,
                                shadowRadius: mode === "dark" ? 12 : 6,
                                shadowOffset: { width: 0, height: 4 },
                                elevation: mode === "dark" ? 8 : 3,
                              }
                            : null),
                        }}
                      >
                        <View
                          style={{
                            padding: 10,
                            borderRadius: 14,
                            backgroundColor: colors.card,
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: isActive ? activeBorderColor : colors.border,
                            opacity: isPast ? 0.6 : 1,
                          }}
                        >
                        <View style={{ gap: 6 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 6,
                            }}
                          >
                            <View
                              style={{
                                paddingVertical: 2,
                                paddingHorizontal: 8,
                                borderRadius: 999,
                                backgroundColor: colors.secondaryBg,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                                {label}
                              </Text>
                            </View>
                            <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                              {item.dateLabel}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <Text
                              style={{ color: colors.text, fontSize: 14, fontWeight: "800", flex: 1 }}
                              numberOfLines={1}
                            >
                              {item.className}
                            </Text>
                            <LocationBadge
                              location={item.unit ?? ""}
                              palette={getUnitPalette(item.unit ?? "Sem unidade", colors)}
                              size="sm"
                              showIcon={true}
                            />
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {item.gender ? <ClassGenderBadge gender={item.gender} size="sm" /> : null}
                            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
                              {item.timeLabel}
                            </Text>
                          </View>
                        </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </FadeHorizontalScroll>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => {
                if (!activeAttendanceTarget) return;
                router.push({
                  pathname: "/class/[id]/session",
                  params: {
                    id: activeAttendanceTarget.classId,
                    date: activeAttendanceTarget.date,
                    tab: "treino",
                  },
                });
              }}
              disabled={!activeAttendanceTarget}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: activeAttendanceTarget
                  ? colors.secondaryBg
                  : colors.primaryDisabledBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                opacity: activeAttendanceTarget ? 1 : 0.6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                Planejamento
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!activeAttendanceTarget) return;
                router.push({
                  pathname: "/class/[id]/attendance",
                  params: {
                    id: activeAttendanceTarget.classId,
                    date: activeAttendanceTarget.date,
                  },
                });
              }}
              disabled={!activeAttendanceTarget}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: activeAttendanceTarget
                  ? colors.secondaryBg
                  : colors.primaryDisabledBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                opacity: activeAttendanceTarget ? 1 : 0.6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                Chamada
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!activeAttendanceTarget) return;
                router.push({
                  pathname: "/class/[id]/session",
                  params: {
                    id: activeAttendanceTarget.classId,
                    date: activeAttendanceTarget.date,
                    tab: "relatório",
                  },
                });
              }}
              disabled={!activeAttendanceTarget}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: activeAttendanceTarget
                  ? colors.secondaryBg
                  : colors.primaryDisabledBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                opacity: activeAttendanceTarget ? 1 : 0.6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                Relatórios
              </Text>
            </Pressable>
          </View>
        </View>
        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Próximos 7 dias
            </Text>
            <Pressable onPress={() => router.push({ pathname: "/events" })}>
              <Text style={{ color: colors.primaryBg, fontWeight: "700", fontSize: 12 }}>
                Ver tudo
              </Text>
            </Pressable>
          </View>
          {loadingEvents && upcomingEvents.length === 0 ? (
            <View style={{ gap: 8 }}>
              <ShimmerBlock style={{ height: 60, borderRadius: 12 }} />
              <ShimmerBlock style={{ height: 60, borderRadius: 12 }} />
            </View>
          ) : upcomingEvents.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Nenhum evento cadastrado para os próximos dias.
            </Text>
          ) : (
            upcomingEvents.slice(0, 4).map((event) => {
              const start = new Date(event.startsAt);
              const end = new Date(event.endsAt);
              return (
                <Pressable
                  key={event.id}
                  onPress={() =>
                    router.push({ pathname: "/events/[id]", params: { id: event.id } })
                  }
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                    {event.title}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {start.toLocaleDateString("pt-BR")} â€¢{" "}
                    {start.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {end.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                        {event.eventType}
                      </Text>
                    </View>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                        {event.sport}
                      </Text>
                    </View>
                    {event.hasMyClass ? (
                      <View
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          backgroundColor: colors.primaryBg,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primaryText,
                            fontSize: 10,
                            fontWeight: "700",
                          }}
                        >
                          Minhas turmas
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
        <View style={{ gap: 10 }}>

          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

            Atalhos

          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>

            <Pressable

              onPress={() => router.push({ pathname: "/training" })}

              style={{

                flexBasis: "48%",

                padding: 14,

                borderRadius: 18,

                ...shortcutCardSurfaceStyle,

              }}

            >





              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                Planejamento

              </Text>

              <Text style={{ color: colors.muted, marginTop: 6 }}>

                Modelos e planejamentos

              </Text>

            </Pressable>

            <Pressable

              onPress={() => router.push({ pathname: "/classes" })}

              style={{

                flexBasis: "48%",

                padding: 14,

                borderRadius: 18,

                ...shortcutCardSurfaceStyle,

              }}

            >





              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                Turmas

              </Text>

              <Text style={{ color: colors.muted, marginTop: 6 }}>

                Cadastros e lista

              </Text>

            </Pressable>

            <Pressable

              onPress={() => router.push({ pathname: "/students" })}

              style={{

                flexBasis: "48%",

                padding: 14,

                borderRadius: 18,

                ...shortcutCardSurfaceStyle,

              }}

            >





              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                Alunos

              </Text>

              <Text style={{ color: colors.muted, marginTop: 6 }}>

                Lista e chamada

              </Text>

            </Pressable>

            <Pressable

              onPress={() => router.push({ pathname: "/calendar" })}

              style={{

                flexBasis: "48%",

                padding: 14,

                borderRadius: 18,

                ...shortcutCardSurfaceStyle,

              }}

            >





              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                Calendário semanal

              </Text>

              <Text style={{ color: colors.muted, marginTop: 6 }}>

                Aulas e chamada

              </Text>

            </Pressable>

            {canSeeCoordination ? (
            <Pressable

              onPress={() => router.push({ pathname: "/coordination" })}

              style={{

                flexBasis: "48%",

                padding: 14,

                borderRadius: 18,

                ...shortcutCardSurfaceStyle,

              }}

            >





              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                Coordenação

              </Text>

              <Text style={{ color: colors.muted, marginTop: 6 }}>

                Dashboard e gerenciar membros

              </Text>

            </Pressable>
            ) : null}


            <Pressable

              onPress={() => router.push({ pathname: "/qr-scan" })}

              style={{

                flexBasis: "48%",

                padding: 14,

                borderRadius: 18,

                ...shortcutCardSurfaceStyle,

              }}

            >





              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                Scanner QR

              </Text>

              <Text style={{ color: colors.muted, marginTop: 6 }}>

                Ler QR Code

              </Text>

            </Pressable>

            <Pressable

              onPress={() => router.push({ pathname: "/absence-notices" })}

              style={{

                flexBasis: "48%",

                padding: 14,

                borderRadius: 18,

                ...shortcutCardSurfaceStyle,

              }}

            >





              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                Avisos de ausência

              </Text>

              <Text style={{ color: colors.muted, marginTop: 6 }}>

                Alunos ausentes

              </Text>

            </Pressable>

            <Pressable

              onPress={() => router.push({ pathname: "/exercises" })}

              style={{

                flexBasis: "48%",

                padding: 14,

                borderRadius: 18,

                ...shortcutCardSurfaceStyle,

              }}

            >





              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                Exercícios

              </Text>

              <Text style={{ color: colors.muted, marginTop: 6 }}>

                Biblioteca com vídeos

              </Text>

            </Pressable>

          </View>

        </View>



        <Card

          title="Periodização"

          subtitle="Ciclos e cargas"

          onPress={() => router.push({ pathname: "/periodization" })}

        />

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



      <Pressable

        onPress={() => router.push({ pathname: "/assistant" })}

        style={{

          position: "absolute",

          right: 16,

          bottom: 24,

          width: 58,

          height: 58,

          borderRadius: 29,

          backgroundColor: colors.primaryBg,

          alignItems: "center",

          justifyContent: "center",

          shadowColor: "#000",

          shadowOpacity: 0.25,

          shadowRadius: 12,

          shadowOffset: { width: 0, height: 8 },

          elevation: 6,

        }}

      >

        <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 16 }}>

          AI

        </Text>

      </Pressable>



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

          <Pressable style={{ flex: 1 }} onPress={closeInbox} />

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

              shadowColor: "#000",

              shadowOpacity: 0.2,

              shadowRadius: 12,

              shadowOffset: { width: -6, height: 0 },

              elevation: 6,

              gap: 12,

              paddingTop: insets.top + 12,

              paddingBottom: insets.bottom + 12,

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

                        await clearNotifications();

                        const items = await getNotifications();

                        setInbox(items);

                        setExpandedId(null);

                      };

                      if (Platform.OS === "web") {

                        void handleClear();

                        return;

                      }

                      Alert.alert(

                        "Limpar notificações?",

                        "Isso remove todas as notificações do inbox.",

                        [

                          { text: "Cancelar", style: "cancel" },

                          {

                            text: "Limpar",

                            style: "destructive",

                            onPress: async () => {

                              await handleClear();

                            },

                          },

                        ]

                      );

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

                <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>

                  {inbox.map((item) => {

                    const isExpanded = expandedId === item.id;

                    const preview = truncateBody(item.body, 160);

                    const showMore = !isExpanded && preview !== item.body;

                    return (

                      <View key={item.id}>

                        <Pressable

                          onPress={() =>

                            setExpandedId((prev) => (prev === item.id ? null : item.id))

                          }

                          onLongPress={async () => {

                            await Clipboard.setStringAsync(item.body);

                          }}

                          style={{

                            padding: 10,

                            borderRadius: 12,

                            backgroundColor: item.read
                              ? colors.inputBg
                              : mode === "dark"
                               ? "#1e293b"
                              : (colors.background === "#0b1220" ? "#1e293b" : "#eef2ff"),

                            borderWidth: 1,

                            borderColor: item.read
                              ? colors.border
                              : mode === "dark"
                               ? "#334155"
                              : (colors.background === "#0b1220" ? "#334155" : "#c7d2fe"),

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

                          { showMore ? (

                            <Text style={{ color: colors.muted, fontSize: 12 }}>

                              Ler mais

                            </Text>

                          ) : null}

                          <Text style={{ color: colors.muted, fontSize: 11 }}>

                            {formatTime(item.createdAt)}

                          </Text>

                        </Pressable>

                        <View

                          style={{

                            height: 1,

                            backgroundColor: colors.border,

                            marginTop: 10,

                          }}

                        />

                      </View>

                    );

                  })}

                </ScrollView>

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
