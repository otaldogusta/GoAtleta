import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRole } from "../../auth/role";
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
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

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
  const { colors } = useAppTheme();
  const layout = useResponsiveLayout("dashboard");
  const { role, student } = useRole();
  const profilePhotoUri = useStudentProfilePhoto(student);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [inbox, setInbox] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = async () => {
    const [notifications, studentClass] = await Promise.all([
      getNotifications("student", student?.organizationId),
      student?.classId
        ? getClassById(student.classId, { organizationId: student.organizationId })
        : Promise.resolve(null),
    ]);
    setInbox(notifications);
    setClasses(studentClass ? [studentClass] : []);
  };

  useEffect(() => {
    let alive = true;
    void load().finally(() => {
      if (alive) setLoading(false);
    });
    const unsubscribe = subscribeNotifications(
      (items) => alive && setInbox(items),
      "student",
      student?.organizationId,
    );
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [student?.classId, student?.organizationId]);

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
        key: date.toISOString(),
        weekday: capitalize(date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")),
        day: date.getDate(),
        active: date.toDateString() === now.toDateString(),
      };
    });
  }, [now]);

  const schedule = useMemo(() => {
    const result: ScheduleItem[] = [];
    for (let offset = 0; offset <= 7; offset += 1) {
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
        if (endsAt.getTime() <= now.getTime()) continue;
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

  const nextTraining = schedule[0] ?? null;
  const followingTraining = schedule[1] ?? null;
  const latestNotification = inbox[0] ?? null;
  const firstName = student?.name?.trim().split(" ")[0] ?? "";
  const todayLabel = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }));
  const openTraining = () => {
    if (!nextTraining) return router.push("/student/agenda");
    router.push({ pathname: "/student-plan", params: { classId: nextTraining.classId, date: nextTraining.startsAt.toISOString().slice(0, 10) } });
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
                <View style={{ minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontSize: layout.density.pageTitleFontSize, lineHeight: layout.density.pageTitleLineHeight, fontWeight: "800" }}>
                    Olá{firstName ? `, ${firstName}` : ""}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: layout.density.bodyFontSize, marginTop: 2 }}>{todayLabel}</Text>
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
                {weekDays.map((day) => (
                  <View key={day.key} style={{ flex: 1, minHeight: 68, borderRadius: radius.internal, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: day.active ? colors.successBg : "transparent", borderWidth: day.active ? 1 : 0, borderColor: colors.primaryBg }}>
                    <Text style={{ color: day.active ? colors.success : colors.muted, fontSize: 11, fontWeight: "700" }}>{day.weekday}</Text>
                    <Text style={{ color: day.active ? colors.success : colors.text, fontSize: 16, fontWeight: "800" }}>{day.day}</Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: layout.supportsSplitView ? "row" : "column", gap: layout.density.pageGap, alignItems: "stretch" }}>
                <View style={{ flex: 2, minWidth: 0, gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.sm }}>
                    <Text style={{ color: colors.text, fontSize: layout.density.sectionTitleFontSize, fontWeight: "800" }}>Próximo treino</Text>
                    {nextTraining ? <Text style={{ color: colors.muted, fontSize: layout.density.metadataFontSize }}>{nextTraining.startsAt.toDateString() === now.toDateString() ? "Hoje" : capitalize(nextTraining.startsAt.toLocaleDateString("pt-BR", { weekday: "long" }))}</Text> : null}
                  </View>
                  <View style={{ borderRadius: radius.container, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: layout.density.cardPadding, gap: spacing.md }}>
                    {nextTraining ? (
                      <View style={{ flexDirection: layout.isMobile ? "column" : "row", alignItems: layout.isMobile ? "stretch" : "center", gap: spacing.md }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1, minWidth: 0 }}>
                          <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.successBg }}><GoAtletaIcon name="classes" size={24} color={colors.success} /></View>
                          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                            <Text style={{ color: colors.muted, fontSize: layout.density.metadataFontSize }}>{nextTraining.timeLabel}</Text>
                            <Text style={{ color: colors.text, fontSize: layout.density.cardTitleFontSize + 1, fontWeight: "800" }} numberOfLines={1}>{nextTraining.className}</Text>
                            <Text style={{ color: colors.muted, fontSize: layout.density.bodyFontSize }} numberOfLines={1}>{nextTraining.unit}</Text>
                          </View>
                        </View>
                        <Pressable onPress={openTraining} style={{ minHeight: 44, minWidth: layout.isMobile ? undefined : 132, borderRadius: radius.internal, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryBg }}>
                          <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 13 }}>Ver detalhes</Text>
                        </Pressable>
                      </View>
                    ) : <Text style={{ color: colors.muted, fontSize: layout.density.bodyFontSize }}>Nenhum treino programado.</Text>}
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
    </SafeAreaView>
  );
}
