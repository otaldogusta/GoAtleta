import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TestRenderer, { act } from "react-test-renderer";

import { ACTIVITY_CATALOG_FAMILIES } from "../../../core/volleyball/activity-catalog";
import type { ClassGroup, TrainingPlan } from "../../../core/models";
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
import {
  ACTIVITY_CATALOG_THUMBNAILS,
  getCatalogActivityThumbnailKey,
  resolveActivityCatalogThumbnail,
} from "../activity-catalog-media";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockSaveTrainingPlan = jest.fn();
const mockGetLatestTrainingPlanByClass = jest.fn();
const localTodayIso = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const mockClass: ClassGroup = {
  id: "class_sub13",
  name: "Turma Sub-13",
  organizationId: "org_1",
  unit: "Unidade",
  unitId: "unit_1",
  colorKey: "green",
  modality: "voleibol",
  ageBand: "12-13",
  gender: "misto",
  startTime: "18:00",
  endTime: "19:00",
  durationMinutes: 60,
  daysOfWeek: [1, 3],
  daysPerWeek: 2,
  goal: "Fundamentos",
  equipment: "quadra",
  level: 2,
  mvLevel: "base",
  cycleStartDate: "2026-06-01",
  cycleLengthWeeks: 12,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-06-01T00:00:00.000Z",
};
const mockPlan: TrainingPlan = {
  id: "plan_today",
  classId: mockClass.id,
  title: "Aula do dia",
  tags: [],
  warmup: [],
  main: ["Atividade existente"],
  cooldown: [],
  warmupTime: "10",
  mainTime: "40",
  cooldownTime: "10",
  applyDays: [],
  applyDate: localTodayIso(),
  createdAt: "2026-06-14T09:00:00.000Z",
  version: 2,
  status: "final",
  origin: "manual",
  pedagogy: {
    focus: { skill: "passe" },
    blocks: {
      warmup: { summary: "", activities: [] },
      main: { summary: "", activities: [{ name: "Atividade existente" }] },
      cooldown: { summary: "", activities: [] },
    },
  },
};

jest.mock("../../../db/seed", () => ({
  getClasses: jest.fn(async () => [mockClass]),
  getTrainingPlans: jest.fn(async (options?: { applyDate?: string }) =>
    options?.applyDate ? [mockPlan] : [mockPlan]
  ),
  getLatestTrainingPlanByClass: (...args: unknown[]) => mockGetLatestTrainingPlanByClass(...args),
  saveTrainingPlan: (...args: unknown[]) => mockSaveTrainingPlan(...args),
}));

jest.mock("../../../../assets/activity-catalog/thumbnails/continuity.png", () => 1);
jest.mock("../../../../assets/activity-catalog/thumbnails/defense-coverage.png", () => 2);
jest.mock("../../../../assets/activity-catalog/thumbnails/attack-transition.png", () => 3);
jest.mock("../../../../assets/activity-catalog/thumbnails/sideout.png", () => 4);
jest.mock("../../../../assets/activity-catalog/thumbnails/serve-reception.png", () => 5);
jest.mock("../../../../assets/activity-catalog/thumbnails/preventive-strength.png", () => 6);
jest.mock("../../../../assets/activity-catalog/thumbnails/transition.png", () => 7);
jest.mock("../../../../assets/activity-catalog/thumbnails/block-coverage.png", () => 8);
jest.mock("../../../../assets/activity-catalog/thumbnails/serve-pressure.png", () => 9);
jest.mock("../../../../assets/activity-catalog/thumbnails/second-contact.png", () => 10);
jest.mock("../../../../assets/activity-catalog/thumbnails/attack-coverage.png", () => 11);
jest.mock("../../../../assets/activity-catalog/thumbnails/out-of-system.png", () => 12);
jest.mock("../../../../assets/activity-catalog/thumbnails/generic-court.png", () => 13);

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLatestTrainingPlanByClass.mockResolvedValue(mockPlan);
  });

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

    (["bloqueio", "ataque", "saque", "levantamento", "defesa", "transicao"] as const).forEach(
      (skill) => {
        const filtered = filterActivityCatalogItems(items, {
          ...EMPTY_CATALOG_FILTERS,
          skill,
        });
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((item) => item.variant.taxonomy.skill === skill)).toBe(true);
      }
    );

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

  it("resolves catalog thumbnails from visual profile with local fallback", () => {
    const items = buildActivityCatalogListItems();
    const sideout = items.find((item) => item.variant.id === "catalog-sideout-game");
    const block = items.find((item) => item.family.id === "bloqueio_cobertura_rede");
    const fallbackItem = {
      ...items[0],
      family: { ...items[0].family, visualProfile: undefined },
      variant: { ...items[0].variant, visualProfile: undefined },
    };

    expect(ACTIVITY_CATALOG_THUMBNAILS.genericCourt).toBe(13);
    expect(getCatalogActivityThumbnailKey(sideout!)).toBe("sideout");
    expect(getCatalogActivityThumbnailKey(block!)).toBe("blockCoverage");
    expect(getCatalogActivityThumbnailKey(fallbackItem as any)).toBe("genericCourt");
    expect(resolveActivityCatalogThumbnail(undefined)).toBe(ACTIVITY_CATALOG_THUMBNAILS.genericCourt);
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
    expect(root.findByProps({ testID: `activity-catalog-add-${firstVariant.id}` })).toBeTruthy();
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
    expect(detailText).toContain("Descrição");
    expect(detailText).toContain(ACTIVITY_CATALOG_FAMILIES[0].purpose);
    expect(detailText).toContain("Orientações da atividade");
    expect(detailText).toContain("Adicionar à aula");
    expect(detailText).toContain("Detalhes técnicos");
    expect(detailText).not.toContain("Como aplicar");
    expect(detailText).not.toContain("Funcionamento");
    expect(detailText).not.toContain("Progressão");
    expect(detailText).not.toContain("Cuidados");
    expect(detailText).not.toContain("Demanda cognitiva");
    expect(detailText).not.toContain("Periodização");
    expect(detailText).not.toContain("raw score");
    expect(detailText).not.toContain("decisionTrace");
    expect(detailText).not.toContain("sourcePatternId");

    act(() => {
      root.findByProps({ testID: "activity-catalog-toggle-guidance" }).props.onPress();
    });

    const expandedDetailText = collectRenderedText(root);
    expect(expandedDetailText).toContain("Como aplicar");
    expect(expandedDetailText).toContain("Funcionamento");
    expect(expandedDetailText).toContain("Progressão");
    expect(expandedDetailText).toContain("Cuidados");
  });

  it("adds an activity to a selected lesson only after explicit confirmation", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCatalogTab();
    });

    const root = tree!.root;
    const firstVariant = ACTIVITY_CATALOG_FAMILIES[0].variants[0];

    await act(async () => {
      root.findByProps({ testID: `activity-catalog-add-${firstVariant.id}` }).props.onPress();
    });

    expect(collectRenderedText(root)).toContain("Adicionar à aula");
    expect(collectRenderedText(root)).toContain("Para qual aula você quer adicionar");
    expect(collectRenderedText(root)).toContain("Aula de hoje · Turma Sub-13");
    expect(collectRenderedText(root)).toContain("Escolher outro plano");
    expect(mockSaveTrainingPlan).not.toHaveBeenCalled();

    await act(async () => {
      root.findByProps({ testID: "activity-catalog-confirm-add" }).props.onPress();
    });

    const text = collectRenderedText(root);
    expect(mockSaveTrainingPlan).toHaveBeenCalledTimes(1);
    const [savedPlan] = mockSaveTrainingPlan.mock.calls[0];
    const savedActivities = [
      ...savedPlan.pedagogy.blocks.warmup.activities,
      ...savedPlan.pedagogy.blocks.main.activities,
      ...savedPlan.pedagogy.blocks.cooldown.activities,
    ];
    expect(savedActivities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: firstVariant.name,
          primarySkill: firstVariant.taxonomy.skill,
          catalog: {
            source: "goAtletaCatalog",
            familyId: ACTIVITY_CATALOG_FAMILIES[0].id,
            variantId: firstVariant.id,
            addedAt: expect.any(String),
          },
        }),
      ])
    );

    mockGetLatestTrainingPlanByClass.mockResolvedValue(savedPlan);
    await act(async () => {
      root.findByProps({ testID: `activity-catalog-add-${firstVariant.id}` }).props.onPress();
    });
    await act(async () => {
      root.findByProps({ testID: "activity-catalog-confirm-add" }).props.onPress();
    });

    expect(mockSaveTrainingPlan).toHaveBeenCalledTimes(1);
    expect(collectRenderedText(root)).toContain("Esta atividade já está na aula");
    expect(text).toContain("Atividade adicionada");
    expect(text).not.toContain("sugestão local");
    expect(text).not.toContain("decisionTrace");
  });
});
