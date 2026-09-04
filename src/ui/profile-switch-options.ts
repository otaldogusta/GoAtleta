export type ProfileSwitchId = "professor" | "admin" | "student" | "family";

const profileSwitchOrder: readonly ProfileSwitchId[] = [
  "professor",
  "admin",
  "student",
  "family",
];

const profileScreenSwitchOrder: readonly ProfileSwitchId[] = [
  "professor",
  "student",
  "family",
  "admin",
];

export function resolveVisibleProfileSwitchIds(params: {
  hasHybridAccount: boolean;
  isOrgAdmin: boolean;
  canUseDevPreview?: boolean;
  hasTrainerRole?: boolean;
  hasStudentRole?: boolean;
  hasFamilyRole?: boolean;
}): ProfileSwitchId[] {
  const hasFamilyRole = params.hasFamilyRole ?? false;
  const previewProfiles = profileSwitchOrder.filter(
    (profileId) => profileId !== "family" || hasFamilyRole,
  );
  if (params.canUseDevPreview) return previewProfiles;
  const hasTrainerRole = params.hasTrainerRole ?? params.hasHybridAccount;
  const hasStudentRole = params.hasStudentRole ?? params.hasHybridAccount;

  return profileSwitchOrder.filter(
    (profileId) => {
      if (profileId === "family") return hasFamilyRole;
      if (profileId === "student") return hasStudentRole;
      if (profileId === "admin") return hasTrainerRole && params.isOrgAdmin;
      return hasTrainerRole;
    },
  );
}

export function resolveAuthorizedProfileSwitchIds(params: {
  hasTrainerRole: boolean;
  hasStudentRole: boolean;
  hasFamilyRole?: boolean;
  isOrgAdmin: boolean;
  canUseDevPreview: boolean;
}): ProfileSwitchId[] {
  if (params.canUseDevPreview) {
    return profileScreenSwitchOrder.filter(
      (profileId) => profileId !== "family" || params.hasFamilyRole === true,
    );
  }

  return profileScreenSwitchOrder.filter((profileId) => {
    if (profileId === "student") return params.hasStudentRole;
    if (profileId === "family") return params.hasFamilyRole === true;
    if (profileId === "admin") return params.hasTrainerRole && params.isOrgAdmin;
    return params.hasTrainerRole;
  });
}
