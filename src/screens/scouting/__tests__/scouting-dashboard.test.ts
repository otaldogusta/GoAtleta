import type { ScoutingLog, Student, StudentScoutingLog } from "../../../core/models";
import type { ScoutingImpact } from "../../../core/team-context";
import {
  buildScoutingHistory,
  buildStudentScoutingSummary,
  buildTeamScoutingSummary,
} from "../scouting-dashboard";

const buildLog = (overrides: Partial<ScoutingLog> = {}): ScoutingLog => ({
  id: overrides.id ?? "log_1",
  classId: overrides.classId ?? "class_1",
  unit: overrides.unit ?? "Unidade",
  mode: overrides.mode ?? "jogo",
  date: overrides.date ?? "2026-05-09",
  serve0: overrides.serve0 ?? 2,
  serve1: overrides.serve1 ?? 4,
  serve2: overrides.serve2 ?? 1,
  receive0: overrides.receive0 ?? 3,
  receive1: overrides.receive1 ?? 3,
  receive2: overrides.receive2 ?? 0,
  set0: overrides.set0 ?? 1,
  set1: overrides.set1 ?? 3,
  set2: overrides.set2 ?? 1,
  attackSend0: overrides.attackSend0 ?? 2,
  attackSend1: overrides.attackSend1 ?? 2,
  attackSend2: overrides.attackSend2 ?? 1,
  createdAt: overrides.createdAt ?? "2026-05-09T10:00:00.000Z",
  updatedAt: overrides.updatedAt,
});

const buildImpact = (overrides: Partial<ScoutingImpact> = {}): ScoutingImpact => ({
  id: overrides.id ?? "impact_1",
  classId: overrides.classId ?? "class_1",
  eventId: overrides.eventId ?? "event_1",
  date: overrides.date ?? "2026-05-09",
  strengths: overrides.strengths ?? [],
  weaknesses: overrides.weaknesses ?? ["Cobertura"],
  tacticalNotes: overrides.tacticalNotes ?? [],
  recommendedFocus: overrides.recommendedFocus ?? ["Cobertura ofensiva"],
  loadImpact: overrides.loadImpact ?? "maintain",
  createdAt: overrides.createdAt ?? "2026-05-09T10:00:00.000Z",
});

const buildStudent = (overrides: Partial<Student> = {}): Student => ({
  id: overrides.id ?? "student_1",
  name: overrides.name ?? "Atleta 1",
  organizationId: overrides.organizationId ?? "org_1",
  classId: overrides.classId ?? "class_1",
  age: overrides.age ?? 14,
  phone: overrides.phone ?? "",
  loginEmail: overrides.loginEmail ?? "",
  guardianName: overrides.guardianName ?? "",
  guardianPhone: overrides.guardianPhone ?? "",
  guardianRelation: overrides.guardianRelation ?? "",
  healthIssue: overrides.healthIssue ?? false,
  healthIssueNotes: overrides.healthIssueNotes ?? "",
  medicationUse: overrides.medicationUse ?? false,
  medicationNotes: overrides.medicationNotes ?? "",
  healthObservations: overrides.healthObservations ?? "",
  positionPrimary: overrides.positionPrimary ?? "indefinido",
  positionSecondary: overrides.positionSecondary ?? "indefinido",
  athleteObjective: overrides.athleteObjective ?? "base",
  learningStyle: overrides.learningStyle ?? "misto",
  birthDate: overrides.birthDate ?? "",
  createdAt: overrides.createdAt ?? "2026-05-01T10:00:00.000Z",
  photoUrl: overrides.photoUrl,
  ra: overrides.ra ?? null,
  raStartYear: overrides.raStartYear ?? null,
  externalId: overrides.externalId ?? null,
  cpfMasked: overrides.cpfMasked ?? null,
  cpfHmac: overrides.cpfHmac ?? null,
  rg: overrides.rg ?? null,
  rgNormalized: overrides.rgNormalized ?? null,
  collegeCourse: overrides.collegeCourse ?? null,
  isExperimental: overrides.isExperimental ?? false,
  sourcePreRegistrationId: overrides.sourcePreRegistrationId ?? null,
});

const buildStudentLog = (overrides: Partial<StudentScoutingLog> = {}): StudentScoutingLog => ({
  id: overrides.id ?? "student_log_1",
  studentId: overrides.studentId ?? "student_1",
  classId: overrides.classId ?? "class_1",
  date: overrides.date ?? "2026-05-09",
  serve0: overrides.serve0 ?? 0,
  serve1: overrides.serve1 ?? 4,
  serve2: overrides.serve2 ?? 2,
  receive0: overrides.receive0 ?? 2,
  receive1: overrides.receive1 ?? 3,
  receive2: overrides.receive2 ?? 0,
  set0: overrides.set0 ?? 0,
  set1: overrides.set1 ?? 1,
  set2: overrides.set2 ?? 2,
  attackSend0: overrides.attackSend0 ?? 1,
  attackSend1: overrides.attackSend1 ?? 2,
  attackSend2: overrides.attackSend2 ?? 1,
  createdAt: overrides.createdAt ?? "2026-05-09T10:00:00.000Z",
  updatedAt: overrides.updatedAt,
});

describe("scouting-dashboard", () => {
  test("buildScoutingHistory marks finalized logs", () => {
    const items = buildScoutingHistory([buildLog()], [buildImpact()]);
    expect(items[0]?.statusLabel).toBe("Finalizado");
    expect(items[0]?.modeLabel).toBe("Jogo");
  });

  test("buildTeamScoutingSummary returns trend metrics and focus", () => {
    const summary = buildTeamScoutingSummary([
      buildLog({ id: "1", receive0: 5, receive1: 1, receive2: 0 }),
      buildLog({ id: "2", receive0: 4, receive1: 2, receive2: 0, date: "2026-05-08" }),
      buildLog({ id: "3", receive0: 3, receive1: 2, receive2: 1, date: "2026-05-07" }),
      buildLog({ id: "4", receive0: 2, receive1: 3, receive2: 1, date: "2026-05-06" }),
    ]);
    expect(summary).not.toBeNull();
    expect(summary?.focusLabel.length).toBeGreaterThan(0);
    expect(summary?.metrics).toHaveLength(4);
  });

  test("buildStudentScoutingSummary aggregates by athlete", () => {
    const items = buildStudentScoutingSummary(
      [buildStudent({ id: "student_1", name: "Lia" })],
      [buildStudentLog({ studentId: "student_1" }), buildStudentLog({ id: "2", studentId: "student_1", date: "2026-05-08" })]
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.studentName).toBe("Lia");
    expect(items[0]?.totalActions).toBeGreaterThan(0);
  });
});
