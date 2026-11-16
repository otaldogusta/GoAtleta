import { markRender, measureAsync } from "../src/observability/perf";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getClassById, getStudentScoutingByDate, saveStudentScoutingLog } from "../src/db/seed";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { Pressable } from "../src/ui/Pressable";
import { StudentAction, studentHighlighted } from "../src/screens/student/StudentUi";
import { AppShell } from "../src/ui/AppShell";
import { ListEmptyState } from "../src/ui/ListEmptyState";
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
  const { student, loading: roleLoading } = useRole();
  const studentId = student?.id;
  const classId = student?.classId;
  const organizationId = student?.organizationId;
  const [currentClass, setCurrentClass] = useState<ClassGroup | null>(null);
  const [counts, setCounts] = useState(createEmptyCounts());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

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
    if (!sessionWindow || loading || failed) return false;
    return sessionWindow.now >= sessionWindow.start && sessionWindow.now <= sessionWindow.end;
  }, [sessionWindow, loading, failed]);

  useEffect(() => {
    if (roleLoading) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setFailed(false);
      setCurrentClass(null);
      setCounts(createEmptyCounts());
      try {
        if (!studentId || !classId || !organizationId) return;
        const cls = await measureAsync("screen.studentScouting.load.class", () => getClassById(classId, { organizationId }));
        if (!alive) return;
        setCurrentClass(cls);
        if (!cls) return;
        const existing = await measureAsync("screen.studentScouting.load.scouting", () => getStudentScoutingByDate(studentId, cls.id, todayKey));
        if (!alive) return;
        if (existing) {
          setCounts({
            serve: { 0: existing.serve0, 1: existing.serve1, 2: existing.serve2 },
            receive: { 0: existing.receive0, 1: existing.receive1, 2: existing.receive2 },
            set: { 0: existing.set0, 1: existing.set1, 2: existing.set2 },
            attack_send: { 0: existing.attackSend0, 1: existing.attackSend1, 2: existing.attackSend2 },
          });
        }
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [studentId, classId, organizationId, todayKey, roleLoading, attempt]);

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
    if (!student || !currentClass || !organizationId || !canEdit || saving) return;
    setSaving(true);
    setSaveFailed(false);
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
      }, { organizationId });
      if (mounted.current) navigateBackOrReplace({ router, fallback: "/student/home" });
    } catch {
      if (mounted.current) setSaveFailed(true);
    } finally {
      if (mounted.current) setSaving(false);
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
        ) : failed ? (
          <ListEmptyState title="Não foi possível carregar seu scouting"
            description="Confira sua conexão e tente novamente."
            actionLabel="Tentar novamente" onAction={() => setAttempt(value => value + 1)} />
        ) : !currentClass ? (
          <ListEmptyState title="Nenhuma turma disponível" description="Seu scouting aparece quando houver uma turma vinculada." />
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

        {saveFailed ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>Não foi possível salvar. Seus registros foram mantidos para tentar novamente.</Text> : null}
        <StudentAction label={saving ? "Salvando..." : "Salvar scouting"} primary onPress={handleSave} disabled={!canEdit || saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function StudentScouting() {
  const { student } = useRole();
  const scope = JSON.stringify([student?.id, student?.organizationId, student?.classId]);
  return <AppShell role="student"><StudentScoutingContent key={scope} /></AppShell>;
}
