export const canOpenFamilyAccessFromFinance = ({
  roleLevel,
  canManageStudents,
  permissionsLoading,
}: {
  roleLevel: number;
  canManageStudents: boolean;
  permissionsLoading: boolean;
}) => !permissionsLoading && (roleLevel >= 50 || canManageStudents);

export const canManageFinanceFromFamilyAccess = ({
  roleLevel,
  canManageFinancial,
  permissionsLoading,
}: {
  roleLevel: number;
  canManageFinancial: boolean;
  permissionsLoading: boolean;
}) => !permissionsLoading && (roleLevel >= 50 || canManageFinancial);
