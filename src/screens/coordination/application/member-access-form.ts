export type MemberAccessRole = 5 | 10 | 50;

export type MemberAccessFormSnapshot = {
  role: MemberAccessRole;
  classIds: string[];
  permissionKeys: string[];
};

const normalizeValues = (values: readonly string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const createMemberAccessFormSnapshot = ({
  role,
  classIds,
  permissionKeys,
}: {
  role: MemberAccessRole;
  classIds: readonly string[];
  permissionKeys: readonly string[];
}): MemberAccessFormSnapshot => ({
  role,
  classIds: normalizeValues(classIds),
  permissionKeys: normalizeValues(permissionKeys),
});

export const areMemberAccessFormSnapshotsEqual = (
  left: MemberAccessFormSnapshot,
  right: MemberAccessFormSnapshot
) =>
  left.role === right.role &&
  left.classIds.length === right.classIds.length &&
  left.classIds.every((value, index) => value === right.classIds[index]) &&
  left.permissionKeys.length === right.permissionKeys.length &&
  left.permissionKeys.every((value, index) => value === right.permissionKeys[index]);
