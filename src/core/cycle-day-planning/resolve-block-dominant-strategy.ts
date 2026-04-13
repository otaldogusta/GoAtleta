import type {
    CycleDayPlanningContext,
    PedagogicalIntent,
    ProgressionDimension,
    SessionStrategy,
    StrategyLevel,
    VolleyballSkill,
} from "../models";

export type DominantBlockStrategyProfileKey =
  | "base_tecnica"
  | "organizacao_ofensiva"
  | "aplicacao_em_jogo";

export type DominantBlockStrategyInfluence = {
  key: DominantBlockStrategyProfileKey | "none";
  label?: string;
  dominantBlock?: string;
};

export type DominantBlockStrategyResult = {
  strategy: SessionStrategy;
  adjusted: boolean;
  influence: DominantBlockStrategyInfluence;
};

type DominantBlockStrategyProfile = {
  key: DominantBlockStrategyProfileKey;
  label: string;
  aliases: string[];
  primarySkillCandidates: VolleyballSkill[];
  secondarySkillCandidates: VolleyballSkill[];
  progressionTarget: ProgressionDimension;
  pedagogicalIntent: PedagogicalIntent;
  preferredFamilies: string[];
  minLevels: Pick<SessionStrategy, "oppositionLevel" | "timePressureLevel" | "gameTransferLevel">;
};

const PROGRESSION_LADDER: ProgressionDimension[] = [
  "consistencia",
  "precisao",
  "pressao_tempo",
  "oposicao",
  "tomada_decisao",
  "transferencia_jogo",
];

const LEVEL_ORDER: StrategyLevel[] = ["low", "medium", "high"];

const PHASE_BOUNDS: Record<
  CycleDayPlanningContext["phaseIntent"],
  { min: ProgressionDimension; max: ProgressionDimension }
> = {
  exploracao_fundamentos: { min: "consistencia", max: "precisao" },
  estabilizacao_tecnica: { min: "precisao", max: "oposicao" },
  aceleracao_decisao: { min: "pressao_tempo", max: "tomada_decisao" },
  transferencia_jogo: { min: "tomada_decisao", max: "transferencia_jogo" },
  pressao_competitiva: { min: "oposicao", max: "transferencia_jogo" },
};

const STRATEGY_PROFILES: DominantBlockStrategyProfile[] = [
  {
    key: "base_tecnica",
    label: "Base tecnica",
    aliases: [
      "base tecnica",
      "fundamentos",
      "fundamentos basicos",
      "exploracao motora",
      "consolidacao",
      "base estrutural",
      "desenvolvimento tecnico",
    ],
    primarySkillCandidates: ["passe", "levantamento", "saque", "bloqueio", "defesa"],
    secondarySkillCandidates: ["levantamento", "passe", "defesa", "bloqueio"],
    progressionTarget: "precisao",
    pedagogicalIntent: "technical_adjustment",
    preferredFamilies: ["bloco_tecnico", "alvo_zona", "deslocamento"],
    minLevels: {
      oppositionLevel: "low",
      timePressureLevel: "low",
      gameTransferLevel: "low",
    },
  },
  {
    key: "organizacao_ofensiva",
    label: "Organizacao ofensiva",
    aliases: [
      "organizacao ofensiva",
      "integracao tatica",
      "desenvolvimento",
      "potencia especifica",
      "levantamento",
      "ofensiva",
      "organizacao",
    ],
    primarySkillCandidates: ["levantamento", "transicao", "ataque"],
    secondarySkillCandidates: ["ataque", "levantamento", "passe"],
    progressionTarget: "tomada_decisao",
    pedagogicalIntent: "team_organization",
    preferredFamilies: ["cooperacao", "jogo_condicionado", "deslocamento"],
    minLevels: {
      oppositionLevel: "medium",
      timePressureLevel: "medium",
      gameTransferLevel: "medium",
    },
  },
  {
    key: "aplicacao_em_jogo",
    label: "Aplicacao em jogo",
    aliases: [
      "aplicacao em jogo",
      "jogo",
      "jogos reduzidos",
      "integracao de jogo",
      "pre-competitivo",
      "pre competitivo",
      "competitivo",
      "transicao",
    ],
    primarySkillCandidates: ["transicao", "defesa", "ataque"],
    secondarySkillCandidates: ["ataque", "defesa", "transicao"],
    progressionTarget: "transferencia_jogo",
    pedagogicalIntent: "game_reading",
    preferredFamilies: ["jogo_condicionado", "cooperacao", "deslocamento"],
    minLevels: {
      oppositionLevel: "high",
      timePressureLevel: "high",
      gameTransferLevel: "high",
    },
  },
];

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const clampProgression = (
  value: ProgressionDimension,
  minValue: ProgressionDimension,
  maxValue: ProgressionDimension
) => {
  const index = PROGRESSION_LADDER.indexOf(value);
  const minIndex = PROGRESSION_LADDER.indexOf(minValue);
  const maxIndex = PROGRESSION_LADDER.indexOf(maxValue);
  if (index < 0 || minIndex < 0 || maxIndex < 0) return value;
  return PROGRESSION_LADDER[Math.min(Math.max(index, minIndex), maxIndex)] ?? value;
};

const maxProgression = (left: ProgressionDimension, right: ProgressionDimension) => {
  const leftIndex = PROGRESSION_LADDER.indexOf(left);
  const rightIndex = PROGRESSION_LADDER.indexOf(right);
  if (leftIndex < 0) return right;
  if (rightIndex < 0) return left;
  return PROGRESSION_LADDER[Math.max(leftIndex, rightIndex)] ?? right;
};

const minProgression = (left: ProgressionDimension, right: ProgressionDimension) => {
  const leftIndex = PROGRESSION_LADDER.indexOf(left);
  const rightIndex = PROGRESSION_LADDER.indexOf(right);
  if (leftIndex < 0) return right;
  if (rightIndex < 0) return left;
  return PROGRESSION_LADDER[Math.min(leftIndex, rightIndex)] ?? left;
};

const ensureMinLevel = (current: StrategyLevel, target: StrategyLevel): StrategyLevel => {
  const currentIndex = LEVEL_ORDER.indexOf(current);
  const targetIndex = LEVEL_ORDER.indexOf(target);
  if (currentIndex < 0 || targetIndex < 0) return current;
  return LEVEL_ORDER[Math.max(currentIndex, targetIndex)] ?? current;
};

const ensureMaxLevel = (current: StrategyLevel, target: StrategyLevel): StrategyLevel => {
  const currentIndex = LEVEL_ORDER.indexOf(current);
  const targetIndex = LEVEL_ORDER.indexOf(target);
  if (currentIndex < 0 || targetIndex < 0) return current;
  return LEVEL_ORDER[Math.min(currentIndex, targetIndex)] ?? current;
};

const prioritizeFamilies = (
  strategy: SessionStrategy,
  context: CycleDayPlanningContext,
  preferredFamilies: string[]
) => {
  const available = context.allowedDrillFamilies.filter(
    (family) => !strategy.forbiddenDrillFamilies.includes(family)
  );
  const current = Array.from(new Set([...strategy.drillFamilies, ...available]));
  const prioritized = [
    ...preferredFamilies.filter((family) => current.includes(family)),
    ...current.filter((family) => !preferredFamilies.includes(family)),
  ];
  return Array.from(new Set(prioritized)).slice(0, Math.max(2, strategy.drillFamilies.length));
};

const pickPreferredSkill = (
  preferredOrder: VolleyballSkill[],
  actualCandidates: Array<VolleyballSkill | undefined>
) => {
  for (const preferred of preferredOrder) {
    if (actualCandidates.includes(preferred)) return preferred;
  }
  return preferredOrder[0];
};

const rotatePreferredSkills = (skills: VolleyballSkill[], shift: number) => {
  if (!skills.length || shift <= 0) return skills;
  const offset = shift % skills.length;
  return [...skills.slice(offset), ...skills.slice(0, offset)];
};

export const resolveDominantBlockStrategyProfile = (
  dominantBlock?: string | null
): DominantBlockStrategyProfile | null => {
  const normalized = normalizeText(dominantBlock);
  if (!normalized) return null;

  return (
    STRATEGY_PROFILES.find((profile) =>
      profile.aliases.some(
        (alias) => normalized.includes(alias) || alias.includes(normalized)
      )
    ) ?? null
  );
};

export const applyDominantBlockStrategy = (params: {
  context: CycleDayPlanningContext;
  strategy: SessionStrategy;
}): DominantBlockStrategyResult => {
  const profile = resolveDominantBlockStrategyProfile(params.context.dominantBlock);
  if (!profile) {
    return {
      strategy: params.strategy,
      adjusted: false,
      influence: {
        key: "none",
        dominantBlock: params.context.dominantBlock,
      },
    };
  }

  const sessionShift = profile.key === "base_tecnica" && (params.context.sessionIndexInWeek ?? 1) >= 2 ? 1 : 0;
  const rotatedPrimaryCandidates = rotatePreferredSkills(profile.primarySkillCandidates, sessionShift);
  const primarySkill =
    (profile.key === "aplicacao_em_jogo"
      ? profile.primarySkillCandidates[0]
      : profile.key === "base_tecnica" && sessionShift > 0
        ? rotatedPrimaryCandidates[0]
      : profile.key === "base_tecnica"
        ? [
            params.context.primarySkill,
            params.context.secondarySkill,
            params.strategy.primarySkill,
            params.strategy.secondarySkill,
          ].find((skill) => skill && profile.primarySkillCandidates.includes(skill))
      : pickPreferredSkill(rotatedPrimaryCandidates, [
          params.context.primarySkill,
          params.context.secondarySkill,
          params.strategy.primarySkill,
          params.strategy.secondarySkill,
        ])) ?? params.strategy.primarySkill;
  const secondarySkill =
    pickPreferredSkill(
      profile.secondarySkillCandidates.filter((skill) => skill !== primarySkill),
      [
        params.context.secondarySkill,
        params.strategy.secondarySkill,
        params.context.primarySkill,
        params.strategy.primarySkill,
      ].filter((skill) => skill !== primarySkill)
    ) ?? params.strategy.secondarySkill;

  const phaseBounds = PHASE_BOUNDS[params.context.phaseIntent];
  const progressionTarget =
    profile.key === "base_tecnica"
      ? minProgression(params.strategy.progressionDimension, "precisao")
      : maxProgression(params.strategy.progressionDimension, profile.progressionTarget);
  const progressionDimension = clampProgression(
    progressionTarget,
    phaseBounds.min,
    phaseBounds.max
  );

  const nextStrategy: SessionStrategy = {
    ...params.strategy,
    primarySkill: primarySkill ?? params.strategy.primarySkill,
    secondarySkill: secondarySkill ?? params.strategy.secondarySkill,
    progressionDimension,
    pedagogicalIntent: profile.pedagogicalIntent,
    drillFamilies: prioritizeFamilies(params.strategy, params.context, profile.preferredFamilies),
    oppositionLevel:
      profile.key === "base_tecnica"
        ? ensureMaxLevel(params.strategy.oppositionLevel, profile.minLevels.oppositionLevel)
        : ensureMinLevel(params.strategy.oppositionLevel, profile.minLevels.oppositionLevel),
    timePressureLevel:
      profile.key === "base_tecnica"
        ? ensureMaxLevel(params.strategy.timePressureLevel, profile.minLevels.timePressureLevel)
        : ensureMinLevel(params.strategy.timePressureLevel, profile.minLevels.timePressureLevel),
    gameTransferLevel:
      profile.key === "base_tecnica"
        ? ensureMaxLevel(params.strategy.gameTransferLevel, profile.minLevels.gameTransferLevel)
        : ensureMinLevel(params.strategy.gameTransferLevel, profile.minLevels.gameTransferLevel),
  };

  const adjusted = JSON.stringify(nextStrategy) !== JSON.stringify(params.strategy);

  return {
    strategy: nextStrategy,
    adjusted,
    influence: {
      key: profile.key,
      label: profile.label,
      dominantBlock: params.context.dominantBlock,
    },
  };
};
