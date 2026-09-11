import { AppShell } from "../../src/ui/AppShell";
import { PlatformDashboard } from "../../src/screens/platform/PlatformDashboard";
import { markRender } from "../../src/observability/perf";

// perf-check: ignore-measure - this route only composes the shell; data loading belongs to PlatformDashboard.

export default function PlatformIndexRoute() {
  markRender("screen.platform.render.dashboard-route");
  return <AppShell role="coord"><PlatformDashboard /></AppShell>;
}
