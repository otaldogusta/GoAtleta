import type {
  VolleyballSkill,
} from "../../core/models";
import {
  ACTIVITY_CATALOG_FAMILIES,
  type ActivityCatalogComplexity,
  type ActivityCatalogEnvironment,
  type ActivityCatalogFamily,
  type ActivityCatalogFormat,
  type ActivityCatalogVariant,
} from "../../core/volleyball/activity-catalog";
import type {
  ActivityPatternAgeStage,
  ActivityPatternStage,
} from "../../core/volleyball/activity-pattern-engine";
import {
  ageStageLabels,
  complexityLabels,
  demandLabels,
  environmentLabels,
  formatLabels,
  gamePhaseLabels,
  getActivityCatalogFamilyLabel,
  pedagogicalIntentLabels,
  phaseIntentLabels,
  phaseLabels,
  progressionLabels,
  skillLabels,
} from "./activity-catalog-labels";

export type CatalogFilterState = {
  query: string;
  familyId: string;
  skill: VolleyballSkill | "";
  ageStage: ActivityPatternAgeStage | "";
  complexity: ActivityCatalogComplexity | "";
  recommendedPhase: ActivityPatternStage | "";
  format: ActivityCatalogFormat | "";
  environment: ActivityCatalogEnvironment | "";
};

export type ActivityCatalogListItem = {
  id: string;
  family: ActivityCatalogFamily;
  variant: ActivityCatalogVariant;
  familyTitle: string;
  familyLabel: string;
  title: string;
  purpose: string;
  searchableText: string;
};

export type SelectedCatalogActivity = {
  variantId: string;
  variantName: string;
  familyTitle: string;
};

export type CatalogActivityDetailSection = {
  title: string;
  lines: string[];
};

export type CatalogFilterOptions = {
  families: Array<{ id: string; label: string }>;
  skills: VolleyballSkill[];
  ageStages: ActivityPatternAgeStage[];
  complexities: ActivityCatalogComplexity[];
  recommendedPhases: ActivityPatternStage[];
  formats: ActivityCatalogFormat[];
  environments: ActivityCatalogEnvironment[];
};

export const EMPTY_CATALOG_FILTERS: CatalogFilterState = {
  query: "",
  familyId: "",
  skill: "",
  ageStage: "",
  complexity: "",
  recommendedPhase: "",
  format: "",
  environment: "",
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const joinLabels = (values: string[]) => values.filter(Boolean).join(" ");

export const getActivityCatalogCardChips = (item: ActivityCatalogListItem) => {
  const taxonomy = item.variant.taxonomy;
  return [
    skillLabels[taxonomy.skill],
    phaseLabels[taxonomy.recommendedPhase],
    complexityLabels[taxonomy.complexity],
  ].filter(Boolean).slice(0, 3);
};

export const getActivityCatalogSecondaryMeta = (item: ActivityCatalogListItem) => {
  const taxonomy = item.variant.taxonomy;
  return [
    formatLabels[taxonomy.format],
    pedagogicalIntentLabels[taxonomy.pedagogicalIntent],
    taxonomy.ageRange.map((ageStage) => ageStageLabels[ageStage]).join("/"),
    ].filter(Boolean).join(" · ");
};

export const getCatalogActivityPrimaryBadge = (item: ActivityCatalogListItem) =>
  skillLabels[item.variant.taxonomy.skill];

export const getCatalogActivityShortFamilyLabel = (item: ActivityCatalogListItem) =>
  item.familyLabel;

export const getCatalogActivityDetailSections = (
  item: ActivityCatalogListItem
): CatalogActivityDetailSection[] => {
  const { variant } = item;
  return [
    {
      title: "Objetivo",
      lines: [item.purpose],
    },
    {
      title: "Como aplicar",
      lines: [variant.players, variant.setup],
    },
    {
      title: "Funcionamento",
      lines: [variant.starter, variant.action, variant.rotation],
    },
    {
      title: "Progressão",
      lines: [variant.constraint, variant.scoring, variant.progression].filter(Boolean) as string[],
    },
    {
      title: "Cuidados",
      lines: [
        ...(variant.commonMistakes ?? []),
        ...(variant.avoid ?? []),
      ],
    },
    {
      title: "Materiais e espaço",
      lines: [
        `Materiais: ${variant.materials.join(", ") || "Sem material obrigatório"}`,
        `Espaço: ${variant.space}`,
      ],
    },
  ].filter((section) => section.lines.length > 0);
};

export const buildActivityCatalogListItems = (
  families: ActivityCatalogFamily[] = ACTIVITY_CATALOG_FAMILIES
): ActivityCatalogListItem[] =>
  families.flatMap((family) =>
    family.variants.map((variant) => {
      const taxonomy = variant.taxonomy;
      const familyLabel = getActivityCatalogFamilyLabel(family.id, family.title);
      const labels = [
        familyLabel,
        skillLabels[taxonomy.skill],
        gamePhaseLabels[taxonomy.gamePhase],
        pedagogicalIntentLabels[taxonomy.pedagogicalIntent],
        complexityLabels[taxonomy.complexity],
        formatLabels[taxonomy.format],
        environmentLabels[taxonomy.environment],
        demandLabels[taxonomy.cognitiveDemand],
        demandLabels[taxonomy.physicalDemand],
        phaseLabels[taxonomy.recommendedPhase],
        ...taxonomy.ageRange.map((ageStage) => ageStageLabels[ageStage]),
        ...taxonomy.periodizationCompatibility.map((phase) => phaseIntentLabels[phase]),
        ...taxonomy.progressionCompatibility.map((progression) => progressionLabels[progression]),
        ...variant.materials,
      ];
      const searchableText = normalize(
        joinLabels([
          family.title,
          family.purpose,
          variant.name,
          variant.players,
          variant.setup,
          variant.starter,
          variant.action,
          variant.rotation,
          variant.constraint ?? "",
          variant.scoring ?? "",
          variant.progression ?? "",
          variant.space,
          ...labels,
          ...(variant.commonMistakes ?? []),
          ...(variant.adaptations ?? []),
          ...(variant.avoid ?? []),
        ])
      );

      return {
        id: variant.id,
        family,
        variant,
        familyTitle: family.title,
        familyLabel,
        title: variant.name,
        purpose: family.purpose,
        searchableText,
      };
    })
  );

export const getCatalogFilterOptions = (
  items: ActivityCatalogListItem[]
): CatalogFilterOptions => {
  const byLabel = <T extends string>(
    values: T[],
    labels: Record<T, string>
  ) => Array.from(new Set(values)).sort((a, b) => labels[a].localeCompare(labels[b]));

  return {
    families: Array.from(
      new Map(items.map((item) => [item.family.id, item.familyLabel])).entries()
    )
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    skills: byLabel(
      items.map((item) => item.variant.taxonomy.skill),
      skillLabels
    ),
    ageStages: byLabel(
      items.flatMap((item) => item.variant.taxonomy.ageRange),
      ageStageLabels
    ),
    complexities: byLabel(
      items.map((item) => item.variant.taxonomy.complexity),
      complexityLabels
    ),
    recommendedPhases: byLabel(
      items.map((item) => item.variant.taxonomy.recommendedPhase),
      phaseLabels
    ),
    formats: byLabel(
      items.map((item) => item.variant.taxonomy.format),
      formatLabels
    ),
    environments: byLabel(
      items.map((item) => item.variant.taxonomy.environment),
      environmentLabels
    ),
  };
};

export const hasActiveCatalogFilters = (filters: CatalogFilterState) =>
  Boolean(
    filters.query.trim() ||
      filters.familyId ||
      filters.skill ||
      filters.ageStage ||
      filters.complexity ||
      filters.recommendedPhase ||
      filters.format ||
      filters.environment
  );

export const filterActivityCatalogItems = (
  items: ActivityCatalogListItem[],
  filters: CatalogFilterState
) => {
  const query = normalize(filters.query.trim());
  return items.filter((item) => {
    const taxonomy = item.variant.taxonomy;
    if (query && !item.searchableText.includes(query)) return false;
    if (filters.familyId && item.family.id !== filters.familyId) return false;
    if (filters.skill && taxonomy.skill !== filters.skill) return false;
    if (filters.ageStage && !taxonomy.ageRange.includes(filters.ageStage)) return false;
    if (filters.complexity && taxonomy.complexity !== filters.complexity) return false;
    if (filters.recommendedPhase && taxonomy.recommendedPhase !== filters.recommendedPhase) return false;
    if (filters.format && taxonomy.format !== filters.format) return false;
    if (filters.environment && taxonomy.environment !== filters.environment) return false;
    return true;
  });
};

export const toSelectedCatalogActivity = (
  item: ActivityCatalogListItem
): SelectedCatalogActivity => ({
  variantId: item.variant.id,
  variantName: item.variant.name,
  familyTitle: item.familyTitle,
});
