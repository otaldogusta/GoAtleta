import type { ActivityCatalogAuditReport } from "../../../core/volleyball/activity-catalog-audit";
import type {
  ActivityCatalogInsight,
  ActivityCatalogInsightReport,
} from "../../../core/volleyball/activity-catalog-insights";
import {
  buildCatalogAuditExportPayload,
  formatCatalogAuditAsJson,
  formatCatalogAuditAsMarkdown,
  formatCatalogInsightActionMarkdown,
} from "../catalogAuditFormatters";

const insight: ActivityCatalogInsight = {
  id: "unusedVariants:skill:defesa",
  priority: "medium",
  category: "unusedVariants",
  title: "Variantes sem uso em defesa",
  message:
    "Há variantes de defesa que ainda não aparecem em planos auditados.",
  scope: { kind: "skill", skill: "defesa" },
  evidence: ["3 variantes sem uso", "Exemplo: Defesa em zona curta"],
  suggestedActions: [
    {
      label: "Revisar variantes não usadas",
      type: "reviewVisibility",
      target: { skill: "defesa" },
    },
  ],
};

const auditReport: ActivityCatalogAuditReport = {
  coverage: {
    totalFamilies: 11,
    totalVariants: 24,
    bySkill: {},
    byFamily: {},
    byAgeRange: {},
    byRecommendedPhase: {},
    byComplexity: {},
    criticalGaps: [],
  },
  usage: {
    totalCatalogActivitiesUsed: 4,
    totalPlansScanned: 2,
    totalBlocksScanned: 6,
    byVariantId: {},
    byFamilyId: {},
    bySkill: {},
    mostUsedVariants: [],
    unusedVariants: [
      {
        variantId: "defesa-zona-curta",
        familyId: "defesa-transicao",
        title: "Defesa em zona curta",
        primarySkill: "defesa",
      },
    ],
    unknownCatalogReferences: [
      {
        variantId: "legacy-variant",
        familyId: "legacy-family",
        reason: "missingVariant",
        planId: "plan-sensitive",
        blockId: "warmup",
        activityName: "Aula da Turma Sub-13 com aluno João",
      },
    ],
  },
};

const insightReport: ActivityCatalogInsightReport = {
  generatedAt: "2026-06-16T03:00:00.000Z",
  totalInsights: 1,
  highPriorityCount: 0,
  mediumPriorityCount: 1,
  lowPriorityCount: 0,
  insights: [insight],
};

describe("catalog audit formatters", () => {
  it("builds an aggregate export payload without sensitive plan fields", () => {
    const payload = buildCatalogAuditExportPayload(auditReport, insightReport);

    expect(payload.summary).toMatchObject({
      totalFamilies: 11,
      totalVariants: 24,
      totalCatalogActivitiesUsed: 4,
      totalInsights: 1,
      mediumPriorityCount: 1,
      unusedVariantCount: 1,
      unknownReferenceCount: 1,
    });
    expect(JSON.stringify(payload)).toContain("legacy-variant");
    expect(JSON.stringify(payload)).not.toContain("plan-sensitive");
    expect(JSON.stringify(payload)).not.toContain("João");
    expect(JSON.stringify(payload)).not.toContain("Turma Sub-13");
  });

  it("formats markdown with summary and insights", () => {
    const payload = buildCatalogAuditExportPayload(auditReport, insightReport);
    const markdown = formatCatalogAuditAsMarkdown(payload);

    expect(markdown).toContain("# Relatório de Auditoria do Catálogo GoAtleta");
    expect(markdown).toContain("- Famílias: 11");
    expect(markdown).toContain("### [Média] Variantes sem uso em defesa");
    expect(markdown).toContain("Revisar variantes não usadas");
    expect(markdown).not.toContain("João");
    expect(markdown).not.toContain("Turma Sub-13");
  });

  it("formats valid JSON", () => {
    const payload = buildCatalogAuditExportPayload(auditReport, insightReport);
    const parsed = JSON.parse(formatCatalogAuditAsJson(payload));

    expect(parsed.summary.totalVariants).toBe(24);
    expect(parsed.insights[0].id).toBe("unusedVariants:skill:defesa");
  });

  it("formats a single insight action package", () => {
    const markdown = formatCatalogInsightActionMarkdown(insight);

    expect(markdown).toContain("# Ação sugerida - Catálogo GoAtleta");
    expect(markdown).toContain("## Problema");
    expect(markdown).toContain("Variantes sem uso em defesa");
    expect(markdown).toContain("## Evidência");
    expect(markdown).toContain("## Ação sugerida");
    expect(markdown).toContain("Skill: defesa");
    expect(markdown).toContain("Sem migration");
  });
});
