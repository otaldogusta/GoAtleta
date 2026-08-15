import {
  STUDENT_PERMANENT_UNIT_PANE_MIN_CONTENT_WIDTH,
  STUDENT_TABLE_MIN_CONTENT_WIDTH,
  resolveStudentsListLayout,
} from "../students-list-layout";

describe("resolveStudentsListLayout", () => {
  it("uses a compact sheet below the table capacity", () => {
    expect(resolveStudentsListLayout(STUDENT_TABLE_MIN_CONTENT_WIDTH - 1)).toEqual({
      showTable: false,
      unitPaneMode: "sheet",
    });
  });

  it("keeps the table and overlays units at the intermediate boundary", () => {
    expect(resolveStudentsListLayout(STUDENT_TABLE_MIN_CONTENT_WIDTH)).toEqual({
      showTable: true,
      unitPaneMode: "drawer",
    });
    expect(
      resolveStudentsListLayout(STUDENT_PERMANENT_UNIT_PANE_MIN_CONTENT_WIDTH - 1),
    ).toEqual({
      showTable: true,
      unitPaneMode: "drawer",
    });
  });

  it("persists the unit pane only when the content is wide enough", () => {
    expect(
      resolveStudentsListLayout(STUDENT_PERMANENT_UNIT_PANE_MIN_CONTENT_WIDTH),
    ).toEqual({
      showTable: true,
      unitPaneMode: "permanent",
    });
  });

  it("normalizes invalid widths", () => {
    expect(resolveStudentsListLayout(Number.NaN)).toEqual({
      showTable: false,
      unitPaneMode: "sheet",
    });
    expect(resolveStudentsListLayout(-20)).toEqual({
      showTable: false,
      unitPaneMode: "sheet",
    });
  });
});
