import type {
  PedagogicalIntent,
  ProgressionDimension,
  VolleyballSkill,
  WeeklyLoadIntent,
} from "../models";
import type { SessionPlanningContext } from "../session-planning-context";

export type ActivityPatternStage = "warmup" | "drill" | "game" | "cooldown";
export type ActivityPatternAgeStage =
  | "early"
  | "base"
  | "transition"
  | "formation"
  | "specialization";

export type ActivityPatternAgeProfile = {
  stage: ActivityPatternAgeStage;
  label: string;
  gameForm: "mini_2x2" | "mini_3x3" | "mini_4x4" | "game_applied";
  organizationCue: string;
  challengeCue: string;
};

export type ActivityPatternSelectionContext = {
  primarySkill: VolleyballSkill;
  ageProfile: ActivityPatternAgeProfile;
  periodizationPhase?: SessionPlanningContext["periodizationPhase"];
  progressionDimension?: ProgressionDimension;
  pedagogicalIntent?: PedagogicalIntent;
  loadIntent?: WeeklyLoadIntent;
  materials: string[];
  classSize: number;
  recentActivityFamilies: string[];
};

export type ActivityPatternActivitySpec = {
  id: string;
  stage: ActivityPatternStage;
  name: string;
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
  sourcePatternId?: string;
};

export type ActivityPattern = {
  id: string;
  stage: ActivityPatternStage;
  skills: VolleyballSkill[];
  ageStages: ActivityPatternAgeStage[];
  families: string[];
  playerFormat: string;
  space: string;
  materials: string[];
  periodizationFit: Array<
    | "exploration"
    | "technical"
    | "decision"
    | "pressure"
    | "game_transfer"
  >;
  build: (context: ActivityPatternSelectionContext) => ActivityPatternActivitySpec;
};

export type ActivityPatternBlocks = {
  warmup: ActivityPatternActivitySpec[];
  main: ActivityPatternActivitySpec[];
  cooldown: ActivityPatternActivitySpec[];
};

const skillLabel: Record<VolleyballSkill, string> = {
  passe: "passe",
  levantamento: "levantamento",
  ataque: "ataque",
  bloqueio: "bloqueio",
  defesa: "defesa",
  saque: "saque",
  transicao: "transição",
};

const allAgeStages: ActivityPatternAgeStage[] = [
  "early",
  "base",
  "transition",
  "formation",
  "specialization",
];

const formatGameForm = (value: ActivityPatternAgeProfile["gameForm"]) => {
  if (value === "mini_2x2") return "mini 2x2";
  if (value === "mini_3x3") return "mini 3x3";
  if (value === "mini_4x4") return "mini 4x4";
  return "jogo aplicado";
};

const isYounger = (context: ActivityPatternSelectionContext) =>
  context.ageProfile.stage === "early" || context.ageProfile.stage === "base";

const isOlder = (context: ActivityPatternSelectionContext) =>
  context.ageProfile.stage === "formation" ||
  context.ageProfile.stage === "specialization";

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const includesAny = (values: string[], targets: string[]) => {
  const normalizedValues = values.map(normalize);
  return targets.some((target) =>
    normalizedValues.some((value) => value.includes(target))
  );
};

const contextIntentFits = (
  pattern: ActivityPattern,
  context: ActivityPatternSelectionContext
) => {
  const fits = pattern.periodizationFit;
  if (
    context.pedagogicalIntent === "decision_making" ||
    context.progressionDimension === "tomada_decisao"
  ) {
    return fits.includes("decision");
  }
  if (
    context.loadIntent === "alto" ||
    context.periodizationPhase === "pre_competitivo" ||
    context.periodizationPhase === "competitivo" ||
    context.progressionDimension === "pressao_tempo" ||
    context.progressionDimension === "oposicao"
  ) {
    return fits.includes("pressure") || fits.includes("game_transfer");
  }
  if (context.progressionDimension === "transferencia_jogo") {
    return fits.includes("game_transfer") || fits.includes("decision");
  }
  if (context.periodizationPhase === "base") {
    return fits.includes("exploration") || fits.includes("technical");
  }
  return fits.includes("technical") || fits.includes("decision");
};

const scorePattern = (
  pattern: ActivityPattern,
  context: ActivityPatternSelectionContext
) => {
  let score = 0;
  if (pattern.skills.includes(context.primarySkill)) score += 40;
  if (pattern.ageStages.includes(context.ageProfile.stage)) score += 20;
  if (contextIntentFits(pattern, context)) score += 10;
  if (!includesAny(context.recentActivityFamilies, pattern.families)) score += 6;
  if (pattern.materials.every((material) => includesAny(context.materials, [material]))) {
    score += 4;
  }
  if (context.classSize >= 16 && /equipe|grupo/.test(pattern.playerFormat)) score += 2;
  return score;
};

const selectPattern = (
  stage: ActivityPatternStage,
  context: ActivityPatternSelectionContext
) => {
  const candidates = VOLLEYBALL_ACTIVITY_PATTERNS.filter(
    (pattern) =>
      pattern.stage === stage &&
      pattern.skills.includes(context.primarySkill) &&
      pattern.ageStages.includes(context.ageProfile.stage)
  );
  const fallbackCandidates = VOLLEYBALL_ACTIVITY_PATTERNS.filter(
    (pattern) => pattern.stage === stage && pattern.skills.includes(context.primarySkill)
  );
  const available = candidates.length ? candidates : fallbackCandidates;
  return [...available].sort((left, right) => {
    const scoreDelta = scorePattern(right, context) - scorePattern(left, context);
    return scoreDelta || left.id.localeCompare(right.id);
  })[0];
};

const stageSuffix = (context: ActivityPatternSelectionContext) =>
  context.ageProfile.stage.replace(/_/g, "-");

const buildWarmupName = (
  context: ActivityPatternSelectionContext,
  names: Partial<Record<ActivityPatternAgeStage, string>>
) =>
  names[context.ageProfile.stage] ??
  (isYounger(context)
    ? `Brincadeira de ${skillLabel[context.primarySkill]}`
    : `Aquecimento de ${skillLabel[context.primarySkill]} em ${formatGameForm(
        context.ageProfile.gameForm
      )}`);

const buildParticipants = (context: ActivityPatternSelectionContext) => {
  if (isYounger(context)) return "duplas ou trios";
  if (context.ageProfile.stage === "transition") return "trios";
  return "equipes pequenas";
};

const skillRecipes: Record<
  VolleyballSkill,
  {
    warmupNames: Partial<Record<ActivityPatternAgeStage, string>>;
    drillName: string;
    gameName: string;
    action: string;
    drillAction: string;
    gameAction: string;
    scoring: string;
    coachFocus: string;
    successCriteria: string;
  }
> = {
  passe: {
    warmupNames: {
      early: "Chama e devolve",
      base: "Corrida do primeiro contato",
      transition: "Chamada em trio",
      formation: "Recepção com cobertura",
      specialization: "Entrada de recepção sob pressão",
    },
    drillName: "Primeiro contato para zona-alvo",
    gameName: "Mini jogo com primeiro contato pontuado",
    action: "chama a bola e devolve o primeiro contato jogável",
    drillAction: "recebe a bola e envia o passe para uma zona grande",
    gameAction: "faz o primeiro contato chegar jogável para a equipe continuar",
    scoring: "Vale ponto extra quando o primeiro contato chega jogável na zona marcada.",
    coachFocus: "Observar comunicação e direção da primeira bola.",
    successCriteria: "A equipe mantém o primeiro contato jogável em rallies curtos.",
  },
  levantamento: {
    warmupNames: {
      early: "Bola alta circulando",
      base: "Segundo contato em roda",
      transition: "Trio do segundo contato",
      formation: "Organiza e levanta",
      specialization: "Leitura do segundo contato",
    },
    drillName: "Segundo contato para zona combinada",
    gameName: "Mini jogo com segundo contato definido",
    action: "mantém a bola alta e chama o colega que recebe",
    drillAction: "organiza o segundo contato para uma zona combinada",
    gameAction: "usa o segundo contato para deixar a bola jogável ao colega",
    scoring: "Vale ponto extra quando o segundo contato chega jogável na zona combinada.",
    coachFocus: "Observar tempo de bola, chamada e direção do segundo contato.",
    successCriteria: "O grupo organiza o segundo contato sem travar a jogada.",
  },
  ataque: {
    warmupNames: {
      early: "Passa da linha e pontua",
      base: "Alvo aberto do ataque",
      transition: "Trio da bola final",
      formation: "Entrada e cobertura",
      specialization: "Leitura da finalização",
    },
    drillName: "Ataque para alvo aberto",
    gameName: "Mini jogo com finalização combinada",
    action: "envia a bola para uma zona livre sem exigir gesto técnico",
    drillAction: "recebe uma bola preparada pelo colega e finaliza para uma zona aberta",
    gameAction: "escolhe entre mandar a bola para zona livre ou manter o rally",
    scoring: "Vale ponto extra quando a finalização escolhe uma zona livre.",
    coachFocus: "Observar escolha de zona e segurança na finalização.",
    successCriteria: "A equipe finaliza com intenção e mantém continuidade quando não há bola clara.",
  },
  bloqueio: {
    warmupNames: {
      early: "Espelho da rede",
      base: "Fecha a janela",
      transition: "Sombra e cobertura",
      formation: "Bloqueio com ajuda",
      specialization: "Leitura do bloqueio",
    },
    drillName: "Bloqueio com sombra e cobertura",
    gameName: "Mini jogo com bloqueio e cobertura",
    action: "acompanha o colega e ocupa a janela marcada perto da rede",
    drillAction: "fecha a janela perto da rede enquanto um colega simula a bola e outro cobre atrás",
    gameAction: "protege a zona da rede e cobre a sobra para continuar o rally",
    scoring: "Vale ponto extra quando bloqueio ou cobertura mantém a bola em jogo.",
    coachFocus: "Observar tempo de leitura e cobertura atrás da rede.",
    successCriteria: "A equipe fecha a zona combinada e cobre a sobra sem parar a atividade.",
  },
  defesa: {
    warmupNames: {
      early: "Guarda-zona",
      base: "Defende e chama",
      transition: "Trio da bola salva",
      formation: "Cobertura em miniquadra",
      specialization: "Defesa com transição",
    },
    drillName: "Defesa e devolução jogável",
    gameName: "Mini jogo com defesa pontuada",
    action: "protege uma zona e chama a bola quando ela entra no espaço",
    drillAction: "recebe uma bola variada do colega e devolve jogável para o grupo continuar",
    gameAction: "defende a primeira bola e tenta devolver jogável para a equipe",
    scoring: "Vale ponto extra quando a defesa volta jogável e o rally continua.",
    coachFocus: "Observar comunicação, ocupação de zona e bola jogável.",
    successCriteria: "A equipe salva bolas simples e recoloca a bola em jogo.",
  },
  saque: {
    warmupNames: {
      early: "Boliche do saque por baixo",
      base: "Pega-zona do saque",
      transition: "Zona chamada do saque",
      formation: "Saque e organiza recepção",
      specialization: "Saque com leitura de zona",
    },
    drillName: "Saque para zonas alternadas",
    gameName: "Mini jogo com saque em jogo",
    action: "ocupa a zona chamada e reconhece direção de saque",
    drillAction: "saca para uma zona combinada e troca função com quem recolhe",
    gameAction: "inicia o rally com saque adaptado e segue jogando",
    scoring: "Vale ponto extra quando o saque entra na zona combinada.",
    coachFocus: "Observar rotina curta e direção do saque.",
    successCriteria: "O aluno coloca a bola em jogo e mira uma zona clara.",
  },
  transicao: {
    warmupNames: {
      early: "Vira e organiza",
      base: "Troca de lado jogável",
      transition: "Recupera e apoia",
      formation: "Defende e contra-ataca",
      specialization: "Transição com leitura",
    },
    drillName: "Recupera e contra-ataca",
    gameName: "Mini jogo de vira-jogo",
    action: "troca de função depois da bola e ocupa uma nova zona",
    drillAction: "defende, reorganiza o trio e envia a bola para uma zona livre",
    gameAction: "passa da defesa ao ataque com uma regra simples de apoio",
    scoring: "Vale ponto extra quando a equipe reorganiza e continua após defender.",
    coachFocus: "Observar troca de função e apoio depois da primeira bola.",
    successCriteria: "A equipe reconhece a mudança de fase e mantém o rally jogável.",
  },
};

const buildWarmupPattern = (skill: VolleyballSkill): ActivityPattern => ({
  id: `volleyball-pattern-${skill}-warmup`,
  stage: "warmup",
  skills: [skill],
  ageStages: allAgeStages,
  families: ["ludico", "alta_participacao"],
  playerFormat: "duplas, trios ou equipes pequenas",
  space: "quadra reduzida",
  materials: ["bolas", "cones"],
  periodizationFit: ["exploration", "technical", "decision"],
  build: (context) => {
    const recipe = skillRecipes[skill];
    const participants = buildParticipants(context);
    const organization = isOlder(context)
      ? `Organizar ${formatGameForm(
          context.ageProfile.gameForm
        )} com zonas simples marcadas por cones.`
      : "Espalhar duplas ou trios em espaços pequenos da quadra, com cones marcando zonas largas.";
    const starter = "Ao sinal combinado, um aluno inicia a bola para o grupo.";
    const action = `O grupo ${recipe.action}.`;
    const rotation = "Depois de cada rodada, muda quem inicia a bola.";
    const simpleRule = isYounger(context)
      ? "Erro não elimina ninguém; o grupo reinicia rápido e segue brincando."
      : "A rodada continua mesmo com erro; o grupo reorganiza e reinicia sem espera.";
    const execution = `${starter} ${action} ${rotation} ${simpleRule}`;
    return {
      id: `warmup_${skill}_${stageSuffix(context)}`,
      stage: "warmup",
      name: buildWarmupName(context, recipe.warmupNames),
      participants,
      organization,
      starter,
      action,
      rotation,
      simpleRule,
      materials: ["bolas", "cones"],
      space: isOlder(context) ? "quadra reduzida" : "quadra em espaços pequenos",
      execution,
      coachFocus: "Observar participação, comunicação e segurança antes da correção técnica.",
      successCriteria: "Todos participam com poucas pausas e função clara.",
      adaptation: "Facilitar reduzindo distância; dificultar aumentando a oposição ou a zona de decisão.",
      sourcePatternId: `volleyballxl-informed-${skill}-warmup`,
    };
  },
});

const buildDrillPattern = (skill: VolleyballSkill): ActivityPattern => ({
  id: `volleyball-pattern-${skill}-drill`,
  stage: "drill",
  skills: [skill],
  ageStages: allAgeStages,
  families: ["tecnico_operacional", "troca_funcao"],
  playerFormat: "duplas ou trios",
  space: "meia quadra",
  materials: ["bolas", "cones"],
  periodizationFit: ["technical", "decision", "pressure"],
  build: (context) => {
    const recipe = skillRecipes[skill];
    const participants = isOlder(context) ? "trios ou equipes pequenas" : "duplas ou trios";
    const organization = isOlder(context)
      ? `Montar ${formatGameForm(
          context.ageProfile.gameForm
        )} em quadra reduzida, com uma zona-alvo grande e bolas nas laterais.`
      : "Organizar duplas ou trios em meia quadra, com uma zona-alvo grande marcada por cones.";
    const starter = isOlder(context)
      ? "Um aluno do grupo inicia com lançamento ou ação adaptada."
      : "Um aluno começa lançando a bola por baixo.";
    const action = `O grupo ${recipe.drillAction}.`;
    const rotation = "A cada 4 ou 5 bolas, trocam quem inicia, quem executa a ação principal e quem recolhe.";
    const simpleRule = "A tentativa vale mesmo longe do alvo; a próxima bola entra sem pausa.";
    const execution = `${starter} ${action} ${rotation} ${simpleRule}`;
    return {
      id: `main_${skill}_drill_${stageSuffix(context)}`,
      stage: "drill",
      name: recipe.drillName,
      participants,
      organization,
      starter,
      action,
      rotation,
      simpleRule,
      scoring: "Conta ponto quando a bola chega jogável perto da zona combinada.",
      materials: ["bolas", "cones"],
      space: isOlder(context) ? "quadra reduzida" : "meia quadra",
      execution,
      coachFocus: recipe.coachFocus,
      successCriteria: recipe.successCriteria,
      adaptation: "Facilitar aproximando a zona; dificultar variando direção, distância ou oposição.",
      sourcePatternId: `volleyballxl-informed-${skill}-drill`,
    };
  },
});

const buildGamePattern = (skill: VolleyballSkill): ActivityPattern => ({
  id: `volleyball-pattern-${skill}-game`,
  stage: "game",
  skills: [skill],
  ageStages: allAgeStages,
  families: ["jogo_aplicado", "decisao"],
  playerFormat: "equipes pequenas",
  space: "quadra reduzida",
  materials: ["bolas", "cones"],
  periodizationFit: ["decision", "pressure", "game_transfer"],
  build: (context) => {
    const recipe = skillRecipes[skill];
    const gameForm = formatGameForm(context.ageProfile.gameForm);
    const participants = isYounger(context) ? "duplas ou trios" : "equipes pequenas";
    const organization = isYounger(context)
      ? "Montar miniquadras com duplas ou trios e zonas largas marcadas por cones."
      : `Montar ${gameForm} com zona bônus marcada por cones.`;
    const starter = "A bola entra por saque adaptado ou lançamento combinado entre as equipes.";
    const action = `A equipe ${recipe.gameAction}.`;
    const rotation = "Depois de cada rally, troca quem inicia a bola e todos rodam uma função curta.";
    const simpleRule = "O erro encerra só o rally; a próxima bola entra rápido.";
    const scoring = recipe.scoring;
    const execution = `${starter} ${action} ${rotation} ${scoring} ${simpleRule}`;
    return {
      id: `main_${skill}_game_${stageSuffix(context)}`,
      stage: "game",
      name: recipe.gameName,
      participants,
      organization,
      starter,
      action,
      rotation,
      simpleRule,
      scoring,
      materials: ["bolas", "cones"],
      space: context.ageProfile.gameForm === "game_applied" ? "quadra reduzida ou inteira" : "quadra reduzida",
      execution,
      coachFocus: recipe.coachFocus,
      successCriteria: recipe.successCriteria,
      adaptation: "Facilitar permitindo lançamento; dificultar reduzindo espaço ou aumentando oposição.",
      sourcePatternId: `volleyballxl-informed-${skill}-game`,
    };
  },
});

export const VOLLEYBALL_ACTIVITY_PATTERNS: ActivityPattern[] = (
  [
    "passe",
    "levantamento",
    "ataque",
    "bloqueio",
    "defesa",
    "saque",
    "transicao",
  ] as VolleyballSkill[]
).flatMap((skill) => [
  buildWarmupPattern(skill),
  buildDrillPattern(skill),
  buildGamePattern(skill),
]);

export const buildPatternBackedVolleyballBlocks = (
  context: ActivityPatternSelectionContext
): ActivityPatternBlocks => {
  const warmup = selectPattern("warmup", context)?.build(context);
  const drill = selectPattern("drill", context)?.build(context);
  const game = selectPattern("game", context)?.build(context);

  return {
    warmup: warmup ? [warmup] : [],
    main: [drill, game].filter(
      (activity): activity is ActivityPatternActivitySpec => Boolean(activity)
    ),
    cooldown: [],
  };
};
