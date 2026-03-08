import { Redirect } from "expo-router";
import { useEffectiveProfile } from "../src/core/effective-profile";
import HomeAdmin from "../src/screens/home/HomeAdmin";
import HomeProfessor from "../src/screens/home/HomeProfessor";
import StudentHome from "./student-home";

export default function Home() {
  const profile = useEffectiveProfile();
  const navV2Enabled = process.env.EXPO_PUBLIC_NAV_V2 === "1";

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
