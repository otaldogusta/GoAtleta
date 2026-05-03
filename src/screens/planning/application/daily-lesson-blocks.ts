import type { DailyLessonPlan, LessonActivity, LessonBlock, SessionEnvironment } from "../../../core/models";
import { summarizeLessonActivity, type LessonBlockType } from "../../../pdf/summarize-lesson-activity";
import { getLessonBlockTimes } from "../../../utils/lesson-block-times";

const BLOCK_META: Array<{ key: LessonBlock["key"]; label: string; fallbackDuration: number }> = [
  { key: "warmup", label: "Aquecimento", fallbackDuration: 10 },
  { key: "main", label: "Parte principal", fallbackDuration: 45 },
  { key: "cooldown", label: "Volta à calma", fallbackDuration: 5 },
];

const safeText = (value: unknown) => String(value ?? "").trim();

const makeActivity = (description: string, blockType: LessonBlockType): LessonActivity => ({
  id: `legacy_${blockType}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  name: summarizeLessonActivity(description, blockType),
  description,
});

const makeTemplateActivity = (
  id: string,
  name: string,
  description: string,
): LessonActivity => ({ id, name, description });

const COURT_ACTIVITY_PATTERN =
  /\b(recepcao|recepção|saque|levantamento|bloqueio|cobertura|contra-ataque|jogo|mini\s*jogo|mini\s*\d+x\d+|manchete|toque|quadra)\b/i;

const RESISTANCE_ACTIVITY_PATTERN =
  /\b(leg\s*press|stiff|agachamento|panturrilha|core|remada|halter|halteres|serie|série|series|séries|repetic|repetiç|descanso|cadencia|cadência|resistido|academia)\b/i;

const blockText = (block: LessonBlock | undefined) =>
  [
    block?.label,
    ...(block?.activities ?? []).flatMap((activity) => [activity.name, activity.description]),
  ]
    .map((value) => safeText(value))
    .filter(Boolean)
    .join(" ");

const isCourtLikeBlock = (block: LessonBlock | undefined) =>
  COURT_ACTIVITY_PATTERN.test(blockText(block));

const isResistanceLikeBlock = (block: LessonBlock | undefined) =>
  RESISTANCE_ACTIVITY_PATTERN.test(blockText(block));

const parseManualSessionEnvironmentOverride = (plan: Pick<DailyLessonPlan, "manualOverrideMaskJson" | "manualOverridesJson"> | null | undefined) => {
  try {
    const mask = JSON.parse(plan?.manualOverrideMaskJson ?? "[]");
    if (Array.isArray(mask) && mask.includes("sessionEnvironment")) return true;
  } catch {
    // Keep conservative fallback below.
  }

  try {
    const overrides = JSON.parse(plan?.manualOverridesJson ?? "{}") as { sessionEnvironment?: boolean };
    return overrides?.sessionEnvironment === true;
  } catch {
    return false;
  }
};

const hasResistanceComponents = (plan: Pick<DailyLessonPlan, "sessionComponents"> | null | undefined) =>
  Boolean(plan?.sessionComponents?.some((component) => component.type === "academia_resistido"));

export const resolveConservativeDailySessionEnvironment = (
  plan: Pick<
    DailyLessonPlan,
    | "sessionEnvironment"
    | "sessionComponents"
    | "manualOverrideMaskJson"
    | "manualOverridesJson"
  > | null | undefined,
  blocks: LessonBlock[] = [],
): SessionEnvironment => {
  const saved = plan?.sessionEnvironment;
  if (saved !== "academia" && saved !== "mista" && saved !== "preventiva") {
    return "quadra";
  }

  if (parseManualSessionEnvironmentOverride(plan)) {
    return saved;
  }

  if (hasResistanceComponents(plan)) {
    return saved;
  }

  const main = blocks.find((block) => block.key === "main");
  if ((saved === "academia" || saved === "mista") && isResistanceLikeBlock(main) && !isCourtLikeBlock(main)) {
    return saved;
  }

  return "quadra";
};

const resolveTemplateDurations = (durationMinutes: number, environment: SessionEnvironment) => {
  const total = Math.max(30, Math.round(durationMinutes || 60));
  if (environment === "academia") {
    const warmup = total >= 75 ? 15 : 10;
    const cooldown = total >= 75 ? 10 : 5;
    return {
      warmup,
      main: Math.max(20, total - warmup - cooldown),
      cooldown,
    };
  }

  if (environment === "mista") {
    const warmup = total >= 75 ? 10 : 8;
    const cooldown = total >= 75 ? 20 : 12;
    return {
      warmup,
      main: Math.max(20, total - warmup - cooldown),
      cooldown,
    };
  }

  const blockTimes = getLessonBlockTimes(total);
  return {
    warmup: blockTimes.warmupMinutes,
    main: blockTimes.mainMinutes,
    cooldown: blockTimes.cooldownMinutes,
  };
};

export const buildSessionEnvironmentLessonBlocks = (
  environment: SessionEnvironment,
  durationMinutes = 60,
): LessonBlock[] => {
  const durations = resolveTemplateDurations(durationMinutes, environment);
  if (environment === "academia") {
    return [
      {
        key: "warmup",
        label: "Preparação",
        durationMinutes: durations.warmup,
        activities: [
          makeTemplateActivity(
            "academy_preparation",
            "Mobilidade e ativação geral",
            "Mobilidade de quadril, tornozelo e ombros, seguida de ativação leve de core e membros inferiores para preparar o treino resistido."
          ),
        ],
      },
      {
        key: "main",
        label: "Treino resistido",
        durationMinutes: durations.main,
        activities: [
          makeTemplateActivity(
            "academy_leg_press",
            "Leg Press 45°",
            "3 séries de 8 a 10 repetições, descanso de 75 a 90 segundos. Priorizar amplitude segura e controle na descida, relacionando a força de membros inferiores com salto e estabilidade."
          ),
          makeTemplateActivity(
            "academy_stiff",
            "Stiff com halteres",
            "3 séries de 8 repetições, descanso de 75 segundos. Manter coluna neutra e quadril para trás, reforçando cadeia posterior para impulsão e proteção de joelho."
          ),
          makeTemplateActivity(
            "academy_row",
            "Remada baixa",
            "3 séries de 10 repetições, descanso de 60 segundos. Puxar com escápulas estáveis, conectando força de tronco e ombro ao controle de manchete e defesa."
          ),
          makeTemplateActivity(
            "academy_core",
            "Core anti-rotação",
            "3 séries de 20 a 30 segundos por lado, descanso curto. Manter tronco estável para melhorar equilíbrio em deslocamentos e aterrissagens."
          ),
        ],
      },
      {
        key: "cooldown",
        label: "Fechamento",
        durationMinutes: durations.cooldown,
        activities: [
          makeTemplateActivity(
            "academy_closure",
            "Desaceleração e registro de carga",
            "Alongamento leve, hidratação e registro rápido de percepção de esforço. Fechar com orientação sobre recuperação e qualidade de movimento."
          ),
        ],
      },
    ];
  }

  if (environment === "mista") {
    return [
      {
        key: "warmup",
        label: "Quadra inicial",
        durationMinutes: durations.warmup,
        activities: [
          makeTemplateActivity(
            "mixed_court_start",
            "Ativação com bola",
            "Ativação curta em quadra com deslocamentos, manchete leve e toque de segurança para preparar a turma antes do bloco resistido."
          ),
        ],
      },
      {
        key: "main",
        label: "Academia",
        durationMinutes: durations.main,
        activities: [
          makeTemplateActivity(
            "mixed_leg_press",
            "Leg Press 45°",
            "3 séries de 8 repetições, descanso de 75 segundos. Executar com controle e transferir a intenção para impulsão e estabilidade na quadra."
          ),
          makeTemplateActivity(
            "mixed_stiff",
            "Stiff com halteres",
            "3 séries de 8 repetições, descanso de 75 segundos. Trabalhar cadeia posterior com postura estável e movimento controlado."
          ),
          makeTemplateActivity(
            "mixed_core",
            "Core anti-rotação",
            "3 séries de 20 segundos por lado, descanso curto. Manter tronco firme para sustentar deslocamentos e recepções."
          ),
        ],
      },
      {
        key: "cooldown",
        label: "Transferência para quadra e fechamento",
        durationMinutes: durations.cooldown,
        activities: [
          makeTemplateActivity(
            "mixed_transfer",
            "Aplicação técnica na quadra",
            "Retornar para a quadra e aplicar movimentos curtos com bola, conectando estabilidade, deslocamento e primeira bola. Encerrar com roda rápida sobre como a força ajudou a execução."
          ),
        ],
      },
    ];
  }

  return [
    {
      key: "warmup",
      label: "Aquecimento",
      durationMinutes: durations.warmup,
      activities: [
        makeTemplateActivity(
          "court_warmup",
          "Aquecimento com bola",
          "Ativação em quadra com deslocamentos simples, controle de bola e comandos curtos para preparar a parte principal."
        ),
      ],
    },
    {
      key: "main",
      label: "Parte principal",
      durationMinutes: durations.main,
      activities: [
        makeTemplateActivity(
          "court_main",
          "Atividade principal de quadra",
          "Organizar a turma em grupos pequenos para trabalhar o fundamento planejado com alvo, repetição orientada e aplicação em jogo reduzido."
        ),
      ],
    },
    {
      key: "cooldown",
      label: "Volta à calma",
      durationMinutes: durations.cooldown,
      activities: [
        makeTemplateActivity(
          "court_cooldown",
          "Roda rápida de fechamento",
          "Fechar a aula com perguntas curtas sobre o que funcionou, o que precisa melhorar e qual ajuste será levado para a próxima sessão."
        ),
      ],
    },
  ];
};

export const ensureLessonBlocksMatchSessionEnvironment = (
  blocks: LessonBlock[],
  environment: SessionEnvironment,
  durationMinutes = 60,
): LessonBlock[] => {
  if (!blocks.length) {
    return buildSessionEnvironmentLessonBlocks(environment, durationMinutes);
  }

  const byKey = new Map(blocks.map((block) => [block.key, block]));
  const warmup = byKey.get("warmup");
  const main = byKey.get("main");
  const cooldown = byKey.get("cooldown");

  if (environment === "academia") {
    const hasAcademyStructure =
      /preparacao|preparação/i.test(warmup?.label ?? "") &&
      /treino\s+resistido|resistido|academia/i.test(main?.label ?? "") &&
      /fechamento/i.test(cooldown?.label ?? "");

    if (!hasAcademyStructure || isCourtLikeBlock(main) || !isResistanceLikeBlock(main)) {
      return buildSessionEnvironmentLessonBlocks("academia", durationMinutes);
    }
  }

  if (environment === "mista") {
    const hasMixedStructure =
      /quadra\s+inicial/i.test(warmup?.label ?? "") &&
      /academia|resistido/i.test(main?.label ?? "") &&
      /transferencia|transferência|fechamento/i.test(cooldown?.label ?? "");

    if (!hasMixedStructure || isCourtLikeBlock(main) || !isResistanceLikeBlock(main)) {
      return buildSessionEnvironmentLessonBlocks("mista", durationMinutes);
    }
  }

  if (environment === "quadra") {
    const hasCourtStructure =
      /aquecimento/i.test(warmup?.label ?? "") &&
      /parte\s+principal/i.test(main?.label ?? "") &&
      /volta/i.test(cooldown?.label ?? "");

    if (!hasCourtStructure || isResistanceLikeBlock(main)) {
      return buildSessionEnvironmentLessonBlocks("quadra", durationMinutes);
    }
  }

  return blocks;
};

export const parseLessonBlocksJson = (value: string | undefined): LessonBlock[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const blocks: LessonBlock[] = parsed
      .map((raw): LessonBlock | null => {
        const key = raw?.key;
        if (key !== "warmup" && key !== "main" && key !== "cooldown") return null;
        const activities = Array.isArray(raw?.activities)
          ? raw.activities
              .map((item: unknown) => {
                const maybe = item as { id?: string; name?: string; description?: string };
                const name = safeText(maybe?.name);
                const description = safeText(maybe?.description);
                if (!name && !description) return null;
                return {
                  id: safeText(maybe?.id) || undefined,
                  name: name || summarizeLessonActivity(description, key),
                  description,
                } as LessonActivity;
              })
              .filter((item: LessonActivity | null): item is LessonActivity => Boolean(item))
          : [];

        const fallbackMeta = BLOCK_META.find((item) => item.key === key);
        return {
          key,
          label: safeText(raw?.label) || fallbackMeta?.label || key,
          durationMinutes:
            Number.isFinite(raw?.durationMinutes) && Number(raw.durationMinutes) > 0
              ? Math.round(Number(raw.durationMinutes))
              : fallbackMeta?.fallbackDuration || 0,
          activities,
        };
      })
      .filter((item: LessonBlock | null): item is LessonBlock => Boolean(item));

    return blocks.length ? blocks : null;
  } catch {
    return null;
  }
};

export const buildFallbackLessonBlocks = (params: {
  warmup: string;
  mainPart: string;
  cooldown: string;
  durationMinutes?: number;
}): LessonBlock[] => {
  const warmup = safeText(params.warmup);
  const mainPart = safeText(params.mainPart);
  const cooldown = safeText(params.cooldown);
  const blockTimes = getLessonBlockTimes(params.durationMinutes ?? 60);

  return [
    {
      key: "warmup",
      label: "Aquecimento",
      durationMinutes: blockTimes.warmupMinutes,
      activities: warmup ? [makeActivity(warmup, "warmup")] : [],
    },
    {
      key: "main",
      label: "Parte principal",
      durationMinutes: blockTimes.mainMinutes,
      activities: mainPart ? [makeActivity(mainPart, "main")] : [],
    },
    {
      key: "cooldown",
      label: "Volta à calma",
      durationMinutes: blockTimes.cooldownMinutes,
      activities: cooldown ? [makeActivity(cooldown, "cooldown")] : [],
    },
  ];
};

export const resolveLessonBlocksFromDailyPlan = (
  plan: Pick<DailyLessonPlan, "warmup" | "mainPart" | "cooldown" | "blocksJson">,
  durationMinutes?: number
): LessonBlock[] => {
  const parsed = parseLessonBlocksJson(plan.blocksJson);
  const blockTimes = getLessonBlockTimes(durationMinutes ?? 60);
  if (parsed) {
    const byKey = new Map(parsed.map((block) => [block.key, block]));
    return BLOCK_META.map((meta) => byKey.get(meta.key) ?? {
      key: meta.key,
      label: meta.label,
      durationMinutes:
        meta.key === "warmup"
          ? blockTimes.warmupMinutes
          : meta.key === "main"
            ? blockTimes.mainMinutes
            : blockTimes.cooldownMinutes,
      activities: [],
    });
  }

  return buildFallbackLessonBlocks({
    warmup: plan.warmup,
    mainPart: plan.mainPart,
    cooldown: plan.cooldown,
    durationMinutes,
  });
};

export const serializeLessonBlocks = (blocks: LessonBlock[]): string =>
  JSON.stringify(
    blocks.map((block) => ({
      key: block.key,
      label: safeText(block.label),
      durationMinutes:
        Number.isFinite(block.durationMinutes) && block.durationMinutes > 0
          ? Math.round(block.durationMinutes)
          : 0,
      activities: (block.activities ?? [])
        .map((activity) => ({
          id: safeText(activity.id) || undefined,
          name: safeText(activity.name),
          description: safeText(activity.description),
        }))
        .filter((activity) => activity.name || activity.description),
    }))
  );

export const deriveLegacyDailySections = (blocks: LessonBlock[]) => {
  const find = (key: LessonBlock["key"]) => blocks.find((block) => block.key === key);

  const toSection = (key: LessonBlock["key"]) => {
    const block = find(key);
    if (!block) return "";
    const descriptions = (block.activities ?? [])
      .map((item) => safeText(item.description))
      .filter(Boolean);
    if (descriptions.length) return descriptions.join("\n");

    return (block.activities ?? [])
      .map((item) => safeText(item.name))
      .filter(Boolean)
      .join("\n");
  };

  return {
    warmup: toSection("warmup"),
    mainPart: toSection("main"),
    cooldown: toSection("cooldown"),
  };
};
