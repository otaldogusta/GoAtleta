import { Redirect } from "expo-router";
import { useEffectiveProfile } from "../src/core/effective-profile";
import { useRole } from "../src/auth/role";
import HomeAdmin from "../src/screens/home/HomeAdmin";
import HomeProfessor from "../src/screens/home/HomeProfessor";
import StudentHome from "./student-home";

export default function Home() {
  const { loading: roleLoading } = useRole();
  const profile = useEffectiveProfile();
  const navV2Enabled = process.env.EXPO_PUBLIC_NAV_V2 === "1";

  // Aguarda o role/preview carregar antes de redirecionar.
  // Sem isso, index.tsx redireciona para /prof/home antes do AsyncStorage
  // carregar, corrompendo o estado da navegação dos tabs do aluno.
  if (roleLoading) return null;

  if (navV2Enabled) {
    if (profile === "student") {
      return <Redirect href="/student/home" />;
    }
    if (profile === "admin") {
      return <Redirect href="/coord/dashboard" />;
    }
    return <Redirect href="/prof/home" />;
  }

  if (profile === "student") return <StudentHome />;
  if (profile === "admin") return <HomeAdmin />;
  return <HomeProfessor />;
}
