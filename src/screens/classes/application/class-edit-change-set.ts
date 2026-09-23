import type { ClassStaffAssignment } from "../../../api/class-responsibles";

const normalizeStaff = (assignments: readonly ClassStaffAssignment[]) =>
  assignments
    .map((member) => `${member.userId}:${member.staffRole}`)
    .sort()
    .join("|");

export function getClassEditChangeSet({
  baseline,
  current,
  baselineStaff,
  currentStaff,
}: {
  baseline: unknown | null;
  current: unknown;
  baselineStaff: readonly ClassStaffAssignment[];
  currentStaff: readonly ClassStaffAssignment[];
}) {
  if (baseline === null) {
    return { detailsChanged: false, staffChanged: false, dirty: false };
  }
  const detailsChanged = baseline !== null && JSON.stringify(baseline) !== JSON.stringify(current);
  const staffChanged = normalizeStaff(baselineStaff) !== normalizeStaff(currentStaff);
  return {
    detailsChanged,
    staffChanged,
    dirty: detailsChanged || staffChanged,
  };
}
