import type { MemberPermissionKey } from "../../../api/members";

export type InviteFormRole = "professor" | "intern" | "moderator" | "student";

export type InviteFormSnapshot = {
  email: string;
  role: InviteFormRole;
  permissionKeys: MemberPermissionKey[];
  classIds?: string[];
  staffProfileId?: string | null;
};

export const DEFAULT_INVITE_PERMISSION_KEYS: MemberPermissionKey[] = [
  "classes",
  "training",
  "calendar",
  "absence_notices",
];

const normalizePermissionKeys = (permissionKeys: MemberPermissionKey[]) =>
  [...new Set(permissionKeys)].sort();

export const createInviteFormSnapshot = ({
  email,
  role,
  permissionKeys,
  classIds = [],
  staffProfileId = null,
}: InviteFormSnapshot): InviteFormSnapshot => ({
  email: email.trim().toLowerCase(),
  role,
  permissionKeys: normalizePermissionKeys(permissionKeys),
  classIds: [...new Set(classIds)].sort(),
  staffProfileId,
});

export const areInviteFormSnapshotsEqual = (
  left: InviteFormSnapshot,
  right: InviteFormSnapshot
) =>
  left.email === right.email &&
  left.role === right.role &&
  left.staffProfileId === right.staffProfileId &&
  JSON.stringify(left.classIds ?? []) === JSON.stringify(right.classIds ?? []) &&
  left.permissionKeys.length === right.permissionKeys.length &&
  left.permissionKeys.every((key, index) => key === right.permissionKeys[index]);
