import type { VolleyballSkill } from "../models";
import {
    ataqueLexicon,
    bloqueioLexicon,
    cognitivistaPhrases,
    defesaLexicon,
    levantamentoLexicon,
    passeLexicon,
    saqueLexicon,
    socioculturalPhrases,
    toVisibleCoachingText,
    tradicionalPhrases,
    transicaoLexicon,
} from "./coaching-lexicon";
import {
    detectPedagogicalApproach,
    type PedagogicalApproachDetection,
} from "./pedagogical-approach-detector";

export type SessionPedagogicalBlockKey = "warmup" | "main" | "cooldown";

export const buildSessionPedagogicalApproachInput = (
  parts: Array<string | null | undefined>
) =>
  parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(". ");

export const detectSessionPedagogicalApproach = (
  parts: Array<string | null | undefined>
): PedagogicalApproachDetection =>
  detectPedagogicalApproach(buildSessionPedagogicalApproachInput(parts));

export const buildSessionApproachAwareGeneralObjective = (
  targetSkill: VolleyballSkill,
  approach: PedagogicalApproachDetection,
  fallback: string
) => {
  if (!approach.hasObjectiveText) return fallback;

  const coreBySkill: Record<VolleyballSkill, string> = {
    passe: `${passeLexicon.control}, ${passeLexicon.direction} e dar sequência na jogada`,
    levantamento: `${levantamentoLexicon.base} para ${levantamentoLexicon.organize}`,
    ataque: `${ataqueLexicon.base} com melhor tempo, direção e ${ataqueLexicon.decision}`,
    bloqueio: `leitura e coordenação do ${bloqueioLexicon.base} para ${bloqueioLexicon.close}`,
    defesa: `${defesaLexicon.base} para ${defesaLexicon.continuity} e ${defesaLexicon.phrases[2]}`,
    saque: `${saqueLexicon.base} orientado por alvo para ${saqueLexicon.phrases[1]}`,
    transicao: `${transicaoLexicon.base} entre defesa e ataque para ${transicaoLexicon.continuity}`,
  };

  const core = coreBySkill[targetSkill] ?? fallback.toLowerCase();
  switch (approach.approach) {
    case "tradicional":
      return toVisibleCoachingText(
        `Consolidar ${core} com critério técnico observável e repetição orientada.`
      );
    case "cognitivista":
      return toVisibleCoachingText(
        `Desenvolver ${core} em situações que peçam leitura do contexto e escolha da melhor resposta.`
      );
    case "sociocultural":
      return toVisibleCoachingText(
        `Desenvolver ${core} com comunicação entre pares e construção coletiva da jogada.`
      );
    default:
      return toVisibleCoachingText(
        `Desenvolver ${core} combinando critério técnico, leitura da jogada e coordenação entre pares.`
      );
  }
};

export const buildSessionApproachGuideline = (
  approach: PedagogicalApproachDetection
) => {
  switch (approach.approach) {
    case "tradicional":
      return toVisibleCoachingText(
        `Conduzir com demonstração breve, ${tradicionalPhrases[0]}, ${tradicionalPhrases[1]} e ${tradicionalPhrases[2]}.`
      );
    case "cognitivista":
      return toVisibleCoachingText(
        `Criar variações curtas, ${cognitivistaPhrases[0]}, ${cognitivistaPhrases[1]} e ${cognitivistaPhrases[2]}.`
      );
    case "sociocultural":
      return toVisibleCoachingText(
        `Organizar duplas ou grupos, ${socioculturalPhrases[0]}, ${socioculturalPhrases[1]} e ${socioculturalPhrases[2]}.`
      );
    default:
      return toVisibleCoachingText(
        "Alternar demonstração curta, problema contextual e troca rápida entre pares ao longo da tarefa."
      );
  }
};

type SessionPedagogicalSubtask =
  | "recepcao_curta"
  | "manchete_longa"
  | "saque_zona_alvo"
  | "saque_ruptura"
  | "bloqueio_duplo"
  | "bloqueio_simples"
  | "cobertura_contra_ataque"
  | "defesa_ataque"
  | "defesa_ataque_ponta"
  | "defesa_largada";

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const inferSessionSkillFromText = (value: string): VolleyballSkill | null => {
  const text = normalizeText(value);
  if (!text) return null;
  if (/levant|segunda bola|2 toque|toque de bola/.test(text)) return "levantamento";
  if (/saque|servico|lancamento no saque/.test(text)) return "saque";
  if (/ataque|cortada|finaliz|golpe ofensivo/.test(text)) return "ataque";
  if (/passe|recepc|manchete|primeiro contato/.test(text)) return "passe";
  if (/bloque/.test(text)) return "bloqueio";
  if (/defes|cobertura/.test(text)) return "defesa";
  if (/transic|contra-ataque|continuidade da jogada/.test(text)) return "transicao";
  return null;
};

const inferSessionSubtaskFromText = (
  skill: VolleyballSkill | null,
  value: string
): SessionPedagogicalSubtask | null => {
  const text = normalizeText(value);
  if (!skill || !text) return null;

  if (skill === "passe") {
    if (/manchete|bola longa|trajetoria longa|fundo da quadra/.test(text)) {
      return "manchete_longa" as const;
    }
    if (/recepcao curta|saque curto|bola curta|curta na recepcao/.test(text)) {
      return "recepcao_curta" as const;
    }
  }

  if (skill === "saque") {
    if (/zona alvo|zona-alvo|alvo especifico|alvo definido|zona 1|zona 5|zona 6|corredor alvo/.test(text)) {
      return "saque_zona_alvo";
    }
    if (/ruptura|saque agressivo|quebrar recepcao|pressionar recepcao|saque tenso|saque potente/.test(text)) {
      return "saque_ruptura";
    }
  }

  if (skill === "defesa") {
    if (/ataque de ponta|bola na ponta|diagonal da ponta|ataque da entrada|ponteiro/.test(text)) {
      return "defesa_ataque_ponta";
    }
    if (/largada|bola largada|tip|ataque colocado|toque curto do atacante/.test(text)) {
      return "defesa_largada";
    }
  }

  if (skill === "bloqueio") {
    if (/duplo|dois bloqueadores|bloqueio em dupla|fechamento em dupla/.test(text)) {
      return "bloqueio_duplo" as const;
    }
    if (/simples|individual|um bloqueador/.test(text)) {
      return "bloqueio_simples" as const;
    }
  }

  if (skill === "transicao") {
    if (/cobertura|contra-ataque|recomposicao apos o ataque|segundo ataque/.test(text)) {
      return "cobertura_contra_ataque" as const;
    }
    if (/defesa.*ataque|saida apos defesa|transicao defesa-ataque|virada apos defesa/.test(text)) {
      return "defesa_ataque" as const;
    }
  }

  return null;
};

const resolveSessionSkillTopic = (
  skill: VolleyballSkill | null,
  fallbackTopic: string,
  detailText: string
) => {
  const subtask = inferSessionSubtaskFromText(skill, detailText);
  if (skill === "passe") {
    if (subtask === "recepcao_curta") {
      return {
        warmup: "ajuste de base e recepção curta com deslocamento reduzido",
        mainTradicional: `sequências de recepção curta com ${passeLexicon.stable}, ajuste fino de base e alvo definido`,
        mainCognitivista: "recepções curtas em diferentes zonas para comparar qual ajuste mantém melhor o controle da primeira bola",
        mainSociocultural: "organização da recepção curta em duplas para combinar chamada, prioridade e destino da bola",
        cooldown: "controle da recepção curta e leitura da bola próxima à rede",
      };
    }
    if (subtask === "manchete_longa") {
      return {
        warmup: "ajuste da manchete e deslocamento para bolas de trajetória longa",
        mainTradicional: `sequências de ${passeLexicon.long} com ${passeLexicon.stable}, alinhamento e ${passeLexicon.direction}`,
        mainCognitivista: "manchetes longas em diferentes profundidades para comparar qual leitura sustenta melhor a continuidade",
        mainSociocultural: "organização da manchete longa em pares para combinar cobertura, chamada e continuidade da jogada",
        cooldown: "controle da manchete longa e leitura das bolas profundas",
      };
    }
    return {
      warmup: "ajuste da manchete, deslocamento e direção do passe",
      mainTradicional: `sequências de passe com ${passeLexicon.stable}, ângulo do corpo e ${passeLexicon.direction}`,
      mainCognitivista: "diferentes trajetórias de passe para comparar qual solução mantém melhor a continuidade",
      mainSociocultural: "organização do passe em duplas ou trios para combinar alvo, ritmo e comunicação",
      cooldown: "controle do passe e leitura do primeiro contato",
    };
  }
  if (skill === "saque") {
    if (subtask === "saque_zona_alvo") {
      return {
        warmup: "ritmo de preparação, lançamento e direção do saque em zona-alvo",
        mainTradicional: "sequências de saque em zona-alvo com critério técnico de lançamento, contato e direção para zonas definidas",
        mainCognitivista: `saques em diferentes zonas-alvo para comparar qual direção consegue ${saqueLexicon.phrases[0]}`,
        mainSociocultural: `zonas-alvo de saque negociadas em grupo com comunicação sobre como ${saqueLexicon.phrases[0]}`,
        cooldown: "qualidade do saque em zona-alvo e leitura do efeito gerado",
      };
    }
    if (subtask === "saque_ruptura") {
      return {
        warmup: "ritmo de preparação e aceleração do saque para ruptura da recepção",
        mainTradicional: "sequências de saque de ruptura com critério técnico de lançamento, potência controlada e contato agressivo",
        mainCognitivista: `saques de ruptura em diferentes trajetórias para comparar qual pressão consegue ${saqueLexicon.phrases[1]}`,
        mainSociocultural: `estratégias coletivas de saque de ruptura com comunicação sobre pressão, cobertura e como ${saqueLexicon.phrases[2]}`,
        cooldown: "qualidade do saque de ruptura e leitura da resposta da recepção",
      };
    }
    return {
      warmup: "ritmo de preparação, lançamento e contato do saque",
      mainTradicional: "sequências de saque com critério técnico de lançamento e contato",
      mainCognitivista: `diferentes alvos de saque para decidir qual solução consegue ${saqueLexicon.phrases[2]}`,
      mainSociocultural: "zonas de saque negociadas em grupo com comunicação sobre a organização da jogada seguinte",
      cooldown: "qualidade do saque e escolha de alvo",
    };
  }
  if (skill === "ataque") {
    return {
      warmup: "tempo de aproximação, chamada e contato de ataque",
      mainTradicional: "sequências de ataque com critério técnico de aproximação, salto e finalização",
      mainCognitivista: `alternativas de ataque para comparar direção, tempo de bola e como ${ataqueLexicon.phrases[1]}`,
      mainSociocultural: "ocupação coletiva do espaço ofensivo com comunicação sobre cobertura e finalização",
      cooldown: "tempo de ataque e escolhas ofensivas",
    };
  }
  if (skill === "levantamento") {
    return {
      warmup: "base, posicionamento e contato do levantamento",
      mainTradicional: "sequências de levantamento com critério técnico de base, contato e direção da bola",
      mainCognitivista: `formas de ${levantamentoLexicon.distribution} para comparar qual levantamento ${levantamentoLexicon.organize}`,
      mainSociocultural: "combinações de levantamento em grupo com comunicação sobre tempo e destino da bola",
      cooldown: `organização do levantamento e leitura para ${levantamentoLexicon.distribution}`,
    };
  }
  if (skill === "defesa") {
    if (subtask === "defesa_ataque_ponta") {
      return {
        warmup: "base defensiva e leitura da diagonal do ataque de ponta",
        mainTradicional: "sequências de defesa do ataque de ponta com critério técnico de base, manchete e direção da bola recuperada",
        mainCognitivista: `defesas do ataque de ponta em diferentes diagonais para comparar qual leitura ajuda a ${defesaLexicon.continuity}`,
        mainSociocultural: `organização coletiva da defesa do ataque de ponta com comunicação sobre cobertura, prioridade e ${defesaLexicon.continuity}`,
        cooldown: "recuperação defensiva do ataque de ponta e leitura das diagonais mais frequentes",
      };
    }
    if (subtask === "defesa_largada") {
      return {
        warmup: "base baixa e leitura curta para defesa de largada",
        mainTradicional: "sequências de defesa de largada com critério técnico de reação curta, apoio e controle da bola",
        mainCognitivista: `situações de defesa de largada em diferentes zonas para comparar qual leitura curta ajuda a ${defesaLexicon.continuity}`,
        mainSociocultural: `organização coletiva da defesa de largada com comunicação sobre cobertura curta, chamada e ${defesaLexicon.continuity}`,
        cooldown: "recuperação de bolas largadas e leitura das ações curtas próximas à rede",
      };
    }
    return {
      warmup: "base defensiva, ajustes de apoio e leitura inicial da trajetória",
      mainTradicional: "sequências de defesa com critério técnico de base, manchete e direção da bola recuperada",
      mainCognitivista: `respostas defensivas a diferentes trajetórias para comparar qual leitura ajuda a ${defesaLexicon.continuity}`,
      mainSociocultural: `organização defensiva coletiva com comunicação sobre cobertura, responsabilidade e ${defesaLexicon.continuity}`,
      cooldown: "recuperação defensiva e leitura das bolas mais difíceis",
    };
  }
  if (skill === "transicao") {
    if (subtask === "defesa_ataque") {
      return {
        warmup: `reconexão entre defesa e ${transicaoLexicon.defenseAttack} após recuperação da bola`,
        mainTradicional: `sequências de transição defesa-ataque com critério técnico de reposicionamento, chamada e ${transicaoLexicon.defenseAttack}`,
        mainCognitivista: `transições defesa-ataque em diferentes cenários para comparar quando acelerar ou ${levantamentoLexicon.organize}`,
        mainSociocultural: `organização coletiva da transição defesa-ataque com comunicação sobre cobertura, chamada e ${transicaoLexicon.continuity}`,
        cooldown: `continuidade entre defesa e ataque e leitura de como ${transicaoLexicon.continuity}`,
      };
    }
    if (subtask === "cobertura_contra_ataque") {
      return {
        warmup: "reposição defensiva e cobertura após a primeira ação de contra-ataque",
        mainTradicional: `sequências de cobertura de contra-ataque com critério técnico de reposicionamento, base e nova ${transicaoLexicon.defenseAttack}`,
        mainCognitivista: "coberturas de contra-ataque em diferentes rebotes para comparar quando sustentar ou reiniciar a construção",
        mainSociocultural: `organização coletiva da cobertura de contra-ataque com comunicação sobre segunda bola, cobertura e ${transicaoLexicon.continuity}`,
        cooldown: "continuidade do contra-ataque e leitura das segundas ações ofensivas",
      };
    }
    return {
      warmup: "reposicionamento após a defesa e conexão inicial para a transição",
      mainTradicional: `sequências de transição com critério técnico de reposicionamento, chamada e ${transicaoLexicon.defenseAttack}`,
      mainCognitivista: "alternativas de transição para comparar quando acelerar, sustentar ou reorganizar a jogada",
      mainSociocultural: `organização coletiva da transição com comunicação sobre cobertura, saída e ${transicaoLexicon.continuity}`,
      cooldown: `continuidade entre defesa e ataque e leitura das escolhas para ${transicaoLexicon.continuity}`,
    };
  }
  if (skill === "bloqueio") {
    if (subtask === "bloqueio_simples") {
      return {
        warmup: "tempo de salto e posicionamento de mãos no bloqueio simples",
        mainTradicional: `sequências de ${bloqueioLexicon.simple} com critério técnico de deslocamento, ${bloqueioLexicon.timing} e mãos para ${bloqueioLexicon.phrases[1]}`,
        mainCognitivista: "leituras de bloqueio simples para comparar tempo de salto e melhor ponto de interceptação",
        mainSociocultural: "coordenação do bloqueio simples com comunicação sobre corredor, cobertura e ajuste com a defesa",
        cooldown: "tempo de bloqueio simples e organização da defesa próxima à rede",
      };
    }
    if (subtask === "bloqueio_duplo") {
      return {
        warmup: "sincronia de deslocamento e tempo de salto no bloqueio duplo",
        mainTradicional: `sequências de ${bloqueioLexicon.double} com critério técnico de sincronia, ${bloqueioLexicon.phrases[1]} e alinhamento das mãos`,
        mainCognitivista: "leituras de bloqueio duplo para comparar momento de junção, direção do ataque e ponto de interceptação",
        mainSociocultural: "coordenação coletiva do bloqueio duplo com comunicação entre bloqueadores, cobertura e ajuste da linha defensiva",
        cooldown: "sincronia do bloqueio duplo e organização coletiva próxima à rede",
      };
    }
    return {
      warmup: "tempo de salto, deslocamento lateral e posicionamento de mãos no bloqueio",
      mainTradicional: `sequências de bloqueio com critério técnico de deslocamento, ${bloqueioLexicon.timing} e ${bloqueioLexicon.close}`,
      mainCognitivista: "leituras de bloqueio para comparar tempo, direção do ataque e melhor ponto de interceptação",
      mainSociocultural: "coordenação coletiva do bloqueio com comunicação sobre corredor, cobertura e ajuste entre os jogadores",
      cooldown: "tempo de bloqueio e organização coletiva da defesa próxima à rede",
    };
  }
  return {
    warmup: fallbackTopic,
    mainTradicional: fallbackTopic,
    mainCognitivista: fallbackTopic,
    mainSociocultural: fallbackTopic,
    cooldown: fallbackTopic,
  };
};

export const buildSessionApproachAwareBlockDescription = (options: {
  core: string;
  blockKey: SessionPedagogicalBlockKey;
  pedagogicalApproach?: PedagogicalApproachDetection | null;
  fallback?: string;
  focusSkill?: VolleyballSkill | null;
  detailText?: string;
}) => {
  const core = String(options.core ?? "").trim();
  const fallback = String(options.fallback ?? "").trim();
  const topic = core || fallback || "a tarefa principal";
  const approach = options.pedagogicalApproach?.approach ?? "hibrido";
  const detailContext = `${core} ${fallback} ${String(options.detailText ?? "")}`;
  const skill = options.focusSkill ?? inferSessionSkillFromText(`${core} ${fallback}`);
  const subtask = inferSessionSubtaskFromText(skill, detailContext);
  const skillTopic = resolveSessionSkillTopic(
    skill,
    topic,
    detailContext
  );

  if (options.blockKey === "warmup") {
    if (approach === "tradicional") {
      return toVisibleCoachingText(
        `Os alunos iniciam ${skillTopic.warmup} com ativação progressiva, referência técnica definida e ajuste corretivo antes da parte principal.`
      );
    }
    if (approach === "cognitivista") {
      return toVisibleCoachingText(
        `Os alunos entram em ${skillTopic.warmup} testando pequenas variações, lendo o contexto e escolhendo a forma mais estável de iniciar a tarefa.`
      );
    }
    if (approach === "sociocultural") {
      return toVisibleCoachingText(
        `O grupo inicia ${skillTopic.warmup} em duplas ou trios, combinando critérios de execução e comunicação antes da parte principal.`
      );
    }
    return toVisibleCoachingText(
      `Os alunos iniciam ${skillTopic.warmup} com referência técnica, pequenas variações de contexto e troca rápida entre pares.`
    );
  }

  if (options.blockKey === "cooldown") {
    if (approach === "tradicional") {
      return toVisibleCoachingText(
        `O fechamento retoma ${skillTopic.cooldown} com síntese objetiva do critério técnico, organização final e recuperação gradual.`
      );
    }
    if (approach === "cognitivista") {
      return toVisibleCoachingText(
        `O fechamento revisa ${skillTopic.cooldown} com síntese do que funcionou, comparação entre escolhas e recuperação gradual.`
      );
    }
    if (approach === "sociocultural") {
      return toVisibleCoachingText(
        `O fechamento retoma ${skillTopic.cooldown} com troca entre pares, acordo sobre ajustes coletivos e recuperação gradual.`
      );
    }
    return toVisibleCoachingText(
      `O fechamento combina síntese técnica de ${skillTopic.cooldown}, breve reflexão sobre escolhas e reorganização final do grupo.`
    );
  }

  if (approach === "tradicional") {
    return toVisibleCoachingText(
      `Os alunos repetem ${skillTopic.mainTradicional} com correção objetiva entre tentativas.`
    );
  }
  if (approach === "cognitivista") {
    return toVisibleCoachingText(
      `Os alunos testam ${skillTopic.mainCognitivista}, comparam resultados e decidem qual resposta sustenta melhor a jogada.`
    );
  }
  if (approach === "sociocultural") {
    return toVisibleCoachingText(
      `A dupla ou o grupo organiza ${skillTopic.mainSociocultural}, comunica critérios entre pares e reajusta a ação a cada nova sequência.`
    );
  }
  if (skill === "levantamento") {
    return toVisibleCoachingText(
      `Os alunos alternam referência técnica do levantamento, teste de formas de ${levantamentoLexicon.distribution} e troca rápida entre pares para ${levantamentoLexicon.organize}.`
    );
  }
  if (skill === "passe" && subtask === "recepcao_curta") {
    return toVisibleCoachingText(
      "Os alunos alternam referência técnica da recepção curta, teste de ajustes de base e troca rápida entre pares para controlar a primeira bola."
    );
  }
  if (skill === "passe" && subtask === "manchete_longa") {
    return toVisibleCoachingText(
      "Os alunos alternam referência técnica da manchete longa, leitura de profundidade e troca rápida entre pares para sustentar a continuidade."
    );
  }
  if (skill === "saque") {
    if (subtask === "saque_zona_alvo") {
      return toVisibleCoachingText(
        `Os alunos alternam referência técnica do saque em zonas-alvo, teste de direções para zonas definidas e troca rápida entre pares para ${saqueLexicon.phrases[0]}.`
      );
    }
    if (subtask === "saque_ruptura") {
      return toVisibleCoachingText(
        `Os alunos alternam referência técnica do saque de ruptura, teste de pressão sobre a recepção e troca rápida entre pares para ${saqueLexicon.phrases[1]}.`
      );
    }
    return toVisibleCoachingText(
      `Os alunos alternam referência técnica do saque, teste de alvos e troca rápida entre pares para ${saqueLexicon.phrases[2]}.`
    );
  }
  if (skill === "passe") {
    return toVisibleCoachingText(
      "Os alunos alternam referência técnica do passe, teste de trajetórias e troca rápida entre pares para sustentar a continuidade."
    );
  }
  if (skill === "ataque") {
    return toVisibleCoachingText(
      "Os alunos alternam referência técnica do ataque, teste de direções e troca rápida entre pares para qualificar a finalização."
    );
  }
  if (skill === "defesa") {
    if (subtask === "defesa_ataque_ponta") {
      return toVisibleCoachingText(
        `Os alunos alternam referência técnica da defesa do ataque de ponta, leitura de diagonal e troca rápida entre pares para ${defesaLexicon.continuity}.`
      );
    }
    if (subtask === "defesa_largada") {
      return toVisibleCoachingText(
        `Os alunos alternam referência técnica da defesa de largada, leitura curta e troca rápida entre pares para ${defesaLexicon.phrases[2]} perto da rede.`
      );
    }
    return toVisibleCoachingText(
      `Os alunos alternam referência técnica da defesa, teste de leituras de trajetória e troca rápida entre pares para ${defesaLexicon.continuity}.`
    );
  }
  if (skill === "transicao") {
    if (subtask === "cobertura_contra_ataque") {
      return toVisibleCoachingText(
        `Os alunos alternam referência técnica da cobertura de contra-ataque, leitura de segunda bola e troca rápida entre pares para ${transicaoLexicon.continuity}.`
      );
    }
    if (subtask === "defesa_ataque") {
      return toVisibleCoachingText(
        `Os alunos alternam referência técnica da transição defesa-ataque, leitura da melhor ${transicaoLexicon.defenseAttack} e troca rápida entre pares para ${transicaoLexicon.continuity}.`
      );
    }
    return toVisibleCoachingText(
      `Os alunos alternam referência técnica da transição, teste de saídas para o contra-ataque e troca rápida entre pares para ${transicaoLexicon.continuity}.`
    );
  }
  if (skill === "bloqueio") {
    if (subtask === "bloqueio_duplo") {
      return toVisibleCoachingText(
        `Os alunos alternam referência técnica do ${bloqueioLexicon.double}, ajuste de sincronia entre bloqueadores e troca rápida entre pares para ${bloqueioLexicon.phrases[1]}.`
      );
    }
    if (subtask === "bloqueio_simples") {
      return toVisibleCoachingText(
        `Os alunos alternam referência técnica do ${bloqueioLexicon.simple}, ajuste de ${bloqueioLexicon.timing} e troca rápida entre pares para ${bloqueioLexicon.phrases[1]}.`
      );
    }
    return toVisibleCoachingText(
      `Os alunos alternam referência técnica do bloqueio, teste de ${bloqueioLexicon.timing} e troca rápida entre pares para ${bloqueioLexicon.close}.`
    );
  }
  return toVisibleCoachingText(
    `Os alunos alternam repetição orientada, teste de solução e troca rápida entre pares para qualificar ${topic}.`
  );
};

export const formatSessionPedagogicalRiskLabel = (
  value: PedagogicalApproachDetection["traditionalConductionRisk"] | undefined
) => {
  if (value === "alto") return "Alto";
  if (value === "medio") return "Médio";
  return "Baixo";
};
