import { MemberPermissionBoundary } from "../../src/auth/MemberPermissionBoundary";
import ProfPeriodizationScreen from "../periodization";

function ProfPeriodizationRoute() {
  return (
    <MemberPermissionBoundary permissionKey="periodization" redirectTo="/prof/home">
      <ProfPeriodizationScreen />
    </MemberPermissionBoundary>
  );
}

export default ProfPeriodizationRoute;
