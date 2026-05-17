import { Ionicons } from "@expo/vector-icons";
// perf-check: ignore-inline-row-style - tela piloto usa composição local com chips/listas pequenas; extração fica para consolidação pós-piloto.
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type {
  AvailableEquipment,
  ConsultationGoal,
  OnlineConsultationProfile,
  PrescribedExercise,
  TrainingEnvironment,
} from "../../src/core/consultation";
import {
  buildWorkoutFeedbackSummary,
  createConsultationProfile,
  createPrescribedWorkout,
  getWorkoutAttentionSignal,
} from "../../src/core/consultation";
import type { Student } from "../../src/core/models";
import {
  getConsultationLocalState,
  markExecutionLogReviewed,
  saveConsultationProfile,
  savePrescribedWorkout,
  type ConsultationLocalState,
} from "../../src/db/consultation-local";
import { getStudents } from "../../src/db/seed";
import { markRender, measureAsync } from "../../src/observability/perf";
import { radius } from "../../src/theme/tokens";
import { useAppTheme } from "../../src/ui/app-theme";
import { ModalDialogFrame } from "../../src/ui/ModalDialogFrame";
import { Pressable } from "../../src/ui/Pressable";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";

const goalOptions: { value: ConsultationGoal; label: string }[] = [
  { value: "emagrecimento", label: "Emagrecimento" },
  { value: "hipertrofia", label: "Hipertrofia" },
  { value: "forca", label: "Força" },
  { value: "condicionamento", label: "Condicionamento" },
  { value: "saude", label: "Saúde" },
  { value: "retorno_atividade", label: "Retorno à atividade" },
  { value: "outro", label: "Outro" },
];

const environmentOptions: { value: TrainingEnvironment; label: string }[] = [
  { value: "casa", label: "Casa" },
  { value: "academia", label: "Academia" },
  { value: "condominio", label: "Condomínio" },
  { value: "ar_livre", label: "Ar livre" },
  { value: "misto", label: "Misto" },
];

const equipmentOptions: { value: AvailableEquipment; label: string }[] = [
  { value: "peso_corporal", label: "Peso corporal" },
  { value: "halteres", label: "Halteres" },
  { value: "elastico", label: "Elástico" },
  { value: "colchonete", label: "Colchonete" },
  { value: "cadeira_banco", label: "Cadeira/banco" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "barra", label: "Barra" },
  { value: "maquinas", label: "Máquinas" },
];

const weekStart = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
};

const parseList = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseExercises = (value: string): PrescribedExercise[] =>
  value
    .split("\n")
    .map((line, index) => {
      const [name = "", sets = "", reps = "", rest = "", note = ""] = line
        .split("|")
        .map((item) => item.trim());
      return {
        id: `exercise-${index + 1}`,
        name,
        sets: Number(sets) > 0 ? Number(sets) : undefined,
        reps: reps || undefined,
        restSec: Number(rest) > 0 ? Number(rest) : undefined,
        instructions: note || undefined,
      };
    })
    .filter((item) => item.name);

type PrescriptionBlock = "profile" | "prescription" | "notes";

type ExerciseDraftRow = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  note: string;
};

const parseExerciseDraftRows = (value: string): ExerciseDraftRow[] => {
  const rows = value
    .split("\n")
    .map((line) => {
      const [name = "", sets = "", reps = "", rest = "", note = ""] = line
        .split("|")
        .map((item) => item.trim());
      return { name, sets, reps, rest, note };
    })
    .filter((row) => row.name || row.sets || row.reps || row.rest || row.note);

  return rows.length ? rows : [{ name: "", sets: "", reps: "", rest: "", note: "" }];
};

const serializeExerciseDraftRows = (rows: ExerciseDraftRow[]) =>
  rows
    .filter((row) => row.name || row.sets || row.reps || row.rest || row.note)
    .map((row) => [row.name, row.sets, row.reps, row.rest, row.note].join(" | "))
    .join("\n");

const formatExerciseLine = (exercise: PrescribedExercise) =>
  [
    exercise.name,
    exercise.sets ? `${exercise.sets}x` : "tempo",
    exercise.reps ?? (exercise.durationSec ? `${exercise.durationSec}s` : "-"),
    exercise.restSec ? `${exercise.restSec}s` : "-",
    exercise.instructions ?? "-",
  ].join(" | ");

export default function ConsultationScreen() {
  markRender("screen.consultation.render.root");
  const { colors } = useAppTheme();
  const modalCardStyle = useModalCardStyle({ maxWidth: 1120, maxHeight: "92%", radius: 18 });
  const [students, setStudents] = useState<Student[]>([]);
  const [state, setState] = useState<ConsultationLocalState>({
    profiles: [],
    workouts: [],
    executionLogs: [],
  });
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [goal, setGoal] = useState<ConsultationGoal>("saude");
  const [environment, setEnvironment] = useState<TrainingEnvironment>("casa");
  const [equipment, setEquipment] = useState<AvailableEquipment[]>(["peso_corporal"]);
  const [restrictions, setRestrictions] = useState("");
  const [injuries, setInjuries] = useState("");
  const [trainingDays, setTrainingDays] = useState("3");
  const [duration, setDuration] = useState("45");
  const [profileNotes, setProfileNotes] = useState("");
  const [title, setTitle] = useState("Treino A - Casa");
  const [dayLabel, setDayLabel] = useState("Segunda");
  const [objective, setObjective] = useState("Força geral e controle corporal");
  const [exerciseLines, setExerciseLines] = useState(
    "Agachamento livre | 3 | 12 | 60 | movimento controlado\nFlexão inclinada | 3 | 8-10 | 60 | usar banco/cadeira\nPrancha | 3 | 30s | 45 | manter respiração"
  );
  const [coachNotes, setCoachNotes] = useState(
    "Interrompa o exercício se sentir dor forte, tontura ou mal-estar e avise o profissional."
  );
  const [notice, setNotice] = useState("");
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activePrescriptionBlock, setActivePrescriptionBlock] =
    useState<PrescriptionBlock>("prescription");

  const reload = async () => {
    const [studentItems, consultationState] = await measureAsync(
      "screen.consultation.load.localState",
      () => Promise.all([getStudents(), getConsultationLocalState()])
    );
    setStudents(studentItems);
    setState(consultationState);
    setSelectedStudentId((current) => current || studentItems[0]?.id || "");
  };

  useEffect(() => {
    void reload();
  }, []);

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const selectedProfile = state.profiles.find((item) => item.studentId === selectedStudentId);
  const studentWorkouts = state.workouts.filter((item) => item.studentId === selectedStudentId);
  const studentLogs = state.executionLogs.filter((item) => item.studentId === selectedStudentId);
  const pendingLogs = studentLogs.filter((log) => log.coachReviewStatus !== "reviewed");
  const latestWorkout = studentWorkouts[0] ?? null;

  useEffect(() => {
    if (!selectedProfile) return;
    setGoal(selectedProfile.goal);
    setEnvironment(selectedProfile.environment);
    setEquipment(selectedProfile.availableEquipment);
    setRestrictions((selectedProfile.restrictions ?? []).join(", "));
    setInjuries((selectedProfile.injuries ?? []).join(", "));
    setTrainingDays(String(selectedProfile.trainingDaysPerWeek));
    setDuration(String(selectedProfile.preferredSessionDurationMin ?? 45));
    setProfileNotes(selectedProfile.notes ?? "");
  }, [selectedProfile?.studentId]);

  const profileDraft = useMemo<OnlineConsultationProfile | null>(() => {
    if (!selectedStudentId) return null;
    return createConsultationProfile({
      studentId: selectedStudentId,
      goal,
      environment,
      availableEquipment: equipment,
      restrictions: parseList(restrictions),
      injuries: parseList(injuries),
      trainingDaysPerWeek: Number(trainingDays),
      preferredSessionDurationMin: Number(duration),
      notes: profileNotes,
    });
  }, [duration, environment, equipment, goal, injuries, profileNotes, restrictions, selectedStudentId, trainingDays]);

  const exerciseDraftRows = useMemo(
    () => parseExerciseDraftRows(exerciseLines),
    [exerciseLines]
  );

  const updateExerciseDraftRow = (
    index: number,
    field: keyof ExerciseDraftRow,
    value: string
  ) => {
    const nextRows = exerciseDraftRows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row
    );
    setExerciseLines(serializeExerciseDraftRows(nextRows));
  };

  const addExerciseDraftRow = () => {
    setExerciseLines(
      serializeExerciseDraftRows([
        ...exerciseDraftRows,
        { name: "", sets: "", reps: "", rest: "", note: "" },
      ])
    );
  };

  const removeExerciseDraftRow = (index: number) => {
    const nextRows = exerciseDraftRows.filter((_, rowIndex) => rowIndex !== index);
    setExerciseLines(serializeExerciseDraftRows(nextRows));
  };

  const toggleEquipment = (value: AvailableEquipment) => {
    setEquipment((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const saveProfile = async () => {
    if (!profileDraft) return;
    await saveConsultationProfile(profileDraft);
    setNotice("Perfil de treino salvo.");
    await reload();
  };

  const publishWorkout = async () => {
    if (!selectedStudentId) return;
    const exercises = parseExercises(exerciseLines);
    if (!exercises.length) return;
    setIsPublishing(true);
    const workout = createPrescribedWorkout({
      id: `consult_${selectedStudentId}_${Date.now()}`,
      studentId: selectedStudentId,
      title,
      weekStartDate: weekStart(),
      dayLabel,
      objective,
      estimatedDurationMin: Number(duration),
      exercises,
      coachNotes,
      status: "published",
    });
    try {
      await savePrescribedWorkout(workout);
      setNotice("Treino publicado para a aluna.");
      setShowWorkoutModal(false);
      await reload();
    } finally {
      setIsPublishing(false);
    }
  };

  const reviewLog = async (logId: string) => {
    await markExecutionLogReviewed(logId);
    setNotice("Feedback marcado como revisado.");
    await reload();
  };

  const Chip = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? colors.primaryBg : colors.border,
        backgroundColor: active ? colors.primaryBg : colors.card,
      }}
    >
      <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700", fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );

  const Field = ({
    label,
    value,
    onChangeText,
    multiline,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    multiline?: boolean;
  }) => (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.placeholder}
        style={{
          minHeight: multiline ? 76 : 42,
          borderRadius: radius.internal,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          color: colors.inputText,
          paddingHorizontal: 12,
          paddingVertical: 10,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );

  const Step = ({
    index,
    label,
    done,
  }: {
    index: number;
    label: string;
    done: boolean;
  }) => (
    <View style={{ alignItems: "center", flex: 1, gap: 6, minWidth: 92 }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: done ? colors.successBg : colors.secondaryBg,
          borderColor: done ? colors.successBorder : colors.border,
          borderRadius: radius.full,
          borderWidth: 1,
          height: 30,
          justifyContent: "center",
          width: 30,
        }}
      >
        <Text style={{ color: done ? colors.successText : colors.muted, fontSize: 12, fontWeight: "900" }}>
          {done ? "✓" : index}
        </Text>
      </View>
      <Text style={{ color: done ? colors.text : colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900" }}>
            Consultoria online
          </Text>
          <Text style={{ color: colors.muted }}>
            Prescrição individual, execução em casa e feedback semanal.
          </Text>
        </View>

        <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Fluxo do piloto</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Step index={1} label="Selecionar aluna" done={!!selectedStudentId} />
            <Step index={2} label="Perfil de treino" done={!!selectedProfile} />
            <Step index={3} label="Publicar treino" done={studentWorkouts.length > 0} />
            <Step index={4} label="Receber feedback" done={studentLogs.length > 0} />
            <Step index={5} label="Revisar devolutiva" done={studentLogs.length > 0 && pendingLogs.length === 0} />
          </View>
        </View>

        {notice ? (
          <View style={{ padding: 12, borderRadius: radius.card, backgroundColor: colors.successBg }}>
            <Text style={{ color: colors.successText, fontWeight: "800" }}>{notice}</Text>
          </View>
        ) : null}

        <View style={{ gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Aluna</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {students.map((student) => (
              <Chip
                key={student.id}
                label={student.name}
                active={student.id === selectedStudentId}
                onPress={() => setSelectedStudentId(student.id)}
              />
            ))}
          </ScrollView>
          {selectedStudent ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {selectedStudent.name} · {selectedStudent.loginEmail || selectedStudent.phone || "sem contato"}
            </Text>
          ) : (
            <Text style={{ color: colors.muted }}>Selecione uma aluna para começar.</Text>
          )}
        </View>

        <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Perfil de treino</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Onde ela treina, objetivo, materiais e cuidados.
          </Text>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>Objetivo principal</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {goalOptions.map((item) => (
                <Chip key={item.value} label={item.label} active={goal === item.value} onPress={() => setGoal(item.value)} />
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>Onde ela treina?</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {environmentOptions.map((item) => (
                <Chip key={item.value} label={item.label} active={environment === item.value} onPress={() => setEnvironment(item.value)} />
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>Materiais disponíveis</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {equipmentOptions.map((item) => (
                <Chip key={item.value} label={item.label} active={equipment.includes(item.value)} onPress={() => toggleEquipment(item.value)} />
              ))}
            </View>
          </View>
          <Field label="Restrições e cuidados" value={restrictions} onChangeText={setRestrictions} multiline />
          <Field label="Lesões informadas" value={injuries} onChangeText={setInjuries} multiline />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Dias por semana" value={trainingDays} onChangeText={setTrainingDays} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Duração média" value={duration} onChangeText={setDuration} />
            </View>
          </View>
          <Field label="Observações" value={profileNotes} onChangeText={setProfileNotes} multiline />
          <Pressable onPress={saveProfile} style={{ alignItems: "center", padding: 12, borderRadius: radius.full, backgroundColor: colors.primaryBg }}>
            <Text style={{ color: colors.primaryText, fontWeight: "900" }}>Salvar perfil de treino</Text>
          </Pressable>
        </View>

        <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Prescrição da semana</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Edite o treino no mesmo padrão de planejamento usado nas turmas.
              </Text>
            </View>
            <Pressable
              disabled={!selectedStudentId}
              onPress={() => setShowWorkoutModal(true)}
              style={{
                alignItems: "center",
                backgroundColor: selectedStudentId ? colors.primaryBg : colors.secondaryBg,
                borderRadius: radius.full,
                flexDirection: "row",
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Ionicons name="create-outline" size={15} color={selectedStudentId ? colors.primaryText : colors.muted} />
              <Text style={{ color: selectedStudentId ? colors.primaryText : colors.muted, fontWeight: "900", fontSize: 12 }}>
                Editar prescrição
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: 8, borderRadius: radius.internal, backgroundColor: colors.secondaryBg, padding: 12 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>{title}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {dayLabel} · {duration || "45"} min · {parseExercises(exerciseLines).length} exercício(s)
            </Text>
            <Text style={{ color: colors.text, lineHeight: 19 }}>{objective}</Text>
          </View>
          {!selectedProfile ? (
            <View style={{ padding: 10, borderRadius: radius.internal, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder }}>
              <Text style={{ color: colors.warningText, fontSize: 12, fontWeight: "800" }}>
                Salve o perfil de treino antes de usar com uma aluna real.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Treino publicado</Text>
          {latestWorkout ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>{latestWorkout.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {latestWorkout.dayLabel} · {latestWorkout.estimatedDurationMin} min · {latestWorkout.status === "published" ? "Publicado" : latestWorkout.status}
              </Text>
              <Text style={{ color: colors.text, lineHeight: 19 }}>{latestWorkout.objective}</Text>
              <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>
                  Atividade | Séries | Repet. | Interv. | Obs.
                </Text>
                {latestWorkout.exercises.map((exercise) => (
                  <Text key={exercise.id} style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
                    {formatExerciseLine(exercise)}
                  </Text>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: 8, padding: 16 }}>
              <Ionicons name="calendar-outline" size={24} color={colors.muted} />
              <Text style={{ color: colors.text, fontWeight: "900", textAlign: "center" }}>Nenhum treino publicado ainda.</Text>
              <Text style={{ color: colors.muted, textAlign: "center" }}>
                Publique o primeiro treino para a aluna visualizar no celular.
              </Text>
            </View>
          )}
        </View>

        <View style={{ gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Execuções e feedback</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {studentWorkouts.length} treino(s) publicado(s) · {pendingLogs.length} feedback(s) pendente(s)
          </Text>
          {studentLogs.length ? (
            studentLogs.map((log) => {
              const workout = state.workouts.find((item) => item.id === log.workoutId);
              const signal = getWorkoutAttentionSignal(log);
              const toneColors =
                signal.tone === "danger"
                  ? { bg: colors.dangerBg, text: colors.dangerText }
                  : signal.tone === "warning"
                    ? { bg: colors.warningBg, text: colors.warningText }
                    : { bg: colors.successBg, text: colors.successText };
              return (
                <View key={log.id} style={{ gap: 8, padding: 12, borderRadius: radius.card, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "900", flex: 1 }}>
                      {workout?.title ?? "Treino concluído"}
                    </Text>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, backgroundColor: toneColors.bg }}>
                      <Text style={{ color: toneColors.text, fontSize: 11, fontWeight: "900" }}>{signal.label}</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    PSE {log.perceivedExertion ?? 0}/10 · Dor {log.painLevel ?? 0}/10
                  </Text>
                  {workout ? (
                    <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
                      {buildWorkoutFeedbackSummary(workout, log)}
                    </Text>
                  ) : null}
                  <Pressable onPress={() => reviewLog(log.id)} style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                      {log.coachReviewStatus === "reviewed" ? "Revisado" : "Marcar como revisado"}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View style={{ alignItems: "center", gap: 8, padding: 16 }}>
              <Ionicons name="clipboard-outline" size={24} color={colors.muted} />
              <Text style={{ color: colors.muted, textAlign: "center" }}>
                Nenhum feedback recebido ainda. Quando a aluna concluir o treino, aparece aqui.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <ModalDialogFrame
        visible={showWorkoutModal}
        onClose={() => setShowWorkoutModal(false)}
        cardStyle={modalCardStyle}
        position="center"
        colors={colors}
        title="Editar prescrição individual"
        subtitle={`${selectedStudent?.name ?? "Aluna"} · ${weekStart()} · ${dayLabel}`}
        contentContainerStyle={{ gap: 14, paddingBottom: 24, paddingTop: 12 }}
        footerStyle={{ paddingTop: 12, paddingBottom: 4 }}
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setShowWorkoutModal(false)}
              style={{
                alignItems: "center",
                backgroundColor: colors.secondaryBg,
                borderColor: colors.border,
                borderRadius: radius.card,
                borderWidth: 1,
                flex: 1,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>Cancelar</Text>
            </Pressable>
            <Pressable
              disabled={isPublishing || !selectedStudentId || !parseExercises(exerciseLines).length}
              onPress={() => {
                void publishWorkout();
              }}
              style={{
                alignItems: "center",
                backgroundColor:
                  isPublishing || !selectedStudentId || !parseExercises(exerciseLines).length
                    ? colors.primaryDisabledBg
                    : colors.primaryBg,
                borderRadius: radius.card,
                flex: 1,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color:
                    isPublishing || !selectedStudentId || !parseExercises(exerciseLines).length
                      ? colors.secondaryText
                      : colors.primaryText,
                  fontWeight: "900",
                }}
              >
                {isPublishing ? "Publicando..." : "Publicar treino"}
              </Text>
            </Pressable>
          </View>
        }
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          style={{ width: "100%" }}
        >
          <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14 }}>
            <View
              style={{
                backgroundColor: colors.secondaryBg,
                borderColor: colors.border,
                borderRadius: radius.card,
                borderWidth: 1,
                gap: 10,
                padding: 12,
                width: Platform.OS === "web" ? 320 : "100%",
              }}
            >
              {[
                {
                  id: "profile" as const,
                  label: "Perfil do treino",
                  value: selectedProfile
                    ? `${selectedProfile.environment} · ${selectedProfile.trainingDaysPerWeek}x/semana`
                    : "Perfil ainda não salvo",
                },
                {
                  id: "prescription" as const,
                  label: "Prescrição",
                  value: `${parseExercises(exerciseLines).length} exercício(s) · ${duration || "45"} min`,
                },
                {
                  id: "notes" as const,
                  label: "Observações",
                  value: coachNotes || "Sem observações",
                },
              ].map((item) => {
                const active = activePrescriptionBlock === item.id;
                return (
                <Pressable
                  key={item.label}
                  onPress={() => setActivePrescriptionBlock(item.id)}
                  style={{
                    backgroundColor: active ? colors.card : colors.secondaryBg,
                    borderColor: active ? colors.primaryBg : colors.border,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    gap: 4,
                    padding: 12,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>{item.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
                    {item.value}
                  </Text>
                </Pressable>
                );
              })}
            </View>

            <View style={{ flex: 1, gap: 12 }}>
              {activePrescriptionBlock === "profile" ? (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                    Perfil do treino
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {goalOptions.map((item) => (
                      <Chip key={item.value} label={item.label} active={goal === item.value} onPress={() => setGoal(item.value)} />
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {environmentOptions.map((item) => (
                      <Chip key={item.value} label={item.label} active={environment === item.value} onPress={() => setEnvironment(item.value)} />
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {equipmentOptions.map((item) => (
                      <Chip key={item.value} label={item.label} active={equipment.includes(item.value)} onPress={() => toggleEquipment(item.value)} />
                    ))}
                  </View>
                  <Field label="Restrições e cuidados" value={restrictions} onChangeText={setRestrictions} multiline />
                  <Field label="Lesões informadas" value={injuries} onChangeText={setInjuries} multiline />
                  <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Field label="Dias por semana" value={trainingDays} onChangeText={setTrainingDays} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Duração média" value={duration} onChangeText={setDuration} />
                    </View>
                  </View>
                  <Pressable
                    onPress={saveProfile}
                    style={{ alignItems: "center", padding: 12, borderRadius: radius.full, backgroundColor: colors.primaryBg }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: "900" }}>Salvar perfil de treino</Text>
                  </Pressable>
                </View>
              ) : null}

              {activePrescriptionBlock === "prescription" ? (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Field label="Título" value={title} onChangeText={setTitle} />
                    </View>
                    <View style={{ flex: 0.8 }}>
                      <Field label="Dia" value={dayLabel} onChangeText={setDayLabel} />
                    </View>
                    <View style={{ flex: 0.7 }}>
                      <Field label="Duração" value={duration} onChangeText={setDuration} />
                    </View>
                  </View>
                  <Field label="Objetivo do treino" value={objective} onChangeText={setObjective} />

                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ color: colors.text, fontWeight: "900" }}>Exercícios</Text>
                      <Pressable
                        onPress={addExerciseDraftRow}
                        style={{
                          alignItems: "center",
                          backgroundColor: colors.secondaryBg,
                          borderColor: colors.border,
                          borderRadius: radius.full,
                          borderWidth: 1,
                          height: 30,
                          justifyContent: "center",
                          width: 30,
                        }}
                      >
                        <Ionicons name="add" size={17} color={colors.text} />
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Text style={{ color: colors.muted, flex: 2, fontSize: 11, fontWeight: "900" }}>Exercício/atividade</Text>
                      <Text style={{ color: colors.muted, flex: 0.7, fontSize: 11, fontWeight: "900", textAlign: "center" }}>Séries</Text>
                      <Text style={{ color: colors.muted, flex: 0.9, fontSize: 11, fontWeight: "900", textAlign: "center" }}>Reps</Text>
                      <Text style={{ color: colors.muted, flex: 0.8, fontSize: 11, fontWeight: "900", textAlign: "center" }}>Interv.</Text>
                      <Text style={{ color: colors.muted, flex: 1.2, fontSize: 11, fontWeight: "900" }}>Obs.</Text>
                      <View style={{ width: 28 }} />
                    </View>
                    {exerciseDraftRows.map((row, index) => (
                      <View key={`exercise-row-${index}`} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <TextInput
                          value={row.name}
                          onChangeText={(value) => updateExerciseDraftRow(index, "name", value)}
                          placeholder="Exercício"
                          placeholderTextColor={colors.placeholder}
                          style={{
                            flex: 2,
                            borderRadius: radius.internal,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBg,
                            color: colors.inputText,
                            minHeight: 42,
                            paddingHorizontal: 10,
                          }}
                        />
                        <TextInput
                          value={row.sets}
                          onChangeText={(value) => updateExerciseDraftRow(index, "sets", value)}
                          placeholder="3"
                          placeholderTextColor={colors.placeholder}
                          style={{
                            flex: 0.7,
                            borderRadius: radius.internal,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBg,
                            color: colors.inputText,
                            minHeight: 42,
                            paddingHorizontal: 10,
                            textAlign: "center",
                          }}
                        />
                        <TextInput
                          value={row.reps}
                          onChangeText={(value) => updateExerciseDraftRow(index, "reps", value)}
                          placeholder="8-12"
                          placeholderTextColor={colors.placeholder}
                          style={{
                            flex: 0.9,
                            borderRadius: radius.internal,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBg,
                            color: colors.inputText,
                            minHeight: 42,
                            paddingHorizontal: 10,
                            textAlign: "center",
                          }}
                        />
                        <TextInput
                          value={row.rest}
                          onChangeText={(value) => updateExerciseDraftRow(index, "rest", value)}
                          placeholder="60"
                          placeholderTextColor={colors.placeholder}
                          style={{
                            flex: 0.8,
                            borderRadius: radius.internal,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBg,
                            color: colors.inputText,
                            minHeight: 42,
                            paddingHorizontal: 10,
                            textAlign: "center",
                          }}
                        />
                        <TextInput
                          value={row.note}
                          onChangeText={(value) => updateExerciseDraftRow(index, "note", value)}
                          placeholder="Obs."
                          placeholderTextColor={colors.placeholder}
                          style={{
                            flex: 1.2,
                            borderRadius: radius.internal,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBg,
                            color: colors.inputText,
                            minHeight: 42,
                            paddingHorizontal: 10,
                          }}
                        />
                        <Pressable
                          onPress={() => removeExerciseDraftRow(index)}
                          style={{
                            alignItems: "center",
                            backgroundColor: colors.secondaryBg,
                            borderColor: colors.border,
                            borderRadius: radius.full,
                            borderWidth: 1,
                            height: 28,
                            justifyContent: "center",
                            width: 28,
                          }}
                        >
                          <Ionicons name="close" size={14} color={colors.muted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    onPress={() => {
                      setExerciseLines(
                        "Agachamento livre | 3 | 12 | 60 | movimento controlado\nFlexão inclinada | 3 | 8-10 | 60 | usar banco/cadeira\nPrancha | 3 | 30s | 45 | manter respiração"
                      );
                    }}
                    style={{
                      alignSelf: Platform.OS === "web" ? "center" : "stretch",
                      backgroundColor: colors.dangerBg,
                      borderColor: colors.dangerBorder,
                      borderRadius: radius.card,
                      borderWidth: 1,
                      paddingHorizontal: 22,
                      paddingVertical: 11,
                    }}
                  >
                    <Text style={{ color: colors.dangerText, fontWeight: "900", textAlign: "center" }}>
                      Restaurar exemplo
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {activePrescriptionBlock === "notes" ? (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Observações</Text>
                  <Field label="Observações do professor" value={coachNotes} onChangeText={setCoachNotes} multiline />
                  <Field label="Observações do perfil" value={profileNotes} onChangeText={setProfileNotes} multiline />
                  <View style={{ padding: 10, borderRadius: radius.internal, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder }}>
                    <Text style={{ color: colors.warningText, fontWeight: "800", lineHeight: 18 }}>
                      Interrompa o exercício se sentir dor forte, tontura ou mal-estar e avise o profissional.
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </ModalDialogFrame>
    </SafeAreaView>
  );
}
