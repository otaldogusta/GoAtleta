import {
  getCourtDimensionsLabel,
  getPeriodizationCourtGeometry,
  REFERENCE_COURT,
} from "../periodization-court-geometry";

describe("mini-court geometry in metres", () => {
  it("puts each 3 x 3 m side of 1x1 between the net and the attack line", () => {
    const court = getPeriodizationCourtGeometry("1x1");
    expect(court.length).toBe(6);
    expect(court.width).toBe(3);
    expect(court.x).toBe(REFERENCE_COURT.attackLinesX[0]);
    expect(court.x + court.length).toBe(REFERENCE_COURT.attackLinesX[1]);
    expect(REFERENCE_COURT.netX - court.x).toBe(3);
    expect(court.x + court.length - REFERENCE_COURT.netX).toBe(3);
    expect(getCourtDimensionsLabel("1x1")).toBe("6 × 3 m");
  });

  it.each([
    ["2x2", 7, 3.5],
    ["3x3", 12, 4.5],
    ["4x4", 14, 7],
    ["6x6", 18, 9],
  ] as const)("keeps %s total dimensions from the PDF with a shared sideline", (level, length, width) => {
    const court = getPeriodizationCourtGeometry(level);
    expect(court.length).toBe(length);
    expect(court.width).toBe(width);
    expect(court.y + court.width).toBe(9);
    expect(court.x + court.depthPerSide).toBe(9);
    expect(court.x + court.length).toBeLessThanOrEqual(18);
  });
});
