import {
  calculateAdjacentClassDate,
  calculateCurrentOrNextClassDate,
  calculateCurrentOrPreviousClassDate,
} from "../whatsapp-templates";

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

describe("calculateCurrentOrPreviousClassDate", () => {
  it("opens today's class even after its scheduled time", () => {
    expect(calculateCurrentOrPreviousClassDate([3, 5], new Date(2026, 10, 13, 21)))
      .toEqual(new Date(2026, 10, 13));
  });

  it("opens the last class day on a day without class", () => {
    expect(calculateCurrentOrPreviousClassDate([3, 5], new Date(2026, 10, 16)))
      .toEqual(new Date(2026, 10, 13));
  });

  it("has no default without a schedule", () => {
    expect(calculateCurrentOrPreviousClassDate([], new Date(2026, 10, 16))).toBeNull();
  });
});

describe("calculateCurrentOrNextClassDate", () => {
  it("keeps today's class before its scheduled end", () => {
    const result = calculateCurrentOrNextClassDate(
      [4],
      "14:00",
      60,
      new Date("2026-07-16T13:30:00")
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2026-07-16");
  });

  it("advances only after today's class ends", () => {
    const result = calculateCurrentOrNextClassDate(
      [4],
      "14:00",
      60,
      new Date("2026-07-16T15:00:00")
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2026-07-23");
  });
});
