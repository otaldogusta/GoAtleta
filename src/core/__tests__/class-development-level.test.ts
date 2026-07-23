import {
  CLASS_DEVELOPMENT_LEVEL_OPTIONS,
  resolveClassDevelopmentLevelLabel,
} from "../class-development-level";

describe("class development level", () => {
  it("exposes the three product labels", () => {
    expect(CLASS_DEVELOPMENT_LEVEL_OPTIONS.map((option) => option.label)).toEqual([
      "Iniciação",
      "Intermediário",
      "Rendimento",
    ]);
  });

  it.each([
    ["MV1", 3, "Iniciação"],
    ["MV2", 1, "Intermediário"],
    ["MV3", 1, "Rendimento"],
    ["Avançado", 1, "Rendimento"],
    ["", 2, "Intermediário"],
    ["", 3, "Rendimento"],
    ["", 1, "Iniciação"],
  ])("maps mvLevel %s and numeric level %s to %s", (mvLevel, level, expected) => {
    expect(resolveClassDevelopmentLevelLabel({ mvLevel, level })).toBe(expected);
  });
});
