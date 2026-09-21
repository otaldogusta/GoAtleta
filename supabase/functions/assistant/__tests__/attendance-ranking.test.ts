import { buildAttendanceRanking, isAttendanceRankingQuestion, resolveRequestedDays } from "../attendance-ranking.ts";

test("detecta ranking de faltas e respeita o período pedido", () => {
  expect(isAttendanceRankingQuestion("liste os alunos que faltam mais nos últimos 90 dias")).toBe(true);
  expect(resolveRequestedDays("últimos 120 dias")).toBe(120);
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
