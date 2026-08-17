import { MemberPermissionBoundary } from "../../src/auth/MemberPermissionBoundary";
import ProfCalendarScreen from "../calendar";

function ProfCalendarRoute() {
  return (
    <MemberPermissionBoundary permissionKey="calendar" redirectTo="/prof/home">
      <ProfCalendarScreen />
    </MemberPermissionBoundary>
  );
}

export default ProfCalendarRoute;
