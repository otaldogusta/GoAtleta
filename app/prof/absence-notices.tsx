import { MemberPermissionBoundary } from "../../src/auth/MemberPermissionBoundary";
import ProfAbsenceNoticesScreen from "../absence-notices";

function ProfAbsenceNoticesRoute() {
  return (
    <MemberPermissionBoundary permissionKey="absence_notices" redirectTo="/prof/home">
      <ProfAbsenceNoticesScreen />
    </MemberPermissionBoundary>
  );
}

export default ProfAbsenceNoticesRoute;
