import type { VolleyballSkill } from "../models";
import {
  ACTIVITY_CATALOG_VARIANTS,
  type ActivityCatalogTaxonomy,
  type ActivityCatalogVariant,
} from "./activity-catalog";
import type { ActivityPatternAgeStage, ActivityPatternStage } from "./activity-pattern-engine";

export type ActivityFocusVariant = "manchete";

type AgeTextOverrides = Partial<
  Record<
    ActivityPatternAgeStage,
    Partial<
      Pick<
        ActivityKnowledgePattern,
        | "name"
        | "players"
        | "setup"
        | "starter"
        | "action"
        | "rotation"
        | "constraint"
        | "scoring"
        | "progression"
        | "space"
      >
    >
  >
>;

export type ActivityKnowledgePattern = {
  id: string;
  skill: VolleyballSkill;
  variant?: ActivityFocusVariant;
  stage: ActivityPatternStage;
  ageStages: ActivityPatternAgeStage[];
  families: string[];
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
  ageText?: AgeTextOverrides;
  catalogTaxonomy?: ActivityCatalogTaxonomy;
};

const allAgeStages: ActivityPatternAgeStage[] = [
  "early",
  "base",
  "transition",
  "formation",
  "specialization",
];

const youngerStages: ActivityPatternAgeStage[] = ["early", "base"];
const olderStages: ActivityPatternAgeStage[] = ["formation", "specialization"];

const feedbackCooldown = (
  id: string,
  skill: VolleyballSkill,
  variant?: ActivityFocusVariant
): ActivityKnowledgePattern => ({
  id,
  skill,
  variant,
  stage: "cooldown",
  ageStages: allAgeStages,
  families: ["feedback", "volta_calma"],
  periodizationFit: ["exploration", "technical", "decision", "pressure", "game_transfer"],
  name: "Conversa e feedbacks finais",
  players: "turma inteira",
  setup: "Reunir a turma em roda na lateral da quadra, com as bolas e cones já próximos para guardar.",
  starter: "O professor abre com uma pergunta curta sobre a atividade.",
  action:
    "Cada grupo comenta uma decisão que ajudou a bola continuar em jogo e uma coisa para tentar na próxima aula.",
  rotation: "A fala passa rapidamente de grupo em grupo antes de todos guardarem os materiais.",
  constraint: "Uma resposta curta por grupo.",
  progression: "Usar a resposta da turma para conectar com a próxima aula.",
  commonMistakes: ["fala longa", "aviso inventado"],
  adaptations: ["Se a turma estiver agitada, pedir uma palavra por grupo."],
  avoid: ["evento sem cronograma real", "explicação longa"],
  materials: ["bolas", "cones"],
  space: "lateral da quadra",
});

export const VOLLEYBALL_ACTIVITY_KNOWLEDGE_PATTERNS: ActivityKnowledgePattern[] = [
  {
    id: "knowledge-passe-warmup-3-contatos",
    skill: "passe",
    stage: "warmup",
    ageStages: allAgeStages,
    families: ["ludico", "alta_participacao", "primeiro_contato"],
    periodizationFit: ["exploration", "technical", "decision"],
    name: "Pega-pega dos 3 contatos",
    players: "duplas ou trios",
    setup: "Delimitar meia quadra com cones e deixar uma bola para cada trio.",
    starter: "Dois alunos começam como pegadores e um trio inicia com a bola.",
    action:
      "Quem for pego pega uma bola e tenta organizar 3 contatos livres com o grupo antes de voltar para a brincadeira.",
    rotation: "Depois de cada rodada, muda quem inicia a bola e quem entra como pegador.",
    constraint: "Erro não elimina ninguém; o grupo recolhe a bola e reinicia rápido.",
    progression: "Pedir que o primeiro contato volte jogável para um colega.",
    commonMistakes: ["espera longa", "bola parada depois do erro"],
    adaptations: ["Facilitar permitindo segurar uma bola; dificultar pedindo chamada antes do contato."],
    avoid: ["fila", "gesto fechado no aquecimento"],
    materials: ["bolas", "cones"],
    space: "meia quadra",
    ageText: {
      base: { name: "Caça aos 3 contatos" },
      transition: { name: "Chamada em trio" },
      formation: { name: "Recepção com cobertura" },
      specialization: { name: "Entrada de recepção sob pressão" },
    },
  },
  {
    id: "knowledge-passe-warmup-zonas",
    skill: "passe",
    stage: "warmup",
    ageStages: allAgeStages,
    families: ["aquecimento", "zonas", "comunicacao"],
    periodizationFit: ["exploration", "decision"],
    name: "Chama e devolve",
    players: "duplas ou trios",
    setup: "Espalhar zonas largas marcadas por cones em meia quadra.",
    starter: "Um aluno chama a zona e inicia a bola por baixo para o grupo.",
    action: "O grupo se desloca, chama a bola e devolve um primeiro contato jogável para a zona chamada.",
    rotation: "Depois de cada sequência, troca quem chama a zona e quem inicia.",
    constraint: "A bola pode cair; o grupo só recolhe e reinicia sem sair da atividade.",
    progression: "Na segunda rodada, a zona chamada muda a cada bola.",
    commonMistakes: ["ninguém chama a bola", "todos correm para a mesma bola"],
    adaptations: ["Facilitar usando duas zonas; dificultar usando três zonas."],
    avoid: ["acerto obrigatório", "fila"],
    materials: ["bolas", "cones"],
    space: "meia quadra",
  },
  {
    id: "knowledge-passe-drill-duplas-jogavel",
    skill: "passe",
    stage: "drill",
    ageStages: youngerStages,
    families: ["tecnico_operacional", "troca_funcao", "alvo_zona"],
    periodizationFit: ["technical", "decision"],
    name: "Passe em duplas para voltar jogável",
    players: "duplas",
    setup: "Cada dupla ocupa um espaço livre da quadra, com uma bola e um cone como referência de alvo.",
    starter: "Um aluno lança a bola por baixo para o colega.",
    action: "Quem recebe chama a bola e devolve tentando deixar o passe jogável para quem lançou.",
    rotation: "A cada 5 bolas, os alunos trocam de função.",
    constraint: "A tentativa vale mesmo longe do cone; a próxima bola entra sem pausa.",
    scoring: "Conta ponto quando a dupla mantém 3 devoluções jogáveis.",
    progression: "Afastar a dupla ou mudar a direção do lançamento.",
    commonMistakes: ["não chamar a bola", "parar depois do erro"],
    adaptations: ["Facilitar aproximando a dupla; dificultar variando a distância."],
    avoid: ["fila", "acerto obrigatório"],
    materials: ["bolas", "cones"],
    space: "meia quadra",
    ageText: {
      base: { name: "Passe em duplas para zona-alvo" },
    },
  },
  {
    id: "knowledge-passe-drill-trio-chamada",
    skill: "passe",
    stage: "drill",
    ageStages: ["transition", "formation"],
    families: ["tecnico_operacional", "troca_funcao", "comunicacao"],
    periodizationFit: ["technical", "decision"],
    name: "Passe em trio com chamada",
    players: "trios",
    setup: "Organizar trios em meia quadra, com uma zona-alvo grande marcada por cones.",
    starter: "Um aluno lança a bola por baixo para iniciar a sequência.",
    action: "Quem recebe chama a bola e tenta enviar o primeiro contato jogável para o colega na zona.",
    rotation: "Depois de 5 bolas, o trio roda quem lança, quem recebe e quem ocupa a zona.",
    constraint: "A bola seguinte entra mesmo quando o passe não chega ao alvo.",
    scoring: "Vale ponto quando o primeiro contato volta jogável para a zona combinada.",
    progression: "Variar a direção do lançamento na segunda rodada.",
    commonMistakes: ["aluno parado na zona", "lançamento sempre igual"],
    adaptations: ["Facilitar aumentando a zona; dificultar alternando curta e longa."],
    avoid: ["fila", "professor lançando para todos"],
    materials: ["bolas", "cones"],
    space: "meia quadra",
    ageText: {
      formation: { name: "Passe sob lançamento variado" },
    },
  },
  {
    id: "knowledge-passe-drill-cobertura",
    skill: "passe",
    stage: "drill",
    ageStages: ["specialization"],
    families: ["cobertura", "recepcao", "jogo_aplicado"],
    periodizationFit: ["decision", "pressure", "game_transfer"],
    name: "Recepção com cobertura curta",
    players: "trios ou equipes pequenas",
    setup: "Montar quadra reduzida com uma zona de recepção e uma zona de cobertura marcadas por cones.",
    starter: "Um aluno do grupo inicia com saque adaptado ou lançamento combinado.",
    action: "A equipe recebe, cobre a sobra e tenta devolver uma bola jogável.",
    rotation: "A cada rally, troca quem inicia e todos rodam uma função curta.",
    constraint: "O erro encerra só o rally; a próxima bola entra rápido.",
    scoring: "Vale ponto extra quando recepção e cobertura mantêm a bola em jogo.",
    progression: "Reduzir a zona ou aumentar a velocidade da bola de entrada.",
    commonMistakes: ["cobertura atrasada", "ninguém assume a primeira bola"],
    adaptations: ["Facilitar com lançamento; dificultar com saque adaptado."],
    avoid: ["6x6 adulto", "fila"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
  },
  {
    id: "knowledge-passe-game-continuidade",
    skill: "passe",
    stage: "game",
    ageStages: allAgeStages,
    families: ["jogo_aplicado", "continuidade", "primeiro_contato"],
    periodizationFit: ["decision", "game_transfer"],
    name: "Desafio dos 3 passes",
    players: "duplas, trios ou equipes pequenas",
    setup: "Montar miniquadras e marcar uma zona simples para o primeiro contato.",
    starter: "A bola entra por lançamento combinado ou saque adaptado entre as equipes.",
    action: "A equipe tenta fazer o primeiro contato voltar jogável para continuar o rally.",
    rotation: "Depois de cada rally, troca quem inicia a bola e todos rodam uma função.",
    constraint: "O erro encerra só o rally; a próxima bola entra rápido.",
    scoring: "Vale ponto extra quando o primeiro contato chega jogável na zona marcada.",
    progression: "Pedir 3 contatos antes de devolver quando a turma já sustenta a bola.",
    commonMistakes: ["parar depois do erro", "ponto só por acerto no alvo"],
    adaptations: ["Facilitar ampliando a zona; dificultar usando saque adaptado."],
    avoid: ["acerto obrigatório", "fila"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
    ageText: {
      base: { name: "Mini 2x2 dos 3 contatos" },
      transition: { name: "Mini 3x3 com primeiro contato pontuado" },
      formation: { name: "Mini 4x4 com zona de recepção" },
      specialization: { name: "Jogo aplicado com bônus de recepção" },
    },
  },
  {
    id: "knowledge-passe-game-zona-bonus",
    skill: "passe",
    stage: "game",
    ageStages: allAgeStages,
    families: ["jogo_aplicado", "zona_bonus", "decisao"],
    periodizationFit: ["decision", "pressure", "game_transfer"],
    name: "Jogo da zona jogável",
    players: "equipes pequenas",
    setup: "Montar quadra reduzida com zona bônus marcada por cones.",
    starter: "A bola entra por saque adaptado ou lançamento combinado.",
    action: "A equipe joga o rally e tenta manter o primeiro contato jogável para atacar ou devolver.",
    rotation: "Depois de cada rally, troca quem inicia e os alunos rodam uma função curta.",
    constraint: "A equipe continua jogando mesmo quando o primeiro contato não pontua.",
    scoring: "Vale ponto extra quando o primeiro contato permite continuidade do rally.",
    progression: "Na segunda rodada, a equipe escolhe a zona antes do saque.",
    commonMistakes: ["rally travado", "zona pequena demais"],
    adaptations: ["Facilitar com zona maior; dificultar mudando a zona por rodada."],
    avoid: ["professor como alimentador", "acerto obrigatório"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
  },
  feedbackCooldown("knowledge-passe-cooldown", "passe"),

  {
    id: "knowledge-manchete-warmup-chama",
    skill: "passe",
    variant: "manchete",
    stage: "warmup",
    ageStages: allAgeStages,
    families: ["ludico", "manchete", "comunicacao"],
    periodizationFit: ["exploration", "technical", "decision"],
    name: "Corre e chama",
    players: "trios",
    setup: "Espalhar cones em meia quadra e deixar uma bola por trio.",
    starter: "Um aluno lança a bola por baixo para dentro do espaço do trio.",
    action: "Quem estiver mais perto chama a bola e faz o primeiro contato para um colega.",
    rotation: "Depois de cada bola, muda quem lança e quem ocupa a zona de apoio.",
    constraint: "A bola pode cair; o trio recolhe e reinicia sem eliminar ninguém.",
    progression: "Pedir que a manchete vá para perto do colega de apoio.",
    commonMistakes: ["ninguém chama", "plataforma forçada em toda bola"],
    adaptations: ["Facilitar com lançamento mais alto; dificultar variando a direção."],
    avoid: ["base perfeita no aquecimento", "fila"],
    materials: ["bolas", "cones"],
    space: "meia quadra",
  },
  {
    id: "knowledge-manchete-warmup-zonas",
    skill: "passe",
    variant: "manchete",
    stage: "warmup",
    ageStages: allAgeStages,
    families: ["recepcao", "zonas", "alta_participacao"],
    periodizationFit: ["exploration", "decision"],
    name: "Recebe e troca de zona",
    players: "duplas ou trios",
    setup: "Marcar duas ou três zonas largas com cones em meia quadra.",
    starter: "Um aluno inicia lançando a bola por baixo para uma zona.",
    action: "Quem recebe chama a bola e tenta devolver uma manchete jogável para o grupo.",
    rotation: "Depois de cada sequência, o grupo troca de zona e muda quem inicia.",
    constraint: "A próxima bola entra mesmo quando a direção não sai limpa.",
    progression: "Pedir comunicação antes do primeiro contato.",
    commonMistakes: ["ficar parado esperando", "ninguém assume a bola"],
    adaptations: ["Facilitar reduzindo zonas; dificultar alternando zona curta e longa."],
    avoid: ["correto/perfeito", "fila"],
    materials: ["bolas", "cones"],
    space: "meia quadra",
  },
  {
    id: "knowledge-manchete-drill-alvo",
    skill: "passe",
    variant: "manchete",
    stage: "drill",
    ageStages: youngerStages,
    families: ["tecnico_operacional", "alvo_jogavel", "recepcao"],
    periodizationFit: ["technical", "decision"],
    name: "Manchete no alvo",
    players: "duplas ou trios",
    setup: "Marcar um alvo grande com cone ou bambolê e deixar uma bola por dupla.",
    starter: "Um aluno lança a bola por baixo para o colega.",
    action:
      "Quem recebe comunica 'eu' antes do contato e tenta enviar uma manchete jogável para perto do alvo.",
    rotation: "A cada 5 ou 6 tentativas, trocam quem lança, quem recebe e quem fica no alvo.",
    constraint: "A próxima bola entra mesmo quando o alvo não é atingido.",
    scoring: "Conta ponto quando a bola chega jogável perto do alvo.",
    progression: "Aumentar a distância ou variar a direção do lançamento.",
    commonMistakes: ["alvo vira obrigação", "sem comunicação"],
    adaptations: ["Facilitar aproximando o alvo; dificultar mudando a direção."],
    avoid: ["acerto obrigatório", "fila longa"],
    materials: ["bolas", "cones", "bambolês"],
    space: "meia quadra",
  },
  {
    id: "knowledge-manchete-drill-recepcao",
    skill: "passe",
    variant: "manchete",
    stage: "drill",
    ageStages: ["transition", "formation"],
    families: ["recepcao", "troca_funcao", "direcao_bola"],
    periodizationFit: ["technical", "decision", "pressure"],
    name: "Recepção de manchete com apoio",
    players: "trios",
    setup: "Organizar trios com uma zona de recepção e uma zona de apoio marcadas por cones.",
    starter: "Um aluno inicia com lançamento por baixo ou saque adaptado.",
    action: "Quem recebe de manchete direciona uma bola jogável para o colega na zona de apoio.",
    rotation: "A cada 5 bolas, o trio troca saque/lançamento, recepção e apoio.",
    constraint: "A bola seguinte entra mesmo quando a recepção sai fora da zona.",
    scoring: "Vale ponto quando a manchete permite continuidade para o apoio.",
    progression: "Variar profundidade ou lateralidade da bola de entrada.",
    commonMistakes: ["apoio parado", "recepção sem chamada"],
    adaptations: ["Facilitar com lançamento; dificultar com saque adaptado."],
    avoid: ["professor alimentando todos", "fila"],
    materials: ["bolas", "cones"],
    space: "meia quadra",
  },
  {
    id: "knowledge-manchete-drill-cobertura",
    skill: "passe",
    variant: "manchete",
    stage: "drill",
    ageStages: olderStages,
    families: ["recepcao", "cobertura", "oposicao_controlada"],
    periodizationFit: ["decision", "pressure", "game_transfer"],
    name: "Manchete com cobertura da recepção",
    players: "equipes pequenas",
    setup: "Montar mini 4x4 com zona de recepção e cobertura curta marcadas por cones.",
    starter: "A bola entra por saque adaptado de uma equipe.",
    action: "A equipe recebe de manchete, cobre a sobra e tenta devolver uma bola jogável.",
    rotation: "Depois de cada rally, troca quem saca e todos rodam uma função curta.",
    constraint: "O erro encerra só o rally; a próxima bola entra rápido.",
    scoring: "Vale ponto extra quando a recepção e a cobertura mantêm o rally vivo.",
    progression: "Reduzir a zona de recepção ou aumentar a pressão do saque.",
    commonMistakes: ["cobertura atrasada", "recepção sem direção"],
    adaptations: ["Facilitar ampliando zona; dificultar usando zona menor."],
    avoid: ["6x6 adulto", "fila"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
  },
  {
    id: "knowledge-manchete-game-primeiro-contato",
    skill: "passe",
    variant: "manchete",
    stage: "game",
    ageStages: allAgeStages,
    families: ["jogo_aplicado", "primeiro_contato", "recepcao"],
    periodizationFit: ["decision", "game_transfer"],
    name: "Miniquadra com primeiro contato combinado",
    players: "duplas, trios ou equipes pequenas",
    setup: "Montar miniquadras com uma zona combinada para o primeiro contato.",
    starter: "A bola entra por lançamento combinado de uma das equipes.",
    action: "A equipe tenta fazer a primeira manchete chegar jogável na zona combinada.",
    rotation: "Depois de cada rally, as equipes trocam quem inicia a bola.",
    constraint: "O erro encerra só o rally; a próxima bola entra rápido.",
    scoring: "Vale ponto extra quando o primeiro contato chega jogável na zona combinada.",
    progression: "Permitir saque adaptado quando a turma sustenta o lançamento.",
    commonMistakes: ["todos esperam a bola", "sem chamada"],
    adaptations: ["Facilitar com zona maior; dificultar com bola de entrada mais variada."],
    avoid: ["acerto obrigatório", "fila"],
    materials: ["bolas", "cones"],
    space: "miniquadra",
    ageText: {
      formation: { name: "Mini 4x4 com cobertura da recepção" },
      specialization: { name: "Jogo aplicado com recepção e cobertura" },
    },
  },
  {
    id: "knowledge-manchete-game-zona",
    skill: "passe",
    variant: "manchete",
    stage: "game",
    ageStages: allAgeStages,
    families: ["jogo_aplicado", "zona_bonus", "comunicacao"],
    periodizationFit: ["decision", "pressure", "game_transfer"],
    name: "Jogo da recepção chamada",
    players: "equipes pequenas",
    setup: "Montar quadra reduzida com zona bônus para a recepção.",
    starter: "A bola entra por lançamento ou saque adaptado.",
    action: "A equipe precisa chamar a primeira bola e direcionar uma manchete jogável para continuar.",
    rotation: "Depois de cada rally, troca quem inicia a bola e todos rodam uma função curta.",
    constraint: "A equipe continua jogando mesmo quando não marca o bônus.",
    scoring: "Vale ponto extra quando a chamada aparece antes da recepção jogável.",
    progression: "Mudar a zona bônus no meio da atividade.",
    commonMistakes: ["chamada tardia", "rally parado"],
    adaptations: ["Facilitar com lançamento alto; dificultar com saque adaptado."],
    avoid: ["professor como gargalo", "acerto para continuar"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
  },
  feedbackCooldown("knowledge-manchete-cooldown", "passe", "manchete"),
];

type FocusConfig = {
  skill: VolleyballSkill;
  warmup: [string, string];
  drill: [string, string, string];
  game: [string, string];
  action: string;
  drillAction: string;
  gameAction: string;
  scoring: string;
  spaceCue: string;
};

const focusConfigs: FocusConfig[] = [
  {
    skill: "saque",
    warmup: ["Pega-zona do saque", "Zona chamada do saque"],
    drill: ["Saque por baixo para zonas", "Saque para zonas alternadas", "Saque com rotina curta"],
    game: ["Mini jogo com saque em jogo", "Mini 4x4 com saque direcionado"],
    action: "reconhece a zona chamada e prepara a direção do saque",
    drillAction: "saca para uma zona combinada enquanto os colegas recolhem e observam a direção",
    gameAction: "inicia o rally com saque adaptado e segue jogando",
    scoring: "Vale ponto extra quando o saque entra na zona combinada ou dificulta a recepção.",
    spaceCue: "fundo da quadra",
  },
  {
    skill: "levantamento",
    warmup: ["Bola ao alto em circulação", "Segundo contato em roda"],
    drill: ["Introdução do toque com cone", "Recebe e levanta", "Segundo contato para zona combinada"],
    game: ["Mini jogo com segundo contato definido", "Jogo aplicado com segundo contato definido"],
    action: "mantém a bola alta e chama o colega que recebe",
    drillAction: "organiza o segundo contato para uma zona combinada",
    gameAction: "usa o segundo contato para deixar a bola jogável ao colega",
    scoring: "Vale ponto extra quando o segundo contato chega jogável na zona combinada.",
    spaceCue: "meia quadra",
  },
  {
    skill: "ataque",
    warmup: ["Trio da bola final", "Leitura da finalização"],
    drill: ["Ataque para alvo aberto", "Finalização para zona livre", "Entrada e cobertura"],
    game: ["Mini jogo com finalização combinada", "Jogo aplicado com zona livre"],
    action: "envia a bola para uma zona livre sem exigir gesto fechado",
    drillAction: "recebe uma bola preparada pelo colega e finaliza para uma zona aberta",
    gameAction: "escolhe entre mandar a bola para zona livre ou manter o rally",
    scoring: "Vale ponto extra quando a finalização escolhe uma zona livre.",
    spaceCue: "quadra reduzida",
  },
  {
    skill: "defesa",
    warmup: ["Trio da bola salva", "Defende e chama"],
    drill: ["Defesa e devolução jogável", "Guarda-zona com devolução", "Cobertura em miniquadra"],
    game: ["Mini jogo com defesa pontuada", "Jogo da bola salva"],
    action: "protege uma zona e chama a bola quando ela entra no espaço",
    drillAction: "recebe uma bola variada do colega e devolve jogável para o grupo continuar",
    gameAction: "defende a primeira bola e tenta devolver jogável para a equipe",
    scoring: "Vale ponto extra quando a defesa volta jogável e o rally continua.",
    spaceCue: "quadra reduzida",
  },
  {
    skill: "bloqueio",
    warmup: ["Bloqueio com ajuda", "Sombra e cobertura"],
    drill: ["Bloqueio com sombra e cobertura", "Fecha a janela com apoio", "Leitura do bloqueio"],
    game: ["Mini jogo com bloqueio e cobertura", "Jogo da cobertura da rede"],
    action: "acompanha o colega e ocupa a janela marcada perto da rede",
    drillAction: "fecha a janela perto da rede enquanto um colega simula a bola e outro cobre atrás",
    gameAction: "protege a zona da rede e cobre a sobra para continuar o rally",
    scoring: "Vale ponto extra quando bloqueio ou cobertura mantém a bola em jogo.",
    spaceCue: "zona próxima à rede",
  },
  {
    skill: "transicao",
    warmup: ["Defende e contra-ataca", "Recupera e apoia"],
    drill: ["Recupera e contra-ataca", "Troca de função depois da defesa", "Transição com leitura"],
    game: ["Mini jogo de vira-jogo", "Jogo aplicado de transição"],
    action: "troca de função depois da bola e ocupa uma nova zona",
    drillAction: "defende, reorganiza o trio e envia a bola para uma zona livre",
    gameAction: "passa da defesa ao ataque com uma regra simples de apoio",
    scoring: "Vale ponto extra quando a equipe reorganiza e continua após defender.",
    spaceCue: "quadra reduzida",
  },
];

const generatedFocusPatterns = focusConfigs.flatMap((config): ActivityKnowledgePattern[] => [
  {
    id: `knowledge-${config.skill}-warmup-1`,
    skill: config.skill,
    stage: "warmup",
    ageStages: allAgeStages,
    families: ["ludico", "alta_participacao", config.skill],
    periodizationFit: ["exploration", "technical", "decision"],
    name: config.warmup[0],
    players: "duplas ou trios",
    setup: `Espalhar grupos em ${config.spaceCue}, com cones marcando zonas largas.`,
    starter: "Ao sinal combinado, um aluno inicia a bola para o grupo.",
    action: `O grupo ${config.action}.`,
    rotation: "Depois de cada rodada, muda quem inicia a bola.",
    constraint: "A rodada continua mesmo com erro; o grupo reorganiza e reinicia sem espera.",
    progression: "Na segunda rodada, mudar a zona ou a direção da bola.",
    commonMistakes: ["espera longa", "erro parando a atividade"],
    adaptations: ["Facilitar reduzindo distância; dificultar aumentando a oposição ou a zona de decisão."],
    avoid: ["fila", "gesto fechado no aquecimento"],
    materials: ["bolas", "cones"],
    space: config.spaceCue,
    ageText: {
      early: {
        name: config.skill === "saque" ? "Boliche do saque por baixo" : undefined,
        players: "duplas ou trios",
        setup: `Espalhar duplas ou trios em espaços pequenos da quadra, com cones marcando zonas largas.`,
      },
      base: { players: "duplas ou trios" },
      transition: {
        name: config.skill === "saque" ? "Pega-zona do saque" : undefined,
      },
      formation: {
        name: config.skill === "saque" ? "Saque e organiza recepção" : undefined,
        players: "equipes pequenas",
        setup: `Organizar mini 4x4 com zonas simples marcadas por cones.`,
      },
      specialization: {
        name: config.skill === "saque" ? "Saque com leitura de zona" : undefined,
        players: "equipes pequenas",
        setup: `Organizar jogo aplicado com zonas simples marcadas por cones.`,
      },
    },
  },
  {
    id: `knowledge-${config.skill}-warmup-2`,
    skill: config.skill,
    stage: "warmup",
    ageStages: allAgeStages,
    families: ["aquecimento", "zonas", config.skill],
    periodizationFit: ["exploration", "decision"],
    name: config.warmup[1],
    players: "trios",
    setup: `Marcar duas ou três zonas em ${config.spaceCue}.`,
    starter: "Um aluno chama a zona e inicia a bola por baixo.",
    action: `O grupo ${config.action} na zona chamada.`,
    rotation: "A cada chamada, muda quem inicia e quem ocupa a primeira zona.",
    constraint: "Erro não elimina ninguém; o grupo recolhe e segue.",
    progression: "Chamar uma zona diferente a cada bola.",
    commonMistakes: ["todos ocupam a mesma zona", "sem comunicação"],
    adaptations: ["Facilitar usando duas zonas; dificultar alternando três zonas."],
    avoid: ["fila", "acerto obrigatório"],
    materials: ["bolas", "cones"],
    space: config.spaceCue,
  },
  {
    id: `knowledge-${config.skill}-drill-1`,
    skill: config.skill,
    stage: "drill",
    ageStages: youngerStages,
    families: ["tecnico_operacional", "troca_funcao", config.skill],
    periodizationFit: ["technical", "decision"],
    name: config.drill[0],
    players: "duplas ou trios",
    setup: `Organizar duplas ou trios em meia quadra, com uma zona-alvo grande marcada por cones.`,
    starter: "Um aluno começa lançando a bola por baixo.",
    action: `O grupo ${config.drillAction}.`,
    rotation: "A cada 4 ou 5 bolas, trocam quem inicia, quem executa a ação principal e quem recolhe.",
    constraint: "A tentativa vale mesmo longe do alvo; a próxima bola entra sem pausa.",
    scoring: "Conta ponto quando a bola chega jogável perto da zona combinada.",
    progression: "Variar direção ou distância na segunda rodada.",
    commonMistakes: ["espera longa", "tentativa só vale se acertar"],
    adaptations: ["Facilitar aproximando a zona; dificultar variando direção, distância ou oposição."],
    avoid: ["fila", "professor como alimentador"],
    materials: ["bolas", "cones"],
    space: "meia quadra",
    ageText: {
      early: {
        name: config.skill === "levantamento" ? "Cone pega-toque" : undefined,
      },
    },
  },
  {
    id: `knowledge-${config.skill}-drill-2`,
    skill: config.skill,
    stage: "drill",
    ageStages: ["transition", "formation"],
    families: ["tecnico_operacional", "decisao", config.skill],
    periodizationFit: ["technical", "decision", "pressure"],
    name: config.drill[1],
    players: "trios",
    setup: `Montar trios em quadra reduzida, com uma zona-alvo grande e bolas nas laterais.`,
    starter: "Um aluno do grupo inicia com lançamento ou ação adaptada.",
    action: `O grupo ${config.drillAction}.`,
    rotation: "A cada 4 ou 5 bolas, trocam quem inicia, quem executa a ação principal e quem recolhe.",
    constraint: "A tentativa vale mesmo longe do alvo; a próxima bola entra sem pausa.",
    scoring: "Conta ponto quando a bola chega jogável perto da zona combinada.",
    progression: "Reduzir a zona ou variar a bola de entrada.",
    commonMistakes: ["repetição parada", "sem troca de função"],
    adaptations: ["Facilitar aproximando a zona; dificultar com oposição leve."],
    avoid: ["fila", "acerto obrigatório"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
    ageText: {
      transition: {
        name:
          config.skill === "levantamento"
            ? "Introdução do toque com cone"
            : config.skill === "saque"
              ? "Saque por baixo para zonas"
              : undefined,
      },
    },
  },
  {
    id: `knowledge-${config.skill}-drill-3`,
    skill: config.skill,
    stage: "drill",
    ageStages: olderStages,
    families: ["jogo_aplicado", "pressao_controlada", config.skill],
    periodizationFit: ["decision", "pressure", "game_transfer"],
    name: config.drill[2],
    players: "trios ou equipes pequenas",
    setup: `Montar jogo aplicado em quadra reduzida, com zona-alvo grande e bolas nas laterais.`,
    starter: "Um aluno do grupo inicia com saque adaptado ou lançamento combinado.",
    action: `O grupo ${config.drillAction}.`,
    rotation: "Depois de cada rally, troca quem inicia e todos rodam uma função curta.",
    constraint: "O erro encerra só o rally; a próxima bola entra rápido.",
    scoring: config.scoring,
    progression: "Aumentar oposição ou reduzir a zona de decisão.",
    commonMistakes: ["jogo travado", "mesma função por muito tempo"],
    adaptations: ["Facilitar permitindo lançamento; dificultar reduzindo espaço."],
    avoid: ["6x6 adulto sem necessidade", "fila"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
  },
  {
    id: `knowledge-${config.skill}-game-1`,
    skill: config.skill,
    stage: "game",
    ageStages: allAgeStages,
    families: ["jogo_aplicado", "decisao", config.skill],
    periodizationFit: ["decision", "pressure", "game_transfer"],
    name: config.game[0],
    players: "equipes pequenas",
    setup: "Montar mini 3x3 com zona bônus marcada por cones.",
    starter: "A bola entra por saque adaptado ou lançamento combinado entre as equipes.",
    action: `A equipe ${config.gameAction}.`,
    rotation: "Depois de cada rally, troca quem inicia a bola e todos rodam uma função curta.",
    constraint: "O erro encerra só o rally; a próxima bola entra rápido.",
    scoring: config.scoring,
    progression: "A equipe escolhe uma zona simples antes do rally.",
    commonMistakes: ["rally travado", "regra longa demais"],
    adaptations: ["Facilitar ampliando a zona; dificultar reduzindo espaço ou aumentando oposição."],
    avoid: ["acerto para continuar", "professor como gargalo"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
    ageText: {
      early: { players: "duplas ou trios", setup: "Montar miniquadras com duplas ou trios e zonas largas marcadas por cones." },
      base: { players: "duplas ou trios", setup: "Montar mini 2x2 com zona bônus marcada por cones." },
      transition: {
        name: config.skill === "levantamento" ? "Recebe e levanta" : undefined,
      },
      formation: {
        name:
          config.skill === "saque"
            ? "Mini 4x4 com saque direcionado"
            : config.skill === "levantamento"
              ? "Mini 4x4 com segundo contato obrigatório"
              : undefined,
        setup: "Montar mini 4x4 com zona bônus marcada por cones.",
      },
      specialization: {
        name:
          config.skill === "levantamento"
            ? "Jogo aplicado com segundo contato definido"
            : undefined,
        setup: "Montar jogo aplicado com zona bônus marcada por cones.",
      },
    },
  },
  {
    id: `knowledge-${config.skill}-game-2`,
    skill: config.skill,
    stage: "game",
    ageStages: allAgeStages,
    families: ["jogo_aplicado", "zona_bonus", "pressao_controlada", config.skill],
    periodizationFit: ["decision", "pressure", "game_transfer"],
    name: config.game[1],
    players: "equipes pequenas",
    setup: "Montar quadra reduzida com zona bônus marcada por cones.",
    starter: "A bola entra por saque adaptado ou lançamento combinado entre as equipes.",
    action: `A equipe ${config.gameAction}.`,
    rotation: "Depois de cada rally, troca quem inicia a bola e todos rodam uma função curta.",
    constraint: "A equipe continua jogando mesmo quando não marca o bônus.",
    scoring: config.scoring,
    progression: "Na segunda rodada, mudar a zona bônus.",
    commonMistakes: ["zona pequena demais", "alunos fixos na mesma função"],
    adaptations: ["Facilitar com zona maior; dificultar mudando a zona por rodada."],
    avoid: ["fila", "acerto obrigatório"],
    materials: ["bolas", "cones"],
    space: "quadra reduzida",
  },
  feedbackCooldown(`knowledge-${config.skill}-cooldown`, config.skill),
]);

VOLLEYBALL_ACTIVITY_KNOWLEDGE_PATTERNS.push(...generatedFocusPatterns);

const catalogVariantToKnowledgePattern = (
  variant: ActivityCatalogVariant
): ActivityKnowledgePattern => ({
  id: variant.id,
  skill: variant.taxonomy.skill,
  stage: variant.taxonomy.recommendedPhase,
  ageStages: variant.taxonomy.ageRange,
  families: variant.taxonomy.families,
  periodizationFit: variant.periodizationFit,
  name: variant.name,
  players: variant.players,
  setup: variant.setup,
  starter: variant.starter,
  action: variant.action,
  rotation: variant.rotation,
  constraint: variant.constraint,
  scoring: variant.scoring,
  progression: variant.progression,
  commonMistakes: variant.commonMistakes,
  adaptations: variant.adaptations,
  avoid: variant.avoid,
  materials: variant.materials,
  space: variant.space,
  catalogTaxonomy: variant.taxonomy,
});

VOLLEYBALL_ACTIVITY_KNOWLEDGE_PATTERNS.push(
  ...ACTIVITY_CATALOG_VARIANTS.map(catalogVariantToKnowledgePattern)
);
