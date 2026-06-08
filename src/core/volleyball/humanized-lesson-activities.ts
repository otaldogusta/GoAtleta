import type { VolleyballLessonPlan, VolleyballSkill } from "../models";
import { parseAgeBandRange } from "../age-band";
import type { SessionPlanningContext } from "../session-planning-context";

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
  plan: Pick<VolleyballLessonPlan, "ageBand" | "className" | "classId">
): VolleyballLessonAgeProfile => {
  const source = [plan.ageBand, plan.className, plan.classId].filter(Boolean).join(" ");
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
    action: /\b(lancar|lançar|receber|passar|devolver|devolve|enviar|envia|manter|sacar|sacando|chamar|deslocar|deslocam|trocar|levantar|contato|contatos|jogar|organizar|ajustar|ajusta|realiza|faz|tenta|deixar|acertar|ocupar|ocupam|entra|corre|correm|circula|cobre|mirar|mira|anuncia|escolhe|recolhe|aguarda)\b/.test(text),
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

  if (activity.stage === "warmup" && /\bbase baixa|bracos juntos|braços juntos|plataforma firme|correto|perfeito\b/.test(text)) {
    flags.push(`Prescricao motora indevida no aquecimento ${activity.name}.`);
  }

  if (primarySkill === "passe") {
    const settingSignals = (text.match(/\b(levantamento|levantador|distribuicao|organizar ataque)\b/g) ?? []).length;
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
  return {
    ...activityWithDescription,
    validation: {
      checklist: buildRealityChecklist(activityWithDescription),
      flags: buildRealityFlags(activityWithDescription, primarySkill),
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

const applyAgePatches = (
  blocks: Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown">,
  primarySkill: VolleyballSkill,
  ageProfile: VolleyballLessonAgeProfile,
  patches: Partial<Record<LessonAgeStage, Record<string, HumanizedActivityPatch>>>
): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => {
  const patchSet = patches[ageProfile.stage];
  if (!patchSet) return blocks;
  const apply = (activity: HumanizedLessonActivity) => {
    const patch = patchSet[activity.id];
    return patch ? remakeActivity(activity, primarySkill, ageProfile, patch) : activity;
  };
  return {
    warmup: blocks.warmup.map(apply),
    main: blocks.main.map(apply),
    cooldown: blocks.cooldown.map(apply),
  };
};

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

const PASSE_AGE_PATCHES: Partial<Record<LessonAgeStage, Record<string, HumanizedActivityPatch>>> = {
  base: {
    warmup_passe_pega_3_contatos: {
      name: "Caça aos 3 contatos",
      participants: "trios",
      organization:
        "Delimitar meia quadra com 3 zonas marcadas por cones e uma bola por trio.",
      starter: "Um trio inicia a bola ao sinal do professor.",
      action:
        "O trio tenta fazer 3 contatos livres e correr para outra zona antes de reiniciar.",
      rotation: "Depois de cada sequência, muda quem faz o primeiro contato.",
      simpleRule: "Vale continuar mesmo se a bola cair; o grupo só reinicia na zona seguinte.",
      execution:
        "Um trio inicia a bola ao sinal do professor. O trio tenta fazer 3 contatos livres e correr para outra zona antes de reiniciar. Depois de cada sequência, muda quem faz o primeiro contato.",
      coachFocus:
        "Observar comunicação e participação sem corrigir cada contato.",
      successCriteria:
        "O trio mantém participação alta e organiza 2 ou 3 contatos em sequência.",
      adaptation:
        "Facilitar permitindo segurar uma bola; dificultar pedindo deslocamento maior entre zonas.",
    },
    main_passe_duplas_jogavel: {
      name: "Passe em duplas para zona-alvo",
      organization:
        "Em duplas, marcar uma zona-alvo grande com cones a 3 ou 4 metros.",
      starter: "Um aluno começa lançando a bola por baixo.",
      action:
        "O colega devolve de passe ou manchete tentando mandar a bola para a zona-alvo.",
      rotation: "A cada 5 bolas, trocam quem lança e quem recebe.",
      simpleRule: "A bola precisa chegar perto da zona para a dupla marcar ponto.",
      scoring: "Vale 1 ponto quando a bola chega jogável na zona-alvo.",
      execution:
        "Um aluno lança a bola por baixo e o colega devolve para a zona-alvo marcada por cones. A cada 5 bolas, trocam quem lança e quem recebe. Vale 1 ponto quando a bola chega jogável na zona-alvo.",
    },
    main_passe_desafio_3_passes: {
      name: "Mini 2x2 dos 3 contatos",
      participants: "duplas contra duplas",
      organization:
        "Montar miniquadras 2x2 com cones e uma bola por quadra.",
      starter: "Uma dupla inicia a bola por lançamento.",
      action:
        "A dupla tenta organizar 2 ou 3 contatos antes de devolver para o outro lado.",
      rotation: "Depois de cada rally, troca quem inicia a bola.",
      simpleRule: "O ponto vale quando a dupla devolve mantendo a bola jogável.",
      scoring: "Ponto extra quando aparecem 3 contatos.",
      execution:
        "Uma dupla inicia por lançamento. A dupla tenta organizar 2 ou 3 contatos antes de devolver para o outro lado. Depois de cada rally, troca quem inicia. Ponto extra quando aparecem 3 contatos.",
    },
  },
  transition: {
    warmup_passe_pega_3_contatos: {
      name: "Roda dos alvos jogáveis",
      participants: "trios",
      organization:
        "Formar trios em meia quadra, com uma zona-alvo marcada por cone para cada trio.",
      starter: "Um aluno começa lançando a bola para o colega do trio.",
      action:
        "O trio circula a bola tentando fazer o primeiro contato chegar jogável na zona.",
      rotation: "A cada 4 bolas, troca quem inicia e quem ocupa a zona.",
      simpleRule: "O trio marca ponto quando a bola chega jogável para o próximo colega.",
      scoring: "Vale 1 ponto por bola jogável na zona.",
      execution:
        "Um aluno começa lançando a bola para o colega do trio. O trio circula a bola tentando fazer o primeiro contato chegar jogável na zona. A cada 4 bolas, troca quem inicia e quem ocupa a zona.",
    },
    main_passe_duplas_jogavel: {
      name: "Passe em trio com chamada",
      participants: "trios",
      organization:
        "Em trios, um aluno lança, um recebe e um ocupa a zona-alvo.",
      starter: "O lançador inicia a bola por baixo.",
      action:
        "Quem recebe chama a bola e tenta enviar o passe jogável para a zona do colega.",
      rotation: "Depois de 5 bolas, o trio roda as funções.",
      simpleRule: "Quem recebe precisa chamar antes do contato.",
      scoring: "Vale ponto quando o passe chega jogável para o colega da zona.",
      execution:
        "O lançador inicia a bola por baixo. Quem recebe chama a bola e tenta enviar o passe jogável para a zona do colega. Depois de 5 bolas, o trio roda as funções.",
    },
    main_passe_desafio_3_passes: {
      name: "Mini 3x3 com primeiro contato pontuado",
      participants: "equipes de 3",
      organization:
        "Montar miniquadras 3x3 e marcar uma zona simples para o primeiro contato.",
      starter: "A bola entra por lançamento ou saque adaptado.",
      action:
        "A equipe joga o rally e tenta fazer o primeiro contato chegar jogável na zona marcada.",
      rotation: "Depois de cada rally, troca quem inicia a bola.",
      simpleRule: "A jogada continua depois do primeiro contato.",
      scoring: "Vale ponto extra quando o primeiro contato chega jogável na zona.",
      execution:
        "A bola entra por lançamento ou saque adaptado. A equipe joga o rally e tenta fazer o primeiro contato chegar jogável na zona marcada. Vale ponto extra quando isso acontece.",
    },
  },
  formation: {
    warmup_passe_pega_3_contatos: {
      name: "Roda de cobertura do primeiro contato",
      participants: "grupos de 4",
      organization:
        "Formar grupos de 4 em meia quadra, com uma zona de recepção e uma zona de cobertura.",
      starter: "Um aluno inicia com lançamento variado.",
      action:
        "O grupo recebe, cobre e devolve a bola para manter a sequência jogável.",
      rotation: "A cada rodada, muda quem lança e quem cobre.",
      simpleRule: "A bola só vale quando alguém cobre o primeiro contato.",
      execution:
        "Um aluno inicia com lançamento variado. O grupo recebe, cobre e devolve a bola para manter a sequência jogável. A cada rodada, muda quem lança e quem cobre.",
    },
    main_passe_duplas_jogavel: {
      name: "Passe sob lançamento variado",
      participants: "grupos de 4",
      organization:
        "Em grupos de 4, marcar zonas curta e funda para recepção.",
      starter: "Um aluno inicia alternando lançamentos curtos e fundos.",
      action:
        "Quem recebe ajusta o deslocamento e envia o passe para a zona combinada.",
      rotation: "Depois de 6 bolas, o grupo roda as funções.",
      simpleRule: "Antes do lançamento, o grupo define a zona que vale ponto.",
      scoring: "Vale ponto quando o passe chega jogável na zona chamada.",
      execution:
        "Um aluno inicia alternando lançamentos curtos e fundos. Quem recebe ajusta o deslocamento e envia o passe para a zona combinada. Depois de 6 bolas, o grupo roda as funções.",
    },
    main_passe_desafio_3_passes: {
      name: "Mini 4x4 com zona de recepção",
      participants: "equipes de 4",
      organization:
        "Montar mini 4x4 com zona de recepção e zona de cobertura marcadas por cones.",
      starter: "A bola entra por saque adaptado ou lançamento.",
      action:
        "A equipe organiza o primeiro contato e cobre a bola antes de devolver.",
      rotation: "A equipe troca o sacador ou lançador a cada rally.",
      simpleRule: "O rally segue, mas o bônus depende do primeiro contato jogável.",
      scoring: "Vale ponto extra quando recepção e cobertura aparecem no rally.",
      execution:
        "A bola entra por saque adaptado ou lançamento. A equipe organiza o primeiro contato e cobre a bola antes de devolver. Vale ponto extra quando recepção e cobertura aparecem no rally.",
    },
  },
  specialization: {
    warmup_passe_pega_3_contatos: {
      name: "Ativação com recepção em zonas",
      participants: "grupos de 4 ou 5",
      organization:
        "Montar zonas de recepção e cobertura em meia quadra.",
      starter: "Um aluno inicia com saque adaptado ou lançamento tenso.",
      action:
        "O grupo recebe, comunica a zona e cobre o primeiro contato.",
      rotation: "A cada 5 bolas, muda quem inicia e quem recebe.",
      simpleRule: "A bola vale quando recepção e cobertura ficam organizadas.",
      execution:
        "Um aluno inicia com saque adaptado ou lançamento tenso. O grupo recebe, comunica a zona e cobre o primeiro contato. A cada 5 bolas, muda quem inicia e quem recebe.",
    },
    main_passe_duplas_jogavel: {
      name: "Recepção com alvo e cobertura",
      participants: "grupos de 5",
      organization:
        "Organizar uma linha de recepção, uma zona-alvo e um aluno na cobertura.",
      starter: "O sacador inicia mirando uma zona combinada.",
      action:
        "A linha recebe, envia a bola para a zona-alvo e o colega cobre a sobra.",
      rotation: "Depois de 6 saques, roda sacador, recebedores e cobertura.",
      simpleRule: "A equipe define antes qual zona de recepção será protegida.",
      scoring: "Vale ponto quando a recepção chega jogável e a cobertura aparece.",
      execution:
        "O sacador inicia mirando uma zona combinada. A linha recebe, envia a bola para a zona-alvo e o colega cobre a sobra. Depois de 6 saques, roda sacador, recebedores e cobertura.",
    },
    main_passe_desafio_3_passes: {
      name: "Jogo aplicado com bônus de recepção",
      participants: "equipes",
      organization:
        "Jogar em quadra reduzida ou inteira, com zonas de recepção marcadas.",
      starter: "Todo rally começa com saque.",
      action:
        "A equipe joga normalmente, buscando primeiro contato jogável e cobertura.",
      rotation: "A equipe troca o sacador a cada rally.",
      simpleRule: "O bônus só vale quando a recepção permite continuidade.",
      scoring: "Vale ponto bônus para recepção jogável com cobertura ativa.",
      execution:
        "Todo rally começa com saque. A equipe joga normalmente, buscando primeiro contato jogável e cobertura. Vale ponto bônus para recepção jogável com cobertura ativa.",
    },
  },
};

const MANCHETE_AGE_PATCHES: Partial<Record<LessonAgeStage, Record<string, HumanizedActivityPatch>>> = {
  base: {
    warmup_manchete_corre_chama: {
      name: "Chama e passa para o colega",
      organization:
        "Formar trios em meia quadra, com uma bola e um cone-alvo por trio.",
      starter: "Um aluno lança a bola por baixo para o espaço do trio.",
      action:
        "Quem estiver mais perto chama a bola e passa para o colega perto do cone.",
      rotation: "Depois de cada bola, muda quem lança.",
      simpleRule: "Só vale quando alguém chama antes do contato.",
      execution:
        "Um aluno lança a bola por baixo para o espaço do trio. Quem estiver mais perto chama a bola e passa para o colega perto do cone. Depois de cada bola, muda quem lança.",
    },
    main_manchete_alvo: {
      name: "Manchete em dupla com alvo grande",
      organization:
        "Em duplas, marcar um alvo grande com cones ou bambolê.",
      rotation: "A cada 5 tentativas, trocam quem lança e quem recebe.",
      execution:
        "Um aluno lança a bola por baixo e o outro recebe de manchete tentando enviar para o alvo grande. A cada 5 tentativas, trocam quem lança e quem recebe.",
    },
    main_manchete_miniquadra: {
      name: "Mini 2x2 do primeiro contato",
      participants: "duplas contra duplas",
      organization:
        "Montar miniquadras 2x2 com uma zona simples para o primeiro contato.",
      starter: "A bola entra por lançamento.",
      action:
        "A dupla tenta chamar, receber e devolver mantendo a bola jogável.",
      rotation: "Depois de cada rally, troca quem inicia a bola.",
      scoring: "Vale ponto extra quando a manchete chega jogável.",
      execution:
        "A bola entra por lançamento. A dupla tenta chamar, receber e devolver mantendo a bola jogável. Vale ponto extra quando a manchete chega jogável.",
    },
  },
  transition: {
    warmup_manchete_corre_chama: {
      name: "Corre, chama e cobre",
      participants: "trios",
      organization:
        "Formar trios com uma zona de recepção e outra de cobertura.",
      starter: "Um aluno lança a bola para uma das zonas.",
      action:
        "Quem recebe chama a bola e outro colega cobre a sobra.",
      rotation: "A cada 4 bolas, o trio roda as funções.",
      simpleRule: "A bola vale quando recepção e cobertura aparecem.",
      execution:
        "Um aluno lança a bola para uma das zonas. Quem recebe chama a bola e outro colega cobre a sobra. A cada 4 bolas, o trio roda as funções.",
    },
    main_manchete_alvo: {
      name: "Manchete com deslocamento e chamada",
      participants: "trios",
      organization:
        "Em trios, marcar alvos à direita e à esquerda com cones.",
      starter: "O lançador chama a direção antes da bola.",
      action:
        "Quem recebe desloca, chama e envia a manchete para o alvo indicado.",
      rotation: "Depois de 6 bolas, o trio troca as funções.",
      scoring: "Vale ponto quando a bola chega jogável no alvo indicado.",
      execution:
        "O lançador chama a direção antes da bola. Quem recebe desloca, chama e envia a manchete para o alvo indicado. Depois de 6 bolas, o trio troca as funções.",
    },
    main_manchete_miniquadra: {
      name: "Mini 3x3 com recepção combinada",
      participants: "equipes de 3",
      organization:
        "Montar miniquadras 3x3 com zona combinada para recepção.",
      starter: "A bola entra por lançamento ou saque adaptado.",
      action:
        "A equipe tenta fazer a manchete chegar jogável na zona combinada.",
      rotation: "Depois de cada rally, troca quem inicia.",
      scoring: "Vale ponto extra quando a recepção chega jogável.",
      execution:
        "A bola entra por lançamento ou saque adaptado. A equipe tenta fazer a manchete chegar jogável na zona combinada. Vale ponto extra quando a recepção chega jogável.",
    },
  },
  formation: {
    main_manchete_alvo: {
      name: "Recepção de manchete com zonas",
      participants: "grupos de 4",
      organization:
        "Marcar zonas curta e funda para recepção em meia quadra.",
      starter: "Um aluno inicia com lançamento variado.",
      action:
        "Quem recebe comunica a bola e envia a manchete para a zona combinada.",
      rotation: "A cada 6 bolas, o grupo roda as funções.",
      scoring: "Vale ponto quando a recepção chega jogável na zona chamada.",
      execution:
        "Um aluno inicia com lançamento variado. Quem recebe comunica a bola e envia a manchete para a zona combinada. A cada 6 bolas, o grupo roda as funções.",
    },
    main_manchete_miniquadra: {
      name: "Mini 4x4 com cobertura da recepção",
      participants: "equipes de 4",
      organization:
        "Montar mini 4x4 com zona de recepção e aluno de cobertura.",
      starter: "A bola entra por saque adaptado.",
      action:
        "A equipe recebe, cobre e devolve a bola em continuidade.",
      rotation: "A equipe troca sacador ou lançador a cada rally.",
      scoring: "Vale ponto extra quando recepção e cobertura aparecem.",
      execution:
        "A bola entra por saque adaptado. A equipe recebe, cobre e devolve a bola em continuidade. Vale ponto extra quando recepção e cobertura aparecem.",
    },
  },
  specialization: {
    main_manchete_alvo: {
      name: "Recepção sob pressão moderada",
      participants: "grupos de 5",
      organization:
        "Organizar linha de recepção, zona-alvo e cobertura em meia quadra.",
      starter: "O sacador inicia mirando uma zona combinada.",
      action:
        "A recepção tenta chegar jogável na zona-alvo com cobertura ativa.",
      rotation: "A cada 6 saques, roda sacador, recebedores e cobertura.",
      scoring: "Vale ponto quando a recepção sustenta a continuidade.",
      execution:
        "O sacador inicia mirando uma zona combinada. A recepção tenta chegar jogável na zona-alvo com cobertura ativa. A cada 6 saques, roda sacador, recebedores e cobertura.",
    },
    main_manchete_miniquadra: {
      name: "Jogo aplicado com recepção e cobertura",
      participants: "equipes",
      organization:
        "Jogar com zonas de recepção e cobertura combinadas antes do rally.",
      starter: "Todo rally começa com saque.",
      action:
        "A equipe joga normalmente, mas precisa proteger o primeiro contato.",
      rotation: "A equipe troca o sacador a cada rally.",
      scoring: "Vale ponto bônus quando a recepção permite continuidade.",
      execution:
        "Todo rally começa com saque. A equipe joga normalmente, mas precisa proteger o primeiro contato. Vale ponto bônus quando a recepção permite continuidade.",
    },
  },
};

const SAQUE_AGE_PATCHES: Partial<Record<LessonAgeStage, Record<string, HumanizedActivityPatch>>> = {
  early: {
    warmup_saque_pega_zona: {
      name: "Corre para a zona chamada",
      organization:
        "Marcar 3 zonas grandes no fundo da quadra com cones.",
      action:
        "Os alunos correm para a zona chamada e voltam para o ponto de partida.",
      simpleRule: "O grupo marca ponto quando todos chegam na zona chamada.",
      execution:
        "O professor chama uma zona ao sinal. Os alunos correm para a zona chamada e voltam para o ponto de partida. A cada chamada, os grupos mudam de zona.",
    },
    main_saque_baixo_zonas: {
      name: "Boliche do saque por baixo",
      participants: "duplas",
      organization:
        "Em duplas, deixar cones grandes como alvo do outro lado da rede ou linha.",
      starter: "Um aluno começa lançando ou sacando por baixo.",
      action:
        "O aluno tenta mandar a bola rasteira ou por baixo para derrubar ou passar perto dos cones.",
      rotation: "A cada 4 tentativas, trocam de função.",
      simpleRule: "Vale continuar mesmo sem acertar o cone.",
      scoring: "Vale ponto quando a bola passa perto do alvo.",
      execution:
        "Um aluno começa lançando ou sacando por baixo para derrubar ou passar perto dos cones. A cada 4 tentativas, trocam de função. Vale continuar mesmo sem acertar o cone.",
    },
    main_saque_mini_jogo: {
      name: "Mini jogo começa com saque amigo",
      organization:
        "Montar miniquadras 2x2 com uma zona grande para iniciar a bola.",
      starter: "Todo rally começa com saque por baixo ou lançamento combinado.",
      action:
        "A dupla joga tentando colocar a bola em jogo para o outro lado.",
      rotation: "Depois de cada rally, troca quem inicia.",
      scoring: "Vale ponto quando a bola entra em jogo.",
      execution:
        "Todo rally começa com saque por baixo ou lançamento combinado. A dupla joga tentando colocar a bola em jogo para o outro lado. Depois de cada rally, troca quem inicia.",
    },
  },
  base: {
    main_saque_baixo_zonas: {
      name: "Saque por baixo para zona grande",
      organization:
        "Em trios, marcar uma zona grande do outro lado da quadra.",
      scoring: "Vale ponto quando a bola entra na zona grande.",
      execution:
        "Um aluno saca por baixo para a zona grande, um recolhe a bola e o outro observa a direção. Depois de 5 saques, trocam as funções.",
    },
    main_saque_mini_jogo: {
      name: "Mini 2x2 com saque em jogo",
      organization:
        "Montar miniquadras 2x2 e combinar uma zona de saque adaptado.",
      starter: "Todo rally começa com saque por baixo.",
      scoring: "Vale ponto bônus quando o saque entra em jogo.",
      execution:
        "Todo rally começa com saque por baixo. As duplas jogam tentando manter a bola viva. Vale ponto bônus quando o saque entra em jogo.",
    },
  },
  formation: {
    main_saque_baixo_zonas: {
      name: "Saque para zona curta ou funda",
      participants: "grupos de 4",
      organization:
        "Marcar zonas curta e funda na quadra adversária.",
      starter: "O sacador anuncia a zona antes do saque.",
      action:
        "O sacador tenta colocar a bola na zona anunciada e o grupo registra a direção.",
      rotation: "Depois de 6 saques, o grupo roda as funções.",
      scoring: "Vale ponto quando a bola entra na zona anunciada.",
      execution:
        "O sacador anuncia a zona antes do saque. Ele tenta colocar a bola na zona anunciada e o grupo registra a direção. Depois de 6 saques, o grupo roda as funções.",
    },
    main_saque_mini_jogo: {
      name: "Mini 4x4 com saque direcionado",
      participants: "equipes de 4",
      organization:
        "Montar mini 4x4 com duas zonas de saque combinadas.",
      starter: "Todo rally começa com saque para uma das zonas.",
      action:
        "A equipe joga normalmente depois do saque e tenta defender a zona escolhida.",
      rotation: "A equipe troca sacador a cada rally.",
      scoring: "Vale ponto bônus quando o saque entra na zona chamada.",
      execution:
        "Todo rally começa com saque para uma das zonas. A equipe joga normalmente depois do saque. Vale ponto bônus quando o saque entra na zona chamada.",
    },
  },
  specialization: {
    main_saque_baixo_zonas: {
      name: "Saque com alvo e resposta da recepção",
      participants: "grupos de 5",
      organization:
        "Organizar sacador, linha de recepção e duas zonas-alvo.",
      starter: "O sacador escolhe a zona antes da tentativa.",
      action:
        "O saque busca a zona escolhida e a recepção tenta devolver jogável.",
      rotation: "Depois de 6 saques, roda sacador e recebedores.",
      scoring: "Vale ponto para saque na zona e ponto para recepção jogável.",
      execution:
        "O sacador escolhe a zona antes da tentativa. O saque busca a zona escolhida e a recepção tenta devolver jogável. Depois de 6 saques, roda sacador e recebedores.",
    },
    main_saque_mini_jogo: {
      name: "Jogo aplicado com saque por estratégia",
      participants: "equipes",
      organization:
        "Jogar com zonas de saque combinadas antes de cada rally.",
      starter: "Todo rally começa com saque real ou adaptado.",
      action:
        "A equipe escolhe uma zona, saca e joga o rally até o fim.",
      rotation: "A equipe troca sacador a cada rally.",
      scoring: "Vale ponto bônus quando o saque pressiona a recepção sem perder continuidade.",
      execution:
        "Todo rally começa com saque real ou adaptado. A equipe escolhe uma zona, saca e joga o rally até o fim. Vale ponto bônus quando o saque pressiona a recepção sem perder continuidade.",
    },
  },
};

const LEVANTAMENTO_AGE_PATCHES: Partial<Record<LessonAgeStage, Record<string, HumanizedActivityPatch>>> = {
  early: {
    warmup_levantamento_bola_alto: {
      name: "Bola alta e troca de lugar",
      participants: "trios",
      organization:
        "Formar trios espalhados pela quadra, com uma bola por trio.",
      action:
        "O trio joga a bola alta para o colega e troca de lugar depois do contato.",
      rotation: "Quem tocou muda de lugar com outro colega.",
      simpleRule: "A bola precisa ficar alta para o colega conseguir continuar.",
      execution:
        "Um aluno inicia lançando a bola para cima. O trio joga a bola alta para o colega e troca de lugar depois do contato. Quem tocou muda de lugar com outro colega.",
    },
    main_levantamento_toque_cone: {
      name: "Cone pega-toque",
      organization:
        "Em duplas, um aluno fica com cone e outro com bolinha ou bola leve.",
      action:
        "O aluno lança a bolinha alta e o colega tenta receber dentro do cone, simulando um toque alto.",
      rotation: "A cada 5 lançamentos, trocam de função.",
      execution:
        "O aluno lança a bolinha alta e o colega tenta receber dentro do cone, simulando um toque alto. A cada 5 lançamentos, trocam de função.",
    },
    main_levantamento_recebe_levanta: {
      name: "Joga alto para levantar",
      participants: "trios",
      organization:
        "Em trios, marcar uma zona simples onde a bola deve chegar alta.",
      starter: "Um aluno começa lançando a bola.",
      action:
        "O trio tenta levantar a bola alta para o colega na zona.",
      rotation: "Depois de cada sequência, o trio roda as funções.",
      scoring: "Vale ponto quando a bola chega alta e jogável.",
      execution:
        "Um aluno começa lançando a bola. O trio tenta levantar a bola alta para o colega na zona. Depois de cada sequência, o trio roda as funções.",
    },
  },
  base: {
    main_levantamento_toque_cone: {
      name: "Toque com alvo alto",
      organization:
        "Em duplas, marcar um alvo alto com cone ou bambolê segurado pelo colega.",
      action:
        "Quem recebe tenta mandar a bola alta e jogável para o alvo.",
      rotation: "A cada 5 bolas, trocam de função.",
      execution:
        "O colega lança a bola e quem recebe tenta mandar a bola alta e jogável para o alvo. A cada 5 bolas, trocam de função.",
    },
    main_levantamento_recebe_levanta: {
      name: "Dois contatos para levantar",
      participants: "trios",
      organization:
        "Em trios, marcar uma zona para o segundo contato.",
      action:
        "Um aluno recebe, outro envia a bola alta para a zona e o terceiro devolve.",
      rotation: "Depois de 5 sequências, o trio roda as funções.",
      scoring: "Vale ponto quando o segundo contato chega alto e jogável.",
      execution:
        "Um aluno lança para iniciar. Um colega recebe, outro envia a bola alta para a zona e o terceiro devolve. Depois de 5 sequências, o trio roda as funções.",
    },
  },
  formation: {
    main_levantamento_toque_cone: {
      name: "Segundo contato para zona marcada",
      participants: "grupos de 4",
      organization:
        "Marcar duas zonas possíveis para o segundo contato em meia quadra.",
      starter: "Um aluno inicia com lançamento para o primeiro contato.",
      action:
        "O grupo organiza recepção e segundo contato para a zona chamada.",
      rotation: "Depois de 6 bolas, o grupo roda as funções.",
      scoring: "Vale ponto quando o segundo contato chega jogável na zona chamada.",
      execution:
        "Um aluno inicia com lançamento para o primeiro contato. O grupo organiza recepção e segundo contato para a zona chamada. Depois de 6 bolas, o grupo roda as funções.",
    },
    main_levantamento_recebe_levanta: {
      name: "Mini 4x4 com segundo contato obrigatório",
      participants: "equipes de 4",
      organization:
        "Montar mini 4x4 com zona combinada para o segundo contato.",
      starter: "A bola entra por lançamento ou saque adaptado.",
      action:
        "A equipe precisa organizar o segundo contato antes de devolver.",
      rotation: "A equipe troca quem inicia a bola a cada rally.",
      scoring: "Vale ponto extra quando o segundo contato chega jogável.",
      execution:
        "A bola entra por lançamento ou saque adaptado. A equipe precisa organizar o segundo contato antes de devolver. Vale ponto extra quando o segundo contato chega jogável.",
    },
  },
  specialization: {
    main_levantamento_toque_cone: {
      name: "Levantamento com escolha de zona",
      participants: "grupos de 5",
      organization:
        "Organizar recepção, levantador e duas zonas de destino.",
      starter: "A bola entra por saque adaptado ou lançamento.",
      action:
        "O levantador escolhe uma das zonas conforme a bola recebida.",
      rotation: "Depois de 6 bolas, roda recepção, levantador e destino.",
      scoring: "Vale ponto quando o levantamento chega jogável na zona escolhida.",
      execution:
        "A bola entra por saque adaptado ou lançamento. O levantador escolhe uma das zonas conforme a bola recebida. Depois de 6 bolas, roda recepção, levantador e destino.",
    },
    main_levantamento_recebe_levanta: {
      name: "Jogo aplicado com segundo contato definido",
      participants: "equipes",
      organization:
        "Jogar com uma responsabilidade clara para o segundo contato.",
      starter: "Todo rally começa por saque ou lançamento.",
      action:
        "A equipe joga normalmente, buscando organizar o segundo contato para uma zona útil.",
      rotation: "A equipe troca o responsável pelo segundo contato por rodada.",
      scoring: "Vale ponto bônus quando o segundo contato cria continuidade.",
      execution:
        "Todo rally começa por saque ou lançamento. A equipe joga normalmente, buscando organizar o segundo contato para uma zona útil. Vale ponto bônus quando o segundo contato cria continuidade.",
    },
  },
};

const buildPasseBlocks = (primarySkill: VolleyballSkill): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => ({
  warmup: [
    makeActivity("warmup_passe_pega_3_contatos", primarySkill, {
      stage: "warmup",
      name: "Pega-pega dos 3 contatos",
      participants: "turma inteira com dois pegadores",
      organization:
        "Delimitar meia quadra e deixar algumas bolas próximas à lateral.",
      starter: "Dois alunos começam como pegadores ao sinal do professor.",
      action:
        "Quem for pego pega uma bola, realiza 3 contatos com ela e vira o novo pegador.",
      rotation: "Quem completa os 3 contatos assume a função de pegador.",
      simpleRule: "Os contatos podem ser feitos com toque, manchete ou outra forma combinada.",
      materials: ["bolas", "cones"],
      space: "meia quadra",
      execution:
        "Dois alunos começam como pegadores. Quem for pego pega uma bola, realiza 3 contatos com ela e vira o novo pegador. Os contatos podem ser feitos com toque, manchete ou outra forma combinada.",
      coachFocus:
        "Observar participação e comunicação sem travar a brincadeira por erro técnico.",
      successCriteria:
        "Todos participam com deslocamento, contato com bola e troca rápida de função.",
      adaptation:
        "Facilitar diminuindo o espaço; dificultar aumentando o número de pegadores.",
      sourcePatternId: "corpus-volleyball-passe-warmup-3-contatos",
    }),
  ],
  main: [
    makeActivity("main_passe_duplas_jogavel", primarySkill, {
      stage: "drill",
      name: "Passe em duplas para voltar jogável",
      participants: "duplas",
      organization:
        "Em duplas, cada dupla fica com uma bola e ocupa um espaço livre da quadra.",
      starter: "Um aluno começa lançando a bola por baixo.",
      action:
        "O colega devolve de passe ou manchete tentando deixar a bola jogável para quem lançou.",
      rotation: "A cada 5 bolas, trocam de função.",
      simpleRule: "A bola precisa voltar jogável para o colega continuar a sequência.",
      materials: ["bolas"],
      space: "quadra dividida em espaços de dupla",
      execution:
        "Um aluno lança a bola por baixo e o colega devolve tentando deixar a bola jogável para quem lançou. A cada 5 bolas, trocam de função.",
      coachFocus:
        "Observar comunicação, direção da bola e ajuste antes do contato.",
      successCriteria:
        "A dupla mantém a bola jogável em séries curtas de 5 tentativas.",
      adaptation:
        "Facilitar aproximando a dupla; dificultar pedindo deslocamento antes do passe.",
      sourcePatternId: "corpus-volleyball-passe-duplas-jogavel",
    }),
    makeActivity("main_passe_desafio_3_passes", primarySkill, {
      stage: "game",
      name: "Desafio dos 3 passes",
      participants: "grupos de 3",
      organization:
        "Formar grupos de 3 em quadra reduzida, com uma bola por grupo.",
      starter: "Um aluno inicia lançando a bola para o grupo.",
      action:
        "O grupo tenta manter a bola por 3 contatos antes de devolver para outro trio.",
      rotation: "Após cada tentativa, o trio reorganiza as posições e continua.",
      simpleRule: "O trio precisa organizar 3 contatos antes de devolver.",
      scoring: "Vale ponto quando o grupo consegue organizar os 3 contatos.",
      materials: ["bolas", "cones"],
      space: "quadra reduzida",
      execution:
        "O grupo tenta manter a bola por 3 contatos antes de devolver para outro trio. Vale ponto quando o grupo consegue organizar os 3 contatos.",
      coachFocus:
        "Observar chamada da bola e ocupação simples dos espaços.",
      successCriteria:
        "O grupo consegue organizar sequências curtas com primeiro contato jogável.",
      adaptation:
        "Facilitar permitindo segurar a segunda bola; dificultar reduzindo o tempo entre contatos.",
      sourcePatternId: "corpus-volleyball-passe-desafio-3-passos",
    }),
  ],
  cooldown: [feedbackCooldown(primarySkill)],
});

const buildMancheteBlocks = (primarySkill: VolleyballSkill): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => ({
  warmup: [
    makeActivity("warmup_manchete_corre_chama", primarySkill, {
      stage: "warmup",
      name: "Corre e chama",
      participants: "grupos de 3",
      organization:
        "Em meia quadra, espalhar cones e deixar uma bola por grupo de 3.",
      starter: "Ao sinal, um aluno lança a bola para o espaço do grupo.",
      action:
        "Quem estiver mais perto chama a bola e faz o primeiro contato para um colega.",
      rotation: "Depois de cada bola, o lançador muda e o grupo circula pelo espaço.",
      simpleRule: "Só pode tocar na bola quem chamou antes.",
      materials: ["bolas", "cones"],
      space: "meia quadra",
      execution:
        "Ao sinal, os alunos circulam pelo espaço. Quando a bola entra, quem estiver mais perto chama e faz o primeiro contato para um colega do grupo.",
      coachFocus:
        "Observar comunicação antes do contato e deslocamento para a bola.",
      successCriteria:
        "O grupo chama a bola antes do primeiro contato na maioria das tentativas.",
      adaptation:
        "Facilitar usando lançamentos próximos; dificultar variando a direção da bola.",
      sourcePatternId: "corpus-volleyball-manchete-corre-chama",
    }),
  ],
  main: [
    makeActivity("main_manchete_alvo", primarySkill, {
      stage: "drill",
      name: "Manchete no alvo",
      participants: "duplas ou trios",
      organization:
        "Em duplas ou trios, marcar um alvo com cone ou bambolê.",
      starter: "Um aluno começa lançando a bola por baixo.",
      action:
        "O colega recebe de manchete tentando enviar a bola para o alvo marcado.",
      rotation: "A cada 5 ou 6 tentativas, trocam de função.",
      simpleRule: "Quem recebe precisa se comunicar antes do contato.",
      materials: ["bolas", "cones", "bambolês"],
      space: "quadra dividida por alvos",
      execution:
        "Um aluno lança a bola por baixo e o outro recebe de manchete tentando acertar o alvo marcado por cone ou bambolê. A cada 5 ou 6 tentativas, trocam.",
      coachFocus:
        "Observar comunicação e direção da bola para a zona combinada.",
      successCriteria:
        "O aluno consegue enviar a manchete para perto do alvo em séries curtas.",
      adaptation:
        "Facilitar aproximando o alvo; dificultar variando direita, esquerda e profundidade.",
      sourcePatternId: "corpus-volleyball-manchete-alvo",
    }),
    makeActivity("main_manchete_miniquadra", primarySkill, {
      stage: "game",
      name: "Miniquadra com primeiro contato combinado",
      participants: "equipes pequenas",
      organization:
        "Montar miniquadras com equipes pequenas e uma zona combinada para o primeiro contato.",
      starter: "A bola entra por lançamento do professor ou de uma equipe.",
      action:
        "A equipe tenta fazer o primeiro contato chegar jogável na zona combinada.",
      rotation: "Depois de cada rally, as equipes trocam quem inicia a bola.",
      simpleRule: "A jogada continua normalmente depois do primeiro contato.",
      scoring: "Vale ponto extra quando o primeiro contato chega jogável na zona combinada.",
      materials: ["bolas", "cones"],
      space: "miniquadra",
      execution:
        "A bola entra por lançamento. Vale ponto extra quando o primeiro contato chega jogável na zona combinada.",
      coachFocus:
        "Observar leitura da bola e comunicação entre colegas.",
      successCriteria:
        "A equipe mantém o primeiro contato jogável em rallies curtos.",
      adaptation:
        "Facilitar ampliando a zona; dificultar diminuindo a zona-alvo.",
      sourcePatternId: "corpus-volleyball-manchete-miniquadra",
    }),
  ],
  cooldown: [feedbackCooldown(primarySkill)],
});

const buildSaqueBlocks = (primarySkill: VolleyballSkill): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => ({
  warmup: [
    makeActivity("warmup_saque_pega_zona", primarySkill, {
      stage: "warmup",
      name: "Pega-zona do saque",
      participants: "pequenos grupos",
      organization:
        "Dividir o fundo da quadra em zonas marcadas por cones.",
      starter: "O professor chama uma zona ao sinal.",
      action:
        "Os alunos se deslocam e ocupam a zona chamada, já entrando no tema de direção do saque.",
      rotation: "A cada chamada, os grupos mudam de zona.",
      simpleRule: "O grupo marca ponto quando chega organizado na zona chamada.",
      materials: ["cones"],
      space: "fundo da quadra",
      execution:
        "Ao sinal, os alunos se deslocam e ocupam a zona chamada. A cada chamada, os grupos mudam de lugar.",
      coachFocus:
        "Observar orientação espacial e prontidão para mirar zonas.",
      successCriteria:
        "Os grupos reconhecem as zonas da quadra com deslocamentos rápidos e seguros.",
      adaptation:
        "Facilitar usando menos zonas; dificultar chamando zonas em sequência.",
      sourcePatternId: "corpus-volleyball-saque-pega-zona",
    }),
  ],
  main: [
    makeActivity("main_saque_baixo_zonas", primarySkill, {
      stage: "drill",
      name: "Saque por baixo para zonas",
      participants: "trios",
      organization:
        "Em trios, marcar zonas de saque na quadra e deixar uma bola por trio.",
      starter: "Um aluno começa sacando por baixo para a zona marcada.",
      action:
        "Um aluno saca, um recolhe a bola e o outro aguarda a vez.",
      rotation: "Depois de 5 saques, trocam as funções.",
      simpleRule: "O sacador escolhe a zona antes da tentativa.",
      scoring: "Conta ponto quando a bola entra na zona combinada.",
      materials: ["bolas", "cones"],
      space: "quadra com zonas marcadas",
      execution:
        "Um aluno saca por baixo para uma zona marcada, um recolhe a bola e o outro aguarda a vez. Depois de 5 saques, trocam as funções.",
      coachFocus:
        "Observar rotina curta e direção do saque.",
      successCriteria:
        "O aluno coloca a bola em jogo e mira uma zona clara.",
      adaptation:
        "Facilitar aproximando a linha; dificultar pedindo zona diferente a cada rodada.",
      sourcePatternId: "corpus-volleyball-saque-baixo-zonas",
    }),
    makeActivity("main_saque_mini_jogo", primarySkill, {
      stage: "game",
      name: "Mini jogo com saque em jogo",
      participants: "equipes pequenas",
      organization:
        "Em quadra reduzida, separar equipes pequenas e marcar uma zona de saque.",
      starter: "Todo rally começa com saque adaptado.",
      action:
        "As equipes jogam o rally normalmente depois do saque.",
      rotation: "A equipe troca o sacador a cada rally.",
      simpleRule: "O rally sempre começa com saque adaptado.",
      scoring: "Vale ponto bônus quando o saque entra na zona combinada ou dificulta a recepção.",
      materials: ["bolas", "cones"],
      space: "quadra reduzida",
      execution:
        "O rally sempre começa com saque adaptado. Vale ponto bônus quando o saque entra na zona combinada ou dificulta a recepção.",
      coachFocus:
        "Observar direção do saque e continuidade do jogo.",
      successCriteria:
        "A equipe inicia rallies com saque em jogo e direção combinada.",
      adaptation:
        "Facilitar com saque mais próximo; dificultar mudando a zona bônus.",
      sourcePatternId: "corpus-volleyball-saque-mini-jogo",
    }),
  ],
  cooldown: [feedbackCooldown(primarySkill)],
});

const buildLevantamentoBlocks = (primarySkill: VolleyballSkill): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => ({
  warmup: [
    makeActivity("warmup_levantamento_bola_alto", primarySkill, {
      stage: "warmup",
      name: "Bola ao alto em circulação",
      participants: "grupos de 4",
      organization:
        "Formar grupos de 4 espalhados pela quadra, com uma bola por grupo.",
      starter: "Um aluno inicia lançando a bola para cima.",
      action:
        "O grupo mantém a bola acima da linha da cabeça e troca de lugar após cada contato.",
      rotation: "Após cada contato, quem tocou muda de lugar com um colega.",
      simpleRule: "A bola deve continuar alta para o próximo colega.",
      materials: ["bolas"],
      space: "quadra dividida por grupos",
      execution:
        "O grupo mantém a bola acima da linha da cabeça e troca de lugar após cada contato.",
      coachFocus:
        "Observar tempo de bola e comunicação para o segundo contato.",
      successCriteria:
        "O grupo mantém contatos altos sem travar a circulação.",
      adaptation:
        "Facilitar permitindo segurar e lançar; dificultar exigindo contato direto.",
      sourcePatternId: "corpus-volleyball-levantamento-bola-alto",
    }),
  ],
  main: [
    makeActivity("main_levantamento_toque_cone", primarySkill, {
      stage: "drill",
      name: "Introdução do toque com cone",
      participants: "duplas",
      organization:
        "Em duplas, um aluno fica com um cone e o outro com uma bolinha.",
      starter: "O aluno com a bolinha começa o arremesso.",
      action:
        "O objetivo é acertar a bolinha dentro do cone, simulando a direção do toque.",
      rotation: "A cada 5 arremessos, trocam de função.",
      simpleRule: "O cone fica como alvo acima da linha do peito.",
      materials: ["cones", "bolinhas"],
      space: "quadra dividida em duplas",
      execution:
        "O objetivo é acertar a bolinha dentro do cone. A cada 5 arremessos, trocam de função.",
      coachFocus:
        "Observar direção alta e controle do segundo contato.",
      successCriteria:
        "A dupla entende o alvo do toque e troca função sem espera longa.",
      adaptation:
        "Facilitar aproximando a dupla; dificultar afastando o alvo.",
      sourcePatternId: "corpus-volleyball-levantamento-toque-cone",
    }),
    makeActivity("main_levantamento_recebe_levanta", primarySkill, {
      stage: "game",
      name: "Recebe e levanta",
      participants: "trios",
      organization:
        "Em trios, marcar uma zona combinada para o levantamento.",
      starter: "Um aluno lança a bola para iniciar a sequência.",
      action:
        "Um aluno faz o primeiro contato, outro levanta e o terceiro recebe na zona combinada.",
      rotation: "Depois de algumas repetições, o trio roda as funções.",
      simpleRule: "A sequência precisa passar pelo segundo contato antes de finalizar.",
      scoring: "Conta ponto quando o levantamento chega jogável na zona combinada.",
      materials: ["bolas", "cones"],
      space: "meia quadra",
      execution:
        "Um aluno lança, outro faz o primeiro contato e o terceiro levanta para a zona combinada. Depois de algumas repetições, o trio roda as funções.",
      coachFocus:
        "Observar tempo para chegar embaixo da bola e direção do levantamento.",
      successCriteria:
        "O trio organiza primeiro contato e levantamento em sequência simples.",
      adaptation:
        "Facilitar com lançamento mais alto; dificultar pedindo deslocamento antes do levantamento.",
      sourcePatternId: "corpus-volleyball-levantamento-recebe-levanta",
    }),
  ],
  cooldown: [feedbackCooldown(primarySkill)],
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
  if (primarySkill === "passe" && hasMancheteIntent(plan)) {
    const blocks = applySessionContextPatches(
      applyAgePatches(buildMancheteBlocks(primarySkill), primarySkill, ageProfile, MANCHETE_AGE_PATCHES),
      primarySkill,
      ageProfile,
      context
    );
    return withValidation(
      blocks,
      primarySkill,
      context
    );
  }
  if (primarySkill === "passe") {
    const blocks = applySessionContextPatches(
      applyAgePatches(buildPasseBlocks(primarySkill), primarySkill, ageProfile, PASSE_AGE_PATCHES),
      primarySkill,
      ageProfile,
      context
    );
    return withValidation(
      blocks,
      primarySkill,
      context
    );
  }
  if (primarySkill === "saque") {
    const blocks = applySessionContextPatches(
      applyAgePatches(buildSaqueBlocks(primarySkill), primarySkill, ageProfile, SAQUE_AGE_PATCHES),
      primarySkill,
      ageProfile,
      context
    );
    return withValidation(
      blocks,
      primarySkill,
      context
    );
  }
  if (primarySkill === "levantamento") {
    const blocks = applySessionContextPatches(
      applyAgePatches(buildLevantamentoBlocks(primarySkill), primarySkill, ageProfile, LEVANTAMENTO_AGE_PATCHES),
      primarySkill,
      ageProfile,
      context
    );
    return withValidation(
      blocks,
      primarySkill,
      context
    );
  }
  const blocks = applySessionContextPatches(
    buildGenericBlocks(primarySkill, ageProfile),
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
    const settingSignals = (mainText.match(/\b(levantamento|levantador|distribuicao|organizar ataque)\b/g) ?? []).length;
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
