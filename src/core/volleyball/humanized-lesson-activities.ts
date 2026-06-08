import type { VolleyballLessonPlan, VolleyballSkill } from "../models";

type ActivityStage = "warmup" | "drill" | "game" | "cooldown";

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
    action: /\b(lancar|lançar|receber|passar|devolver|manter|sacar|chamar|deslocar|deslocam|trocar|levantar|contato|contatos|jogar|organizar|realiza|faz|tenta|deixar|acertar|ocupar|ocupam|entra)\b/.test(text),
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

const makeActivity = (
  id: string,
  primarySkill: VolleyballSkill,
  activity: Omit<HumanizedLessonActivity, "id" | "primarySkill" | "description" | "presentation" | "validation">
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

const buildGenericBlocks = (primarySkill: VolleyballSkill): Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown"> => ({
  warmup: [
    makeActivity(`warmup_${primarySkill}_atividade_aberta`, primarySkill, {
      stage: "warmup",
      name: `Aquecimento com ${genericSkillLabel[primarySkill]} em grupos`,
      participants: "grupos pequenos",
      organization:
        "Dividir a quadra em espaços pequenos, com uma bola por grupo.",
      starter: "Um aluno inicia a bola ao sinal do professor.",
      action:
        `O grupo troca bolas simples incluindo o ${genericSkillLabel[primarySkill]} dentro da tarefa.`,
      rotation: "A cada rodada, muda quem inicia a bola.",
      simpleRule: "Manter todos participando na mesma rodada.",
      materials: ["bolas", "cones"],
      space: "quadra em espaços pequenos",
      execution:
        `O grupo troca bolas simples incluindo o ${genericSkillLabel[primarySkill]} dentro da tarefa. A cada rodada, muda quem inicia a bola.`,
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
      name: `${genericSkillLabel[primarySkill]} em jogo curto`,
      participants: "equipes pequenas",
      organization:
        "Montar equipes pequenas em quadra reduzida.",
      starter: "A bola entra por lançamento ou ação adaptada.",
      action:
        `A equipe tenta usar o ${genericSkillLabel[primarySkill]} dentro do rally.`,
      rotation: "Depois de cada rally, troca quem inicia a bola.",
      simpleRule: "A jogada vale ponto extra quando o tema aparece no jogo.",
      scoring: "Ponto extra quando a equipe usa o fundamento combinado.",
      materials: ["bolas", "cones"],
      space: "quadra reduzida",
      execution:
        `A equipe tenta usar o ${genericSkillLabel[primarySkill]} dentro do rally. Vale ponto extra quando o tema aparece no jogo.`,
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
  primarySkill: VolleyballSkill
): HumanizedLessonBlocks => ({
  ...blocks,
  validationFlags: validateHumanizedVolleyballBlocks(blocks, primarySkill),
});

export const buildHumanizedVolleyballLessonBlocks = (
  plan: VolleyballLessonPlan
): HumanizedLessonBlocks => {
  const primarySkill = asSkill(plan.primaryFocus.skill);
  if (primarySkill === "passe" && hasMancheteIntent(plan)) {
    return withValidation(buildMancheteBlocks(primarySkill), primarySkill);
  }
  if (primarySkill === "passe") return withValidation(buildPasseBlocks(primarySkill), primarySkill);
  if (primarySkill === "saque") return withValidation(buildSaqueBlocks(primarySkill), primarySkill);
  if (primarySkill === "levantamento") return withValidation(buildLevantamentoBlocks(primarySkill), primarySkill);
  return withValidation(buildGenericBlocks(primarySkill), primarySkill);
};

export const validateHumanizedVolleyballBlocks = (
  blocks: Pick<HumanizedLessonBlocks, "warmup" | "main" | "cooldown">,
  primarySkill: VolleyballSkill
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
    const serveSignals = (mainText.match(/\b(saque|sacar|saca|sacador)\b/g) ?? []).length;
    if (serveSignals < 4) {
      flags.push("Plano de saque sem sinais suficientes de saque.");
    }
  }

  if (primarySkill === "levantamento") {
    const mainText = normalize(blocks.main.map((activity) => `${activity.name} ${activity.presentation.standardText}`).join(" "));
    const settingSignals = (mainText.match(/\b(levantamento|levanta|segundo contato|toque)\b/g) ?? []).length;
    if (settingSignals < 3) {
      flags.push("Plano de levantamento sem sinais suficientes de levantamento.");
    }
  }

  return [...new Set(flags)];
};
