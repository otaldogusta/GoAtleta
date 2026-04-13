import { buildRecentSessionSummary } from "../../screens/session/application/build-recent-session-summary";
import type { SessionLog, TrainingPlan, TrainingSession, TrainingSessionAttendance } from "../models";

const buildPlan = (overrides: Partial<TrainingPlan> = {}): TrainingPlan => ({
  id: "plan_1",
  classId: "class_1",
  title: "Treino",
  tags: [],
  warmup: ["Mobilidade"],
  main: ["Passe alvo"],
  cooldown: ["Respiracao"],
  warmupTime: "15 min",
  mainTime: "40 min",
  cooldownTime: "5 min",
  applyDays: [6],
  applyDate: "2026-04-05",
  createdAt: "2026-04-01T10:00:00.000Z",
  version: 1,
  status: "generated",
  origin: "auto",
  inputHash: "hash_1",
  generatedAt: "2026-04-01T10:00:00.000Z",
  pedagogy: {
    focus: { skill: "passe" },
    progression: { dimension: "consistencia" },
    load: { intendedRPE: 5, volume: "moderado" },
    methodology: { approach: "analitico" },
  },
  ...overrides,
});

const buildSession = (overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  id: "session_1",
  organizationId: "org_1",
  title: "Sessao",
  description: "",
  startAt: "2026-04-05T12:00:00.000Z",
  endAt: "2026-04-05T13:00:00.000Z",
  status: "scheduled",
  type: "training",
  source: "plan",
  planId: "plan_1",
  classIds: ["class_1"],
  createdAt: "2026-04-05T12:00:00.000Z",
  updatedAt: "2026-04-05T12:00:00.000Z",
  ...overrides,
});

const buildAttendance = (
  overrides: Partial<TrainingSessionAttendance> = {}
): TrainingSessionAttendance => ({
  id: "attendance_1",
  sessionId: "session_1",
  studentId: "student_1",
  classId: "class_1",
  organizationId: "org_1",
  status: "present",
  note: "",
  painScore: 0,
  createdAt: "2026-04-05T13:00:00.000Z",
  updatedAt: "2026-04-05T13:00:00.000Z",
  ...overrides,
});

const buildSessionLog = (overrides: Partial<SessionLog> = {}): SessionLog => ({
  id: "log_1",
  classId: "class_1",
  PSE: 5,
  technique: "ok",
  attendance: 0,
  activity: "Passe sob pressao",
  conclusion: "Boa execucao",
  photos: "",
  createdAt: "2026-04-05T13:15:00.000Z",
  ...overrides,
});

describe("buildRecentSessionSummary", () => {
  it("returns an empty list for a class with no history", () => {
    expect(
      buildRecentSessionSummary({
        classId: "class_1",
        plans: [],
        sessions: [],
        attendance: [],
      })
    ).toEqual([]);
  });

  it("summarizes generated plans as planned_only when execution evidence is missing", () => {
    const summaries = buildRecentSessionSummary({
      classId: "class_1",
      plans: [buildPlan()],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      sessionDate: "2026-04-05",
      wasPlanned: true,
      wasApplied: false,
      wasEditedByTeacher: false,
      wasConfirmedExecuted: null,
      executionState: "planned_only",
      teacherOverrideWeight: "none",
      primarySkill: "passe",
      progressionDimension: "consistencia",
      fingerprint: "hash_1",
    });
  });

  it("marks sessions with attendance evidence as confirmed_executed", () => {
    const summaries = buildRecentSessionSummary({
      classId: "class_1",
      plans: [buildPlan({ status: "final" })],
      sessions: [buildSession({ status: "completed" })],
      attendance: [buildAttendance()],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      wasApplied: true,
      wasConfirmedExecuted: true,
      executionState: "confirmed_executed",
    });
  });

  it("treats completed session reports as strong operational evidence even without attendance", () => {
    const summaries = buildRecentSessionSummary({
      classId: "class_1",
      plans: [buildPlan({ status: "final" })],
      sessions: [buildSession({ status: "completed" })],
      sessionLogs: [buildSessionLog()],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      wasApplied: true,
      wasConfirmedExecuted: true,
      executionState: "confirmed_executed",
    });
  });

  it("counts all-absent attendance as execution evidence instead of breaking continuity", () => {
    const summaries = buildRecentSessionSummary({
      classId: "class_1",
      plans: [buildPlan({ status: "final" })],
      sessions: [buildSession({ status: "completed" })],
      attendance: [buildAttendance({ status: "absent" })],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      wasConfirmedExecuted: true,
      executionState: "confirmed_executed",
    });
  });

  it("keeps completed sessions without attendance or report as applied_not_confirmed", () => {
    const summaries = buildRecentSessionSummary({
      classId: "class_1",
      plans: [buildPlan({ status: "final" })],
      sessions: [buildSession({ status: "completed", description: "" })],
      attendance: [],
      sessionLogs: [],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      wasApplied: true,
      wasConfirmedExecuted: false,
      executionState: "applied_not_confirmed",
    });
  });

  it("detects strong teacher-edited history from edited_auto and override metadata", () => {
    const generated = buildPlan({
      id: "plan_generated",
      status: "generated",
      origin: "auto",
      inputHash: "hash_generated",
    });
    const edited = buildPlan({
      id: "plan_edited",
      status: "final",
      origin: "edited_auto",
      previousVersionId: "plan_generated",
      parentPlanId: "plan_generated",
      version: 2,
      main: ["Passe alvo", "Leitura de jogo"],
      pedagogy: {
        ...generated.pedagogy,
        override: {
          type: "methodology",
          fromRuleId: "rule_a",
          toRuleId: "rule_b",
          fromApproach: "analitico",
          toApproach: "jogo",
          createdAt: "2026-04-05T10:00:00.000Z",
        },
      },
    });

    const summaries = buildRecentSessionSummary({
      classId: "class_1",
      plans: [generated, edited],
      sessions: [buildSession({ planId: "plan_edited" })],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      wasEditedByTeacher: true,
      executionState: "teacher_edited",
      teacherOverrideWeight: "strong",
      methodologyApproach: "jogo",
    });
    expect(summaries[0].teacherEditedFields).toEqual(
      expect.arrayContaining(["methodologyApproach", "activityStructure"])
    );
  });

  it("classifies medium teacher edits when multiple local plan dimensions change", () => {
    const generated = buildPlan({
      id: "plan_generated",
      inputHash: "hash_generated",
    });
    const edited = buildPlan({
      id: "plan_manual",
      origin: "manual",
      status: "final",
      version: 2,
      previousVersionId: "plan_generated",
      parentPlanId: "plan_generated",
      main: ["Passe alvo", "Leitura e decisao"],
      pedagogy: {
        ...generated.pedagogy,
        progression: { dimension: "pressao_tempo" },
        methodology: { approach: "hibrido" },
      },
    });

    const summaries = buildRecentSessionSummary({
      classId: "class_1",
      plans: [generated, edited],
      sessions: [buildSession({ planId: "plan_manual" })],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      wasEditedByTeacher: true,
      teacherOverrideWeight: "medium",
      methodologyApproach: "hibrido",
    });
    expect(summaries[0].teacherEditedFields).toEqual(
      expect.arrayContaining(["progressionDimension", "methodologyApproach", "activityStructure"])
    );
  });

  it("does not classify manual apply without content changes as teacher edit", () => {
    const sourcePlan = buildPlan({
      id: "plan_saved",
      status: "final",
      origin: "manual",
      inputHash: "hash_saved",
    });
    const appliedPlan = buildPlan({
      id: "plan_applied",
      origin: "manual",
      status: "final",
      version: 2,
      previousVersionId: "plan_saved",
      parentPlanId: "plan_saved",
      inputHash: "hash_saved",
    });

    const summaries = buildRecentSessionSummary({
      classId: "class_1",
      plans: [sourcePlan, appliedPlan],
      sessions: [buildSession({ planId: "plan_applied" })],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      wasEditedByTeacher: false,
      teacherOverrideWeight: "none",
      executionState: "applied_not_confirmed",
    });
  });
});
