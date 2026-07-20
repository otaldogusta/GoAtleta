import type { DevProfilePreview } from "../dev/profile-preview";

export type ProfileSwitchId = Exclude<DevProfilePreview, "auto">;

const profileSwitchOrder: readonly ProfileSwitchId[] = [
  "professor",
  "admin",
  "student",
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
