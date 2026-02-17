export type PerformanceAdapterInput = {
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

export const buildPerformanceAdaptation = (
  input: PerformanceAdapterInput
): MethodologyAdapterOutput => {
  const volumeTag = input.sessionDurationMinutes >= 85 ? "volume-controlado" : "intensidade-controlada";
  const densityTag = input.classSize >= 16 ? "fila-curta-critério-claro" : "repeticao-qualificada";

  return {
    tags: [
      "rendimento",
      "repeticao-estruturada",
      "meta-quantitativa",
      "pressao-tatica",
      volumeTag,
      densityTag,
    ],
    tips: [
      "Defina critério objetivo por bloco (ex: 7/10 execuções válidas).",
      "Suba a oposição somente após estabilidade técnica mínima.",
      "Controle carga por séries e pausas curtas monitorando PSE.",
      "Registre o principal erro recorrente para ajuste da próxima sessão.",
      input.objectiveHint
        ? `Direcione os blocos para o foco central: ${input.objectiveHint.toLowerCase()}.`
        : "Direcione os blocos para o foco técnico principal da semana.",
    ],
    blockFormats: {
      warmup: "Ativação preventiva + sequência técnica com progressão de precisão.",
      main: "Bloco técnico-tático com metas por série e oposição progressiva.",
      cooldown: "Descompressão + revisão de métricas e compromisso da próxima sessão.",
    },
  };
};
