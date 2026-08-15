export const STUDENT_TABLE_MIN_CONTENT_WIDTH = 760;
export const STUDENT_PERMANENT_UNIT_PANE_MIN_CONTENT_WIDTH = 1200;

export type StudentsUnitPaneMode = "sheet" | "drawer" | "permanent";

export type StudentsListLayout = {
  showTable: boolean;
  unitPaneMode: StudentsUnitPaneMode;
};

export function resolveStudentsListLayout(width: number): StudentsListLayout {
  const normalizedWidth = Number.isFinite(width) ? Math.max(0, width) : 0;

  if (normalizedWidth >= STUDENT_PERMANENT_UNIT_PANE_MIN_CONTENT_WIDTH) {
    return { showTable: true, unitPaneMode: "permanent" };
  }

  if (normalizedWidth >= STUDENT_TABLE_MIN_CONTENT_WIDTH) {
    return { showTable: true, unitPaneMode: "drawer" };
  }

  return { showTable: false, unitPaneMode: "sheet" };
}
