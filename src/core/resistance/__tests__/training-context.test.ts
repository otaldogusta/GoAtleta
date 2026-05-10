import type { ClassGroup } from "../../models";
import {
    deriveIntegratedTrainingModel,
    formatResistanceTrainingContextLabel,
    hasGymAccess,
    resolveResistanceTrainingContext,
    resolveResistanceEligibilityMode,
    resolveTrainingContextFromPlanningContext,
    resolveTeamTrainingContext,
    supportsResistanceTraining,
} from "../training-context";

const makeClass = (
  equipment: ClassGroup["equipment"],
  overrides: Partial<Pick<ClassGroup, "integratedTrainingModel" | "resistanceTrainingProfile" | "modality">> = {}
): Pick<ClassGroup, "equipment" | "integratedTrainingModel" | "resistanceTrainingProfile" | "modality"> => ({
  equipment,
  modality: "voleibol",
  ...overrides,
});

describe("deriveIntegratedTrainingModel", () => {
  it("maps academia → academia_integrada", () => {
    expect(deriveIntegratedTrainingModel("academia")).toBe("academia_integrada");
  });
  it("maps misto → academia_complementar", () => {
    expect(deriveIntegratedTrainingModel("misto")).toBe("academia_complementar");
  });
  it("maps quadra → quadra_apenas", () => {
    expect(deriveIntegratedTrainingModel("quadra")).toBe("quadra_apenas");
  });
  it("maps funcional → quadra_apenas", () => {
    expect(deriveIntegratedTrainingModel("funcional")).toBe("quadra_apenas");
  });
});

describe("hasGymAccess", () => {
  it("returns true for academia", () => expect(hasGymAccess("academia")).toBe(true));
  it("returns true for misto", () => expect(hasGymAccess("misto")).toBe(true));
  it("returns false for quadra", () => expect(hasGymAccess("quadra")).toBe(false));
  it("returns false for funcional", () => expect(hasGymAccess("funcional")).toBe(false));
});

describe("resolveTeamTrainingContext", () => {
  it("derives values from equipment when no overrides", () => {
    const ctx = resolveTeamTrainingContext(makeClass("misto"));
    expect(ctx.hasGymAccess).toBe(true);
    expect(ctx.integratedTrainingModel).toBe("academia_complementar");
    expect(ctx.resistanceTrainingProfile).toBe("iniciante");
    expect(ctx.trainingContext).toBe("volleyball");
    expect(ctx.sportContext).toBe("volleyball");
  });

  it("respects explicit integratedTrainingModel override", () => {
    const ctx = resolveTeamTrainingContext(
      makeClass("misto", { integratedTrainingModel: "academia_prioritaria" })
    );
    expect(ctx.integratedTrainingModel).toBe("academia_prioritaria");
  });

  it("respects explicit resistanceTrainingProfile override", () => {
    const ctx = resolveTeamTrainingContext(
      makeClass("academia", { resistanceTrainingProfile: "avancado" })
    );
    expect(ctx.resistanceTrainingProfile).toBe("avancado");
  });

  it("no gym access for quadra", () => {
    const ctx = resolveTeamTrainingContext(makeClass("quadra"));
    expect(ctx.hasGymAccess).toBe(false);
    expect(ctx.integratedTrainingModel).toBe("quadra_apenas");
  });

  it("maps fitness classes to a universal general-fitness context", () => {
    const ctx = resolveTeamTrainingContext(makeClass("academia", { modality: "fitness" }));

    expect(ctx.trainingContext).toBe("general_fitness");
    expect(ctx.sportContext).toBeUndefined();
  });
});

describe("resolveResistanceTrainingContext", () => {
  it("keeps volleyball as volleyball", () => {
    expect(resolveResistanceTrainingContext("voleibol")).toBe("volleyball");
  });

  it("maps fitness to general_fitness", () => {
    expect(resolveResistanceTrainingContext("fitness")).toBe("general_fitness");
  });

  it("maps football and futsal to soccer", () => {
    expect(resolveResistanceTrainingContext("futebol")).toBe("soccer");
    expect(resolveResistanceTrainingContext("futsal")).toBe("soccer");
  });
});

describe("resolveTrainingContextFromPlanningContext", () => {
  it("uses manual override ahead of modality", () => {
    const decision = resolveTrainingContextFromPlanningContext({
      classGroup: { modality: "voleibol", goal: "base" },
      sessionEnvironment: "academia",
      sessionPrimaryComponent: "resistido",
      overrideTrainingContext: "hypertrophy",
    });

    expect(decision.trainingContext).toBe("hypertrophy");
    expect(decision.source).toBe("manual_override");
    expect(decision.confidence).toBe("high");
  });

  it("keeps volleyball for resisted volleyball sessions with explicit environment", () => {
    const decision = resolveTrainingContextFromPlanningContext({
      classGroup: { modality: "voleibol", goal: "base" },
      sessionEnvironment: "academia",
      sessionPrimaryComponent: "resistido",
    });

    expect(decision.trainingContext).toBe("volleyball");
    expect(decision.sportContext).toBe("volleyball");
    expect(decision.source).toBe("class_modality");
  });

  it("falls back to general fitness for generic resisted sessions", () => {
    const decision = resolveTrainingContextFromPlanningContext({
      classGroup: { modality: undefined, goal: "saúde" },
      sessionEnvironment: "academia",
      sessionPrimaryComponent: "resistido",
    });

    expect(decision.trainingContext).toBe("general_fitness");
    expect(decision.sportContext).toBeUndefined();
    expect(decision.source).toBe("fallback");
  });
});

describe("formatResistanceTrainingContextLabel", () => {
  it("renders user-facing label in Portuguese", () => {
    expect(formatResistanceTrainingContextLabel("general_fitness")).toBe(
      "Condicionamento geral"
    );
    expect(formatResistanceTrainingContextLabel("volleyball")).toBe("Vôlei");
    expect(formatResistanceTrainingContextLabel("strength")).toBe("Força");
    expect(formatResistanceTrainingContextLabel("other_sport")).toBe("Outro esporte");
  });
});

describe("supportsResistanceTraining", () => {
  it("returns false for quadra_apenas", () => {
    const ctx = resolveTeamTrainingContext(makeClass("quadra"));
    expect(supportsResistanceTraining(ctx)).toBe(false);
  });

  it("returns true for academia_complementar", () => {
    const ctx = resolveTeamTrainingContext(makeClass("misto"));
    expect(supportsResistanceTraining(ctx)).toBe(true);
  });

  it("returns true for academia_integrada", () => {
    const ctx = resolveTeamTrainingContext(makeClass("academia"));
    expect(supportsResistanceTraining(ctx)).toBe(true);
  });

  it("returns false for beginner volleyball groups even with gym access", () => {
    const ctx = resolveTeamTrainingContext(makeClass("academia"));
    expect(
      supportsResistanceTraining(ctx, {
        ageBand: "07-09",
        level: 1,
        mvLevel: "base",
        modality: "voleibol",
      })
    ).toBe(false);
  });
});

describe("resolveResistanceEligibilityMode", () => {
  it("keeps 07-09 beginner volleyball in integrated motor-control mode", () => {
    const teamContext = resolveTeamTrainingContext(makeClass("academia"));

    expect(
      resolveResistanceEligibilityMode({
        classGroup: {
          ageBand: "07-09",
          level: 1,
          mvLevel: "base",
          modality: "voleibol",
        },
        teamContext,
      })
    ).toBe("motor_control_integrated");
  });

  it("allows formal support for older intermediate volleyball groups", () => {
    const teamContext = resolveTeamTrainingContext(
      makeClass("academia", { resistanceTrainingProfile: "intermediario" })
    );

    expect(
      resolveResistanceEligibilityMode({
        classGroup: {
          ageBand: "13-15",
          level: 2,
          mvLevel: "intermediario",
          modality: "voleibol",
        },
        teamContext,
      })
    ).toBe("formal_support");
  });
});
