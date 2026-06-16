import type {
  ActivityCatalogAuditReport,
  ActivityCatalogUnusedVariant,
  ActivityCatalogUnknownReference,
} from "../../core/volleyball/activity-catalog-audit";
import type {
  ActivityCatalogInsight,
  ActivityCatalogInsightReport,
} from "../../core/volleyball/activity-catalog-insights";

export type CatalogAuditExportPayload = {
  generatedAt: string;
  summary: {
    totalFamilies: number;
    totalVariants: number;
    totalCatalogActivitiesUsed: number;
    totalInsights: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    unusedVariantCount: number;
    unknownReferenceCount: number;
  };
  insights: Array<{
    id: string;
    priority: string;
    category: string;
    title: string;
    message: string;
    evidence: string[];
    suggestedActions: string[];
  }>;
  unusedVariants: Array<{
    variantId: string;
    familyId: string;
    title: string;
    primarySkill: string;
  }>;
  unknownReferences: Array<{
    variantId?: string;
    familyId?: string;
    reason: string;
  }>;
};

const priorityLabels: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const categoryLabels: Record<string, string> = {
  coverageGap: "Lacuna de cobertura",
  usageGap: "Lacuna de uso",
  overconcentration: "Uso concentrado",
  unusedVariants: "Variantes sem uso",
  unknownReferences: "Referências antigas",
  mediaGap: "Lacuna visual",
  recommendationRisk: "Risco de recomendação",
};

const scopeLabel = (insight: ActivityCatalogInsight) => {
  if (insight.scope.kind === "skill") return `Skill: ${insight.scope.skill}`;
  if (insight.scope.kind === "family") return `Família: ${insight.scope.familyId}`;
  if (insight.scope.kind === "variant") {
    return `Variante: ${insight.scope.variantId}${
      insight.scope.familyId ? ` · Família: ${insight.scope.familyId}` : ""
    }`;
  }
  return "Escopo: global";
};

const formatList = (items: string[]) =>
  items.length ? items.map((item) => `- ${item}`).join("\n") : "- Nenhum item informado";

const sanitizeUnusedVariant = (item: ActivityCatalogUnusedVariant) => ({
  variantId: item.variantId,
  familyId: item.familyId,
  title: item.title,
  primarySkill: item.primarySkill,
});

const sanitizeUnknownReference = (item: ActivityCatalogUnknownReference) => ({
  variantId: item.variantId,
  familyId: item.familyId,
  reason: item.reason,
});

export function buildCatalogAuditExportPayload(
  auditReport: ActivityCatalogAuditReport,
  insightReport: ActivityCatalogInsightReport
): CatalogAuditExportPayload {
  return {
    generatedAt: insightReport.generatedAt,
    summary: {
      totalFamilies: auditReport.coverage.totalFamilies,
      totalVariants: auditReport.coverage.totalVariants,
      totalCatalogActivitiesUsed: auditReport.usage.totalCatalogActivitiesUsed,
      totalInsights: insightReport.totalInsights,
      highPriorityCount: insightReport.highPriorityCount,
      mediumPriorityCount: insightReport.mediumPriorityCount,
      lowPriorityCount: insightReport.lowPriorityCount,
      unusedVariantCount: auditReport.usage.unusedVariants.length,
      unknownReferenceCount: auditReport.usage.unknownCatalogReferences.length,
    },
    insights: insightReport.insights.map((insight) => ({
      id: insight.id,
      priority: insight.priority,
      category: insight.category,
      title: insight.title,
      message: insight.message,
      evidence: [...insight.evidence],
      suggestedActions: insight.suggestedActions.map((action) => action.label),
    })),
    unusedVariants: auditReport.usage.unusedVariants
      .slice(0, 50)
      .map(sanitizeUnusedVariant),
    unknownReferences: auditReport.usage.unknownCatalogReferences
      .slice(0, 50)
      .map(sanitizeUnknownReference),
  };
}

export function formatCatalogInsightActionMarkdown(
  insight: ActivityCatalogInsight
): string {
  return [
    "# Ação sugerida - Catálogo GoAtleta",
    "",
    "## Problema",
    insight.title,
    "",
    "## Evidência",
    formatList(insight.evidence),
    "",
    "## Ação sugerida",
    formatList(insight.suggestedActions.map((action) => action.label)),
    "",
    "## Escopo sugerido",
    `- ${scopeLabel(insight)}`,
    "",
    "## Fora de escopo",
    "- Sem migration",
    "- Sem Supabase",
    "- Sem mudança em TrainingPlan",
    "- Sem analytics remoto",
  ].join("\n");
}

export function formatCatalogAuditAsMarkdown(
  payload: CatalogAuditExportPayload
): string {
  const insightBlocks = payload.insights.length
    ? payload.insights
        .map((insight) =>
          [
            `### [${priorityLabels[insight.priority] ?? insight.priority}] ${insight.title}`,
            "",
            insight.message,
            "",
            `Categoria: ${categoryLabels[insight.category] ?? insight.category}`,
            "",
            "Evidências:",
            formatList(insight.evidence),
            "",
            "Ações sugeridas:",
            formatList(insight.suggestedActions),
          ].join("\n")
        )
        .join("\n\n")
    : "Nenhum insight crítico encontrado.";

  const unusedVariants = payload.unusedVariants.length
    ? payload.unusedVariants
        .map((item) => `- ${item.title} (${item.primarySkill})`)
        .join("\n")
    : "- Nenhuma variante sem uso registrada.";

  const unknownReferences = payload.unknownReferences.length
    ? payload.unknownReferences
        .map(
          (item) =>
            `- ${item.reason}: ${item.variantId ?? "sem variantId"} / ${
              item.familyId ?? "sem familyId"
            }`
        )
        .join("\n")
    : "- Nenhuma referência desconhecida registrada.";

  return [
    "# Relatório de Auditoria do Catálogo GoAtleta",
    "",
    `Gerado em: ${payload.generatedAt}`,
    "",
    "## Resumo",
    `- Famílias: ${payload.summary.totalFamilies}`,
    `- Variantes: ${payload.summary.totalVariants}`,
    `- Atividades usadas em planos: ${payload.summary.totalCatalogActivitiesUsed}`,
    `- Insights de alta prioridade: ${payload.summary.highPriorityCount}`,
    `- Insights de média prioridade: ${payload.summary.mediumPriorityCount}`,
    `- Insights de baixa prioridade: ${payload.summary.lowPriorityCount}`,
    `- Variantes nunca usadas: ${payload.summary.unusedVariantCount}`,
    `- Referências desconhecidas: ${payload.summary.unknownReferenceCount}`,
    "",
    "## Insights",
    "",
    insightBlocks,
    "",
    "## Variantes nunca usadas",
    "",
    unusedVariants,
    "",
    "## Referências desconhecidas",
    "",
    unknownReferences,
    "",
    "## Privacidade",
    "",
    "Este relatório contém apenas dados agregados e metadados do catálogo. Ele não inclui nomes de alunos, emails, professores, unidades, turmas reais, scouting bruto ou conteúdo completo de planos.",
  ].join("\n");
}

export function formatCatalogAuditAsJson(
  payload: CatalogAuditExportPayload
): string {
  return JSON.stringify(payload, null, 2);
}

export function getCatalogAuditCategoryLabel(category: string): string {
  return categoryLabels[category] ?? category;
}

export function getCatalogAuditPriorityLabel(priority: string): string {
  return priorityLabels[priority] ?? priority;
}

export function getCatalogInsightScopeLabel(insight: ActivityCatalogInsight): string {
  return scopeLabel(insight);
}
