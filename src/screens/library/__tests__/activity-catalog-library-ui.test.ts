import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TestRenderer, { act } from "react-test-renderer";

import { ACTIVITY_CATALOG_FAMILIES } from "../../../core/volleyball/activity-catalog";
import { ActivityCatalogTab } from "../ActivityCatalogTab";
import {
  getActivityCatalogFamilyLabel,
} from "../activity-catalog-labels";
import {
  EMPTY_CATALOG_FILTERS,
  buildActivityCatalogListItems,
  filterActivityCatalogItems,
  getActivityCatalogCardChips,
  getCatalogFilterOptions,
} from "../activity-catalog-view-model";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("../../../../assets/activity-catalog/thumbnails/continuity.png", () => 1);
jest.mock("../../../../assets/activity-catalog/thumbnails/defense-coverage.png", () => 2);
jest.mock("../../../../assets/activity-catalog/thumbnails/attack-transition.png", () => 3);
jest.mock("../../../../assets/activity-catalog/thumbnails/sideout.png", () => 4);
jest.mock("../../../../assets/activity-catalog/thumbnails/serve-reception.png", () => 5);
jest.mock("../../../../assets/activity-catalog/thumbnails/preventive-strength.png", () => 6);
jest.mock("../../../../assets/activity-catalog/thumbnails/transition.png", () => 7);
jest.mock("../../../../assets/activity-catalog/thumbnails/generic-court.png", () => 8);

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const renderCatalogTab = () =>
  TestRenderer.create(
    React.createElement(
      SafeAreaProvider,
      { initialMetrics: safeAreaMetrics },
      React.createElement(ActivityCatalogTab)
    )
  );

const collectChildrenText = (value: unknown): string[] => {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectChildrenText);
  return [];
};

const collectRenderedText = (root: TestRenderer.ReactTestInstance) =>
  root
    .findAll(() => true)
    .flatMap((node) => collectChildrenText(node.props.children))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");

describe("activity catalog library ui", () => {
  it("builds list items from catalog families and filters by public fields", () => {
    const items = buildActivityCatalogListItems();
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    const options = getCatalogFilterOptions(items);
    expect(options.families.some((family) => family.id === first.family.id)).toBe(true);

    expect(
      filterActivityCatalogItems(items, {
        ...EMPTY_CATALOG_FILTERS,
        query: first.variant.name.slice(0, 5),
      }).some((item) => item.id === first.id)
    ).toBe(true);

    expect(
      filterActivityCatalogItems(items, {
        ...EMPTY_CATALOG_FILTERS,
        familyId: first.family.id,
      }).every((item) => item.family.id === first.family.id)
    ).toBe(true);

    expect(
      filterActivityCatalogItems(items, {
        ...EMPTY_CATALOG_FILTERS,
        skill: first.variant.taxonomy.skill,
      }).every((item) => item.variant.taxonomy.skill === first.variant.taxonomy.skill)
    ).toBe(true);

    expect(
      filterActivityCatalogItems(items, {
        ...EMPTY_CATALOG_FILTERS,
        ageStage: first.variant.taxonomy.ageRange[0],
      }).every((item) =>
        item.variant.taxonomy.ageRange.includes(first.variant.taxonomy.ageRange[0])
      )
    ).toBe(true);

    expect(
      filterActivityCatalogItems(items, {
        ...EMPTY_CATALOG_FILTERS,
        complexity: first.variant.taxonomy.complexity,
        recommendedPhase: first.variant.taxonomy.recommendedPhase,
        format: first.variant.taxonomy.format,
        environment: first.variant.taxonomy.environment,
      }).length
    ).toBeGreaterThan(0);
  });

  it("renders video-first catalog cards with thumbnail, CTA and local plus action", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCatalogTab();
    });

    const root = tree!.root;
    const text = collectRenderedText(root);
    const firstFamily = ACTIVITY_CATALOG_FAMILIES[0];
    const firstVariant = firstFamily.variants[0];

    expect(text).toContain("Catálogo geral");
    expect(text).toContain(getActivityCatalogFamilyLabel(firstFamily.id, firstFamily.title));
    expect(text).toContain(firstVariant.name);
    expect(text).toContain("Ver atividade");
    expect(root.findByProps({ testID: `activity-catalog-video-card-${firstVariant.id}` })).toBeTruthy();
    expect(root.findAllByProps({ testID: "activity-catalog-thumbnail" }).length).toBeGreaterThan(0);
    expect(root.findByProps({ testID: `activity-catalog-suggest-${firstVariant.id}` })).toBeTruthy();
    expect(text).not.toContain(firstVariant.setup);
    expect(text).not.toContain(firstVariant.progression ?? "progression unavailable");
    expect(text).not.toContain("decisionTrace");
    expect(text).not.toContain("sourcePatternId");
  });

  it("keeps advanced filters closed by default and applies them from the sheet", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCatalogTab();
    });

    const root = tree!.root;
    const firstFamily = ACTIVITY_CATALOG_FAMILIES[0];
    expect(collectRenderedText(root)).toContain("Filtros");
    expect(collectRenderedText(root)).not.toContain("Idade/estágio");

    act(() => {
      root.findByProps({ testID: "catalog-open-filters" }).props.onPress();
    });

    expect(collectRenderedText(root)).toContain("Família");
    expect(collectRenderedText(root)).toContain("Idade/estágio");
    expect(collectRenderedText(root)).toContain("Aplicar filtros");
    expect(collectRenderedText(root)).toContain("Limpar filtros");

    act(() => {
      root.findByProps({ testID: `catalog-family-filter-${firstFamily.id}` }).props.onPress();
    });
    act(() => {
      root.findByProps({ testID: "catalog-filter-apply" }).props.onPress();
    });

    const filteredText = collectRenderedText(root);
    expect(filteredText).toContain(firstFamily.variants[0].name);
  });

  it("limits card badges and shows empty state when filters have no coverage", async () => {
    const items = buildActivityCatalogListItems();
    expect(getActivityCatalogCardChips(items[0]).length).toBeLessThanOrEqual(3);

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCatalogTab();
    });

    const root = tree!.root;
    act(() => {
      root.findByProps({ testID: "catalog-search-input" }).props.onChangeText(
        "atividade inexistente sem cobertura"
      );
    });

    expect(collectRenderedText(root)).toContain(
      "Nenhuma atividade encontrada para os filtros selecionados."
    );
  });

  it("opens video detail with public sections and technical details collapsed", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCatalogTab();
    });

    const root = tree!.root;
    const firstVariant = ACTIVITY_CATALOG_FAMILIES[0].variants[0];

    act(() => {
      root.findByProps({ testID: `activity-catalog-view-${firstVariant.id}` }).props.onPress();
    });

    const detailText = collectRenderedText(root);
    expect(root.findAllByProps({ testID: "activity-catalog-thumbnail" }).length).toBeGreaterThan(0);
    expect(detailText).toContain("Objetivo");
    expect(detailText).toContain("Como aplicar");
    expect(detailText).toContain("Funcionamento");
    expect(detailText).toContain("Progressão");
    expect(detailText).toContain("Cuidados");
    expect(detailText).toContain("Levar como sugestão");
    expect(detailText).toContain("Detalhes técnicos");
    expect(detailText).not.toContain("Demanda cognitiva");
    expect(detailText).not.toContain("Periodização");
    expect(detailText).not.toContain("raw score");
    expect(detailText).not.toContain("decisionTrace");
    expect(detailText).not.toContain("sourcePatternId");
  });

  it("marks use in plan only as a confirmed transient selection", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCatalogTab();
    });

    const root = tree!.root;
    const firstVariant = ACTIVITY_CATALOG_FAMILIES[0].variants[0];

    act(() => {
      root.findByProps({ testID: `activity-catalog-suggest-${firstVariant.id}` }).props.onPress();
    });

    expect(collectRenderedText(root)).toContain("Levar atividade como sugestão?");
    expect(collectRenderedText(root)).toContain(
      "O plano não será alterado automaticamente."
    );

    act(() => {
      root.findByProps({ testID: "activity-catalog-confirm-suggestion" }).props.onPress();
    });

    const text = collectRenderedText(root);
    expect(text).toContain("Sugestão preparada");
    expect(text).toContain("O plano não foi alterado.");
    expect(text).not.toContain("TrainingPlan.pedagogy.blocks");
    expect(text).not.toContain("DailyLessonPlan");
    expect(text).not.toContain("decisionTrace");
  });
});
