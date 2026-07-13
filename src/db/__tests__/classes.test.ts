import { normalizeOptionalDate } from "../normalize-db-values";

describe("normalizeOptionalDate", () => {
  it("converts empty date values to null before sending them to PostgREST", () => {
    expect(normalizeOptionalDate("")).toBeNull();
    expect(normalizeOptionalDate("   ")).toBeNull();
    expect(normalizeOptionalDate(undefined)).toBeNull();
  });

  it("preserves a valid ISO date", () => {
    expect(normalizeOptionalDate(" 2026-07-12 ")).toBe("2026-07-12");
  });
});
