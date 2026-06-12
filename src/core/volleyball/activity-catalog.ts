import type {
  PedagogicalIntent,
  PhaseIntent,
  ProgressionDimension,
  VolleyballSkill,
  WeeklyLoadIntent,
} from "../models";
import type { ActivityPatternAgeStage, ActivityPatternStage } from "./activity-pattern-engine";

export type ActivityCatalogComplexity = "baixa" | "moderada" | "alta";
export type ActivityCatalogDemand = "baixa" | "media" | "alta";
export type ActivityCatalogEnvironment = "quadra" | "casa" | "praia" | "qualquer";
export type ActivityCatalogFormat =
  | "individual"
  | "dupla"
  | "trio"
  | "cooperacao"
  | "jogo_reduzido"
  | "jogo_aplicado";
export type ActivityCatalogGamePhase =
  | "aquecimento_motor"
  | "recepcao"
  | "saque_recepcao"
  | "rally"
  | "sideout"
  | "transicao"
  | "defesa_cobertura"
  | "ataque"
  | "fechamento";

export type ActivityCatalogTaxonomy = {
  skill: VolleyballSkill;
  gamePhase: ActivityCatalogGamePhase;
  pedagogicalIntent: PedagogicalIntent;
  complexity: ActivityCatalogComplexity;
  ageRange: ActivityPatternAgeStage[];
  format: ActivityCatalogFormat;
  environment: ActivityCatalogEnvironment;
  cognitiveDemand: ActivityCatalogDemand;
  physicalDemand: ActivityCatalogDemand;
  recommendedPhase: ActivityPatternStage;
  periodizationCompatibility: PhaseIntent[];
  progressionCompatibility: ProgressionDimension[];
  loadCompatibility: WeeklyLoadIntent[];
  families: string[];
};

export type ActivityCatalogVariant = {
  id: string;
  taxonomy: ActivityCatalogTaxonomy;
  periodizationFit: Array<"exploration" | "technical" | "decision" | "pressure" | "game_transfer">;
  name: string;
  players: string;
  setup: string;
  starter: string;
  action: string;
  rotation: string;
  constraint?: string;
  scoring?: string;
  progression?: string;
  commonMistakes?: string[];
  adaptations?: string[];
  avoid?: string[];
  materials: string[];
  space: string;
};

export type ActivityCatalogFamily = {
  id: string;
  title: string;
  purpose: string;
  source: "goatleta_original";
  variants: ActivityCatalogVariant[];
};

export type ActivityCatalogSelectionReasonCode =
  | "skill_match"
  | "secondary_skill_match"
  | "age_match"
  | "periodization_match"
  | "progression_match"
  | "intent_match"
  | "load_match"
  | "recent_history_avoided"
  | "materials_match"
  | "scouting_or_feedback_match";

export type ActivityCatalogSelectionReason = {
  code: ActivityCatalogSelectionReasonCode;
  label: string;
};

export type ActivityCatalogRecommendation = {
  variant: ActivityCatalogVariant;
  score: number;
  reasons: ActivityCatalogSelectionReason[];
};

export type ActivityCatalogRecommendationContext = {
  primarySkill: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  ageStage: ActivityPatternAgeStage;
  phaseIntent?: PhaseIntent;
  progressionDimension?: ProgressionDimension;
  pedagogicalIntent?: PedagogicalIntent;
  loadIntent?: WeeklyLoadIntent;
  recentActivityFamilies?: string[];
  materials?: string[];
  recentDifficulties?: string[];
  stage?: ActivityPatternStage;
};

export type ActivityCatalogAudit = {
  totalFamilies: number;
  totalVariants: number;
  bySkill: Record<VolleyballSkill, number>;
  byAgeStage: Record<ActivityPatternAgeStage, number>;
  byPedagogicalIntent: Record<PedagogicalIntent, number>;
  byPeriodizationCompatibility: Record<PhaseIntent, number>;
  gaps: Array<{
    skill: VolleyballSkill;
    ageStage: ActivityPatternAgeStage;
    recommendedPhase: ActivityPatternStage;
  }>;
};

const allAgeStages: ActivityPatternAgeStage[] = [
  "early",
  "base",
  "transition",
  "formation",
  "specialization",
];

const allPhaseIntents: PhaseIntent[] = [
  "exploracao_fundamentos",
  "estabilizacao_tecnica",
  "aceleracao_decisao",
  "transferencia_jogo",
  "pressao_competitiva",
];

const allSkills: VolleyballSkill[] = [
  "passe",
  "levantamento",
  "ataque",
  "bloqueio",
  "defesa",
  "saque",
  "transicao",
];

const allStages: ActivityPatternStage[] = ["warmup", "drill", "game"];

const baseTaxonomy = (
  input: Pick<
    ActivityCatalogTaxonomy,
    | "skill"
    | "gamePhase"
    | "pedagogicalIntent"
    | "complexity"
    | "ageRange"
    | "format"
    | "environment"
    | "cognitiveDemand"
    | "physicalDemand"
    | "recommendedPhase"
    | "periodizationCompatibility"
    | "progressionCompatibility"
    | "loadCompatibility"
    | "families"
  >
): ActivityCatalogTaxonomy => input;

export const ACTIVITY_CATALOG_FAMILIES: ActivityCatalogFamily[] = [
  {
    id: "continuidade_tres_contatos",
    title: "Continuidade com tres contatos",
    purpose: "Aumentar cooperacao, chamada da bola e primeiro contato jogavel.",
    source: "goatleta_original",
    variants: [
      {
        id: "catalog-continuidade-warmup-trajetoria",
        taxonomy: baseTaxonomy({
          skill: "passe",
          gamePhase: "recepcao",
          pedagogicalIntent: "technical_adjustment",
          complexity: "baixa",
          ageRange: ["early", "base"],
          format: "cooperacao",
          environment: "quadra",
          cognitiveDemand: "baixa",
          physicalDemand: "baixa",
          recommendedPhase: "warmup",
          periodizationCompatibility: ["exploracao_fundamentos", "estabilizacao_tecnica"],
          progressionCompatibility: ["consistencia", "precisao"],
          loadCompatibility: ["baixo", "moderado"],
          families: ["catalogo", "continuidade", "trajetoria", "cooperacao"],
        }),
        periodizationFit: ["exploration", "technical"],
        name: "Caça da bola jogável",
        players: "duplas ou trios",
        setup: "Marcar zonas largas com cones em meia quadra e deixar uma bola por grupo.",
        starter: "Um aluno inicia a bola por baixo para dentro da zona do grupo.",
        action: "O grupo chama a bola, faz um primeiro contato jogável e tenta manter a sequência curta.",
        rotation: "Depois de cada sequência, muda quem inicia e quem recebe a primeira bola.",
        constraint: "Erro não elimina; o grupo recolhe e reinicia rápido.",
        scoring: "Conta ponto quando o grupo consegue três contatos com chamada clara.",
        progression: "Na segunda rodada, mudar a zona de entrada da bola.",
        commonMistakes: ["sem chamada", "grupo parado depois do erro"],
        adaptations: ["Facilitar com bola mais alta; dificultar alternando zona curta e longa."],
        avoid: ["fila", "acerto obrigatório para continuar"],
        materials: ["bolas", "cones"],
        space: "meia quadra",
      },
      {
        id: "catalog-continuidade-game-3-contatos",
        taxonomy: baseTaxonomy({
          skill: "passe",
          gamePhase: "rally",
          pedagogicalIntent: "decision_making",
          complexity: "moderada",
          ageRange: ["base", "transition", "formation"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "game",
          periodizationCompatibility: ["estabilizacao_tecnica", "aceleracao_decisao", "transferencia_jogo"],
          progressionCompatibility: ["tomada_decisao", "transferencia_jogo"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "continuidade", "jogo_condicionado", "primeiro_contato"],
        }),
        periodizationFit: ["decision", "game_transfer"],
        name: "Mini jogo da continuidade",
        players: "equipes pequenas",
        setup: "Montar miniquadras com uma zona bônus para o primeiro contato.",
        starter: "A bola entra por lançamento combinado ou saque adaptado.",
        action: "A equipe tenta manter o rally e fazer o primeiro contato voltar jogável para um colega.",
        rotation: "Depois de cada rally, troca quem inicia e todos rodam uma função curta.",
        constraint: "O erro encerra só o rally; a próxima bola entra rápido.",
        scoring: "Vale ponto extra quando a equipe organiza três contatos.",
        progression: "Reduzir a zona bônus quando a turma sustentar a continuidade.",
        commonMistakes: ["todos esperam a mesma bola", "rally travado"],
        adaptations: ["Facilitar ampliando a zona; dificultar usando saque adaptado."],
        avoid: ["jogo formal 6x6 precoce", "fila"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "troca_continua_tarefa_dupla",
    title: "Troca continua com tarefa dupla",
    purpose: "Trabalhar controle, tempo de bola e alternancia de acoes sem repeticao mecanica.",
    source: "goatleta_original",
    variants: [
      {
        id: "catalog-troca-dupla-drill",
        taxonomy: baseTaxonomy({
          skill: "levantamento",
          gamePhase: "rally",
          pedagogicalIntent: "decision_making",
          complexity: "moderada",
          ageRange: ["transition", "formation"],
          format: "trio",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "drill",
          periodizationCompatibility: ["estabilizacao_tecnica", "aceleracao_decisao"],
          progressionCompatibility: ["precisao", "tomada_decisao"],
          loadCompatibility: ["baixo", "moderado"],
          families: ["catalogo", "troca_continua", "cooperacao", "segundo_contato"],
        }),
        periodizationFit: ["technical", "decision"],
        name: "Troca contínua com bola auxiliar",
        players: "trios",
        setup: "Organizar trios em meia quadra, com uma bola principal e uma bola auxiliar leve.",
        starter: "Um aluno inicia a bola principal para o colega da zona central.",
        action: "O trio mantém a bola principal jogável e troca a bola auxiliar somente depois do apoio central.",
        rotation: "A cada 5 bolas, todos rodam a função de início, apoio e zona central.",
        constraint: "A bola auxiliar não para a tarefa; se cair, o trio recolhe e segue na próxima bola.",
        scoring: "Conta ponto quando o apoio central sai alto e jogável.",
        progression: "Dificultar pedindo deslocamento curto antes do apoio central.",
        commonMistakes: ["olhar só para a bola auxiliar", "apoio central baixo"],
        adaptations: ["Facilitar retirando a bola auxiliar; dificultar mudando a direção da entrada."],
        avoid: ["fila", "dupla tarefa para crianças muito novas"],
        materials: ["bolas", "cones"],
        space: "meia quadra",
      },
      {
        id: "catalog-troca-dupla-game",
        taxonomy: baseTaxonomy({
          skill: "passe",
          gamePhase: "rally",
          pedagogicalIntent: "game_reading",
          complexity: "alta",
          ageRange: ["formation", "specialization"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "media",
          recommendedPhase: "game",
          periodizationCompatibility: ["transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["transferencia_jogo", "pressao_tempo"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "troca_continua", "jogo_condicionado", "pressao_controlada"],
        }),
        periodizationFit: ["pressure", "game_transfer"],
        name: "Rally com tarefa de apoio",
        players: "equipes pequenas",
        setup: "Montar mini 4x4 com uma zona de apoio marcada por cones.",
        starter: "A bola entra por saque adaptado para uma das equipes.",
        action: "A equipe recebe, usa a zona de apoio e decide se acelera ou mantém a bola em jogo.",
        rotation: "Depois de cada rally, troca quem inicia e todos rodam uma função.",
        constraint: "A equipe marca bônus quando usa a zona de apoio antes de devolver.",
        scoring: "Ponto extra para rally com recepção jogável e apoio claro.",
        progression: "Reduzir a zona de apoio ou aumentar a velocidade da bola de entrada.",
        commonMistakes: ["decisão apressada", "apoio parado"],
        adaptations: ["Facilitar com lançamento; dificultar usando saque mais direcionado."],
        avoid: ["sistema adulto fechado", "regra longa demais"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "sideout_saque_recepcao",
    title: "Sideout e saque-recepcao",
    purpose: "Conectar saque, recepcao e organizacao inicial do ataque.",
    source: "goatleta_original",
    variants: [
      {
        id: "catalog-sideout-drill-recepcao",
        taxonomy: baseTaxonomy({
          skill: "passe",
          gamePhase: "saque_recepcao",
          pedagogicalIntent: "technical_adjustment",
          complexity: "moderada",
          ageRange: ["transition", "formation"],
          format: "trio",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "drill",
          periodizationCompatibility: ["estabilizacao_tecnica", "aceleracao_decisao"],
          progressionCompatibility: ["precisao", "tomada_decisao"],
          loadCompatibility: ["moderado"],
          families: ["catalogo", "sideout", "saque_recepcao", "alvo_zona"],
        }),
        periodizationFit: ["technical", "decision"],
        name: "Recepção para organizar sideout",
        players: "trios",
        setup: "Marcar uma zona de recepção e uma zona de apoio em meia quadra.",
        starter: "Um aluno inicia com saque adaptado ou lançamento por baixo.",
        action: "Quem recebe chama a bola e tenta enviar o primeiro contato jogável para a zona de apoio.",
        rotation: "A cada 5 bolas, o trio troca saque, recepção e apoio.",
        constraint: "A próxima bola entra mesmo quando a recepção não chega perfeita.",
        scoring: "Vale ponto quando a recepção permite apoio jogável.",
        progression: "Alternar saque curto e longo na segunda rodada.",
        commonMistakes: ["recepção sem chamada", "apoio parado"],
        adaptations: ["Facilitar ampliando a zona; dificultar reduzindo o espaço."],
        avoid: ["professor alimentando todos", "acerto obrigatório"],
        materials: ["bolas", "cones"],
        space: "meia quadra",
      },
      {
        id: "catalog-sideout-game",
        taxonomy: baseTaxonomy({
          skill: "saque",
          gamePhase: "sideout",
          pedagogicalIntent: "game_reading",
          complexity: "alta",
          ageRange: ["formation", "specialization"],
          format: "jogo_aplicado",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "alta",
          recommendedPhase: "game",
          periodizationCompatibility: ["transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["tomada_decisao", "transferencia_jogo"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "sideout", "saque_recepcao", "jogo_condicionado"],
        }),
        periodizationFit: ["decision", "pressure", "game_transfer"],
        name: "Mini sideout com bônus de construção",
        players: "equipes pequenas",
        setup: "Montar mini 4x4 com equipe sacadora e equipe de recepção.",
        starter: "Todo rally começa com saque adaptado da equipe sacadora.",
        action: "A equipe de recepção tenta construir a jogada com primeiro e segundo contato jogáveis.",
        rotation: "Depois de cada rally, troca sacador e as equipes rodam uma posição.",
        constraint: "O saque precisa iniciar o rally; o ponto bônus vem da construção, não só do erro adversário.",
        scoring: "Bônus quando recepção e segundo contato permitem ataque ou devolução organizada.",
        progression: "Reduzir a zona de recepção ou pedir saque em zona escolhida.",
        commonMistakes: ["sacar sem alvo", "recepção sem continuidade"],
        adaptations: ["Facilitar com saque mais próximo; dificultar com zona de saque chamada."],
        avoid: ["jogo adulto formal", "pontuação só por erro"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "defesa_cobertura_fora_sistema",
    title: "Defesa, cobertura e bola fora do sistema",
    purpose: "Ensinar a equipe a salvar, cobrir e reorganizar a bola sob desequilibrio.",
    source: "goatleta_original",
    variants: [
      {
        id: "catalog-defesa-cobertura-drill",
        taxonomy: baseTaxonomy({
          skill: "defesa",
          gamePhase: "defesa_cobertura",
          pedagogicalIntent: "decision_making",
          complexity: "moderada",
          ageRange: ["transition", "formation"],
          format: "trio",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "drill",
          periodizationCompatibility: ["aceleracao_decisao", "transferencia_jogo"],
          progressionCompatibility: ["tomada_decisao", "oposicao"],
          loadCompatibility: ["moderado"],
          families: ["catalogo", "defesa", "cobertura", "fora_sistema"],
        }),
        periodizationFit: ["decision", "game_transfer"],
        name: "Defende, cobre e devolve jogável",
        players: "trios",
        setup: "Montar trios com uma zona de defesa e uma zona curta de cobertura.",
        starter: "Um aluno inicia com bola variada para a zona de defesa.",
        action: "O trio defende, cobre a sobra e tenta devolver uma bola jogável para continuar.",
        rotation: "A cada 4 bolas, troca quem inicia, defende e cobre.",
        constraint: "A defesa não precisa ser perfeita; precisa permitir uma próxima ação.",
        scoring: "Conta ponto quando defesa e cobertura mantêm a bola viva.",
        progression: "Variar profundidade da bola de entrada.",
        commonMistakes: ["cobertura atrasada", "desistir depois da defesa ruim"],
        adaptations: ["Facilitar com bola mais alta; dificultar reduzindo a zona."],
        avoid: ["mergulho obrigatório", "fila"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
      {
        id: "catalog-fora-sistema-game",
        taxonomy: baseTaxonomy({
          skill: "transicao",
          gamePhase: "transicao",
          pedagogicalIntent: "team_organization",
          complexity: "alta",
          ageRange: ["formation", "specialization"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "alta",
          recommendedPhase: "game",
          periodizationCompatibility: ["transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["transferencia_jogo", "pressao_tempo"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "fora_sistema", "transicao", "jogo_condicionado"],
        }),
        periodizationFit: ["pressure", "game_transfer"],
        name: "Rally de reorganização",
        players: "equipes pequenas",
        setup: "Montar mini 4x4 com uma zona marcada para bola fora do sistema.",
        starter: "A bola entra variada, fora da zona ideal de recepção.",
        action: "A equipe precisa salvar, chamar apoio e escolher uma devolução segura ou uma transição simples.",
        rotation: "Depois de cada rally, todos rodam uma função curta.",
        constraint: "Bônus quando a equipe reorganiza sem devolver a bola de primeira sem intenção.",
        scoring: "Vale ponto extra quando a equipe salva e devolve jogável com comunicação.",
        progression: "Aumentar velocidade da bola de entrada ou reduzir a zona de apoio.",
        commonMistakes: ["devolver sem intenção", "ninguém assume a segunda bola"],
        adaptations: ["Facilitar permitindo lançar a segunda bola; dificultar com oposição maior."],
        avoid: ["sistema tático fechado", "rally parado"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "ataque_transicao_zona_livre",
    title: "Ataque e transicao para zona livre",
    purpose: "Ligar finalizacao, cobertura e leitura de espaco em jogo reduzido.",
    source: "goatleta_original",
    variants: [
      {
        id: "catalog-ataque-zona-livre-drill",
        taxonomy: baseTaxonomy({
          skill: "ataque",
          gamePhase: "ataque",
          pedagogicalIntent: "decision_making",
          complexity: "moderada",
          ageRange: ["transition", "formation"],
          format: "trio",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "drill",
          periodizationCompatibility: ["estabilizacao_tecnica", "aceleracao_decisao"],
          progressionCompatibility: ["precisao", "tomada_decisao"],
          loadCompatibility: ["moderado"],
          families: ["catalogo", "ataque", "zona_livre", "alvo_zona"],
        }),
        periodizationFit: ["technical", "decision"],
        name: "Finalização para zona livre",
        players: "trios",
        setup: "Marcar duas zonas livres em quadra reduzida, com uma bola por trio.",
        starter: "Um aluno inicia com bola preparada para o colega finalizar.",
        action: "Quem finaliza escolhe uma zona livre e o terceiro aluno cobre a sobra.",
        rotation: "A cada 5 bolas, o trio troca quem prepara, finaliza e cobre.",
        constraint: "A finalização vale quando tem escolha de zona, mesmo sem força.",
        scoring: "Conta ponto quando a bola vai para zona livre ou gera continuidade.",
        progression: "Adicionar oposição leve na zona de defesa.",
        commonMistakes: ["bater forte sem ler espaço", "sem cobertura"],
        adaptations: ["Facilitar com bola lançada; dificultar com bloqueio sombra."],
        avoid: ["potência como único critério", "fila"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
      {
        id: "catalog-ataque-transicao-game",
        taxonomy: baseTaxonomy({
          skill: "transicao",
          gamePhase: "transicao",
          pedagogicalIntent: "team_organization",
          complexity: "alta",
          ageRange: ["formation", "specialization"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "alta",
          recommendedPhase: "game",
          periodizationCompatibility: ["transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["transferencia_jogo", "oposicao"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "ataque", "transicao", "jogo_condicionado"],
        }),
        periodizationFit: ["pressure", "game_transfer"],
        name: "Vira-jogo com cobertura",
        players: "equipes pequenas",
        setup: "Montar mini 4x4 com uma zona de cobertura atrás da finalização.",
        starter: "A bola entra por defesa ou recepção controlada.",
        action: "A equipe passa da defesa ao ataque e precisa cobrir a bola final.",
        rotation: "Depois de cada rally, troca quem inicia e todos rodam uma função.",
        constraint: "A equipe só ganha bônus se finalizar com cobertura organizada.",
        scoring: "Ponto extra quando ataque e cobertura aparecem na mesma jogada.",
        progression: "Reduzir tempo entre defesa e bola final.",
        commonMistakes: ["atacar sem cobertura", "demora para reorganizar"],
        adaptations: ["Facilitar com bola alta; dificultar com oposição real."],
        avoid: ["sistema adulto rígido", "ataque isolado"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "forca_preventiva_integrada",
    title: "Forca preventiva integrada",
    purpose: "Preparar aterrissagem, estabilidade e deslocamento com linguagem apropriada a idade.",
    source: "goatleta_original",
    variants: [
      {
        id: "catalog-preventivo-warmup-fundamental",
        taxonomy: baseTaxonomy({
          skill: "defesa",
          gamePhase: "aquecimento_motor",
          pedagogicalIntent: "technical_adjustment",
          complexity: "baixa",
          ageRange: ["early", "base", "transition"],
          format: "cooperacao",
          environment: "quadra",
          cognitiveDemand: "baixa",
          physicalDemand: "media",
          recommendedPhase: "warmup",
          periodizationCompatibility: ["exploracao_fundamentos", "estabilizacao_tecnica"],
          progressionCompatibility: ["consistencia", "precisao"],
          loadCompatibility: ["baixo", "moderado"],
          families: ["catalogo", "controle_corporal", "prevencao", "deslocamento"],
        }),
        periodizationFit: ["exploration", "technical"],
        name: "Circuito de aterrissagem e reação",
        players: "duplas ou trios",
        setup: "Montar estações curtas com cones, linhas e uma bola por grupo.",
        starter: "Ao sinal, um aluno faz deslocamento curto e recebe uma bola leve do colega.",
        action: "O grupo combina deslocar, equilibrar, receber e devolver a bola com controle.",
        rotation: "A cada 4 repetições, troca quem desloca, quem lança e quem observa.",
        constraint: "O movimento deve terminar equilibrado antes da próxima bola.",
        scoring: "Conta ponto quando o colega termina equilibrado e devolve jogável.",
        progression: "Adicionar mudança de direção antes da devolução.",
        commonMistakes: ["pressa sem equilíbrio", "parar a fila"],
        adaptations: ["Facilitar reduzindo distância; dificultar com reação a chamada de zona."],
        avoid: ["linguagem clínica", "exercício isolado longo"],
        materials: ["bolas", "cones"],
        space: "meia quadra",
      },
      {
        id: "catalog-preventivo-warmup-especializado",
        taxonomy: baseTaxonomy({
          skill: "transicao",
          gamePhase: "aquecimento_motor",
          pedagogicalIntent: "pressure_adaptation",
          complexity: "moderada",
          ageRange: ["formation", "specialization"],
          format: "trio",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "alta",
          recommendedPhase: "warmup",
          periodizationCompatibility: ["aceleracao_decisao", "transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["pressao_tempo", "oposicao"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "controle_corporal", "prevencao", "transicao"],
        }),
        periodizationFit: ["pressure", "game_transfer"],
        name: "Entrada, freio e cobertura",
        players: "trios",
        setup: "Montar três zonas curtas: entrada, freio e cobertura.",
        starter: "Um aluno chama a zona e inicia a bola para o trio.",
        action: "O trio acelera, freia equilibrado, cobre a sobra e devolve uma bola jogável.",
        rotation: "A cada 4 bolas, troca quem chama, quem entra e quem cobre.",
        constraint: "A jogada vale quando o freio termina com equilíbrio e cobertura pronta.",
        scoring: "Bônus quando a transição acontece sem choque entre colegas.",
        progression: "Aumentar distância ou variar a zona chamada.",
        commonMistakes: ["cruzar espaço do colega", "cobertura atrasada"],
        adaptations: ["Facilitar diminuindo distância; dificultar com duas zonas chamadas."],
        avoid: ["carga excessiva antes da parte principal", "fila"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
];

export const ACTIVITY_CATALOG_VARIANTS: ActivityCatalogVariant[] =
  ACTIVITY_CATALOG_FAMILIES.flatMap((family) => family.variants);

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const hasAnyFamily = (left: string[] = [], right: string[] = []) => {
  const normalizedLeft = left.map(normalize);
  return right.some((item) => normalizedLeft.includes(normalize(item)));
};

const textRelatesToFamily = (text: string, family: string) => {
  const normalizedText = normalize(text);
  const normalizedFamily = normalize(family);
  return (
    normalizedText.includes(normalizedFamily) ||
    normalizedFamily.includes(normalizedText)
  );
};

const reason = (
  code: ActivityCatalogSelectionReasonCode,
  label: string
): ActivityCatalogSelectionReason => ({ code, label });

export const recommendActivityCatalogVariants = (
  context: ActivityCatalogRecommendationContext
): ActivityCatalogRecommendation[] => {
  const hasPrimarySkillCoverage = ACTIVITY_CATALOG_VARIANTS.some(
    (variant) => variant.taxonomy.skill === context.primarySkill
  );
  if (!hasPrimarySkillCoverage) return [];

  return ACTIVITY_CATALOG_VARIANTS.filter(
    (variant) =>
      variant.taxonomy.skill === context.primarySkill ||
      variant.taxonomy.skill === context.secondarySkill
  ).map((variant) => {
    const taxonomy = variant.taxonomy;
    const reasons: ActivityCatalogSelectionReason[] = [];
    let score = 0;

    if (taxonomy.skill === context.primarySkill) {
      score += 80;
      reasons.push(reason("skill_match", `habilidade principal: ${context.primarySkill}`));
    } else if (taxonomy.skill === context.secondarySkill) {
      score += 24;
      reasons.push(reason("secondary_skill_match", `habilidade secundaria: ${context.secondarySkill}`));
    } else {
      score -= 48;
    }

    if (taxonomy.ageRange.includes(context.ageStage)) {
      score += 36;
      reasons.push(reason("age_match", `faixa etaria: ${context.ageStage}`));
    } else {
      score -= 20;
    }

    if (context.phaseIntent && taxonomy.periodizationCompatibility.includes(context.phaseIntent)) {
      score += 64;
      reasons.push(reason("periodization_match", `periodizacao: ${context.phaseIntent}`));
    } else if (context.phaseIntent) {
      score -= 32;
    }

    if (
      context.progressionDimension &&
      taxonomy.progressionCompatibility.includes(context.progressionDimension)
    ) {
      score += 32;
      reasons.push(reason("progression_match", `progressao: ${context.progressionDimension}`));
    }

    if (context.pedagogicalIntent && taxonomy.pedagogicalIntent === context.pedagogicalIntent) {
      score += 28;
      reasons.push(reason("intent_match", `intencao pedagogica: ${context.pedagogicalIntent}`));
    }

    if (context.loadIntent && taxonomy.loadCompatibility.includes(context.loadIntent)) {
      score += 12;
      reasons.push(reason("load_match", `carga: ${context.loadIntent}`));
    }

    if (context.stage && taxonomy.recommendedPhase === context.stage) {
      score += 10;
    }

    if (!hasAnyFamily(context.recentActivityFamilies, taxonomy.families)) {
      score += 10;
      reasons.push(reason("recent_history_avoided", "evita repetir familia recente"));
    } else {
      score -= 24;
      reasons.push(reason("anti_repetition", "familia apareceu no historico recente"));
    }

    if (
      variant.materials.every((material) =>
        (context.materials ?? []).map(normalize).some((item) => item.includes(normalize(material)))
      )
    ) {
      score += 6;
      reasons.push(reason("materials_match", "materiais disponiveis"));
    }

    if (
      context.recentDifficulties?.some((difficulty) =>
        taxonomy.families.some((family) => textRelatesToFamily(difficulty, family))
      )
    ) {
      score += 8;
      reasons.push(reason("scouting_or_feedback_match", "responde a dificuldade recente"));
    }

    return { variant, score, reasons };
  }).sort((left, right) => right.score - left.score || left.variant.id.localeCompare(right.variant.id));
};

export const auditActivityCatalog = (): ActivityCatalogAudit => {
  const bySkill = Object.fromEntries(allSkills.map((skill) => [skill, 0])) as Record<VolleyballSkill, number>;
  const byAgeStage = Object.fromEntries(allAgeStages.map((stage) => [stage, 0])) as Record<ActivityPatternAgeStage, number>;
  const byPedagogicalIntent = Object.fromEntries(
    [
      "technical_adjustment",
      "decision_making",
      "game_reading",
      "team_organization",
      "pressure_adaptation",
    ].map((intent) => [intent, 0])
  ) as Record<PedagogicalIntent, number>;
  const byPeriodizationCompatibility = Object.fromEntries(
    allPhaseIntents.map((phase) => [phase, 0])
  ) as Record<PhaseIntent, number>;

  ACTIVITY_CATALOG_VARIANTS.forEach((variant) => {
    bySkill[variant.taxonomy.skill] += 1;
    variant.taxonomy.ageRange.forEach((stage) => {
      byAgeStage[stage] += 1;
    });
    byPedagogicalIntent[variant.taxonomy.pedagogicalIntent] += 1;
    variant.taxonomy.periodizationCompatibility.forEach((phase) => {
      byPeriodizationCompatibility[phase] += 1;
    });
  });

  const gaps = allSkills.flatMap((skill) =>
    allAgeStages.flatMap((ageStage) =>
      allStages
        .filter(
          (recommendedPhase) =>
            !ACTIVITY_CATALOG_VARIANTS.some(
              (variant) =>
                variant.taxonomy.skill === skill &&
                variant.taxonomy.ageRange.includes(ageStage) &&
                variant.taxonomy.recommendedPhase === recommendedPhase
            )
        )
        .map((recommendedPhase) => ({ skill, ageStage, recommendedPhase }))
    )
  );

  return {
    totalFamilies: ACTIVITY_CATALOG_FAMILIES.length,
    totalVariants: ACTIVITY_CATALOG_VARIANTS.length,
    bySkill,
    byAgeStage,
    byPedagogicalIntent,
    byPeriodizationCompatibility,
    gaps,
  };
};
