import { calculateAdjacentClassDate } from "../whatsapp-templates";

describe("calculateAdjacentClassDate", () => {
  it("jumps to the next configured class day instead of the next calendar day", () => {
    const result = calculateAdjacentClassDate([2, 4], new Date("2026-04-10T00:00:00"), 1);

    expect(result?.toISOString().slice(0, 10)).toBe("2026-04-14");
  });

  it("jumps to the previous configured class day instead of the previous calendar day", () => {
    const result = calculateAdjacentClassDate([2, 4], new Date("2026-04-10T00:00:00"), -1);

    expect(result?.toISOString().slice(0, 10)).toBe("2026-04-09");
  });

  it("wraps across weeks when needed", () => {
    const result = calculateAdjacentClassDate([1], new Date("2026-04-10T00:00:00"), 1);

    expect(result?.toISOString().slice(0, 10)).toBe("2026-04-13");
  });
});
