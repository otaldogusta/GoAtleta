import { getResistancePlanFromSessionComponents } from "../get-resistance-plan-from-session-components";

describe("getResistancePlanFromSessionComponents", () => {
  it("extracts the resistance component using the existing domain shape", () => {
    const result = getResistancePlanFromSessionComponents([
      {
        type: "quadra_tecnico_tatico",
        description: "Parte técnico-tática",
        durationMin: 30,
      },
      {
        type: "academia_resistido",
        durationMin: 45,
        resistancePlan: {
          id: "r-1",
          label: "Força Base",
          primaryGoal: "forca_base",
          transferTarget: "Bloqueio",
          estimatedDurationMin: 42,
          exercises: [],
        },
      },
    ]);

    expect(result?.resistancePlan.label).toBe("Força Base");
    expect(result?.durationMin).toBe(45);
  });

  it("returns null when session components are absent", () => {
    expect(getResistancePlanFromSessionComponents(undefined)).toBeNull();
    expect(getResistancePlanFromSessionComponents([])).toBeNull();
  });
});
