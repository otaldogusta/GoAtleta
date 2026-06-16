import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import * as Clipboard from "expo-clipboard";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { TrainingPlan, TrainingPlanActivity } from "../../../core/models";
import { ACTIVITY_CATALOG_FAMILIES } from "../../../core/volleyball/activity-catalog";
import { buildActivityCatalogAuditReport } from "../../../core/volleyball/activity-catalog-audit";
import { buildActivityCatalogInsights } from "../../../core/volleyball/activity-catalog-insights";
import { CatalogAuditPanel } from "../CatalogAuditPanel";
import { CatalogAuditInsightsPanel } from "../CatalogAuditInsightsPanel";

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => true),
}));

const firstFamily = ACTIVITY_CATALOG_FAMILIES[0];
const firstVariant = firstFamily.variants[0];
const blockFamily = ACTIVITY_CATALOG_FAMILIES.find((family) =>
  family.variants.some((variant) => variant.taxonomy.skill === "bloqueio")
);
const blockVariant = blockFamily?.variants.find((variant) => variant.taxonomy.skill === "bloqueio");

if (!blockFamily || !blockVariant) {
  throw new Error("Catalog audit panel test requires bloqueio coverage.");
}

const catalogActivity = (
  familyId: string,
  variantId: string,
  name: string,
  addedAt: string
): TrainingPlanActivity => ({
  name,
  description: "Atividade adicionada pelo catalogo.",
  catalog: {
    source: "goAtletaCatalog",
    familyId,
    variantId,
    addedAt,
  },
});

const plan = (activities: TrainingPlanActivity[]): TrainingPlan => ({
  id: "plan-catalog-audit",
  classId: "class-1",
  title: "Aula catalogo",
  tags: [],
  warmup: [],
  main: [],
  cooldown: [],
  warmupTime: "10",
  mainTime: "40",
  cooldownTime: "5",
  createdAt: "2026-06-15T00:00:00.000Z",
  status: "final",
  pedagogy: {
    blocks: {
      warmup: { activities: [] },
      main: { activities },
      cooldown: { activities: [] },
    },
  },
});

const collectText = (value: unknown): string[] => {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (value && typeof value === "object" && "children" in value) {
    return collectText((value as { children?: unknown }).children);
  }
  return [];
};

const renderText = async (element: React.ReactElement) => {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 1024, height: 768 },
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
        element
      )
    );
  });
  return collectText(renderer?.toJSON()).join(" ");
};

const renderRoot = async (element: React.ReactElement) => {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 1024, height: 768 },
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
        element
      )
    );
  });
  if (!renderer) throw new Error("Failed to render test component.");
  return renderer;
};

describe("CatalogAuditPanel", () => {
  it("renders catalog coverage and usage summary", async () => {
    const report = buildActivityCatalogAuditReport([
      plan([
        catalogActivity(
          firstFamily.id,
          firstVariant.id,
          firstVariant.name,
          "2026-06-15T09:00:00.000Z"
        ),
        catalogActivity(
          blockFamily.id,
          blockVariant.id,
          blockVariant.name,
          "2026-06-15T10:00:00.000Z"
        ),
      ]),
    ]);

    const text = await renderText(
      React.createElement(CatalogAuditPanel, {
        report,
        loading: false,
        error: null,
        onRefresh: jest.fn(),
      })
    );

    expect(text).toContain("Resumo executivo");
    expect(text).toContain("Alta prioridade");
    expect(text).toContain("Nunca usadas");
    expect(text).toContain("Referências antigas");
    expect(text).toContain("Centro de ação do Catálogo");
    expect(text).toContain("Insights do Catálogo");
    expect(text).toContain("Transforme cobertura e uso do catálogo");
    expect(text).toContain("Cobertura por fundamento");
    expect(text).toContain("Bloqueio");
    expect(text).toContain("Variantes mais usadas");
    expect(text).toContain(firstVariant.name);
    expect(text).toContain(blockVariant.name);
    expect(text).toContain("Variantes nunca usadas");
    expect(text).toContain("Referências desconhecidas");
    expect(text).toContain("Nenhuma referência desconhecida encontrada.");
  });

  it("renders unknown catalog references without exposing raw internal JSON", async () => {
    const invalidActivity = {
      name: "Atividade antiga",
      catalog: {
        source: "externalCatalog",
        familyId: firstFamily.id,
        variantId: firstVariant.id,
        addedAt: "2026-06-15T09:00:00.000Z",
      },
    } as unknown as TrainingPlanActivity;
    const report = buildActivityCatalogAuditReport([plan([invalidActivity])]);

    const text = await renderText(
      React.createElement(CatalogAuditPanel, {
        report,
        loading: false,
        error: null,
        onRefresh: jest.fn(),
      })
    );

    expect(text).toContain("invalidCatalogSource");
    expect(text).toContain("Atividade antiga");
    expect(text).not.toContain('"source"');
    expect(text).not.toContain("decisionTrace");
  });

  it("renders insight cards and filters by priority", async () => {
    const invalidActivity = {
      name: "Atividade antiga",
      catalog: {
        source: "externalCatalog",
        familyId: firstFamily.id,
        variantId: firstVariant.id,
        addedAt: "2026-06-15T09:00:00.000Z",
      },
    } as unknown as TrainingPlanActivity;
    const auditReport = buildActivityCatalogAuditReport([plan([invalidActivity])]);
    const insightReport = buildActivityCatalogInsights(auditReport, {
      now: "2026-06-16T00:00:00.000Z",
      maxInsights: 20,
    });
    const renderer = await renderRoot(
      React.createElement(CatalogAuditInsightsPanel, {
        report: insightReport,
        auditReport,
      })
    );

    expect(collectText(renderer.toJSON()).join(" ")).toContain(
      "Referências antigas encontradas"
    );
    expect(collectText(renderer.toJSON()).join(" ")).toContain("Copiar relatório Markdown");
    expect(collectText(renderer.toJSON()).join(" ")).toContain("Copiar JSON");
    expect(collectText(renderer.toJSON()).join(" ")).toContain("Ver detalhes");
    expect(collectText(renderer.toJSON()).join(" ")).toContain("Copiar ação");
    expect(collectText(renderer.toJSON()).join(" ")).toContain("Evidências");
    expect(collectText(renderer.toJSON()).join(" ")).toContain("Ações sugeridas");
    expect(collectText(renderer.toJSON()).join(" ")).toContain(
      "Uso do catálogo ainda sem linha histórica"
    );

    const highFilter = renderer.root.findByProps({
      accessibilityLabel: "Filtrar insights: Alta",
    });
    await act(async () => {
      highFilter.props.onPress();
    });

    const filteredText = collectText(renderer.toJSON()).join(" ");
    expect(filteredText).toContain("Referências antigas encontradas");
    expect(filteredText).not.toContain("Uso do catálogo ainda sem linha histórica");
  });

  it("opens insight details and copies report/action content", async () => {
    const auditReport = buildActivityCatalogAuditReport([
      plan([
        catalogActivity(
          firstFamily.id,
          firstVariant.id,
          firstVariant.name,
          "2026-06-15T09:00:00.000Z"
        ),
      ]),
    ]);
    const insightReport = buildActivityCatalogInsights(auditReport, {
      now: "2026-06-16T00:00:00.000Z",
      maxInsights: 20,
    });
    const renderer = await renderRoot(
      React.createElement(CatalogAuditInsightsPanel, {
        report: insightReport,
        auditReport,
      })
    );
    const targetInsight = insightReport.insights[0];

    const detailButton = renderer.root.findByProps({
      accessibilityLabel: `Ver detalhes: ${targetInsight.title}`,
    });
    await act(async () => {
      detailButton.props.onPress();
    });

    const detailText = collectText(renderer.toJSON()).join(" ");
    expect(detailText).toContain("Evidências completas");
    expect(detailText).toContain("Escopo");
    expect(detailText).toContain("Variantes relacionadas");

    const copyMarkdown = renderer.root.findByProps({
      accessibilityLabel: "Copiar relatório Markdown",
    });
    await act(async () => {
      await copyMarkdown.props.onPress();
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining("# Relatório de Auditoria do Catálogo GoAtleta")
    );

    const copyAction = renderer.root.findByProps({
      accessibilityLabel: `Copiar ação: ${targetInsight.title}`,
    });
    await act(async () => {
      await copyAction.props.onPress();
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining("# Ação sugerida - Catálogo GoAtleta")
    );
  });

  it("renders insight empty state", async () => {
    const insightReport = buildActivityCatalogInsights(
      {
        coverage: {
          totalFamilies: 1,
          totalVariants: 3,
          bySkill: {
            passe: { total: 3, variantIds: ["v1", "v2", "v3"], familyIds: ["f1"] },
            levantamento: { total: 3, variantIds: ["v4", "v5", "v6"], familyIds: ["f2"] },
            ataque: { total: 3, variantIds: ["v7", "v8", "v9"], familyIds: ["f3"] },
            bloqueio: { total: 3, variantIds: ["v10", "v11", "v12"], familyIds: ["f4"] },
            defesa: { total: 3, variantIds: ["v13", "v14", "v15"], familyIds: ["f5"] },
            saque: { total: 3, variantIds: ["v16", "v17", "v18"], familyIds: ["f6"] },
            transicao: { total: 3, variantIds: ["v19", "v20", "v21"], familyIds: ["f7"] },
          },
          byFamily: {},
          byAgeRange: {},
          byRecommendedPhase: {},
          byComplexity: {},
          criticalGaps: [],
        },
        usage: {
          totalCatalogActivitiesUsed: 7,
          totalPlansScanned: 2,
          totalBlocksScanned: 6,
          byVariantId: {},
          byFamilyId: {},
          bySkill: {
            passe: { count: 1, planIds: ["p1"] },
            levantamento: { count: 1, planIds: ["p1"] },
            ataque: { count: 1, planIds: ["p1"] },
            bloqueio: { count: 1, planIds: ["p2"] },
            defesa: { count: 1, planIds: ["p2"] },
            saque: { count: 1, planIds: ["p2"] },
            transicao: { count: 1, planIds: ["p2"] },
          },
          mostUsedVariants: [],
          unusedVariants: [],
          unknownCatalogReferences: [],
        },
      },
      { maxInsights: 20 }
    );

    expect(
      await renderText(
        React.createElement(CatalogAuditInsightsPanel, {
          report: insightReport,
          auditReport: {
            coverage: {
              totalFamilies: 1,
              totalVariants: 3,
              bySkill: {},
              byFamily: {},
              byAgeRange: {},
              byRecommendedPhase: {},
              byComplexity: {},
              criticalGaps: [],
            },
            usage: {
              totalCatalogActivitiesUsed: 7,
              totalPlansScanned: 2,
              totalBlocksScanned: 6,
              byVariantId: {},
              byFamilyId: {},
              bySkill: {},
              mostUsedVariants: [],
              unusedVariants: [],
              unknownCatalogReferences: [],
            },
          },
        })
      )
    ).toContain("Nenhum insight crítico encontrado.");
  });

  it("renders loading and error states", async () => {
    expect(
      await renderText(
        React.createElement(CatalogAuditPanel, {
          report: null,
          loading: true,
          error: null,
          onRefresh: jest.fn(),
        })
      )
    ).toContain("Carregando planos e cobertura do catálogo");

    expect(
      await renderText(
        React.createElement(CatalogAuditPanel, {
          report: null,
          loading: false,
          error: "Falha controlada",
          onRefresh: jest.fn(),
        })
      )
    ).toContain("Falha controlada");
  });
});
