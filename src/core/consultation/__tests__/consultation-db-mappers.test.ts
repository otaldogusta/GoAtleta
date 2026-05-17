import {
  buildCompletedExercisePayloads,
  buildConsultationProfilePayload,
  buildPrescribedExercisePayloads,
  buildPrescribedWorkoutPayload,
  buildWorkoutExecutionPayload,
  mapConsultationProfileRow,
  mapPrescribedWorkoutRows,
  mapWorkoutExecutionRows,
} from "../../../db/consultation";
import {
  createConsultationProfile,
  createPrescribedWorkout,
  createWorkoutExecutionLog,
} from "../consultation";

const organizationId = "00000000-0000-0000-0000-000000000001";

describe("consultation Supabase mappers", () => {
  test("profile payload maps back to the consultation contract", () => {
    const profile = createConsultationProfile({
      studentId: "student-1",
      goal: "saude",
      environment: "casa",
      availableEquipment: ["peso_corporal", "halteres"],
      trainingDaysPerWeek: 3,
      preferredSessionDurationMin: 45,
      notes: "Piloto local.",
    });

    const payload = buildConsultationProfilePayload(profile, organizationId);
    expect(payload.organization_id).toBe(organizationId);
    expect(mapConsultationProfileRow(payload).availableEquipment).toContain("halteres");
    expect(mapConsultationProfileRow(payload).notes).toBe("Piloto local.");
  });

  test("workout and exercises roundtrip through row mappers", () => {
    const workout = createPrescribedWorkout({
      id: "workout-1",
      studentId: "student-1",
      title: "Treino A",
      weekStartDate: "2026-05-18",
      dayLabel: "Segunda",
      objective: "Força geral",
      estimatedDurationMin: 45,
      exercises: [
        { id: "ex-1", name: "Agachamento", sets: 3, reps: "12", restSec: 60 },
        { id: "ex-2", name: "Prancha", durationSec: 30, restSec: 45 },
      ],
      coachNotes: "",
      status: "published",
    });

    const workoutPayload = buildPrescribedWorkoutPayload(workout, organizationId);
    const exercisePayloads = buildPrescribedExercisePayloads(workout, organizationId);
    const [mapped] = mapPrescribedWorkoutRows([workoutPayload], exercisePayloads);

    expect(mapped?.status).toBe("published");
    expect(mapped?.exercises).toHaveLength(2);
    expect(mapped?.exercises[0]?.restSec).toBe(60);
  });

  test("execution log and completed exercises roundtrip through row mappers", () => {
    const workout = createPrescribedWorkout({
      id: "workout-1",
      studentId: "student-1",
      title: "Treino A",
      weekStartDate: "2026-05-18",
      dayLabel: "Segunda",
      objective: "Força geral",
      exercises: [{ id: "ex-1", name: "Agachamento", sets: 3, reps: "12" }],
      status: "published",
    });
    const log = createWorkoutExecutionLog({
      id: "log-1",
      workout,
      completedAt: "2026-05-18T12:00:00.000Z",
      perceivedExertion: 7,
      painLevel: 2,
      studentFeedback: "Foi bem.",
    });

    const payload = buildWorkoutExecutionPayload(log, organizationId);
    const completedPayloads = buildCompletedExercisePayloads(log, organizationId);
    const [mapped] = mapWorkoutExecutionRows([payload], completedPayloads);

    expect(mapped?.perceivedExertion).toBe(7);
    expect(mapped?.painLevel).toBe(2);
    expect(mapped?.completedExercises[0]?.completed).toBe(true);
  });

  test("optional null fields stay optional after mapping", () => {
    const [mapped] = mapPrescribedWorkoutRows(
      [
        {
          id: "workout-null",
          organization_id: organizationId,
          student_id: "student-1",
          title: "Treino livre",
          week_start_date: "2026-05-18",
          day_label: "Livre",
          objective: "Mobilidade",
          estimated_duration_min: null,
          coach_notes: null,
          status: "draft",
        },
      ],
      []
    );

    expect(mapped?.estimatedDurationMin).toBe(45);
    expect(mapped?.coachNotes).toBe("");
    expect(mapped?.exercises).toEqual([]);
  });
});
