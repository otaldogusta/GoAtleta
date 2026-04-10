import {
    buildSessionApproachAwareBlockDescription,
    buildSessionApproachAwareGeneralObjective,
    detectSessionPedagogicalApproach,
} from "../methodology/session-pedagogical-language";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toContain: (expected: unknown) => void;
  not: {
    toContain: (expected: unknown) => void;
  };
};

describe("session-pedagogical-language", () => {
  it("normalizes visible language to court vocabulary", () => {
    const approach = detectSessionPedagogicalApproach([
      "Executar bloqueio com tempo correto para fechar o corredor",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "tempo de salto, fechamento do corredor e coordenação do bloqueio",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "bloqueio",
    });

    expect(description).toContain("fechar o espaço do ataque");
    expect(description).not.toContain("fechamento do corredor");
    expect(description).not.toContain("fechar o corredor");
  });

  it("writes a traditional block description with concrete repetition and criterion", () => {
    const approach = detectSessionPedagogicalApproach([
      "Executar o saque corretamente com gesto tecnico estavel",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "qualidade do primeiro contato e direcionamento da bola",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "saque",
    });

    expect(description).toContain("lançamento e contato");
    expect(description).toContain("correção objetiva");
  });

  it("distinguishes target-zone serving from rupture serving", () => {
    const approach = detectSessionPedagogicalApproach([
      "Decidir a melhor zona de saque para gerar vantagem na organizacao adversaria",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "lançamento, contato e direcionamento do saque",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "saque",
      detailText: "saque em zona-alvo na zona 1 e zona 5",
    });

    expect(description).toContain("zonas-alvo");
    expect(description).toContain("tirar o passe da rede");
    expect(description).not.toContain("organização adversária");
  });

  it("writes a cognitivist block description with testing, comparison and decision", () => {
    const approach = detectSessionPedagogicalApproach([
      "Executar diferentes formas de recepcao para decidir a mais eficaz",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "qualidade do primeiro contato e direcionamento da bola",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "passe",
    });

    expect(description).toContain("trajetórias de passe");
    expect(description).toContain("comparam resultados");
    expect(description).toContain("decidem");
  });

  it("writes a sociocultural block description with negotiation and peer communication", () => {
    const approach = detectSessionPedagogicalApproach([
      "Discutir em grupo a melhor organizacao da equipe",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "organização da jogada em passe, levantamento e ataque",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "ataque",
    });

    expect(description).toContain("ocupação coletiva do espaço ofensivo");
    expect(description).toContain("entre pares");
    expect(description).toContain("reajusta");
  });

  it("specializes levantamento language when the skill is explicit", () => {
    const approach = detectSessionPedagogicalApproach([
      "Analisar diferentes opcoes de distribuicao para organizar o ataque",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "entrada da levantadora para organizar o segundo toque",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "levantamento",
    });

    expect(description).toContain("distribuir a bola");
    expect(description).toContain("levantamento");
    expect(description).not.toContain("distribuição");
  });

  it("specializes defense language with reading and continuity cues", () => {
    const approach = detectSessionPedagogicalApproach([
      "Responder a diferentes trajetorias defensivas escolhendo a melhor solucao",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "leitura defensiva, cobertura e resposta coordenada à jogada",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "defesa",
    });

    expect(description).toContain("trajetórias");
    expect(description).toContain("manter a bola viva");
  });

  it("distinguishes wing attack defense from tip defense", () => {
    const approach = detectSessionPedagogicalApproach([
      "Responder a bolas curtas e largadas escolhendo a melhor leitura",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "leitura defensiva, cobertura e resposta coordenada à jogada",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "defesa",
      detailText: "defesa de largada e ataque colocado proximo a rede",
    });

    expect(description).toContain("defesa de largada");
    expect(description).toContain("leitura curta");
  });

  it("distinguishes short reception from long forearm pass", () => {
    const approach = detectSessionPedagogicalApproach([
      "Executar recepcao curta ajustando a base para controlar a primeira bola",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "qualidade do primeiro contato e direcionamento do passe",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "passe",
      detailText: "recepcao curta de saque curto proxima a rede",
    });

    expect(description).toContain("recepção curta");
    expect(description).not.toContain("manchete longa");
  });

  it("specializes transition language with collective continuity vocabulary", () => {
    const approach = detectSessionPedagogicalApproach([
      "Organizar em grupo a melhor saida para o contra-ataque apos a defesa",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "reorganização entre defesa e ataque para continuidade da jogada",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "transicao",
    });

    expect(description).toContain("organização coletiva da transição");
    expect(description).toContain("dar sequência na jogada");
    expect(description).not.toContain("continuidade ofensiva");
  });

  it("distinguishes defense-attack transition from counterattack coverage", () => {
    const approach = detectSessionPedagogicalApproach([
      "Organizar a cobertura do contra-ataque com continuidade da jogada",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "reorganização entre defesa e ataque para continuidade da jogada",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "transicao",
      detailText: "cobertura de contra-ataque apos rebote no bloqueio",
    });

    expect(description).toContain("cobertura de contra-ataque");
    expect(description).toContain("segunda bola");
  });

  it("specializes blocking language with corridor and timing cues", () => {
    const approach = detectSessionPedagogicalApproach([
      "Executar o bloqueio com tempo correto e fechamento do corredor",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "tempo de salto, fechamento do corredor e coordenação do bloqueio",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "bloqueio",
    });

    expect(description).toContain("tempo de salto");
    expect(description).toContain("fechar o espaço do ataque");
    expect(description).not.toContain("fechamento do corredor");
  });

  it("distinguishes single block from double block", () => {
    const approach = detectSessionPedagogicalApproach([
      "Executar bloqueio duplo com sincronia e fechamento do corredor",
    ]);

    const description = buildSessionApproachAwareBlockDescription({
      core: "tempo de salto, fechamento do corredor e coordenação do bloqueio",
      blockKey: "main",
      pedagogicalApproach: approach,
      focusSkill: "bloqueio",
      detailText: "bloqueio duplo com dois bloqueadores alinhando as maos",
    });

    expect(description).toContain("bloqueio duplo");
    expect(description).toContain("sincronia");
    expect(description).toContain("fechar a diagonal");
    expect(description).not.toContain("fechamento do corredor");
  });

  it("keeps a safe hybrid fallback when no pedagogical approach is provided", () => {
    const description = buildSessionApproachAwareBlockDescription({
      core: "organização corporal",
      blockKey: "warmup",
    });

    expect(description).toContain("referência técnica");
    expect(description).toContain("pequenas variações");
    expect(description).toContain("troca rápida entre pares");
  });

  it("adjusts the session objective wording according to the detected approach", () => {
    const approach = detectSessionPedagogicalApproach([
      "Resolver em grupo a melhor estrategia de saque explicando a escolha",
    ]);

    const objective = buildSessionApproachAwareGeneralObjective(
      "saque",
      approach,
      "Desenvolver saque consistente e orientado por alvo para gerar vantagem inicial."
    );

    expect(objective).toContain("comunicação entre pares");
    expect(objective).toContain("construção coletiva");
  });
});
