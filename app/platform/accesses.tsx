import { useLocalSearchParams } from "expo-router";

import { PlatformAccessDashboard } from "../../src/screens/platform/PlatformAccessDashboard";
import { AppShell } from "../../src/ui/AppShell";
import { markRender } from "../../src/observability/perf";

// perf-check: ignore-measure - this route only maps URL params; data loading belongs to PlatformAccessDashboard.

export default function PlatformAccessesRoute() {
  markRender("screen.platform.render.accesses-route");
  const params = useLocalSearchParams<{
    designPreview?: string | string[];
    institution?: string | string[];
  }>();
  const designPreview =
    __DEV__ &&
    (Array.isArray(params.designPreview)
      ? params.designPreview[0]
      : params.designPreview) === "accesses";

  return (
    <AppShell role="coord">
      <PlatformAccessDashboard
        designPreview={designPreview}
        initialInstitution={
          Array.isArray(params.institution)
            ? params.institution[0]
            : params.institution
        }
      />
    </AppShell>
  );
}
