import { interpretAttendanceContext } from "../student-context-events";

describe("student attendance context interpretation", () => {
  it("flags an explicit withdrawal signal without changing attendance", () => {
    expect(
      interpretAttendanceContext({
        note: "A responsável avisou que ele não vai vir mais.",
        attendanceStatus: "faltou",
      })
    ).toMatchObject({
      category: "withdrawal_risk",
      severity: "attention",
      confidence: "high",
    });
  });

  it("understands the colloquial form nao vem mais as a withdrawal signal", () => {
    expect(
      interpretAttendanceContext({
        note: "Aluno não vem mais porque mudou de cidade.",
        attendanceStatus: "faltou",
      })
    ).toMatchObject({
      category: "withdrawal_risk",
      severity: "attention",
      confidence: "high",
    });
  });

  it("prioritizes a high pain score as urgent health context", () => {
    expect(
      interpretAttendanceContext({
        note: "Sentiu desconforto durante a aula.",
        attendanceStatus: "presente",
        painScore: 3,
      })
    ).toMatchObject({
      category: "health",
      severity: "urgent",
      sourceType: "pain_score",
    });
  });

  it("classifies a logistical absence as informational", () => {
    expect(
      interpretAttendanceContext({
        note: "Está em viagem com a família.",
        attendanceStatus: "faltou",
      })
    ).toMatchObject({
      category: "logistics",
      severity: "info",
    });
  });

  it("does not infer context from a neutral present note", () => {
    expect(
      interpretAttendanceContext({
        note: "Participou normalmente.",
        attendanceStatus: "presente",
        painScore: 0,
      })
    ).toBeNull();
  });
});
