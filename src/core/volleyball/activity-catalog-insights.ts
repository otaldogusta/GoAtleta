import type {
  ActivityCatalogAuditReport,
  ActivityCatalogUnusedVariant,
} from "./activity-catalog-audit";

export type ActivityCatalogInsightPriority = "high" | "medium" | "low";

export type ActivityCatalogInsightCategory =
  | "coverageGap"
  | "usageGap"
  | "overconcentration"
  | "unusedVariants"
  | "unknownReferences"
  | "mediaGap"
  | "recommendationRisk";

export type ActivityCatalogInsightScope =
  | {
      kind: "skill";
      skill: string;
    }
  | {
      kind: "family";
      familyId: string;
    }
  | {
      kind: "variant";
      variantId: string;
      familyId?: string;
    }
  | {
      kind: "global";
    };

export type ActivityCatalogInsightAction = {
  label: string;
  type:
    | "expandCoverage"
    | "reviewScoring"
    | "reviewVisibility"
    | "reviewMedia"
    | "cleanupReference"
    | "monitorUsage"
    | "noAction";
  target?: {
    skill?: string;
    familyId?: string;
    variantId?: string;
  };
};

export type ActivityCatalogInsight = {
  id: string;
  priority: ActivityCatalogInsightPriority;
  category: ActivityCatalogInsightCategory;
  title: string;
  message: string;
  scope: ActivityCatalogInsightScope;
  evidence: string[];
  suggestedActions: ActivityCatalogInsightAction[];
};

export type ActivityCatalogInsightReport = {
  generatedAt: string;
  totalInsights: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  insights: ActivityCatalogInsight[];
};

export type ActivityCatalogInsightOptions = {
  minHealthySkillCoverage?: number;
  lowUsageThreshold?: number;
  overconcentrationRatio?: number;
  maxInsights?: number;
  now?: string;
};

type ResolvedActivityCatalogInsightOptions = Required<ActivityCatalogInsightOptions>;

const DEFAULT_INSIGHT_OPTIONS: ResolvedActivityCatalogInsightOptions = {
  minHealthySkillCoverage: 3,
  lowUsageThreshold: 0,
  overconcentrationRatio: 0.5,
  maxInsights: 12,
  now: "",
};

const EXPECTED_SKILLS = [
  "passe",
  "levantamento",
  "ataque",
  "bloqueio",
  "defesa",
  "saque",
  "transicao",
] as const;

const skillLabels: Record<string, string> = {
  passe: "passe",
  levantamento: "levantamento",
  ataque: "ataque",
  bloqueio: "bloqueio",
  defesa: "defesa",
  saque: "saque",
  transicao: "transição",
};

const priorityOrder: Record<ActivityCatalogInsightPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const categoryOrder: Record<ActivityCatalogInsightCategory, number> = {
  unknownReferences: 0,
  coverageGap: 1,
  usageGap: 2,
  unusedVariants: 3,
  overconcentration: 4,
  mediaGap: 5,
  recommendationRisk: 6,
};

const normalizeOptions = (
  options: ActivityCatalogInsightOptions | undefined
): ResolvedActivityCatalogInsightOptions => ({
  ...DEFAULT_INSIGHT_OPTIONS,
  ...options,
  now: options?.now ?? new Date().toISOString(),
});

const buildInsightId = (
  category: ActivityCatalogInsightCategory,
  scopeKey: string
) => `${category}:${scopeKey}`;

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const skillLabel = (skill: string) => skillLabels[skill] ?? skill;

const referenceReasonLabels: Record<string, string> = {
  invalidCatalogSource: "fonte de catálogo inválida",
  missingVariant: "variante inexistente",
  missingFamily: "família inexistente",
};

const countBy = <T extends string>(
  values: T[]
): Array<{ key: T; count: number }> => {
  const counts: Record<string, number> = {};
  values.forEach((value) => {
    counts[value] = (counts[value] ?? 0) + 1;
  });
  return Object.entries(counts)
    .map(([key, count]) => ({ key: key as T, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
};

const groupUnusedVariantsBySkill = (items: ActivityCatalogUnusedVariant[]) => {
  const bySkill: Record<string, ActivityCatalogUnusedVariant[]> = {};
  items.forEach((item) => {
    const skill = item.primarySkill || "sem skill";
    bySkill[skill] = [...(bySkill[skill] ?? []), item];
  });
  return Object.entries(bySkill).sort(
    (left, right) =>
      right[1].length - left[1].length || left[0].localeCompare(right[0])
  );
};

function buildNoUsageInsight(): ActivityCatalogInsight {
  return {
    id: buildInsightId("usageGap", "global:noUsageYet"),
    priority: "low",
    category: "usageGap",
    title: "Uso do catálogo ainda sem linha histórica",
    message:
      "Ainda não há uso suficiente do catálogo em planos auditados. Use este painel como linha de base antes de avaliar subutilização ou excesso de cobertura.",
    scope: { kind: "global" },
    evidence: ["0 atividades do catálogo encontradas nos planos auditados"],
    suggestedActions: [
      {
        label: "Monitorar uso",
        type: "monitorUsage",
      },
    ],
  };
}

function buildCoverageGapInsights(
  auditReport: ActivityCatalogAuditReport,
  options: ResolvedActivityCatalogInsightOptions
): ActivityCatalogInsight[] {
  return EXPECTED_SKILLS.flatMap((skill) => {
    const total = auditReport.coverage.bySkill[skill]?.total ?? 0;
    if (total >= options.minHealthySkillCoverage) return [];

    const priority: ActivityCatalogInsightPriority = total <= 1 ? "high" : "medium";
    const label = skillLabel(skill);

    return [
      {
        id: buildInsightId("coverageGap", `skill:${skill}`),
        priority,
        category: "coverageGap",
        title: `Pouca cobertura em ${label}`,
        message: `A habilidade "${label}" possui apenas ${total} variante(s) no catálogo. Isso pode limitar recomendações contextualizadas para diferentes idades e fases da periodização.`,
        scope: { kind: "skill", skill },
        evidence: [
          `${total} variante(s) em ${label}`,
          `mínimo saudável configurado: ${options.minHealthySkillCoverage}`,
        ],
        suggestedActions: [
          {
            label: `Expandir cobertura para ${label}`,
            type: "expandCoverage",
            target: { skill },
          },
        ],
      },
    ];
  });
}

function buildUsageGapInsights(
  auditReport: ActivityCatalogAuditReport,
  options: ResolvedActivityCatalogInsightOptions
): ActivityCatalogInsight[] {
  if (auditReport.usage.totalCatalogActivitiesUsed === 0) {
    return [buildNoUsageInsight()];
  }

  return EXPECTED_SKILLS.flatMap((skill) => {
    const coverage = auditReport.coverage.bySkill[skill]?.total ?? 0;
    const usage = auditReport.usage.bySkill[skill]?.count ?? 0;
    if (coverage < options.minHealthySkillCoverage || usage > options.lowUsageThreshold) {
      return [];
    }

    const label = skillLabel(skill);

    return [
      {
        id: buildInsightId("usageGap", `skill:${skill}`),
        priority: "medium",
        category: "usageGap",
        title: `Cobertura sem uso em ${label}`,
        message: `A habilidade "${label}" possui cobertura no catálogo, mas ainda não aparece em planos auditados. Pode ser falta de visibilidade, contexto de recomendação ou uso insuficiente.`,
        scope: { kind: "skill", skill },
        evidence: [`${coverage} variante(s) no catálogo`, `${usage} uso(s) em planos auditados`],
        suggestedActions: [
          {
            label: "Revisar scoring",
            type: "reviewScoring",
            target: { skill },
          },
          {
            label: "Revisar visibilidade no catálogo",
            type: "reviewVisibility",
            target: { skill },
          },
          {
            label: "Monitorar uso",
            type: "monitorUsage",
            target: { skill },
          },
        ],
      },
    ];
  });
}

function buildUnusedVariantInsights(
  auditReport: ActivityCatalogAuditReport
): ActivityCatalogInsight[] {
  if (auditReport.usage.totalCatalogActivitiesUsed === 0) return [];

  return groupUnusedVariantsBySkill(auditReport.usage.unusedVariants).map(
    ([skill, variants]) => {
      const label = skillLabel(skill);
      const priority: ActivityCatalogInsightPriority =
        variants.length >= 3 ? "medium" : "low";
      const sampleTitles = variants.slice(0, 3).map((item) => item.title);

      return {
        id: buildInsightId("unusedVariants", `skill:${skill}`),
        priority,
        category: "unusedVariants",
        title: `Variantes sem uso em ${label}`,
        message: `Há ${variants.length} variante(s) de "${label}" que ainda não aparecem em planos. Antes de expandir novamente, revise título, thumbnail, recomendação e contexto pedagógico dessas atividades.`,
        scope: { kind: "skill", skill },
        evidence: [
          `${variants.length} variante(s) sem uso`,
          ...sampleTitles.map((title) => `Exemplo: ${title}`),
        ],
        suggestedActions: [
          {
            label: "Revisar variantes não usadas",
            type: "reviewVisibility",
            target: { skill },
          },
        ],
      };
    }
  );
}

function buildUnknownReferenceInsights(
  auditReport: ActivityCatalogAuditReport
): ActivityCatalogInsight[] {
  const unknownReferences = auditReport.usage.unknownCatalogReferences;
  if (!unknownReferences.length) return [];

  const reasonCounts = countBy(unknownReferences.map((item) => item.reason));

  return [
    {
      id: buildInsightId("unknownReferences", "global"),
      priority: "high",
      category: "unknownReferences",
      title: "Referências antigas encontradas",
      message:
        "Foram encontradas atividades com referência de catálogo inválida ou antiga. Isso pode indicar mudança de IDs, dados legados ou inconsistência no histórico de planos.",
      scope: { kind: "global" },
      evidence: [
        `${unknownReferences.length} referência(s) desconhecida(s)`,
        ...reasonCounts.map(
          (item) =>
            `${item.count} ocorrência(s) de ${referenceReasonLabels[item.key] ?? item.key}`
        ),
      ],
      suggestedActions: [
        {
          label: "Revisar referências",
          type: "cleanupReference",
        },
      ],
    },
  ];
}

function buildOverconcentrationInsights(
  auditReport: ActivityCatalogAuditReport,
  options: ResolvedActivityCatalogInsightOptions
): ActivityCatalogInsight[] {
  const totalUsage = auditReport.usage.totalCatalogActivitiesUsed;
  if (totalUsage < 5) return [];

  return Object.entries(auditReport.usage.bySkill).flatMap(([skill, bucket]) => {
    const ratio = bucket.count / totalUsage;
    if (ratio < options.overconcentrationRatio) return [];

    const label = skillLabel(skill);

    return [
      {
        id: buildInsightId("overconcentration", `skill:${skill}`),
        priority: "medium" as const,
        category: "overconcentration" as const,
        title: `Uso concentrado em ${label}`,
        message: `Grande parte dos usos do catálogo está concentrada em "${label}". Isso pode representar uma necessidade real da turma ou baixa exposição de outras opções.`,
        scope: { kind: "skill" as const, skill },
        evidence: [
          `${bucket.count} de ${totalUsage} uso(s)`,
          `${formatPercent(ratio)} dos usos auditados`,
        ],
        suggestedActions: [
          {
            label: "Monitorar distribuição",
            type: "monitorUsage" as const,
            target: { skill },
          },
        ],
      },
    ];
  });
}

function sortInsightsByPriorityAndCategory(
  insights: ActivityCatalogInsight[]
): ActivityCatalogInsight[] {
  return [...insights].sort((left, right) => {
    const priorityDiff = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const categoryDiff = categoryOrder[left.category] - categoryOrder[right.category];
    if (categoryDiff !== 0) return categoryDiff;
    return left.id.localeCompare(right.id);
  });
}

export function buildActivityCatalogInsights(
  auditReport: ActivityCatalogAuditReport,
  options?: ActivityCatalogInsightOptions
): ActivityCatalogInsightReport {
  const resolvedOptions = normalizeOptions(options);
  const insights = sortInsightsByPriorityAndCategory([
    ...buildUnknownReferenceInsights(auditReport),
    ...buildCoverageGapInsights(auditReport, resolvedOptions),
    ...buildUsageGapInsights(auditReport, resolvedOptions),
    ...buildUnusedVariantInsights(auditReport),
    ...buildOverconcentrationInsights(auditReport, resolvedOptions),
  ]).slice(0, resolvedOptions.maxInsights);

  return {
    generatedAt: resolvedOptions.now,
    totalInsights: insights.length,
    highPriorityCount: insights.filter((item) => item.priority === "high").length,
    mediumPriorityCount: insights.filter((item) => item.priority === "medium").length,
    lowPriorityCount: insights.filter((item) => item.priority === "low").length,
    insights,
  };
}
