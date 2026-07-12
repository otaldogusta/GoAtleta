import { validateAcwrLimits } from "../periodization-generator";

describe("validateAcwrLimits", () => {
  it("accepts the recommended range", () => {
    expect(validateAcwrLimits({ low: "0.8", high: "1.3" }).ok).toBe(true);
  });

  it("rejects values outside the configurable safety range", () => {
    expect(validateAcwrLimits({ low: "0.3", high: "1.3" }).ok).toBe(false);
    expect(validateAcwrLimits({ low: "0.8", high: "12" }).ok).toBe(false);
  });

  it("rejects inverted limits and non-numeric content", () => {
    expect(validateAcwrLimits({ low: "1", high: "1" }).ok).toBe(false);
    expect(validateAcwrLimits({ low: "texto", high: "1.3" }).ok).toBe(false);
  });
});
