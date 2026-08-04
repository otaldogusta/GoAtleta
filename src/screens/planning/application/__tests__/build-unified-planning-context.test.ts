import type {
  AttendanceRecord,
  ClassGroup,
  SessionLog,
} from "../../../../core/models";
import { buildUnifiedPlanningContext } from "../build-unified-planning-context";

const classGroup = {
  id: "class-1",
  name: "Turma teste",
  organizationId: "org-1",
  unit: "Unidade teste",
  unitId: "unit-1",
  colorKey: "green",
  modality: "voleibol",
  ageBand: "12-14",
  gender: "misto",
  startTime: "18:00",
  endTime: "19:00",
  durationMinutes: 60,
  daysOfWeek: [3, 5],
  daysPerWeek: 2,
  goal: "iniciacao",
  equipment: "quadra",
  level: 1,
  mvLevel: "1",
  cycleStartDate: "2026-01-05",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T10:00:00.000Z",
} as ClassGroup;

const attendance = (overrides: Partial<AttendanceRecord>): AttendanceRecord => ({
  id: "attendance-1",
  classId: classGroup.id,
  studentId: "student-1",
  date: "2026-07-30",
  status: "presente",
  note: "",
  painScore: 0,
  createdAt: "2026-07-30T20:00:00.000Z",
  ...overrides,
});

const sessionLog = (overrides: Partial<SessionLog>): SessionLog => ({
  id: "log-1",
  classId: classGroup.id,
  PSE: 4,
  technique: "boa",
  attendance: 12,
  activity: "Passe",
  conclusion: "Concluída",
  photos: "",
  createdAt: "2026-07-30T20:00:00.000Z",
  ...overrides,
});

describe("buildUnifiedPlanningContext", () => {
  it("limita os sinais à turma e à data de referência", () => {
    const result = buildUnifiedPlanningContext({
      classGroup,
      referenceDate: "2026-07-31",
      recentAttendance: [
        attendance({
          status: "faltou",
          painScore: 2,
          note: "Maria se machucou e pediu acompanhamento.",
        }),
        attendance({ id: "future", date: "2026-08-05" }),
        attendance({ id: "other", classId: "class-2" }),
      ],
      recentSessionLogs: [
        sessionLog({}),
        sessionLog({ id: "future-log", createdAt: "2026-08-05T20:00:00.000Z" }),
        sessionLog({ id: "other-log", classId: "class-2" }),
      ],
      studentContexts: [
        {
          classId: classGroup.id,
          category: "health",
          severity: "attention",
          eventDate: "2026-07-30",
        },
        {
          classId: classGroup.id,
          category: "wellbeing",
          severity: "attention",
          eventDate: "2026-08-05",
        },
        {
          classId: "class-2",
          category: "health",
          severity: "urgent",
          eventDate: "2026-07-30",
        },
      ],
    });

    expect(result.attendance).toHaveLength(1);
    expect(result.attendance[0]).toMatchObject({
      classId: classGroup.id,
      status: "absent",
      painScore: 2,
      note: "Observação registrada na chamada.",
    });
    expect(result.sessionLogs).toHaveLength(1);
    expect(result.studentContext).toEqual({
      activeSignals: 1,
      attentionSignals: 1,
      urgentSignals: 0,
      categories: { health: 1 },
    });
    expect(JSON.stringify(result)).not.toContain("Maria");
  });

  it("transforma observações confirmadas em orientação agregada e segura", () => {
    const result = buildUnifiedPlanningContext({
      classGroup,
      referenceDate: "2026-08-10",
      studentContexts: [
        {
          classId: classGroup.id,
          category: "health",
          severity: "urgent",
          eventDate: "2026-08-01",
        },
        {
          classId: classGroup.id,
          category: "withdrawal_risk",
          severity: "attention",
          eventDate: "2026-08-02",
        },
      ],
    });

    expect(result.dimensionGuidelines).toEqual(
      expect.arrayContaining([
        expect.stringContaining("prontidão"),
        expect.stringContaining("reintegração"),
        expect.stringContaining("acompanhamentos prioritários"),
      ]),
    );
    expect(result.decisionReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "attendance" }),
        expect.objectContaining({ source: "health_summary" }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("student-");
  });
});
