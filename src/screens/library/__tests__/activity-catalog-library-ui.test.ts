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

  it("renders catalog activities, context message and public metadata", async () => {
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
    expect(text).not.toContain("decisionTrace");
    expect(text).not.toContain("sourcePatternId");

    act(() => {
      root.findByProps({ testID: `activity-catalog-card-${firstVariant.id}` }).props.onPress();
    });

    const detailText = collectRenderedText(root);
    expect(detailText).toContain("Objetivo pedagógico");
    expect(detailText).toContain("Organização");
    expect(detailText).toContain("Metadados");
    expect(detailText).toContain("Sugerido porque");
    expect(detailText).not.toContain("decisionTrace");
    expect(detailText).not.toContain("sourcePatternId");
  });

  it("keeps catalog cards compact and advanced filters hidden until requested", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCatalogTab();
    });

    const root = tree!.root;
    expect(collectRenderedText(root)).toContain("Mais filtros");

    const items = buildActivityCatalogListItems();
    expect(getActivityCatalogCardChips(items[0])).toHaveLength(3);

    act(() => {
      root.findByProps({ testID: "catalog-toggle-advanced-filters" }).props.onPress();
    });

    expect(collectRenderedText(root)).toContain("Família");
    expect(collectRenderedText(root)).toContain("Idade/estágio");
  });

  it("shows empty state when filters have no coverage", async () => {
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

    const text = collectRenderedText(root);
    expect(text).toContain("Nenhuma atividade encontrada para os filtros selecionados.");
  });

  it("marks use in plan only as local transient selection", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCatalogTab();
    });

    const root = tree!.root;
    const firstVariant = ACTIVITY_CATALOG_FAMILIES[0].variants[0];

    act(() => {
      root.findByProps({ testID: `activity-catalog-card-${firstVariant.id}` }).props.onPress();
    });
    act(() => {
      root.findByProps({ testID: "activity-catalog-use-in-plan" }).props.onPress();
    });

    const text = collectRenderedText(root);
    expect(text).toContain(
      "A atividade foi marcada como sugestão local. O plano não foi alterado."
    );
    expect(text).toContain("Levar como sugestão");
    expect(text).not.toContain("TrainingPlan.pedagogy.blocks");
    expect(text).not.toContain("DailyLessonPlan");
    expect(text).not.toContain("decisionTrace");
  });
});
