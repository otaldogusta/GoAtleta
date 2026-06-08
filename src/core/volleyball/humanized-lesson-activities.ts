import type { VolleyballLessonPlan, VolleyballSkill } from "../models";

export type HumanizedLessonActivity = {
  id: string;
  name: string;
  description: string;
  organization: string;
  execution: string;
  coachFocus: string;
  successCriteria: string;
  adaptation: string;
  primarySkill: VolleyballSkill;
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

const asSkill = (value: string | null | undefined): VolleyballSkill => {
  const normalized = normalize(value);
  return VOLLEYBALL_SKILLS.includes(normalized as VolleyballSkill)
    ? (normalized as VolleyballSkill)
    : "passe";
};

export const composeHumanizedActivityDescription = (
  activity: Partial<HumanizedLessonActivity> & { description?: string | null }
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

const makeActivity = (
  id: string,
  primarySkill: VolleyballSkill,
  activity: Omit<HumanizedLessonActivity, "id" | "primarySkill" | "description">
): HumanizedLessonActivity => {
  const next = {
    id,
    primarySkill,
    ...activity,
    description: "",
  };
  return {
    ...next,
    description: composeHumanizedActivityDescription(next),
  };
};

const passeWarmup = (primarySkill: VolleyballSkill) =>
  makeActivity("warmup_passe_1", primarySkill, {
    name: "Pega-pega com bola e alvo",
    organization:
      "Marcar meia quadra com cones. Dois alunos ficam com bola na mão e os demais espalhados.",
    execution:
      "Quem está com a bola pega encostando de leve. Ao sinal, quem for pego recebe a bola e tenta entregar uma manchete controlada para o alvo antes de virar pegador.",
    coachFocus:
      "Cobrar base baixa, braços juntos e chamada simples da bola antes do contato.",
    successCriteria:
      "A turma consegue manter a dinâmica por 2 minutos sem parar e com pelo menos uma manchete controlada por rodada.",
    adaptation:
      "Facilitar usando lançamento por baixo; dificultar exigindo deslocamento lateral antes da manchete.",
  });

const passeSkillActivities = (primarySkill: VolleyballSkill) => [
  makeActivity("main_passe_1", primarySkill, {
    name: "Passe para alvo em duplas",
    organization:
      "Organizar duplas a 3 metros de distância. Cada dupla trabalha com uma bola e um cone como alvo entre elas.",
    execution:
      "Um aluno lança por baixo e o colega responde de manchete tentando deixar a bola cair perto do cone. Depois de 6 bolas, troca a função.",
    coachFocus:
      "Observar plataforma firme, pernas ajudando o movimento e direção da bola para frente.",
    successCriteria:
      "Cada dupla acerta o alvo ou a zona marcada em 3 de 6 tentativas.",
    adaptation:
      "Facilitar aproximando a dupla; dificultar afastando 1 metro ou pedindo deslocamento antes do passe.",
  }),
  makeActivity("main_passe_2", primarySkill, {
    name: "Manchete com ajuste de pés",
    organization:
      "Montar três filas curtas atrás da linha de fundo, com um alvo grande perto da posição 3.",
    execution:
      "O professor ou um colega lança bolas alternadas para direita e esquerda. O aluno se ajusta, chama a bola e faz o passe para o alvo.",
    coachFocus:
      "Reforçar que o aluno chega atrás da bola antes de juntar os braços, sem bater parado de qualquer jeito.",
    successCriteria:
      "O aluno consegue chegar equilibrado e direcionar 2 passes seguidos para a zona combinada.",
    adaptation:
      "Facilitar lançando no corpo; dificultar variando profundidade e pedindo recuperação rápida para o fim da fila.",
  }),
];

const passeGameActivity = (primarySkill: VolleyballSkill) =>
  makeActivity("main_passe_game_1", primarySkill, {
    name: "Mini jogo com ponto extra por passe bom",
    organization:
      "Separar equipes 3x3 ou 4x4 em quadra reduzida. Marcar uma zona-alvo para o primeiro passe.",
    execution:
      "A bola entra por lançamento ou saque adaptado. A equipe ganha ponto extra quando o primeiro contato chega jogável na zona combinada.",
    coachFocus:
      "Parar pouco o jogo e corrigir com uma frase curta: chamar a bola, ajustar os pés e mandar alto para a zona.",
    successCriteria:
      "A equipe consegue construir pelo menos 3 rallies com primeiro contato controlado.",
    adaptation:
      "Facilitar permitindo segurar a segunda bola; dificultar exigindo três contatos antes de devolver.",
  });

const genericSkillLabel: Record<VolleyballSkill, string> = {
  passe: "passe",
  levantamento: "segundo contato",
  ataque: "ataque adaptado",
  bloqueio: "bloqueio",
  defesa: "defesa",
  saque: "saque",
  transicao: "transicao",
};

const saqueWarmup = (primarySkill: VolleyballSkill) =>
  makeActivity("warmup_saque_1", primarySkill, {
    name: "Aquecimento com alvo de saque",
    organization:
      "Marcar três zonas grandes na quadra com cones. Alunos em duplas, uma bola por dupla, a 4 metros do alvo.",
    execution:
      "Um aluno lança a bola por baixo como preparação do saque e o colega devolve tentando acertar a zona combinada. Depois de 5 tentativas, trocam.",
    coachFocus:
      "Observar rotina curta antes da batida, olhar no alvo e contato firme na parte de baixo da bola.",
    successCriteria:
      "Cada dupla consegue acertar a zona em pelo menos 2 de 5 tentativas sem perder a organização.",
    adaptation:
      "Facilitar aproximando a linha de saque; dificultar pedindo que o aluno escolha a zona antes de sacar.",
  });

const saqueMain = (primarySkill: VolleyballSkill) => [
  makeActivity("main_saque_1", primarySkill, {
    name: "Saque por baixo para zonas",
    organization:
      "Dividir a turma em três filas atrás de uma linha adaptada. Na outra quadra, marcar zonas largas com cones.",
    execution:
      "Cada aluno realiza um saque por baixo mirando uma zona. Busca a bola, entrega para o próximo e volta para o fim da fila.",
    coachFocus:
      "Corrigir base lateral, braço relaxado no preparo e finalização apontando para o alvo.",
    successCriteria:
      "O aluno coloca a bola em jogo em 3 de 6 saques e mantém a rotina combinada.",
    adaptation:
      "Facilitar usando linha mais próxima; dificultar exigindo zona diferente a cada rodada.",
  }),
  makeActivity("main_saque_2", primarySkill, {
    name: "Saque com rotina curta",
    organization:
      "Organizar duplas frente a frente, separadas pela rede ou por uma faixa marcada no chão.",
    execution:
      "Antes de sacar, o aluno fala alvo, respira, posiciona os pés e executa. O colega recebe a bola e repete a mesma rotina.",
    coachFocus:
      "Valorizar preparação igual em todas as tentativas, sem pressa e sem mudar a técnica a cada erro.",
    successCriteria:
      "A dupla completa 8 saques mantendo a rotina e colocando a bola na direção do parceiro.",
    adaptation:
      "Facilitar permitindo lançamento por baixo; dificultar aumentando a distância ou colocando alvo menor.",
  }),
  makeActivity("main_saque_game_1", primarySkill, {
    name: "Desafio de zonas de saque",
    organization:
      "Separar equipes pequenas. Cada equipe escolhe uma zona-alvo marcada por cones na quadra adversária.",
    execution:
      "Um aluno por vez saca. A equipe marca ponto quando a bola entra na quadra e ponto extra quando cai na zona escolhida.",
    coachFocus:
      "Manter a fila curta, registrar pontos simples e lembrar que primeiro objetivo é colocar a bola em jogo.",
    successCriteria:
      "A equipe consegue pontuar com saque em pelo menos 4 rodadas.",
    adaptation:
      "Facilitar ampliando a zona-alvo; dificultar mudando a zona a cada rodada.",
  }),
];

const levantamentoWarmup = (primarySkill: VolleyballSkill) =>
  makeActivity("warmup_levantamento_1", primarySkill, {
    name: "Controle de segundo contato em duplas",
    organization:
      "Organizar duplas espalhadas pela quadra, cada dupla com uma bola e um cone como alvo alto.",
    execution:
      "Um aluno lança a bola acima da cabeça do colega. O colega faz o levantamento para o cone e troca a função depois de 6 repetições.",
    coachFocus:
      "Observar mãos em janela, contato acima da testa e bola subindo com controle.",
    successCriteria:
      "A dupla mantém 4 levantamentos controlados em 6 tentativas.",
    adaptation:
      "Facilitar usando bola mais leve ou lançamento mais alto; dificultar exigindo um passo de ajuste antes do contato.",
  });

const levantamentoMain = (primarySkill: VolleyballSkill) => [
  makeActivity("main_levantamento_1", primarySkill, {
    name: "Levantamento para alvo alto",
    organization:
      "Montar trios com lançador, levantador e alvo. O alvo fica perto da rede ou de uma linha marcada.",
    execution:
      "O lançador envia a bola por baixo, o levantador ajusta os pés e levanta para o alvo. Depois de 5 bolas, o trio roda funções.",
    coachFocus:
      "Corrigir chegada embaixo da bola, cotovelos flexionados e direção alta para o colega.",
    successCriteria:
      "O levantador coloca 3 de 5 bolas jogáveis para o alvo.",
    adaptation:
      "Facilitar aproximando lançador e alvo; dificultar variando a altura do lançamento inicial.",
  }),
  makeActivity("main_levantamento_2", primarySkill, {
    name: "Levantamento após passe lançado",
    organization:
      "Organizar trios em meia quadra. Um aluno lança como primeiro contato, outro levanta e o terceiro segura no alvo.",
    execution:
      "A sequência começa com lançamento controlado. O levantador chama a bola, se posiciona e envia o segundo contato para o alvo.",
    coachFocus:
      "Evitar bola baixa e corrida. Pedir chamada da bola, ajuste curto de pés e passe alto para o alvo.",
    successCriteria:
      "O trio completa 4 sequências seguidas com segundo contato alto e direcionado.",
    adaptation:
      "Facilitar deixando o alvo mais próximo; dificultar pedindo deslocamento lateral do levantador antes da bola.",
  }),
  makeActivity("main_levantamento_game_1", primarySkill, {
    name: "Mini jogo com zona do levantador",
    organization:
      "Separar equipes 3x3 em quadra reduzida e marcar uma zona central para o segundo contato.",
    execution:
      "A equipe ganha ponto extra quando o segundo contato sai da zona do levantador e chega alto para um colega finalizar ou devolver.",
    coachFocus:
      "Intervir com frases curtas sobre chamar a bola, chegar equilibrado e levantar para cima, não para frente sem controle.",
    successCriteria:
      "A equipe usa o segundo contato organizado em pelo menos 3 rallies.",
    adaptation:
      "Facilitar permitindo segurar o primeiro contato; dificultar retirando o ponto extra quando a bola sai baixa.",
  }),
];

const genericWarmup = (primarySkill: VolleyballSkill) =>
  makeActivity(`warmup_${primarySkill}_1`, primarySkill, {
    name: "Aquecimento com bola em duplas",
    organization:
      "Organizar duplas espalhadas pela quadra, cada dupla com uma bola e um espaço marcado por cones.",
    execution:
      `A dupla troca bolas simples e inclui deslocamentos curtos antes de executar o ${genericSkillLabel[primarySkill]}.`,
    coachFocus:
      "Manter a turma em movimento, com explicação curta e correção individual enquanto a atividade acontece.",
    successCriteria:
      "Cada dupla mantém a troca por 1 minuto com controle e comunicação.",
    adaptation:
      "Facilitar reduzindo distância; dificultar pedindo troca de direção ao sinal do professor.",
  });

const genericMain = (primarySkill: VolleyballSkill) => [
  makeActivity(`main_${primarySkill}_1`, primarySkill, {
    name: `${genericSkillLabel[primarySkill]} com alvo`,
    organization:
      "Dividir a turma em duplas ou trios, com uma zona-alvo marcada por cones.",
    execution:
      `Os alunos repetem o ${genericSkillLabel[primarySkill]} tentando enviar a bola para a zona combinada antes de trocar a função.`,
    coachFocus:
      "Corrigir um ponto por vez e priorizar controle, equilíbrio e comunicação.",
    successCriteria:
      "O grupo acerta a zona em pelo menos metade das tentativas observadas.",
    adaptation:
      "Facilitar aproximando o alvo; dificultar com deslocamento prévio ou oposição leve.",
  }),
  makeActivity(`main_${primarySkill}_game_1`, primarySkill, {
    name: "Jogo reduzido com regra do tema",
    organization:
      "Montar jogos 3x3 em espaço reduzido, com rodízio rápido entre as equipes.",
    execution:
      `A jogada vale ponto extra quando a equipe usa o ${genericSkillLabel[primarySkill]} dentro da regra combinada.`,
    coachFocus:
      "Deixar o jogo correr e intervir apenas para lembrar a regra, a organização e a comunicação.",
    successCriteria:
      "A turma aplica o tema em pelo menos 3 jogadas durante o bloco.",
    adaptation:
      "Facilitar permitindo bola lançada; dificultar retirando a ajuda depois que o grupo entende a tarefa.",
  }),
];

const cooldown = (primarySkill: VolleyballSkill) =>
  makeActivity(`cooldown_${primarySkill}_1`, primarySkill, {
    name: "Roda rápida de fechamento",
    organization:
      "Reunir a turma sentada ou em pé na lateral da quadra, perto das bolas e cones, com todos olhando para o professor.",
    execution:
      "Cada grupo fala uma coisa que ajudou na atividade e organiza bolas e cones antes de sair.",
    coachFocus:
      "Puxar respostas simples sobre comunicação, controle da bola e respeito aos combinados.",
    successCriteria:
      "Os alunos conseguem citar um ajuste prático que funcionou na aula.",
    adaptation:
      "Para turma agitada, pedir resposta por equipe; para turma mais madura, pedir uma meta para a próxima aula.",
  });

const buildPasseBlocks = (primarySkill: VolleyballSkill): HumanizedLessonBlocks => {
  const blocks = {
    warmup: [passeWarmup(primarySkill)],
    main: [...passeSkillActivities(primarySkill), passeGameActivity(primarySkill)],
    cooldown: [cooldown(primarySkill)],
  };
  return {
    ...blocks,
    validationFlags: validateHumanizedVolleyballBlocks(blocks, primarySkill),
  };
};

const buildSaqueBlocks = (primarySkill: VolleyballSkill): HumanizedLessonBlocks => {
  const blocks = {
    warmup: [saqueWarmup(primarySkill)],
    main: saqueMain(primarySkill),
    cooldown: [cooldown(primarySkill)],
  };
  return {
    ...blocks,
    validationFlags: validateHumanizedVolleyballBlocks(blocks, primarySkill),
  };
};

const buildLevantamentoBlocks = (primarySkill: VolleyballSkill): HumanizedLessonBlocks => {
  const blocks = {
    warmup: [levantamentoWarmup(primarySkill)],
    main: levantamentoMain(primarySkill),
    cooldown: [cooldown(primarySkill)],
  };
  return {
    ...blocks,
    validationFlags: validateHumanizedVolleyballBlocks(blocks, primarySkill),
  };
};

const buildGenericBlocks = (primarySkill: VolleyballSkill): HumanizedLessonBlocks => {
  const blocks = {
    warmup: [genericWarmup(primarySkill)],
    main: genericMain(primarySkill),
    cooldown: [cooldown(primarySkill)],
  };
  return {
    ...blocks,
    validationFlags: validateHumanizedVolleyballBlocks(blocks, primarySkill),
  };
};

export const buildHumanizedVolleyballLessonBlocks = (
  plan: VolleyballLessonPlan
): HumanizedLessonBlocks => {
  const primarySkill = asSkill(plan.primaryFocus.skill);
  if (primarySkill === "passe") return buildPasseBlocks(primarySkill);
  if (primarySkill === "saque") return buildSaqueBlocks(primarySkill);
  if (primarySkill === "levantamento") return buildLevantamentoBlocks(primarySkill);
  return buildGenericBlocks(primarySkill);
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
  ];
  const practicalOrganizationSignals =
    /\b(dupla|duplas|trio|trios|fila|filas|equipe|equipes|quadra|meia quadra|cones?|alvo|zona|rede|linha|linhas)\b/i;

  allActivities.forEach((activity) => {
    const key = normalize(`${activity.name} ${activity.description}`);
    if (seen.has(key)) {
      flags.push(`Atividade repetida: ${activity.name}`);
    }
    seen.add(key);

    const requiredFields: (keyof HumanizedLessonActivity)[] = [
      "organization",
      "execution",
      "coachFocus",
      "successCriteria",
      "adaptation",
    ];
    requiredFields.forEach((field) => {
      if (!String(activity[field] ?? "").trim()) {
        flags.push(`Campo ausente em ${activity.name}: ${field}`);
      }
    });

    if (!practicalOrganizationSignals.test(activity.organization)) {
      flags.push(`Organizacao sem quadra pratica em ${activity.name}.`);
    }

    const text = [
      activity.name,
      activity.description,
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
  });

  if (primarySkill === "passe") {
    const mainText = normalize(blocks.main.map((activity) => `${activity.name} ${activity.description}`).join(" "));
    const passSignals = (mainText.match(/\b(passe|manchete|recepcao|primeiro contato)\b/g) ?? []).length;
    const settingSignals = (mainText.match(/\b(levantamento|levantador|levantar|distribuicao|organizar ataque)\b/g) ?? []).length;
    if (passSignals < 4) {
      flags.push("Plano de passe sem sinais suficientes de passe/manchete/recepcao.");
    }
    if (settingSignals > 0) {
      flags.push("Plano de passe derivou para levantamento.");
    }
  }

  if (primarySkill === "saque") {
    const mainText = normalize(blocks.main.map((activity) => `${activity.name} ${activity.description}`).join(" "));
    const serveSignals = (mainText.match(/\b(saque|sacar|saca|sacador)\b/g) ?? []).length;
    if (serveSignals < 4) {
      flags.push("Plano de saque sem sinais suficientes de saque.");
    }
  }

  if (primarySkill === "levantamento") {
    const mainText = normalize(blocks.main.map((activity) => `${activity.name} ${activity.description}`).join(" "));
    const settingSignals = (mainText.match(/\b(levantamento|levantador|levanta|segundo contato)\b/g) ?? []).length;
    if (settingSignals < 4) {
      flags.push("Plano de levantamento sem sinais suficientes de levantamento.");
    }
  }

  return flags;
};
