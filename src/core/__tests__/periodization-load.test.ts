import {
    formatPlannedLoad,
    getPlannedLoads,
    getPSEValueFromTarget,
} from "../periodization-load";

describe("periodization-load", () => {
  it("parses PSE ranges using their average value", () => {
    expect(getPSEValueFromTarget("PSE 4-5")).toBe(4.5);
  });

  it("parses decimal values with comma", () => {
    expect(getPSEValueFromTarget("PSE 4,5")).toBe(4.5);
  });

  it("returns null when target has no numeric PSE", () => {
    expect(getPSEValueFromTarget("Livre")).toBeNull();
  });

  it("calculates planned session and weekly load from target, duration, and frequency", () => {
    expect(getPlannedLoads("PSE 4-5", 60, 2)).toEqual({
      plannedSessionLoad: 270,
      plannedWeeklyLoad: 540,
    });
  });

  it("applies conservative minimums for short or missing sessions", () => {
    expect(getPlannedLoads("PSE 6-7", 10, 0)).toEqual({
      plannedSessionLoad: 98,
      plannedWeeklyLoad: 98,
    });
    expect(getPlannedLoads("PSE 6-7", 0, 0)).toEqual({
      plannedSessionLoad: 390,
      plannedWeeklyLoad: 390,
    });
  });

  it("returns zero load when the target cannot be parsed", () => {
    expect(getPlannedLoads("Livre", 60, 3)).toEqual({
      plannedSessionLoad: 0,
      plannedWeeklyLoad: 0,
    });
  });

  it("formats planned load in AU", () => {
    expect(formatPlannedLoad(540.2)).toBe("540 AU");
  });
});
