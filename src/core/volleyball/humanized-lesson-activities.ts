import type { VolleyballLessonPlan, VolleyballSkill } from "../models";
import { parseAgeBandRange } from "../age-band";
import type { SessionPlanningContext } from "../session-planning-context";
import { buildPatternBackedVolleyballBlocks } from "./activity-pattern-engine";
import {
  evaluateActivityReality,
  type ActivityRealityScore,
} from "./activity-reality-score";
import type { ActivityFocusVariant } from "./activity-knowledge-patterns";

type ActivityStage = "warmup" | "drill" | "game" | "cooldown";
type LessonAgeStage = "early" | "base" | "transition" | "formation" | "specialization";

export type HumanizedLessonActivity = {
  id: string;
  stage: ActivityStage;
  name: string;
  description: string;
  participants: string;
  organization: string;
  starter: string;
  action: string;
  rotation: string;
  simpleRule: string;
  scoring?: string;
  materials: string[];
  space: string;
  execution: string;
  coachFocus: string;
  successCriteria: string;
  adaptation: string;
  primarySkill: VolleyballSkill;
  sourcePatternId?: string;
  validation?: {
    flags: string[];
    checklist: Record<string, boolean>;
    realityScore?: ActivityRealityScore;
  };
  presentation: {
    standardText: string;
    advancedText: string;
  };
};

export type HumanizedLessonBlocks = {
  warmup: HumanizedLessonActivity[];
  main: HumanizedLessonActivity[];
  cooldown: HumanizedLessonActivity[];
  validationFlags: string[];
};

export type VolleyballLessonAgeProfile = {
  stage: LessonAgeStage;
  label: string;
  gameForm: "mini_2x2" | "mini_3x3" | "mini_4x4" | "game_applied";
  organizationCue: string;
  challengeCue: string;
};

const VOLLEYBALL_SKILLS: VolleyballSkill[] = [
  "passe",
  "levantamento",
  "ataque",
  "bloqueio",
  "defesa",
  "saque",
  "transicao",
];

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeInline = (value: string | null | undefined) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

const ensureSentence = (value: string | null | undefined) => {
  const text = normalizeInline(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const asSkill = (value: string | null | undefined): VolleyballSkill => {
  const normalized = normalize(value);
  return VOLLEYBALL_SKILLS.includes(normalized as VolleyballSkill)
    ? (normalized as VolleyballSkill)
    : "passe";
};

const hasMancheteIntent = (plan: VolleyballLessonPlan) =>
  /\bmanchete|recepcao|recepção\b/i.test(normalize(plan.objective)) &&
  !/\bpasse\b/i.test(normalize(plan.objective));

const resolveAgeStage = (value: string | null | undefined): LessonAgeStage => {
  const raw = String(value ?? "").trim();
  const normalized = normalize(raw).replace(/\s+/g, "");
  if (/(14\+|sub14\+)/.test(normalized)) return "specialization";

  const range = parseAgeBandRange(raw);
  const numbers = (raw.match(/\d{1,2}/g) ?? [])
    .map(Number)
    .filter((item) => Number.isFinite(item));
  const endAge =
    Number.isFinite(range.end) && range.end !== Number.MAX_SAFE_INTEGER
      ? range.end
      : numbers.length
        ? Math.max(...numbers)
        : 0;

  if (!endAge) return "base";
  if (endAge <= 9) return "early";
  if (endAge <= 11) return "base";
  if (endAge <= 12) return "transition";
  if (endAge <= 15) return "formation";
  return "specialization";
};

const AGE_PROFILES: Record<LessonAgeStage, VolleyballLessonAgeProfile> = {
  early: {
    stage: "early",
    label: "06-09",
    gameForm: "mini_2x2",
    organizationCue: "brincadeira em meia quadra com troca rápida",
    challengeCue: "regra simples e participação alta",
  },
  base: {
    stage: "base",
    label: "09-11",
    gameForm: "mini_2x2",
    organizationCue: "duplas, trios e alvos grandes",
    challengeCue: "continuidade com 2 ou 3 contatos",
  },
  transition: {
    stage: "transition",
    label: "10-12",
    gameForm: "mini_3x3",
    organizationCue: "trios, zonas-alvo e decisão simples",
    challengeCue: "pontuação vinculada ao fundamento",
  },
  formation: {
    stage: "formation",
    label: "12-15",
    gameForm: "mini_4x4",
    organizationCue: "equipes em mini 4x4 com função definida",
    challengeCue: "oposição leve ou moderada e cobertura",
  },
  specialization: {
    stage: "specialization",
    label: "16+",
    gameForm: "game_applied",
    organizationCue: "jogo aplicado com zonas e responsabilidades",
    challengeCue: "pressão moderada e organização tática",
  },
};

const gameFormLabel = (value: VolleyballLessonAgeProfile["gameForm"]) => {
  if (value === "mini_2x2") return "mini 2x2";
  if (value === "mini_3x3") return "mini 3x3";
  if (value === "mini_4x4") return "mini 4x4";
  return "jogo aplicado";
};

export const resolveVolleyballLessonAgeProfile = (
  plan: Pick<VolleyballLessonPlan, "ageBand" | "className"> &
    Partial<Pick<VolleyballLessonPlan, "classId">>
): VolleyballLessonAgeProfile => {
  const source = [plan.ageBand, plan.className].filter(Boolean).join(" ");
  return AGE_PROFILES[resolveAgeStage(source)];
};

const buildStandardText = (activity: {
  organization?: string;
  execution?: string;
}) =>
  [ensureSentence(activity.organization), ensureSentence(activity.execution)]
    .filter(Boolean)
    .join(" ");

export const composeHumanizedActivityDescription = (
  activity: Partial<
    Pick<
      HumanizedLessonActivity,
      "organization" | "execution" | "coachFocus" | "successCriteria" | "adaptation"
    >
  > & { description?: string | null }
) => {
  const fields = [
    ["Organização", activity.organization],
    ["Execução", activity.execution],
    ["Foco do professor", activity.coachFocus],
    ["Critério de sucesso", activity.successCriteria],
    ["Adaptação", activity.adaptation],
  ]
    .map(([label, value]) => {
      const text = String(value ?? "").trim();
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean);

  return fields.length ? fields.join(" ") : String(activity.description ?? "").trim();
};

const buildRealityChecklist = (activity: Partial<HumanizedLessonActivity>) => {
  const text = normalize([
    activity.name,
    activity.participants,
    activity.organization,
    activity.starter,
    activity.action,
    activity.rotation,
    activity.simpleRule,
    activity.scoring,
    activity.execution,
    activity.space,
  ].join(" "));

  return {
    participants: /\b(aluno|alunos|dupla|duplas|trio|trios|grupo|grupos|equipe|equipes|turma|pegador|pegadores)\b/.test(text),
    organization: /\b(quadra|meia quadra|quadra reduzida|cones?|alvo|zona|rede|linha|bambole|bambolê|bola|bolas)\b/.test(text),
    starter: /\b(comeca|comecam|inicia|iniciam|abre|bola entra|lanca|lança|saca|sacador|pegadores|ao sinal)\b/.test(text),
    action: /\b(lancar|lançar|receber|passar|devolver|devolve|enviar|envia|manter|sacar|sacando|chamar|deslocar|deslocam|trocar|levantar|contato|contatos|jogar|organizar|ajustar|ajusta|realiza|faz|tenta|deixar|acertar|ocupar|ocupa|ocupam|acompanha|protege|fecha|reorganiza|entra|corre|correm|circula|cobre|cobertura|mirar|mira|anuncia|escolhe|recolhe|aguarda|comenta|comentam|guardar|guardam)\b/.test(text),
    rotation: /\b(troca|trocam|trocar|rodizio|rodízio|vira|passa|a cada|depois de|apos|após)\b/.test(text),
    lowWait: !/\bfila\b/.test(text) || /\bfila curta|filas curtas|rodizio rapido|rodízio rápido\b/.test(text),
    simpleRule: Boolean(normalizeInline(activity.simpleRule || activity.scoring || activity.execution)),
    skillFit: true,
  };
};

const buildRealityFlags = (
  activity: HumanizedLessonActivity,
  primarySkill: VolleyballSkill
) => {
  const flags: string[] = [];
  const checklist = buildRealityChecklist(activity);
  Object.entries(checklist).forEach(([key, passed]) => {
    if (!passed) flags.push(`Checklist incompleto em ${activity.name}: ${key}`);
  });

  const text = normalize([
    activity.name,
    activity.description,
    activity.presentation.standardText,
    activity.organization,
    activity.execution,
  ].join(" "));

  if (/\b(passe orientado|exploracao guiada|tarefa tecnica|ajuste de contato)\b/.test(text)) {
    flags.push(`Titulo ou texto generico em ${activity.name}.`);
  }
  if (/\bantes de virar\b/.test(text)) {
    flags.push(`Regra travada em ${activity.name}.`);
  }
  if (/\bfila\b/.test(text) && !/\bfila curta|filas curtas|rodizio rapido|rodizio rapido\b/.test(text)) {
    flags.push(`Fila longa em ${activity.name}.`);
  }
  if (/\bprofessor\b[^.]{0,50}\b(lanca|lança|alimenta|entrega|passa)\b[^.]{0,60}\b(um por vez|um de cada vez|cada aluno|fila)\b/.test(text)) {
    flags.push(`Professor virou gargalo em ${activity.name}.`);
  }
  if (/\b(so|só)\s+continua\b[^.]{0,60}\b(acertar|acerto|alvo|zona)\b|\b(acertar|acerto)\b[^.]{0,60}\bpara continuar\b/.test(text)) {
    flags.push(`Regra travada por acerto em ${activity.name}.`);
  }

  if (activity.stage === "warmup" && /\bbase baixa|bracos juntos|braços juntos|plataforma firme|correto|perfeito\b/.test(text)) {
    flags.push(`Prescricao motora indevida no aquecimento ${activity.name}.`);
  }

  if (primarySkill === "passe") {
    const settingSignals = (text.match(/\b(levantamento|levantador|distribuicao|organizar ataque|segundo contato|toque com cone|cone pega-toque|mini jogo com segundo contato definido)\b/g) ?? []).length;
    if (settingSignals > 0) flags.push(`Plano de passe derivou para levantamento em ${activity.name}.`);
  }

  return flags;
};

type HumanizedActivityInput = Omit<
  HumanizedLessonActivity,
  "id" | "primarySkill" | "description" | "presentation" | "validation"
>;

type HumanizedActivityPatch = Partial<HumanizedActivityInput>;

const makeActivity = (
  id: string,
  primarySkill: VolleyballSkill,
  activity: HumanizedActivityInput
): HumanizedLessonActivity => {
  const standardText = buildStandardText(activity);
  const next = {
    id,
    primarySkill,
    ...activity,
    description: "",
    presentation: {
      standardText,
      advancedText: "",
    },
    validation: {
      flags: [],
      checklist: buildRealityChecklist(activity),
    },
  };
  const description = composeHumanizedActivityDescription(next);
  const activityWithDescription = {
    ...next,
    description,
    presentation: {
      standardText,
      advancedText: description,
    },
  };
  const realityScore = evaluateActivityReality(activityWithDescription, {
    primarySkill,
  });
  return {
    ...activityWithDescription,
    validation: {
      checklist: buildRealityChecklist(activityWithDescription),
      flags: buildRealityFlags(activityWithDescription, primarySkill),
      realityScore,
    },
  };
};

const remakeActivity = (
  activity: HumanizedLessonActivity,
  primarySkill: VolleyballSkill,
  ageProfile: VolleyballLessonAgeProfile,
  patch: HumanizedActivityPatch
) =>
  makeActivity(`${activity.id}_${ageProfile.stage}`, primarySkill, {
    stage: activity.stage,
    name: activity.name,
    participants: activity.participants,
    organization: activity.organization,
    starter: activity.starter,
    action: activity.action,
    rotation: activity.rotation,
    simpleRule: activity.simpleRule,
    scoring: activity.scoring,
    materials: activity.materials,
    space: activity.space,
    execution: activity.execution,
    coachFocus: activity.coachFocus,
    successCriteria: activity.successCriteria,
    adaptation: activity.adaptation,
    sourcePatternId: activity.sourcePatternId
      ? `${activity.sourcePatternId}-${ageProfile.stage}`
      : undefined,
    ...patch,
  });



const includesAny = (values: string[], patterns: RegExp[]) =>
  values.some((value) => patterns.some((pattern) => pattern.test(normalize(value))));

const appendSentence = (base: string, addition: string) =>
  [ensureSentence(base), ensureSentence(addition)].filter(Boolean).join(" ");

const formatEventDate = (value: string) => {
  const normalized = String(value ?? "").slice(0, 10);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}` : normalized;
};

const buildEventReminder = (context?: SessionPlanningContext) => {
  const event = context?.upcomingEvents?.[0];
  if (!event?.title) return "";
  const date = formatEventDate(event.date);
  return date
    ? `Aviso rápido: ${event.title} em ${date}.`
    : `Aviso rápido: ${event.title}.`;
};

const buildContextualPatch = (
  activity: HumanizedLessonActivity,
  context?: SessionPlanningContext
): HumanizedActivityPatch | null => {
  if (!context) return null;

  const patch: HumanizedActivityPatch = {};
  const hasCommunicationDifficulty = includesAny(context.recentDifficulties, [
    /comunic/,
    /cham/,
    /organiz/,
  ]);
  const hasParticipationDifficulty = includesAny(context.recentDifficulties, [
    /particip/,
    /espera/,
  ]);
  const asksDecision =
    context.pedagogicalIntent === "decision_making" ||
    context.pedagogicalIntent === "game_reading" ||
    context.progressionDimension === "tomada_decisao" ||
    context.progressionDimension === "transferencia_jogo";
  const asksPressure =
    context.loadIntent === "alto" ||
    context.periodizationPhase === "pre_competitivo" ||
    context.periodizationPhase === "competitivo" ||
    context.progressionDimension === "pressao_tempo" ||
    context.progressionDimension === "oposicao";
  const repeatedTargetFamily = context.recentActivityFamilies.includes("alvo_zona");
  const repeatedGameFamily = context.recentActivityFamilies.includes("jogo_aplicado");

  if (activity.stage === "warmup" && hasParticipationDifficulty) {
    patch.simpleRule = "Erro não elimina ninguém; o grupo reinicia rápido e segue jogando.";
    patch.execution = appendSentence(
      activity.execution,
      "Erro não elimina ninguém; o grupo reinicia rápido e segue jogando."
    );
  }

  if (
    hasCommunicationDifficulty &&
    (activity.primarySkill === "passe" || activity.name.toLowerCase().includes("manchete")) &&
    activity.stage !== "cooldown"
  ) {
    patch.execution = appendSentence(
      patch.execution ?? activity.execution,
      "Quem recebe chama a bola antes do contato."
    );
    patch.simpleRule = appendSentence(
      patch.simpleRule ?? activity.simpleRule,
      "A jogada vale bônus quando a chamada aparece antes do primeiro contato."
    );
  }

  if (asksDecision && activity.stage === "game") {
    patch.execution = appendSentence(
      patch.execution ?? activity.execution,
      "Antes do rally, a equipe escolhe uma zona simples para proteger ou atacar. Vale ponto extra quando a escolha da zona aparece na jogada."
    );
    patch.scoring = appendSentence(
      patch.scoring ?? activity.scoring ?? "",
      "Ponto extra quando a escolha da zona aparece na jogada."
    );
  }

  if (asksPressure && activity.stage === "game") {
    patch.execution = appendSentence(
      patch.execution ?? activity.execution,
      "As rodadas são curtas, com troca de função a cada rally e placar até 3 pontos."
    );
    patch.simpleRule = appendSentence(
      patch.simpleRule ?? activity.simpleRule,
      "Placar curto até 3 pontos por rodada."
    );
  }

  if (repeatedTargetFamily && activity.stage === "drill" && /alvo|zona/i.test(activity.organization)) {
    patch.execution = appendSentence(
      patch.execution ?? activity.execution,
      "Na segunda rodada, o grupo muda a zona para não repetir o mesmo desafio da aula anterior."
    );
  }

  if (repeatedGameFamily && activity.stage === "game") {
    patch.simpleRule = appendSentence(
      patch.simpleRule ?? activity.simpleRule,
      "A regra muda no meio da atividade para não repetir o jogo da aula anterior."
    );
  }

  if (activity.stage === "cooldown") {
    const eventReminder = buildEventReminder(context);
    if (eventReminder) {
      patch.execution = appendSentence(activity.execution, eventReminder);
      patch.simpleRule = appendSentence(activity.simpleRule, "Aviso somente sobre evento real da turma.");
    }
  }

  return Object.keys(patch).length ? patch : null;
};

const applySessionContextPatches = (
  blocks: Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown">,
  primarySkill: VolleyballSkill,
  ageProfile: VolleyballLessonAgeProfile,
  context?: SessionPlanningContext
): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => {
  if (!context) return blocks;
  const apply = (activity: HumanizedLessonActivity) => {
    const patch = buildContextualPatch(activity, context);
    return patch ? remakeActivity(activity, primarySkill, ageProfile, patch) : activity;
  };
  return {
    warmup: blocks.warmup.map(apply),
    main: blocks.main.map(apply),
    cooldown: blocks.cooldown.map(apply),
  };
};

const feedbackCooldown = (primarySkill: VolleyballSkill) =>
  makeActivity("cooldown_feedback_1", primarySkill, {
    stage: "cooldown",
    name: "Conversa e feedbacks finais",
    participants: "turma inteira",
    organization:
      "Reunir a turma na lateral da quadra, perto das bolas e cones.",
    starter: "O professor abre a conversa com uma pergunta curta.",
    action:
      "Cada grupo comenta uma coisa que ajudou a jogar melhor e todos organizam os materiais.",
    rotation: "A fala passa rapidamente de grupo em grupo antes do encerramento.",
    simpleRule: "Resposta curta por grupo.",
    materials: ["bolas", "cones"],
    space: "lateral da quadra",
    execution:
      "Cada grupo comenta uma coisa que ajudou a jogar melhor e todos organizam os materiais.",
    coachFocus:
      "Registrar uma percepção simples da turma e conectar com a próxima aula.",
    successCriteria:
      "A turma encerra sabendo o que funcionou melhor na atividade.",
    adaptation:
      "Se a turma estiver agitada, pedir apenas uma palavra por grupo.",
    sourcePatternId: "corpus-volleyball-cooldown-feedback",
  });

















const genericSkillLabel: Record<VolleyballSkill, string> = {
  passe: "passe",
  levantamento: "levantamento",
  ataque: "ataque",
  bloqueio: "bloqueio",
  defesa: "defesa",
  saque: "saque",
  transicao: "transição",
};

const buildGenericBlocks = (
  primarySkill: VolleyballSkill,
  ageProfile: VolleyballLessonAgeProfile
): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => ({
  warmup: [
    makeActivity(`warmup_${primarySkill}_atividade_aberta`, primarySkill, {
      stage: "warmup",
      name:
        ageProfile.stage === "early"
          ? `Brincadeira com ${genericSkillLabel[primarySkill]}`
          : `Aquecimento com ${genericSkillLabel[primarySkill]} em ${gameFormLabel(ageProfile.gameForm)}`,
      participants:
        ageProfile.stage === "early" || ageProfile.stage === "base"
          ? "duplas ou trios"
          : "equipes pequenas",
      organization:
        `Dividir a quadra em espaços pequenos para ${ageProfile.organizationCue}.`,
      starter: "Um aluno inicia a bola ao sinal do professor.",
      action:
        `O grupo troca bolas simples incluindo o ${genericSkillLabel[primarySkill]} dentro da tarefa.`,
      rotation: "A cada rodada, muda quem inicia a bola.",
      simpleRule: ageProfile.challengeCue,
      materials: ["bolas", "cones"],
      space: ageProfile.gameForm === "game_applied" ? "quadra reduzida ou inteira" : "quadra em espaços pequenos",
      execution:
        `Um aluno inicia a bola ao sinal do professor. O grupo troca bolas simples incluindo o ${genericSkillLabel[primarySkill]} dentro da tarefa. A cada rodada, muda quem inicia a bola.`,
      coachFocus:
        "Observar participação e continuidade da bola.",
      successCriteria:
        "Todos participam com poucas pausas e função clara.",
      adaptation:
        "Facilitar reduzindo distância; dificultar aumentando a oposição.",
    }),
  ],
  main: [
    makeActivity(`main_${primarySkill}_jogo_operacional`, primarySkill, {
      stage: "game",
      name: `${genericSkillLabel[primarySkill]} em ${gameFormLabel(ageProfile.gameForm)}`,
      participants:
        ageProfile.stage === "early" || ageProfile.stage === "base"
          ? "duplas ou trios"
          : "equipes pequenas",
      organization:
        `${ageProfile.gameForm === "game_applied" ? "Montar equipes em quadra reduzida ou inteira" : `Montar ${gameFormLabel(ageProfile.gameForm)}`} com zonas simples marcadas por cones.`,
      starter: "A bola entra por lançamento ou ação adaptada.",
      action:
        `A equipe tenta usar o ${genericSkillLabel[primarySkill]} dentro do rally.`,
      rotation: "Depois de cada rally, troca quem inicia a bola.",
      simpleRule: ageProfile.challengeCue,
      scoring: "Ponto extra quando a equipe usa o fundamento combinado.",
      materials: ["bolas", "cones"],
      space: ageProfile.gameForm === "game_applied" ? "quadra reduzida ou inteira" : "quadra reduzida",
      execution:
        `A bola entra por lançamento ou ação adaptada. A equipe tenta usar o ${genericSkillLabel[primarySkill]} dentro do rally. Vale ponto extra quando o tema aparece no jogo.`,
      coachFocus:
        "Observar se o fundamento aparece em situação de jogo.",
      successCriteria:
        "A equipe aplica o fundamento em rallies curtos.",
      adaptation:
        "Facilitar permitindo lançamento; dificultar reduzindo o espaço.",
    }),
  ],
  cooldown: [feedbackCooldown(primarySkill)],
});

const buildActivityPatternBlocks = (
  primarySkill: VolleyballSkill,
  ageProfile: VolleyballLessonAgeProfile,
  context?: SessionPlanningContext,
  focusVariant?: ActivityFocusVariant
): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => {
  const patternBlocks = buildPatternBackedVolleyballBlocks({
    primarySkill,
    focusVariant,
    ageProfile,
    periodizationPhase: context?.periodizationPhase,
    progressionDimension: context?.progressionDimension,
    pedagogicalIntent: context?.pedagogicalIntent,
    loadIntent: context?.loadIntent,
    materials: context?.materials?.length ? context.materials : ["bolas", "cones"],
    classSize: context?.classProfile.size ?? 0,
    recentActivityFamilies: context?.recentActivityFamilies ?? [],
    recentActivityNames: context?.recentActivityNames ?? [],
    recentActivityPatternIds: context?.recentActivityPatternIds ?? [],
    upcomingEvents: context?.upcomingEvents ?? [],
  });

  if (!patternBlocks.warmup.length || !patternBlocks.main.length) {
    return buildGenericBlocks(primarySkill, ageProfile);
  }

  return {
    warmup: patternBlocks.warmup.map((activity) =>
      makeActivity(activity.id, primarySkill, activity)
    ),
    main: patternBlocks.main.map((activity) =>
      makeActivity(activity.id, primarySkill, activity)
    ),
    cooldown: patternBlocks.cooldown.length
      ? patternBlocks.cooldown.map((activity) =>
          makeActivity(activity.id, primarySkill, activity)
        )
      : [feedbackCooldown(primarySkill)],
  };
};

const withValidation = (
  blocks: Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown">,
  primarySkill: VolleyballSkill,
  context?: SessionPlanningContext
): HumanizedLessonBlocks => ({
  ...blocks,
  validationFlags: validateHumanizedVolleyballBlocks(blocks, primarySkill, context),
});

export const buildHumanizedVolleyballLessonBlocks = (
  plan: VolleyballLessonPlan,
  context?: SessionPlanningContext
): HumanizedLessonBlocks => {
  const primarySkill = asSkill(plan.primaryFocus.skill);
  const ageProfile = resolveVolleyballLessonAgeProfile(plan);
  const focusVariant =
    primarySkill === "passe" && hasMancheteIntent(plan) ? "manchete" : undefined;
  const blocks = applySessionContextPatches(
    buildActivityPatternBlocks(primarySkill, ageProfile, context, focusVariant),
    primarySkill,
    ageProfile,
    context
  );
  return withValidation(blocks, primarySkill, context);
};

export const validateHumanizedVolleyballBlocks = (
  blocks: Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown">,
  primarySkill: VolleyballSkill,
  context?: SessionPlanningContext
) => {
  const flags: string[] = [];
  const allActivities = [...blocks.warmup, ...blocks.main, ...blocks.cooldown];
  const seen = new Set<string>();
  const forbidden = [
    /vwv_/i,
    /refer[eê]ncia t[eé]cnica/i,
    /explora[cç][aã]o guiada/i,
    /teste de formas/i,
    /progress[aã]o orientada/i,
    /\bladder\b/i,
    /\b[a-z]{2,}_[a-z0-9_]{2,}\b/i,
    /descri[cç][aã]o gerada/i,
    /atividade\s+estruturada/i,
    /organiza[cç][aã]o\s+de\s+ataque/i,
    /\bpasse orientado\b/i,
    /\btarefa t[eé]cnica\b/i,
    /\bajuste de contato\b/i,
  ];
  const forbiddenPdfLabels = /Foco do professor:|Meta:|Adapta[cç][aã]o:|Crit[eé]rio de sucesso:|primarySkill/i;

  allActivities.forEach((activity) => {
    const key = normalize(`${activity.name} ${activity.presentation.standardText}`);
    if (seen.has(key)) {
      flags.push(`Atividade repetida: ${activity.name}`);
    }
    seen.add(key);

    const requiredFields: (keyof HumanizedLessonActivity)[] = [
      "stage",
      "participants",
      "organization",
      "starter",
      "action",
      "rotation",
      "simpleRule",
      "execution",
      "coachFocus",
      "successCriteria",
      "adaptation",
      "primarySkill",
    ];
    requiredFields.forEach((field) => {
      if (!String(activity[field] ?? "").trim()) {
        flags.push(`Campo ausente em ${activity.name}: ${field}`);
      }
    });

    const text = [
      activity.name,
      activity.description,
      activity.presentation.standardText,
      activity.organization,
      activity.execution,
      activity.coachFocus,
      activity.successCriteria,
      activity.adaptation,
    ].join(" ");
    forbidden.forEach((pattern) => {
      if (pattern.test(text)) {
        flags.push(`Linguagem artificial em ${activity.name}`);
      }
    });

    if (forbiddenPdfLabels.test(activity.presentation.standardText)) {
      flags.push(`Campo interno vazou para apresentacao em ${activity.name}.`);
    }

    activity.validation?.realityScore?.flags.forEach((flag) => {
      flags.push(`Reality flag ${flag} em ${activity.name}.`);
    });

    if (/acertar[^.]{0,30}(alvo|zona)[^.]{0,30}continuar|continuar[^.]{0,30}acertar[^.]{0,30}(alvo|zona)/i.test(text)) {
      flags.push(`Regra depende de acertar alvo para continuar em ${activity.name}.`);
    }

    if (
      !context?.upcomingEvents?.length &&
      /(festival|torneio|amistoso|evento\s+(?:da|do|em|no|na)|cronograma)/i.test(text)
    ) {
      flags.push(`Aviso de evento sem evento real em ${activity.name}.`);
    }

    buildRealityFlags(activity, primarySkill).forEach((flag) => flags.push(flag));
  });

  if (primarySkill === "passe") {
    const mainText = normalize(blocks.main.map((activity) => `${activity.name} ${activity.presentation.standardText}`).join(" "));
    const passSignals = (mainText.match(/\b(passe|passes|manchete|recepcao|primeiro contato|contato|contatos|jogavel|jogável)\b/g) ?? []).length;
    const settingSignals = (mainText.match(/\b(levantamento|levantador|distribuicao|organizar ataque|segundo contato|toque com cone|cone pega-toque|mini jogo com segundo contato definido)\b/g) ?? []).length;
    if (passSignals < 3) {
      flags.push("Plano de passe sem sinais suficientes de passe/manchete/recepcao.");
    }
    if (settingSignals > 0) {
      flags.push("Plano de passe derivou para levantamento.");
    }
  }

  if (primarySkill === "saque") {
    const mainText = normalize(blocks.main.map((activity) => `${activity.name} ${activity.presentation.standardText}`).join(" "));
    const serveSignals = (mainText.match(/\b(saque|sacar|saca|sacando|sacador)\b/g) ?? []).length;
    if (serveSignals < 4) {
      flags.push("Plano de saque sem sinais suficientes de saque.");
    }
  }

  if (primarySkill === "levantamento") {
    const mainText = normalize(blocks.main.map((activity) => `${activity.name} ${activity.presentation.standardText}`).join(" "));
    const settingSignals = (mainText.match(/\b(levantamento|levanta|segundo contato|toque|bola alta)\b/g) ?? []).length;
    if (settingSignals < 3) {
      flags.push("Plano de levantamento sem sinais suficientes de levantamento.");
    }
  }

  return [...new Set(flags)];
};
