import type { ClassGroup } from "../../../core/models";
import { buildPeriodizationAutoPlanForCycleDay } from "../application/build-auto-plan-for-cycle-day";

const baseClass = {
  organizationId: "e8622a02-1c6c-49a1-a2c9-b2a5fb9ee934",
  unit: "Rede Esportes Pinhais",
  unitId: "u_1767753866551",
  colorKey: "",
  modality: "voleibol" as const,
  gender: "misto" as const,
  startTime: "14:00",
  endTime: "15:00",
  durationMinutes: 60,
  daysOfWeek: [1, 3],
  daysPerWeek: 2,
  equipment: "misto" as const,
  level: 1 as const,
  mvLevel: "MV1",
  cycleStartDate: "2026-03-23",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-03-23T10:00:00.000Z",
};

const classA: ClassGroup = {
  ...baseClass,
  id: "c_1769011692095",
  name: "Turma 10-12",
  ageBand: "10-12",
  goal: "Fundamentos",
};

const classB: ClassGroup = {
  ...baseClass,
  id: "c_1769012009209",
  name: "Sub 13-15",
  ageBand: "13-15",
  goal: "Resistencia",
};

const weekPlan = {
  week: 3,
  title: "Base técnica",
  focus: "Refino de fundamentos e posição",
  volume: "médio" as const,
  notes: ["Sessões 60-90 min", "Ritmo controlado"],
  jumpTarget: "baixo",
  PSETarget: "PSE 6",
  plannedSessionLoad: 520,
  plannedWeeklyLoad: 1040,
  source: "AUTO" as const,
};

const collectDiff = (left: Record<string, unknown>, right: Record<string, unknown>) => {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return keys
    .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
    .map((key) => ({
      key,
      left: left[key],
      right: right[key],
    }));
};

describe("periodization debug signals diff", () => {
  test("compares adapter and strategy signals between two classes", () => {
    const first = buildPeriodizationAutoPlanForCycleDay({
      classGroup: classA,
      weekPlan,
      cycleStartDate: classA.cycleStartDate,
      sessionDate: "2026-04-13",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: classA.daysPerWeek,
      dominantBlock: "Base técnica",
    });
    const second = buildPeriodizationAutoPlanForCycleDay({
      classGroup: classB,
      weekPlan,
      cycleStartDate: classB.cycleStartDate,
      sessionDate: "2026-04-13",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: classB.daysPerWeek,
      dominantBlock: "Base técnica",
    });

    expect(first.debugSignals).toBeDefined();
    expect(second.debugSignals).toBeDefined();

    const adapterDiff = collectDiff(
      first.debugSignals!.adapterInput as unknown as Record<string, unknown>,
      second.debugSignals!.adapterInput as unknown as Record<string, unknown>
    );
    const cycleDiff = collectDiff(
      first.debugSignals!.cycleContext as unknown as Record<string, unknown>,
      second.debugSignals!.cycleContext as unknown as Record<string, unknown>
    );
    const strategyDiff = collectDiff(
      first.debugSignals!.strategy as unknown as Record<string, unknown>,
      second.debugSignals!.strategy as unknown as Record<string, unknown>
    );

    const strategyDiffKeys = strategyDiff.map((item) => item.key);
    expect(
      strategyDiffKeys.some((key) =>
        [
          "progressionDimension",
          "loadIntent",
          "drillFamilies",
          "pedagogicalIntent",
          "secondarySkill",
        ].includes(
          key
        )
      )
    ).toBe(true);

    // Intentional debug output to support quick side-by-side audits.
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          classA: first.debugSignals,
          classB: second.debugSignals,
          diff: {
            adapterInput: adapterDiff,
            cycleContext: cycleDiff,
            strategy: strategyDiff,
          },
        },
        null,
        2
      )
    );
  });
});
