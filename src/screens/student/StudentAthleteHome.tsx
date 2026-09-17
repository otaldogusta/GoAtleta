import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, AppState, PanResponder, Platform, ScrollView, Text, View } from "react-native";
import { ModalSheet } from "../../ui/ModalSheet";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRole } from "../../auth/role";
import { useAuth } from "../../auth/auth";
import { isRecentlyCreatedAuthUser } from "../../auth/oauth-post-login";
import { ScreenLoadingState } from "../../components/ui/ScreenLoadingState";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import type { ClassGroup } from "../../core/models";
import { getClassById } from "../../db/seed";
import { useStudentProfilePhoto } from "../../hooks/use-student-profile-photo";
import { getScopedProfilePath } from "../../navigation/profile-routes";
import { getNotifications, subscribeNotifications, type AppNotification } from "../../notificationsInbox";
import { spacing, radius } from "../../theme/tokens";
import { AppRefreshControl } from "../../ui/AppRefreshControl";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useNativeSidebarController } from "../../ui/native-sidebar-controller";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import {
  formatImportantStudentFields,
  getMissingImportantStudentFields,
} from "../students/application/student-profile-completeness";
import {
  resolveAdjacentDayIndex,
  resolveDayIndexAfterSwipe,
  resolveTrainingIndexForDate,
  toLocalDateKey,
} from "./student-home-training-navigation";

type ScheduleItem = {
  classId: string;
  className: string;
  unit: string;
  startsAt: Date;
  endsAt: Date;
  timeLabel: string;
};

const parseTime = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function StudentAthleteHome() {
  const router = useRouter();
  const [isFocused, setIsFocused] = useState(false);
  const [guidanceDismissed, setGuidanceDismissed] = useState(false);

  useFocusEffect(useCallback(() => {
    setIsFocused(true);
    return () => setIsFocused(false);
  }, []));

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (previous === "background" && next === "active") setGuidanceDismissed(false);
      previous = next;
    });
    return () => subscription.remove();
  }, []);
  const { colors } = useAppTheme();
  const layout = useResponsiveLayout("dashboard");
  const { openMobileSidebar } = useNativeSidebarController();
  const { role, student } = useRole();
  const { session } = useAuth();
  const profilePhotoUri = useStudentProfilePhoto(student);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [inbox, setInbox] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [cardTranslateX] = useState(() => new Animated.Value(0));
  const [cardOpacity] = useState(() => new Animated.Value(1));
  const studentClassId = student?.classId;
  const studentOrganizationId = student?.organizationId;

  const load = useCallback(async () => {
    const [notifications, studentClass] = await Promise.all([
      getNotifications("student", studentOrganizationId),
      studentClassId
        ? getClassById(studentClassId, { organizationId: studentOrganizationId })
        : Promise.resolve(null),
    ]);
    setInbox(notifications);
    setClasses(studentClass ? [studentClass] : []);
  }, [studentClassId, studentOrganizationId]);

  useEffect(() => {
    let alive = true;
    // Load the external inbox/class sources when the athlete scope changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().finally(() => {
      if (alive) setLoading(false);
    });
    const unsubscribe = subscribeNotifications(
      (items) => alive && setInbox(items),
      "student",
      studentOrganizationId,
    );
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [load, studentOrganizationId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const weekDays = useMemo(() => {
    const mondayOffset = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        key: toLocalDateKey(date),
        weekday: capitalize(date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")),
        day: date.getDate(),
        active: date.toDateString() === now.toDateString(),
      };
    });
  }, [now]);

  const schedule = useMemo(() => {
    const result: ScheduleItem[] = [];
    for (let offset = -7; offset <= 14; offset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() + offset);
      date.setHours(0, 0, 0, 0);
      for (const cls of classes) {
        if (!cls.daysOfWeek.includes(date.getDay())) continue;
        const time = parseTime(cls.startTime);
        if (!time) continue;
        const startsAt = new Date(date);
        startsAt.setHours(time.hour, time.minute, 0, 0);
        const endsAt = new Date(startsAt.getTime() + (cls.durationMinutes ?? 60) * 60_000);
        result.push({
          classId: cls.id,
          className: cls.name,
          unit: cls.unit || "Local a confirmar",
          startsAt,
          endsAt,
          timeLabel: `${startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} – ${endsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        });
      }
    }
    return result.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }, [classes, now]);

  const defaultTrainingIndex = Math.max(0, schedule.findIndex((item) => item.endsAt.getTime() > now.getTime()));
  const defaultTraining = schedule[defaultTrainingIndex] ?? null;
  const effectiveSelectedDateKey = selectedDateKey ?? (defaultTraining ? toLocalDateKey(defaultTraining.startsAt) : toLocalDateKey(now));
  const selectedTrainingIndex = resolveTrainingIndexForDate(schedule, effectiveSelectedDateKey);
  const selectedTraining = selectedTrainingIndex >= 0 ? schedule[selectedTrainingIndex] : null;
  const selectedDayIndex = weekDays.findIndex((day) => day.key === effectiveSelectedDateKey);
  const followingTraining = selectedTrainingIndex >= 0 ? schedule[selectedTrainingIndex + 1] ?? null : null;
  const latestNotification = inbox[0] ?? null;
  const firstName = student?.name?.trim().split(" ")[0] ?? "";
  const todayLabel = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }));
  const missingProfileFields = useMemo(
    () => getMissingImportantStudentFields(student ?? {}),
    [student],
  );
  const isNewAccount = isRecentlyCreatedAuthUser(session?.user, now.getTime());
  const shouldGuideProfile = role === "pending" || isNewAccount || missingProfileFields.length > 0;
  const profileGuidance = role === "pending"
    ? "Complete seus dados e encontre sua instituição quando estiver pronto."
    : missingProfileFields.length > 0
      ? `Adicione ${formatImportantStudentFields(missingProfileFields)} para concluir seu cadastro.`
      : "Seu acesso está pronto. Você pode revisar seus dados quando quiser.";
  const openTraining = () => {
    if (!selectedTraining) return router.push("/student/agenda");
    router.push({ pathname: "/student-plan", params: { classId: selectedTraining.classId, date: toLocalDateKey(selectedTraining.startsAt) } });
  };
  const animateToDate = useCallback((nextDateKey: string, direction: number) => {
    if (nextDateKey === effectiveSelectedDateKey) {
      Animated.spring(cardTranslateX, { toValue: 0, useNativeDriver: Platform.OS !== "web" }).start();
      return;
    }
    Animated.parallel([
      Animated.timing(cardTranslateX, { toValue: direction * -24, duration: 110, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(cardOpacity, { toValue: 0.25, duration: 110, useNativeDriver: Platform.OS !== "web" }),
    ]).start(() => {
      setSelectedDateKey(nextDateKey);
      cardTranslateX.setValue(direction * 24);
      Animated.parallel([
        Animated.spring(cardTranslateX, { toValue: 0, damping: 18, stiffness: 210, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== "web" }),
      ]).start();
    });
  }, [cardOpacity, cardTranslateX, effectiveSelectedDateKey]);
  const trainingPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => selectedDayIndex >= 0 && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderMove: (_, gesture) => cardTranslateX.setValue(Math.max(-64, Math.min(64, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      const nextIndex = resolveDayIndexAfterSwipe({ currentIndex: selectedDayIndex, dragDistance: gesture.dx, velocityX: gesture.vx, total: weekDays.length });
      animateToDate(weekDays[nextIndex].key, nextIndex > selectedDayIndex ? 1 : -1);
    },
    onPanResponderTerminate: () => Animated.spring(cardTranslateX, { toValue: 0, useNativeDriver: Platform.OS !== "web" }).start(),
  }), [animateToDate, cardTranslateX, selectedDayIndex, weekDays]);
  const moveToAdjacentDay = useCallback((offset: -1 | 1) => {
    if (selectedDayIndex < 0) return;
    const nextIndex = resolveAdjacentDayIndex(selectedDayIndex, offset, weekDays.length);
    animateToDate(weekDays[nextIndex].key, offset);
  }, [animateToDate, selectedDayIndex, weekDays]);
  const handleTrainingCardKeyDown = useCallback((event: { key: string; preventDefault: () => void }) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = resolveAdjacentDayIndex(selectedDayIndex, offset, weekDays.length);
    if (nextIndex === selectedDayIndex) return;
    event.preventDefault();
    moveToAdjacentDay(offset);
  }, [moveToAdjacentDay, selectedDayIndex, weekDays.length]);
  const openMainMenu = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("goatleta:toggle-sidebar"));
      return;
    }
    openMobileSidebar();
  };
  const rowBorder = { borderBottomWidth: 1, borderBottomColor: colors.border } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: layout.isMobile ? 112 : spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }} tintColor={colors.text} colors={[colors.text]} />}
      >
        <ResponsivePage variant="dashboard" gap={layout.isMobile ? spacing.xl : spacing.xxl} style={{ paddingTop: spacing.md }}>
          {loading ? <ScreenLoadingState /> : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0, flex: 1 }}>
                  {layout.isMobile ? (
                    <Pressable
                      accessibilityLabel="Abrir menu principal"
                      onPress={openMainMenu}
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
                  <View style={{ minWidth: 0, flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: layout.density.pageTitleFontSize, lineHeight: layout.density.pageTitleLineHeight, fontWeight: "800" }}>
                      Olá{firstName ? `, ${firstName}` : ""}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: layout.density.bodyFontSize, marginTop: 2 }}>{todayLabel}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <Pressable accessibilityLabel="Abrir notificações" onPress={() => router.push("/communications")} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryBg }}>
                    <GoAtletaIcon name="notifications" size={19} color={colors.primaryText} />
                  </Pressable>
                  <Pressable accessibilityLabel="Abrir perfil" onPress={() => router.push(getScopedProfilePath("/student/home"))} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                    <GoAtletaIcon name="personSolid" size={20} color={colors.text} />
                    {profilePhotoUri ? <Image source={{ uri: profilePhotoUri }} contentFit="cover" style={{ position: "absolute", inset: 0 }} /> : null}
                  </Pressable>
                </View>
              </View>


              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 4 }}>
                {weekDays.map((day) => {
                  const trainingIndex = resolveTrainingIndexForDate(schedule, day.key);
                  const selected = effectiveSelectedDateKey === day.key;
                  return (
                    <Pressable
                      key={day.key}
                      accessibilityRole="button"
                      accessibilityLabel={trainingIndex >= 0 ? `Ver treino de ${day.weekday}, dia ${day.day}` : `Ver ${day.weekday}, dia ${day.day}, sem treino`}
                      accessibilityState={{ selected }}
                      onPress={() => animateToDate(day.key, weekDays.indexOf(day) > selectedDayIndex ? 1 : -1)}
                      style={({ pressed, hovered }: any) => ({
                        flex: 1,
                        minHeight: 68,
                        borderRadius: radius.internal,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        backgroundColor: selected ? colors.successBg : hovered ? colors.secondaryBg : "transparent",
                        borderWidth: selected ? 1 : 0,
                        borderColor: colors.primaryBg,
                        opacity: pressed ? 0.76 : 1,
                      })}
                    >
                      <Text style={{ color: selected ? colors.success : colors.muted, fontSize: 11, fontWeight: "700" }}>{day.weekday}</Text>
                      <Text style={{ color: selected ? colors.success : colors.text, fontSize: 16, fontWeight: "800" }}>{day.day}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: layout.supportsSplitView ? "row" : "column", gap: layout.density.pageGap, alignItems: "stretch" }}>
                <View style={{ flex: 2, minWidth: 0, gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.sm }}>
                    <Text style={{ color: colors.text, fontSize: layout.density.sectionTitleFontSize, fontWeight: "800" }}>{selectedDateKey === null ? "Próximo treino" : selectedTraining ? "Treino do dia" : "Sem treino"}</Text>
                    <Text style={{ color: colors.muted, fontSize: layout.density.metadataFontSize }}>{weekDays[selectedDayIndex]?.active ? "Hoje" : weekDays[selectedDayIndex]?.weekday ?? ""}</Text>
                  </View>
                  <View
                    accessibilityRole="adjustable"
                    accessibilityLabel="Navegação dos treinos da semana"
                    accessibilityHint="Use as setas esquerda e direita para mudar o dia"
                    accessibilityValue={{ min: 1, max: weekDays.length, now: Math.max(1, selectedDayIndex + 1), text: weekDays[selectedDayIndex] ? `${weekDays[selectedDayIndex].weekday}, dia ${weekDays[selectedDayIndex].day}` : undefined }}
                    accessibilityActions={[{ name: "decrement", label: "Dia anterior" }, { name: "increment", label: "Próximo dia" }]}
                    onAccessibilityAction={(event) => moveToAdjacentDay(event.nativeEvent.actionName === "increment" ? 1 : -1)}
                    {...(Platform.OS === "web" ? ({ tabIndex: 0, onKeyDown: handleTrainingCardKeyDown } as any) : {})}
                    style={{ borderRadius: radius.container, overflow: "hidden" }}
                  >
                    <Animated.View
                      {...trainingPanResponder.panHandlers}
                      accessibilityHint="Arraste para os lados para ver o dia anterior ou seguinte"
                      style={[{
                        minHeight: 150,
                        borderRadius: radius.container,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        padding: layout.density.cardPadding,
                        gap: spacing.md,
                        justifyContent: "center",
                        opacity: cardOpacity,
                        transform: [{ translateX: cardTranslateX }],
                      }, Platform.OS === "web" ? ({ touchAction: "pan-y", userSelect: "none" } as any) : null]}
                    >
                      {selectedTraining ? (
                        <View style={{ flexDirection: layout.isMobile ? "column" : "row", alignItems: layout.isMobile ? "stretch" : "center", gap: spacing.md }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1, minWidth: 0 }}>
                            <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.successBg }}><GoAtletaIcon name="classes" size={24} color={colors.success} /></View>
                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <Text style={{ color: colors.muted, fontSize: layout.density.metadataFontSize }}>{selectedTraining.timeLabel}</Text>
                              <Text style={{ color: colors.text, fontSize: layout.density.cardTitleFontSize + 1, fontWeight: "800" }} numberOfLines={1}>{selectedTraining.className}</Text>
                              <Text style={{ color: colors.muted, fontSize: layout.density.bodyFontSize }} numberOfLines={1}>{selectedTraining.unit}</Text>
                            </View>
                          </View>
                          <Pressable onPress={openTraining} style={{ minHeight: 44, minWidth: layout.isMobile ? undefined : 132, borderRadius: radius.internal, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryBg }}>
                            <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 13 }}>Ver detalhes</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={{ alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
                          <GoAtletaIcon name="calendar" size={24} color={colors.muted} />
                          <Text style={{ color: colors.text, fontSize: layout.density.cardTitleFontSize, fontWeight: "700" }}>Nenhum treino neste dia</Text>
                          <Text style={{ color: colors.muted, fontSize: layout.density.metadataFontSize }}>Escolha outro dia ou arraste para o lado.</Text>
                        </View>
                      )}
                    </Animated.View>
                  </View>
                </View>

                <View style={{ flex: 1, minWidth: 0, gap: 0 }}>
                  {followingTraining ? (
                    <Pressable onPress={() => router.push("/student/agenda")} style={[{ minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.sm, marginVertical: 2, borderRadius: radius.internal }, rowBorder]}>
                      <GoAtletaIcon name="mainActivity" size={22} color={colors.success} />
                      <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: "800" }}>Depois</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{followingTraining.className} · {followingTraining.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text></View>
                      <GoAtletaIcon name="chevronForward" size={18} color={colors.muted} />
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => router.push("/student/achievements")} style={[{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.sm, marginVertical: 2, borderRadius: radius.internal }, rowBorder]}>
                    <GoAtletaIcon name="achievements" size={21} color={colors.success} /><Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>Conquistas</Text><GoAtletaIcon name="chevronForward" size={18} color={colors.muted} />
                  </Pressable>
                  <Pressable onPress={() => router.push("/communications")} style={[{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.sm, marginVertical: 2, borderRadius: radius.internal }, rowBorder]}>
                    <GoAtletaIcon name="absenceNotices" size={21} color={colors.success} /><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: "700" }}>{latestNotification ? latestNotification.title : "Comunicados"}</Text>{latestNotification ? <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{latestNotification.body}</Text> : null}</View><GoAtletaIcon name="chevronForward" size={18} color={colors.muted} />
                  </Pressable>
                  {role === "pending" ? (
                    <Pressable onPress={() => router.push("/pending")} style={[{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.sm, marginVertical: 2, borderRadius: radius.internal }, rowBorder]}>
                      <GoAtletaIcon name="organization" size={21} color={colors.success} /><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: "700" }}>Encontre sua instituição</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Veja equipes e planos disponíveis.</Text></View><GoAtletaIcon name="chevronForward" size={18} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </>
          )}
        </ResponsivePage>
      </ScrollView>
      <ModalSheet
        visible={!loading && isFocused && shouldGuideProfile && !guidanceDismissed}
        onClose={() => setGuidanceDismissed(true)}
        position="center"
        cardStyle={{ width: "100%", maxWidth: 440, borderRadius: radius.container, padding: spacing.xl, gap: spacing.md }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.successBg }}>
            <GoAtletaIcon name="personSolid" size={20} color={colors.success} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar boas-vindas" onPress={() => setGuidanceDismissed(true)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
            <GoAtletaIcon name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
          {isNewAccount || role === "pending" ? "Bem-vindo ao Go Atleta" : "Complete seu perfil"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>{profileGuidance}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setGuidanceDismissed(true); router.push("/student/profile"); }} style={{ minHeight: 50, borderRadius: radius.internal, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryBg }}>
          <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 14 }}>Completar perfil</Text>
        </Pressable>
      </ModalSheet>
    </SafeAreaView>
  );
}
