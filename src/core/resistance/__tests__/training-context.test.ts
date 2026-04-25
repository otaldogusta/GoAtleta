import type { ClassGroup } from "../../models";
import {
    deriveIntegratedTrainingModel,
    hasGymAccess,
    resolveResistanceEligibilityMode,
    resolveTeamTrainingContext,
    supportsResistanceTraining,
} from "../training-context";

const makeClass = (
  equipment: ClassGroup["equipment"],
  overrides: Partial<Pick<ClassGroup, "integratedTrainingModel" | "resistanceTrainingProfile">> = {}
): Pick<ClassGroup, "equipment" | "integratedTrainingModel" | "resistanceTrainingProfile"> => ({
  equipment,
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
