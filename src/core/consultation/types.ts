export type ConsultationGoal =
  | "emagrecimento"
  | "hipertrofia"
  | "forca"
  | "condicionamento"
  | "saude"
  | "retorno_atividade"
  | "outro";

export type TrainingEnvironment =
  | "casa"
  | "academia"
  | "condominio"
  | "ar_livre"
  | "misto";

export type AvailableEquipment =
  | "peso_corporal"
  | "halteres"
  | "elastico"
  | "colchonete"
  | "cadeira_banco"
  | "kettlebell"
  | "barra"
  | "maquinas"
  | "outro";

export type OnlineConsultationProfile = {
  studentId: string;
  goal: ConsultationGoal;
  environment: TrainingEnvironment;
  availableEquipment: AvailableEquipment[];
  restrictions?: string[];
  injuries?: string[];
  trainingDaysPerWeek: number;
  preferredSessionDurationMin?: number;
  notes?: string;
};

export type PrescribedWorkoutStatus = "draft" | "published" | "completed" | "archived";

export type PrescribedExercise = {
  id: string;
  name: string;
  sets?: number;
  reps?: string;
  durationSec?: number;
  restSec?: number;
  load?: string;
  instructions?: string;
  alternatives?: string[];
  mediaUrl?: string;
};

export type PrescribedWorkout = {
  id: string;
  studentId: string;
  title: string;
  weekStartDate: string;
  dayLabel: string;
  objective: string;
  estimatedDurationMin: number;
  exercises: PrescribedExercise[];
  coachNotes?: string;
  status: PrescribedWorkoutStatus;
};

export type CompletedExerciseLog = {
  exerciseId: string;
  completed: boolean;
  setsDone?: number;
  repsDone?: string;
  loadUsed?: string;
  notes?: string;
};

export type WorkoutExecutionLog = {
  id: string;
  workoutId: string;
  studentId: string;
  completedAt: string;
  perceivedExertion?: number;
  painLevel?: number;
  completedExercises: CompletedExerciseLog[];
  studentFeedback?: string;
  coachReviewStatus?: "pending" | "reviewed";
};

export type WorkoutAttentionSignal = {
  tone: "success" | "warning" | "danger";
  label: string;
  description: string;
};
