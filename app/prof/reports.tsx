import { MemberPermissionBoundary } from "../../src/auth/MemberPermissionBoundary";
import ReportsScreen from "../reports/trainer";

function ProfReportsRoute() {
  return (
    <MemberPermissionBoundary permissionKey="reports" redirectTo="/prof/home">
      <ReportsScreen />
    </MemberPermissionBoundary>
  );
}

export default ProfReportsRoute;
