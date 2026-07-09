import type { ClassGroup, RecentSessionSummary } from "../models";

export type JulyAlignmentSession = {
  date: string;
  plannedTitle: string;
  plannedFocus: string;
  state: "completed" | "adapted" | "gate" | "conditional" | "upcoming";
  participantsCount?: number;
  completedSequenceCount?: number;
  observation?: string;
  adjustments?: string[];
};

export type RedeEsperancaJulyAlignment = {
  monthLabel: string;
  sessions: JulyAlignmentSession[];
  evidenceCount: number;
  attendanceSequence: number[];
  attentionSummary: string;
  currentStage: string;
  gateCriteria: string[];
  aiSummary: string;
};

const OFFICIAL_JULY_SESSIONS: JulyAlignmentSession[] = [
  {
    date: "2026-07-02",
    plannedTitle: "Recepção direta sem segurar a bola",
    plannedFocus: "Diagnóstico do primeiro contato e controle individual",
    state: "completed",
    participantsCount: 18,
    observation: "Atenção e organização reduziram o tempo útil da aula.",
  },
  {
    date: "2026-07-07",
    plannedTitle: "Controle de força e direção",
    plannedFocus: "Consolidar o 1x1 sem combinar demandas complexas cedo demais",
    state: "completed",
    participantsCount: 19,
    observation: "A complexidade simultânea prejudicou toque e manchete.",
  },
  {
    date: "2026-07-09",
    plannedTitle: "Movimento + recepção (1º contato)",
    plannedFocus: "Receber sem segurar e decidir a sequência do 1x1",
    state: "completed",
    participantsCount: 14,
    completedSequenceCount: 2,
    observation: "Atenção abaixo do esperado no primeiro contato.",
  },
  {
    date: "2026-07-14",
    plannedTitle: "Movimento + recepção (1º contato)",
    plannedFocus: "Manter o 1x1 com estações e bolas diferenciadas",
    state: "adapted",
    adjustments: ["Mais repetições guiadas", "Menos variáveis por vez", "Feedback imediato e claro"],
  },
  {
    date: "2026-07-16",
    plannedTitle: "Portão de prontidão",
    plannedFocus: "Verificar estabilidade antes de avançar",
    state: "gate",
  },
  {
    date: "2026-07-21",
    plannedTitle: "Mini 2x2",
    plannedFocus: "Iniciar comunicação e tomada de decisão simples",
    state: "conditional",
  },
  {
    date: "2026-07-23",
    plannedTitle: "Mini 2x2 com comunicação",
    plannedFocus: "Organizar quem recebe e quem apoia",
    state: "upcoming",
  },
  {
    date: "2026-07-28",
    plannedTitle: "Consolidação do mini 2x2",
    plannedFocus: "Integrar controle, deslocamento e comunicação",
    state: "upcoming",
  },
  {
    date: "2026-07-30",
    plannedTitle: "Avaliação do mês",
    plannedFocus: "Comparar a evolução desde o primeiro contato",
    state: "upcoming",
  },
];

const normalizeKey = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const isRedeEsperancaEightToElevenClass = (classGroup: ClassGroup | null | undefined) => {
  if (!classGroup) return false;
  const unit = normalizeKey(classGroup.unit);
  const ageBand = normalizeKey(classGroup.ageBand);
  const name = normalizeKey(classGroup.name);
  return unit.includes("rede esperanca") && (ageBand.includes("08-11") || name.includes("8-11"));
};

const mergeRecentEvidence = (
  session: JulyAlignmentSession,
  recentSessions: RecentSessionSummary[]
): JulyAlignmentSession => {
  const recent = recentSessions.find((item) => item.sessionDate === session.date);
  if (!recent) return session;
  return {
    ...session,
    participantsCount: recent.participantsCount ?? session.participantsCount,
    observation: recent.reportConclusion || session.observation,
  };
};

export const buildRedeEsperancaJulyAlignment = (
  recentSessions: RecentSessionSummary[]
): RedeEsperancaJulyAlignment => {
  const sessions = OFFICIAL_JULY_SESSIONS.map((session) =>
    mergeRecentEvidence(session, recentSessions)
  );
  const completed = sessions.filter((session) => session.state === "completed");
  const attendanceSequence = completed
    .map((session) => session.participantsCount)
    .filter((value): value is number => typeof value === "number");

  return {
    monthLabel: "Julho 2026",
    sessions,
    evidenceCount: completed.length,
    attendanceSequence,
    attentionSummary: "Atenção e transições ainda impactam a qualidade das execuções.",
    currentStage: "Consolidar 1x1",
    gateCriteria: [
      "Pelo menos 70% da turma conclui a sequência do 1º contato",
      "No máximo 3 perdas por sequência, em média",
      "Atenção e comportamento dentro do esperado",
    ],
    aiSummary:
      "Os relatórios indicam que a recepção direta ainda precisa de estabilidade. A recomendação é manter o 1x1, reduzir variáveis e liberar o mini 2x2 somente após o portão de prontidão.",
  };
};

export const redeEsperancaJulyAiContext = {
  currentStage: "consolidacao_1x1",
  mustProgressFrom: "recepção direta sem segurar, com controle de força e deslocamento simples",
  mustAvoid: [
    "combinar deslocamento complexo e fundamento antes da estabilização",
    "avançar automaticamente para o mini 2x2",
    "usar muitas variáveis simultâneas em turma com atenção instável",
  ],
  readinessGate: [
    "70% da turma conclui a sequência do primeiro contato",
    "até 3 perdas por sequência em média",
    "atenção e comportamento dentro do esperado",
  ],
  preferredAdjustments: [
    "estações rotativas",
    "bolas diferenciadas por nível",
    "repetições guiadas",
    "feedback imediato",
  ],
} as const;
