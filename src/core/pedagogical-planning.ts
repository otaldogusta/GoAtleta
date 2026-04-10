import { parseAgeBandRange } from "./age-band";
import { inferSkillsFromText, progressionPlanToDraft, volleyballLessonPlanToDraft } from "./ai-operations";
import { resolveClassModality } from "./class-modality";
import type { ClassGroup, Student } from "./models";
import {
  buildNextSessionProgression,
  buildNextVolleyballLessonPlan,
  type PedagogicalProfile,
} from "./progression-engine";

export type PedagogicalObjective =
  | "controle_bola"
  | "passe"
  | "resistencia"
  | "jogo_reduzido";

export type PedagogicalConstraint = "sem_quadra" | "tempo_reduzido" | "espaco_limitado";

export type PedagogicalRestriction =
  | "evitar_impacto"
  | "evitar_corrida"
  | "limitacao_membro_inferior";

export type PedagogicalContext = "escolar" | "treinamento";

export type PedagogicalLevel = "baixo" | "medio" | "alto";

export type PlanningPhase = "base" | "desenvolvimento" | "pre_competitivo" | "competitivo";

export type PedagogicalHeterogeneity = "baixa" | "media" | "alta";

export type PlanningInput = {
  classGroup: ClassGroup;
  students?: Student[];
  objective: string;
  context?: PedagogicalContext;
  constraints?: string[];
  materials?: string[];
  duration: number;
  variationSeed?: number;
  periodizationPhase?: PlanningPhase;
  rpeTarget?: number;
  weekNumber?: number;
  dimensionGuidelines?: string[];
};

export type PlanningAnalysis = {
  level: PedagogicalLevel;
  heterogeneity: PedagogicalHeterogeneity;
  profile: PedagogicalProfile;
  hardConstraints: PedagogicalRestriction[];
  softConstraints: PedagogicalConstraint[];
  risks: PedagogicalRestriction[];
  constraintsImpact: string[];
};

export type PlanningRuleSource =
  | "seguranca"
  | "restricao"
  | "contexto"
  | "objetivo"
  | "nivel"
  | "heterogeneidade";

export type PedagogicalPlanBlockName = "aquecimento" | "principal" | "volta_calma";

export type PedagogicalActivity = {
  id: string;
  name: string;
  description: string;
};

export type PedagogicalPlanBlock = {
  name: PedagogicalPlanBlockName;
  duration: number;
  summary?: string;
  activities: PedagogicalActivity[];
};

export type PedagogicalAdaptation = {
  target: "grupo" | "aluno";
  studentId?: string;
  action: string;
  reason: string;
  source: "restricao_aluno" | "contexto" | "seguranca" | "heterogeneidade";
};

export type PedagogicalExplanation = {
  message: string;
  source: "objetivo" | "restricao" | "contexto" | "analise";
  appliedTo: PedagogicalPlanBlockName | "geral";
};

export type LessonPlanDraft = {
  objective: PedagogicalObjective;
  warmup: PedagogicalPlanBlock;
  main: PedagogicalPlanBlock;
  cooldown: PedagogicalPlanBlock;
  variations: string[];
  adaptations: PedagogicalAdaptation[];
  explanations: PedagogicalExplanation[];
  manualReviewFlags: string[];
};

export type LessonPlanGenerated = LessonPlanDraft & {
  generatedAt: string;
  engineVersion: string;
  basePlanKind: "progression" | "volleyball";
};

export type LessonPlanFinal = LessonPlanGenerated & {
  edited: boolean;
  finalizedAt: string;
};

export type PedagogicalPlanPackage = {
  input: PlanningInput;
  analysis: PlanningAnalysis;
  draft: LessonPlanDraft;
  generated: LessonPlanGenerated;
  final: LessonPlanFinal;
};

export type PlanningRuleContext = {
  input: PlanningInput;
  analysis: PlanningAnalysis;
  draft: LessonPlanDraft;
};

export type PlanningRule = {
  id: string;
  priority: number;
  source: PlanningRuleSource;
  reason: string;
  condition: (ctx: PlanningRuleContext) => boolean;
  apply: (draft: LessonPlanDraft, ctx: PlanningRuleContext) => void;
};

const ENGINE_VERSION = "pedagogical-plan.v1";

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const unique = <T,>(values: T[]) => [...new Set(values)];

const hasAny = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseMinutesLabel = (value: string | null | undefined) => {
  const match = String(value ?? "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 0;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const isTechnicalPlanningKey = (value: string | null | undefined) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return /^[a-z0-9]+(?:_[a-z0-9]+){2,}$/i.test(text) || /(?:^|_)vwv(?:_|$)/i.test(text);
};

const cleanPlanningText = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withoutMinutes = raw.replace(/^\s*\d+\s*min(?:utos?)?\s*[-•:]?\s*/i, "").trim();
  if (!withoutMinutes || isTechnicalPlanningKey(withoutMinutes)) {
    return "";
  }
  return withoutMinutes;
};

const buildActivityList = (items: string[], prefix: string): PedagogicalActivity[] =>
  items
    .map((item, index) => {
      const text = cleanPlanningText(item);
      if (!text) return null;
      return {
        id: `${prefix}_${index + 1}`,
        name: text,
        description: text,
      };
    })
    .filter((item): item is PedagogicalActivity => Boolean(item));

const buildBlock = (
  name: PedagogicalPlanBlockName,
  duration: number,
  items: string[],
  prefix: string
): PedagogicalPlanBlock => {
  const activities = buildActivityList(items, prefix);
  return {
    name,
    duration: Math.max(1, Math.round(duration)),
    summary: activities[0]?.description || activities[0]?.name || undefined,
    activities,
  };
};

const scaleDurations = (values: number[], totalDuration: number) => {
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (!sum || !Number.isFinite(totalDuration) || totalDuration <= 0) return values;

  const scaled = values.map((value) => (value / sum) * totalDuration);
  const rounded = scaled.map((value) => Math.max(1, Math.round(value)));
  let diff = totalDuration - rounded.reduce((acc, value) => acc + value, 0);

  const order = [1, 0, 2];
  let cursor = 0;
  while (diff !== 0 && cursor < 24) {
    const index = order[cursor % order.length];
    if (diff > 0) {
      rounded[index] += 1;
      diff -= 1;
    } else if (rounded[index] > 1) {
      rounded[index] -= 1;
      diff += 1;
    }
    cursor += 1;
  }
  return rounded;
};

const seededIndex = (seed: number, size: number) => {
  if (size <= 0) return 0;
  const value = Math.abs(seed);
  return value % size;
};

const applyVariationSeed = (draft: LessonPlanDraft, seed: number) => {
  const rotate = (items: PedagogicalActivity[]) => {
    if (items.length <= 1) return items;
    const offset = seededIndex(seed, items.length);
    if (!offset) return items;
    return [...items.slice(offset), ...items.slice(0, offset)];
  };

  draft.warmup.activities = rotate(draft.warmup.activities);
  draft.main.activities = rotate(draft.main.activities);
  draft.cooldown.activities = rotate(draft.cooldown.activities);

  draft.warmup.summary = draft.warmup.activities[0]?.description || draft.warmup.summary;
  draft.main.summary = draft.main.activities[0]?.description || draft.main.summary;
  draft.cooldown.summary =
    draft.cooldown.activities[0]?.description || draft.cooldown.summary;

  draft.variations.push("Nova variação gerada para este plano.");
};

export const normalizePedagogicalObjective = (value: string | null | undefined): PedagogicalObjective => {
  const text = normalizeText(value);
  if (!text) return "controle_bola";
  if (hasAny(text, ["resist", "condicion", "endurance", "stamina"])) return "resistencia";
  if (hasAny(text, ["jogo", "reduz", "transfer", "condicion"])) return "jogo_reduzido";
  if (hasAny(text, ["passe", "recep", "manchete"])) return "passe";
  return "controle_bola";
};

const inferStudentRestrictions = (student: Student): PedagogicalRestriction[] => {
  const text = normalizeText(
    [student.healthIssueNotes, student.medicationNotes, student.healthObservations].filter(Boolean).join(" ")
  );
  const restrictions: PedagogicalRestriction[] = [];

  if (student.healthIssue || hasAny(text, ["dor", "lesao", "injury", "cirurg", "sintoma"])) {
    restrictions.push("evitar_impacto");
  }
  if (hasAny(text, ["corrid", "salto", "impacto", "pouso", "arranc"])) {
    restrictions.push("evitar_corrida");
  }
  if (hasAny(text, ["joelho", "tornoz", "pe ", " pe", "quadril", "perna", "membro inferior"])) {
    restrictions.push("limitacao_membro_inferior");
  }

  return unique(restrictions);
};

const inferSoftConstraints = (input: PlanningInput): PedagogicalConstraint[] => {
  const text = normalizeText([...(input.constraints ?? []), input.classGroup.goal, input.classGroup.equipment].join(" "));
  const constraints: PedagogicalConstraint[] = [];

  if (input.duration <= 45 || hasAny(text, ["tempo", "curto", "reduzido"])) {
    constraints.push("tempo_reduzido");
  }
  if (hasAny(text, ["espaco", "espaco limitado", "aperto", "pequeno"]) || input.classGroup.equipment !== "quadra") {
    constraints.push("espaco_limitado");
  }
  if (hasAny(text, ["sem quadra", "sem quadra fixa"])) {
    constraints.push("sem_quadra");
  }

  return unique(constraints);
};

const inferLevel = (input: PlanningInput, hardConstraints: PedagogicalRestriction[]) => {
  const ageRange = parseAgeBandRange(input.classGroup.ageBand);
  const studentCount = input.students?.length ?? 0;
  const objectiveText = normalizeText([input.objective, input.classGroup.goal].join(" "));
  const hasRendimento = (input.students ?? []).some((student) => student.athleteObjective === "rendimento");

  let score = input.classGroup.level;
  if (ageRange.end <= 8) score -= 0.3;
  if (ageRange.end >= 14) score += 0.1;
  if (studentCount >= 10) score += 0.1;
  if (hasAny(objectiveText, ["performance", "rendimento", "compet"])) score += 0.4;
  if (hasAny(objectiveText, ["base", "fundament", "ludic"])) score -= 0.15;
  if (hasRendimento) score += 0.2;
  if (hardConstraints.length) score -= 0.25;
  if (input.periodizationPhase === "competitivo") score += 0.3;
  if (input.periodizationPhase === "pre_competitivo") score += 0.15;
  if (input.periodizationPhase === "base") score -= 0.2;

  if (score < 1.4) return "baixo" as const;
  if (score < 2.4) return "medio" as const;
  return "alto" as const;
};

const resolvePedagogicalProfile = (input: PlanningInput): PedagogicalProfile => {
  const ageRange = parseAgeBandRange(input.classGroup.ageBand);
  const endAge = Number.isFinite(ageRange.end) ? ageRange.end : 0;
  if (endAge && endAge <= 11) return "fundamental";
  if (endAge && endAge <= 15) return "transicao";
  if (input.classGroup.level <= 1) return "fundamental";
  if (input.classGroup.level === 2) return "transicao";
  return "especializacao";
};

const inferHeterogeneity = (input: PlanningInput) => {
  const students = input.students ?? [];
  if (!students.length) return "baixa" as const;

  const ages = students.map((student) => student.age).filter((age) => Number.isFinite(age));
  const minAge = ages.length ? Math.min(...ages) : input.classGroup.level;
  const maxAge = ages.length ? Math.max(...ages) : input.classGroup.level;
  const ageSpread = maxAge - minAge;
  const objectives = new Set(students.map((student) => student.athleteObjective));
  const styles = new Set(students.map((student) => student.learningStyle));
  const positions = new Set(
    students.map((student) => `${student.positionPrimary}:${student.positionSecondary}`)
  );

  if (ageSpread >= 4 || objectives.size >= 3 || styles.size >= 3 || positions.size >= 5) {
    return "alta" as const;
  }
  if (ageSpread >= 2 || objectives.size >= 2 || styles.size >= 2 || positions.size >= 3) {
    return "media" as const;
  }
  return "baixa" as const;
};

export const analyzePlanningInput = (input: PlanningInput): PlanningAnalysis => {
  const allRestrictions = unique((input.students ?? []).flatMap((student) => inferStudentRestrictions(student)));
  const softConstraints = inferSoftConstraints(input);
  const level = inferLevel(input, allRestrictions);
  const profile = resolvePedagogicalProfile(input);
  const heterogeneity = inferHeterogeneity(input);

  const risks: PedagogicalRestriction[] = unique([
    ...allRestrictions,
    ...((input.students ?? []).some((student) => student.healthIssue)
      ? (["evitar_impacto"] as PedagogicalRestriction[])
      : []),
  ]);

  const constraintsImpact: string[] = [];
  if (allRestrictions.length) {
    constraintsImpact.push(`${allRestrictions.length} restrição(ões) de saúde detectada(s).`);
  }
  if (softConstraints.length) {
    constraintsImpact.push(`${softConstraints.length} restrição(ões) de contexto detectada(s).`);
  }
  if (heterogeneity === "alta") {
    constraintsImpact.push("Turma heterogênea exige variação e revisão manual.");
  }

  return {
    level,
    heterogeneity,
    profile,
    hardConstraints: allRestrictions,
    softConstraints,
    risks,
    constraintsImpact,
  };
};

const buildSyntheticSnapshot = (input: PlanningInput, analysis: PlanningAnalysis) => {
  const notes = (input.students ?? [])
    .flatMap((student) => [student.healthIssueNotes, student.medicationNotes, student.healthObservations])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 6);

  const base = analysis.level === "alto" ? 0.84 : analysis.level === "medio" ? 0.62 : 0.44;
  const heterogeneityPenalty = analysis.heterogeneity === "alta" ? 0.18 : analysis.heterogeneity === "media" ? 0.08 : 0;
  const restrictionPenalty = analysis.hardConstraints.length ? 0.1 : 0;

  return {
    consistencyScore: clamp(base - heterogeneityPenalty - restrictionPenalty, 0.2, 0.95),
    successRate: clamp(base + 0.04 - restrictionPenalty, 0.2, 0.96),
    decisionQuality: clamp(base - heterogeneityPenalty + 0.06, 0.2, 0.96),
    notes,
  };
};

type BasePlanDraft = {
  kind: "progression" | "volleyball";
  raw: unknown;
  title: string;
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: number;
  mainTime: number;
  cooldownTime: number;
};

const adjustRpeByPhase = (rpe: number, phase?: PlanningPhase): number => {
  if (!phase) return rpe;
  const deltas: Record<PlanningPhase, number> = {
    base: -1,
    desenvolvimento: 0,
    pre_competitivo: 1,
    competitivo: 2,
  };
  return Math.max(3, Math.min(10, rpe + deltas[phase]));
};

const buildBasePlan = (input: PlanningInput, analysis: PlanningAnalysis): BasePlanDraft => {
  const classModality = resolveClassModality(input.classGroup.modality);
  const objectiveText = [input.objective, input.classGroup.goal, ...(input.students ?? []).map((student) => student.healthObservations)]
    .filter(Boolean)
    .join(" ");
  const focusSkills = inferSkillsFromText(objectiveText);
  const syntheticSnapshot = buildSyntheticSnapshot(input, analysis);

  if (classModality === "voleibol") {
    const raw = buildNextVolleyballLessonPlan({
      classId: input.classGroup.id,
      unitId: input.classGroup.unitId,
      className: input.classGroup.name,
      objective: input.objective || input.classGroup.goal,
      focusSkills,
      pedagogicalProfile: analysis.profile,
      previousSnapshot: syntheticSnapshot,
      lastRpeGroup: input.rpeTarget != null
        ? Math.max(3, Math.min(10, input.rpeTarget))
        : adjustRpeByPhase(
            input.students?.length ? Math.min(10, Math.max(4, Math.round(input.students.length / 2) + 4)) : 6,
            input.periodizationPhase
          ),
      lastAttendanceCount: input.students?.length ?? 0,
    });
    const draft = volleyballLessonPlanToDraft(raw, input.classGroup.name);
    return {
      kind: "volleyball",
      raw,
      title: draft.title,
      warmup: draft.warmup,
      main: draft.main,
      cooldown: draft.cooldown,
      warmupTime: parseMinutesLabel(draft.warmupTime),
      mainTime: parseMinutesLabel(draft.mainTime),
      cooldownTime: parseMinutesLabel(draft.cooldownTime),
    };
  }

  const raw = buildNextSessionProgression({
    className: input.classGroup.name,
    objective: input.objective || input.classGroup.goal,
    focusSkills,
    pedagogicalProfile: analysis.profile,
    previousSnapshot: syntheticSnapshot,
  });
  const draft = progressionPlanToDraft(raw, input.classGroup.name);
  return {
    kind: "progression",
    raw,
    title: draft.title,
    warmup: draft.warmup,
    main: draft.main,
    cooldown: draft.cooldown,
    warmupTime: parseMinutesLabel(draft.warmupTime),
    mainTime: parseMinutesLabel(draft.mainTime),
    cooldownTime: parseMinutesLabel(draft.cooldownTime),
  };
};

const buildPlanningRules = (): PlanningRule[] => [
  {
    id: "safety-hard-constraints",
    priority: 1,
    source: "seguranca",
    reason: "Ajuste de segurança por restrições de saúde",
    condition: (ctx) => ctx.analysis.hardConstraints.length > 0,
    apply: (draft, ctx) => {
      const highRisk = ctx.analysis.hardConstraints.includes("evitar_impacto");
      draft.adaptations.push({
        target: "grupo",
        action: highRisk
          ? "Reduzir impacto, saltos e corrida intensa."
          : "Priorizar tarefas com controle e menor exigência física.",
        reason: "restrições de saúde identificadas na turma.",
        source: "seguranca",
      });
      draft.manualReviewFlags.push("Revisar restrições individuais antes da aplicação.");
    },
  },
  {
    id: "student-specific-restrictions",
    priority: 2,
    source: "restricao",
    reason: "Ajustes individualizados por aluno",
    condition: (ctx) => (ctx.input.students ?? []).some((student) => inferStudentRestrictions(student).length > 0),
    apply: (draft, ctx) => {
      (ctx.input.students ?? []).forEach((student) => {
        const restrictions = inferStudentRestrictions(student);
        if (!restrictions.length) return;
        restrictions.forEach((restriction) => {
          draft.adaptations.push({
            target: "aluno",
            studentId: student.id,
            action:
              restriction === "limitacao_membro_inferior"
                ? "Evitar corrida longa e tarefas com salto."
                : restriction === "evitar_corrida"
                  ? "Reduzir deslocamentos prolongados."
                  : "Usar atividades de menor impacto."
            ,
            reason: `restrição individual: ${restriction}.`,
            source: "restricao_aluno",
          });
        });
      });
    },
  },
  {
    id: "context-school",
    priority: 3,
    source: "contexto",
    reason: "Contexto escolar pede estrutura mais clara e inclusiva",
    condition: (ctx) => ctx.input.context === "escolar",
    apply: (draft) => {
      draft.explanations.push({
        message: "Contexto escolar: manter instruções curtas, rodízios claros e critérios visíveis.",
        source: "contexto",
        appliedTo: "geral",
      });
      draft.manualReviewFlags.push("Checar tempo real de transição entre atividades.");
    },
  },
  {
    id: "periodization-phase",
    priority: 3.5,
    source: "contexto",
    reason: "Ajuste de carga e complexidade pela fase de periodização",
    condition: (ctx) => Boolean(ctx.input.periodizationPhase),
    apply: (draft, ctx) => {
      const phase = ctx.input.periodizationPhase!;
      const rpe = ctx.input.rpeTarget;
      const week = ctx.input.weekNumber;
      const weekLabel = week != null ? ` (semana ${week})` : "";

      if (phase === "base") {
        draft.variations.push("Priorizar repetições guiadas com feedback frequente.");
        draft.variations.push("Manter intensidade baixa a moderada — foco em aquisição técnica.");
        draft.adaptations.push({
          target: "grupo",
          action: "Reduzir complexidade tática e aumentar tempo de prática individual.",
          reason: `fase base${weekLabel}: construção de fundamentos.`,
          source: "contexto",
        });
        draft.explanations.push({
          message: `Fase base${weekLabel}: priorizar volume técnico, menor intensidade${rpe != null ? `, RPE alvo ${rpe}` : ""}.`,
          source: "contexto",
          appliedTo: "geral",
        });
      } else if (phase === "desenvolvimento") {
        draft.variations.push("Progressão gradual de complexidade — combinar técnica e tática.");
        draft.adaptations.push({
          target: "grupo",
          action: "Introduzir desafios crescentes mantendo controle de erro.",
          reason: `fase desenvolvimento${weekLabel}: consolidação e progressão.`,
          source: "contexto",
        });
        draft.explanations.push({
          message: `Fase desenvolvimento${weekLabel}: aumentar complexidade progressivamente${rpe != null ? `, RPE alvo ${rpe}` : ""}.`,
          source: "contexto",
          appliedTo: "geral",
        });
      } else if (phase === "pre_competitivo") {
        draft.variations.push("Aumentar representatividade — situações próximas do jogo real.");
        draft.adaptations.push({
          target: "grupo",
          action: "Priorizar decisão sob pressão e especificidade da modalidade.",
          reason: `fase pré-competitiva${weekLabel}: transferência para situação real.`,
          source: "contexto",
        });
        draft.explanations.push({
          message: `Fase pré-competitiva${weekLabel}: especificidade crescente, reduzir volume${rpe != null ? `, RPE alvo ${rpe}` : ""}.`,
          source: "contexto",
          appliedTo: "geral",
        });
      } else if (phase === "competitivo") {
        draft.variations.push("Especificidade máxima — tarefas com oposição real e tomada de decisão.");
        draft.variations.push("Reduzir volume total e manter alta intensidade.");
        draft.adaptations.push({
          target: "grupo",
          action: "Manter frescor físico e foco mental — evitar fadiga acumulada.",
          reason: `fase competitiva${weekLabel}: desempenho máximo.`,
          source: "contexto",
        });
        draft.explanations.push({
          message: `Fase competitiva${weekLabel}: alto rendimento, volume baixo${rpe != null ? `, RPE alvo ${rpe}` : ""}.`,
          source: "contexto",
          appliedTo: "principal",
        });
        draft.manualReviewFlags.push("Fase competitiva: conferir carga acumulada antes de aplicar.");
      }
    },
  },
  {
    id: "dimension-guidelines",
    priority: 4.2,
    source: "contexto",
    reason: "Diretrizes pedagógicas derivadas do perfil dimensional da turma",
    condition: (ctx) => (ctx.input.dimensionGuidelines?.length ?? 0) > 0,
    apply: (draft, ctx) => {
      (ctx.input.dimensionGuidelines ?? []).forEach((guideline) => {
        draft.explanations.push({
          message: guideline,
          source: "analise",
          appliedTo: "geral",
        });
      });
    },
  },
  {
    id: "objective-focus",
    priority: 4,
    source: "objetivo",
    reason: "Ajuste das atividades pelo objetivo da aula",
    condition: () => true,
    apply: (draft, ctx) => {
      const objective = ctx.input.objective || ctx.input.classGroup.goal;
      const normalized = normalizePedagogicalObjective(objective);

      draft.explanations.push({
        message: `Objetivo normalizado: ${normalized}.`,
        source: "objetivo",
        appliedTo: "principal",
      });

      if (normalized === "controle_bola") {
        draft.main.activities.unshift({
          id: "objective_control_ball",
          name: "Controle de bola",
          description: "Sequência de manipulação com foco em precisão e domínio.",
        });
      } else if (normalized === "passe") {
        draft.main.activities.unshift({
          id: "objective_pass",
          name: "Passe orientado",
          description: "Tarefas de passe com alvo e ajuste de contato.",
        });
      } else if (normalized === "resistencia") {
        draft.main.activities.unshift({
          id: "objective_endurance",
          name: "Resistência sustentada",
          description: "Bloco contínuo com controle de ritmo e pausas programadas.",
        });
      } else if (normalized === "jogo_reduzido") {
        draft.main.activities.unshift({
          id: "objective_reduced_game",
          name: "Jogo reduzido",
          description: "Ambiente condicionado para transferência e decisão.",
        });
      }
    },
  },
  {
    id: "pedagogical-profile",
    priority: 4.5,
    source: "contexto",
    reason: "Ajustes pedagógicos por faixa etária e perfil",
    condition: () => true,
    apply: (draft, ctx) => {
      if (ctx.analysis.profile === "fundamental") {
        draft.variations.push("Metas curtas com sucesso frequente (2-3 repetições).");
        draft.variations.push("Jogos cooperativos e alvos maiores para manter engajamento.");
        draft.explanations.push({
          message: "Perfil fundamental: priorizar exploração, ludicidade e feedback positivo.",
          source: "contexto",
          appliedTo: "geral",
        });
        draft.manualReviewFlags.push("Revisar critérios para garantir sucesso rápido e alta rotação.");
      } else if (ctx.analysis.profile === "transicao") {
        draft.variations.push("Equilibrar repetição técnica com jogos reduzidos.");
        draft.variations.push("Metas moderadas com progressão gradual de complexidade.");
        draft.explanations.push({
          message: "Perfil de transição: combinar técnica guiada e desafios controlados.",
          source: "contexto",
          appliedTo: "geral",
        });
      } else {
        draft.variations.push("Manter metas de consistência e controle de erro.");
        draft.explanations.push({
          message: "Perfil de especialização: foco em consistência, tomada de decisão e precisão.",
          source: "contexto",
          appliedTo: "geral",
        });
      }
    },
  },
  {
    id: "level-adjustment",
    priority: 5,
    source: "nivel",
    reason: "Ajuste por nível estimado da turma",
    condition: (ctx) => ctx.analysis.level !== "medio",
    apply: (draft, ctx) => {
      if (ctx.analysis.level === "baixo") {
        draft.variations.push("Simplificar tarefa e ampliar demonstração guiada.");
        draft.manualReviewFlags.push("Nível baixo: reduzir complexidade se o grupo travar.");
      } else {
        draft.variations.push("Adicionar desafio técnico e tomar decisão sob pressão.");
      }
    },
  },
  {
    id: "heterogeneity-variation",
    priority: 6,
    source: "heterogeneidade",
    reason: "variações por heterogeneidade do grupo",
    condition: (ctx) => ctx.analysis.heterogeneity === "alta",
    apply: (draft) => {
      draft.variations.push("Criar trilhas por nível: base, intermediário e desafio.");
      draft.variations.push("Permitir regressão imediata para quem precisar.");
      draft.manualReviewFlags.push("Turma heterogênea: conferir nível real dos subgrupos.");
    },
  },
];

const applyPlanningRules = (draft: LessonPlanDraft, ctx: PlanningRuleContext) => {
  const rules = buildPlanningRules().sort((a, b) => a.priority - b.priority);
  rules.forEach((rule) => {
    if (!rule.condition(ctx)) return;
    rule.apply(draft, ctx);
    draft.explanations.push({
      message: rule.reason,
      source: rule.source === "seguranca" ? "analise" : rule.source === "objetivo" ? "objetivo" : "contexto",
      appliedTo: "geral",
    });
  });
};

const buildDraftFromBase = (
  input: PlanningInput,
  analysis: PlanningAnalysis,
  basePlan: BasePlanDraft
): LessonPlanDraft => {
  const duration = Math.max(1, Math.round(input.duration || basePlan.warmupTime + basePlan.mainTime + basePlan.cooldownTime));
  const scaled = scaleDurations([basePlan.warmupTime, basePlan.mainTime, basePlan.cooldownTime], duration);

  const draft: LessonPlanDraft = {
    objective: normalizePedagogicalObjective(input.objective || input.classGroup.goal),
    warmup: buildBlock("aquecimento", scaled[0], basePlan.warmup, "warmup"),
    main: buildBlock("principal", scaled[1], basePlan.main, "main"),
    cooldown: buildBlock("volta_calma", scaled[2], basePlan.cooldown, "cooldown"),
    variations: [],
    adaptations: [],
    explanations: [
      {
        message: `Base gerada a partir de ${basePlan.kind === "volleyball" ? "motor de voleibol" : "motor de progressão"}.`,
        source: "analise",
        appliedTo: "geral",
      },
    ],
    manualReviewFlags: [],
  };

  if (analysis.softConstraints.includes("tempo_reduzido")) {
    draft.manualReviewFlags.push("Tempo reduzido: revisar transições e volume do bloco principal.");
  }
  if (analysis.softConstraints.includes("espaco_limitado")) {
    draft.explanations.push({
      message: "Espaço reduzido: favorecer organização por estações e deslocamento controlado.",
      source: "contexto",
      appliedTo: "principal",
    });
  }
  if (analysis.softConstraints.includes("sem_quadra")) {
    draft.explanations.push({
      message: "Sem quadra fixa: adaptar o planejamento para espaço alternativo.",
      source: "contexto",
      appliedTo: "geral",
    });
  }

  if (typeof input.variationSeed === "number" && Number.isFinite(input.variationSeed)) {
    applyVariationSeed(draft, input.variationSeed);
  }

  return draft;
};

const buildGeneratedPlan = (draft: LessonPlanDraft, basePlanKind: "progression" | "volleyball"): LessonPlanGenerated => ({
  ...draft,
  generatedAt: new Date().toISOString(),
  engineVersion: ENGINE_VERSION,
  basePlanKind,
});

export const finalizeGeneratedPlan = (
  generated: LessonPlanGenerated,
  options: { edited?: boolean; finalizedAt?: string } = {}
): LessonPlanFinal => ({
  ...generated,
  edited: options.edited ?? false,
  finalizedAt: options.finalizedAt ?? new Date().toISOString(),
});

export const buildPedagogicalPlan = (input: PlanningInput): PedagogicalPlanPackage => {
  const analysis = analyzePlanningInput(input);
  const basePlan = buildBasePlan(input, analysis);
  const draft = buildDraftFromBase(input, analysis, basePlan);
  applyPlanningRules(draft, { input, analysis, draft });
  const generated = buildGeneratedPlan(draft, basePlan.kind);
  const final = finalizeGeneratedPlan(generated);

  return {
    input,
    analysis,
    draft,
    generated,
    final,
  };
};


