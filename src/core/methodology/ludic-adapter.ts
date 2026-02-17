export type LudicAdapterInput = {
  ageStart: number;
  classSize: number;
  sessionDurationMinutes: number;
  objectiveHint: string;
};

export type MethodologyAdapterOutput = {
  tags: string[];
  tips: string[];
  blockFormats: {
    warmup: string;
    main: string;
    cooldown: string;
  };
};

export const buildLudicAdaptation = (input: LudicAdapterInput): MethodologyAdapterOutput => {
  const densityTag = input.classSize >= 16 ? "grupos-curtos" : "estações-livres";
  const durationTag = input.sessionDurationMinutes >= 70 ? "blocos-rotativos" : "mini-jogos";

  return {
    tags: [
      "ludico",
      "jogo-regras-simples",
      "desafio-cronometrado",
      "missao-tecnica",
      densityTag,
      durationTag,
    ],
    tips: [
      "Transforme o objetivo técnico em missão com pontuação simples.",
      "Use blocos curtos de 6-8 minutos para manter engajamento alto.",
      "Priorize feedback positivo imediato: 1 acerto + 1 ajuste.",
      input.ageStart <= 8
        ? "Use linguagem concreta e comandos curtos com demonstração visual."
        : "Mantenha regras simples e aumente desafio por níveis.",
      input.objectiveHint
        ? `Conecte cada jogo ao foco: ${input.objectiveHint.toLowerCase()}.`
        : "Conecte cada jogo a um foco técnico explícito.",
    ],
    blockFormats: {
      warmup: "Caça ao movimento + bola em pares com desafio progressivo.",
      main: "Circuito de mini-jogos com meta técnica por rodada.",
      cooldown: "Roda rápida de feedback com autoavaliação por emoji/escala curta.",
    },
  };
};
