import type { TrainingPlan, TrainingPlanActivity } from "../models";
import {
  ACTIVITY_CATALOG_FAMILIES,
  ACTIVITY_CATALOG_VARIANTS,
} from "../volleyball/activity-catalog";
import {
  auditActivityCatalogCoverage,
  auditActivityCatalogUsage,
  buildActivityCatalogAuditReport,
  findActivityCatalogFamilyById,
  findActivityCatalogVariantById,
} from "../volleyball/activity-catalog-audit";

const findVariant = (skill: string) => {
  const family = ACTIVITY_CATALOG_FAMILIES.find((item) =>
    item.variants.some((variant) => variant.taxonomy.skill === skill)
  );
  const variant = family?.variants.find((item) => item.taxonomy.skill === skill);
  if (!family || !variant) {
    throw new Error(`Missing catalog fixture for skill ${skill}`);
  }
  return { family, variant };
};

const passe = findVariant("passe");
const bloqueio = findVariant("bloqueio");
const saque = findVariant("saque");

const buildCatalogActivity = (
  item: typeof passe,
  addedAt: string,
  overrides: Partial<TrainingPlanActivity> = {}
): TrainingPlanActivity => ({
  name: item.variant.name,
  description: "Atividade de catalogo em teste.",
  catalog: {
    source: "goAtletaCatalog",
    familyId: item.family.id,
    variantId: item.variant.id,
    addedAt,
  },
  ...overrides,
});

const buildPlan = (overrides: Partial<TrainingPlan> = {}): TrainingPlan => ({
  id: "plan-1",
  classId: "class-1",
  title: "Aula teste",
  tags: [],
  warmup: ["Aquecimento legado"],
  main: ["Principal legado"],
  cooldown: ["Volta legado"],
  warmupTime: "10 min",
  mainTime: "40 min",
  cooldownTime: "5 min",
  createdAt: "2026-06-15T00:00:00.000Z",
  ...overrides,
});

describe("activity catalog audit", () => {
  it("audits coverage by skill, family, age, phase and complexity", () => {
    const audit = auditActivityCatalogCoverage();

    expect(audit.totalFamilies).toBe(ACTIVITY_CATALOG_FAMILIES.length);
    expect(audit.totalVariants).toBe(ACTIVITY_CATALOG_VARIANTS.length);
    expect(audit.bySkill.bloqueio.total).toBeGreaterThanOrEqual(3);
    expect(audit.bySkill.ataque.total).toBeGreaterThanOrEqual(3);
    expect(audit.bySkill.saque.total).toBeGreaterThanOrEqual(3);
    expect(audit.bySkill.levantamento.total).toBeGreaterThanOrEqual(3);
    expect(audit.bySkill.defesa.total).toBeGreaterThanOrEqual(3);
    expect(audit.bySkill.transicao.total).toBeGreaterThanOrEqual(3);
    expect(audit.byFamily[passe.family.id].variantIds).toContain(passe.variant.id);
    expect(audit.byAgeRange.formation.total).toBeGreaterThan(0);
    expect(audit.byRecommendedPhase.drill.total).toBeGreaterThan(0);
    expect(audit.byComplexity.moderada.total).toBeGreaterThan(0);
    expect(audit.criticalGaps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "missingSkill", key: "bloqueio" }),
      ])
    );
  });

  it("finds catalog families and variants by id", () => {
    expect(findActivityCatalogFamilyById(passe.family.id)?.id).toBe(passe.family.id);
    expect(findActivityCatalogVariantById(passe.variant.id)?.id).toBe(passe.variant.id);
    expect(findActivityCatalogFamilyById("missing-family")).toBeNull();
    expect(findActivityCatalogVariantById("missing-variant")).toBeNull();
  });

  it("audits catalog usage from pedagogy blocks", () => {
    const plan: TrainingPlan = buildPlan({
      id: "plan-usage",
      pedagogy: {
        blocks: {
          warmup: {
            activities: [
              buildCatalogActivity(passe, "2026-06-15T09:00:00.000Z"),
              { name: "Atividade sem catalogo", description: "Ignorada." },
            ],
          },
          main: {
            activities: [
              buildCatalogActivity(bloqueio, "2026-06-15T10:00:00.000Z"),
              buildCatalogActivity(passe, "2026-06-15T11:00:00.000Z", {
                name: "Mesmo catalogo com nome editado",
              }),
            ],
          },
          cooldown: { activities: [] },
        },
      },
    });

    const audit = auditActivityCatalogUsage([plan]);

    expect(audit.totalPlansScanned).toBe(1);
    expect(audit.totalBlocksScanned).toBe(3);
    expect(audit.totalCatalogActivitiesUsed).toBe(3);
    expect(audit.byVariantId[passe.variant.id]).toMatchObject({
      count: 2,
      planIds: ["plan-usage"],
      lastUsedAt: "2026-06-15T11:00:00.000Z",
    });
    expect(audit.byFamilyId[passe.family.id].count).toBe(2);
    expect(audit.bySkill.passe.count).toBe(2);
    expect(audit.bySkill.bloqueio.count).toBe(1);
    expect(audit.mostUsedVariants[0]).toMatchObject({
      variantId: passe.variant.id,
      familyId: passe.family.id,
      count: 2,
    });
    expect(audit.unusedVariants.map((item) => item.variantId)).not.toContain(passe.variant.id);
    expect(audit.unusedVariants.map((item) => item.variantId)).toContain(saque.variant.id);
  });

  it("orders most used variants by count and then recent use", () => {
    const plan = buildPlan({
      id: "plan-ranking",
      pedagogy: {
        blocks: {
          warmup: {
            activities: [buildCatalogActivity(passe, "2026-06-15T09:00:00.000Z")],
          },
          main: {
            activities: [buildCatalogActivity(bloqueio, "2026-06-15T12:00:00.000Z")],
          },
          cooldown: { activities: [] },
        },
      },
    });

    const audit = auditActivityCatalogUsage([plan]);

    expect(audit.mostUsedVariants.slice(0, 2).map((item) => item.variantId)).toEqual([
      bloqueio.variant.id,
      passe.variant.id,
    ]);
  });

  it("detects unknown catalog references without throwing", () => {
    const plan = buildPlan({
      id: "plan-unknown",
      pedagogy: {
        blocks: {
          warmup: {
            activities: [
              {
                name: "Fonte invalida",
                catalog: {
                  source: "externalCatalog",
                  familyId: passe.family.id,
                  variantId: passe.variant.id,
                  addedAt: "2026-06-15T09:00:00.000Z",
                },
              } as unknown as TrainingPlanActivity,
              buildCatalogActivity(passe, "2026-06-15T10:00:00.000Z", {
                catalog: {
                  source: "goAtletaCatalog",
                  familyId: passe.family.id,
                  variantId: "catalog-missing-variant",
                  addedAt: "2026-06-15T10:00:00.000Z",
                },
              }),
              buildCatalogActivity(passe, "2026-06-15T11:00:00.000Z", {
                catalog: {
                  source: "goAtletaCatalog",
                  familyId: "missing-family",
                  variantId: passe.variant.id,
                  addedAt: "2026-06-15T11:00:00.000Z",
                },
              }),
              {
                description: "Sem nome, mas com referencia valida.",
                catalog: {
                  source: "goAtletaCatalog",
                  familyId: bloqueio.family.id,
                  variantId: bloqueio.variant.id,
                  addedAt: "",
                },
              } as unknown as TrainingPlanActivity,
            ],
          },
          main: { activities: [] },
          cooldown: { activities: [] },
        },
      },
    });

    const audit = auditActivityCatalogUsage([plan]);

    expect(audit.totalCatalogActivitiesUsed).toBe(1);
    expect(audit.unknownCatalogReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "invalidCatalogSource", activityName: "Fonte invalida" }),
        expect.objectContaining({ reason: "missingVariant", variantId: "catalog-missing-variant" }),
        expect.objectContaining({ reason: "missingFamily", familyId: "missing-family" }),
      ])
    );
  });

  it("uses pedagogy blocks first and does not count legacy arrays in parallel", () => {
    const plan = buildPlan({
      id: "plan-source-of-truth",
      warmup: [passe.variant.name],
      main: [bloqueio.variant.name],
      cooldown: [saque.variant.name],
      pedagogy: {
        blocks: {
          warmup: { activities: [] },
          main: { activities: [buildCatalogActivity(passe, "2026-06-15T09:00:00.000Z")] },
          cooldown: { activities: [] },
        },
      },
    });

    const audit = auditActivityCatalogUsage([plan]);

    expect(audit.totalCatalogActivitiesUsed).toBe(1);
    expect(audit.byVariantId[passe.variant.id].count).toBe(1);
    expect(audit.byVariantId[bloqueio.variant.id]).toBeUndefined();
    expect(audit.byVariantId[saque.variant.id]).toBeUndefined();
  });

  it("falls back to legacy arrays safely without creating catalog usage", () => {
    const plan = buildPlan({
      id: "plan-legacy-only",
      warmup: [passe.variant.name],
      main: [bloqueio.variant.name],
      cooldown: [saque.variant.name],
      pedagogy: undefined,
    });

    const audit = auditActivityCatalogUsage([plan]);

    expect(audit.totalBlocksScanned).toBe(3);
    expect(audit.totalCatalogActivitiesUsed).toBe(0);
    expect(audit.unknownCatalogReferences).toEqual([]);
  });

  it("builds a combined report and tolerates empty input", () => {
    const report = buildActivityCatalogAuditReport([]);

    expect(report.coverage.totalVariants).toBe(ACTIVITY_CATALOG_VARIANTS.length);
    expect(report.usage.totalPlansScanned).toBe(0);
    expect(report.usage.totalBlocksScanned).toBe(0);
    expect(report.usage.totalCatalogActivitiesUsed).toBe(0);
  });
});
