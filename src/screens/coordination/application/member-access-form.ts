export type MemberAccessRole = 5 | 10 | 50;

export type MemberAccessFormSnapshot = {
  role: MemberAccessRole;
  classIds: string[];
  permissionKeys: string[];
};

const normalizeValues = (values: readonly string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const MEMBER_MANAGEMENT_PERMISSION = "org_members";

export const preserveOwnMemberManagementPermission = <PermissionKey extends string>({
  actorUserId,
  targetUserId,
  permissionKeys,
}: {
  actorUserId?: string | null;
  targetUserId?: string | null;
  permissionKeys: readonly PermissionKey[];
}) => {
  const protectedPermission = MEMBER_MANAGEMENT_PERMISSION as PermissionKey;
  if (!actorUserId || actorUserId !== targetUserId) return [...permissionKeys];
  if (permissionKeys.includes(protectedPermission)) return [...permissionKeys];
  return [...permissionKeys, protectedPermission];
};

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

export const createMemberAccessIdempotencyKey = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });

export const formatMemberAccessSuccessMessage = ({
  displayName,
  classCount,
  permissionCount,
  notificationCreated,
}: {
  displayName: string;
  classCount: number;
  permissionCount: number;
  notificationCreated: boolean;
}) => {
  const firstName = displayName.trim().split(/\s+/)[0] || "Pessoa";
  const notificationMessage = notificationCreated
    ? " A notificação já está na caixa de entrada."
    : "";
  return `Acesso de ${firstName} atualizado: ${classCount} turma(s) e ${permissionCount} permissão(ões).${notificationMessage}`;
};
