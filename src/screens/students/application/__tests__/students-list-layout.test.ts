import {
  STUDENT_TABLE_MIN_CONTENT_WIDTH,
  resolveStudentsFilterModalHeight,
  resolveStudentsListLayout,
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
