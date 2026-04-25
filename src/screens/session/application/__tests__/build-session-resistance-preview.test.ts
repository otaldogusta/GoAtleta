import { buildSessionResistancePreview } from "../build-session-resistance-preview";

describe("buildSessionResistancePreview", () => {
  it("builds a resistance preview for gym-integrated classes", () => {
    const result = buildSessionResistancePreview({
      classGroup: {
        id: "class-1",
        name: "Sub-14",
        organizationId: "org-1",
        unit: "Centro",
        unitId: "unit-1",
        colorKey: "blue",
        modality: "voleibol",
        ageBand: "13-14",
        gender: "misto",
        startTime: "18:00",
        endTime: "19:30",
        durationMinutes: 90,
        daysOfWeek: [1, 3, 5],
        daysPerWeek: 3,
        goal: "base",
        equipment: "academia",
        level: 2,
        mvLevel: "intermediario",
        cycleStartDate: "2026-04-20",
        cycleLengthWeeks: 12,
        acwrLow: 0.8,
        acwrHigh: 1.3,
        createdAt: "2026-04-20T00:00:00.000Z",
        integratedTrainingModel: "academia_integrada",
        resistanceTrainingProfile: "iniciante",
      },
      classPlan: null,
      sessionDate: "2026-04-22",
    });

    expect(result?.sessionEnvironment).toBe("academia");
    expect(result?.sessionComponents?.[0]?.type).toBe("academia_resistido");
  });

  it("keeps quadra-only classes out of the resistance preview", () => {
    const result = buildSessionResistancePreview({
      classGroup: {
        id: "class-2",
        name: "Sub-12",
        organizationId: "org-1",
        unit: "Centro",
        unitId: "unit-1",
        colorKey: "green",
        modality: "voleibol",
        ageBand: "11-12",
        gender: "misto",
        startTime: "18:00",
        endTime: "19:00",
        durationMinutes: 60,
        daysOfWeek: [2, 4],
        daysPerWeek: 2,
        goal: "base",
        equipment: "quadra",
        level: 1,
        mvLevel: "iniciante",
        cycleStartDate: "2026-04-20",
        cycleLengthWeeks: 12,
        acwrLow: 0.8,
        acwrHigh: 1.3,
        createdAt: "2026-04-20T00:00:00.000Z",
      },
      classPlan: null,
      sessionDate: "2026-04-21",
    });

    expect(result?.sessionEnvironment).toBe("quadra");
    expect(result?.sessionComponents).toBeUndefined();
  });
});
