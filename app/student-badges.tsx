import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useAppTheme } from "../src/ui/app-theme";
import { Pressable } from "../src/ui/Pressable";
import { useRole } from "../src/auth/role";
import { getStudentScoutingByRange, getClasses } from "../src/db/seed";
import type { ClassGroup, StudentScoutingLog } from "../src/core/models";
import {
  createEmptyCounts,
  countsFromStudentLog,
  getTechnicalPerformanceScore,
} from "../src/core/scouting";

const pad2 = (value: number) => String(value).padStart(2, "0");
const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = pad2(value.getMonth() + 1);
  const d = pad2(value.getDate());
  return `${y}-${m}-${d}`;
};

const monthLabel = (date: Date) => {
  const names = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${names[date.getMonth()]} ${date.getFullYear()}`;
};

type BadgeDef = {
  id: string;
  label: string;
  description: string;
  threshold: number;
  icon: string;
};

const badgeDefs: BadgeDef[] = [
  { id: "rookie", label: "Iniciante", description: "Primeiro scouting", threshold: 1, icon: "⭐" },
  { id: "steady", label: "Constante", description: "30 pts no mês", threshold: 30, icon: "🛡️" },
  { id: "focus", label: "Foco", description: "50 pts no mês", threshold: 50, icon: "🎯" },
  { id: "ace", label: "Ace", description: "70 pts no mês", threshold: 70, icon: "⚡" },
  { id: "elite", label: "Elite", description: "90 pts no mês", threshold: 90, icon: "👑" },
  { id: "master", label: "Mestre", description: "100 pts no mês", threshold: 100, icon: "🏆" },
];

export default function StudentBadges() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { student } = useRole();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [logs, setLogs] = useState<StudentScoutingLog[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cls = await getClasses();
      if (!alive) return;
      setClasses(cls);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const currentClass = useMemo(() => {
    if (!student) return null;
    return classes.find((c) => c.id === student.classId) ?? null;
  }, [classes, student]);

  const month = useMemo(() => new Date(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!student || !currentClass) return;
      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const logs = await getStudentScoutingByRange(
        currentClass.id,
        formatIsoDate(start),
        formatIsoDate(end)
      );
      if (!alive) return;
      setLogs(logs.filter((l) => l.studentId === student.id));
    })();
    return () => {
      alive = false;
    };
  }, [student, currentClass, month]);

  const score = useMemo(() => {
    const counts = createEmptyCounts();
    logs.forEach((log) => {
      const next = countsFromStudentLog(log);
      (Object.keys(counts) as Array<keyof typeof counts>).forEach((skill) => {
        counts[skill][0] += next[skill][0];
        counts[skill][1] += next[skill][1];
        counts[skill][2] += next[skill][2];
      });
    });
    return getTechnicalPerformanceScore(counts);
  }, [logs]);

  const earned = useMemo(() => {
    return badgeDefs.map((badge) => ({
      ...badge,
      earned: score >= badge.threshold,
    }));
  }, [score]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.text }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
            Conquistas
          </Text>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>Mês atual</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            {monthLabel(month)}
          </Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{score} pts</Text>
          <Text style={{ color: colors.muted }}>Performance técnica</Text>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>Badges</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {earned.map((badge) => (
              <View
                key={badge.id}
                style={{
                  width: "30%",
                  aspectRatio: 1,
                  borderRadius: 16,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: badge.earned ? colors.primaryBg : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 20 }}>{badge.icon}</Text>
                <Text style={{ fontSize: 10, color: colors.text, textAlign: "center" }}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          {earned.map((badge) => (
            <View
              key={badge.id}
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 18 }}>{badge.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{badge.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{badge.description}</Text>
              </View>
              <Text style={{ color: badge.earned ? colors.primaryBg : colors.muted }}>
                {badge.earned ? "✓" : `${badge.threshold} pts`}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
