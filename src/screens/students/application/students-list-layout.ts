export const STUDENT_TABLE_MIN_CONTENT_WIDTH = 760;

export type StudentsUnitPaneMode = "dropdown";

export type StudentsListLayout = {
  showTable: boolean;
  unitPaneMode: StudentsUnitPaneMode;
};

export function resolveStudentsFilterModalHeight(
  viewportHeight: number,
  compact: boolean,
) {
  const normalizedHeight = Number.isFinite(viewportHeight)
    ? Math.max(0, viewportHeight)
    : 0;
  const viewportSpacing = compact ? 24 : 32;
  const maximumHeight = compact ? 680 : 640;

  return Math.min(maximumHeight, Math.max(0, normalizedHeight - viewportSpacing));
}

export function resolveStudentsListLayout(width: number): StudentsListLayout {
  const normalizedWidth = Number.isFinite(width) ? Math.max(0, width) : 0;

  return {
    showTable: normalizedWidth >= STUDENT_TABLE_MIN_CONTENT_WIDTH,
    unitPaneMode: "dropdown",
  };
}
