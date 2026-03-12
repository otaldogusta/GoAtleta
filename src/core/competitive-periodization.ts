import type {
  ClassCalendarException,
  ClassCompetitiveProfile,
  ClassPlan,
} from "./models";

type CompetitivePreset = {
  phase: string;
  theme: string;
  technicalFocus: string;
  physicalFocus: string;
  constraints: string;
  warmupProfile: string;
  jumpTarget: string;
  rpeTarget: string;
};

export type CompetitiveWeekMeta = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
  sessionDates: string[];
  sessionDatesLabel: string;
};

const COMPETITIVE_PHASES = [
  "Base",
  "Desenvolvimento",
  "Pre-competitivo",
  "Competitivo",
] as const;

const PRESET_BY_PHASE: Record<(typeof COMPETITIVE_PHASES)[number], CompetitivePreset> = {
  Base: {
    phase: "Base",
    theme: "Base fisica e fundamentos",
    technicalFocus: "Toque, manchete e saque com controle",
    physicalFocus: "Forca geral, mobilidade, core e aterrissagem",
    constraints: "Volume progressivo, tecnica estavel e baixa fadiga residual",
    warmupProfile: "Mobilidade, ativacao e prevencao de ombro/joelho",
    jumpTarget: "baixo",
    rpeTarget: "4-5",
  },
  Desenvolvimento: {
    phase: "Desenvolvimento",
    theme: "Desenvolvimento tecnico-tatico",
    technicalFocus: "Transicao, leitura de jogo e conexoes do sistema",
    physicalFocus: "Forca especifica, velocidade e pliometria controlada",
    constraints: "Aumentar densidade sem perder qualidade tecnica",
    warmupProfile: "Ativacao especifica com deslocamentos e saltos leves",
    jumpTarget: "medio",
    rpeTarget: "5-6",
  },
  "Pre-competitivo": {
    phase: "Pre-competitivo",
    theme: "Refino competitivo",
    technicalFocus: "Side-out, contra-ataque e bolas de definicao",
    physicalFocus: "Potencia, velocidade e tolerancia a repeticoes",
    constraints: "Intensidade alta com controle de recuperacao",
    warmupProfile: "Ativacao curta, especifica e orientada ao jogo",
    jumpTarget: "medio-alto",
    rpeTarget: "6-7",
  },
  Competitivo: {
    phase: "Competitivo",
    theme: "Manutencao competitiva",
    technicalFocus: "Ajustes finos de jogo e execucao sob pressao",
    physicalFocus: "Manutencao de potencia, prontidao e recuperacao",
    constraints: "Reduzir volume e preservar frescor competitivo",
    warmupProfile: "Aquecimento de jogo com ativacao rapida",
    jumpTarget: "baixo-medio",
    rpeTarget: "4-6",
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

const toDate = (value: string) => {
  const base = new Date(`${value}T00:00:00`);
  return Number.isNaN(base.getTime()) ? null : base;
};

const toIsoDate = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const addDays = (value: string, days: number) => {
  const base = toDate(value);
  if (!base) return value;
  return toIsoDate(new Date(base.getTime() + days * DAY_MS));
};

const formatDisplayDate = (value: string) => {
  const date = toDate(value);
  if (!date) return value;
  return date.toLocaleDateString("pt-BR");
};

const normalizeDayNumber = (day: number) => (day === 0 ? 7 : day);

const distributePhases = (cycleLength: number) => {
  const safeLength = Math.max(1, cycleLength);
  const baseSize = Math.floor(safeLength / COMPETITIVE_PHASES.length);
  let remainder = safeLength % COMPETITIVE_PHASES.length;
  return COMPETITIVE_PHASES.map(() => {
    const value = baseSize + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return Math.max(1, value);
  });
};

export const isCompetitivePlanningMode = (
  value: string | null | undefined
): value is ClassCompetitiveProfile["planningMode"] => value === "adulto-competitivo";

export const getCompetitivePhaseForWeek = (weekNumber: number, cycleLength: number) => {
  const sizes = distributePhases(cycleLength);
  let cursor = 0;
  for (let index = 0; index < COMPETITIVE_PHASES.length; index += 1) {
    cursor += sizes[index];
    if (weekNumber <= cursor) return COMPETITIVE_PHASES[index];
  }
  return COMPETITIVE_PHASES[COMPETITIVE_PHASES.length - 1];
};

export const buildCompetitiveWeekMeta = (options: {
  weekNumber: number;
  cycleStartDate: string;
  daysOfWeek: number[];
  exceptions: ClassCalendarException[];
}) => {
  const startDate = addDays(options.cycleStartDate, (options.weekNumber - 1) * 7);
  const endDate = addDays(startDate, 6);
  const start = toDate(startDate);
  const exceptionSet = new Set(
    options.exceptions
      .filter((item) => item.kind === "no_training")
      .map((item) => item.date)
  );
  const sessionDates: string[] = [];

  if (start) {
    for (let offset = 0; offset < 7; offset += 1) {
      const current = new Date(start.getTime() + offset * DAY_MS);
      const iso = toIsoDate(current);
      const normalizedDay = normalizeDayNumber(current.getDay());
      if (!options.daysOfWeek.includes(normalizedDay)) continue;
      if (exceptionSet.has(iso)) continue;
      sessionDates.push(iso);
    }
  }

  return {
    weekNumber: options.weekNumber,
    startDate,
    endDate,
    dateRangeLabel: `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`,
    sessionDates,
    sessionDatesLabel: sessionDates.length
      ? sessionDates.map((item) => formatDisplayDate(item)).join(" | ")
      : "Sem sessao presencial",
  } satisfies CompetitiveWeekMeta;
};

export const buildCompetitiveClassPlan = (options: {
  classId: string;
  weekNumber: number;
  cycleLength: number;
  cycleStartDate: string;
  daysOfWeek: number[];
  exceptions: ClassCalendarException[];
  profile: Pick<
    ClassCompetitiveProfile,
    "targetCompetition" | "tacticalSystem" | "planningMode"
  >;
  source: ClassPlan["source"];
  existingId?: string | null;
  existingCreatedAt?: string | null;
}) => {
  const phase = getCompetitivePhaseForWeek(options.weekNumber, options.cycleLength);
  const preset = PRESET_BY_PHASE[phase];
  const meta = buildCompetitiveWeekMeta({
    weekNumber: options.weekNumber,
    cycleStartDate: options.cycleStartDate,
    daysOfWeek: options.daysOfWeek,
    exceptions: options.exceptions,
  });
  const nowIso = new Date().toISOString();
  const tacticalLabel = options.profile.tacticalSystem.trim() || "5x1";
  const competitionLabel = options.profile.targetCompetition.trim();
  const constraintChunks = [preset.constraints];
  if (competitionLabel) constraintChunks.push(`Competicao-alvo: ${competitionLabel}`);
  constraintChunks.push(`Sistema tatico: ${tacticalLabel}`);
  if (!meta.sessionDates.length) {
    constraintChunks.push("Semana sem sessao presencial");
  }

  return {
    id:
      options.existingId?.trim() ||
      `cp_comp_${options.classId}_${options.weekNumber}_${Date.now()}`,
    classId: options.classId,
    startDate: meta.startDate,
    weekNumber: options.weekNumber,
    phase: preset.phase,
    theme: preset.theme,
    technicalFocus: `${preset.technicalFocus} (${tacticalLabel})`,
    physicalFocus: preset.physicalFocus,
    constraints: constraintChunks.join(" | "),
    mvFormat: `Competitivo ${tacticalLabel}`,
    warmupProfile: preset.warmupProfile,
    jumpTarget: preset.jumpTarget,
    rpeTarget: preset.rpeTarget,
    source: options.source,
    createdAt: options.existingCreatedAt?.trim() || nowIso,
    updatedAt: nowIso,
  } satisfies ClassPlan;
};

export const toCompetitiveClassPlans = (options: {
  classId: string;
  cycleLength: number;
  cycleStartDate: string;
  daysOfWeek: number[];
  exceptions: ClassCalendarException[];
  profile: Pick<
    ClassCompetitiveProfile,
    "targetCompetition" | "tacticalSystem" | "planningMode"
  >;
}) =>
  Array.from({ length: Math.max(1, options.cycleLength) }).map((_, index) =>
    buildCompetitiveClassPlan({
      classId: options.classId,
      weekNumber: index + 1,
      cycleLength: options.cycleLength,
      cycleStartDate: options.cycleStartDate,
      daysOfWeek: options.daysOfWeek,
      exceptions: options.exceptions,
      profile: options.profile,
      source: "AUTO",
    })
  );
