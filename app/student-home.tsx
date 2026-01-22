import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { ClassGroup } from "../src/core/models";
import { useRole } from "../src/auth/role";
import { getClasses } from "../src/db/seed";
import {
  AppNotification,
  getNotifications,
  subscribeNotifications,
} from "../src/notificationsInbox";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

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
  const { student } = useRole();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [inbox, setInbox] = useState<AppNotification[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const items = await getNotifications();
      if (alive) setInbox(items);
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
  }, []);

  const todayLabel = useMemo(() => {
    const date = new Date();
    const label = date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, []);

  const nextTarget = useMemo(() => {
    if (!classes.length) return null;
    const now = new Date();
    const candidates: {
      classId: string;
      date: string;
      time: number;
    }[] = [];
    for (let offset = -1; offset <= 7; offset += 1) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() + offset);
      dayDate.setHours(0, 0, 0, 0);
      const dayIndex = dayDate.getDay();
      classes.forEach((cls) => {
        if (!cls.daysOfWeek?.includes(dayIndex)) return;
        const time = parseTime(cls.startTime);
        if (!time) return;
        const candidate = new Date(dayDate);
        candidate.setHours(time.hour, time.minute, 0, 0);
        candidates.push({
          classId: cls.id,
          date: formatIsoDate(candidate),
          time: candidate.getTime(),
        });
      });
    }
    if (!candidates.length) return null;
    const nowTime = now.getTime();
    candidates.sort((a, b) => {
      const diffA = Math.abs(a.time - nowTime);
      const diffB = Math.abs(b.time - nowTime);
      if (diffA !== diffB) return diffA - diffB;
      return a.time - b.time;
    });
    return candidates[0];
  }, [classes]);

  const nextClass = useMemo(
    () => (nextTarget ? classes.find((item) => item.id === nextTarget.classId) : null),
    [classes, nextTarget]
  );

  const nextSummary = useMemo(() => {
    if (!nextClass || !nextTarget) return null;
    const time = parseTime(nextClass.startTime);
    const timeLabel = time
      ? formatRange(time.hour, time.minute, nextClass.durationMinutes ?? 60)
      : nextClass.startTime;
    return {
      unit: nextClass.unit || "Sem unidade",
      className: nextClass.name,
      dateLabel: formatShortDate(nextTarget.date),
      timeLabel,
    };
  }, [nextClass, nextTarget]);

  const recentNotifs = inbox.slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>
            Ola{student?.name ? `, ${student.name.split(" ")[0]}` : ""}
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
            {todayLabel}
          </Text>
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
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            Próximo treino
          </Text>
          {nextSummary ? (
            <>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                {nextSummary.className}
              </Text>
              <Text style={{ color: colors.muted }}>
                {nextSummary.unit}
              </Text>
              <Text style={{ color: colors.muted }}>
                {nextSummary.dateLabel} • {nextSummary.timeLabel}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.muted }}>Nenhum treino encontrado.</Text>
          )}
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
              onPress={() => router.push({ pathname: "/student-plan" })}
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
                Ver plano
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
          {recentNotifs.length === 0 ? (
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
                Versao pública
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
            <Pressable
              onPress={() => router.push({ pathname: "/profile" })}
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
                Perfil
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Preferencias
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
