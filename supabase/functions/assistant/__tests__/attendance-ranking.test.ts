import {
  buildAttendanceRanking,
  isAttendanceWithinStaffPeriods,
  isAttendanceRankingQuestion,
  resolveAttendanceRankingScope,
  resolveProfessorClassScope,
  resolveRequestedDays,
} from "../attendance-ranking.ts";

test("detecta ranking de faltas e respeita o período pedido", () => {
  expect(isAttendanceRankingQuestion("liste os alunos que faltam mais nos últimos 90 dias")).toBe(true);
  expect(resolveRequestedDays("últimos 120 dias")).toBe(120);
});

test("considera somente chamadas dentro do período em que o professor esteve na turma", () => {
  const periods = [{ classId: "c1", startsOn: "2026-08-01", endsOn: "2026-08-31" }];
  expect(isAttendanceWithinStaffPeriods({ classid: "c1", date: "2026-08-15" }, periods)).toBe(true);
  expect(isAttendanceWithinStaffPeriods({ classid: "c1", date: "2026-09-01" }, periods)).toBe(false);
  expect(isAttendanceWithinStaffPeriods({ classid: "c2", date: "2026-08-15" }, periods)).toBe(false);
});

test("ordena faltas usando apenas chamadas realmente registradas", () => {
  const ranking = buildAttendanceRanking(
    [
      { classid: "c1", studentid: "s1", date: "2026-09-01", status: "faltou" },
      { classid: "c1", studentid: "s1", date: "2026-09-08", status: "presente" },
      { classid: "c1", studentid: "s2", date: "2026-09-01", status: "faltou" },
      { classid: "c1", studentid: "s2", date: "2026-09-08", status: "faltou" },
    ],
    [{ id: "s1", name: "Ana" }, { id: "s2", name: "Bia" }],
    [{ id: "c1", name: "Ohayō" }],
  );
  expect(ranking[0]).toEqual(expect.objectContaining({ studentName: "Bia", absences: 2 }));
  expect(ranking[1]?.attendanceRate).toBe(50);
});

test("professor citado substitui a turma aberta como escopo da consulta", () => {
  expect(resolveAttendanceRankingScope('alunos que mais faltam do prof "Gustavo" nos últimos 90 dias')).toEqual({
    kind: "professor",
    professorName: "Gustavo",
  });
  expect(resolveAttendanceRankingScope("liste de todas as turmas")).toEqual({ kind: "all" });
  expect(resolveAttendanceRankingScope("liste os alunos que mais faltam")).toEqual({ kind: "context" });
});

test("reúne todas as turmas do professor sem misturar homônimos", () => {
  const tenures = [
    { class_id: "c1", user_id: "u1", staff_profile_id: null, display_name_snapshot: "Gustavo Santos", starts_on: "2026-01-01", ends_on: null, status: "active" },
    { class_id: "c2", user_id: "u1", staff_profile_id: null, display_name_snapshot: "Gustavo Santos", starts_on: "2026-01-01", ends_on: null, status: "active" },
    { class_id: "c3", user_id: "u2", staff_profile_id: null, display_name_snapshot: "Gustavo Ribeiro", starts_on: "2026-01-01", ends_on: null, status: "active" },
  ];

  expect(resolveProfessorClassScope("Gustavo Santos", tenures, "u2").selected).toEqual({
    displayName: "Gustavo Santos",
    classIds: ["c1", "c2"],
    periods: [
      { classId: "c1", startsOn: "2026-01-01", endsOn: null },
      { classId: "c2", startsOn: "2026-01-01", endsOn: null },
    ],
  });
  expect(resolveProfessorClassScope("Gustavo", tenures).selected).toBeNull();
  expect(resolveProfessorClassScope("Gustavo", tenures, "u2").selected).toEqual({
    displayName: "Gustavo Ribeiro",
    classIds: ["c3"],
    periods: [{ classId: "c3", startsOn: "2026-01-01", endsOn: null }],
  });
});
