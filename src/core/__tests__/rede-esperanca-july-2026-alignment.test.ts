import {
  buildRedeEsperancaJulyAlignment,
  isRedeEsperancaEightToElevenClass,
  redeEsperancaJulyAiContext,
} from "../pedagogy/rede-esperanca-july-2026-alignment";

describe("Rede Esperança July 2026 alignment", () => {
  it("keeps mini 2x2 behind the readiness gate", () => {
    const alignment = buildRedeEsperancaJulyAlignment([]);
    const gate = alignment.sessions.find((session) => session.state === "gate");
    const mini2x2 = alignment.sessions.find((session) => session.state === "conditional");

    expect(gate?.date).toBe("2026-07-16");
    expect(mini2x2?.date).toBe("2026-07-21");
    expect(alignment.gateCriteria).toHaveLength(3);
    expect(redeEsperancaJulyAiContext.mustAvoid).toContain(
      "avançar automaticamente para o mini 2x2"
    );
  });

  it("uses recent app evidence over the imported baseline", () => {
    const alignment = buildRedeEsperancaJulyAlignment([
      {
        sessionDate: "2026-07-09",
        participantsCount: 16,
        reportConclusion: "Controle melhorou, mas a recepção ainda oscila.",
        wasPlanned: true,
        wasApplied: true,
        wasEditedByTeacher: false,
        wasConfirmedExecuted: true,
        executionState: "confirmed_executed",
        teacherOverrideWeight: "none",
      },
    ]);
    const session = alignment.sessions.find((item) => item.date === "2026-07-09");

    expect(session?.participantsCount).toBe(16);
    expect(session?.observation).toContain("Controle melhorou");
  });

  it("only activates the tailored view for the intended cohort", () => {
    expect(
      isRedeEsperancaEightToElevenClass({
        unit: "Rede Esperança",
        name: "Turma 8-11",
        ageBand: "08-11",
      } as any)
    ).toBe(true);
    expect(
      isRedeEsperancaEightToElevenClass({
        unit: "UniBrasil",
        name: "Turma 8-11",
        ageBand: "08-11",
      } as any)
    ).toBe(false);
  });
});
