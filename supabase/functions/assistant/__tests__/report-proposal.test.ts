import { resolveReportProposal } from "../report-proposal";

describe("resolveReportProposal", () => {
  const classes = [{ id: "class-1", name: "Vôlei Mirim" }];

  it("resolves an accent-insensitive class and preserves only narrated values", () => {
    const result = resolveReportProposal({
      draft: {
        className: "volei mirim",
        sessionDate: "2026-09-19",
        activity: "Saque e recepção.",
        conclusion: "A turma evoluiu.",
        participantsCount: 12,
        pse: null,
        technique: null,
        attendance: null,
        painScore: null,
        confidence: "high",
        reason: "Relato transcrito.",
        warnings: [],
      },
      classes,
      fallbackDate: "2026-09-18",
      proposalId: "proposal-1",
    });

    expect(result.missing).toBeNull();
    expect(result.proposal).toMatchObject({
      proposalId: "proposal-1",
      classId: "class-1",
      className: "Vôlei Mirim",
      sessionDate: "2026-09-19",
      participantsCount: 12,
      pse: null,
    });
  });

  it("rejects a class outside the authorized list", () => {
    const result = resolveReportProposal({
      draft: { className: "Outra turma", activity: "Treino", conclusion: "" },
      classes,
      fallbackDate: "2026-09-19",
      proposalId: "proposal-2",
    });
    expect(result.proposal).toBeNull();
    expect(result.missing).toMatch(/nome exato da turma/i);
  });

  it("requires report content and clamps bounded metrics", () => {
    const empty = resolveReportProposal({
      draft: { className: "Vôlei Mirim", activity: "", conclusion: "" },
      classes,
      fallbackDate: "2026-09-19",
      proposalId: "proposal-3",
    });
    expect(empty.proposal).toBeNull();

    const bounded = resolveReportProposal({
      draft: { className: "Vôlei Mirim", activity: "Treino", pse: 14, painScore: -2 },
      classes,
      fallbackDate: "2026-09-19",
      proposalId: "proposal-4",
    });
    expect(bounded.proposal?.pse).toBe(10);
    expect(bounded.proposal?.painScore).toBe(0);
  });

  it("accepts hoje as the fallback date without a contradictory warning", () => {
    const result = resolveReportProposal({
      draft: {
        className: "Vôlei Mirim",
        sessionDate: "",
        activity: "Jogo 4x4.",
        warnings: ["A data da aula não foi informada."],
      },
      classes,
      fallbackDate: "2026-09-19",
      proposalId: "proposal-today",
      sourceText: "Hoje a turma fez jogo 4x4.",
    });
    expect(result.proposal?.sessionDate).toBe("2026-09-19");
    expect(result.proposal?.warnings).toEqual([]);
  });
});
