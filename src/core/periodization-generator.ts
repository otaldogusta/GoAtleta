import { parseAgeBandRange } from "./age-band";
import type { ClassPlan } from "./models";
import {
  ageBands,
  type PeriodizationModel,
  type SportProfile,
  type VolumeLevel,
} from "./periodization-basics";

// ---------------------------------------------------------------------------
// Shared local types
// ---------------------------------------------------------------------------

export type WeekTemplate = {
  week: number;
  title: string;
  focus: string;
  volume: VolumeLevel;
  notes: string[];
};

export type AcwrValidationResult =
  | { ok: false; message: string }
  | { ok: true; message: string; highValue: number; lowValue: number };

// ---------------------------------------------------------------------------
// Base templates by age band
// ---------------------------------------------------------------------------

export const basePlans: Record<(typeof ageBands)[number], WeekTemplate[]> = {
  "06-08": [
    {
      week: 1,
      title: "Base lúdica",
      focus: "Coordenação, brincadeiras e jogos simples",
      volume: "baixo",
      notes: ["Bola leve, rede baixa", "1x1 e 2x2"],
    },
    {
      week: 2,
      title: "Fundamentos",
      focus: "Toque, manchete e controle básico",
      volume: "médio",
      notes: ["Series curtas", "Feedback simples"],
    },
    {
      week: 3,
      title: "Jogo reduzido",
      focus: "Cooperação e tomada de decisão",
      volume: "médio",
      notes: ["Jogos 2x2/3x3", "Regras simples"],
    },
    {
      week: 4,
      title: "Recuperação",
      focus: "Revisão e prazer pelo jogo",
      volume: "baixo",
      notes: ["Menos repetições", "Mais variação"],
    },
  ],

  "09-11": [
    {
      week: 1,
      title: "Base técnica",
      focus: "Fundamentos e controle de bola",
      volume: "médio",
      notes: ["2-3 sessões/semana", "Equilíbrio e core"],
    },
    {
      week: 2,
      title: "Tomada de decisão",
      focus: "Leitura simples de jogo e cooperação",
      volume: "médio",
      notes: ["Jogos condicionados", "Ritmo moderado"],
    },
    {
      week: 3,
      title: "Intensidade controlada",
      focus: "Velocidade e saltos com controle",
      volume: "alto",
      notes: ["Monitorar saltos", "Pausas ativas"],
    },
    {
      week: 4,
      title: "Recuperação",
      focus: "Técnica leve e prevenção",
      volume: "baixo",
      notes: ["Volleyveilig simples", "Mobilidade"],
    },
  ],

  "12-14": [
    {
      week: 1,
      title: "Base técnica",
      focus: "Refino de fundamentos e posição",
      volume: "médio",
      notes: ["Sessões 60-90 min", "Ritmo controlado"],
    },
    {
      week: 2,
      title: "Potência controlada",
      focus: "Salto, deslocamento e reação",
      volume: "alto",
      notes: ["Pliometria leve", "Força 50-70% 1RM"],
    },
    {
      week: 3,
      title: "Sistema de jogo",
      focus: "Transicao defesa-ataque e 4x4/6x6",
      volume: "alto",
      notes: ["Leitura de bloqueio", "Decisao rapida"],
    },
    {
      week: 4,
      title: "Recuperação",
      focus: "Prevenção e consolidação técnica",
      volume: "baixo",
      notes: ["Volleyveilig completo", "Menos saltos"],
    },
  ],
};

// ---------------------------------------------------------------------------
// Age band helpers
// ---------------------------------------------------------------------------

export const resolvePlanBand = (value: string): (typeof ageBands)[number] => {
  const range = parseAgeBandRange(value);
  if (!Number.isFinite(range.end)) return "09-11";
  if (range.end <= 8) return "06-08";
  if (range.end <= 11) return "09-11";
  return "12-14";
};

export const getPhysicalFocus = (band: (typeof ageBands)[number]) => {
  if (band === "06-08") return "Coordenação e equilíbrio";
  if (band === "09-11") return "Força leve e agilidade";
  return "Potência controlada";
};

export const getMvFormat = (band: (typeof ageBands)[number]) => {
  if (band === "06-08") return "1x1/2x2";
  if (band === "09-11") return "2x2/3x3";
  return "4x4/6x6";
};

export const getMvLevel = (mvLevel: string, band: (typeof ageBands)[number]) => {
  if (mvLevel && mvLevel.trim()) return mvLevel;
  if (band === "06-08") return "MV1";
  if (band === "09-11") return "MV2";
  return "MV3";
};

export const getJumpTarget = (mvLevel: string, band: (typeof ageBands)[number]) => {
  const level = getMvLevel(mvLevel, band);
  if (level === "MV1") return "10-20";
  if (level === "MV2") return "20-40";
  return "30-60";
};

// ---------------------------------------------------------------------------
// Phase / PSE / Volume calculators
// ---------------------------------------------------------------------------

export const getPhaseForWeek = (
  weekNumber: number,
  cycleLength: number,
  model: PeriodizationModel = "competitivo",
  sport: SportProfile = "voleibol"
) => {
  if (model === "iniciacao") {
    if (sport === "funcional") {
      const chunk = Math.max(1, Math.ceil(cycleLength / 3));
      if (weekNumber <= chunk) return "Coordenação geral";
      if (weekNumber <= chunk * 2) return "Padrões básicos";
      return "Consolidação funcional";
    }
    const chunk = Math.max(1, Math.ceil(cycleLength / 3));
    if (weekNumber <= chunk) return "Exploração motora";
    if (weekNumber <= chunk * 2) return "Fundamentos básicos";
    return "Consolidação lúdica";
  }

  if (model === "formacao") {
    if (sport === "futebol") {
      const chunk = Math.max(1, Math.ceil(cycleLength / 3));
      if (weekNumber <= chunk) return "Base técnica";
      if (weekNumber <= chunk * 2) return "Desenvolvimento tático";
      return "Integração de jogo";
    }
    if (sport === "basquete") {
      const chunk = Math.max(1, Math.ceil(cycleLength / 3));
      if (weekNumber <= chunk) return "Fundamentos de quadra";
      if (weekNumber <= chunk * 2) return "Tomada de decisão";
      return "Integração coletiva";
    }
    const chunk = Math.max(1, Math.ceil(cycleLength / 3));
    if (weekNumber <= chunk) return "Base técnica";
    if (weekNumber <= chunk * 2) return "Desenvolvimento técnico";
    return "Integração tática";
  }

  if (sport !== "voleibol") {
    const chunk = Math.max(1, Math.ceil(cycleLength / 3));
    if (weekNumber <= chunk) return "Base";
    if (weekNumber <= chunk * 2)
      return sport === "funcional" ? "Progressão funcional" : "Desenvolvimento";
    return sport === "funcional" ? "Consolidação" : "Competição";
  }

  if (cycleLength >= 9) {
    if (weekNumber <= 4) return "Base";
    if (weekNumber <= 8) return "Desenvolvimento";
    return "Consolidação";
  }

  const chunk = Math.max(1, Math.ceil(cycleLength / 3));
  if (weekNumber <= chunk) return "Base";
  if (weekNumber <= chunk * 2) return "Desenvolvimento";
  return "Consolidação";
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const getPSETarget = (
  phase: string,
  sessionsPerWeek = 2,
  sport: SportProfile = "voleibol"
) => {
  const normalized = normalizeText(phase).toLowerCase();

  const adjustByFrequency = (target: string) => {
    if (sessionsPerWeek > 1) return target;
    if (target === "6-7") return "5-6";
    if (target === "5-6") return "4-5";
    if (target === "4-5") return "3-4";
    return target;
  };

  if (normalized.includes("explor") || normalized.includes("ludic"))
    return adjustByFrequency("3-4");
  if (normalized.includes("fundamento")) return adjustByFrequency("4-5");
  if (normalized.includes("base tecnica")) return adjustByFrequency("4-5");
  if (
    normalized.includes("desenvolvimento tecnico") ||
    normalized.includes("integracao tatica")
  )
    return adjustByFrequency("5-6");

  if (phase === "Base") return adjustByFrequency("4-5");
  if (phase === "Desenvolvimento") return adjustByFrequency("5-6");

  const base = adjustByFrequency("6-7");
  if (sport === "funcional") {
    if (base === "6-7") return "5-6";
    if (base === "5-6") return "4-5";
  }
  return base;
};

export const getVolumeForModel = (
  volume: VolumeLevel,
  model: PeriodizationModel,
  sessionsPerWeek = 2,
  sport: SportProfile = "voleibol"
): VolumeLevel => {
  if (model === "iniciacao") {
    if (sessionsPerWeek <= 1 && volume !== "baixo") return "baixo";
    if (volume === "alto") return "médio";
    if (sport === "funcional" && volume === "médio") return "baixo";
    return volume;
  }
  if (model === "formacao") {
    if (sessionsPerWeek <= 1 && volume === "alto") return "médio";
    if (sport === "funcional" && volume === "alto") return "médio";
    return volume;
  }
  if (sport === "funcional" && volume === "alto") return "médio";
  return volume;
};

export const getVolumeFromTargets = (phase: string, rpeTarget: string): VolumeLevel => {
  const normalizedRpe = normalizeText(rpeTarget).toLowerCase();
  const normalizedPhase = normalizeText(phase).toLowerCase();
  if (
    normalizedRpe.includes("6-7") ||
    normalizedRpe.includes("6 a 7") ||
    normalizedPhase.includes("pre-compet") ||
    normalizedPhase.includes("pre compet")
  ) {
    return "alto";
  }
  if (
    normalizedRpe.includes("5-6") ||
    normalizedRpe.includes("5 a 6") ||
    normalizedPhase.includes("desenvolvimento")
  ) {
    return "médio";
  }
  return "baixo";
};

// ---------------------------------------------------------------------------
// ACWR validation
// ---------------------------------------------------------------------------

export const validateAcwrLimits = (next: {
  high: string;
  low: string;
}): AcwrValidationResult => {
  const highValue = Number(next.high);
  const lowValue = Number(next.low);

  if (!Number.isFinite(highValue) || !Number.isFinite(lowValue)) {
    return { ok: false, message: "Informe limites válidos para o ACWR." };
  }
  if (highValue <= 0 || lowValue <= 0) {
    return { ok: false, message: "Limites do ACWR devem ser maiores que zero." };
  }
  if (lowValue >= highValue) {
    return { ok: false, message: "O limite baixo deve ser menor que o limite alto." };
  }
  return { ok: true, message: "", highValue, lowValue };
};

// ---------------------------------------------------------------------------
// ClassPlan builder — single week
// ---------------------------------------------------------------------------

export const buildClassPlan = (options: {
  classId: string;
  ageBand: (typeof ageBands)[number];
  startDate: string;
  weekNumber: number;
  source: "AUTO" | "MANUAL";
  mvLevel: string;
  cycleLength: number;
  model: PeriodizationModel;
  sessionsPerWeek: number;
  sport: SportProfile;
}): ClassPlan => {
  const base = basePlans[options.ageBand] ?? basePlans["09-11"];
  const template = base[(options.weekNumber - 1) % base.length];
  const phase = getPhaseForWeek(
    options.weekNumber,
    options.cycleLength ?? 12,
    options.model,
    options.sport
  );
  const createdAt = new Date().toISOString();

  return {
    id: `cp_${options.classId}_${Date.now()}_${options.weekNumber}`,
    classId: options.classId,
    startDate: options.startDate,
    weekNumber: options.weekNumber,
    phase,
    theme: template.focus,
    technicalFocus: template.focus,
    physicalFocus: getPhysicalFocus(options.ageBand),
    constraints: template.notes[0] ?? "",
    mvFormat: getMvFormat(options.ageBand),
    warmupProfile: template.notes[1] ?? "",
    jumpTarget: getJumpTarget(options.mvLevel, options.ageBand),
    rpeTarget: getPSETarget(phase, options.sessionsPerWeek, options.sport),
    source: options.source,
    createdAt,
    updatedAt: createdAt,
  };
};

// ---------------------------------------------------------------------------
// Cycle generator — full set of weeks
// ---------------------------------------------------------------------------

export const toClassPlans = (options: {
  classId: string;
  ageBand: (typeof ageBands)[number];
  cycleLength: number;
  startDate: string;
  mvLevel: string;
  model: PeriodizationModel;
  sessionsPerWeek: number;
  sport: SportProfile;
}): ClassPlan[] =>
  Array.from({ length: options.cycleLength }).map((_, index) =>
    buildClassPlan({
      classId: options.classId,
      ageBand: options.ageBand,
      startDate: options.startDate,
      weekNumber: index + 1,
      source: "AUTO",
      mvLevel: options.mvLevel,
      cycleLength: options.cycleLength,
      model: options.model,
      sessionsPerWeek: options.sessionsPerWeek,
      sport: options.sport,
    })
  );
