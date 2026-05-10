import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClassContextHeader } from "../../src/ui/ClassContextHeader";
import { useAppTheme } from "../../src/ui/app-theme";
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

  const loadData = useCallback(async () => {
    if (!classId) return;
    const [classData, resolvedSummary] = await Promise.all([
      getClassById(classId),
      buildTeamPlanningContextSummary(classId, referenceDate),
    ]);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <ClassContextHeader
            title="Contexto da turma"
            className={cls.name}
            unit={cls.unit}
            ageBand={cls.ageBand}
            gender={cls.gender}
            dateLabel={formatDateLabel(referenceDate)}
            timeLabel={formatRange(cls.startTime, cls.durationMinutes)}
            notice="Registre eventos e observações que devem afetar o próximo treino."
            classColorKey={cls.colorKey ?? null}
            scheduleFormat="combined"
          />

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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
