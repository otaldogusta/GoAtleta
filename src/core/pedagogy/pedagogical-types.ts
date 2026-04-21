// ─────────────────────────────────────────────────────────────────────────────
// Domínio canônico da pedagogia do voleibol no GoAtleta
//
// Regra de ouro:
//   Fonte metodológica (CMV, Compartilhar, Rede Esperança, etc.)
//   ≠ Domínio canônico (tipos deste arquivo)
//   ≠ Linguagem exibida (volleyball-language-lexicon.ts)
// ─────────────────────────────────────────────────────────────────────────────

export type AgeBandKey = "06-07" | "08-10" | "11-12" | "13-14";

export type GameFormKey = "mini_2x2" | "mini_3x3" | "mini_4x4" | "formal_6x6";

export type ComplexityLevel = "baixo" | "baixo_moderado" | "moderado" | "moderado_alto";

export type CanonicalSkillKey =
  | "throw_catch_control"
  | "set_self_control"
  | "set_target_simple"
  | "set_with_movement"
  | "set_continuity"
  | "underhand_serve_intro"
  | "underhand_serve_target"
  | "receive_simple"
  | "receive_direction"
  | "lift_front_intro"
  | "two_action_continuity"
  | "three_action_continuity"
  | "mini_game_1x1_intro"
  | "mini_game_2x2_intro"
  | "mini_game_2x2_continuity"
  | "mini_game_3x3_intro"
  | "defense_control_intro"
  | "coverage_intro"
  | "attack_arm_intro"
  | "block_marking_intro";

export type CanonicalContextKey =
  | "free_space"
  | "individual_control"
  | "pair_work"
  | "trio_work"
  | "simple_target"
  | "wall_work"
  | "reduced_court"
  | "adapted_rules"
  | "continuity_game"
  | "application_game";

export type SourceMethodology =
  | "rede_esperanca"
  | "cmv_nederland"
  | "instituto_compartilhar"
  | "ltad"
  | "drill_library";

export type BlockOrganization =
  | "individual"
  | "dupla"
  | "trio"
  | "equipes_reduzidas"
  | "roda";

export type BlockTaskStyle =
  | "brincadeira"
  | "desafio_curto"
  | "estacao"
  | "mini_jogo"
  | "fechamento";

export type BlockIntensity = "leve" | "moderada" | "moderada_alta";

export type RichPedagogicalBlockRecommendation = {
  skills: CanonicalSkillKey[];
  contexts: CanonicalContextKey[];
  organization: BlockOrganization;
  taskStyle: BlockTaskStyle;
  intensity: BlockIntensity;
};

export type PedagogicalBlockRecommendation = {
  warmup: RichPedagogicalBlockRecommendation;
  main: RichPedagogicalBlockRecommendation;
  cooldown: RichPedagogicalBlockRecommendation;
};

export type PedagogicalProgressionStage = {
  id: string;
  ageBand: AgeBandKey;
  monthIndex: number;
  sequenceIndex: number;
  phase: string;
  stageLabel: string;
  gameForm: GameFormKey;
  complexityLevel: ComplexityLevel;
  alreadyIntroduced: CanonicalSkillKey[];
  alreadyPracticedContexts: CanonicalContextKey[];
  nextStep: CanonicalSkillKey[];
  pedagogicalConstraints: string[];
  blockRecommendations: PedagogicalBlockRecommendation;
  source: {
    methodology: SourceMethodology;
    sourceLabel: string;
    sourceRef?: string;
  };
};

export type NextPedagogicalStep = {
  stageId: string;
  sequenceIndex: number;
  monthStageCount: number;
  currentStage: string;
  gameForm: GameFormKey;
  complexityLevel: ComplexityLevel;
  alreadyIntroduced: CanonicalSkillKey[];
  alreadyPracticedContexts: CanonicalContextKey[];
  nextStep: CanonicalSkillKey[];
  pedagogicalConstraints: string[];
  blockRecommendations: PedagogicalBlockRecommendation;
  selectionReason: string;
  sourceTrail: Array<{
    methodology: SourceMethodology;
    sourceLabel: string;
    sourceRef?: string;
  }>;
};

export type PlanningAlignmentCheck = {
  cycleWindowAligned: boolean;
  phaseAligned: boolean;
  weeklyFocusAligned: boolean;
  loadAligned: boolean;
  ageBandAligned: boolean;
  historyAligned: boolean;
  score: number;
  classification: "baixo" | "parcial" | "bom" | "forte";
  notes: string[];
};
