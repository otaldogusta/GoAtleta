import { MemberPermissionBoundary } from "../../src/auth/MemberPermissionBoundary";
import CalendarScreen from "../calendar";

export default function CoordinationCalendarRoute() {
  return (
    <MemberPermissionBoundary permissionKey="calendar" redirectTo="/coord/dashboard">
      <CalendarScreen />
    </MemberPermissionBoundary>
  );
}
