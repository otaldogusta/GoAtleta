import { detectSessionPedagogicalApproach } from "../methodology/session-pedagogical-language";
import {
    buildSessionPedagogicalPanelIntent,
    buildSessionPedagogicalPanelRisk,
    buildSessionPedagogicalPanelSecondary,
    buildSessionPedagogicalPanelSignals,
    buildSessionPedagogicalPanelSummary,
    formatSessionAdjustmentLabel,
    formatSessionDecisionReasonTypeLabel,
    formatSessionMethodologyApproachLabel,
    formatSessionMethodologyEvidenceExcerpt,
    formatSessionMethodologyEvidenceSource,
    formatSessionMethodologyScoreSummary,
    formatSessionOverrideSummary,
    formatSessionPedagogicalFocusSkill,
} from "../methodology/session-pedagogical-panel-language";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toContain: (expected: unknown) => void;
  toBe: (expected: unknown) => void;
  not: {
    toContain: (expected: unknown) => void;
  };
};

describe("session-pedagogical-panel-language", () => {
  it("turns cognitivist reading into court-language copy", () => {
    const approach = detectSessionPedagogicalApproach([
      "Analisar diferentes soluções de recepção para decidir a mais eficaz em cada jogada",
    ]);

    expect(buildSessionPedagogicalPanelSummary(approach)).toContain("leitura da jogada");
    expect(buildSessionPedagogicalPanelSummary(approach)).toContain("melhor saída");
    expect(buildSessionPedagogicalPanelIntent(approach)).toContain("ler a situação");
    expect(buildSessionPedagogicalPanelIntent(approach)).toContain("ler a jogada e decidir");
    expect(buildSessionPedagogicalPanelSummary(approach)).not.toContain("cognitivista");
  });

  it("explains secondary traces, signals and risk without academic labels", () => {
    const approach = detectSessionPedagogicalApproach([
      "Executar em grupo a melhor solução de cobertura discutindo como organizar a jogada",
    ]);

    expect(buildSessionPedagogicalPanelSecondary(approach)).toContain("Também aparecem sinais de");
    expect(buildSessionPedagogicalPanelSecondary(approach)).toContain("ajuste e comunicação entre os atletas");
    expect(buildSessionPedagogicalPanelSignals(approach)).toContain("a dupla ou o grupo ficam no centro da ação");
    expect(buildSessionPedagogicalPanelRisk(approach)).toContain(":");
    expect(buildSessionPedagogicalPanelRisk(approach)).not.toContain("condução tradicional");
  });

  it("formats focus skill in visible volleyball language", () => {
    expect(formatSessionPedagogicalFocusSkill("passe")).toBe("manchete e recepção");
    expect(formatSessionPedagogicalFocusSkill("transicao")).toBe("transição");
  });

  it("formats methodology, adjustment and override labels in coach language", () => {
    expect(formatSessionMethodologyApproachLabel("analitico")).toContain("referência clara do movimento");
    expect(formatSessionMethodologyScoreSummary(118)).toContain("bom encaixe com a turma");
    expect(formatSessionAdjustmentLabel("increase")).toBe("subir a exigência");
    expect(formatSessionDecisionReasonTypeLabel("readiness")).toBe("resposta da turma");
    expect(
      formatSessionOverrideSummary({
        type: "methodology",
        fromRuleId: "m1",
        toRuleId: "m2",
        fromApproach: "analitico",
        toApproach: "jogo",
        createdAt: "2026-04-10T00:00:00.000Z",
      })
    ).toContain("puxou a condução");
    expect(
      formatSessionOverrideSummary({
        type: "methodology",
        fromRuleId: "m1",
        toRuleId: "m2",
        fromApproach: "analitico",
        toApproach: "jogo",
        createdAt: "2026-04-10T00:00:00.000Z",
      })
    ).toContain("jogo condicionado");
  });

  it("formats methodology evidence for the panel without leaking technical wording", () => {
    expect(
      formatSessionMethodologyEvidenceSource({
        title: "Treinamento esportivo para jovens",
        authors: "Silva e Souza",
        sourceYear: 2024,
        citationText: "organização ofensiva a partir da distribuição da bola",
      })
    ).toContain("2024");
    expect(
      formatSessionMethodologyEvidenceExcerpt({
        title: "Treinamento esportivo para jovens",
        authors: "Silva e Souza",
        sourceYear: 2024,
        citationText: "organização ofensiva a partir da distribuição da bola",
      })
    ).toContain("organizar o ataque");
    expect(
      formatSessionMethodologyEvidenceExcerpt({
        title: "Treinamento esportivo para jovens",
        authors: "Silva e Souza",
        sourceYear: 2024,
        citationText: "organização ofensiva a partir da distribuição da bola",
      })
    ).not.toContain("distribuição da bola");
  });
});
