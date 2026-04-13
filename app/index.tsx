import { Redirect } from "expo-router";
import { useRole } from "../src/auth/role";
import { useEffectiveProfile } from "../src/core/effective-profile";
import { useOptionalOrganization } from "../src/providers/OrganizationProvider";

// perf-check: ignore-render
// perf-check: ignore-measure
export default function Home() {
  const { loading: roleLoading, role, devProfilePreview } = useRole();
  const organization = useOptionalOrganization();
  const profile = useEffectiveProfile();
  const shouldWaitForOrganization =
    devProfilePreview === "auto" &&
    role === "trainer" &&
    Boolean(organization?.isLoading);

  // Aguarda o role/preview carregar antes de redirecionar.
  // Sem isso, index.tsx redireciona para /prof/home antes do AsyncStorage
  // carregar, corrompendo o estado da navegação dos tabs do aluno.
  if (roleLoading || shouldWaitForOrganization) return null;

  if (profile === "student") return <Redirect href="/student/home" />;
  if (profile === "admin") return <Redirect href="/coord/dashboard" />;
  return <Redirect href="/prof/home" />;
}
