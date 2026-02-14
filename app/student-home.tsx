import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRole } from "../src/auth/role";
import { setRoleOverride } from "../src/auth/role-override";
import type { ClassGroup } from "../src/core/models";
import { getClasses } from "../src/db/seed";
import {
    AppNotification,
    getNotifications,
    subscribeNotifications,
} from "../src/notificationsInbox";
import { useAppTheme } from "../src/ui/app-theme";
import { FadeHorizontalScroll } from "../src/ui/FadeHorizontalScroll";
import { Pressable } from "../src/ui/Pressable";
import { ShimmerBlock } from "../src/ui/Shimmer";
import { getUnitPalette } from "../src/ui/unit-colors";

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

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatShortDate = (iso: string) => {
  const parsed = new Date(iso + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
};

export default function StudentHome() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { student, refresh: refreshRole } = useRole();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [inbox, setInbox] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const profilePhotoUri = student?.photoUrl ?? null;
  const [now, setNow] = useState(() => new Date());
  const agendaScrollRef = useRef<ScrollView>(null);
  const [agendaWidth, setAgendaWidth] = useState(0);
  const [manualAgendaIndex, setManualAgendaIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [items, classList] = await Promise.all([
          getNotifications(),
          getClasses(),
        ]);
        if (!alive) return;
        setInbox(items);
        setClasses(classList);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const unsubscribe = subscribeNotifications((items) => {
      if (!alive) return;
      setInbox(items);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

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

  const nowTime = now.getTime();
  const todayDateKey = useMemo(() => formatIsoDate(now), [now]);

  const scheduleWindow = useMemo(() => {
    const items: {
      classId: string;
      className: string;
      unit: string;
      dateKey: string;
      dateLabel: string;
      startTime: number;
      endTime: number;
      timeLabel: string;
    }[] = [];

    for (let offset = -1; offset <= 7; offset += 1) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() + offset);
      dayDate.setHours(0, 0, 0, 0);
      const dayIndex = dayDate.getDay();

      classes.forEach((cls) => {
        if (!cls.daysOfWeek.includes(dayIndex)) return;
        const time = parseTime(cls.startTime);
        if (!time) return;

        const start = new Date(dayDate);
        start.setHours(time.hour, time.minute, 0, 0);

        const duration = cls.durationMinutes ?? 60;
        const end = new Date(start.getTime() + duration * 60000);

        items.push({
          classId: cls.id,
          className: cls.name,
          unit: cls.unit || 'Sem unidade',
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

  const autoAgendaIndex = useMemo(() => {
    if (!scheduleWindow.length) return null;

    const current = scheduleWindow.find(
      (item) => nowTime >= item.startTime && nowTime < item.endTime
    );
    if (current) return scheduleWindow.indexOf(current);

    const next = scheduleWindow.find((item) => item.startTime > nowTime);
    if (next) return scheduleWindow.indexOf(next);

    return scheduleWindow.length - 1;
  }, [nowTime, scheduleWindow]);

  useEffect(() => {
    if (manualAgendaIndex == null) return;
    if (!scheduleWindow.length || manualAgendaIndex >= scheduleWindow.length) {
      setManualAgendaIndex(null);
    }
  }, [manualAgendaIndex, scheduleWindow.length]);

  const activeAgendaIndex = manualAgendaIndex ?? autoAgendaIndex;
  const activeAgendaItem =
    activeAgendaIndex !== null ? scheduleWindow[activeAgendaIndex] ?? null : null;

  const agendaCardGap = 10;
  const agendaCardWidth = useMemo(() => {
    if (!agendaWidth) return 240;
    return Math.round(Math.max(180, Math.min(agendaWidth * 0.72, 260)));
  }, [agendaWidth]);

  const agendaScrollStyle = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    return { scrollSnapType: 'x mandatory', scrollBehavior: 'smooth' } as const;
  }, []);

  const agendaSnapOffsets = useMemo(() => {
    if (!agendaWidth || !scheduleWindow.length) return undefined;
    const size = agendaCardWidth + agendaCardGap;
    return scheduleWindow.map((_, index) => index * size);
  }, [agendaCardGap, agendaCardWidth, agendaWidth, scheduleWindow]);

  const getAgendaStatusLabel = useCallback(
    (item: (typeof scheduleWindow)[number]) => {
      if (item.dateKey === todayDateKey) {
        if (nowTime >= item.startTime && nowTime < item.endTime) return 'Treino de hoje';
        if (item.endTime <= nowTime) return 'Treino anterior';
        return 'Próximo treino';
      }
      return item.dateKey < todayDateKey ? 'Treino anterior' : 'Próximo treino';
    },
    [nowTime, todayDateKey]
  );

  const handleAgendaCardPress = useCallback(
    (index: number) => {
      setManualAgendaIndex(index);
      const size = agendaCardWidth + agendaCardGap;
      agendaScrollRef.current?.scrollTo({ x: index * size, animated: true });
    },
    [agendaCardGap, agendaCardWidth]
  );

  const handleAgendaScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!scheduleWindow.length) return;
      const size = agendaCardWidth + agendaCardGap;
      if (!size) return;
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.max(0, Math.min(scheduleWindow.length - 1, Math.round(offset / size)));
      setManualAgendaIndex(index);
    },
    [agendaCardGap, agendaCardWidth, scheduleWindow.length]
  );

  useEffect(() => {
    if (manualAgendaIndex != null) return;
    if (autoAgendaIndex == null || !agendaWidth) return;
    const size = agendaCardWidth + agendaCardGap;
    requestAnimationFrame(() => {
      agendaScrollRef.current?.scrollTo({ x: autoAgendaIndex * size, animated: false });
    });
  }, [agendaCardGap, agendaCardWidth, agendaWidth, autoAgendaIndex, manualAgendaIndex]);

  useEffect(() => {
    setManualAgendaIndex(null);
  }, [classes.length]);

  const canOpenDayPlan = Boolean(activeAgendaItem?.classId);

  const openDayPlan = useCallback(() => {
    if (!canOpenDayPlan) return;
    const classId = activeAgendaItem?.classId ?? student.classId ?? "";
    const date = activeAgendaItem?.dateKey ?? todayDateKey;
    if (!classId) {
      router.push({ pathname: "/student-plan" });
      return;
    }
    router.push({
      pathname: "/student-plan",
      params: { classId, date },
    });
  }, [
    activeAgendaItem?.classId,
    activeAgendaItem?.dateKey,
    canOpenDayPlan,
    router,
    student.classId,
    todayDateKey,
  ]);

  const recentNotifs = inbox.slice(0, 3);
  const unreadCount = inbox.filter((item) => !item.read).length;
  const openNotifications = () => {
    router.push({ pathname: "/communications" });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                const [items, classList] = await Promise.all([
                  getNotifications(),
                  getClasses(),
                ]);
                setInbox(items);
                setClasses(classList);
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        {loading ? (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 8 }}>
                <ShimmerBlock style={{ width: 180, height: 22, borderRadius: 10 }} />
                <ShimmerBlock style={{ width: 140, height: 14, borderRadius: 8 }} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ShimmerBlock style={{ width: 44, height: 32, borderRadius: 16 }} />
                <ShimmerBlock style={{ width: 56, height: 56, borderRadius: 28 }} />
              </View>
            </View>
            <ShimmerBlock style={{ height: 140, borderRadius: 20 }} />
            <ShimmerBlock style={{ height: 140, borderRadius: 20 }} />
            <ShimmerBlock style={{ height: 140, borderRadius: 20 }} />
            <ShimmerBlock style={{ height: 120, borderRadius: 20 }} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>
                  Olá{student.name ? `, ${student.name.split(" ")[0]}` : ""}
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
                  {todayLabel}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ position: "relative" }}>
                  <Pressable
                    onPress={openNotifications}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: colors.primaryBg,
                    }}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={18}
                      color={colors.primaryText}
                    />
                  </Pressable>
                  {unreadCount > 0 ? (
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
                <Pressable
                  onPress={() => router.push({ pathname: "/profile" })}
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
                      overflow: "hidden",
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
              </View>
            </View>
        { __DEV__ ? (
          <Pressable
            onPress={async () => {
              await setRoleOverride(null);
              await refreshRole();
              router.replace("/");
            }}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Voltar como professor
            </Text>
          </Pressable>
        ) : null}

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
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            Agenda do dia
          </Text>
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
              overflow: "hidden",
            }}
          >
            <FadeHorizontalScroll
              ref={agendaScrollRef}
              scrollEnabled={scheduleWindow.length > 1}
              scrollStyle={agendaScrollStyle}
              onMomentumScrollEnd={handleAgendaScrollEnd}
              snapToOffsets={agendaSnapOffsets}
              snapToAlignment="start"
              disableIntervalMomentum
              decelerationRate="fast"
              fadeColor={colors.secondaryBg}
              fadeWidth={8}
              containerStyle={undefined}
              contentContainerStyle={{ paddingRight: agendaCardGap }}
            >
              {scheduleWindow.length === 0 ? (
                <View style={{ paddingVertical: 6 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Nenhum treino programado no período.
                  </Text>
                </View>
              ) : (
                scheduleWindow.map((item, idx) => {
                  const isPast = item.endTime <= nowTime;
                  const isActive = activeAgendaIndex === idx;
                  const statusLabel = getAgendaStatusLabel(item);
                  const unitPalette = getUnitPalette(item.unit, colors);

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
                          padding: 10,
                          borderRadius: 14,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: isActive ? colors.primaryBg : colors.border,
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
                                {statusLabel}
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
                            <View
                              style={{
                                paddingVertical: 3,
                                paddingHorizontal: 8,
                                borderRadius: 999,
                                backgroundColor: unitPalette.bg,
                                borderWidth: 1,
                                borderColor: unitPalette.bg,
                              }}
                            >
                              <Text
                                style={{ color: unitPalette.text, fontSize: 10, fontWeight: "700" }}
                                numberOfLines={1}
                              >
                                {item.unit}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
                            {item.timeLabel}
                          </Text>
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
              onPress={() => router.push({ pathname: "/agenda" })}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                Ver agenda
              </Text>
            </Pressable>
            <Pressable
              disabled={!canOpenDayPlan}
              onPress={openDayPlan}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                opacity: canOpenDayPlan ? 1 : 0.5,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                {canOpenDayPlan ? "Ver plano" : "Sem plano do dia"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/student-scouting" })}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                Scouting
              </Text>
            </Pressable>
          </View>
          {!canOpenDayPlan ? (
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Selecione um treino da agenda para abrir o planejamento do dia.
            </Text>
          ) : null}
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
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Conquistas
            </Text>
            <Pressable onPress={() => router.push({ pathname: "/student-badges" })}>
              <Text style={{ color: colors.primaryBg, fontWeight: "700", fontSize: 12 }}>
                Ver tudo
              </Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.muted }}>
            Acompanhe seu desempenho técnico e badges do mês.
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: "/student-badges" })}
            style={{
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Abrir conquistas
            </Text>
          </Pressable>
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
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Comunicados
            </Text>
            <Pressable onPress={() => router.push({ pathname: "/communications" })}>
              <Text style={{ color: colors.primaryBg, fontWeight: "700", fontSize: 12 }}>
                Ver todos
              </Text>
            </Pressable>
          </View>
          { recentNotifs.length === 0 ? (
            <Text style={{ color: colors.muted }}>Nenhum comunicado.</Text>
          ) : (
            recentNotifs.map((item) => (
              <View
                key={item.id}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4 }} numberOfLines={2}>
                  {item.body}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Atalhos
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Pressable
              onPress={() => router.push({ pathname: "/agenda" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                Agenda
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Calendário de treinos
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/student-plan" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                Plano do treino
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Versão pública
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/communications" })}
              style={{
                flexBasis: "48%",
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                Comunicados
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Mensagens recentes
              </Text>
            </Pressable>
          </View>
        </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
