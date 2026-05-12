import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppCard } from "../../src/ui/AppCard";
import { AppPageHeader } from "../../src/ui/AppPageHeader";
import { AppScreenShell } from "../../src/ui/AppScreenShell";
import { useAppTheme } from "../../src/ui/app-theme";
import { getClassPalette } from "../../src/ui/class-colors";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { LocationBadge } from "../../src/ui/LocationBadge";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { getClassById } from "../../src/db/classes";
import type { ClassGroup } from "../../src/core/models";
import { ScreenLoadingState } from "../../src/components/ui/ScreenLoadingState";
import { CoachInterventionsPanel } from "../../src/screens/team-context/components/CoachInterventionsPanel";
import { TeamEventsPanel } from "../../src/screens/team-context/components/TeamEventsPanel";
import { TeamPlanningContextSummary } from "../../src/screens/team-context/components/TeamPlanningContextSummary";
import {
  buildTeamPlanningContextSummary,
  type CreateCoachInterventionInput,
  type CreateTeamEventInput,
  createCoachIntervention,
  createTeamEvent,
} from "../../src/screens/team-context/team-context-actions";
import { markRender, measureAsync } from "../../src/observability/perf";

const formatDateLabel = (value: string) => {
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatRange = (startTime: string, durationMinutes: number) => {
  const match = startTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) return startTime;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const end = hour * 60 + minute + durationMinutes;
  const endHour = Math.floor(end / 60) % 24;
  const endMinute = end % 60;
  return `${startTime} - ${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
};

export default function ClassContextScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof buildTeamPlanningContextSummary>>["events"]>([]);
  const [interventions, setInterventions] = useState<
    Awaited<ReturnType<typeof buildTeamPlanningContextSummary>>["interventions"]
  >([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof buildTeamPlanningContextSummary>> | null>(null);

  const referenceDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  markRender("screen.classContext.render.root", {
    hasClass: cls ? 1 : 0,
    events: events.length,
    interventions: interventions.length,
  });

  const loadData = useCallback(async () => {
    if (!classId) return;
    const [classData, resolvedSummary] = await measureAsync("screen.classContext.load.summary", () =>
      Promise.all([
        getClassById(classId),
        buildTeamPlanningContextSummary(classId, referenceDate),
      ])
    );
    setCls(classData);
    setSummary(resolvedSummary);
    setEvents(resolvedSummary.events);
    setInterventions(resolvedSummary.interventions);
  }, [classId, referenceDate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await loadData();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadData, refreshToken]);

  const reload = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const handleCreateEvent = useCallback(
    async (input: Omit<CreateTeamEventInput, "classId">) => {
      try {
        await createTeamEvent({ ...input, classId: classId ?? "" });
        reload();
      } catch (error) {
        Alert.alert("Falha ao salvar evento", error instanceof Error ? error.message : "Tente novamente.");
      }
    },
    [classId, reload]
  );

  const handleCreateIntervention = useCallback(
    async (input: Omit<CreateCoachInterventionInput, "classId">) => {
      try {
        await createCoachIntervention({ ...input, classId: classId ?? "" });
        reload();
      } catch (error) {
        Alert.alert(
          "Falha ao salvar intervenção",
          error instanceof Error ? error.message : "Tente novamente."
        );
      }
    },
    [classId, reload]
  );

  if (loading) {
    return <ScreenLoadingState />;
  }

  if (!cls || !summary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>
          Turma não encontrada
        </Text>
      </SafeAreaView>
    );
  }

  const classPalette = getClassPalette(cls.colorKey, colors, cls.unit);
  const unitPalette = getUnitPalette(cls.unit || "Unidade", colors);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <AppScreenShell
          header={
            <AppPageHeader
              title="Contexto competitivo"
              subtitle="Eventos, ajustes e sinais que orientam o próximo treino."
              onBack={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace({
                  pathname: "/class/[id]",
                  params: { id: cls.id },
                });
              }}
              meta={
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: classPalette.bg }} />
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{cls.name}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <ClassGenderBadge gender={cls.gender} size="sm" />
                    <LocationBadge location={cls.unit || "Unidade"} palette={unitPalette} size="sm" showIcon={false} />
                  </View>
                </View>
              }
            />
          }
        >
        <ScrollView
          contentContainerStyle={{ gap: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <AppCard compact>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
              {formatDateLabel(referenceDate)} · {formatRange(cls.startTime, cls.durationMinutes)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
              {cls.ageBand ? `Turma ${cls.ageBand}` : "Turma sem faixa etária definida"}
            </Text>
          </AppCard>

          <TeamPlanningContextSummary
            colors={colors}
            planningModeLabel={summary.planningModeLabel}
            loadBiasLabel={summary.loadBiasLabel}
            focusHints={summary.context.focusHints}
            avoidHints={summary.context.avoidHints}
            reason={summary.context.reason}
          />

          <View style={{ gap: 16 }}>
            <TeamEventsPanel colors={colors} events={events} onCreate={handleCreateEvent} />
            <CoachInterventionsPanel
              colors={colors}
              interventions={interventions}
              events={events}
              onCreate={handleCreateIntervention}
            />
          </View>
        </ScrollView>
        </AppScreenShell>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
