import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { useRole } from "../src/auth/role";
import { useEffectiveProfile } from "../src/core/effective-profile";
import { useOptionalOrganization } from "../src/providers/OrganizationProvider";

// perf-check: ignore-render
// perf-check: ignore-measure
export default function Home() {
  const { loading: roleLoading, role, devProfilePreview } = useRole();
  const organization = useOptionalOrganization();
  const profile = useEffectiveProfile();
  const isWeb = Platform.OS === "web";
  const browserPathname =
    isWeb && typeof window !== "undefined"
      ? window.location.pathname.length > 1
        ? window.location.pathname.replace(/\/+$/, "")
        : window.location.pathname
      : "/";
  const shouldWaitForOrganization =
    devProfilePreview === "auto" &&
    role === "trainer" &&
    Boolean(organization?.isLoading);

  // Aguarda o role/preview carregar antes de redirecionar.
  // Sem isso, index.tsx redireciona para /prof/home antes do AsyncStorage
  // carregar, corrompendo o estado da navegação dos tabs do aluno.
  // No web, o componente index pode montar brevemente durante bootstrap
  // mesmo com deep-link ativo (/class/...); se redirecionar aqui, rouba a rota.
  if (roleLoading || shouldWaitForOrganization) return null;
  if (isWeb && browserPathname !== "/" && browserPathname !== "/index") return null;

  if (profile === "student") return <Redirect href="/student/home" />;
  if (profile === "admin") return <Redirect href="/coord/dashboard" />;
  return <Redirect href="/prof/home" />;
}
