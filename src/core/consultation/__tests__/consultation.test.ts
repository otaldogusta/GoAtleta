import {
  buildWorkoutFeedbackSummary,
  buildConsultationProgressSummary,
  createConsultationProfile,
  createPrescribedWorkout,
  createWorkoutExecutionLog,
  findNextStudentWorkout,
  getWorkoutAttentionSignal,
  isWorkoutValidForHome,
  markWorkoutExecutionReviewed,
} from "../consultation";

const workout = createPrescribedWorkout({
  id: "w1",
  studentId: "s1",
  title: "Treino A",
  weekStartDate: "2026-05-18",
  dayLabel: "Segunda",
  objective: "Força geral",
  exercises: [
    { id: "e1", name: "Agachamento", sets: 3, reps: "12", restSec: 60 },
    { id: "e2", name: "Prancha", durationSec: 30 },
  ],
  status: "published",
});

describe("online consultation domain", () => {
  test("creates a consultation profile with safe defaults", () => {
    const profile = createConsultationProfile({ studentId: "s1" });
    expect(profile.environment).toBe("casa");
    expect(profile.availableEquipment).toContain("peso_corporal");
    expect(profile.trainingDaysPerWeek).toBe(3);
  });

  test("keeps bodyweight workout valid for home training without equipment", () => {
    const profile = createConsultationProfile({
      studentId: "s1",
      environment: "casa",
      availableEquipment: ["peso_corporal"],
    });
    expect(isWorkoutValidForHome(profile, workout)).toBe(true);
  });

  test("creates execution log with PSE, pain and completed exercises", () => {
    const log = createWorkoutExecutionLog({
      id: "log1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
      perceivedExertion: 7,
      painLevel: 2,
      studentFeedback: "Foi tranquilo.",
    });
    expect(log.completedExercises).toHaveLength(2);
    expect(log.perceivedExertion).toBe(7);
    expect(log.painLevel).toBe(2);
  });

  test("high pain creates attention danger signal", () => {
    const log = createWorkoutExecutionLog({
      id: "log1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
      perceivedExertion: 5,
      painLevel: 8,
    });
    expect(getWorkoutAttentionSignal(log).tone).toBe("danger");
  });

  test("high PSE creates attention warning signal", () => {
    const log = createWorkoutExecutionLog({
      id: "log1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
      perceivedExertion: 9,
      painLevel: 1,
    });
    const signal = getWorkoutAttentionSignal(log);
    expect(signal.tone).toBe("warning");
    expect(signal.label).toBe("Pede atenção");
  });

  test("completed workout generates coach feedback summary", () => {
    const log = createWorkoutExecutionLog({
      id: "log1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
      perceivedExertion: 6,
      painLevel: 1,
      completedExercises: [{ exerciseId: "e1", completed: true }],
    });
    expect(buildWorkoutFeedbackSummary(workout, log)).toContain("Adesão: 50%");
  });

  test("coach review changes status to reviewed", () => {
    const log = createWorkoutExecutionLog({
      id: "log1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
    });
    expect(log.coachReviewStatus).toBe("pending");
    expect(markWorkoutExecutionReviewed(log).coachReviewStatus).toBe("reviewed");
  });

  test("empty student feedback is optional", () => {
    const log = createWorkoutExecutionLog({
      id: "log1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
      studentFeedback: "   ",
    });
    expect(log.studentFeedback).toBe("");
    expect(buildWorkoutFeedbackSummary(workout, log)).toContain("Sem comentário adicional");
  });

  test("published workout appears as next student workout", () => {
    const draft = createPrescribedWorkout({
      ...workout,
      id: "draft",
      status: "draft",
    });
    expect(findNextStudentWorkout([draft, workout], "s1")?.id).toBe("w1");
    expect(findNextStudentWorkout([draft], "s1")).toBeNull();
  });

  test("student does not need load for duration/bodyweight exercise", () => {
    const durationWorkout = createPrescribedWorkout({
      id: "w2",
      studentId: "s1",
      title: "Mobilidade",
      weekStartDate: "2026-05-18",
      dayLabel: "Quarta",
      objective: "Mobilidade",
      exercises: [{ id: "e1", name: "Alongamento ativo", durationSec: 45 }],
      status: "published",
    });
    const log = createWorkoutExecutionLog({
      id: "log2",
      workout: durationWorkout,
      completedAt: "2026-05-18T12:00:00.000Z",
    });
    expect(log.completedExercises[0]?.completed).toBe(true);
  });

  test("progress summary starts as initial history with no executions", () => {
    const summary = buildConsultationProgressSummary({
      studentId: "s1",
      workouts: [workout],
      executionLogs: [],
    });
    expect(summary.workoutsPublished).toBe(1);
    expect(summary.workoutsCompleted).toBe(0);
    expect(summary.adherencePercent).toBe(0);
    expect(summary.averageRpe).toBeNull();
    expect(summary.attentionFlags).toContain("initial_history");
  });

  test("progress summary calculates adherence and averages conservatively", () => {
    const log = createWorkoutExecutionLog({
      id: "log1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
      perceivedExertion: 6,
      painLevel: 2,
    });
    const summary = buildConsultationProgressSummary({
      studentId: "s1",
      workouts: [workout],
      executionLogs: [log],
    });
    expect(summary.workoutsCompleted).toBe(1);
    expect(summary.adherencePercent).toBe(100);
    expect(summary.averageRpe).toBe(6);
    expect(summary.averagePain).toBe(2);
    expect(summary.lastCompletedAt).toBe("2026-05-18T12:00:00.000Z");
  });

  test("progress summary flags high pain, high PSE and low adherence only with enough data", () => {
    const workouts = [
      workout,
      createPrescribedWorkout({ ...workout, id: "w2", status: "published" }),
      createPrescribedWorkout({ ...workout, id: "w3", status: "published" }),
    ];
    const log = createWorkoutExecutionLog({
      id: "log1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
      perceivedExertion: 9,
      painLevel: 8,
    });
    const summary = buildConsultationProgressSummary({
      studentId: "s1",
      workouts,
      executionLogs: [log],
    });
    expect(summary.adherencePercent).toBe(33);
    expect(summary.attentionFlags).toContain("high_pain_recent");
    expect(summary.attentionFlags).toContain("high_rpe_recent");
    expect(summary.attentionFlags).toContain("low_adherence");
  });
});
