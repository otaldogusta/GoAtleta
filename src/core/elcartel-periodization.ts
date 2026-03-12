import type {
    ClassCalendarException,
    ClassCompetitiveProfile,
    ClassPlan,
} from "./models";

type ElCartelGenderVariant = "feminino" | "masculino" | "neutro";

type ElCartelWeek = {
  week: number;
  dateA: string;
  dateB: string;
  phase: string;
  theme: string;
  technicalFocus: string;
  physicalFocus: string;
  tacticalFocus: string;
  jumpTarget: string;
  rpeTarget: string;
};

const WEEKLY_PLAN: ElCartelWeek[] = [
  {
    week: 1,
    dateA: "2026-03-10",
    dateB: "2026-03-12",
    phase: "Base",
    theme: "Adaptacao fisica e fundamentos",
    technicalFocus: "Toque, manchete e base defensiva",
    physicalFocus: "Forca geral, core e mobilidade",
    tacticalFocus: "Nocoes iniciais de rodizio e funcao",
    jumpTarget: "baixo",
    rpeTarget: "4-5",
  },
  {
    week: 2,
    dateA: "2026-03-17",
    dateB: "2026-03-19",
    phase: "Base",
    theme: "Controle de bola e introducao funcional",
    technicalFocus: "Levantamento, recepcao e ataque basico",
    physicalFocus: "Forca unilateral, aterrissagem e coordenacao",
    tacticalFocus: "Funcao do levantador e transicao simples",
    jumpTarget: "baixo-moderado",
    rpeTarget: "5",
  },
  {
    week: 3,
    dateA: "2026-03-24",
    dateB: "2026-03-26",
    phase: "Base",
    theme: "Fundamentos sob deslocamento",
    technicalFocus: "Bloqueio, defesa e contra-ataque",
    physicalFocus: "Forca geral, agilidade e core",
    tacticalFocus: "Organizacao ofensiva inicial",
    jumpTarget: "moderado",
    rpeTarget: "5-6",
  },
  {
    week: 4,
    dateA: "2026-03-31",
    dateB: "2026-04-02",
    phase: "Base / Consolidacao",
    theme: "Integracao fisica-tecnica",
    technicalFocus: "Ataque, recepcao-levantamento-ataque",
    physicalFocus: "Forca + pliometria leve",
    tacticalFocus: "Organizacao por posicao",
    jumpTarget: "moderado",
    rpeTarget: "4-5",
  },
  {
    week: 5,
    dateA: "2026-04-07",
    dateB: "2026-04-09",
    phase: "Desenvolvimento",
    theme: "Forca maxima introdutoria",
    technicalFocus: "Levantamento e ataque",
    physicalFocus: "Forca maxima de base",
    tacticalFocus: "Entradas do 5x1",
    jumpTarget: "moderado",
    rpeTarget: "5-6",
  },
  {
    week: 6,
    dateA: "2026-04-14",
    dateB: "2026-04-16",
    phase: "Desenvolvimento",
    theme: "Bloqueio e transicao",
    technicalFocus: "Bloqueio, defesa e cobertura",
    physicalFocus: "Potencia inicial e desaceleracao",
    tacticalFocus: "Defesa-ataque no 5x1",
    jumpTarget: "moderado",
    rpeTarget: "5-6",
  },
  {
    week: 7,
    dateA: "2026-04-23",
    dateB: "2026-04-28",
    phase: "Desenvolvimento",
    theme: "Potencia e jogo condicionado",
    technicalFocus: "Saque, recepcao e ataque",
    physicalFocus: "Forca + potencia inicial",
    tacticalFocus: "Sistema com leitura situacional",
    jumpTarget: "moderado",
    rpeTarget: "6",
  },
  {
    week: 8,
    dateA: "2026-04-30",
    dateB: "2026-05-05",
    phase: "Desenvolvimento",
    theme: "Consolidacao do 5x1",
    technicalFocus: "Organizacao ofensiva e bolas por zona",
    physicalFocus: "Velocidade e deslocamento",
    tacticalFocus: "5x1 mais estavel",
    jumpTarget: "moderado",
    rpeTarget: "5-6",
  },
  {
    week: 9,
    dateA: "2026-05-07",
    dateB: "2026-05-12",
    phase: "Potencia especifica",
    theme: "Salto e ataque",
    technicalFocus: "Ataque e bloqueio",
    physicalFocus: "Forca + pliometria",
    tacticalFocus: "Transicao rapida",
    jumpTarget: "moderado-alto",
    rpeTarget: "6-7",
  },
  {
    week: 10,
    dateA: "2026-05-14",
    dateB: "2026-05-19",
    phase: "Potencia especifica",
    theme: "Repeticao de acoes explosivas",
    technicalFocus: "Side-out e contra-ataque",
    physicalFocus: "Potencia e RSA especifica",
    tacticalFocus: "Tomada de decisao",
    jumpTarget: "moderado-alto",
    rpeTarget: "6-7",
  },
  {
    week: 11,
    dateA: "2026-05-21",
    dateB: "2026-05-26",
    phase: "Potencia especifica",
    theme: "Pressao de jogo",
    technicalFocus: "Saque tatico, recepcao e definicao",
    physicalFocus: "Potencia reativa",
    tacticalFocus: "Leitura de jogo",
    jumpTarget: "alto controlado",
    rpeTarget: "6",
  },
  {
    week: 12,
    dateA: "2026-05-28",
    dateB: "2026-06-02",
    phase: "Potencia especifica / transicao pre-competitiva",
    theme: "Velocidade de execucao",
    technicalFocus: "Bolas rapidas, cobertura e definicao",
    physicalFocus: "Potencia especifica",
    tacticalFocus: "Maior fluidez no 5x1",
    jumpTarget: "moderado-alto",
    rpeTarget: "6",
  },
  {
    week: 13,
    dateA: "2026-06-09",
    dateB: "2026-06-11",
    phase: "Pre-competitiva",
    theme: "Intensidade de jogo",
    technicalFocus: "Side-out e contra-ataque",
    physicalFocus: "Manutencao de potencia",
    tacticalFocus: "Organizacao coletiva sob pressao",
    jumpTarget: "moderado",
    rpeTarget: "6",
  },
  {
    week: 14,
    dateA: "2026-06-16",
    dateB: "2026-06-18",
    phase: "Pre-competitiva",
    theme: "Bola de definicao",
    technicalFocus: "Ataque, bloqueio e defesa de cobertura",
    physicalFocus: "Potencia curta e qualidade",
    tacticalFocus: "Momentos decisivos do jogo",
    jumpTarget: "moderado",
    rpeTarget: "6",
  },
  {
    week: 15,
    dateA: "2026-06-23",
    dateB: "2026-06-25",
    phase: "Pre-competitiva",
    theme: "Jogo completo",
    technicalFocus: "Padrao de jogo",
    physicalFocus: "Manutencao com menor volume",
    tacticalFocus: "5x1 consolidado",
    jumpTarget: "moderado",
    rpeTarget: "5-6",
  },
  {
    week: 16,
    dateA: "2026-06-30",
    dateB: "2026-07-02",
    phase: "Competitiva",
    theme: "Manutencao e refinamento",
    technicalFocus: "Saque-recepcao-ataque",
    physicalFocus: "Manutencao de potencia",
    tacticalFocus: "Estabilidade competitiva",
    jumpTarget: "moderado-baixo",
    rpeTarget: "5",
  },
  {
    week: 17,
    dateA: "2026-07-07",
    dateB: "2026-07-09",
    phase: "Competitiva",
    theme: "Desempenho",
    technicalFocus: "Jogo e situacoes reais",
    physicalFocus: "Explosao sem fadiga excessiva",
    tacticalFocus: "Leitura, ajuste e confianca",
    jumpTarget: "moderado",
    rpeTarget: "5-6",
  },
  {
    week: 18,
    dateA: "2026-07-14",
    dateB: "2026-07-16",
    phase: "Competitiva / pico",
    theme: "Prontidao competitiva",
    technicalFocus: "Padrao competitivo",
    physicalFocus: "Manutencao fina",
    tacticalFocus: "Jogo alvo",
    jumpTarget: "controlado",
    rpeTarget: "5",
  },
];

const genderAdjustmentByVariant: Record<ElCartelGenderVariant, string> = {
  feminino:
    "Progressao de saltos mais cautelosa, com enfase em aterrissagem, estabilidade e prevencao neuromuscular.",
  masculino:
    "Progressao de potencia e saltos ligeiramente mais agressiva, com controle de fadiga e manutencao tecnica.",
  neutro:
    "Ajustar progressao de saltos por perfil individual, com foco em qualidade de movimento e controle de fadiga.",
};

const getSessionPatternLabel = (week: ElCartelWeek) =>
  `Terca ${week.dateA}: forca maxima + tecnica integrada | Quinta ${week.dateB}: pliometria/potencia + coletivo/tatico`;

export const buildElCartelClassPlans = (options: {
  classId: string;
  gender?: string | null;
}) => {
  const normalizedGender = String(options.gender ?? "").trim().toLowerCase();
  const variant: ElCartelGenderVariant =
    normalizedGender === "feminino"
      ? "feminino"
      : normalizedGender === "masculino"
        ? "masculino"
        : "neutro";
  const nowIso = new Date().toISOString();

  return WEEKLY_PLAN.map((week) => {
    const dateNotes =
      week.week === 7
        ? "Semana ajustada pelo feriado de 21/04."
        : week.week === 13
          ? "Semana ajustada pelo feriado de 04/06."
          : "";

    return {
      id: `cp_elcartel_${options.classId}_${week.week}_${Date.now()}`,
      classId: options.classId,
      startDate: week.dateA,
      weekNumber: week.week,
      phase: week.phase,
      theme: week.theme,
      technicalFocus: week.technicalFocus,
      physicalFocus: week.physicalFocus,
      constraints: [
        `Tatico: ${week.tacticalFocus}`,
        `Monitoramento: session RPE + jump count + wellness + ACWR`,
        getSessionPatternLabel(week),
        genderAdjustmentByVariant[variant],
        dateNotes,
      ]
        .filter(Boolean)
        .join(" | "),
      mvFormat: "5x1",
      warmupProfile:
        "Terca: mobilidade dinamica + ativacao de gluteo/core + estabilidade de tornozelo/ombro | Quinta: aquecimento dinamico + prevencao neuromuscular",
      jumpTarget: week.jumpTarget,
      rpeTarget: week.rpeTarget,
      source: "AUTO",
      createdAt: nowIso,
      updatedAt: nowIso,
    } satisfies ClassPlan;
  });
};

export const buildElCartelCompetitiveProfile = (options: {
  classId: string;
  organizationId: string;
  cycleStartDate?: string;
}): ClassCompetitiveProfile => {
  const nowIso = new Date().toISOString();
  return {
    classId: options.classId,
    organizationId: options.organizationId,
    planningMode: "adulto-competitivo",
    cycleStartDate: options.cycleStartDate ?? "2026-03-10",
    targetCompetition: "Pico competitivo junho/julho",
    targetDate: "2026-07-16",
    tacticalSystem: "5x1",
    currentPhase: "Base",
    notes:
      "Preset ElCartel 2x/semana: terca estrutural (forca + tecnica) e quinta especifica (potencia + coletivo/tatico).",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
};

export const buildElCartelCalendarExceptions = (options: {
  classId: string;
  organizationId: string;
}): ClassCalendarException[] => [
  {
    id: `exc_${options.classId}_2026-04-21_no_training`,
    classId: options.classId,
    organizationId: options.organizationId,
    date: "2026-04-21",
    reason: "Feriado",
    kind: "no_training",
    createdAt: new Date().toISOString(),
  },
  {
    id: `exc_${options.classId}_2026-06-04_no_training`,
    classId: options.classId,
    organizationId: options.organizationId,
    date: "2026-06-04",
    reason: "Feriado",
    kind: "no_training",
    createdAt: new Date().toISOString(),
  },
];
