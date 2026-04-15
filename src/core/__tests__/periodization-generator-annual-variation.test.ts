import { buildClassPlan } from "../periodization-generator";

describe("periodization-generator annual variation", () => {
  it("varies annual weeks inside the same macro phase", () => {
    const firstWeekOfPhase = buildClassPlan({
      classId: "class_1",
      ageBand: "09-11",
      startDate: "2026-03-23",
      weekNumber: 9,
      source: "AUTO",
      mvLevel: "MV2",
      cycleLength: 48,
      model: "formacao",
      sessionsPerWeek: 2,
      sport: "voleibol",
    });

    const laterWeekOfSamePhase = buildClassPlan({
      classId: "class_1",
      ageBand: "09-11",
      startDate: "2026-03-23",
      weekNumber: 14,
      source: "AUTO",
      mvLevel: "MV2",
      cycleLength: 48,
      model: "formacao",
      sessionsPerWeek: 2,
      sport: "voleibol",
    });

    expect(firstWeekOfPhase.phase).toBe(laterWeekOfSamePhase.phase);
    expect(firstWeekOfPhase.theme).not.toBe(laterWeekOfSamePhase.theme);
    expect(firstWeekOfPhase.technicalFocus).not.toBe(laterWeekOfSamePhase.technicalFocus);
    expect(firstWeekOfPhase.warmupProfile).not.toBe(laterWeekOfSamePhase.warmupProfile);
    expect(firstWeekOfPhase.constraints).toContain("Microciclo");
    expect(laterWeekOfSamePhase.constraints).toContain("Microciclo");
  });
});
