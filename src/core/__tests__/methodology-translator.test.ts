import { translateMethodology } from "../methodology/methodology-translator";
import { detectPedagogicalApproach } from "../methodology/pedagogical-approach-detector";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toContain: (expected: unknown) => void;
  toBeGreaterThan: (expected: number) => void;
  toMatch: (expected: RegExp) => void;
  not: {
    toBe: (expected: unknown) => void;
  };
};

describe("methodology-translator", () => {
  it("returns ludic mode for younger age bands", () => {
    const result = translateMethodology({
      ageBand: "08-10",
      objectiveHint: "passe e controle de bola",
      sessionDurationMinutes: 60,
      classSize: 12,
    });

    expect(result.mode).toBe("ludic");
    expect(result.tags.length).toBeGreaterThan(0);
    expect(result.requiresHumanApproval).toBe(true);
  });

  it("returns performance mode for high pedagogical temperature", () => {
    const result = translateMethodology({
      ageBand: "15-17",
      pedagogicalTemperature: 85,
      objectiveHint: "pressão de saque",
    });

    expect(result.mode).toBe("performance");
    expect(result.tips.some((tip) => tip.toLowerCase().includes("critério"))).toBe(true);
  });

  it("detects cognitivist intent when context outweighs the verb", () => {
    const result = translateMethodology({
      ageBand: "13-15",
      objectiveHint: "Executar o saque resolvendo diferentes situacoes de jogo",
    });

    expect(result.detectedApproach.approach).toBe("cognitivista");
    expect(result.detectedApproach.predominanceLevel).toMatch(/fraca|moderada|alta/);
    expect(result.tags).toContain("abordagem-cognitivista");
    expect(result.coachPrompt.toLowerCase()).toContain("perfil predominante cognitivista");
  });

  it("treats autonomy as stronger than a traditional verb", () => {
    const detection = detectPedagogicalApproach("Memorizar cores de forma independente");

    expect(detection.approach).toBe("cognitivista");
    expect(detection.primaryIntent).toBe("resolucao_problemas");
  });

  it("detects sociocultural intent from collective negotiation", () => {
    const detection = detectPedagogicalApproach(
      "Discutir em grupo a melhor organizacao da equipe"
    );

    expect(detection.approach).toBe("sociocultural");
    expect(detection.learnerRole).toBe("interagir");
  });

  it("keeps traditional approach when the goal is technical reproduction", () => {
    const detection = detectPedagogicalApproach(
      "Executar o saque corretamente com gesto tecnico estavel"
    );

    expect(detection.approach).toBe("tradicional");
    expect(detection.primaryIntent).toBe("reproducao");
  });

  it("detects sociocultural intent even with a technical verb when collaboration is explicit", () => {
    const detection = detectPedagogicalApproach(
      "Executar o saque em dupla negociando a melhor estrategia de alvo"
    );

    expect(detection.approach).toBe("sociocultural");
    expect(detection.learnerRole).toBe("interagir");
  });

  it("detects cognitivist intent when experimentation outweighs technical stability", () => {
    const detection = detectPedagogicalApproach(
      "Executar diferentes formas de recepcao para decidir a mais eficaz"
    );

    expect(detection.approach).toBe("cognitivista");
    expect(detection.traditionalConductionRisk).toBe("baixo");
  });

  it("keeps traditional approach when autonomy and interaction are absent", () => {
    const detection = detectPedagogicalApproach(
      "Memorizar a sequencia correta do rodizio com reproducao padronizada"
    );

    expect(detection.approach).toBe("tradicional");
    expect(detection.traditionalConductionRisk).not.toBe("baixo");
  });

  it("returns secondary traits when there is meaningful overlap between approaches", () => {
    const detection = detectPedagogicalApproach(
      "Resolver em grupo a melhor estrategia de saque explicando a escolha"
    );

    expect(detection.approach).toBe("sociocultural");
    expect(detection.secondaryApproaches.length).toBeGreaterThan(0);
    expect(detection.secondaryApproaches).toContain("cognitivista");
  });
});
