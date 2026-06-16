import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { TrainingPlan, TrainingPlanActivity } from "../../../core/models";
import { ACTIVITY_CATALOG_FAMILIES } from "../../../core/volleyball/activity-catalog";
import { buildActivityCatalogAuditReport } from "../../../core/volleyball/activity-catalog-audit";
import { CatalogAuditPanel } from "../CatalogAuditPanel";

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
    renderer = TestRenderer.create(element);
  });
  return collectText(renderer?.toJSON()).join(" ");
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

    expect(text).toContain("Auditoria do Catálogo");
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
