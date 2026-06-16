import type { TrainingPlan, TrainingPlanActivity, VolleyballSkill } from "../models";
import type { ActivityPatternAgeStage, ActivityPatternStage } from "./activity-pattern-engine";
import {
  ACTIVITY_CATALOG_FAMILIES,
  ACTIVITY_CATALOG_VARIANTS,
  type ActivityCatalogComplexity,
  type ActivityCatalogFamily,
  type ActivityCatalogVariant,
} from "./activity-catalog";

export type ActivityCatalogCoverageBucket = {
  total: number;
  variantIds: string[];
  familyIds: string[];
};

export type ActivityCatalogCoverageGapSeverity = "low" | "medium" | "high";

export type ActivityCatalogCoverageGap = {
  kind:
    | "missingSkill"
    | "lowSkillCoverage"
    | "missingAgeRange"
    | "missingRecommendedPhase"
    | "missingComplexity"
    | "missingFamilyMedia";
  severity: ActivityCatalogCoverageGapSeverity;
  key: string;
  message: string;
  suggestedAction?: string;
};

export type ActivityCatalogCoverageAudit = {
  totalFamilies: number;
  totalVariants: number;
  bySkill: Record<string, ActivityCatalogCoverageBucket>;
  byFamily: Record<string, ActivityCatalogCoverageBucket>;
  byAgeRange: Record<string, ActivityCatalogCoverageBucket>;
  byRecommendedPhase: Record<string, ActivityCatalogCoverageBucket>;
  byComplexity: Record<string, ActivityCatalogCoverageBucket>;
  criticalGaps: ActivityCatalogCoverageGap[];
};

export type ActivityCatalogUsageBucket = {
  count: number;
  planIds: string[];
  lastUsedAt?: string;
};

export type ActivityCatalogUsageRankItem = {
  variantId: string;
  familyId: string;
  title: string;
  count: number;
  lastUsedAt?: string;
};

export type ActivityCatalogUnusedVariant = {
  variantId: string;
  familyId: string;
  title: string;
  primarySkill: string;
};

export type ActivityCatalogUnknownReference = {
  variantId?: string;
  familyId?: string;
  planId?: string;
  blockId?: string;
  activityName?: string;
  reason: "missingVariant" | "missingFamily" | "invalidCatalogSource";
};

export type ActivityCatalogUsageAudit = {
  totalCatalogActivitiesUsed: number;
  totalPlansScanned: number;
  totalBlocksScanned: number;
  byVariantId: Record<string, ActivityCatalogUsageBucket>;
  byFamilyId: Record<string, ActivityCatalogUsageBucket>;
  bySkill: Record<string, ActivityCatalogUsageBucket>;
  mostUsedVariants: ActivityCatalogUsageRankItem[];
  unusedVariants: ActivityCatalogUnusedVariant[];
  unknownCatalogReferences: ActivityCatalogUnknownReference[];
};

export type ActivityCatalogAuditReport = {
  coverage: ActivityCatalogCoverageAudit;
  usage: ActivityCatalogUsageAudit;
};

const EXPECTED_VOLLEYBALL_SKILLS: VolleyballSkill[] = [
  "passe",
  "levantamento",
  "ataque",
  "bloqueio",
  "defesa",
  "saque",
  "transicao",
];

const EXPECTED_AGE_RANGES: ActivityPatternAgeStage[] = [
  "base",
  "transition",
  "formation",
  "specialization",
];

const EXPECTED_RECOMMENDED_PHASES: ActivityPatternStage[] = ["warmup", "drill", "game"];
const EXPECTED_COMPLEXITIES: ActivityCatalogComplexity[] = ["baixa", "moderada", "alta"];
const BLOCK_KEYS = ["warmup", "main", "cooldown"] as const;

const familyById = new Map(ACTIVITY_CATALOG_FAMILIES.map((family) => [family.id, family]));
const variantEntries = ACTIVITY_CATALOG_FAMILIES.flatMap((family) =>
  family.variants.map((variant) => ({ family, variant }))
);
const variantById = new Map(variantEntries.map((entry) => [entry.variant.id, entry]));

const emptyBucket = (): ActivityCatalogCoverageBucket => ({
  total: 0,
  variantIds: [],
  familyIds: [],
});

const pushUnique = (values: string[], value: string | undefined) => {
  if (value && !values.includes(value)) values.push(value);
};

const addCoverage = (
  buckets: Record<string, ActivityCatalogCoverageBucket>,
  key: string | undefined,
  variantId: string,
  familyId: string
) => {
  if (!key) return;
  const bucket = buckets[key] ?? emptyBucket();
  bucket.total += 1;
  pushUnique(bucket.variantIds, variantId);
  pushUnique(bucket.familyIds, familyId);
  buckets[key] = bucket;
};

const compareIso = (left: string | undefined, right: string | undefined) => {
  if (!left) return right;
  if (!right) return left;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return rightTime > leftTime ? right : left;
  }
  return right > left ? right : left;
};

const addUsage = (
  buckets: Record<string, ActivityCatalogUsageBucket>,
  key: string,
  planId: string,
  usedAt?: string
) => {
  const bucket = buckets[key] ?? { count: 0, planIds: [] };
  bucket.count += 1;
  pushUnique(bucket.planIds, planId);
  bucket.lastUsedAt = compareIso(bucket.lastUsedAt, usedAt);
  buckets[key] = bucket;
};

const hasPedagogyBlocks = (plan: TrainingPlan) => Boolean(plan.pedagogy?.blocks);

const legacyActivities = (
  plan: TrainingPlan,
  blockId: (typeof BLOCK_KEYS)[number]
): TrainingPlanActivity[] => {
  const names = blockId === "warmup" ? plan.warmup : blockId === "main" ? plan.main : plan.cooldown;
  return (names ?? [])
    .map((name) => String(name ?? "").trim())
    .filter(Boolean)
    .map((name) => ({ name }));
};

const getActivitiesForBlock = (
  plan: TrainingPlan,
  blockId: (typeof BLOCK_KEYS)[number]
): TrainingPlanActivity[] => {
  if (!hasPedagogyBlocks(plan)) return legacyActivities(plan, blockId);
  const block = plan.pedagogy?.blocks?.[blockId];
  return (block?.activities ?? []).filter(Boolean);
};

export function findActivityCatalogFamilyById(
  familyId: string
): ActivityCatalogFamily | null {
  return familyById.get(familyId) ?? null;
}

export function findActivityCatalogVariantById(
  variantId: string
): ActivityCatalogVariant | null {
  return variantById.get(variantId)?.variant ?? null;
}

export function auditActivityCatalogCoverage(): ActivityCatalogCoverageAudit {
  const bySkill: Record<string, ActivityCatalogCoverageBucket> = {};
  const byFamily: Record<string, ActivityCatalogCoverageBucket> = {};
  const byAgeRange: Record<string, ActivityCatalogCoverageBucket> = {};
  const byRecommendedPhase: Record<string, ActivityCatalogCoverageBucket> = {};
  const byComplexity: Record<string, ActivityCatalogCoverageBucket> = {};

  variantEntries.forEach(({ family, variant }) => {
    const taxonomy = variant.taxonomy;
    addCoverage(byFamily, family.id, variant.id, family.id);
    addCoverage(bySkill, taxonomy.skill, variant.id, family.id);
    taxonomy.ageRange.forEach((ageRange) =>
      addCoverage(byAgeRange, ageRange, variant.id, family.id)
    );
    addCoverage(byRecommendedPhase, taxonomy.recommendedPhase, variant.id, family.id);
    addCoverage(byComplexity, taxonomy.complexity, variant.id, family.id);
  });

  const criticalGaps: ActivityCatalogCoverageGap[] = [];

  EXPECTED_VOLLEYBALL_SKILLS.forEach((skill) => {
    const total = bySkill[skill]?.total ?? 0;
    if (total === 0) {
      criticalGaps.push({
        kind: "missingSkill",
        severity: "high",
        key: skill,
        message: `Catalogo sem variantes para ${skill}.`,
        suggestedAction: "Adicionar pelo menos uma familia pedagogica para a skill.",
      });
    } else if (total < 3) {
      criticalGaps.push({
        kind: "lowSkillCoverage",
        severity: total === 1 ? "medium" : "low",
        key: skill,
        message: `Catalogo com baixa cobertura para ${skill}: ${total} variante(s).`,
        suggestedAction: "Planejar novas variantes por idade, fase e dificuldade.",
      });
    }
  });

  EXPECTED_AGE_RANGES.forEach((ageRange) => {
    if (!byAgeRange[ageRange]?.total) {
      criticalGaps.push({
        kind: "missingAgeRange",
        severity: "medium",
        key: ageRange,
        message: `Catalogo sem cobertura para faixa ${ageRange}.`,
      });
    }
  });

  EXPECTED_RECOMMENDED_PHASES.forEach((phase) => {
    if (!byRecommendedPhase[phase]?.total) {
      criticalGaps.push({
        kind: "missingRecommendedPhase",
        severity: "medium",
        key: phase,
        message: `Catalogo sem atividades recomendadas para ${phase}.`,
      });
    }
  });

  EXPECTED_COMPLEXITIES.forEach((complexity) => {
    if (!byComplexity[complexity]?.total) {
      criticalGaps.push({
        kind: "missingComplexity",
        severity: "low",
        key: complexity,
        message: `Catalogo sem variantes de complexidade ${complexity}.`,
      });
    }
  });

  ACTIVITY_CATALOG_FAMILIES.forEach((family) => {
    if (!family.visualProfile?.mediaKey) {
      criticalGaps.push({
        kind: "missingFamilyMedia",
        severity: "medium",
        key: family.id,
        message: `Familia ${family.id} sem visualProfile.mediaKey.`,
        suggestedAction: "Associar um mediaKey local ou deixar fallback explicito na camada de UI.",
      });
    }
  });

  return {
    totalFamilies: ACTIVITY_CATALOG_FAMILIES.length,
    totalVariants: ACTIVITY_CATALOG_VARIANTS.length,
    bySkill,
    byFamily,
    byAgeRange,
    byRecommendedPhase,
    byComplexity,
    criticalGaps,
  };
}

export function auditActivityCatalogUsage(plans: TrainingPlan[]): ActivityCatalogUsageAudit {
  const byVariantId: Record<string, ActivityCatalogUsageBucket> = {};
  const byFamilyId: Record<string, ActivityCatalogUsageBucket> = {};
  const bySkill: Record<string, ActivityCatalogUsageBucket> = {};
  const unknownCatalogReferences: ActivityCatalogUnknownReference[] = [];
  let totalCatalogActivitiesUsed = 0;
  let totalBlocksScanned = 0;

  (plans ?? []).forEach((plan) => {
    BLOCK_KEYS.forEach((blockId) => {
      totalBlocksScanned += 1;
      getActivitiesForBlock(plan, blockId).forEach((activity) => {
        const catalog = (activity as TrainingPlanActivity & {
          catalog?: {
            source?: string;
            familyId?: string;
            variantId?: string;
            addedAt?: string;
          };
        }).catalog;
        if (!catalog) return;

        const referenceBase = {
          variantId: catalog.variantId,
          familyId: catalog.familyId,
          planId: plan.id,
          blockId,
          activityName: activity.name,
        };

        if (catalog.source !== "goAtletaCatalog") {
          unknownCatalogReferences.push({
            ...referenceBase,
            reason: "invalidCatalogSource",
          });
          return;
        }

        const variantEntry = catalog.variantId ? variantById.get(catalog.variantId) : undefined;
        const family = catalog.familyId ? familyById.get(catalog.familyId) : undefined;

        if (!variantEntry) {
          unknownCatalogReferences.push({
            ...referenceBase,
            reason: "missingVariant",
          });
          return;
        }

        if (!family) {
          unknownCatalogReferences.push({
            ...referenceBase,
            reason: "missingFamily",
          });
          return;
        }

        totalCatalogActivitiesUsed += 1;
        addUsage(byVariantId, variantEntry.variant.id, plan.id, catalog.addedAt);
        addUsage(byFamilyId, family.id, plan.id, catalog.addedAt);
        addUsage(bySkill, variantEntry.variant.taxonomy.skill, plan.id, catalog.addedAt);
      });
    });
  });

  const mostUsedVariants = Object.entries(byVariantId)
    .map(([variantId, bucket]) => {
      const entry = variantById.get(variantId);
      return {
        variantId,
        familyId: entry?.family.id ?? "",
        title: entry?.variant.name ?? variantId,
        count: bucket.count,
        lastUsedAt: bucket.lastUsedAt,
      };
    })
    .sort((left, right) => {
      const countDiff = right.count - left.count;
      if (countDiff !== 0) return countDiff;
      const rightTime = Date.parse(right.lastUsedAt ?? "");
      const leftTime = Date.parse(left.lastUsedAt ?? "");
      const timeDiff =
        (Number.isFinite(rightTime) ? rightTime : 0) -
        (Number.isFinite(leftTime) ? leftTime : 0);
      if (timeDiff !== 0) return timeDiff;
      return left.title.localeCompare(right.title);
    });

  const unusedVariants = variantEntries
    .filter(({ variant }) => !byVariantId[variant.id])
    .map(({ family, variant }) => ({
      variantId: variant.id,
      familyId: family.id,
      title: variant.name,
      primarySkill: variant.taxonomy.skill,
    }));

  return {
    totalCatalogActivitiesUsed,
    totalPlansScanned: plans?.length ?? 0,
    totalBlocksScanned,
    byVariantId,
    byFamilyId,
    bySkill,
    mostUsedVariants,
    unusedVariants,
    unknownCatalogReferences,
  };
}

export function buildActivityCatalogAuditReport(
  plans: TrainingPlan[]
): ActivityCatalogAuditReport {
  return {
    coverage: auditActivityCatalogCoverage(),
    usage: auditActivityCatalogUsage(plans),
  };
}
