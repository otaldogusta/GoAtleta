import type { Exercise, TrainingPlan } from "../../../../core/models";
import { buildActivityCatalogListItems } from "../../../library/activity-catalog-view-model";
import {
  addPlanningActivityToBlock,
  buildPedagogyBlocksFromPlanningForm,
  buildPlanningActivitiesFromLegacyLines,
  buildTrainingPlanActivityFromCatalogItem,
  buildTrainingPlanActivityFromExerciseLink,
  createEmptyPlanningBlockActivities,
  hydratePlanningActivitiesFromPlan,
  removePlanningActivityFromBlock,
  syncLegacyLinesFromBlocks,
} from "../planning-library-bridge";

const catalogItem = () => buildActivityCatalogListItems()[0];

const exerciseLink = (): Exercise => ({
  id: "exercise-1",
  title: "Vídeo de saque curto",
  tags: ["saque"],
  videoUrl: "https://example.com/video",
  source: "YouTube",
  description: "Referência técnica curta.",
  publishedAt: "",
  notes: "Usar apenas o primeiro trecho.",
  createdAt: "2026-06-16T12:00:00.000Z",
});

const basePlan = (): TrainingPlan => ({
  id: "plan-1",
  classId: "class-1",
  title: "Plano teste",
  tags: [],
  warmup: ["Linha legado"],
  main: ["Principal legado"],
  cooldown: ["Final legado"],
  warmupTime: "10:00",
  mainTime: "01:00",
  cooldownTime: "05:00",
  createdAt: "2026-06-16T12:00:00.000Z",
});

describe("planning library bridge", () => {
  it("builds catalog activities for the selected block and preserves catalog metadata", () => {
    const item = catalogItem();
    const activity = buildTrainingPlanActivityFromCatalogItem(
      item,
      "cooldown",
      "2026-06-16T12:00:00.000Z"
    );

    expect(activity.name).toBe(item.variant.name);
    expect(activity.stage).toBe("cooldown");
    expect(activity.catalog).toEqual({
      source: "goAtletaCatalog",
      familyId: item.family.id,
      variantId: item.variant.id,
      addedAt: "2026-06-16T12:00:00.000Z",
    });
  });

  it("dedupes catalog activities by variant when adding to a planning block", () => {
    const item = catalogItem();
    const activity = buildTrainingPlanActivityFromCatalogItem(item, "warmup", "now");
    const first = addPlanningActivityToBlock(
      createEmptyPlanningBlockActivities(),
      "warmup",
      activity
    );
    const second = addPlanningActivityToBlock(first.activities, "warmup", {
      ...activity,
      name: activity.name.toUpperCase(),
    });

    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.activities.warmup).toHaveLength(1);
  });

  it("builds saved links as simple manual activities without catalog metadata", () => {
    const activity = buildTrainingPlanActivityFromExerciseLink(exerciseLink());

    expect(activity.name).toBe("Vídeo de saque curto");
    expect(activity.execution).toBe("https://example.com/video");
    expect(activity.description).toContain("Referência técnica curta.");
    expect(activity.description).toContain("Link: https://example.com/video");
    expect(activity.catalog).toBeUndefined();
  });

  it("hydrates editing cards from pedagogy blocks before legacy arrays", () => {
    const plan: TrainingPlan = {
      ...basePlan(),
      pedagogy: {
        blocks: {
          warmup: { activities: [{ name: "Aquecimento rico", description: "" }] },
          main: { activities: [{ name: "Principal rico", description: "" }] },
          cooldown: { activities: [{ name: "Final rico", description: "" }] },
        },
      },
    };

    const hydrated = hydratePlanningActivitiesFromPlan(plan);

    expect(syncLegacyLinesFromBlocks(hydrated)).toEqual({
      warmup: ["Aquecimento rico"],
      main: ["Principal rico"],
      cooldown: ["Final rico"],
    });
  });

  it("hydrates legacy plans safely when pedagogy blocks are missing", () => {
    const hydrated = hydratePlanningActivitiesFromPlan(basePlan());

    expect(syncLegacyLinesFromBlocks(hydrated)).toEqual({
      warmup: ["Linha legado"],
      main: ["Principal legado"],
      cooldown: ["Final legado"],
    });
  });

  it("builds pedagogy blocks from cards and manual text without duplicate names", () => {
    const item = catalogItem();
    const activity = buildTrainingPlanActivityFromCatalogItem(item, "main", "now");
    const blockActivities = {
      ...createEmptyPlanningBlockActivities(),
      main: [activity],
    };

    const pedagogy = buildPedagogyBlocksFromPlanningForm({
      blockActivities,
      blockText: {
        warmup: "Ativar ombros",
        main: `${activity.name}\nTarefa manual extra`,
        cooldown: "",
      },
    });

    expect(pedagogy.blocks?.main?.activities.map((entry) => entry.name)).toEqual([
      activity.name,
      "Tarefa manual extra",
    ]);
    expect(pedagogy.blocks?.main?.activities[0].catalog?.variantId).toBe(item.variant.id);
  });

  it("removes activities locally before save", () => {
    const activities = buildPlanningActivitiesFromLegacyLines({
      warmup: ["A", "B"],
      main: ["C"],
      cooldown: [],
    });

    expect(removePlanningActivityFromBlock(activities, "warmup", 0).warmup.map((item) => item.name)).toEqual([
      "B",
    ]);
  });
});
