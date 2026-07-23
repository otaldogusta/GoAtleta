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

export type ActivityCatalogMediaKey =
  | "continuity"
  | "defenseCoverage"
  | "attackTransition"
  | "sideout"
  | "serveReception"
  | "preventiveStrength"
  | "transition"
  | "blockCoverage"
  | "servePressure"
  | "secondContact"
  | "attackCoverage"
  | "outOfSystem"
  | "genericCourt";

export type ActivityCatalogVisualScene =
  | "continuity_three_contacts"
  | "defense_coverage"
  | "attack_transition_free_zone"
  | "sideout_construction"
  | "serve_reception_pressure"
  | "preventive_strength"
  | "transition_task"
  | "block_coverage_net"
  | "second_contact_organization"
  | "attack_coverage_decision"
  | "out_of_system_transition"
  | "generic_court";

export type ActivityCatalogVisualProfile = {
  mediaKey: ActivityCatalogMediaKey;
  scene: ActivityCatalogVisualScene;
};

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
  visualProfile?: ActivityCatalogVisualProfile;
  periodizationFit: ("exploration" | "technical" | "decision" | "pressure" | "game_transfer")[];
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
  visualProfile: ActivityCatalogVisualProfile;
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
  | "anti_repetition"
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
  gaps: {
    skill: VolleyballSkill;
    ageStage: ActivityPatternAgeStage;
    recommendedPhase: ActivityPatternStage;
  }[];
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
    visualProfile: { mediaKey: "continuity", scene: "continuity_three_contacts" },
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
    visualProfile: { mediaKey: "transition", scene: "transition_task" },
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
    visualProfile: { mediaKey: "serveReception", scene: "serve_reception_pressure" },
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
        visualProfile: { mediaKey: "sideout", scene: "sideout_construction" },
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
    visualProfile: { mediaKey: "defenseCoverage", scene: "defense_coverage" },
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
    visualProfile: { mediaKey: "attackTransition", scene: "attack_transition_free_zone" },
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
    id: "bloqueio_cobertura_rede",
    title: "Bloqueio e cobertura de rede",
    purpose: "Construir leitura de rede, bloqueio sombra e cobertura depois da acao de bloqueio.",
    source: "goatleta_original",
    visualProfile: { mediaKey: "blockCoverage", scene: "block_coverage_net" },
    variants: [
      {
        id: "catalog-bloqueio-sombra-rede",
        taxonomy: baseTaxonomy({
          skill: "bloqueio",
          gamePhase: "defesa_cobertura",
          pedagogicalIntent: "technical_adjustment",
          complexity: "baixa",
          ageRange: ["transition", "formation"],
          format: "trio",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "warmup",
          periodizationCompatibility: ["estabilizacao_tecnica", "aceleracao_decisao"],
          progressionCompatibility: ["consistencia", "tomada_decisao"],
          loadCompatibility: ["baixo", "moderado"],
          families: ["catalogo", "bloqueio", "rede", "sombra", "cobertura"],
        }),
        periodizationFit: ["technical", "decision"],
        name: "Bloqueio sombra com cobertura curta",
        players: "trios",
        setup: "Marcar uma linha de rede e duas zonas curtas de cobertura com cones.",
        starter: "Um aluno inicia simulando a bola alta na rede enquanto o trio chama a zona.",
        action: "Quem esta na rede faz bloqueio sombra sem disputa forte e os colegas entram na cobertura curta.",
        rotation: "A cada 4 bolas simuladas, troca quem bloqueia, quem cobre curto e quem observa a chamada.",
        constraint: "A acao vale quando o bloqueio termina equilibrado e a cobertura entra antes da segunda chamada.",
        scoring: "Conta ponto quando o trio combina chamada, sombra de bloqueio e cobertura pronta.",
        progression: "Adicionar uma bola leve depois da sombra para exigir continuidade.",
        commonMistakes: ["saltar sem equilibrio", "cobertura esperando a bola cair"],
        adaptations: ["Facilitar usando apenas deslocamento; dificultar variando a zona de cobertura."],
        avoid: ["cobrar tempo de bloqueio adulto", "saltos repetidos em excesso"],
        materials: ["bolas", "cones"],
        space: "meia quadra",
      },
      {
        id: "catalog-bloqueio-cobertura-triangulo",
        taxonomy: baseTaxonomy({
          skill: "bloqueio",
          gamePhase: "defesa_cobertura",
          pedagogicalIntent: "team_organization",
          complexity: "moderada",
          ageRange: ["formation", "specialization"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "drill",
          periodizationCompatibility: ["aceleracao_decisao", "transferencia_jogo"],
          progressionCompatibility: ["tomada_decisao", "oposicao"],
          loadCompatibility: ["moderado"],
          families: ["catalogo", "bloqueio", "cobertura", "rede", "organizacao"],
        }),
        periodizationFit: ["decision", "game_transfer"],
        name: "Triangulo de cobertura do bloqueio",
        players: "quartetos",
        setup: "Montar um lado com bloqueador sombra e tres colegas em triangulo de cobertura.",
        starter: "O treinador ou colega inicia com uma bola controlada para passar perto da rede.",
        action: "O bloqueador fecha a zona combinada e o triangulo cobre a sobra para manter a bola jogavel.",
        rotation: "Depois de 5 entradas, todos rodam uma posicao no triangulo.",
        constraint: "A equipe precisa falar quem fecha e quem cobre antes da bola cruzar a rede.",
        scoring: "Ponto extra quando a cobertura transforma a sobra em segundo contato jogavel.",
        progression: "Permitir finalizacao controlada do outro lado para aumentar oposicao.",
        commonMistakes: ["todos olham para o bloqueio", "ninguém assume a sobra curta"],
        adaptations: ["Facilitar com bola lancada; dificultar com ataque controlado."],
        avoid: ["bloqueio isolado da defesa", "fila de saltos"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
      {
        id: "catalog-bloqueio-jogo-condicionado",
        taxonomy: baseTaxonomy({
          skill: "bloqueio",
          gamePhase: "defesa_cobertura",
          pedagogicalIntent: "game_reading",
          complexity: "alta",
          ageRange: ["formation", "specialization"],
          format: "jogo_aplicado",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "alta",
          recommendedPhase: "game",
          periodizationCompatibility: ["transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["transferencia_jogo", "oposicao"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "bloqueio", "jogo_condicionado", "cobertura", "pressao"],
        }),
        periodizationFit: ["pressure", "game_transfer"],
        name: "Mini jogo com bloqueio condicionado",
        players: "equipes 4x4 ou 5x5",
        setup: "Usar quadra reduzida com uma zona de ataque controlado e cobertura obrigatoria.",
        starter: "A bola entra por recepcao ou defesa controlada para gerar ataque previsivel.",
        action: "A equipe decide se bloqueia sombra ou cobre mais fundo, sempre mantendo a bola em jogo depois da acao.",
        rotation: "A cada rally, roda a funcao de bloqueio para todos experimentarem leitura e cobertura.",
        constraint: "Nao vale atacar forte sem cobertura pronta no proprio lado.",
        scoring: "Ponto extra quando toque de bloqueio ou cobertura mantem o rally vivo.",
        progression: "Liberar mais direcoes de ataque quando a cobertura estiver organizada.",
        commonMistakes: ["bloqueio sem leitura", "cobertura some depois da finalizacao"],
        adaptations: ["Facilitar com ataque em pe; dificultar com duas opcoes de ataque."],
        avoid: ["especializacao precoce", "exigir sistema adulto completo"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "saque_recepcao_pressao_controlada",
    title: "Saque e recepcao sob pressao controlada",
    purpose: "Aumentar precisao de saque, recepcao orientada e construcao simples de sideout.",
    source: "goatleta_original",
    visualProfile: { mediaKey: "servePressure", scene: "serve_reception_pressure" },
    variants: [
      {
        id: "catalog-saque-alvo-progressivo",
        taxonomy: baseTaxonomy({
          skill: "saque",
          gamePhase: "saque_recepcao",
          pedagogicalIntent: "technical_adjustment",
          complexity: "baixa",
          ageRange: ["base", "transition", "formation"],
          format: "dupla",
          environment: "quadra",
          cognitiveDemand: "baixa",
          physicalDemand: "media",
          recommendedPhase: "drill",
          periodizationCompatibility: ["exploracao_fundamentos", "estabilizacao_tecnica"],
          progressionCompatibility: ["precisao", "consistencia"],
          loadCompatibility: ["baixo", "moderado"],
          families: ["catalogo", "saque", "alvo", "recepcao", "precisao"],
        }),
        periodizationFit: ["exploration", "technical"],
        name: "Saque por alvo com retorno jogavel",
        players: "duplas em meia quadra",
        setup: "Marcar duas zonas de saque com cones e deixar uma zona ampla de recepcao.",
        starter: "Um aluno saca por baixo ou por cima para a zona combinada.",
        action: "Quem recebe tenta devolver uma bola alta e jogavel para o parceiro organizar a proxima acao.",
        rotation: "A cada 5 saques, troca sacador, receptor e alvo.",
        constraint: "O ponto vale mais pela direcao e pela recepcao jogavel do que pela potencia.",
        scoring: "1 ponto no alvo, 1 ponto se a recepcao volta alta para continuidade.",
        progression: "Diminuir a zona de alvo ou alternar alvo curto e longo.",
        commonMistakes: ["sacar forte sem alvo", "recepcao baixa sem tempo para organizar"],
        adaptations: ["Facilitar aproximando o saque; dificultar pedindo alvo anunciado antes."],
        avoid: ["eliminar por erro", "fila longa de saque"],
        materials: ["bolas", "cones"],
        space: "meia quadra",
      },
      {
        id: "catalog-saque-pressao-sideout",
        taxonomy: baseTaxonomy({
          skill: "saque",
          gamePhase: "sideout",
          pedagogicalIntent: "pressure_adaptation",
          complexity: "alta",
          ageRange: ["formation", "specialization"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "media",
          recommendedPhase: "game",
          periodizationCompatibility: ["aceleracao_decisao", "transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["pressao_tempo", "transferencia_jogo"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "saque", "sideout", "pressao", "recepcao"],
        }),
        periodizationFit: ["decision", "pressure", "game_transfer"],
        name: "Sideout contra alvo de saque",
        players: "equipes 3x3 ou 4x4",
        setup: "Definir uma zona de saque obrigatoria e uma zona de recepcao com dois passadores.",
        starter: "A equipe sacadora inicia anunciando o alvo e executa saque controlado.",
        action: "A equipe que recebe precisa construir o sideout com tres contatos ou devolver uma bola segura.",
        rotation: "Depois de 3 tentativas, troca quem saca e quem recebe.",
        constraint: "Saque fora da proposta reinicia a bola sem ponto extra.",
        scoring: "Bônus para saque no alvo e para sideout construido sem bola direta.",
        progression: "Reduzir tempo de organizacao depois da recepcao.",
        commonMistakes: ["sacador ignora alvo", "recepcao sem comunicacao"],
        adaptations: ["Facilitar com saque por baixo; dificultar com alvo menor."],
        avoid: ["pressao punitiva", "especializar passadores cedo demais"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "levantamento_organizacao_segundo_contato",
    title: "Levantamento e organizacao do segundo contato",
    purpose: "Transformar o segundo contato em decisao simples para preparar a bola final.",
    source: "goatleta_original",
    visualProfile: { mediaKey: "secondContact", scene: "second_contact_organization" },
    variants: [
      {
        id: "catalog-levantamento-segundo-contato-jogavel",
        taxonomy: baseTaxonomy({
          skill: "levantamento",
          gamePhase: "rally",
          pedagogicalIntent: "technical_adjustment",
          complexity: "baixa",
          ageRange: ["base", "transition"],
          format: "trio",
          environment: "quadra",
          cognitiveDemand: "baixa",
          physicalDemand: "baixa",
          recommendedPhase: "drill",
          periodizationCompatibility: ["exploracao_fundamentos", "estabilizacao_tecnica"],
          progressionCompatibility: ["consistencia", "precisao"],
          loadCompatibility: ["baixo", "moderado"],
          families: ["catalogo", "levantamento", "segundo_contato", "organizacao"],
        }),
        periodizationFit: ["exploration", "technical"],
        name: "Segundo contato para bola jogavel",
        players: "trios",
        setup: "Marcar uma zona de primeiro contato e duas zonas simples para a bola final.",
        starter: "Um aluno inicia enviando bola facil para o primeiro contato do trio.",
        action: "O segundo aluno organiza uma bola alta e clara para o colega devolver jogavel.",
        rotation: "A cada 4 bolas, troca primeiro contato, segundo contato e finalizacao.",
        constraint: "A bola final deve sair depois de uma chamada do segundo contato.",
        scoring: "Conta ponto quando o segundo contato deixa o colega com tempo para jogar.",
        progression: "Variar a distancia entre primeiro e segundo contato.",
        commonMistakes: ["segundo contato baixo", "sem chamada antes de organizar"],
        adaptations: ["Facilitar segurando e soltando a bola; dificultar com deslocamento curto."],
        avoid: ["cobrar levantamento tecnico adulto", "bola rapida sem controle"],
        materials: ["bolas", "cones"],
        space: "meia quadra",
      },
      {
        id: "catalog-levantamento-escolha-zona-livre",
        taxonomy: baseTaxonomy({
          skill: "levantamento",
          gamePhase: "sideout",
          pedagogicalIntent: "decision_making",
          complexity: "moderada",
          ageRange: ["formation", "specialization"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "media",
          recommendedPhase: "game",
          periodizationCompatibility: ["aceleracao_decisao", "transferencia_jogo"],
          progressionCompatibility: ["tomada_decisao", "transferencia_jogo"],
          loadCompatibility: ["moderado"],
          families: ["catalogo", "levantamento", "segundo_contato", "escolha", "sideout"],
        }),
        periodizationFit: ["decision", "game_transfer"],
        name: "Escolha simples do segundo contato",
        players: "equipes 3x3 ou 4x4",
        setup: "Montar jogo reduzido com duas zonas de finalizacao visiveis.",
        starter: "A bola entra por recepcao controlada para gerar segundo contato.",
        action: "Quem organiza escolhe a zona livre e comunica antes da bola final.",
        rotation: "A cada rally, muda quem assume o segundo contato.",
        constraint: "A finalizacao so vale quando a escolha foi comunicada e coerente com o espaco.",
        scoring: "Ponto extra quando a bola final explora uma zona livre indicada pelo organizador.",
        progression: "Adicionar oposicao leve em uma das zonas.",
        commonMistakes: ["levantar sempre para o mesmo lado", "decidir depois de tocar na bola"],
        adaptations: ["Facilitar com zonas maiores; dificultar com uma zona bloqueada."],
        avoid: ["sistema fixo precoce", "exigir precisao adulta"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "ataque_cobertura_decisao",
    title: "Ataque com decisao e cobertura",
    purpose: "Ensinar finalizacao para espaco livre sem separar ataque da cobertura do grupo.",
    source: "goatleta_original",
    visualProfile: { mediaKey: "attackCoverage", scene: "attack_coverage_decision" },
    variants: [
      {
        id: "catalog-ataque-devolucao-espaco-livre",
        taxonomy: baseTaxonomy({
          skill: "ataque",
          gamePhase: "ataque",
          pedagogicalIntent: "decision_making",
          complexity: "moderada",
          ageRange: ["base", "transition"],
          format: "trio",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "drill",
          periodizationCompatibility: ["estabilizacao_tecnica", "aceleracao_decisao"],
          progressionCompatibility: ["precisao", "tomada_decisao"],
          loadCompatibility: ["baixo", "moderado"],
          families: ["catalogo", "ataque", "espaco_livre", "cobertura", "decisao"],
        }),
        periodizationFit: ["technical", "decision"],
        name: "Ataque leve para espaco livre",
        players: "trios",
        setup: "Marcar duas zonas livres e uma zona de cobertura atras de quem finaliza.",
        starter: "Um aluno inicia preparando bola alta para finalizacao controlada.",
        action: "Quem finaliza escolhe zona livre com gesto controlado, enquanto o terceiro cobre a sobra.",
        rotation: "A cada 5 bolas, troca quem prepara, quem finaliza e quem cobre.",
        constraint: "A jogada vale quando existe escolha de espaco e cobertura pronta.",
        scoring: "Ponto se a bola cai na zona livre ou se a cobertura mantem continuidade.",
        progression: "Diminuir a zona livre ou adicionar defensor parado.",
        commonMistakes: ["forca antes de leitura", "cobertura atrasada"],
        adaptations: ["Facilitar com bola lancada; dificultar pedindo chamada da zona antes."],
        avoid: ["potencia como criterio principal", "fila"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
      {
        id: "catalog-ataque-cobertura-oposicao",
        taxonomy: baseTaxonomy({
          skill: "ataque",
          gamePhase: "ataque",
          pedagogicalIntent: "game_reading",
          complexity: "alta",
          ageRange: ["formation", "specialization"],
          format: "jogo_aplicado",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "alta",
          recommendedPhase: "game",
          periodizationCompatibility: ["transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["transferencia_jogo", "oposicao"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "ataque", "cobertura", "oposicao", "jogo"],
        }),
        periodizationFit: ["pressure", "game_transfer"],
        name: "Finalizacao com cobertura contra oposicao",
        players: "equipes 4x4 ou 5x5",
        setup: "Montar jogo reduzido com ataque controlado, uma oposicao de rede e cobertura obrigatoria.",
        starter: "A bola entra por defesa ou recepcao para gerar construcao de ataque.",
        action: "A equipe finaliza lendo o espaco e organiza cobertura antes da bola cruzar.",
        rotation: "Depois de cada rally, roda quem ataca e quem cobre a zona curta.",
        constraint: "Nao conta ponto extra quando o ataque sai sem cobertura.",
        scoring: "Bônus quando ataque, oposicao e cobertura aparecem no mesmo rally.",
        progression: "Liberar mais velocidade de bola quando a cobertura estiver consistente.",
        commonMistakes: ["atacar no bloqueio sem ajuste", "cobertura parada"],
        adaptations: ["Facilitar com bloqueio sombra; dificultar com defensor lendo a diagonal."],
        avoid: ["ataque isolado", "pressao de erro individual"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
    ],
  },
  {
    id: "defesa_transicao_fora_sistema",
    title: "Defesa e transicao fora do sistema",
    purpose: "Converter bolas quebradas em continuidade, segunda acao organizada e transicao segura.",
    source: "goatleta_original",
    visualProfile: { mediaKey: "outOfSystem", scene: "out_of_system_transition" },
    variants: [
      {
        id: "catalog-defesa-salva-jogavel",
        taxonomy: baseTaxonomy({
          skill: "defesa",
          gamePhase: "defesa_cobertura",
          pedagogicalIntent: "technical_adjustment",
          complexity: "baixa",
          ageRange: ["base", "transition"],
          format: "cooperacao",
          environment: "quadra",
          cognitiveDemand: "baixa",
          physicalDemand: "media",
          recommendedPhase: "warmup",
          periodizationCompatibility: ["exploracao_fundamentos", "estabilizacao_tecnica"],
          progressionCompatibility: ["consistencia", "precisao"],
          loadCompatibility: ["baixo", "moderado"],
          families: ["catalogo", "defesa", "bola_jogavel", "continuidade"],
        }),
        periodizationFit: ["exploration", "technical"],
        name: "Salvar para voltar jogavel",
        players: "duplas ou trios",
        setup: "Marcar uma zona de defesa e uma zona segura de devolucao.",
        starter: "Um colega inicia com bola baixa ou lateral de dificuldade controlada.",
        action: "Quem defende precisa salvar para cima, permitindo que o grupo faca a segunda acao.",
        rotation: "A cada 4 bolas, troca defensor, organizador e observador.",
        constraint: "A defesa nao precisa ser perfeita; precisa deixar a bola jogavel.",
        scoring: "Ponto quando o grupo transforma a defesa em segunda acao clara.",
        progression: "Alternar bola curta e bola lateral.",
        commonMistakes: ["defesa direta para fora", "parar depois do toque"],
        adaptations: ["Facilitar com bola lancada; dificultar reduzindo o tempo de chamada."],
        avoid: ["mergulho obrigatorio", "risco desnecessario"],
        materials: ["bolas", "cones"],
        space: "meia quadra",
      },
      {
        id: "catalog-defesa-pressao-cobertura",
        taxonomy: baseTaxonomy({
          skill: "defesa",
          gamePhase: "defesa_cobertura",
          pedagogicalIntent: "pressure_adaptation",
          complexity: "alta",
          ageRange: ["formation", "specialization"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "alta",
          physicalDemand: "alta",
          recommendedPhase: "game",
          periodizationCompatibility: ["transferencia_jogo", "pressao_competitiva"],
          progressionCompatibility: ["pressao_tempo", "oposicao"],
          loadCompatibility: ["moderado", "alto"],
          families: ["catalogo", "defesa", "cobertura", "pressao", "fora_sistema"],
        }),
        periodizationFit: ["pressure", "game_transfer"],
        name: "Defesa sob pressao com cobertura viva",
        players: "equipes 4x4",
        setup: "Montar jogo reduzido com uma bola de ataque controlado e cobertura obrigatoria.",
        starter: "A bola entra para gerar defesa de dificuldade moderada.",
        action: "A equipe defende, reorganiza a segunda acao e cobre a bola final para manter o rally.",
        rotation: "A cada rally, muda quem inicia a bola e a equipe roda uma posicao.",
        constraint: "A equipe precisa tentar segunda acao organizada antes de devolver de qualquer jeito.",
        scoring: "Bônus quando defesa, organizacao e cobertura acontecem na mesma jogada.",
        progression: "Diminuir o tempo entre defesa e bola final.",
        commonMistakes: ["devolver de primeira sem necessidade", "cobertura atrasada"],
        adaptations: ["Facilitar com ataque leve; dificultar com duas direcoes de ataque."],
        avoid: ["pressao punitiva", "bola de risco sem controle"],
        materials: ["bolas", "cones"],
        space: "quadra reduzida",
      },
      {
        id: "catalog-transicao-bola-quebrada",
        taxonomy: baseTaxonomy({
          skill: "transicao",
          gamePhase: "transicao",
          pedagogicalIntent: "team_organization",
          complexity: "moderada",
          ageRange: ["transition", "formation", "specialization"],
          format: "jogo_reduzido",
          environment: "quadra",
          cognitiveDemand: "media",
          physicalDemand: "media",
          recommendedPhase: "game",
          periodizationCompatibility: ["aceleracao_decisao", "transferencia_jogo"],
          progressionCompatibility: ["tomada_decisao", "transferencia_jogo"],
          loadCompatibility: ["moderado"],
          families: ["catalogo", "transicao", "fora_sistema", "reorganizacao"],
        }),
        periodizationFit: ["decision", "game_transfer"],
        name: "Bola quebrada para contra-ataque seguro",
        players: "equipes 3x3 ou 4x4",
        setup: "Criar uma entrada de bola quebrada e duas opcoes de devolucao segura.",
        starter: "Um aluno inicia com bola fora do eixo para simular defesa ou recepcao ruim.",
        action: "A equipe reorganiza rapidamente o segundo contato e decide entre devolver seguro ou finalizar leve.",
        rotation: "A cada 5 entradas, troca quem inicia e quem assume a segunda acao.",
        constraint: "A prioridade e recuperar estrutura antes de buscar ponto direto.",
        scoring: "Ponto extra quando a equipe sai de bola quebrada para jogada com tres contatos.",
        progression: "Adicionar oposicao leve depois da reorganizacao.",
        commonMistakes: ["tentar ponto direto sem equilibrio", "segundo contato sem dono"],
        adaptations: ["Facilitar com zona maior; dificultar com entrada mais curta."],
        avoid: ["sistema adulto rigido", "erro como eliminacao"],
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
    visualProfile: { mediaKey: "preventiveStrength", scene: "preventive_strength" },
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
