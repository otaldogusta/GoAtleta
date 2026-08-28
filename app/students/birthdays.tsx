// perf-check: ignore-render -- redirect-only route; it has no screen body to render.
// perf-check: ignore-measure -- redirect-only route; it performs no asynchronous load.
import { Redirect } from "expo-router";

import { useEffectiveProfile } from "../../src/hooks/use-effective-profile";

export default function StudentsBirthdaysRedirect() {
  const effectiveProfile = useEffectiveProfile();

  return (
    <Redirect
      href={
        effectiveProfile === "admin"
          ? ("/coord/management/athletes" as never)
          : "/prof/students"
      }
    />
  );
}
