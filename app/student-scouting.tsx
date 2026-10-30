import { markRender, measureAsync } from "../src/observability/perf";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, type PressableStateCallbackType } from "react-native";
import { OperationalText as Text } from "../src/ui/OperationalText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRole } from "../src/auth/role";
import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import type { ClassGroup } from "../src/core/models";
import {
    createEmptyCounts,
    getSkillMetrics,
    scoutingSkills,
    studentScoutingLimits,
} from "../src/core/scouting";
import { getClasses, getStudentScoutingByDate, saveStudentScoutingLog } from "../src/db/seed";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { Pressable } from "../src/ui/Pressable";
import { StudentAction, studentHighlighted } from "../src/screens/student/StudentUi";
import { AppShell } from "../src/ui/AppShell";
import { useAppTheme } from "../src/ui/app-theme";
import { useResponsiveLayout } from "../src/ui/use-responsive-layout";
import { compactUiMetrics as uiMetrics, radius } from "../src/theme/tokens";

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

function StudentScoutingContent() {
  markRender("screen.studentScouting.render.root");
  const { colors } = useAppTheme();
  const responsiveLayout = useResponsiveLayout("dashboard");
  const skillStyles = useMemo(() => StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: uiMetrics.gap },
    card: { flexBasis: responsiveLayout.supportsSplitView ? "48%" : "100%", flexGrow: 1, minWidth: 0, padding: responsiveLayout.density.cardPadding, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: uiMetrics.gap },
    heading: { flexDirection: "row", justifyContent: "space-between" },
    title: { color: colors.text, fontWeight: "700" },
    muted: { color: colors.muted },
    text: { color: colors.text },
    score: { flexBasis: 100, flexGrow: 1, minWidth: 100, gap: uiMetrics.smallGap },
    scoreLabel: { color: colors.muted, fontSize: uiMetrics.metadataFontSize, textAlign: "center" },
    controls: { minHeight: uiMetrics.touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: uiMetrics.smallGap, paddingHorizontal: 6 },
    count: { color: colors.text, fontWeight: "700", minWidth: 16, textAlign: "center" },
    step: { width: uiMetrics.controlHeight, height: uiMetrics.controlHeight, flexShrink: 0, borderRadius: 16, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", opacity: 1 },
    highlightedStep: { backgroundColor: colors.secondaryBg, borderColor: colors.borderStrong },
    pressedStep: { opacity: 0.9 },
  }), [colors.border, colors.borderStrong, colors.card, colors.muted, colors.secondaryBg, colors.text, responsiveLayout.density.cardPadding, responsiveLayout.supportsSplitView]);
  const stepStyle = useCallback((state: PressableStateCallbackType) => [
    skillStyles.step,
    studentHighlighted(state) ? skillStyles.highlightedStep : null,
    state.pressed ? skillStyles.pressedStep : null,
  ], [skillStyles]);
  const router = useRouter();
  const { student } = useRole();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [counts, setCounts] = useState(createEmptyCounts());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cls = await measureAsync("screen.studentScouting.load.classes", () => getClasses());
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

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatIsoDate(today), [today]);

  const sessionWindow = useMemo(() => {
    if (!currentClass) return null;
    const now = new Date();
    const dayIndex = now.getDay();
    if (!currentClass.daysOfWeek.includes(dayIndex)) return null;
    const time = parseTime(currentClass.startTime);
    if (!time) return null;
    const start = new Date();
    start.setHours(time.hour, time.minute, 0, 0);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    return { start, end, now };
  }, [currentClass]);

  const canEdit = useMemo(() => {
    if (!sessionWindow) return false;
    return sessionWindow.now >= sessionWindow.start && sessionWindow.now <= sessionWindow.end;
  }, [sessionWindow]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!student || !currentClass) {
        setLoading(false);
        return;
      }
      const existing = await measureAsync("screen.studentScouting.load.scouting", () => getStudentScoutingByDate(student.id, currentClass.id, todayKey));
      if (!alive) return;
      if (existing) {
        setCounts({
          serve: { 0: existing.serve0, 1: existing.serve1, 2: existing.serve2 },
          receive: { 0: existing.receive0, 1: existing.receive1, 2: existing.receive2 },
          set: { 0: existing.set0, 1: existing.set1, 2: existing.set2 },
          attack_send: { 0: existing.attackSend0, 1: existing.attackSend1, 2: existing.attackSend2 },
        });
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [student, currentClass, todayKey]);

  const updateCount = (skillId: keyof typeof counts, score: 0 | 1 | 2, delta: number) => {
    setCounts((prev) => {
      const next = { ...prev, [skillId]: { ...prev[skillId] } };
      const total = next[skillId][0] + next[skillId][1] + next[skillId][2];
      const limit = studentScoutingLimits[skillId];
      if (delta > 0 && total >= limit) return prev;
      next[skillId][score] = Math.max(0, next[skillId][score] + delta);
      return next;
    });
  };

  const handleSave = async () => {
    if (!student || !currentClass) return;
    if (!canEdit) return;
    setSaving(true);
    try {
      await saveStudentScoutingLog({
        id: "",
        studentId: student.id,
        classId: currentClass.id,
        date: todayKey,
        serve0: counts.serve[0],
        serve1: counts.serve[1],
        serve2: counts.serve[2],
        receive0: counts.receive[0],
        receive1: counts.receive[1],
        receive2: counts.receive[2],
        set0: counts.set[0],
        set1: counts.set[1],
        set2: counts.set[2],
        attackSend0: counts.attack_send[0],
        attackSend1: counts.attack_send[1],
        attackSend2: counts.attack_send[2],
        createdAt: new Date().toISOString(),
      });
      navigateBackOrReplace({ router, fallback: "/student/home" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Meu scouting"
        onBack={() => navigateBackOrReplace({ router, fallback: "/student/home" })}
        contentStyle={{ width: "100%", maxWidth: Math.min(responsiveLayout.maxContentWidth, 960) + responsiveLayout.gutter * 2, alignSelf: "center", paddingHorizontal: responsiveLayout.gutter }}
      />
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: Math.min(responsiveLayout.maxContentWidth, 960) + responsiveLayout.gutter * 2, alignSelf: "center", paddingHorizontal: responsiveLayout.gutter, paddingTop: 2, paddingBottom: 12, gap: responsiveLayout.density.pageGap }}>

        <View style={{ padding: responsiveLayout.density.cardPadding, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: uiMetrics.smallGap }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: uiMetrics.gap }}>
            <Text style={{ color: colors.muted, fontSize: uiMetrics.metadataFontSize }}>Turma</Text>
            <Text style={{ color: colors.text, fontWeight: "700", flexShrink: 1 }}>{currentClass?.name ?? "-"}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: uiMetrics.metadataFontSize, lineHeight: uiMetrics.metadataLineHeight }}>
            {sessionWindow
              ? `Disponível até ${sessionWindow.end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Scouting liberado apenas no dia do treino"}
          </Text>
        </View>

        {loading ? (
          <Text style={{ color: colors.muted }}>Carregando...</Text>
        ) : (
          <View style={skillStyles.grid}>
          {scoutingSkills.map((skill) => {
            const metrics = getSkillMetrics(counts[skill.id]);
            const total = metrics.total;
            const limit = studentScoutingLimits[skill.id];
            return (
              <View
                key={skill.id}
                style={skillStyles.card}
              >
                <View style={skillStyles.heading}>
                  <Text style={skillStyles.title}>{skill.label}</Text>
                  <Text style={skillStyles.muted}>{total}/{limit}</Text>
                </View>
                <View style={skillStyles.grid}>
                  {[0, 1, 2].map((score) => (
                    <View key={score} style={skillStyles.score}>
                      <Text style={skillStyles.scoreLabel}>
                        {score}
                      </Text>
                      <View style={skillStyles.controls}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Diminuir ${skill.label}, nota ${score}`}
                          hitSlop={6}
                          onPress={() => updateCount(skill.id, score as 0 | 1 | 2, -1)}
                          suppressWebHoverFeedback disableWebPressScale
                          style={stepStyle}
                        >
                          <Text style={skillStyles.text}>-</Text>
                        </Pressable>
                        <Text style={skillStyles.count}>
                          {counts[skill.id][score as 0 | 1 | 2]}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Aumentar ${skill.label}, nota ${score}`}
                          hitSlop={6}
                          onPress={() => updateCount(skill.id, score as 0 | 1 | 2, 1)}
                          suppressWebHoverFeedback disableWebPressScale
                          style={stepStyle}
                        >
                          <Text style={skillStyles.text}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          </View>
        )}

        <StudentAction label={saving ? "Salvando..." : "Salvar scouting"} primary onPress={handleSave} disabled={!canEdit || saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function StudentScouting() {
  return <AppShell role="student"><StudentScoutingContent /></AppShell>;
}
