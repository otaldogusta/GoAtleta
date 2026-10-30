import { markRender, measureAsync } from "../src/observability/perf";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { OperationalText as Text } from "../src/ui/OperationalText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRole } from "../src/auth/role";
import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import type { ClassGroup, StudentScoutingLog } from "../src/core/models";
import {
    countsFromStudentLog,
    createEmptyCounts,
    getTechnicalPerformanceScore,
} from "../src/core/scouting";
import { getClasses, getStudentScoutingByRange } from "../src/db/seed";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { useAppTheme } from "../src/ui/app-theme";
import { useResponsiveLayout } from "../src/ui/use-responsive-layout";
import { compactUiMetrics as metrics, radius } from "../src/theme/tokens";

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
  markRender("screen.studentBadges.render.root");
  const { colors } = useAppTheme();
  const responsiveLayout = useResponsiveLayout();
  const router = useRouter();
  const { student } = useRole();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [logs, setLogs] = useState<StudentScoutingLog[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cls = await measureAsync("screen.studentBadges.load.classes", () => getClasses());
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
      const logs = await measureAsync("screen.studentBadges.load.scouting", () => getStudentScoutingByRange(
        currentClass.id,
        formatIsoDate(start),
        formatIsoDate(end)
      ));
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
      (Object.keys(counts) as (keyof typeof counts)[]).forEach((skill) => {
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
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: Math.min(responsiveLayout.maxContentWidth, 960) + responsiveLayout.gutter * 2, alignSelf: "center", padding: responsiveLayout.gutter, gap: responsiveLayout.density.pageGap }} stickyHeaderIndices={[0]}>
        <ScreenPageHeader
          title="Conquistas"
          onBack={() => navigateBackOrReplace({ router, fallback: "/student/home" })}
        />

        <View
          style={{
            padding: responsiveLayout.density.cardPadding,
            borderRadius: radius.card,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: metrics.gap,
          }}
        >
          <View style={{ gap: metrics.smallGap }}>
            <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize }}>Mês atual</Text>
            <Text style={{ fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "700", color: colors.text }}>{monthLabel(month)}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: metrics.gap, flexWrap: "wrap" }}>
            <Text style={{ color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: "800" }}>{score} pts</Text>
            <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>Performance técnica</Text>
          </View>
        </View>

        <View style={{ gap: metrics.gap }}>
          <Text style={{ color: colors.text, fontSize: metrics.titleFontSize, lineHeight: metrics.titleLineHeight, fontWeight: "800" }}>Badges</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: metrics.gap }}>
            {earned.map((badge) => (
              <View
                key={badge.id}
                style={{
                  flexBasis: responsiveLayout.supportsSplitView ? "30%" : "45%",
                  flexGrow: 1,
                  minWidth: 0,
                  padding: responsiveLayout.density.cardPadding,
                  borderRadius: radius.card,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: badge.earned ? colors.successBorder : colors.border,
                  justifyContent: "center",
                  gap: metrics.smallGap,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: metrics.gap }}>
                  <Text style={{ fontSize: metrics.iconSize }}>{badge.icon}</Text>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: metrics.smallGap }}>
                    <Text style={{ fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "700", color: colors.text }}>{badge.label}</Text>
                    <Text style={{ fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight, color: badge.earned ? colors.successText : colors.muted }}>{badge.earned ? "✓ Conquistado" : `${badge.threshold} pts`}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>{badge.description}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
