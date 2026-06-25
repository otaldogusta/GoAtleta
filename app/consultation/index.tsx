import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
// perf-check: ignore-inline-row-style - tela piloto usa composição local com chips/listas pequenas; extração fica para consolidação pós-piloto.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenPageHeader } from "../../src/components/ui/ScreenPageHeader";
import type {
  AvailableEquipment,
  ConsultationGoal,
  ConsultationProgressAttentionFlag,
  OnlineConsultationProfile,
  PrescribedExercise,
  PrescribedWorkout,
  TrainingEnvironment,
} from "../../src/core/consultation";
import {
  buildConsultationProgressSummary,
  buildWorkoutFeedbackSummary,
  createConsultationProfile,
  createPrescribedWorkout,
  getWorkoutAttentionSignal,
} from "../../src/core/consultation";
import type { Student } from "../../src/core/models";
import {
  deletePrescribedWorkout,
  getLastConsultationPersistenceStatus,
  getConsultationLocalState,
  markExecutionLogReviewed,
  saveConsultationProfile,
  savePrescribedWorkout,
  type ConsultationPersistenceStatus,
  type ConsultationLocalState,
} from "../../src/db/consultation";
import { getStudents } from "../../src/db/seed";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { notifyConsultationEvent } from "../../src/notifications/consultationNotifications";
import { markRender, measureAsync } from "../../src/observability/perf";
import { radius } from "../../src/theme/tokens";
import { animateLayout } from "../../src/ui/animate-layout";
import { useAppTheme } from "../../src/ui/app-theme";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { ModalDialogFrame } from "../../src/ui/ModalDialogFrame";
import { Pressable } from "../../src/ui/Pressable";
import { SyncStatusBadge } from "../../src/ui/SyncStatusBadge";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
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

const formatDisplayDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Sem execução";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const progressFlagCopy: Record<ConsultationProgressAttentionFlag, string> = {
  high_pain_recent: "Atenção: dor alta relatada recentemente",
  high_rpe_recent: "Atenção: esforço alto relatado recentemente",
  low_adherence: "Adesão abaixo do esperado",
  initial_history: "Ainda há poucos treinos para apontar tendência",
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
      const [name = "", sets = "", reps = "", rest = "", note = "", mediaUrl = ""] = line
        .split("|")
        .map((item) => item.trim());
      return {
        id: `exercise-${index + 1}`,
        name,
        sets: Number(sets) > 0 ? Number(sets) : undefined,
        reps: reps || undefined,
        restSec: Number(rest) > 0 ? Number(rest) : undefined,
        instructions: note || undefined,
        mediaUrl: mediaUrl || undefined,
      };
    })
    .filter((item) => item.name);

type PrescriptionBlock = "prescription" | "notes";
type ConsultationPanelTab = "prescription" | "profile" | "feedback" | "evolution";

type ExerciseDraftRow = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  note: string;
  mediaUrl: string;
};

const parseExerciseDraftRows = (value: string): ExerciseDraftRow[] => {
  const rows = value
    .split("\n")
    .map((line) => {
      const [name = "", sets = "", reps = "", rest = "", note = "", mediaUrl = ""] = line
        .split("|")
        .map((item) => item.trim());
      return { name, sets, reps, rest, note, mediaUrl };
    });

  return rows.length ? rows : [{ name: "", sets: "", reps: "", rest: "", note: "", mediaUrl: "" }];
};

const serializeExerciseDraftRows = (rows: ExerciseDraftRow[]) =>
  rows
    .map((row) => [row.name, row.sets, row.reps, row.rest, row.note, row.mediaUrl].join(" | "))
    .join("\n");

const exerciseColumnWidths = {
  sets: 62,
  reps: 72,
  rest: 72,
  remove: 28,
};

const defaultExerciseLines =
  "Agachamento livre | 3 | 12 | 60 | movimento controlado | \nFlexão inclinada | 3 | 8-10 | 60 | usar banco/cadeira | \nPrancha | 3 | 30s | 45 | manter respiração | ";

const buildWorkoutDraftSnapshot = ({
  title,
  dayLabel,
  duration,
  objective,
  exerciseLines,
  coachNotes,
}: {
  title: string;
  dayLabel: string;
  duration: string;
  objective: string;
  exerciseLines: string;
  coachNotes: string;
}) =>
  JSON.stringify({
    title,
    dayLabel,
    duration,
    objective,
    exerciseLines,
    coachNotes,
  });

const formatExerciseLine = (exercise: PrescribedExercise) =>
  [
    exercise.name,
    exercise.sets ? `${exercise.sets}x` : "tempo",
    exercise.reps ?? (exercise.durationSec ? `${exercise.durationSec}s` : "-"),
    exercise.restSec ? `${exercise.restSec}s` : "-",
    exercise.instructions ?? "-",
  ].join(" | ");

const serializeWorkoutExercises = (exercises: PrescribedExercise[]) =>
  exercises
    .map((exercise) =>
      [
        exercise.name,
        exercise.sets ? String(exercise.sets) : "",
        exercise.reps ?? (exercise.durationSec ? `${exercise.durationSec}s` : ""),
        exercise.restSec ? String(exercise.restSec) : "",
        exercise.instructions ?? "",
        exercise.mediaUrl ?? "",
      ].join(" | ")
    )
    .join("\n");

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const createPilotStudent = ({ name, contact }: { name: string; contact: string }): Student => {
  const normalizedContact = contact.trim();
  const isEmail = normalizedContact.includes("@");

  return {
    id: `pilot_${Date.now()}`,
    name,
    organizationId: "local",
    classId: "consultation",
    age: 0,
    phone: isEmail ? "" : normalizedContact,
    loginEmail: isEmail ? normalizedContact : "",
    guardianName: "",
    guardianPhone: "",
    guardianRelation: "",
    birthDate: "",
    healthIssue: false,
    healthIssueNotes: "",
    medicationUse: false,
    medicationNotes: "",
    healthObservations: "",
    positionPrimary: "indefinido",
    positionSecondary: "indefinido",
    athleteObjective: "rendimento",
    learningStyle: "misto",
    isExperimental: true,
    createdAt: new Date().toISOString(),
  };
};

type ConsultationFieldColors = Pick<
  ReturnType<typeof useAppTheme>["colors"],
  "border" | "inputBg" | "inputText" | "placeholder" | "text"
>;

const ConsultationField = ({
  colors,
  label,
  value,
  onChangeText,
  multiline,
}: {
  colors: ConsultationFieldColors;
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
      scrollEnabled={false}
      style={{
        minHeight: multiline ? 58 : 42,
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

export default function ConsultationScreen() {
  markRender("screen.consultation.render.root");
  const { colors } = useAppTheme();
  const router = useRouter();
  const modalCardStyle = useModalCardStyle({ maxWidth: 1120, maxHeight: "92%", radius: 18, padding: 18 });
  const [students, setStudents] = useState<Student[]>([]);
  const [pilotStudent, setPilotStudent] = useState<Student | null>(null);
  const [state, setState] = useState<ConsultationLocalState>({
    profiles: [],
    workouts: [],
    executionLogs: [],
  });
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [pilotStudentName, setPilotStudentName] = useState("");
  const [pilotStudentContact, setPilotStudentContact] = useState("");
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
  const [exerciseLines, setExerciseLines] = useState(defaultExerciseLines);
  const [coachNotes, setCoachNotes] = useState(
    "Interrompa o exercício se sentir dor forte, tontura ou mal-estar e avise o profissional."
  );
  const [notice, setNotice] = useState("");
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState("");
  const [activePrescriptionBlock, setActivePrescriptionBlock] =
    useState<PrescriptionBlock>("prescription");
  const [modalInitialSnapshot, setModalInitialSnapshot] = useState("");
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showConfirmDeleteWorkout, setShowConfirmDeleteWorkout] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(true);
  const [activeConsultationTab, setActiveConsultationTab] =
    useState<ConsultationPanelTab>("profile");
  const [persistenceStatus, setPersistenceStatus] = useState<ConsultationPersistenceStatus>(
    getLastConsultationPersistenceStatus()
  );

  const syncBadgeStatus = persistenceStatus.mode === "supabase" ? "synced" : "saved_local";
  const syncBadgeMessage =
    persistenceStatus.mode === "supabase" ? "Servidor sincronizado" : "Salvo localmente";

  const updatePersistenceNotice = (
    successMessage: string,
    status: ConsultationPersistenceStatus
  ) => {
    setPersistenceStatus(status);
    setNotice(status.mode === "supabase" ? successMessage : status.message);
  };

  const reload = async () => {
    const [studentItems, consultationState] = await measureAsync(
      "screen.consultation.load.localState",
      () => Promise.all([getStudents(), getConsultationLocalState()])
    );
    setStudents(studentItems);
    setState(consultationState);
    setPersistenceStatus(getLastConsultationPersistenceStatus());
    setSelectedStudentId((current) => current || studentItems[0]?.id || "");
  };

  useEffect(() => {
    void reload();
  }, []);

  const consultationStudents = useMemo(
    () => (pilotStudent ? [pilotStudent, ...students] : students),
    [pilotStudent, students]
  );
  const normalizedStudentSearch = normalizeSearchText(studentSearch);
  const filteredStudents = useMemo(() => {
    const list = normalizedStudentSearch
      ? consultationStudents.filter((student) =>
          [student.name, student.loginEmail, student.phone]
            .filter(Boolean)
            .some((value) => normalizeSearchText(value).includes(normalizedStudentSearch))
        )
      : consultationStudents;

    return list.slice(0, 12);
  }, [consultationStudents, normalizedStudentSearch]);
  const selectedStudent = consultationStudents.find((student) => student.id === selectedStudentId) ?? null;
  const selectedProfile = state.profiles.find((item) => item.studentId === selectedStudentId);
  const studentWorkouts = state.workouts.filter((item) => item.studentId === selectedStudentId);
  const publishedWorkouts = studentWorkouts.filter((item) => item.status === "published");
  const studentLogs = state.executionLogs.filter((item) => item.studentId === selectedStudentId);
  const pendingLogs = studentLogs.filter((log) => log.coachReviewStatus !== "reviewed");
  const latestWorkout = studentWorkouts[0] ?? null;
  const latestPublishedWorkout = publishedWorkouts[0] ?? null;
  const hasSavedProfile = Boolean(selectedProfile);
  const hasPublishedWorkout = publishedWorkouts.length > 0;
  const hasReceivedFeedback = studentLogs.length > 0;
  const hasReviewedFeedback = hasReceivedFeedback && pendingLogs.length === 0;
  const progressSummary = useMemo(
    () =>
      buildConsultationProgressSummary({
        studentId: selectedStudentId,
        workouts: state.workouts,
        executionLogs: state.executionLogs,
      }),
    [selectedStudentId, state.executionLogs, state.workouts]
  );

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

  useEffect(() => {
    setIsProfileEditorOpen(!selectedProfile && Boolean(selectedStudentId));
  }, [selectedProfile?.studentId, selectedStudentId]);

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

  const modalDraftSnapshot = useMemo(
    () => buildWorkoutDraftSnapshot({ title, dayLabel, duration, objective, exerciseLines, coachNotes }),
    [coachNotes, dayLabel, duration, exerciseLines, objective, title]
  );

  const hasModalChanges =
    showWorkoutModal &&
    Boolean(modalInitialSnapshot) &&
    modalInitialSnapshot !== modalDraftSnapshot;
  const {
    animatedStyle: profileEditorAnimStyle,
    isVisible: isProfileEditorVisible,
  } = useCollapsibleAnimation(isProfileEditorOpen, {
    durationIn: 220,
    durationOut: 180,
    translateY: -6,
  });

  const goalLabel = goalOptions.find((item) => item.value === goal)?.label ?? "";
  const environmentLabel = environmentOptions.find((item) => item.value === environment)?.label ?? "";
  const equipmentLabels = equipment
    .map((value) => equipmentOptions.find((item) => item.value === value)?.label)
    .filter(Boolean) as string[];
  const equipmentSummary =
    equipmentLabels.length > 2
      ? `${equipmentLabels.slice(0, 2).join(", ")} +${equipmentLabels.length - 2}`
      : equipmentLabels.join(", ");
  const profileSummaryParts = [
    goalLabel,
    environmentLabel,
    equipmentSummary,
    trainingDays ? `${trainingDays}x/semana` : "",
    duration ? `${duration}min` : "",
  ].filter(Boolean);
  const profileSummary =
    profileSummaryParts.length > 0
      ? profileSummaryParts.join(" · ")
      : "Complete o perfil para orientar melhor a prescrição.";
  const isProfileReady = Boolean(
    selectedProfile &&
      selectedProfile.goal &&
      selectedProfile.environment &&
      selectedProfile.availableEquipment.length > 0 &&
      selectedProfile.trainingDaysPerWeek > 0 &&
      selectedProfile.preferredSessionDurationMin
  );
  const profilePilotMessage = !hasSavedProfile
    ? {
        tone: "warning" as const,
        text: "Salve o perfil de treino antes de usar com uma aluna real.",
      }
    : !isProfileReady && hasPublishedWorkout
      ? {
          tone: "warning" as const,
          text: "Complete o perfil para orientar melhor os próximos treinos.",
        }
      : hasSavedProfile && !hasPublishedWorkout
        ? {
            tone: "success" as const,
            text: "Perfil salvo. Publique o primeiro treino para a aluna visualizar.",
          }
        : null;

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
        { name: "", sets: "", reps: "", rest: "", note: "", mediaUrl: "" },
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
    const status = await saveConsultationProfile(profileDraft);
    updatePersistenceNotice("Perfil de treino salvo no servidor.", status);
    animateLayout();
    setIsProfileEditorOpen(false);
    await reload();
  };

  const addPilotStudent = () => {
    const name = pilotStudentName.trim();
    if (!name) return;

    const student = createPilotStudent({ name, contact: pilotStudentContact });
    setPilotStudent(student);
    setSelectedStudentId(student.id);
    setStudentSearch("");
    setPilotStudentName("");
    setPilotStudentContact("");
    setNotice("Aluna adicionada ao piloto local.");
  };

  const saveWorkoutDraft = async () => {
    if (!selectedStudentId) return;
    const exercises = parseExercises(exerciseLines);
    if (!exercises.length) return;
    setIsPublishing(true);
    const workout = createPrescribedWorkout({
      id: editingWorkoutId || `consult_${selectedStudentId}_${Date.now()}`,
      studentId: selectedStudentId,
      title,
      weekStartDate: weekStart(),
      dayLabel,
      objective,
      estimatedDurationMin: Number(duration),
      exercises,
      coachNotes,
      status: "draft",
    });
    try {
      const status = await savePrescribedWorkout(workout);
      updatePersistenceNotice("Treino salvo no servidor. Revise a ficha antes de publicar.", status);
      setModalInitialSnapshot("");
      setEditingWorkoutId(workout.id);
      setShowWorkoutModal(false);
      await reload();
    } finally {
      setIsPublishing(false);
    }
  };

  const publishSavedWorkout = async (workout: PrescribedWorkout | null = latestWorkout) => {
    if (!workout) return;
    const status = await savePrescribedWorkout({ ...workout, status: "published" });
    await notifyConsultationEvent({
      event: "consultation_workout_published",
      studentId: workout.studentId,
      studentName: selectedStudent?.name,
      workoutId: workout.id,
    });
    updatePersistenceNotice("Treino publicado para a aluna no servidor.", status);
    await reload();
  };

  const reviewLog = async (logId: string) => {
    const reviewedLog = state.executionLogs.find((log) => log.id === logId);
    const status = await markExecutionLogReviewed(logId);
    await notifyConsultationEvent({
      event: "consultation_execution_reviewed",
      studentId: reviewedLog?.studentId ?? selectedStudentId,
      studentName: selectedStudent?.name,
      workoutId: reviewedLog?.workoutId,
      executionLogId: logId,
    });
    updatePersistenceNotice("Feedback marcado como revisado no servidor.", status);
    await reload();
  };

  const deleteWorkout = async () => {
    if (!editingWorkoutId) return;
    const status = await deletePrescribedWorkout(editingWorkoutId);
    updatePersistenceNotice("Treino excluído no servidor.", status);
    setShowConfirmDeleteWorkout(false);
    closeWorkoutModal();
    await reload();
  };

  const openWorkoutModal = (
    block: PrescriptionBlock = "prescription",
    workout: PrescribedWorkout | null = latestWorkout
  ) => {
    if (workout) {
      const nextExerciseLines = serializeWorkoutExercises(workout.exercises);
      const nextCoachNotes = workout.coachNotes ?? "";
      setEditingWorkoutId(workout.id);
      setTitle(workout.title);
      setDayLabel(workout.dayLabel);
      setDuration(String(workout.estimatedDurationMin ?? 45));
      setObjective(workout.objective);
      setExerciseLines(nextExerciseLines);
      setCoachNotes(nextCoachNotes);
      setModalInitialSnapshot(
        buildWorkoutDraftSnapshot({
          title: workout.title,
          dayLabel: workout.dayLabel,
          duration: String(workout.estimatedDurationMin ?? 45),
          objective: workout.objective,
          exerciseLines: nextExerciseLines,
          coachNotes: nextCoachNotes,
        })
      );
    } else {
      setModalInitialSnapshot(modalDraftSnapshot);
    }
    setActivePrescriptionBlock(block);
    setShowConfirmClose(false);
    setShowWorkoutModal(true);
  };

  const openNewWorkoutModal = () => {
    const nextTitle = "";
    const nextDayLabel = "";
    const nextDuration = "";
    const nextObjective = "";
    const nextExerciseLines = "";
    const nextCoachNotes = "";
    setEditingWorkoutId("");
    setTitle(nextTitle);
    setDayLabel(nextDayLabel);
    setDuration(nextDuration);
    setObjective(nextObjective);
    setExerciseLines(nextExerciseLines);
    setCoachNotes(nextCoachNotes);
    setActivePrescriptionBlock("prescription");
    setModalInitialSnapshot(
      buildWorkoutDraftSnapshot({
        title: nextTitle,
        dayLabel: nextDayLabel,
        duration: nextDuration,
        objective: nextObjective,
        exerciseLines: nextExerciseLines,
        coachNotes: nextCoachNotes,
      })
    );
    setShowConfirmClose(false);
    setShowWorkoutModal(true);
  };

  const closeWorkoutModal = () => {
    setShowConfirmClose(false);
    setShowConfirmDeleteWorkout(false);
    setModalInitialSnapshot("");
    setEditingWorkoutId("");
    setShowWorkoutModal(false);
  };

  const requestCloseWorkoutModal = () => {
    if (hasModalChanges) {
      setShowConfirmClose(true);
      return;
    }
    closeWorkoutModal();
  };

  const runModalPrimaryAction = async () => {
    await saveWorkoutDraft();
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

  const ProfileSection = ({
    title,
    children,
    attention,
  }: {
    title: string;
    children: ReactNode;
    attention?: boolean;
  }) => (
    <View
      style={{
        gap: 10,
        padding: 12,
        borderRadius: radius.internal,
        backgroundColor: attention ? colors.warningBg : colors.secondaryBg,
        borderWidth: 1,
        borderColor: attention ? colors.warningBorder : colors.border,
      }}
    >
      <Text style={{ color: attention ? colors.warningText : colors.text, fontWeight: "900", fontSize: 13 }}>
        {title}
      </Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Consultoria online"
        subtitle="Prescrição individual, execução em casa e feedback semanal."
        onBack={() => navigateBackOrReplace({ router, fallback: "/prof/home" })}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, gap: 14, paddingBottom: 32 }}>

        {notice ? (
          <View style={{ padding: 12, borderRadius: radius.card, backgroundColor: colors.successBg }}>
            <Text style={{ color: colors.successText, fontWeight: "800" }}>{notice}</Text>
          </View>
        ) : null}

        <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          {selectedStudent ? (
            <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>{selectedStudent.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {selectedStudent.loginEmail || selectedStudent.phone || "Sem contato informado"}
                </Text>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800", lineHeight: 19 }}>
                  {profileSummary}
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start", gap: 8 }}>
                <SyncStatusBadge
                  status={syncBadgeStatus}
                  message={syncBadgeMessage}
                  size="sm"
                />
                <View
                  style={{
                    borderRadius: radius.full,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: selectedStudent.id.startsWith("pilot_") ? colors.warningBg : colors.successBg,
                    borderWidth: 1,
                    borderColor: selectedStudent.id.startsWith("pilot_") ? colors.warningBorder : colors.successBorder,
                  }}
                >
                  <Text
                    style={{
                      color: selectedStudent.id.startsWith("pilot_") ? colors.warningText : colors.successText,
                      fontSize: 11,
                      fontWeight: "900",
                    }}
                  >
                    {selectedStudent.id.startsWith("pilot_") ? "Piloto local" : "Cadastro do sistema"}
                  </Text>
                </View>
                {hasSavedProfile ? (
                  <View
                    style={{
                      borderRadius: radius.full,
                      backgroundColor: isProfileReady ? colors.successBg : colors.warningBg,
                      borderColor: isProfileReady ? colors.successBorder : colors.warningBorder,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: isProfileReady ? colors.successText : colors.warningText,
                        fontSize: 11,
                        fontWeight: "900",
                      }}
                    >
                      {isProfileReady ? "Perfil pronto" : "Perfil incompleto"}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>Selecione uma aluna</Text>
              <Text style={{ color: colors.muted }}>
                Use a aba Perfil para buscar uma aluna cadastrada ou criar uma ficha local para o piloto.
              </Text>
            </View>
          )}
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
            Aluno {selectedStudentId ? "✓" : "○"} · Perfil {hasSavedProfile ? "✓" : "○"} · Prescrição {hasPublishedWorkout ? "✓" : "○"} · Feedback {hasReceivedFeedback ? "✓" : "○"} · Devolutiva {hasReviewedFeedback ? "✓" : "○"}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
          {[
            { id: "profile" as const, label: "Perfil" },
            { id: "prescription" as const, label: "Prescrição" },
            { id: "feedback" as const, label: "Feedback" },
            { id: "evolution" as const, label: "Evolução" },
          ].map((item) => {
            const active = activeConsultationTab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setActiveConsultationTab(item.id);
                  if (item.id === "profile") {
                    animateLayout();
                    setIsProfileEditorOpen(true);
                  }
                }}
                style={{
                  minWidth: 132,
                  alignItems: "center",
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: active ? colors.primaryBg : colors.border,
                  backgroundColor: active ? colors.primaryBg : colors.card,
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "900" }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {activeConsultationTab === "profile" ? (
          <>
        <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}>Aluno</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Busque uma aluna cadastrada ou preencha uma nova ficha para o piloto.
            </Text>
          </View>
          {selectedStudent ? (
            <View
              style={{
                gap: 8,
                padding: 12,
                borderRadius: radius.internal,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <View style={{ gap: 3, flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>Aluna selecionada</Text>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{selectedStudent.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {selectedStudent.loginEmail || selectedStudent.phone || "Sem contato informado"}
                  </Text>
                </View>
                <View
                  style={{
                    borderRadius: radius.full,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: selectedStudent.id.startsWith("pilot_") ? colors.warningBg : colors.successBg,
                  }}
                >
                  <Text
                    style={{
                      color: selectedStudent.id.startsWith("pilot_") ? colors.warningText : colors.successText,
                      fontSize: 11,
                      fontWeight: "900",
                    }}
                  >
                    {selectedStudent.id.startsWith("pilot_") ? "Piloto local" : "Cadastro do sistema"}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View
              style={{
                padding: 12,
                borderRadius: radius.internal,
                backgroundColor: colors.warningBg,
                borderWidth: 1,
                borderColor: colors.warningBorder,
              }}
            >
              <Text style={{ color: colors.warningText, fontWeight: "800" }}>
                Selecione uma aluna para começar.
              </Text>
            </View>
          )}

          <View style={{ gap: 10 }}>
            <ConsultationField colors={colors} label="Buscar aluna cadastrada" value={studentSearch} onChangeText={setStudentSearch} />
            {studentSearch.trim() ? (
              <View
                style={{
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  overflow: "hidden",
                }}
              >
                {filteredStudents.length ? (
                  filteredStudents.map((student, index) => (
                    <Pressable
                      key={student.id}
                      onPress={() => {
                        setSelectedStudentId(student.id);
                        setStudentSearch("");
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                        backgroundColor: student.id === selectedStudentId ? colors.secondaryBg : colors.inputBg,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900" }}>{student.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {student.loginEmail || student.phone || "Sem contato informado"}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12, padding: 12 }}>
                    Nenhuma aluna encontrada. Preencha uma nova ficha abaixo para o piloto.
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Digite nome, e-mail ou telefone para procurar no cadastro.
              </Text>
            )}
          </View>

          <View
            style={{
              gap: 10,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>Nova aluna no piloto</Text>
            <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <ConsultationField colors={colors} label="Nome" value={pilotStudentName} onChangeText={setPilotStudentName} />
              </View>
              <View style={{ flex: 1 }}>
                <ConsultationField colors={colors} label="E-mail ou telefone" value={pilotStudentContact} onChangeText={setPilotStudentContact} />
              </View>
            </View>
            <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", alignItems: Platform.OS === "web" ? "center" : "stretch", gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                Esta ficha nova vale apenas para o piloto local. O cadastro oficial fica fora deste pacote.
              </Text>
              <Pressable
                disabled={!pilotStudentName.trim()}
                onPress={addPilotStudent}
                style={{
                  borderRadius: radius.full,
                  backgroundColor: colors.primaryBg,
                  opacity: pilotStudentName.trim() ? 1 : 0.5,
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "900" }}>Usar no piloto</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ gap: 5 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Perfil de treino</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {isProfileEditorOpen ? "Onde ela treina, objetivo, materiais e cuidados." : "Toque no perfil para editar os dados da aluna."}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (hasSavedProfile) {
                animateLayout();
                setIsProfileEditorOpen((current) => !current);
              }
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: radius.internal,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>Resumo do perfil</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {hasSavedProfile ? (
                  <View
                    style={{
                      borderRadius: radius.full,
                      backgroundColor: isProfileReady ? colors.successBg : colors.warningBg,
                      borderColor: isProfileReady ? colors.successBorder : colors.warningBorder,
                      borderWidth: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: isProfileReady ? colors.successText : colors.warningText,
                        fontSize: 10,
                        fontWeight: "900",
                      }}
                    >
                      {isProfileReady ? "Perfil pronto" : "Perfil incompleto"}
                    </Text>
                  </View>
                ) : null}
                {hasSavedProfile ? (
                  <Ionicons
                    name={isProfileEditorOpen ? "chevron-down" : "chevron-forward"}
                    size={15}
                    color={colors.muted}
                  />
                ) : null}
              </View>
            </View>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800", lineHeight: 19 }}>
              {profileSummary}
            </Text>
          </Pressable>

          {isProfileEditorVisible ? (
            <Animated.View
              pointerEvents={isProfileEditorOpen ? "auto" : "none"}
              style={[profileEditorAnimStyle, { gap: 12, overflow: "hidden" }]}
            >
              <ProfileSection title="Objetivo e rotina">
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>Objetivo principal</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {goalOptions.map((item) => (
                      <Chip key={item.value} label={item.label} active={goal === item.value} onPress={() => setGoal(item.value)} />
                    ))}
                  </View>
                </View>
                <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <ConsultationField colors={colors} label="Dias por semana" value={trainingDays} onChangeText={setTrainingDays} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ConsultationField colors={colors} label="Duração média" value={duration} onChangeText={setDuration} />
                  </View>
                </View>
              </ProfileSection>

              <ProfileSection title="Ambiente e materiais">
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>Onde ela treina?</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {environmentOptions.map((item) => (
                      <Chip key={item.value} label={item.label} active={environment === item.value} onPress={() => setEnvironment(item.value)} />
                    ))}
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>Materiais disponíveis</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {equipmentOptions.map((item) => (
                      <Chip key={item.value} label={item.label} active={equipment.includes(item.value)} onPress={() => toggleEquipment(item.value)} />
                    ))}
                  </View>
                </View>
              </ProfileSection>

              <ProfileSection title="Cuidados" attention={Boolean(restrictions.trim() || injuries.trim())}>
                <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <ConsultationField colors={colors} label="Restrições e cuidados" value={restrictions} onChangeText={setRestrictions} multiline />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ConsultationField colors={colors} label="Lesões informadas" value={injuries} onChangeText={setInjuries} multiline />
                  </View>
                </View>
              </ProfileSection>

              <ProfileSection title="Observações">
                <ConsultationField colors={colors} label="Observações" value={profileNotes} onChangeText={setProfileNotes} multiline />
              </ProfileSection>

              <View style={{ flexDirection: Platform.OS === "web" && hasSavedProfile ? "row" : "column", gap: 10 }}>
                {hasSavedProfile ? (
                  <Pressable
                    onPress={() => {
                      animateLayout();
                      setIsProfileEditorOpen(false);
                    }}
                    style={{
                      alignItems: "center",
                      padding: 12,
                      borderRadius: radius.full,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flex: Platform.OS === "web" ? 1 : undefined,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>Recolher perfil</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={saveProfile}
                  style={{
                    alignItems: "center",
                    padding: 12,
                    borderRadius: radius.full,
                    backgroundColor: colors.primaryBg,
                    flex: Platform.OS === "web" && hasSavedProfile ? 1 : undefined,
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: "900" }}>Salvar perfil de treino</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}
        </View>
          </>
        ) : null}

        {activeConsultationTab === "prescription" ? (
          <>
        <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Prescrição da semana</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Toque no treino para editar a prescrição.
              </Text>
            </View>
            <Pressable
              disabled={!selectedStudentId}
              onPress={openNewWorkoutModal}
              style={{
                alignItems: "center",
                backgroundColor: colors.secondaryBg,
                borderColor: colors.border,
                borderRadius: radius.full,
                borderWidth: 1,
                height: 36,
                justifyContent: "center",
                opacity: selectedStudentId ? 1 : 0.65,
                width: 36,
              }}
            >
              <Ionicons name="add" size={19} color={colors.text} />
            </Pressable>
          </View>
          {studentWorkouts.length ? (
            <View style={{ gap: 10 }}>
              {studentWorkouts.map((workout) => {
                const isPublished = workout.status === "published";
                return (
                  <View
                    key={workout.id}
                    style={{
                      gap: 10,
                      borderRadius: radius.internal,
                      backgroundColor: colors.secondaryBg,
                      borderColor: colors.border,
                      borderWidth: 1,
                      padding: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => openWorkoutModal("prescription", workout)}
                      style={{ gap: 8 }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <Text style={{ color: colors.text, flex: 1, fontWeight: "900" }}>{workout.title}</Text>
                        <View
                          style={{
                            borderRadius: radius.full,
                            backgroundColor: isPublished ? colors.successBg : colors.warningBg,
                            borderColor: isPublished ? colors.successBorder : colors.warningBorder,
                            borderWidth: 1,
                            paddingHorizontal: 9,
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={{
                              color: isPublished ? colors.successText : colors.warningText,
                              fontSize: 11,
                              fontWeight: "900",
                            }}
                          >
                            {isPublished ? "Publicado" : "Rascunho"}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {workout.dayLabel} · {workout.estimatedDurationMin || 45} min · {workout.exercises.length} exercício(s)
                      </Text>
                      <Text style={{ color: colors.text, lineHeight: 19 }}>{workout.objective}</Text>
                    </Pressable>
                    {!isPublished ? (
                      <Pressable
                        onPress={() => {
                          void publishSavedWorkout(workout);
                        }}
                        style={{
                          alignItems: "center",
                          backgroundColor: colors.primaryBg,
                          borderRadius: radius.full,
                          padding: 11,
                        }}
                      >
                        <Text style={{ color: colors.primaryText, fontWeight: "900" }}>Publicar treino</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Pressable
              disabled={!selectedStudentId}
              onPress={openNewWorkoutModal}
              style={{
                gap: 8,
                borderRadius: radius.internal,
                backgroundColor: colors.secondaryBg,
                borderColor: colors.border,
                borderWidth: 1,
                opacity: selectedStudentId ? 1 : 0.65,
                padding: 12,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>{title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {dayLabel} · {duration || "45"} min · {parseExercises(exerciseLines).length} exercício(s)
              </Text>
              <Text style={{ color: colors.text, lineHeight: 19 }}>{objective}</Text>
            </Pressable>
          )}
          {profilePilotMessage ? (
            <View
              style={{
                padding: 10,
                borderRadius: radius.internal,
                backgroundColor: profilePilotMessage.tone === "success" ? colors.successBg : colors.warningBg,
                borderWidth: 1,
                borderColor: profilePilotMessage.tone === "success" ? colors.successBorder : colors.warningBorder,
              }}
            >
              <Text
                style={{
                  color: profilePilotMessage.tone === "success" ? colors.successText : colors.warningText,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {profilePilotMessage.text}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Treino publicado</Text>
          {latestPublishedWorkout ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>{latestPublishedWorkout.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {latestPublishedWorkout.dayLabel} · {latestPublishedWorkout.estimatedDurationMin} min · Publicado
              </Text>
              <Text style={{ color: colors.text, lineHeight: 19 }}>{latestPublishedWorkout.objective}</Text>
              <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>
                  Atividade | Séries | Repet. | Interv. | Obs.
                </Text>
                {latestPublishedWorkout.exercises.map((exercise) => (
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
          <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", justifyContent: "space-between", gap: 8 }}>
            <View style={{ gap: 4, flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Feedback resumido</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {studentWorkouts.length} treino(s) salvo(s) · {pendingLogs.length} feedback(s) pendente(s)
              </Text>
            </View>
            <Pressable
              onPress={() => setActiveConsultationTab("feedback")}
              style={{
                alignItems: "center",
                alignSelf: Platform.OS === "web" ? "flex-start" : "stretch",
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>Ver feedback</Text>
            </Pressable>
          </View>
          {studentLogs.length ? (
            <Text style={{ color: colors.text, lineHeight: 20 }}>
              Último feedback recebido. Abra a aba Feedback para revisar PSE, dor e observação.
            </Text>
          ) : (
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              Nenhum feedback recebido ainda. Quando a aluna concluir o treino, aparece aqui.
            </Text>
          )}
        </View>
          </>
        ) : null}

        {activeConsultationTab === "feedback" ? (
        <View style={{ gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Execuções e feedback</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {studentWorkouts.length} treino(s) salvo(s) · {pendingLogs.length} feedback(s) pendente(s)
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
        ) : null}

        {activeConsultationTab === "evolution" ? (
          <View style={{ gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Evolução da aluna</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Indicadores simples com base nos treinos publicados e feedbacks recebidos.
              </Text>
            </View>
            <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Adesão", value: `${progressSummary.adherencePercent}%`, detail: `${progressSummary.workoutsCompleted}/${progressSummary.workoutsPublished} treino(s)` },
                { label: "PSE médio", value: progressSummary.averageRpe === null ? "-" : String(progressSummary.averageRpe), detail: "Esforço percebido" },
                { label: "Dor média", value: progressSummary.averagePain === null ? "-" : String(progressSummary.averagePain), detail: "Relatos da aluna" },
                { label: "Última execução", value: formatDateTime(progressSummary.lastCompletedAt), detail: "Feedback mais recente" },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{
                    flex: Platform.OS === "web" ? 1 : undefined,
                    minWidth: Platform.OS === "web" ? 150 : undefined,
                    gap: 5,
                    padding: 12,
                    borderRadius: radius.internal,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>{item.label}</Text>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{item.value}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.detail}</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 8, padding: 12, borderRadius: radius.internal, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>Pontos de atenção</Text>
              {progressSummary.attentionFlags.length ? (
                progressSummary.attentionFlags.map((flag) => {
                  const warning = flag !== "initial_history";
                  return (
                    <View
                      key={flag}
                      style={{
                        padding: 10,
                        borderRadius: radius.internal,
                        backgroundColor: warning ? colors.warningBg : colors.card,
                        borderWidth: 1,
                        borderColor: warning ? colors.warningBorder : colors.border,
                      }}
                    >
                      <Text style={{ color: warning ? colors.warningText : colors.muted, fontWeight: "800", fontSize: 12 }}>
                        {progressFlagCopy[flag]}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: colors.successText, fontWeight: "800" }}>
                  Sem sinais de atenção nos feedbacks recebidos.
                </Text>
              )}
            </View>
            <View style={{ gap: 8, padding: 12, borderRadius: radius.internal, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>Últimos feedbacks</Text>
              {studentLogs.length ? (
                studentLogs.slice(0, 3).map((log) => (
                  <Text key={log.id} style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
                    {formatDateTime(log.completedAt)} · PSE {log.perceivedExertion ?? 0}/10 · Dor {log.painLevel ?? 0}/10
                    {log.studentFeedback ? ` · ${log.studentFeedback}` : ""}
                  </Text>
                ))
              ) : (
                <Text style={{ color: colors.muted, lineHeight: 20 }}>
                  Nenhum feedback recebido ainda. A evolução será refinada depois das primeiras execuções.
                </Text>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ModalDialogFrame
        visible={showWorkoutModal}
        onClose={requestCloseWorkoutModal}
        cardStyle={modalCardStyle}
        position="center"
        colors={colors}
        title="Editar prescrição individual"
        subtitle={`${selectedStudent?.name ?? "Aluna"} · ${formatDisplayDate(weekStart())} · ${dayLabel}`}
        contentContainerStyle={{ gap: 18, paddingBottom: 26, paddingTop: 16 }}
        footerStyle={{ paddingTop: 12, paddingBottom: 4 }}
        footer={
          <View>
            <Pressable
              disabled={
                isPublishing ||
                !hasModalChanges ||
                !selectedStudentId ||
                !parseExercises(exerciseLines).length
              }
              onPress={() => {
                void runModalPrimaryAction();
              }}
              style={{
                alignItems: "center",
                backgroundColor:
                  isPublishing ||
                  !hasModalChanges ||
                  !selectedStudentId ||
                  !parseExercises(exerciseLines).length
                    ? colors.primaryDisabledBg
                    : colors.primaryBg,
                borderRadius: radius.card,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color:
                    isPublishing ||
                    !hasModalChanges ||
                    !selectedStudentId ||
                    !parseExercises(exerciseLines).length
                      ? colors.secondaryText
                      : colors.primaryText,
                  fontWeight: "900",
                }}
              >
                {isPublishing ? "Salvando..." : "Salvar treino"}
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
          <View style={{ gap: 14 }}>
            <View
              style={{
                flexDirection: Platform.OS === "web" ? "row" : "column",
                gap: 10,
              }}
            >
              {[
                { id: "prescription" as const, label: "Prescrição" },
                { id: "notes" as const, label: "Observações" },
              ].map((item) => {
                const active = activePrescriptionBlock === item.id;
                return (
                <Pressable
                  key={item.label}
                  onPress={() => setActivePrescriptionBlock(item.id)}
                  style={{
                    backgroundColor: active ? colors.primaryBg : colors.card,
                    borderColor: active ? colors.primaryBg : colors.border,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    flex: 1,
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 14,
                  }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 14, fontWeight: "900" }}>
                    {item.label}
                  </Text>
                </Pressable>
                );
              })}
            </View>

            <View style={{ gap: 12 }}>
              {activePrescriptionBlock === "prescription" ? (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <ConsultationField colors={colors} label="Título" value={title} onChangeText={setTitle} />
                    </View>
                    <View style={{ flex: 0.8 }}>
                      <ConsultationField colors={colors} label="Dia" value={dayLabel} onChangeText={setDayLabel} />
                    </View>
                    <View style={{ flex: 0.7 }}>
                      <ConsultationField colors={colors} label="Duração" value={duration} onChangeText={setDuration} />
                    </View>
                  </View>
                  <ConsultationField colors={colors} label="Objetivo do treino" value={objective} onChangeText={setObjective} />

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
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <Text style={{ color: colors.muted, flex: 1.4, fontSize: 11, fontWeight: "900" }}>Exercício/atividade</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textAlign: "center", width: exerciseColumnWidths.sets }}>Séries</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textAlign: "center", width: exerciseColumnWidths.reps }}>Repet.</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textAlign: "center", width: exerciseColumnWidths.rest }}>Inter.</Text>
                      <Text style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "900" }}>Obs.</Text>
                      <View style={{ width: 28 }} />
                    </View>
                    {exerciseDraftRows.map((row, index) => (
                      <View
                        key={`exercise-row-${index}`}
                        style={{
                          gap: 6,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                          paddingBottom: 8,
                        }}
                      >
                        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                          <TextInput
                            value={row.name}
                            onChangeText={(value) => updateExerciseDraftRow(index, "name", value)}
                            placeholder="Exercício"
                            placeholderTextColor={colors.placeholder}
                            style={{
                              flex: 1.4,
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
                              width: exerciseColumnWidths.sets,
                              borderRadius: radius.internal,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.inputBg,
                              color: colors.inputText,
                              minHeight: 42,
                              paddingHorizontal: 6,
                              textAlign: "center",
                            }}
                          />
                          <TextInput
                            value={row.reps}
                            onChangeText={(value) => updateExerciseDraftRow(index, "reps", value)}
                            placeholder="8-12"
                            placeholderTextColor={colors.placeholder}
                            style={{
                              width: exerciseColumnWidths.reps,
                              borderRadius: radius.internal,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.inputBg,
                              color: colors.inputText,
                              minHeight: 42,
                              paddingHorizontal: 6,
                              textAlign: "center",
                            }}
                          />
                          <TextInput
                            value={row.rest}
                            onChangeText={(value) => updateExerciseDraftRow(index, "rest", value)}
                            placeholder="60"
                            placeholderTextColor={colors.placeholder}
                            style={{
                              width: exerciseColumnWidths.rest,
                              borderRadius: radius.internal,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.inputBg,
                              color: colors.inputText,
                              minHeight: 42,
                              paddingHorizontal: 6,
                              textAlign: "center",
                            }}
                          />
                          <TextInput
                            value={row.note}
                            onChangeText={(value) => updateExerciseDraftRow(index, "note", value)}
                            placeholder="Obs."
                            placeholderTextColor={colors.placeholder}
                            style={{
                              flex: 1,
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
                        <TextInput
                          value={row.mediaUrl}
                          onChangeText={(value) => updateExerciseDraftRow(index, "mediaUrl", value)}
                          placeholder="Demonstração opcional: link de vídeo, GIF ou imagem"
                          placeholderTextColor={colors.placeholder}
                          style={{
                            borderRadius: radius.internal,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBg,
                            color: colors.inputText,
                            minHeight: 38,
                            paddingHorizontal: 10,
                          }}
                        />
                      </View>
                    ))}
                  </View>

                  {editingWorkoutId ? (
                    <Pressable
                      onPress={() => {
                        setShowConfirmDeleteWorkout(true);
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
                        Excluir treino
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {activePrescriptionBlock === "notes" ? (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Observações</Text>
                  <ConsultationField colors={colors} label="Observações do professor" value={coachNotes} onChangeText={setCoachNotes} multiline />
                </View>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </ModalDialogFrame>

      <ConfirmCloseOverlay
        visible={showConfirmClose}
        title="Sair sem salvar?"
        message="Você tem alterações não salvas nesta prescrição."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar editando"
        onConfirm={closeWorkoutModal}
        onCancel={() => setShowConfirmClose(false)}
      />
      <ConfirmCloseOverlay
        visible={showConfirmDeleteWorkout}
        title="Excluir treino?"
        message="Este treino e os feedbacks vinculados serão removidos do piloto local."
        confirmLabel="Excluir"
        cancelLabel="Manter"
        onConfirm={() => {
          void deleteWorkout();
        }}
        onCancel={() => setShowConfirmDeleteWorkout(false)}
      />
    </SafeAreaView>
  );
}
