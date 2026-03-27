import { Redirect } from "expo-router";
import { useEffectiveProfile } from "../src/core/effective-profile";
import { useRole } from "../src/auth/role";

// perf-check: ignore-render
// perf-check: ignore-measure
export default function Home() {
  const { loading: roleLoading } = useRole();
  const profile = useEffectiveProfile();

  // Aguarda o role/preview carregar antes de redirecionar.
  // Sem isso, index.tsx redireciona para /prof/home antes do AsyncStorage
  // carregar, corrompendo o estado da navegação dos tabs do aluno.
  if (roleLoading) return null;

  if (profile === "student") return <Redirect href="/student/home" />;
  if (profile === "admin") return <Redirect href="/coord/dashboard" />;
  return <Redirect href="/prof/home" />;
}
