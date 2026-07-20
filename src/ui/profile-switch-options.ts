import type { DevProfilePreview } from "../dev/profile-preview";

export type ProfileSwitchId = Exclude<DevProfilePreview, "auto">;

const profileSwitchOrder: readonly ProfileSwitchId[] = [
  "professor",
  "admin",
  "student",
];

const profileScreenSwitchOrder: readonly ProfileSwitchId[] = [
  "professor",
  "student",
  "admin",
];

export function resolveVisibleProfileSwitchIds(params: {
  hasHybridAccount: boolean;
  isOrgAdmin: boolean;
}): ProfileSwitchId[] {
  if (!params.hasHybridAccount) return [...profileSwitchOrder];

  return profileSwitchOrder.filter(
    (profileId) => profileId !== "admin" || params.isOrgAdmin,
  );
}

export function resolveAuthorizedProfileSwitchIds(params: {
  hasTrainerRole: boolean;
  hasStudentRole: boolean;
  isOrgAdmin: boolean;
  canUseDevPreview: boolean;
}): ProfileSwitchId[] {
  if (params.canUseDevPreview) return [...profileScreenSwitchOrder];

  return profileScreenSwitchOrder.filter((profileId) => {
    if (profileId === "student") return params.hasStudentRole;
    if (profileId === "admin") return params.hasTrainerRole && params.isOrgAdmin;
    return params.hasTrainerRole;
  });
}
