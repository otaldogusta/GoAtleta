import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import {
  useEffect,
  useCallback,
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
import { Pressable } from "../src/ui/Pressable";

import type { ClassGroup } from "../src/core/models";
import { useAuth } from "../src/auth/auth";
import { useRole } from "../src/auth/role";
import {
  flushPendingWrites,
  getAttendanceByDate,
  getClasses,
  getPendingWritesCount,
  getSessionLogsByRange,
  seedIfEmpty,
} from "../src/db/seed";
import { requestNotificationPermission } from "../src/notifications";
import {
  AppNotification,
  clearNotifications,
  getNotifications,
  markAllRead,
  subscribeNotifications,
} from "../src/notificationsInbox";
import { Card } from "../src/ui/Card";
import { ClassGenderBadge } from "../src/ui/ClassGenderBadge";
import { useAppTheme } from "../src/ui/app-theme";
import { getUnitPalette } from "../src/ui/unit-colors";
import StudentHome from "./student-home";

function TrainerHome() {
  const router = useRouter();
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { role } = useRole();
  const [inbox, setInbox] = useState<AppNotification[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [syncingWrites, setSyncingWrites] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "error";
  } | null>(null);
  const screenWidth = Dimensions.get("window").width;
  const panelWidth = Math.min(screenWidth * 0.85, 360);
  const inboxX = useRef(new Animated.Value(panelWidth)).current;
  const agendaScrollRef = useRef<ScrollView>(null);
  const [agendaWidth, setAgendaWidth] = useState(0);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const todayLabel = useMemo(() => {
    const label = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [now]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const items = await getNotifications();
      if (alive) setInbox(items);
      if (!session || role !== "trainer") return;
      await seedIfEmpty();
      const classList = await getClasses();
      if (alive) setClasses(classList);
    })();
    const unsubscribe = subscribeNotifications((items) => {
      if (!alive) return;
      setInbox(items);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [session, role]);

  useEffect(() => {
    let alive = true;
    const refreshPending = async () => {
      const count = await getPendingWritesCount();
      if (alive) setPendingWrites(count);
    };
    refreshPending();
    const interval = setInterval(refreshPending, 10000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

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

  const parseTime = (value?: string) => {
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
    return parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const todayDateKey = useMemo(() => formatIsoDate(now), [now]);
  const nowTime = useMemo(() => now.getTime(), [now]);

  const scheduleWindow = useMemo(() => {
    if (!classes.length) return [];
    const items: Array<{
      classId: string;
      className: string;
      unit: string;
      gender: ClassGroup["gender"] | null;
      dateKey: string;
      dateLabel: string;
      startTime: number;
      endTime: number;
      timeLabel: string;
    }> = [];
    for (let offset = -7; offset <= 7; offset += 1) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() + offset);
      dayDate.setHours(0, 0, 0, 0);
      const dayIndex = dayDate.getDay();
      classes.forEach((cls) => {
        const days = cls.daysOfWeek ?? [];
        if (!days.includes(dayIndex)) return;
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
  }, [classes, now]);

  const nextIndex = useMemo(() => {
    if (!scheduleWindow.length) return -1;
    return scheduleWindow.findIndex((item) => nowTime < item.endTime);
  }, [scheduleWindow, nowTime]);
  const [manualIndex, setManualIndex] = useState<number | null>(null);

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

  useEffect(() => {
    setManualIndex(null);
  }, [todayDateKey, scheduleWindow.length]);

  const fallbackIndex =
    scheduleWindow.length > 0
      ? nextIndex >= 0
        ? nextIndex
        : scheduleWindow.length - 1
      : null;
  const activeIndex = manualIndex ?? fallbackIndex;
  const activeItem = activeIndex !== null ? scheduleWindow[activeIndex] : null;
  const prevItem =
    activeIndex !== null && activeIndex > 0 ? scheduleWindow[activeIndex - 1] : null;
  const nextItem =
    activeIndex !== null && activeIndex < scheduleWindow.length - 1
      ? scheduleWindow[activeIndex + 1]
      : null;
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

  const goPrevClass = useCallback(() => {
    if (activeIndex === null) return;
    if (activeIndex <= 0) return;
    setManualIndex(activeIndex - 1);
  }, [activeIndex]);

  const goNextClass = useCallback(() => {
    if (activeIndex === null) return;
    if (activeIndex >= scheduleWindow.length - 1) return;
    setManualIndex(activeIndex + 1);
  }, [activeIndex, scheduleWindow.length]);

  const handleAgendaScrollEnd = useCallback(
    (event: any) => {
      if (!agendaWidth) return;
      const page = Math.round(event.nativeEvent.contentOffset.x / agendaWidth);
      if (page === 0) {
        goPrevClass();
      } else if (page === 2) {
        goNextClass();
      }
      requestAnimationFrame(() => {
        agendaScrollRef.current?.scrollTo({ x: agendaWidth, animated: false });
      });
    },
    [agendaWidth, goNextClass, goPrevClass]
  );

  useEffect(() => {
    if (!agendaWidth) return;
    requestAnimationFrame(() => {
      agendaScrollRef.current?.scrollTo({ x: agendaWidth, animated: false });
    });
  }, [agendaWidth, activeIndex]);

  const activeSummary = useMemo(() => {
    if (!activeItem) return null;
    return {
      unit: activeItem.unit,
      className: activeItem.className,
      dateLabel: activeItem.dateLabel,
      timeLabel: activeItem.timeLabel,
      gender: activeItem.gender,
    };
  }, [activeItem]);

  const activeAttendanceTarget = useMemo(() => {
    if (!activeItem) return null;
    return {
      classId: activeItem.classId,
      date: activeItem.dateKey,
    };
  }, [activeItem]);


  const [attendanceDone, setAttendanceDone] = useState<boolean | null>(null);
  const [reportDone, setReportDone] = useState<boolean | null>(null);
  const showAttendanceWarning = Boolean(activeAttendanceTarget) && attendanceDone === false;
  const showReportWarning = Boolean(activeAttendanceTarget) && reportDone === false;

  useEffect(() => {
    let alive = true;
    if (!activeAttendanceTarget) {
      setAttendanceDone(null);
      setReportDone(null);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        const [attendanceRecords, sessionLogs] = await Promise.all([
          getAttendanceByDate(activeAttendanceTarget.classId, activeAttendanceTarget.date),
          getSessionLogsByRange(
            activeAttendanceTarget.date + "T00:00:00.000Z",
            activeAttendanceTarget.date + "T23:59:59.999Z"
          ),
        ]);
        if (!alive) return;
        setAttendanceDone(attendanceRecords.length > 0);
        setReportDone(
          sessionLogs.some((log) => log.classId === activeAttendanceTarget.classId)
        );
      } catch {
        if (!alive) return;
        setAttendanceDone(null);
        setReportDone(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeAttendanceTarget]);

  const showToast = (message: string, type: "info" | "success" | "error") => {
    setToast({ message, type });
  };

  const handleSyncPending = async () => {
    setSyncingWrites(true);
    try {
      const result = await flushPendingWrites();
      setPendingWrites(result.remaining);
      if (result.flushed) {
        showToast(`Sincronizado: ${result.flushed} item(s).`, "success");
      }
    } catch (error) {
      showToast("Não foi possível sincronizar agora.", "error");
    } finally {
      setSyncingWrites(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        showToast("Atualização encontrada. Reiniciando...", "success");
        await Updates.reloadAsync();
        return;
      }
      showToast("Sem atualizações novas.", "info");
    } catch (error) {
      showToast("Não foi possível buscar atualizações agora.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
          <Pressable
            onPress={() => router.push({ pathname: "/notifications" })}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="settings-outline" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={openInbox}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.primaryBg,
              position: "relative",
            }}
          >
            <Ionicons name="notifications-outline" size={18} color={colors.primaryText} />
            {unreadCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  right: -4,
                  top: -4,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.dangerSolidBg,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: colors.dangerSolidText, fontSize: 11, fontWeight: "700" }}>
                  {unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

        <View style={{ gap: 14 }}>
        {pendingWrites > 0 ? (
          <View
            style={{
              padding: 14,
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Sincronizacao pendente
            </Text>
            <Text style={{ color: colors.muted }}>
              {pendingWrites} item(s) aguardando envio.
            </Text>
            <Pressable
              onPress={handleSyncPending}
              disabled={syncingWrites}
              style={{
                alignSelf: "flex-start",
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: syncingWrites ? colors.primaryDisabledBg : colors.primaryBg,
              }}
            >
              <Text
                style={{
                  color: syncingWrites ? colors.secondaryText : colors.primaryText,
                  fontWeight: "700",
                }}
              >
                {syncingWrites ? "Sincronizando..." : "Sincronizar agora"}
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
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
          }}
        >
          <View style={{ gap: 12 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Agenda do dia
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Turmas, treino e chamada em um lugar
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
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <ScrollView
                horizontal
                pagingEnabled
                ref={agendaScrollRef}
                showsHorizontalScrollIndicator={false}
                scrollEnabled={scheduleWindow.length > 1}
                onMomentumScrollEnd={handleAgendaScrollEnd}
                contentOffset={{ x: agendaWidth, y: 0 }}
              >
                {[prevItem, activeItem, nextItem].map((item, idx) => {
                  const key = item ? item.classId : `empty-${idx}`;
                  if (!item) {
                    return <View key={key} style={{ width: agendaWidth || "100%" }} />;
                  }
                  const label = getStatusLabelForItem(item);
                  const isPast = item.endTime <= nowTime;
                  return (
                    <View key={key} style={{ width: agendaWidth || "100%" }}>
                      <View style={{ gap: 8, opacity: isPast ? 0.55 : 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <View
                            style={{
                              paddingVertical: 2,
                              paddingHorizontal: 8,
                              borderRadius: 999,
                              backgroundColor: colors.card,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                              {label}
                            </Text>
                          </View>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.dateLabel}</Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
                          {item.className}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 10,
                                borderRadius: 999,
                                backgroundColor: getUnitPalette(item.unit, colors).bg,
                                borderWidth: 1,
                                borderColor: getUnitPalette(item.unit, colors).bg,
                              }}
                            >
                              <Text
                                style={{
                                  color: getUnitPalette(item.unit, colors).text,
                                  fontSize: 11,
                                  fontWeight: "700",
                                }}
                              >
                                {item.unit}
                              </Text>
                            </View>
                            {item.gender ? (
                              <ClassGenderBadge gender={item.gender} size="sm" />
                            ) : null}
                          </View>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.timeLabel}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
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
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: activeAttendanceTarget
                    ? colors.secondaryBg
                    : colors.primaryDisabledBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: activeAttendanceTarget ? 1 : 0.7,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11, lineHeight: 12 }}>
                  Abrir plano
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
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: activeAttendanceTarget
                    ? colors.secondaryBg
                    : colors.primaryDisabledBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: activeAttendanceTarget ? 1 : 0.7,
                  alignItems: "center",
                  position: "relative",
                }}
              >
                {showAttendanceWarning ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.warningBg,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.warningText ?? colors.text,
                        fontSize: 10,
                        fontWeight: "800",
                      }}
                    >
                      !
                    </Text>
                  </View>
                ) : null}
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11, lineHeight: 12 }}>
                  Fazer chamada
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
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: activeAttendanceTarget
                    ? colors.secondaryBg
                    : colors.primaryDisabledBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: activeAttendanceTarget ? 1 : 0.7,
                  alignItems: "center",
                  position: "relative",
                }}
              >
                {showReportWarning ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.warningBg,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.warningText ?? colors.text,
                        fontSize: 10,
                        fontWeight: "800",
                      }}
                    >
                      !
                    </Text>
                  </View>
                ) : null}
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11, lineHeight: 12 }}>
                  Fazer relatório
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
                      tab: "scouting",
                    },
                  });
                }}
                disabled={!activeAttendanceTarget}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: activeAttendanceTarget
                    ? colors.secondaryBg
                    : colors.primaryDisabledBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: activeAttendanceTarget ? 1 : 0.7,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11, lineHeight: 12 }}>
                  Scouting
                </Text>
              </Pressable>
            </View>
          </View>
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
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
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
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
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
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
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
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Calendário semanal
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Aulas e chamada
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/reports" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Relatórios
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Presença e dados
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/absence-notices" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
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
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Exercicios
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Biblioteca com videos
              </Text>
            </Pressable>
          </View>
        </View>

        <Card
          title="Periodizacao"
          subtitle="Ciclos e cargas"
          onPress={() => router.push({ pathname: "/periodization" })}
        />
      </ScrollView>

      <View
        {...openSwipe.panHandlers}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 24,
          height: "100%",
        }}
      />

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

      {showInbox ? (
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
            {inbox.length === 0 ? (
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
                          {showMore ? (
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

      {toast ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 96,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor:
              toast.type === "success"
                ? colors.successBg
                : toast.type === "error"
                ? colors.dangerBg
                : colors.card,
            borderWidth: 1,
            borderColor:
              toast.type === "success"
                ? colors.successBg
                : toast.type === "error"
                ? colors.dangerBorder
                : colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          <Text
            style={{
              color:
                toast.type === "success"
                  ? colors.successText
                  : toast.type === "error"
                  ? colors.dangerText
                  : colors.text,
              fontWeight: "600",
            }}
          >
            {toast.message}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export default function Home() {
  const { role, loading } = useRole();
  if (loading) return null;
  if (role === "student") {
    return <StudentHome />;
  }
  return <TrainerHome />;
}
