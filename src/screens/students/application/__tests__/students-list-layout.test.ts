import {
  STUDENT_TABLE_MIN_CONTENT_WIDTH,
  resolveStudentsFilterModalHeight,
  resolveStudentsListLayout,
  resolveStudentsPageSize,
} from "../students-list-layout";

describe("resolveStudentsListLayout", () => {
  it("uses cards and the unit dropdown below the table capacity", () => {
    expect(resolveStudentsListLayout(STUDENT_TABLE_MIN_CONTENT_WIDTH - 1)).toEqual({
      showTable: false,
      unitPaneMode: "dropdown",
    });
  });

  it("keeps the unit dropdown when the table becomes available", () => {
    expect(resolveStudentsListLayout(STUDENT_TABLE_MIN_CONTENT_WIDTH)).toEqual({
      showTable: true,
      unitPaneMode: "dropdown",
    });
  });

  it("normalizes invalid widths", () => {
    expect(resolveStudentsListLayout(Number.NaN)).toEqual({
      showTable: false,
      unitPaneMode: "dropdown",
    });
    expect(resolveStudentsListLayout(-20)).toEqual({
      showTable: false,
      unitPaneMode: "dropdown",
    });
  });
});

describe("resolveStudentsPageSize", () => {
  it("keeps mobile pagination stable and bounds desktop pagination", () => {
    expect(resolveStudentsPageSize(2000, false)).toBe(8);
    expect(resolveStudentsPageSize(600, true)).toBe(8);
    expect(resolveStudentsPageSize(911, true)).toBe(8);
    expect(resolveStudentsPageSize(912, true)).toBe(9);
    expect(resolveStudentsPageSize(1024, true)).toBe(10);
    expect(resolveStudentsPageSize(1194, true)).toBe(13);
    expect(resolveStudentsPageSize(3000, true)).toBe(20);
    expect(resolveStudentsPageSize(Number.NaN, true)).toBe(8);
  });
});

describe("resolveStudentsFilterModalHeight", () => {
  it("caps the compact sheet while preserving viewport breathing room", () => {
    expect(resolveStudentsFilterModalHeight(812, true)).toBe(680);
    expect(resolveStudentsFilterModalHeight(500, true)).toBe(476);
  });

  it("keeps the centered modal inside short desktop viewports", () => {
    expect(resolveStudentsFilterModalHeight(900, false)).toBe(640);
    expect(resolveStudentsFilterModalHeight(600, false)).toBe(568);
  });

  it("normalizes invalid heights", () => {
    expect(resolveStudentsFilterModalHeight(Number.NaN, true)).toBe(0);
    expect(resolveStudentsFilterModalHeight(-20, false)).toBe(0);
  });
});
