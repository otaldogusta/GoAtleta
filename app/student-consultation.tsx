import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRole } from "../src/auth/role";
import {
  createWorkoutExecutionLog,
  findNextStudentWorkout,
  getWorkoutAttentionSignal,
} from "../src/core/consultation";
import type { PrescribedWorkout } from "../src/core/consultation";
import {
  getConsultationLocalState,
  saveWorkoutExecutionLog,
  type ConsultationLocalState,
} from "../src/db/consultation-local";
import { markRender, measureAsync } from "../src/observability/perf";
import { radius } from "../src/theme/tokens";
import { useAppTheme } from "../src/ui/app-theme";
import { Pressable } from "../src/ui/Pressable";

const scaleValues = Array.from({ length: 11 }, (_, index) => index);

const exerciseCell = (value: string | number | undefined) =>
  value === undefined || value === "" ? "-" : String(value);

export default function StudentConsultationScreen() {
  markRender("screen.studentConsultation.render.root");
  const { colors } = useAppTheme();
  const { student } = useRole();
  const [state, setState] = useState<ConsultationLocalState>({
    profiles: [],
    workouts: [],
    executionLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [pse, setPse] = useState(5);
  const [pain, setPain] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [doneWorkoutId, setDoneWorkoutId] = useState("");

  const reload = async () => {
    setLoading(true);
    const consultationState = await measureAsync(
      "screen.studentConsultation.load.localState",
      () => getConsultationLocalState()
    );
    setState(consultationState);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const workout = useMemo<PrescribedWorkout | null>(() => {
    if (!student?.id) return null;
    return findNextStudentWorkout(state.workouts, student.id);
  }, [state.workouts, student?.id]);

  const profile = state.profiles.find((item) => item.studentId === student?.id);
  const latestLog = state.executionLogs.find((item) => item.workoutId === doneWorkoutId);
  const attention = latestLog ? getWorkoutAttentionSignal(latestLog) : null;
  const currentAttention =
    pain >= 7
      ? { tone: "danger" as const, label: "Dor alta", description: "Interrompa se a dor estiver forte e avise o profissional." }
      : pain >= 4 || pse >= 8
        ? { tone: "warning" as const, label: "Pede atenção", description: "Informe como foi para o profissional ajustar o próximo treino." }
        : null;

  const submit = async () => {
    if (!workout) return;
    const log = createWorkoutExecutionLog({
      id: `log_${workout.id}_${Date.now()}`,
      workout,
      completedAt: new Date().toISOString(),
      perceivedExertion: pse,
      painLevel: pain,
      studentFeedback: feedback,
    });
    await saveWorkoutExecutionLog(log);
    setDoneWorkoutId(workout.id);
    setStarted(false);
    setFeedback("");
    await reload();
  };

  const ScalePicker = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
  }) => (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "900" }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {scaleValues.map((item) => {
          const active = item === value;
          return (
            <Pressable
              key={`${label}-${item}`}
              onPress={() => onChange(item)}
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.primaryBg : colors.card,
                borderWidth: 1,
                borderColor: active ? colors.primaryBg : colors.border,
              }}
            >
              <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "900" }}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900" }}>
            Treino de hoje
          </Text>
          <Text style={{ color: colors.muted }}>
            Siga o treino publicado e envie como foi para o professor.
          </Text>
        </View>

        <View style={{ padding: 12, borderRadius: radius.card, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder }}>
          <Text style={{ color: colors.warningText, fontWeight: "800", lineHeight: 18 }}>
            Interrompa o exercício se sentir dor forte, tontura ou mal-estar e avise o profissional.
          </Text>
        </View>

        {loading ? (
          <Text style={{ color: colors.muted }}>Carregando...</Text>
        ) : !workout ? (
          <View style={{ gap: 8, padding: 16, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.successText} />
            <Text style={{ color: colors.text, fontWeight: "900" }}>Nenhum treino publicado para hoje.</Text>
            <Text style={{ color: colors.muted }}>
              Quando o profissional publicar seu treino, ele aparecerá aqui.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 8, padding: 16, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
                {workout.title}
              </Text>
              <Text style={{ color: colors.muted }}>
                {workout.dayLabel} · {workout.estimatedDurationMin} min
              </Text>
              <Text style={{ color: colors.text, lineHeight: 20 }}>{workout.objective}</Text>
              {profile ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Ambiente: {profile.environment} · {profile.trainingDaysPerWeek}x por semana
                </Text>
              ) : null}
            </View>

            <View style={{ gap: 8, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>Exercícios</Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  paddingBottom: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.muted, flex: 1.6, fontSize: 11, fontWeight: "900" }}>Atividade</Text>
                <Text style={{ color: colors.muted, flex: 0.7, fontSize: 11, fontWeight: "900", textAlign: "center" }}>Séries</Text>
                <Text style={{ color: colors.muted, flex: 0.9, fontSize: 11, fontWeight: "900", textAlign: "center" }}>Repet.</Text>
                <Text style={{ color: colors.muted, flex: 0.8, fontSize: 11, fontWeight: "900", textAlign: "center" }}>Interv.</Text>
              </View>
              {workout.exercises.map((exercise) => (
                <View key={exercise.id} style={{ gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Text style={{ color: colors.text, flex: 1.6, fontSize: 13, fontWeight: "900" }}>{exercise.name}</Text>
                    <Text style={{ color: colors.text, flex: 0.7, fontSize: 12, fontWeight: "800", textAlign: "center" }}>
                      {exerciseCell(exercise.sets)}
                    </Text>
                    <Text style={{ color: colors.text, flex: 0.9, fontSize: 12, fontWeight: "800", textAlign: "center" }}>
                      {exerciseCell(exercise.reps ?? (exercise.durationSec ? `${exercise.durationSec}s` : undefined))}
                    </Text>
                    <Text style={{ color: colors.text, flex: 0.8, fontSize: 12, fontWeight: "800", textAlign: "center" }}>
                      {exerciseCell(exercise.restSec ? `${exercise.restSec}s` : undefined)}
                    </Text>
                  </View>
                  {started && exercise.instructions ? (
                    <Text style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>
                      Obs.: {exercise.instructions}
                    </Text>
                  ) : null}
                </View>
              ))}
              <Pressable
                onPress={() => setStarted((current) => !current)}
                style={{ alignItems: "center", padding: 12, borderRadius: radius.full, backgroundColor: colors.primaryBg }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
                  {started ? "Ocultar instruções" : "Iniciar treino"}
                </Text>
              </Pressable>
            </View>

            <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                Como foi o treino?
              </Text>
              <ScalePicker label="Esforço percebido" value={pse} onChange={setPse} />
              <ScalePicker label="Sentiu dor?" value={pain} onChange={setPain} />
              {currentAttention ? (
                <View
                  style={{
                    padding: 10,
                    borderRadius: radius.internal,
                    backgroundColor: currentAttention.tone === "danger" ? colors.dangerBg : colors.warningBg,
                    borderWidth: 1,
                    borderColor: currentAttention.tone === "danger" ? colors.dangerBorder : colors.warningBorder,
                  }}
                >
                  <Text
                    style={{
                      color: currentAttention.tone === "danger" ? colors.dangerText : colors.warningText,
                      fontWeight: "900",
                    }}
                  >
                    {currentAttention.label}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 12, marginTop: 3 }}>
                    {currentAttention.description}
                  </Text>
                </View>
              ) : null}
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Alguma observação para o professor?
                </Text>
                <TextInput
                  value={feedback}
                  onChangeText={setFeedback}
                  multiline
                  placeholder="Ex.: senti dificuldade no último exercício."
                  placeholderTextColor={colors.placeholder}
                  style={{
                    minHeight: 86,
                    borderRadius: radius.internal,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    padding: 12,
                    textAlignVertical: "top",
                  }}
                />
              </View>
              <Pressable
                disabled={!started}
                onPress={submit}
                style={{
                  alignItems: "center",
                  padding: 12,
                  borderRadius: radius.full,
                  backgroundColor: started ? colors.primaryBg : colors.secondaryBg,
                }}
              >
                <Text style={{ color: started ? colors.primaryText : colors.muted, fontWeight: "900" }}>
                  Concluir treino e enviar feedback
                </Text>
              </Pressable>
              {!started ? (
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
                  Toque em “Iniciar treino” antes de concluir.
                </Text>
              ) : null}
            </View>
          </>
        )}

        {attention ? (
          <View style={{ padding: 12, borderRadius: radius.card, backgroundColor: attention.tone === "danger" ? colors.dangerBg : attention.tone === "warning" ? colors.warningBg : colors.successBg }}>
            <Text style={{ color: attention.tone === "danger" ? colors.dangerText : attention.tone === "warning" ? colors.warningText : colors.successText, fontWeight: "900" }}>
              Feedback enviado · {attention.label}
            </Text>
            <Text style={{ color: colors.text, marginTop: 4 }}>{attention.description}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
