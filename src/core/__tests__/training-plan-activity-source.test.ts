import {
  getTrainingPlanActivityDedupeKey,
  getTrainingPlanActivitySourceLabel,
  hasMatchingTrainingPlanActivity,
} from "../training-plan-activity-source";

describe("training plan activity source metadata", () => {
  it("keeps the catalog source contract separate from the UI label", () => {
    expect(
      getTrainingPlanActivitySourceLabel({
        catalog: {
          source: "goAtletaCatalog",
          familyId: "family-continuity",
          variantId: "catalog-continuity",
          addedAt: "2026-06-14T12:00:00.000Z",
        },
      })
    ).toBe("Catálogo GoAtleta");

    expect(getTrainingPlanActivitySourceLabel({ catalog: undefined })).toBeNull();
  });

  it("dedupes catalog activities by variant and falls back to normalized name", () => {
    const candidate = {
      name: "Caça da bola jogável",
      catalog: {
        source: "goAtletaCatalog" as const,
        familyId: "family-continuity",
        variantId: "catalog-continuity-playable-ball",
        addedAt: "2026-06-14T12:00:00.000Z",
      },
    };

    expect(getTrainingPlanActivityDedupeKey(candidate)).toBe(
      "catalog:catalog-continuity-playable-ball"
    );
    expect(
      hasMatchingTrainingPlanActivity(
        [
          {
            name: "Outro nome operacional",
            description: "",
            catalog: {
              source: "goAtletaCatalog",
              familyId: "family-continuity",
              variantId: "catalog-continuity-playable-ball",
              addedAt: "2026-06-14T12:00:00.000Z",
            },
          },
        ],
        { ...candidate, description: "" }
      )
    ).toBe(true);
    expect(
      hasMatchingTrainingPlanActivity(
        [
          {
            name: "Caca da bola jogavel",
            description: "",
          },
        ],
        { ...candidate, description: "" }
      )
    ).toBe(true);
  });
});
