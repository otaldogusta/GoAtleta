import { getDemandIndexForModel } from "../periodization-basics";
import {
  buildClassPlan,
  getVolumeFromTargets,
} from "../periodization-generator";
import { getPlannedLoads } from "../periodization-load";

describe("periodization child load progression", () => {
  it("keeps 07-09 weeks between baixa and moderada with visible progression", () => {
    const weeks = [1, 2, 3, 4].map((weekNumber) => {
      const plan = buildClassPlan({
        classId: "class_07_09",
        ageBand: "09-11",
        rawAgeBand: "07-09",
        startDate: "2026-05-04",
        weekNumber,
        source: "AUTO",
        mvLevel: "MV2",
        cycleLength: 12,
        model: "formacao",
        sessionsPerWeek: 1,
        sport: "voleibol",
      });

      const volume = getVolumeFromTargets(plan.phase, plan.rpeTarget, "07-09");
      const demandIndex = getDemandIndexForModel(volume, "formacao", 1, "voleibol", "07-09");
      const loads = getPlannedLoads(plan.rpeTarget, 60, 1);

      return {
        weekNumber,
        rpeTarget: plan.rpeTarget,
        volume,
        demandIndex,
        plannedSessionLoad: loads.plannedSessionLoad,
      };
    });

    expect(weeks.map((week) => week.volume)).toEqual(["baixo", "médio", "médio", "baixo"]);
    expect(weeks.map((week) => week.rpeTarget)).toEqual(["3-4", "4-5", "4-6", "3-4"]);
    expect(weeks.some((week) => week.volume === "alto")).toBe(false);
    expect(new Set(weeks.map((week) => week.plannedSessionLoad)).size).toBeGreaterThan(2);
    expect(weeks[0]?.demandIndex).toBe(2);
    expect(weeks[1]?.demandIndex).toBe(4);
    expect(weeks[2]?.demandIndex).toBe(4);
    expect(weeks[3]?.demandIndex).toBe(2);
  });
});
