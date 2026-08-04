import { Redirect } from "expo-router";

import { useEffectiveProfile } from "../../src/hooks/use-effective-profile";

export default function StudentsBirthdaysRedirect() {
  const effectiveProfile = useEffectiveProfile();

  return (
    <Redirect
      href={effectiveProfile === "admin" ? "/coord/students" : "/prof/students"}
    />
  );
}
