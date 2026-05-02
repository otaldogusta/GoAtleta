import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  LessonBlock,
  SessionComponent,
  SessionEnvironment,
  SessionPrimaryComponent,
  WeekSessionRole,
  WeeklyOperationalDecision,
} from "../../../core/models";
import { buildSessionResistancePreview } from "../../session/application/build-session-resistance-preview";
import { checkLessonAlignmentWithPeriodization } from "../../../core/pedagogy/lesson-periodization-alignment";
import {
    renderBlockRecommendationSummary,
    renderGameFormLabel,
    renderPedagogicalObjective,
    renderStageFocusSummary,
} from "../../../core/pedagogy/pedagogical-renderer";
import type { NextPedagogicalStep } from "../../../core/pedagogy/pedagogical-types";
import {
    normalizeAgeBandKey,
    resolveNextPedagogicalStepFromPeriodization,
} from "../../../core/pedagogy/resolve-next-pedagogical-step-from-periodization";
import {
    FORBIDDEN_UI_TERMS,
    sanitizeVolleyballLanguage
} from "../../../core/pedagogy/volleyball-language-lexicon";
import { getLessonBlockTimes } from "../../../utils/lesson-block-times";
import type { WeekSessionPreview } from "../../periodization/application/build-week-session-preview";
import { serializeLessonBlocks } from "./daily-lesson-blocks";

const DAILY_OVERRIDE_FIELDS = [
  "title",
  "warmup",
  "mainPart",
  "cooldown",
  "observations",
] as const;

type DailyOverrideField = (typeof DAILY_OVERRIDE_FIELDS)[number];

type LessonKind = "introducao" | "pratica_guiada" | "aplicacao" | "revisao" | "mini_jogo";
type LanguageProfile = "kids_7_9" | "preteen_10_12" | "teen_13_15" | "senior_16_plus" | "geral";

type DailyGenerationContext = {
  className?: string;
  ageBand?: string;
  durationMinutes?: number;
  cycleStartDate?: string;
  cycleEndDate?: string;
  classGroup?: ClassGroup | null;
  recentPlans?: DailyLessonPlan[];
};

type PedagogicalDecision = {
  lessonKind: LessonKind;
  titleTag: string;
  organization: string;
  warmupOrganization?: string;
  progression: string;
  purpose: string;
  warmupAction: string;
  mainAction: string;
  cooldownAction: string;
};

type DailySection = "warmup" | "mainPart" | "cooldown" | "observations";

type OperationalActivity = {
  id: string;
  name: string;
  description: string;
};

type QaResult = {
  score: number;
  reasons: string[];
};

type TranslationTestResult = {
  ok: boolean;
  reasons: string[];
};

const parseOverrideMask = (value: string | undefined): DailyOverrideField[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DailyOverrideField => DAILY_OVERRIDE_FIELDS.includes(item));
  } catch {
    return [];
  }
};

const parseWeeklyOperationalDecision = (
  snapshotJson: string | undefined,
  sessionIndex: number,
): WeeklyOperationalDecision | null => {
  if (!snapshotJson) return null;
  try {
    const parsed = JSON.parse(snapshotJson) as {
      weeklyOperationalStrategy?: {
        decisions?: Partial<WeeklyOperationalDecision>[];
      };
    };
    const decisions = parsed?.weeklyOperationalStrategy?.decisions;
    if (!Array.isArray(decisions)) return null;
    const matched = decisions.find(
      (item) => Number(item?.sessionIndexInWeek) === sessionIndex,
    );
    if (!matched?.sessionRole) return null;
    return matched as WeeklyOperationalDecision;
  } catch {
    return null;
  }
};

const deriveSessionPrimaryComponent = (params: {
  sessionEnvironment?: SessionEnvironment;
  sessionComponents?: SessionComponent[];
}): SessionPrimaryComponent | undefined => {
  if (params.sessionComponents?.some((item) => item.type === "academia_resistido")) {
    if (params.sessionComponents.some((item) => item.type === "quadra_tecnico_tatico")) {
      return "misto_transferencia";
    }
    return "resistido";
  }

  if (params.sessionComponents?.some((item) => item.type === "preventivo")) {
    return "preventivo";
  }

  if (params.sessionEnvironment === "quadra") return "tecnico_tatico";
  if (params.sessionEnvironment === "mista") return "misto_transferencia";
  if (params.sessionEnvironment === "preventiva") return "preventivo";
  if (params.sessionEnvironment === "academia") return "resistido";
  return undefined;
};

const resolvePersistedSessionIntegration = (params: {
  weeklyPlan: ClassPlan;
  session: WeekSessionPreview;
  context?: DailyGenerationContext;
}): {
  sessionEnvironment?: SessionEnvironment;
  sessionPrimaryComponent?: SessionPrimaryComponent;
  sessionComponents?: SessionComponent[];
} => {
  const weeklyDecision = parseWeeklyOperationalDecision(
    params.weeklyPlan.generationContextSnapshotJson,
    params.session.sessionIndex,
  );

  const preview = buildSessionResistancePreview({
    classGroup: params.context?.classGroup,
    classPlan: params.weeklyPlan,
    sessionDate: params.session.date,
    sessionRole: weeklyDecision?.sessionRole as WeekSessionRole | undefined,
  });

  const sessionEnvironment =
    preview?.sessionEnvironment ?? weeklyDecision?.sessionEnvironment;
  const sessionComponents = preview?.sessionComponents;
  const sessionPrimaryComponent =
    weeklyDecision?.sessionPrimaryComponent ??
    deriveSessionPrimaryComponent({
      sessionEnvironment,
      sessionComponents,
    });

  return {
    sessionEnvironment,
    sessionPrimaryComponent,
    sessionComponents,
  };
};

const parseDailyDecisionKind = (snapshotJson: string | undefined): LessonKind | null => {
  if (!snapshotJson) return null;
  try {
    const parsed = JSON.parse(snapshotJson) as { dailyDecision?: { lessonKind?: string } };
    const kind = parsed?.dailyDecision?.lessonKind;
    if (kind === "introducao" || kind === "pratica_guiada" || kind === "aplicacao" || kind === "revisao" || kind === "mini_jogo") {
      return kind;
    }
    return null;
  } catch {
    return null;
  }
};

const inferLanguageProfile = (context?: DailyGenerationContext): LanguageProfile => {
  const ageText = `${context?.ageBand ?? ""} ${context?.className ?? ""}`.toLowerCase();
  if (/(sub\s*-?\s*0?9|0?7\s*[-/]\s*0?9)/.test(ageText)) {
    return "kids_7_9";
  }
  if (/(sub\s*-?\s*1[012]|1?0\s*[-/]\s*1?2|1?1\s*[-/]\s*1?2|0?8\s*[-/]\s*1[01])/.test(ageText)) {
    return "preteen_10_12";
  }
  if (/(sub\s*-?\s*1[345]|1?3\s*[-/]\s*1?5)/.test(ageText)) {
    return "teen_13_15";
  }
  if (/(16\+|1?6\s*[-/]\s*\+|adult)/.test(ageText)) {
    return "senior_16_plus";
  }

  const ageNumbers = (ageText.match(/\d{1,2}/g) ?? [])
    .map((item) => Number(item))
    .filter((value) => Number.isFinite(value));
  if (ageNumbers.some((value) => value >= 7 && value <= 9)) return "kids_7_9";
  if (ageNumbers.some((value) => value >= 10 && value <= 12)) return "preteen_10_12";
  if (ageNumbers.some((value) => value >= 13 && value <= 15)) return "teen_13_15";
  if (ageNumbers.some((value) => value >= 16)) return "senior_16_plus";

  return "geral";
};

const isYoungProfile = (profile: LanguageProfile) =>
  profile === "kids_7_9" || profile === "preteen_10_12";

const normalizeFocus = (value: string | undefined, fallback: string): string => {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return fallback;
  return cleaned.replace(/\s+/g, " ");
};

const parseRpeTargetValue = (value: string | undefined): number | null => {
  const numericValues = (String(value ?? "").match(/\d+(?:[\.,]\d+)?/g) ?? [])
    .map((item) => Number(item.replace(",", ".")))
    .filter((item) => Number.isFinite(item));
  if (!numericValues.length) return null;
  const sum = numericValues.reduce((acc, item) => acc + item, 0);
  return sum / numericValues.length;
};

const normalizePhaseBucket = (phase: string | undefined, theme: string | undefined): "exploracao" | "fundamentos" | "aplicacao" | "consolidacao" | "indefinida" => {
  const text = `${phase ?? ""} ${theme ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(explor|adapt|inic)/.test(text)) return "exploracao";
  if (/(fundament|base)/.test(text)) return "fundamentos";
  if (/(aplic|jogo reduzido|mini jogo|mini-jogo|transfer)/.test(text)) return "aplicacao";
  if (/(consolid|revis|fixa|estabil)/.test(text)) return "consolidacao";
  return "indefinida";
};

const alignLessonKindToPeriodization = (params: {
  initialKind: LessonKind;
  weeklyPlan: ClassPlan;
}): LessonKind => {
  const { initialKind, weeklyPlan } = params;
  const phaseBucket = normalizePhaseBucket(weeklyPlan.phase, weeklyPlan.theme);
  const rpeValue = parseRpeTargetValue(weeklyPlan.rpeTarget);

  if ((phaseBucket === "exploracao" || phaseBucket === "fundamentos") && (initialKind === "aplicacao" || initialKind === "mini_jogo")) {
    return "pratica_guiada";
  }

  if (phaseBucket === "aplicacao" && initialKind === "introducao") {
    return "aplicacao";
  }

  if (rpeValue !== null && rpeValue <= 4 && (initialKind === "aplicacao" || initialKind === "mini_jogo")) {
    return "pratica_guiada";
  }

  return initialKind;
};

const normalizeForCheck = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const SECTION_LABEL_PATTERNS: Record<DailySection, RegExp> = {
  warmup: /^\s*aquecimento\s*:\s*/i,
  mainPart: /^\s*parte principal\s*:\s*/i,
  cooldown: /^\s*volta\s*a\s*calma\s*:\s*/i,
  observations: /^\s*observa(c|ç)(o|õ)es\s*:\s*/i,
};

const HARDBLACKLIST_PATTERNS: Array<[RegExp, string]> = [
  [/ativa(c|ç)(a|ã)o espec(i|í)fica/gi, "aquecimento com bola"],
  [/mobilidade espec(i|í)fica/gi, "movimento com bola"],
  [/parte principal orientada por/gi, "atividade principal com"],
  [/est(i|í)mul[oa]/gi, "proposta"],
  [/demanda/gi, "desafio"],
  [/contexto motor/gi, "situação de jogo"],
  [/execu(c|ç)(a|ã)o imediata/gi, "resposta rápida"],
  [/objetivo da tarefa/gi, "desafio da rodada"],
  [/a atividade esquenta o corpo e j(a|á) prepara o fundamento da aula\.?/gi, ""],
  [/a atividade esquenta o corpo\.?/gi, ""],
  [/prepara(c|ç)(a|ã)o direta para o foco t(e|é)cnico da aula\.?/gi, ""],
  [/fechamento curto para sair da quadra entendendo o foco do dia\.?/gi, ""],
  [/finalidade\s*:/gi, ""],
  [/proposta da atividade\s*:/gi, ""],
];

const NATURAL_LANGUAGE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/revis(a|ã)o ativa dos movimentos-?chave/gi, "revisão dos movimentos básicos"],
  [/movimentos-?chave/gi, "movimentos básicos"],
  [/progress(a|ã)o da aula/gi, "sequência da atividade"],
  [/tarefa integradora/gi, "atividade final"],
  [/desafio de execu(c|ç)(a|ã)o/gi, "desafio novo"],
  [/registra uma melhora e um ajuste/gi, "fala o que melhorou e o que precisa treinar"],
  [/registra uma melhora e um ajuste/gi, "fala o que melhorou e o que precisa treinar"],
  [/registrar uma melhora e um ajuste/gi, "falar o que melhorou e o que precisa treinar"],
  [/autoavalia(c|ç)(a|ã)o simples/gi, "conversa rápida"],
  [/pr(o|ó)xima progress(a|ã)o/gi, "próxima aula"],
  [/situa(c|ç)(a|ã)o mais pr(o|ó)xima do jogo/gi, "situação de jogo"],
  [/sequ(e|ê)ncia t(e|é)cnica combinada/gi, "jogada combinada"],
  [/revisita fundamentos/gi, "retoma os fundamentos"],
];

const ACTION_VERBS = [
  "fazem",
  "jogam",
  "trocam",
  "passam",
  "recebem",
  "levantam",
  "sacam",
  "defendem",
  "atacam",
  "controlam",
  "organizam",
  "movem",
  "correm",
  "mudam",
  "respondem",
  "repetem",
  "aplicam",
  "anotar",
  "anotam",
  "registrar",
  "registram",
  "comentar",
  "comentam",
  "falar",
  "falam",
];

const ORGANIZATION_HINTS = [
  "dupla",
  "duplas",
  "trio",
  "trios",
  "grupo",
  "grupos",
  "equipe",
  "equipes",
  "times",
  "estacao",
  "estacoes",
  "roda",
  "quadra dividida",
  "mini campos",
  "corredor",
];

const PROGRESSION_HINTS = [
  "progressao",
  "rodada",
  "rodadas",
  "serie",
  "series",
  "a cada",
  "desafio",
  "troca",
  "passa para",
  "depois",
  "em seguida",
];

const TRANSLATION_RED_FLAGS = [
  /organiza(c|ç)(a|ã)o\s*:/i,
  /progress(a|ã)o\s*:/i,
  /finalidade/gi,
  /tarefa integradora/gi,
  /execu(c|ç)(a|ã)o/gi,
  /est(i|í)mul[oa]/gi,
  /demanda/gi,
  /contexto motor/gi,
  /revisita fundamentos/gi,
  /derive do foco/gi,
  /movimentos-?chave/gi,
  /progress(a|ã)o da aula/gi,
  /desafio de execu(c|ç)(a|ã)o/gi,
  /registra uma melhora e um ajuste/gi,
  /registra uma melhora e um ajuste/gi,
];

const COACH_VOICE_HINTS = [
  "os alunos",
  "a turma",
  "cada aluno",
  "professor",
  "em dupla",
  "em duplas",
  "em grupo",
  "em grupos",
  "depois",
  "no final",
  "a cada rodada",
];

const sentenceLimitByProfile: Record<LanguageProfile, Record<DailySection, number>> = {
  kids_7_9: {
    warmup: 2,
    mainPart: 3,
    cooldown: 2,
    observations: 2,
  },
  preteen_10_12: {
    warmup: 2,
    mainPart: 3,
    cooldown: 2,
    observations: 2,
  },
  teen_13_15: {
    warmup: 2,
    mainPart: 3,
    cooldown: 2,
    observations: 2,
  },
  senior_16_plus: {
    warmup: 2,
    mainPart: 3,
    cooldown: 2,
    observations: 2,
  },
  geral: {
    warmup: 2,
    mainPart: 3,
    cooldown: 2,
    observations: 2,
  },
};

const splitSentences = (value: string): string[] =>
  value
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const ensureSentenceEnding = (value: string): string => {
  if (!value.trim()) return "";
  return /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;
};

const limitSentences = (value: string, maxSentences: number): string => {
  const sentences = splitSentences(value);
  if (sentences.length <= maxSentences) return ensureSentenceEnding(value);
  return ensureSentenceEnding(sentences.slice(0, maxSentences).join(" "));
};

const hasAnyTerm = (text: string, terms: string[]): boolean => {
  const normalized = normalizeForCheck(text);
  return terms.some((term) => normalized.includes(term));
};

const hasActionVerb = (text: string): boolean => hasAnyTerm(text, ACTION_VERBS);
const hasOrganizationHint = (text: string): boolean => hasAnyTerm(text, ORGANIZATION_HINTS);
const hasProgressionHint = (text: string): boolean => hasAnyTerm(text, PROGRESSION_HINTS);

const hasObservationActionHint = (text: string): boolean =>
  hasAnyTerm(text, ["anotar", "anotam", "registrar", "registram", "comentar", "comentam", "ajuste", "meta"]);

const runTranslationTest = (params: {
  section: DailySection;
  text: string;
}): TranslationTestResult => {
  const { section, text } = params;
  const reasons: string[] = [];

  const hasRedFlag = TRANSLATION_RED_FLAGS.some((pattern) => {
    const safePattern = new RegExp(pattern.source, pattern.flags.replace("g", ""));
    return safePattern.test(text);
  });

  if (hasRedFlag) {
    reasons.push("system_dialect_detected");
  }

  const hasForbiddenUiTerm = FORBIDDEN_UI_TERMS.some((term) =>
    normalizeForCheck(text).includes(normalizeForCheck(term))
  );
  if (hasForbiddenUiTerm) {
    reasons.push("forbidden_ui_term_detected");
  }

  const hasCoachVoice = hasAnyTerm(text, COACH_VOICE_HINTS);
  if (!hasCoachVoice && section !== "observations") {
    reasons.push("missing_coach_voice");
  }

  const hasConcreteInstruction =
    section === "observations"
      ? hasActionVerb(text) || hasObservationActionHint(text)
      : hasActionVerb(text) && hasOrganizationHint(text);
  if (!hasConcreteInstruction) {
    reasons.push("missing_concrete_instruction");
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
};

const normalizeOrganizationPhrase = (organization: string): string =>
  organization.trim().replace(/^(em|na|no|nas|nos)\s+/i, "");

const removeSectionLabelPrefix = (value: string, section: DailySection): string =>
  value.replace(SECTION_LABEL_PATTERNS[section], "").trim();

const applyHardBlacklist = (value: string): string => {
  let text = value;
  for (const [pattern, replacement] of HARDBLACKLIST_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of NATURAL_LANGUAGE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
};

const lowerFirst = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
};

const buildWarmupLine = (decision: PedagogicalDecision, profile: LanguageProfile): string => {
  const actionText = decision.warmupAction.trim();
  const normalizedAction = normalizeForCheck(actionText);
  const hasPairSetup = /\bdupla\b|\bduplas\b|\btrio\b|\btrios\b/.test(normalizedAction);
  const hasTeacherGuidance = /professor|orienta|orientacao|orientacoes/.test(normalizedAction);

  if (isYoungProfile(profile)) {
    const intro = hasPairSetup ? "Os alunos fazem" : "Em dupla, os alunos fazem";
    const closing = hasTeacherGuidance ? "" : ", com orientação rápida do professor";
    return `${intro} ${actionText}${closing}. A cada rodada, muda um detalhe da atividade.`;
  }

  return `Os alunos fazem ${actionText}. A cada rodada, muda um detalhe da atividade.`;
};

const resolveWarmupOrganization = (decision: PedagogicalDecision): string =>
  decision.warmupOrganization?.trim() || decision.organization;

const buildLessonTitle = (theme: string, decision: PedagogicalDecision): string => {
  const readableTheme = lowerFirst(theme);

  if (decision.lessonKind === "introducao") {
    return `Primeiro contato com ${readableTheme}`;
  }

  if (decision.lessonKind === "pratica_guiada") {
    return `Treino guiado de ${readableTheme}`;
  }

  if (decision.lessonKind === "aplicacao") {
    return `Aplicação de ${readableTheme} em jogo`;
  }

  if (decision.lessonKind === "mini_jogo") {
    return `Mini jogo para trabalhar ${readableTheme}`;
  }

  return `Revisão de ${readableTheme}`;
};

const cleanupSpacing = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(\S)/g, "$1 $2")
    .replace(/\.{2,}/g, ".")
    .trim();

const postProcessDailyText = (value: string): string => {
  let text = sanitizeVolleyballLanguage(value);

  text = applyHardBlacklist(text);

  // Limpeza final
  text = text.replace(/\s*\.\s*\./g, ". ");
  text = text.replace(/\s+\./g, ".");
  text = cleanupSpacing(text);

  // Garante frase com ponto final quando houver conteudo
  if (text && !/[.!?]$/.test(text)) {
    text = `${text}.`;
  }

  if (text.length > 1) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  return sanitizeVolleyballLanguage(text);
};

const polishLessonObjective = (value: string): string => {
  let text = postProcessDailyText(value)
    .replace(/^Objetivo da aula:\s*/i, "")
    .replace(/^Desenvolver\s+controlar\s+a\s+primeira\s+bola/i, "Desenvolver o controle da primeira bola")
    .replace(/^Desenvolver\s+controlar\s+/i, "Desenvolver o controle de ")
    .replace(/^Desenvolver\s+recepcao\b/i, "Desenvolver a recepção")
    .replace(/^Desenvolver\s+recepção\b/i, "Desenvolver a recepção")
    .replace(/\s+/g, " ")
    .trim();

  if (/controle da primeira bola/i.test(text) && !/alvo|zona|sequ[eê]ncia|jogada/i.test(text)) {
    text =
      "Desenvolver o controle da primeira bola, direcionando a recepção para um alvo definido e dando sequência à jogada em situações simples de leitura do jogo.";
  }

  return ensureSentenceEnding(text);
};

const formatActivityDescription = (sections: {
  organization: string;
  development: string;
  coachCommands?: string[];
  successCriteria?: string;
  progression?: string;
  easier?: string;
  harder?: string;
  questions?: string[];
}) => {
  const lines = [
    `Organização: ${sections.organization}`,
    `Desenvolvimento: ${sections.development}`,
    sections.coachCommands?.length
      ? `Comandos do professor: ${sections.coachCommands.map((item) => `"${item}"`).join("; ")}`
      : "",
    sections.successCriteria ? `Critério de sucesso: ${sections.successCriteria}` : "",
    sections.progression ? `Progressão: ${sections.progression}` : "",
    sections.easier || sections.harder
      ? `Adaptação: ${sections.easier ? `se estiver difícil, ${sections.easier}` : ""}${
          sections.easier && sections.harder ? "; " : ""
        }${sections.harder ? `se estiver fácil, ${sections.harder}` : ""}.`
      : "",
    sections.questions?.length ? `Perguntas: ${sections.questions.join(" | ")}` : "",
  ];

  return lines.filter(Boolean).join("\n");
};

const buildReceptionOperationalActivities = (params: {
  profile: LanguageProfile;
  sessionDate: string;
  blockTimes: ReturnType<typeof getLessonBlockTimes>;
}) => {
  const { profile, sessionDate, blockTimes } = params;

  if (profile === "kids_7_9") {
    const warmupActivity: OperationalActivity = {
      id: `warmup_${sessionDate}_alvo_primeira_bola`,
      name: "Alvo da primeira bola",
      description: formatActivityDescription({
        organization: "Duplas com uma bola. Marcar 3 alvos próximos da rede com cones ou arcos coloridos.",
        development:
          "Um aluno lança por baixo e o colega recebe de manchete tentando aproximar a bola do alvo combinado. A cada 3 tentativas, trocam a função.",
        coachCommands: ["Base baixa", "Braços firmes", "Direciona para o alvo", "Não só rebate"],
        successCriteria: "Aproximar a bola do alvo em 2 de 3 tentativas.",
        progression: "Mudar o alvo após cada acerto.",
        easier: "aproximar o alvo e permitir lançamento mais alto",
        harder: "pedir um deslocamento curto antes da manchete",
      }),
    };

    const mainActivities: OperationalActivity[] = [
      {
        id: `main_${sessionDate}_alvo_colorido`,
        name: "Manchete para alvo colorido",
        description: formatActivityDescription({
          organization: "Duplas em corredores curtos da quadra, cada dupla com 2 alvos coloridos.",
          development:
            "O professor chama uma cor. Quem recebe precisa direcionar a manchete para o alvo certo e voltar para a fila curta.",
          coachCommands: ["Chega antes da bola", "Braços juntos", "Aponta para a cor"],
          successCriteria: "Acertar ou aproximar 3 bolas em 5 tentativas.",
          progression: "Trocar a cor no último momento, mantendo lançamento fácil.",
          easier: "usar alvo maior e distância menor",
          harder: "aumentar um passo de distância",
        }),
      },
      {
        id: `main_${sessionDate}_dupla_continuidade`,
        name: "Dupla mantém a bola viva",
        description: formatActivityDescription({
          organization: "Duplas em meia quadra, com rodízio a cada rodada curta.",
          development:
            "A dupla recebe, controla e tenta devolver uma bola alta para o colega continuar a jogada.",
          coachCommands: ["Ajuda o colega", "Bola alta", "Fala minha"],
          successCriteria: "Conseguir 3 trocas com controle antes de trocar de dupla.",
          progression: "Depois de cada sequência, mudar o lado de início da bola.",
          easier: "permitir segurar a bola uma vez",
          harder: "pedir manchete antes de devolver",
        }),
      },
      {
        id: `main_${sessionDate}_mini_2x2_alvo`,
        name: "Mini 2x2 com alvo da primeira bola",
        description: formatActivityDescription({
          organization: "Mini jogos 2x2 em quadra reduzida, rodadas de 3 minutos.",
          development:
            "A equipe só pontua se a primeira bola for controlada para o colega ou para uma zona marcada antes do envio.",
          coachCommands: ["Primeira bola organizada", "Olha o alvo", "Joga junto"],
          successCriteria: "Pontuar 2 vezes na rodada usando a primeira bola organizada.",
          progression: "Trocar a zona de pontuação a cada rodada.",
          easier: "começar com bola lançada pelo professor",
          harder: "exigir 2 ações antes de enviar",
        }),
      },
    ];

    return {
      objective:
        "Desenvolver o controle da primeira bola, orientando a manchete para um alvo simples e mantendo a jogada em duplas e mini 2x2.",
      focusLabel: "Primeira bola, manchete para alvo e continuidade no 2x2",
      successCriterion: "Aproximar a recepção do alvo e manter 3 ações controladas em sequência.",
      warmupActivity,
      mainActivities,
      blockTimes,
    };
  }

  if (profile === "preteen_10_12") {
    const warmupActivity: OperationalActivity = {
      id: `warmup_${sessionDate}_zona_levantamento`,
      name: "Primeira bola para zona de levantamento",
      description: formatActivityDescription({
        organization: "Trios. Um lança, um recebe e um fica na zona de levantamento.",
        development:
          "O lançador envia bolas fáceis e médias. O receptor direciona a manchete para o colega na zona combinada. Após 5 bolas, trocam a função.",
        coachCommands: ["Chega antes da bola", "Plataforma firme", "Termina apontando para a zona", "Ajuda o levantador"],
        successCriteria: "Acertar 3 recepções em 5 tentativas na zona combinada.",
        progression: "Variar a origem do lançamento ou deslocar a zona de levantamento.",
        easier: "reduzir distância e manter lançamento previsível",
        harder: "incluir deslocamento lateral antes da recepção",
      }),
    };

    const mainActivities: OperationalActivity[] = [
      {
        id: `main_${sessionDate}_recepcao_zona`,
        name: "Recepção para zona de levantamento",
        description: formatActivityDescription({
          organization: "Trios em meia quadra, com zona de levantamento marcada.",
          development:
            "O receptor recebe bolas de diferentes posições e precisa entregar uma primeira bola jogável para o levantador.",
          coachCommands: ["Corpo atrás da bola", "Manchete orientada", "Facilita o segundo toque"],
          successCriteria: "Entregar 3 de 5 bolas na zona combinada.",
          progression: "Alternar bola curta e bola média.",
          easier: "usar lançamento por baixo",
          harder: "usar saque por baixo direcionado",
        }),
      },
      {
        id: `main_${sessionDate}_recepcao_segundo_toque`,
        name: "Recepção, segundo toque e envio",
        description: formatActivityDescription({
          organization: "Trios ou quartetos em meia quadra.",
          development:
            "Depois da recepção, o grupo precisa levantar ou controlar o segundo toque e enviar para uma zona marcada.",
          coachCommands: ["Não encerra na recepção", "Organiza o segundo toque", "Escolhe a zona"],
          successCriteria: "Completar recepção, segundo toque e envio em 3 sequências.",
          progression: "Trocar a zona de envio após cada acerto.",
          easier: "permitir bola mais alta no segundo toque",
          harder: "reduzir o tempo para decidir",
        }),
      },
      {
        id: `main_${sessionDate}_mini_3x3_primeira_bola`,
        name: "Mini 3x3 com primeira bola obrigatória",
        description: formatActivityDescription({
          organization: "Mini jogos 3x3, com rodízio por tempo e zona de levantamento marcada.",
          development:
            "A equipe ganha ponto extra quando recebe para a zona, usa segundo toque e mantém a continuidade antes de enviar.",
          coachCommands: ["Primeira bola para o levantador", "Comunica cedo", "Joga no espaço livre"],
          successCriteria: "Usar primeira bola organizada em 3 jogadas da rodada.",
          progression: "Adicionar saque por baixo direcionado.",
          easier: "começar com bola lançada",
          harder: "exigir 3 ações antes do envio",
        }),
      },
    ];

    return {
      objective:
        "Desenvolver a primeira bola para a zona de levantamento, conectando recepção, segundo toque e continuidade no mini 3x3.",
      focusLabel: "Primeira bola, zona de levantamento e continuidade no 3x3",
      successCriterion: "Entregar 3 de 5 recepções na zona combinada e dar sequência com segundo toque.",
      warmupActivity,
      mainActivities,
      blockTimes,
    };
  }

  const warmupActivity: OperationalActivity = {
    id: `warmup_${sessionDate}_recepcao_pressao`,
    name: "Recepção com origem variável",
    description: formatActivityDescription({
      organization: "Trios ou quartetos, com zona de levantamento e origem de bola alternada.",
      development:
        "O grupo recebe bola curta, média e longa, ajustando posição corporal antes da manchete.",
      coachCommands: ["Lê a origem", "Ajusta a base", "Entrega bola jogável"],
      successCriteria: "Manter 4 de 6 recepções jogáveis.",
      progression: "Trocar lançamento por saque direcionado.",
      easier: "fixar origem da bola",
      harder: "adicionar pontuação condicionada",
    }),
  };

  const mainActivities: OperationalActivity[] = [
    {
      id: `main_${sessionDate}_saque_recepcao`,
      name: "Recepção de saque direcionado",
      description: formatActivityDescription({
        organization: "Grupos de 4 a 6, com sacador, recebedores e zona de levantamento.",
        development:
          "O sacador direciona zonas simples. A recepção precisa entregar bola jogável para transição.",
        coachCommands: ["Chama responsabilidade", "Fecha espaço", "Entrega para transição"],
        successCriteria: "Resolver 4 de 6 saques com primeira bola jogável.",
        progression: "Aumentar zona-alvo ou variar saque curto/longo.",
        easier: "reduzir velocidade do saque",
        harder: "incluir tomada de decisão de contra-ataque",
      }),
    },
    {
      id: `main_${sessionDate}_transicao`,
      name: "Recepção e transição para contra-ataque",
      description: formatActivityDescription({
        organization: "3x3 ou 4x4 em meia quadra, com pontuação condicionada.",
        development:
          "Após receber, a equipe precisa organizar segundo toque e atacar ou enviar em zona vulnerável.",
        coachCommands: ["Recebe pensando no ataque", "Cobre a ação", "Escolhe a melhor resposta"],
        successCriteria: "Criar contra-ataque organizado em 3 jogadas da rodada.",
        progression: "Adicionar bloqueio passivo ou defesa posicionada.",
        easier: "permitir envio controlado sem ataque",
        harder: "pontuar só com transição completa",
      }),
    },
    {
      id: `main_${sessionDate}_jogo_condicionado`,
      name: "Jogo condicionado de primeira bola",
      description: formatActivityDescription({
        organization: "Jogo reduzido com equipes fixas por rodada.",
        development:
          "A equipe só marca ponto cheio quando a primeira bola gera continuidade e opção clara de ataque.",
        coachCommands: ["Primeira bola define a jogada", "Comunica cobertura", "Ataca a zona livre"],
        successCriteria: "Completar 3 jogadas com recepção, organização e envio/ataque.",
        progression: "Reduzir tempo de decisão ou aumentar oposição.",
        easier: "ampliar espaço de alvo",
        harder: "exigir ataque dirigido",
      }),
    },
  ];

  return {
    objective:
      "Aprimorar a primeira bola sob variação de origem, conectando recepção, organização e transição para ataque.",
    focusLabel: "Recepção, zona de levantamento e transição",
    successCriterion: "Transformar a primeira bola em continuidade jogável em pelo menos 4 de 6 ações.",
    warmupActivity,
    mainActivities,
    blockTimes,
  };
};

const buildBlockingOperationalActivities = (params: {
  profile: LanguageProfile;
  sessionDate: string;
  blockTimes: ReturnType<typeof getLessonBlockTimes>;
}) => {
  const { profile, sessionDate, blockTimes } = params;
  const gameFormat = profile === "preteen_10_12" ? "mini 3x3" : profile === "kids_7_9" ? "mini 2x2" : "3x3/4x4";

  const warmupActivity: OperationalActivity = {
    id: `warmup_${sessionDate}_rede_cobertura`,
    name: profile === "kids_7_9" ? "Rede imaginária e cobertura curta" : "Sombra de bloqueio e cobertura curta",
    description: formatActivityDescription({
      organization: "Duplas próximas da rede, com uma zona curta marcada atrás do bloqueio.",
      development:
        "Um aluno simula o bloqueio sem salto alto e o colega ocupa a cobertura curta. Trocam a função a cada rodada.",
      coachCommands: ["Mãos altas", "Cai e cobre", "Fica perto da jogada"],
      successCriteria: "Entrar na cobertura correta em 3 de 5 repetições.",
      progression: "Adicionar bola largada ou envio curto para a zona de cobertura.",
      easier: "fazer sem bola e sem salto",
      harder: "incluir deslocamento antes da cobertura",
    }),
  };

  const mainActivities: OperationalActivity[] = [
    {
      id: `main_${sessionDate}_bloqueio_cobertura`,
      name: "Bloqueio simples com cobertura curta",
      description: formatActivityDescription({
        organization: "Trios: atacante controlado, bloqueador e cobertura.",
        development:
          "O atacante envia bola controlada. O bloqueador marca a direção e o colega cobre a bola curta atrás do bloqueio.",
        coachCommands: ["Mãos fecham a direção", "Cobre atrás", "Não para depois do bloqueio"],
        successCriteria: "Bloquear ou cobrir 3 de 5 bolas controladas.",
        progression: "Alternar bola curta e bola mais profunda.",
        easier: "usar ataque lançado pelo professor",
        harder: "deixar o atacante escolher a direção",
      }),
    },
    {
      id: `main_${sessionDate}_cobertura_envio`,
      name: "Cobertura e envio controlado",
      description: formatActivityDescription({
        organization: "Trios ou quartetos em meia quadra, com zona de cobertura marcada.",
        development:
          "Depois da cobertura, o grupo precisa levantar ou enviar a bola para zona segura, sem encerrar a jogada.",
        coachCommands: ["Cobre para continuar", "Bola alta de segurança", "Reorganiza rápido"],
        successCriteria: "Transformar cobertura em continuidade em 3 sequências.",
        progression: "Trocar a zona de envio após cada acerto.",
        easier: "permitir bola segurada no segundo contato",
        harder: "adicionar oposição leve do outro lado",
      }),
    },
    {
      id: `main_${sessionDate}_mini_bloqueio`,
      name: `${gameFormat} com ponto de cobertura`,
      description: formatActivityDescription({
        organization: `Jogos em ${gameFormat}, com regra de ponto extra para cobertura após ataque ou bloqueio.`,
        development:
          "A equipe ganha ponto extra quando alguém cobre a ação ofensiva e mantém a bola viva.",
        coachCommands: ["Atacou, alguém cobre", "Bloqueou, volta para o jogo", "Mantém a bola viva"],
        successCriteria: "Fazer 2 coberturas úteis por rodada.",
        progression: "Obrigar cobertura antes do ponto valer cheio.",
        easier: "usar bola lançada pelo professor",
        harder: "aumentar oposição ou reduzir espaço",
      }),
    },
  ];

  return {
    objective:
      "Desenvolver bloqueio simples e cobertura curta, mantendo a equipe organizada para continuar a jogada.",
    focusLabel: "Bloqueio simples, cobertura curta e continuidade",
    successCriterion: "Entrar em cobertura útil em 3 de 5 ações de bloqueio ou ataque.",
    warmupActivity,
    mainActivities,
    blockTimes,
  };
};

const buildOperationalLessonPlan = (params: {
  weeklyPlan: ClassPlan;
  decision: PedagogicalDecision;
  profile: LanguageProfile;
  blockTimes: ReturnType<typeof getLessonBlockTimes>;
  sessionDate: string;
  canonicalObjective: string;
}) => {
  const { weeklyPlan, decision, profile, blockTimes, sessionDate, canonicalObjective } = params;
  const focusText = normalizeFocus(
    [weeklyPlan.technicalFocus, weeklyPlan.theme, decision.purpose].filter(Boolean).join(" "),
    "fundamento da aula"
  );
  const normalizedFocus = normalizeForCheck(focusText);
  const isReceptionFocus = /(recepc|manchete|primeira bola|passe)/.test(normalizedFocus);
  const isBlockingFocus = /(bloqueio|cobertura)/.test(normalizedFocus);
  const focusLabel = normalizeFocus(weeklyPlan.technicalFocus || weeklyPlan.theme, "Foco técnico da aula");

  const specializedPlan = isReceptionFocus
    ? buildReceptionOperationalActivities({ profile, sessionDate, blockTimes })
    : isBlockingFocus
      ? buildBlockingOperationalActivities({ profile, sessionDate, blockTimes })
      : null;

  const objective = specializedPlan
    ? specializedPlan.objective
    : polishLessonObjective(
        canonicalObjective ||
          `Desenvolver ${lowerFirst(decision.purpose)}, com organização clara, alvo definido e continuidade da jogada.`
      );
  const resolvedFocusLabel = specializedPlan?.focusLabel ?? focusLabel;
  const successCriterion =
    specializedPlan?.successCriterion ??
    "Cumprir a tarefa combinada em 3 tentativas seguidas, mantendo organização do grupo e controle da bola.";

  const warmupActivity: OperationalActivity = specializedPlan?.warmupActivity ?? {
    id: `warmup_${sessionDate}`,
    name: `Alvo móvel de ${lowerFirst(resolvedFocusLabel)}`,
    description: formatActivityDescription({
      organization: "Duplas ou trios com uma bola, usando corredores curtos da quadra.",
      development:
        "A turma aquece com deslocamento leve, troca de bola e alvo simples antes de entrar na tarefa principal.",
      coachCommands: ["Organiza o corpo antes do toque", "Mira antes de enviar", "Troca a função rápido"],
      successCriteria: "Manter a troca por 4 ações sem parar a bola.",
      progression: "Mudar distância, alvo ou direção a cada rodada.",
      easier: "reduzir a distância e deixar o lançamento mais previsível",
      harder: "pedir deslocamento antes da ação",
    }),
  };

  const mainActivities: OperationalActivity[] = specializedPlan?.mainActivities ?? [
        {
          id: `main_${sessionDate}_1`,
          name: `${resolvedFocusLabel} com alvo definido`,
          description: formatActivityDescription({
            organization: "Trios ou grupos pequenos, com um alvo claro por estação.",
            development:
              "Um aluno inicia a bola, outro executa o fundamento e o terceiro observa o critério combinado. Trocam a função a cada 5 ações.",
            coachCommands: ["Prepara antes da bola chegar", "Mira no alvo", "Corrige uma coisa por vez"],
            successCriteria: successCriterion,
            progression: "Aumentar distância, mudar alvo ou colocar tomada de decisão simples.",
            easier: "reduzir distância e tirar pressão de tempo",
            harder: "incluir deslocamento ou oposição leve",
          }),
        },
        {
          id: `main_${sessionDate}_2`,
          name: "Continuidade da jogada",
          description: formatActivityDescription({
            organization: "Meia quadra com trios ou quartetos.",
            development:
              "O grupo precisa transformar a primeira ação em uma segunda resposta organizada, mantendo a bola viva.",
            coachCommands: ["Depois do toque, prepara de novo", "Fala com o colega", "Procura a melhor resposta"],
            successCriteria: "Completar 3 sequências com continuidade.",
            progression: "Adicionar alvo de envio ou regra de ponto extra.",
            easier: "permitir lançamento controlado",
            harder: "reduzir espaço ou tempo de decisão",
          }),
        },
        {
          id: `main_${sessionDate}_3`,
          name: "Jogo reduzido com regra do foco",
          description: formatActivityDescription({
            organization: "Mini jogos em espaço reduzido, rodadas de 3 a 4 minutos.",
            development:
              "A equipe ganha ponto extra quando usa o foco da aula para organizar a jogada antes de enviar a bola.",
            coachCommands: ["Cumpre a regra antes de pontuar", "Organiza o grupo", "Decide com calma"],
            successCriteria: "Usar a regra do foco em pelo menos 3 jogadas da rodada.",
            progression: "Trocar a regra ou o alvo após cada rodada.",
            easier: "aumentar o espaço e permitir bola mais alta",
            harder: "reduzir espaço ou exigir comunicação antes da ação",
          }),
        },
      ];

  const cooldownActivity: OperationalActivity = {
    id: `cooldown_${sessionDate}`,
    name: "Roda rápida de fechamento",
    description: formatActivityDescription({
      organization: "Turma em roda, com bola no centro para indicar quem fala.",
      development: "Desacelerar, hidratar e fechar com respostas curtas sobre o que funcionou na aula.",
      questions: isReceptionFocus
        ? [
            "O que ajudou a controlar melhor a primeira bola?",
            "Quando foi melhor direcionar para o colega?",
            "O que a dupla precisa melhorar na próxima aula?",
          ]
        : [
            "O que ajudou mais no foco de hoje?",
            "Qual ajuste o grupo precisa repetir na próxima aula?",
            "O que ficou mais fácil depois da progressão?",
          ],
      successCriteria: "Cada grupo aponta uma melhora e um ajuste para a próxima aula.",
    }),
  };

  const blocks: LessonBlock[] = [
    {
      key: "warmup",
      label: "Aquecimento",
      durationMinutes: blockTimes.warmupMinutes,
      activities: [warmupActivity],
    },
    {
      key: "main",
      label: "Parte principal",
      durationMinutes: blockTimes.mainMinutes,
      activities: mainActivities,
    },
    {
      key: "cooldown",
      label: "Volta à calma",
      durationMinutes: blockTimes.cooldownMinutes,
      activities: [cooldownActivity],
    },
  ];

  return {
    objective,
    focusLabel,
    successCriterion,
    blocks,
    warmup: warmupActivity.description,
    mainPart: mainActivities.map((activity) => `${activity.name}\n${activity.description}`).join("\n\n"),
    cooldown: cooldownActivity.description,
    observations: [
      `Objetivo da aula: ${objective}`,
      `Foco da aula: ${resolvedFocusLabel}.`,
      `Critério de sucesso: ${successCriterion}`,
    ].join("\n"),
  };
};

const buildCanonicalSectionText = (params: {
  section: "warmup" | "main" | "cooldown";
  step: NextPedagogicalStep;
}): string => {
  const { section, step } = params;
  const listed = renderBlockRecommendationSummary(step, section);
  const gameForm = renderGameFormLabel(step);

  if (section === "warmup") {
    return `No aquecimento, a turma inicia com ${listed.replace(/[.]$/, "")}, preparando a turma para ${gameForm}.`;
  }

  if (section === "main") {
    return `Na parte principal, a turma trabalha com ${listed.replace(/[.]$/, "")} em situação de ${gameForm}, com progressão simples e orientação direta do professor.`;
  }

  return `No fechamento, a turma faz ${listed.replace(/[.]$/, "")}, registra um ajuste e encerra com comunicação curta de quadra.`;
};

const extractRecentSignals = (plans: DailyLessonPlan[] | undefined) => {
  const recentConfirmedSkills: string[] = [];
  const recentContexts: string[] = [];

  for (const plan of (plans ?? []).slice(0, 4)) {
    try {
      const parsed = JSON.parse(plan.generationContextSnapshotJson ?? "{}") as {
        nextPedagogicalStep?: {
          nextStep?: string[];
          alreadyPracticedContexts?: string[];
          blockRecommendations?: {
            warmup?: { contexts?: string[] };
            main?: { contexts?: string[] };
            cooldown?: { contexts?: string[] };
          };
        };
      };

      for (const skill of parsed?.nextPedagogicalStep?.nextStep ?? []) {
        if (!recentConfirmedSkills.includes(skill)) {
          recentConfirmedSkills.push(skill);
        }
      }

      for (const context of parsed?.nextPedagogicalStep?.alreadyPracticedContexts ?? []) {
        if (!recentContexts.includes(context)) {
          recentContexts.push(context);
        }
      }

      for (const context of parsed?.nextPedagogicalStep?.blockRecommendations?.main?.contexts ?? []) {
        if (!recentContexts.includes(context)) {
          recentContexts.push(context);
        }
      }
    } catch {
      // Ignore malformed snapshots in legacy plans.
    }
  }

  return {
    recentConfirmedSkills,
    recentContexts,
    historicalConfidence: recentConfirmedSkills.length >= 2 || recentContexts.length >= 2 ? 0.8 : 0.5,
  };
};

const buildFallbackSectionText = (params: {
  section: DailySection;
  decision: PedagogicalDecision;
  profile: LanguageProfile;
}): string => {
  const { section, decision, profile } = params;
  const orgPhrase = normalizeOrganizationPhrase(
    section === "warmup" ? resolveWarmupOrganization(decision) : decision.organization
  );

  if (section === "warmup") {
    return isYoungProfile(profile)
      ? `Dividir a turma em ${orgPhrase}. ${buildWarmupLine(decision, profile)}`
      : `Dividir a turma em ${orgPhrase}. ${buildWarmupLine(decision, profile)}`;
  }

  if (section === "mainPart") {
    const actionHasApplication = /disputa|mini\s*jogo|jogo|aplica/i.test(decision.mainAction);
    return isYoungProfile(profile)
      ? actionHasApplication
        ? `${buildKidsMainPartLine(decision)} A cada rodada, entra um desafio novo.`
        : `${buildKidsMainPartLine(decision)} Depois, aplicam em mini jogo curto com regra simples. A cada rodada, entra um desafio novo.`
      : actionHasApplication
        ? `${decision.mainAction}. A cada rodada, o professor adiciona um desafio.`
        : `${decision.mainAction}. Depois, aplicam em disputa curta. A cada rodada, o professor adiciona um desafio.`;
  }

  if (section === "cooldown") {
    return isYoungProfile(profile)
      ? `No final, cada aluno fala o que melhorou e o que quer continuar treinando. A turma fecha com uma conversa rápida em roda.`
      : `No final, cada aluno fala o que melhorou e o que ainda precisa treinar. A turma encerra com uma conversa rápida sobre o próximo ajuste.`;
  }

  return isYoungProfile(profile)
    ? "Anotar o principal ponto de dificuldade da turma para retomar na próxima aula."
    : "Anotar o principal ponto que a turma ainda precisa melhorar para retomar na próxima aula.";
};

const buildKidsMainPartLine = (decision: PedagogicalDecision): string => {
  if (decision.lessonKind === "introducao") {
    return "Em 3 estacoes curtas, os alunos treinam manchete para alvo, toque em dupla e saque curto por cima da rede baixa. Depois, fazem mini jogo 3x3 com regra simples de 3 toques.";
  }

  if (decision.lessonKind === "pratica_guiada") {
    return "Em trios, os alunos fazem sequencia de recepcao, toque alto e envio para zona marcada. A cada rodada, trocam funcao e tentam manter mais trocas seguidas.";
  }

  if (decision.lessonKind === "aplicacao") {
    return "Em mini jogos 2x2 e 3x3, a equipe marca ponto extra quando completa a jogada combinada antes de passar a bola. A cada rodada, entra uma regra nova e curta.";
  }

  if (decision.lessonKind === "mini_jogo") {
    return "Em quadra dividida, os grupos jogam rodadas curtas para atacar espaco livre e organizar defesa com ajuda do professor. A cada rodada, mudam alvo ou numero de toques.";
  }

  return "Em grupos pequenos, os alunos repetem os fundamentos da semana e fecham com jogo curto com meta simples de cooperacao e controle da bola.";
};

const scoreSectionQuality = (params: {
  section: DailySection;
  text: string;
  profile: LanguageProfile;
}): QaResult => {
  const { section, text, profile } = params;
  const reasons: string[] = [];
  let score = 0;

  const normalized = normalizeForCheck(text);
  const hasForbiddenTerm = HARDBLACKLIST_PATTERNS.some(([pattern]) => {
    const safePattern = new RegExp(pattern.source, pattern.flags.replace("g", ""));
    return safePattern.test(normalized);
  });
  if (!hasForbiddenTerm) {
    score += 1;
  } else {
    reasons.push("contains_blacklisted_term");
  }

  const hasSectionLabel = SECTION_LABEL_PATTERNS[section].test(text);
  if (!hasSectionLabel) {
    score += 1;
  } else {
    reasons.push("repeats_section_label");
  }

  if (hasActionVerb(text)) {
    score += 1;
  } else {
    reasons.push("missing_action_verb");
  }

  const maxSentences = sentenceLimitByProfile[profile][section];
  if (splitSentences(text).length <= maxSentences) {
    score += 1;
  } else {
    reasons.push("exceeds_sentence_limit");
  }

  if (hasOrganizationHint(text) || section === "observations") {
    score += 1;
  } else {
    reasons.push("missing_organization_hint");
  }

  const translationTest = runTranslationTest({ section, text });
  if (translationTest.ok) {
    score += 1;
  } else {
    reasons.push(...translationTest.reasons);
  }

  return { score, reasons };
};

const enforceConcretenessAndQa = (params: {
  section: DailySection;
  text: string;
  decision: PedagogicalDecision;
  profile: LanguageProfile;
  minimumScore?: number;
}): { text: string; qa: QaResult } => {
  const { section, decision, profile, minimumScore = 5 } = params;
  let candidate = params.text;

  const missingAction = !hasActionVerb(candidate);
  const missingOrganization = section !== "observations" && !hasOrganizationHint(candidate);
  const missingProgression = section !== "observations" && !hasProgressionHint(candidate);

  if (missingAction || missingOrganization || missingProgression) {
    candidate = buildFallbackSectionText({ section, decision, profile });
  }

  candidate = removeSectionLabelPrefix(candidate, section);
  candidate = postProcessDailyText(candidate);
  candidate = limitSentences(candidate, sentenceLimitByProfile[profile][section]);

  const translationResult = runTranslationTest({ section, text: candidate });
  if (!translationResult.ok) {
    candidate = buildFallbackSectionText({ section, decision, profile });
    candidate = removeSectionLabelPrefix(candidate, section);
    candidate = postProcessDailyText(candidate);
    candidate = limitSentences(candidate, sentenceLimitByProfile[profile][section]);
  }

  let qa = scoreSectionQuality({ section, text: candidate, profile });
  if (qa.score < minimumScore) {
    candidate = buildFallbackSectionText({ section, decision, profile });
    candidate = removeSectionLabelPrefix(candidate, section);
    candidate = postProcessDailyText(candidate);
    candidate = limitSentences(candidate, sentenceLimitByProfile[profile][section]);
    qa = scoreSectionQuality({ section, text: candidate, profile });
  }

  return { text: candidate, qa };
};

const pickLessonKind = (params: {
  weeklyPlan: ClassPlan;
  session: WeekSessionPreview;
  recentPlans?: DailyLessonPlan[];
}): LessonKind => {
  const { weeklyPlan, session, recentPlans } = params;
  const weekSeed = (weeklyPlan.weekNumber ?? 1) + session.sessionIndex;
  const tuesdayTrack: LessonKind[] = ["introducao", "pratica_guiada", "revisao"];
  const thursdayTrack: LessonKind[] = ["aplicacao", "mini_jogo", "revisao"];
  const defaultTrack: LessonKind[] = ["pratica_guiada", "aplicacao", "mini_jogo", "revisao", "introducao"];
  const track = session.weekday === 2 ? tuesdayTrack : session.weekday === 4 ? thursdayTrack : defaultTrack;

  const recentKinds = (recentPlans ?? [])
    .filter((plan) => plan.weeklyPlanId !== weeklyPlan.id || plan.date !== session.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 4)
    .map((plan) => parseDailyDecisionKind(plan.generationContextSnapshotJson))
    .filter((value): value is LessonKind => value !== null);

  const startIndex = weekSeed % track.length;
  for (let offset = 0; offset < track.length; offset += 1) {
    const candidate = track[(startIndex + offset) % track.length];
    if (!recentKinds.slice(0, 2).includes(candidate)) return candidate;
  }
  return track[startIndex];
};

const decidePedagogy = (params: {
  weeklyPlan: ClassPlan;
  session: WeekSessionPreview;
  context?: DailyGenerationContext;
}): PedagogicalDecision => {
  const { weeklyPlan, session, context } = params;
  const theme = normalizeFocus(weeklyPlan.theme, "Fundamentos da semana");
  const focus = normalizeFocus(weeklyPlan.technicalFocus, "toque e manchete");
  const pickedKind = pickLessonKind({ weeklyPlan, session, recentPlans: context?.recentPlans });
  const lessonKind = alignLessonKindToPeriodization({ initialKind: pickedKind, weeklyPlan });

  if (lessonKind === "introducao") {
    return {
      lessonKind,
      titleTag: "introdução",
      organization: "em duplas e trios, com metade da quadra",
      warmupOrganization: "em duplas",
      progression: "começa com bola lançada, depois entra o auto-lançamento e termina com troca contínua",
      purpose: `dar segurança no primeiro contato e melhorar ${focus}`,
      warmupAction: "troca de passes em dupla, com mudança de parceiro a cada rodada",
      mainAction: "circuito em 3 estações para trabalhar manchete, toque e saque curto em alvo",
      cooldownAction: "alongamento leve em roda e cada aluno fala um ponto para lembrar na próxima aula",
    };
  }

  if (lessonKind === "pratica_guiada") {
    return {
      lessonKind,
      titleTag: "prática guiada",
      organization: "em trios por corredor de quadra",
      warmupOrganization: "em duplas",
      progression: "começa mais controlado e depois pede escolha de direção e ritmo",
      purpose: `melhorar a repetição de ${theme} com mais controle`,
      warmupAction: "deslocamento com bola e passe curto em movimento, trocando função a cada rodada",
      mainAction: "sequência guiada de recepção, levantamento simples e envio para alvo",
      cooldownAction: "respiração, soltura de ombro e conversa rápida sobre o que saiu melhor",
    };
  }

  if (lessonKind === "aplicacao") {
    return {
      lessonKind,
      titleTag: "aplicação",
      organization: "em equipes reduzidas, com rodízio por tempo",
      warmupOrganization: "em duplas",
      progression: "começa no 2x2, passa para 3x3 e ganha uma regra nova no meio da atividade",
      purpose: `usar ${focus} em situação de jogo`,
      warmupAction: "troca de bola em dupla tentando manter a sequência por mais tempo",
      mainAction: "jogo curto com ponto extra quando a equipe cumpre a jogada combinada",
      cooldownAction: "fechamento em roda sobre o que funcionou melhor no jogo e o que ajustar na próxima aula",
    };
  }

  if (lessonKind === "mini_jogo") {
    return {
      lessonKind,
      titleTag: "mini jogo",
      organization: "quadra dividida em mini campos, times curtos",
      warmupOrganization: "em duplas",
      progression: "rodadas curtas com regra nova a cada rodada",
      purpose: `perceber espaço livre e decidir para onde jogar a bola usando ${focus}`,
      warmupAction: "brincadeira de reação com bola, mudando lado ou alvo no comando do professor",
      mainAction: "mini jogos com objetivos diferentes: manter troca, atacar zona livre e organizar defesa",
      cooldownAction: "desaceleração com caminhada, hidratação e uma fala curta de cada equipe",
    };
  }

  return {
    lessonKind: "revisao",
    titleTag: "revisão",
    organization: "estações com grupos pequenos",
    warmupOrganization: "em duplas",
    progression: "retoma os fundamentos da semana e fecha com atividade final curta",
    purpose: `consolidar ${theme} antes da próxima aula`,
    warmupAction: "revisão dos movimentos básicos em dupla, com orientações rápidas do professor",
    mainAction: "os alunos passam por estações para repetir os fundamentos e depois fazem uma atividade curta em situação de jogo",
    cooldownAction: "cada aluno fala o que melhorou e o que quer continuar treinando",
  };
};

const renderDailyText = (params: {
  profile: LanguageProfile;
  decision: PedagogicalDecision;
  weeklyPlan: ClassPlan;
  session: WeekSessionPreview;
  nextPedagogicalStep?: NextPedagogicalStep | null;
}): Pick<DailyLessonPlan, "title" | "warmup" | "mainPart" | "cooldown" | "observations"> & {
  qaSummary: {
    planScore: number;
    bySection: Record<DailySection, number>;
    translationTestPassed: boolean;
  };
} => {
  const { profile, decision, weeklyPlan, session, nextPedagogicalStep } = params;
  const theme = normalizeFocus(weeklyPlan.theme, "Fundamentos da semana");
  const pedagogicalRule = (weeklyPlan.pedagogicalRule ?? "").trim();
  const canonicalObjective = nextPedagogicalStep
    ? sanitizeVolleyballLanguage(renderPedagogicalObjective(nextPedagogicalStep))
    : "";
  const baseTitle = nextPedagogicalStep
    ? sanitizeVolleyballLanguage(`Etapa: ${renderStageFocusSummary(nextPedagogicalStep)}`)
    : buildLessonTitle(theme, decision);

  const rawWarmup = nextPedagogicalStep
    ? buildCanonicalSectionText({ section: "warmup", step: nextPedagogicalStep })
    : isYoungProfile(profile)
      ? `Dividir a turma ${resolveWarmupOrganization(decision)}. ${buildWarmupLine(decision, profile)}`
      : `Dividir a turma ${resolveWarmupOrganization(decision)}. ${buildWarmupLine(decision, profile)}`;
  const rawMainPart = nextPedagogicalStep
    ? buildCanonicalSectionText({ section: "main", step: nextPedagogicalStep })
    : isYoungProfile(profile)
      ? `${buildKidsMainPartLine(decision)} A atividade começa mais simples e depois ganha um desafio novo.`
      : `${decision.mainAction}. A atividade começa mais simples e depois ganha um desafio novo.`;
  const rawCooldown = nextPedagogicalStep
    ? buildCanonicalSectionText({ section: "cooldown", step: nextPedagogicalStep })
    : `${decision.cooldownAction}.`;
  const rawObservations = pedagogicalRule
    ? `Objetivo da aula: ${canonicalObjective || "manter progressão da etapa da turma"}. Retomar a regra da semana: ${pedagogicalRule}. Fazer demonstração curta e uma correção por vez.`
    : canonicalObjective
      ? `Objetivo da aula: ${canonicalObjective}. Registrar uma evidência curta de progresso ao final da sessão.`
    : isYoungProfile(profile)
      ? "Anotar o principal ponto que a turma ainda precisa melhorar para retomar na próxima aula."
      : "Anotar o principal ponto que a turma ainda precisa melhorar para retomar na próxima aula.";

  const warmupResult = enforceConcretenessAndQa({
    section: "warmup",
    text: rawWarmup,
    decision,
    profile,
  });
  const mainResult = enforceConcretenessAndQa({
    section: "mainPart",
    text: rawMainPart,
    decision,
    profile,
  });
  const cooldownResult = enforceConcretenessAndQa({
    section: "cooldown",
    text: rawCooldown,
    decision,
    profile,
  });
  const observationsResult = enforceConcretenessAndQa({
    section: "observations",
    text: rawObservations,
    decision,
    profile,
  });

  const sectionScores = {
    warmup: warmupResult.qa.score,
    mainPart: mainResult.qa.score,
    cooldown: cooldownResult.qa.score,
    observations: observationsResult.qa.score,
  };
  const avgScore =
    (sectionScores.warmup + sectionScores.mainPart + sectionScores.cooldown + sectionScores.observations) / 4;

  const translationPassed =
    runTranslationTest({ section: "warmup", text: warmupResult.text }).ok &&
    runTranslationTest({ section: "mainPart", text: mainResult.text }).ok &&
    runTranslationTest({ section: "cooldown", text: cooldownResult.text }).ok &&
    runTranslationTest({ section: "observations", text: observationsResult.text }).ok;

  const fallbackWarmup = limitSentences(
    postProcessDailyText(buildFallbackSectionText({ section: "warmup", decision, profile })),
    sentenceLimitByProfile[profile].warmup
  );
  const fallbackMain = limitSentences(
    postProcessDailyText(buildFallbackSectionText({ section: "mainPart", decision, profile })),
    sentenceLimitByProfile[profile].mainPart
  );
  const fallbackCooldown = limitSentences(
    postProcessDailyText(buildFallbackSectionText({ section: "cooldown", decision, profile })),
    sentenceLimitByProfile[profile].cooldown
  );
  const fallbackObs = limitSentences(
    postProcessDailyText(
      canonicalObjective
        ? `Objetivo da aula: ${canonicalObjective}. ${buildFallbackSectionText({ section: "observations", decision, profile })}`
        : buildFallbackSectionText({ section: "observations", decision, profile })
    ),
    sentenceLimitByProfile[profile].observations
  );

  const gatePassed = avgScore >= 5 && translationPassed;

  return {
    title: baseTitle,
    warmup: gatePassed ? warmupResult.text : fallbackWarmup,
    mainPart: gatePassed ? mainResult.text : fallbackMain,
    cooldown: gatePassed ? cooldownResult.text : fallbackCooldown,
    observations: gatePassed ? observationsResult.text : fallbackObs,
    qaSummary: {
      planScore: Number(avgScore.toFixed(2)),
      bySection: sectionScores,
      translationTestPassed: translationPassed,
    },
  };
};

export const buildAutoDailyLessonPlan = (
  weeklyPlan: ClassPlan,
  session: WeekSessionPreview,
  nowIso: string,
  existing?: DailyLessonPlan | null,
  context?: DailyGenerationContext
): DailyLessonPlan => {
  const nextPedagogicalStep = (() => {
    const rawAgeBand = context?.ageBand ?? "";
    const ageBandKey = normalizeAgeBandKey(rawAgeBand);
    if (!ageBandKey) return null;
    const rawDate = session.date ?? "";
    const iso = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : "";
    const monthIndex = iso ? new Date(`${iso}T00:00:00`).getMonth() + 1 : new Date().getMonth() + 1;
    const signals = extractRecentSignals(context?.recentPlans);
    return resolveNextPedagogicalStepFromPeriodization({
      ageBand: ageBandKey,
      monthIndex,
      recentConfirmedSkills: signals.recentConfirmedSkills,
      recentContexts: signals.recentContexts,
      historicalConfidence: signals.historicalConfidence,
    });
  })();
  const decision = decidePedagogy({ weeklyPlan, session, context });
  const profile = inferLanguageProfile(context);
  const blockTimes = getLessonBlockTimes(context?.durationMinutes ?? 60);
  const rendered = renderDailyText({
    profile,
    decision,
    weeklyPlan,
    session,
    nextPedagogicalStep,
  });
  const canonicalObjective = nextPedagogicalStep
    ? sanitizeVolleyballLanguage(renderPedagogicalObjective(nextPedagogicalStep))
    : rendered.observations.replace(/^Objetivo da aula:\s*/i, "");
  const operationalPlan = buildOperationalLessonPlan({
    weeklyPlan,
    decision,
    profile,
    blockTimes,
    sessionDate: session.date,
    canonicalObjective,
  });
  const alignmentCheck = checkLessonAlignmentWithPeriodization({
    weeklyPlan: {
      id: weeklyPlan.id,
      phase: weeklyPlan.phase,
      theme: weeklyPlan.theme,
      technicalFocus: weeklyPlan.technicalFocus,
      rpeTarget: weeklyPlan.rpeTarget,
      pedagogicalRule: weeklyPlan.pedagogicalRule,
    },
    sessionDate: session.date,
    ageBand: context?.ageBand,
    recentHistory: context?.recentPlans,
    activeCycle: {
      startDate: context?.cycleStartDate,
      endDate: context?.cycleEndDate,
    },
    dailyLessonPlan: {
      title: rendered.title,
      warmup: operationalPlan.warmup,
      mainPart: operationalPlan.mainPart,
      cooldown: operationalPlan.cooldown,
      observations: operationalPlan.observations,
      lessonKind: decision.lessonKind,
    },
    nextPedagogicalStep,
  });
  const contextSnapshot = {
    source: "daily-generator-v5-teacher-language",
    profile,
    generatedAt: nowIso,
    durationMinutes: context?.durationMinutes ?? 60,
    blockTimes,
    weeklyTheme: weeklyPlan.theme,
    weeklyTechnicalFocus: weeklyPlan.technicalFocus,
    nextPedagogicalStep,
    qaSummary: rendered.qaSummary,
    periodizationAlignment: alignmentCheck,
    dailyDecision: {
      lessonKind: decision.lessonKind,
      organization: decision.organization,
      progression: decision.progression,
      purpose: decision.purpose,
    },
  };

  const blocks = operationalPlan.blocks;
  const sessionIntegration = resolvePersistedSessionIntegration({
    weeklyPlan,
    session,
    context,
  });

  return {
    id: existing?.id ?? `dlp_${weeklyPlan.id}_${session.date}`,
    classId: weeklyPlan.classId,
    weeklyPlanId: weeklyPlan.id,
    date: session.date,
    dayOfWeek: session.weekday,
    title: rendered.title,
    blocksJson: serializeLessonBlocks(blocks),
    sessionComponents: sessionIntegration.sessionComponents,
    sessionEnvironment: sessionIntegration.sessionEnvironment,
    sessionPrimaryComponent: sessionIntegration.sessionPrimaryComponent,
    warmup: operationalPlan.warmup,
    mainPart: operationalPlan.mainPart,
    cooldown: operationalPlan.cooldown,
    observations: operationalPlan.observations,
    generationVersion: (existing?.generationVersion ?? 0) + 1,
    derivedFromWeeklyVersion: weeklyPlan.generationVersion ?? 1,
    generationModelVersion: "planning-v2-pedagogical",
    generationContextSnapshotJson: JSON.stringify(contextSnapshot),
    syncStatus: "in_sync",
    outOfSyncReasonsJson: "[]",
    manualOverridesJson: existing?.manualOverridesJson ?? "{}",
    manualOverrideMaskJson: existing?.manualOverrideMaskJson ?? "[]",
    lastAutoGeneratedAt: nowIso,
    lastManualEditedAt: existing?.lastManualEditedAt ?? nowIso,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
};

export const regenerateDailyLessonPlanFromWeek = (params: {
  existing: DailyLessonPlan | null;
  weeklyPlan: ClassPlan;
  session: WeekSessionPreview;
  context?: DailyGenerationContext;
}): DailyLessonPlan => {
  const nowIso = new Date().toISOString();
  const { existing, weeklyPlan, session, context } = params;
  const auto = buildAutoDailyLessonPlan(weeklyPlan, session, nowIso, existing, context);

  if (!existing) return auto;

  const overrideMask = parseOverrideMask(existing.manualOverrideMaskJson);
  if (!overrideMask.length) return auto;

  const merged = { ...auto };
  for (const field of overrideMask) {
    merged[field] = existing[field];
  }

  return {
    ...merged,
    sessionComponents: existing.sessionComponents ?? auto.sessionComponents,
    sessionEnvironment: existing.sessionEnvironment ?? auto.sessionEnvironment,
    sessionPrimaryComponent:
      existing.sessionPrimaryComponent ?? auto.sessionPrimaryComponent,
    syncStatus: "overridden",
    outOfSyncReasonsJson: "[]",
    manualOverrideMaskJson: JSON.stringify(overrideMask),
    manualOverridesJson: existing.manualOverridesJson || "{}",
  };
};
