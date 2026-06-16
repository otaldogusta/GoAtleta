import type { ActivityCatalogAuditReport } from "../volleyball/activity-catalog-audit";
import {
  buildActivityCatalogInsights,
  type ActivityCatalogInsight,
} from "../volleyball/activity-catalog-insights";

const coverageBucket = (total: number) => ({
  total,
  variantIds: Array.from({ length: total }, (_, index) => `variant-${index + 1}`),
  familyIds: Array.from({ length: Math.max(total, 1) }, (_, index) => `family-${index + 1}`),
});

const usageBucket = (count: number) => ({
  count,
  planIds: ["plan-1"],
  lastUsedAt: "2026-06-15T10:00:00.000Z",
});

const buildReport = (
  overrides: Partial<ActivityCatalogAuditReport> = {}
): ActivityCatalogAuditReport => ({
  coverage: {
    totalFamilies: 4,
    totalVariants: 12,
    bySkill: {
      passe: coverageBucket(3),
      levantamento: coverageBucket(3),
      ataque: coverageBucket(3),
      bloqueio: coverageBucket(3),
      defesa: coverageBucket(3),
      saque: coverageBucket(3),
      transicao: coverageBucket(3),
    },
    byFamily: {},
    byAgeRange: {},
    byRecommendedPhase: {},
    byComplexity: {},
    criticalGaps: [],
  },
  usage: {
    totalCatalogActivitiesUsed: 1,
    totalPlansScanned: 1,
    totalBlocksScanned: 3,
    byVariantId: {
      "variant-used": usageBucket(1),
    },
    byFamilyId: {
      "family-used": usageBucket(1),
    },
    bySkill: {
      passe: usageBucket(1),
    },
    mostUsedVariants: [
      {
        variantId: "variant-used",
        familyId: "family-used",
        title: "Atividade usada",
        count: 1,
        lastUsedAt: "2026-06-15T10:00:00.000Z",
      },
    ],
    unusedVariants: [],
    unknownCatalogReferences: [],
  },
  ...overrides,
});

const findInsight = (
  insights: ActivityCatalogInsight[],
  id: string
): ActivityCatalogInsight | undefined => insights.find((item) => item.id === id);

describe("activity catalog insights", () => {
  it("creates a baseline insight when there is no catalog usage", () => {
    const report = buildReport({
      usage: {
        ...buildReport().usage,
        totalCatalogActivitiesUsed: 0,
        byVariantId: {},
        byFamilyId: {},
        bySkill: {},
        mostUsedVariants: [],
        unusedVariants: [
          {
            variantId: "unused-1",
            familyId: "family-1",
            title: "Atividade não usada",
            primarySkill: "defesa",
          },
          {
            variantId: "unused-2",
            familyId: "family-1",
            title: "Outra atividade não usada",
            primarySkill: "defesa",
          },
        ],
      },
    });

    const insightReport = buildActivityCatalogInsights(report, {
      now: "2026-06-16T00:00:00.000Z",
      maxInsights: 20,
    });

    expect(insightReport.generatedAt).toBe("2026-06-16T00:00:00.000Z");
    expect(insightReport.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "usageGap:global:noUsageYet",
          priority: "low",
          category: "usageGap",
        }),
      ])
    );
    expect(
      insightReport.insights.some((item) => item.category === "unusedVariants")
    ).toBe(false);
  });

  it("classifies coverage gaps by variant count", () => {
    const report = buildReport({
      coverage: {
        ...buildReport().coverage,
        bySkill: {
          passe: coverageBucket(0),
          levantamento: coverageBucket(1),
          ataque: coverageBucket(2),
          bloqueio: coverageBucket(3),
          defesa: coverageBucket(3),
          saque: coverageBucket(3),
          transicao: coverageBucket(3),
        },
      },
    });

    const insights = buildActivityCatalogInsights(report, { maxInsights: 20 }).insights;

    expect(findInsight(insights, "coverageGap:skill:passe")).toMatchObject({
      priority: "high",
    });
    expect(findInsight(insights, "coverageGap:skill:levantamento")).toMatchObject({
      priority: "high",
    });
    expect(findInsight(insights, "coverageGap:skill:ataque")).toMatchObject({
      priority: "medium",
    });
    expect(findInsight(insights, "coverageGap:skill:bloqueio")).toBeUndefined();
  });

  it("creates usage gap insights for healthy coverage without usage", () => {
    const report = buildReport({
      usage: {
        ...buildReport().usage,
        totalCatalogActivitiesUsed: 2,
        bySkill: {
          passe: usageBucket(2),
        },
      },
    });

    const insights = buildActivityCatalogInsights(report, { maxInsights: 20 }).insights;

    expect(findInsight(insights, "usageGap:skill:defesa")).toMatchObject({
      priority: "medium",
      category: "usageGap",
    });
    expect(findInsight(insights, "usageGap:skill:passe")).toBeUndefined();
  });

  it("creates high priority insights for unknown catalog references", () => {
    const report = buildReport({
      usage: {
        ...buildReport().usage,
        unknownCatalogReferences: [
          {
            variantId: "missing-variant",
            familyId: "family-1",
            reason: "missingVariant",
            activityName: "Atividade antiga",
          },
          {
            familyId: "missing-family",
            reason: "missingFamily",
            activityName: "Outra atividade antiga",
          },
        ],
      },
    });

    const insight = findInsight(
      buildActivityCatalogInsights(report, { maxInsights: 20 }).insights,
      "unknownReferences:global"
    );

    expect(insight).toMatchObject({
      priority: "high",
      category: "unknownReferences",
    });
    expect(insight?.evidence.join(" ")).toContain("2 referência(s)");
    expect(insight?.suggestedActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "cleanupReference" })])
    );
  });

  it("creates overconcentration insights only after enough usage", () => {
    const concentrated = buildReport({
      usage: {
        ...buildReport().usage,
        totalCatalogActivitiesUsed: 5,
        bySkill: {
          passe: usageBucket(3),
          defesa: usageBucket(2),
        },
      },
    });

    expect(
      findInsight(
        buildActivityCatalogInsights(concentrated, { maxInsights: 20 }).insights,
        "overconcentration:skill:passe"
      )
    ).toMatchObject({ priority: "medium" });

    const tooSmall = buildReport({
      usage: {
        ...buildReport().usage,
        totalCatalogActivitiesUsed: 4,
        bySkill: {
          passe: usageBucket(4),
        },
      },
    });

    expect(
      findInsight(
        buildActivityCatalogInsights(tooSmall, { maxInsights: 20 }).insights,
        "overconcentration:skill:passe"
      )
    ).toBeUndefined();
  });

  it("sorts insights by priority and category", () => {
    const report = buildReport({
      coverage: {
        ...buildReport().coverage,
        bySkill: {
          passe: coverageBucket(0),
          levantamento: coverageBucket(3),
          ataque: coverageBucket(3),
          bloqueio: coverageBucket(3),
          defesa: coverageBucket(3),
          saque: coverageBucket(3),
          transicao: coverageBucket(3),
        },
      },
      usage: {
        ...buildReport().usage,
        unknownCatalogReferences: [
          {
            variantId: "missing-variant",
            reason: "missingVariant",
          },
        ],
      },
    });

    const insights = buildActivityCatalogInsights(report, { maxInsights: 20 }).insights;

    expect(insights[0].id).toBe("unknownReferences:global");
    expect(insights[1].id).toBe("coverageGap:skill:passe");
  });

  it("limits the final insight list with maxInsights", () => {
    const insights = buildActivityCatalogInsights(buildReport(), {
      maxInsights: 2,
    }).insights;

    expect(insights).toHaveLength(2);
  });
});
