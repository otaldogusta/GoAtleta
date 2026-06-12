import type { VolleyballSkill } from "../models";
import {
  ACTIVITY_CATALOG_FAMILIES,
  ACTIVITY_CATALOG_VARIANTS,
  auditActivityCatalog,
  recommendActivityCatalogVariants,
} from "../volleyball/activity-catalog";

describe("activity catalog foundation", () => {
  it("keeps pedagogical families with valid variants and complete taxonomy", () => {
    expect(ACTIVITY_CATALOG_FAMILIES.length).toBeGreaterThanOrEqual(6);
    expect(ACTIVITY_CATALOG_VARIANTS.length).toBeGreaterThan(ACTIVITY_CATALOG_FAMILIES.length);

    ACTIVITY_CATALOG_FAMILIES.forEach((family) => {
      expect(family.source).toBe("goatleta_original");
      expect(family.variants.length).toBeGreaterThan(0);
      family.variants.forEach((variant) => {
        expect(variant.id).toMatch(/^catalog-/);
        expect(variant.taxonomy.skill).toBeTruthy();
        expect(variant.taxonomy.gamePhase).toBeTruthy();
        expect(variant.taxonomy.pedagogicalIntent).toBeTruthy();
        expect(variant.taxonomy.complexity).toBeTruthy();
        expect(variant.taxonomy.ageRange.length).toBeGreaterThan(0);
        expect(variant.taxonomy.format).toBeTruthy();
        expect(variant.taxonomy.environment).toBeTruthy();
        expect(variant.taxonomy.cognitiveDemand).toBeTruthy();
        expect(variant.taxonomy.physicalDemand).toBeTruthy();
        expect(variant.taxonomy.recommendedPhase).toBeTruthy();
        expect(variant.taxonomy.periodizationCompatibility.length).toBeGreaterThan(0);
        expect(variant.taxonomy.progressionCompatibility.length).toBeGreaterThan(0);
        expect(variant.taxonomy.loadCompatibility.length).toBeGreaterThan(0);
        expect(variant.taxonomy.families).toContain("catalogo");
      });
    });
  });

  it("stays original and does not encode a required lesson phase", () => {
    const serialized = JSON.stringify(ACTIVITY_CATALOG_FAMILIES).toLowerCase();

    expect(serialized).not.toContain("volleyballxl");
    expect(serialized).not.toContain("requiredphase");
    expect(serialized).not.toContain("required_phase");
    expect(serialized).toContain("recommendedphase");
  });

  it("does not duplicate variants by skill, age, phase and name", () => {
    const keys = ACTIVITY_CATALOG_VARIANTS.flatMap((variant) =>
      variant.taxonomy.ageRange.map((ageStage) =>
        [
          variant.taxonomy.skill,
          ageStage,
          variant.taxonomy.recommendedPhase,
          variant.name.toLowerCase(),
        ].join("|")
      )
    );
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);

    expect(duplicates).toEqual([]);
  });

  it("audits balance by skill, age, intent and periodization compatibility", () => {
    const audit = auditActivityCatalog();

    expect(audit.totalFamilies).toBe(ACTIVITY_CATALOG_FAMILIES.length);
    expect(audit.totalVariants).toBe(ACTIVITY_CATALOG_VARIANTS.length);
    expect(audit.bySkill.passe).toBeGreaterThan(0);
    expect(audit.bySkill.saque).toBeGreaterThan(0);
    expect(audit.byAgeStage.formation).toBeGreaterThan(0);
    expect(audit.byPedagogicalIntent.decision_making).toBeGreaterThan(0);
    expect(audit.byPeriodizationCompatibility.transferencia_jogo).toBeGreaterThan(0);
    expect(audit.gaps.length).toBeGreaterThan(0);
  });

  it("prioritizes periodized pass continuity over unrelated attack or block options", () => {
    const recommendations = recommendActivityCatalogVariants({
      primarySkill: "passe",
      ageStage: "transition",
      phaseIntent: "estabilizacao_tecnica",
      progressionDimension: "precisao",
      pedagogicalIntent: "technical_adjustment",
      loadIntent: "moderado",
      recentActivityFamilies: [],
      materials: ["bolas", "cones"],
    });
    const top = recommendations[0];

    expect(top?.variant.taxonomy.skill).toBe("passe");
    expect(top?.variant.taxonomy.periodizationCompatibility).toContain("estabilizacao_tecnica");
    expect(top?.variant.taxonomy.families.join(" ")).toMatch(/continuidade|sideout|recepcao/);
    expect(top?.variant.taxonomy.skill).not.toBe("ataque");
    expect(top?.variant.taxonomy.skill).not.toBe("bloqueio" as VolleyballSkill);
    expect(top?.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["skill_match", "periodization_match", "progression_match"])
    );
  });

  it("uses recent reception weakness to favor pass and receive families", () => {
    const recommendations = recommendActivityCatalogVariants({
      primarySkill: "passe",
      ageStage: "formation",
      phaseIntent: "aceleracao_decisao",
      progressionDimension: "tomada_decisao",
      pedagogicalIntent: "decision_making",
      loadIntent: "moderado",
      recentActivityFamilies: ["bloqueio"],
      materials: ["bolas", "cones"],
      recentDifficulties: ["recepcao"],
    });
    const topThree = recommendations.slice(0, 3);

    expect(topThree.some((item) => item.variant.taxonomy.skill === "passe")).toBe(true);
    expect(
      topThree.some((item) =>
        item.reasons.some((reason) => reason.code === "scouting_or_feedback_match")
      )
    ).toBe(true);
  });

  it("penalizes repeated recent families", () => {
    const fresh = recommendActivityCatalogVariants({
      primarySkill: "passe",
      ageStage: "transition",
      phaseIntent: "estabilizacao_tecnica",
      progressionDimension: "precisao",
      pedagogicalIntent: "technical_adjustment",
      loadIntent: "moderado",
      recentActivityFamilies: [],
      materials: ["bolas", "cones"],
    })[0];
    const repeatedRecommendations = recommendActivityCatalogVariants({
      primarySkill: "passe",
      ageStage: "transition",
      phaseIntent: "estabilizacao_tecnica",
      progressionDimension: "precisao",
      pedagogicalIntent: "technical_adjustment",
      loadIntent: "moderado",
      recentActivityFamilies: fresh?.variant.taxonomy.families ?? [],
      materials: ["bolas", "cones"],
    });
    const repeatedSameVariant = repeatedRecommendations.find((item) => item.variant.id === fresh?.variant.id);

    expect(repeatedSameVariant?.score).toBeLessThan(fresh?.score ?? 0);
    expect(repeatedSameVariant?.reasons.some((reason) => reason.code === "anti_repetition")).toBe(true);
  });
});
