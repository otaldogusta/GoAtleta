import { parseAgeBandRange } from "./age-band";
import type { ClassPlan } from "./models";
import {
  ageBands,
  isAnnualCycle,
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

type AnnualPhaseTemplate = {
  id: string;
  title: string;
  durationWeeks: number;
  phase: string;
  technicalFocus: string;
  physicalFocus: string;
  rpeTarget: string;
  notes: string[];
  warmupProfile?: string;
  jumpTarget?: string;
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

const annualVolleyballPlans: Record<(typeof ageBands)[number], AnnualPhaseTemplate[]> = {
  "06-08": [
    {
      id: "exploracao_motora",
      title: "Exploração motora",
      durationWeeks: 8,
      phase: "Base",
      technicalFocus: "Coordenação geral, manipulação de bola e jogos simples",
      physicalFocus: "Equilíbrio, base postural e deslocamentos básicos",
      rpeTarget: "3-4",
      notes: ["Aprendizagem lúdica", "Regras simples e cooperação"],
      warmupProfile: "Circuitos leves com bola e deslocamentos",
    },
    {
      id: "fundamentos_ludicos",
      title: "Fundamentos lúdicos",
      durationWeeks: 8,
      phase: "Base",
      technicalFocus: "Toque, manchete e controle básico com alvos grandes",
      physicalFocus: "Coordenação fina e estabilidade dinâmica",
      rpeTarget: "4-5",
      notes: ["Feedback simples", "Séries curtas e sucesso frequente"],
      warmupProfile: "Ativação com brincadeiras e alvos",
    },
    {
      id: "controle_bola",
      title: "Controle de bola",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Continuidade de toques e controle em dupla/trio",
      physicalFocus: "Agilidade leve e ritmo de execução",
      rpeTarget: "4-5",
      notes: ["Sequências de 2-3 contatos", "Progressão com alvos simples"],
      warmupProfile: "Coordenação com bolas leves",
    },
    {
      id: "jogos_reduzidos",
      title: "Jogos reduzidos",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "1x1, 2x2 e ocupação básica de espaço",
      physicalFocus: "Reação e deslocamento em espaço reduzido",
      rpeTarget: "4-5",
      notes: ["Transferência para o jogo", "Cooperação e tomada de decisão simples"],
      warmupProfile: "Jogos de entrada com bola",
    },
    {
      id: "integracao_basica",
      title: "Integração básica",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Manter continuidade e escolher a melhor solução simples",
      physicalFocus: "Agilidade perceptiva e coordenação global",
      rpeTarget: "4-5",
      notes: ["Comunicação básica", "Decisão rápida com baixa pressão"],
      warmupProfile: "Aquecimento com reação e leitura visual",
    },
    {
      id: "consolidacao_ludica",
      title: "Consolidação lúdica",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Revisão dos fundamentos e jogos adaptados de fechamento",
      physicalFocus: "Manutenção coordenativa com recuperação leve",
      rpeTarget: "3-4",
      notes: ["Consolidar o ano", "Fechamento com alta aderência"],
      warmupProfile: "Ativação leve com desafios cooperativos",
    },
  ],
  "09-11": [
    {
      id: "exploracao_motora",
      title: "Exploração motora",
      durationWeeks: 8,
      phase: "Base",
      technicalFocus: "Controle de bola, toque e manchete em contexto lúdico",
      physicalFocus: "Coordenação geral, equilíbrio e base postural",
      rpeTarget: "3-4",
      notes: ["Adaptação ao ambiente", "Cooperação e regras simples"],
      warmupProfile: "Jogos motores e manipulação de bola",
    },
    {
      id: "fundamentos_basicos",
      title: "Fundamentos básicos",
      durationWeeks: 8,
      phase: "Base",
      technicalFocus: "Toque, manchete e saque adaptado com alvo simples",
      physicalFocus: "Coordenação e estabilidade dinâmica",
      rpeTarget: "4-5",
      notes: ["Repetibilidade técnica", "Contato limpo e postura"],
      warmupProfile: "Ativação com alvos e controle de bola",
    },
    {
      id: "consolidacao_tecnica",
      title: "Consolidação técnica",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Passe ao alvo, saque direcionado e levantamento simples",
      physicalFocus: "Agilidade, ritmo e coordenação sob controle",
      rpeTarget: "4-5",
      notes: ["Consistência e direção", "Sequências de 2-3 contatos"],
      warmupProfile: "Ativação específica de plataforma e toque",
    },
    {
      id: "jogos_reduzidos",
      title: "Jogos reduzidos",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "1x1, 2x2, 3x3 e continuidade com ocupação de espaço",
      physicalFocus: "Deslocamento e reação em espaço reduzido",
      rpeTarget: "4-5",
      notes: ["Transferência para o jogo", "Semanas baixas estratégicas"],
      warmupProfile: "Jogos condicionados de entrada",
    },
    {
      id: "tomada_decisao",
      title: "Tomada de decisão",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Leitura do jogo, ajuste de direção e comunicação",
      physicalFocus: "Agilidade perceptiva e recuperação curta",
      rpeTarget: "4-5",
      notes: ["Alvo livre", "Decidir entre manter vivo e acelerar"],
      warmupProfile: "Aquecimento com leitura e escolha",
    },
    {
      id: "integracao_tecnico_tatica",
      title: "Integração técnico-tática",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Jogo adaptado, combinações simples e revisão anual",
      physicalFocus: "Manutenção coordenativa e redução gradual da carga",
      rpeTarget: "3-4",
      notes: ["Fechamento do ano", "Autoavaliação e feedback"],
      warmupProfile: "Ativação leve com tarefas integradas",
    },
  ],
  "12-14": [
    {
      id: "base_tecnica",
      title: "Base técnica",
      durationWeeks: 8,
      phase: "Base",
      technicalFocus: "Refino de fundamentos, controle de bola e posição",
      physicalFocus: "Coordenação, força leve e aterrissagem",
      rpeTarget: "4-5",
      notes: ["Base estável", "Ritmo controlado"],
      warmupProfile: "Mobilidade e técnica com bola",
    },
    {
      id: "consolidacao_tecnica",
      title: "Consolidação técnica",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Passe ao alvo, saque direcionado e levantamento consistente",
      physicalFocus: "Agilidade e potência controlada",
      rpeTarget: "4-5",
      notes: ["Consistência e precisão", "Progressão de alvo"],
      warmupProfile: "Ativação específica por fundamento",
    },
    {
      id: "sistemas_de_jogo",
      title: "Sistemas de jogo",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Transição defesa-ataque, leitura e organização coletiva",
      physicalFocus: "Velocidade, salto controlado e reação",
      rpeTarget: "5-6",
      notes: ["4x4 e 6x6 adaptado", "Conexão entre setores"],
      warmupProfile: "Aquecimento com deslocamentos específicos",
    },
    {
      id: "tomada_decisao",
      title: "Tomada de decisão",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Escolha de solução, leitura do bloqueio e continuidade",
      physicalFocus: "Velocidade de reação e tolerância a repetições",
      rpeTarget: "5-6",
      notes: ["Pressão moderada", "Resolução em jogo reduzido"],
      warmupProfile: "Ativação com oposição leve",
    },
    {
      id: "integracao_tatica",
      title: "Integração tática",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Combinar fundamento e intenção tática em jogo adaptado",
      physicalFocus: "Potência controlada e recuperação monitorada",
      rpeTarget: "5-6",
      notes: ["Transferência para o jogo", "Maior complexidade"],
      warmupProfile: "Ativação curta e específica",
    },
    {
      id: "fechamento",
      title: "Fechamento anual",
      durationWeeks: 8,
      phase: "Desenvolvimento",
      technicalFocus: "Revisão anual, consolidação e autoavaliação",
      physicalFocus: "Manutenção com redução progressiva do volume",
      rpeTarget: "4-5",
      notes: ["Fechamento do ciclo", "Feedback e revisão"],
      warmupProfile: "Ativação leve com revisão técnica",
    },
  ],
};

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

const parseIsoDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoDate = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const addDays = (value: string, days: number) => {
  const base = parseIsoDate(value);
  if (!base) return value;
  return toIsoDate(new Date(base.getTime() + days * DAY_MS));
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

const getWeekStartDate = (startDate: string, weekNumber: number) =>
  addDays(startDate, Math.max(0, weekNumber - 1) * 7);

const fitTemplateToCycleLength = <T extends AnnualPhaseTemplate>(
  template: T[],
  cycleLength: number
) => {
  if (!template.length) return [] as T[];
  const safeLength = Math.max(template.length, cycleLength);
  const baseTotal = template.reduce((sum, item) => sum + Math.max(1, item.durationWeeks), 0);
  const scaled = template.map((item) => (Math.max(1, item.durationWeeks) / baseTotal) * safeLength);
  const rounded = scaled.map((value) => Math.max(1, Math.floor(value)));
  let diff = safeLength - rounded.reduce((sum, value) => sum + value, 0);

  const order = scaled
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder)
    .map((item) => item.index);

  let cursor = 0;
  while (diff !== 0 && cursor < 200) {
    const index = order[cursor % order.length] ?? 0;
    if (diff > 0) {
      rounded[index] += 1;
      diff -= 1;
    } else if (rounded[index] > 1) {
      rounded[index] -= 1;
      diff += 1;
    }
    cursor += 1;
  }

  return template.map((item, index) => ({
    ...item,
    durationWeeks: rounded[index] ?? item.durationWeeks,
  }));
};

const resolveAnnualTemplate = (options: {
  ageBand: (typeof ageBands)[number];
  model: PeriodizationModel;
  sport: SportProfile;
}) => {
  if (options.sport !== "voleibol") return null;
  if (options.model === "competitivo") return null;
  return annualVolleyballPlans[options.ageBand] ?? annualVolleyballPlans["09-11"];
};

const getAnnualPhaseForWeek = (options: {
  ageBand: (typeof ageBands)[number];
  cycleLength: number;
  weekNumber: number;
  model: PeriodizationModel;
  sport: SportProfile;
}) => {
  const template = resolveAnnualTemplate(options);
  if (!template?.length) return null;
  const fitted = fitTemplateToCycleLength(template, options.cycleLength);
  let cursor = 0;
  for (const phase of fitted) {
    cursor += phase.durationWeeks;
    if (options.weekNumber <= cursor) return phase;
  }
  return fitted[fitted.length - 1] ?? null;
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
  const startDate = getWeekStartDate(options.startDate, options.weekNumber);
  const phase = getPhaseForWeek(
    options.weekNumber,
    options.cycleLength ?? 12,
    options.model,
    options.sport
  );
  const createdAt = new Date().toISOString();

  if (isAnnualCycle(options.cycleLength)) {
    const annualPhase = getAnnualPhaseForWeek({
      ageBand: options.ageBand,
      cycleLength: options.cycleLength,
      weekNumber: options.weekNumber,
      model: options.model,
      sport: options.sport,
    });

    if (annualPhase) {
      return {
        id: `cp_${options.classId}_${Date.now()}_${options.weekNumber}`,
        classId: options.classId,
        startDate,
        weekNumber: options.weekNumber,
        phase: annualPhase.phase,
        theme: annualPhase.title,
        technicalFocus: annualPhase.technicalFocus,
        physicalFocus: annualPhase.physicalFocus,
        constraints: annualPhase.notes.join(" | "),
        mvFormat: getMvFormat(options.ageBand),
        warmupProfile: annualPhase.warmupProfile ?? annualPhase.notes[0] ?? "",
        jumpTarget: annualPhase.jumpTarget ?? getJumpTarget(options.mvLevel, options.ageBand),
        rpeTarget: annualPhase.rpeTarget,
        source: options.source,
        createdAt,
        updatedAt: createdAt,
      };
    }
  }

  return {
    id: `cp_${options.classId}_${Date.now()}_${options.weekNumber}`,
    classId: options.classId,
    startDate,
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

export const toAnnualClassPlans = (options: {
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
