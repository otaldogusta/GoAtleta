import { useEffectiveProfile } from "../src/core/effective-profile";
import HomeAdmin from "../src/screens/home/HomeAdmin";
import HomeProfessor from "../src/screens/home/HomeProfessor";
import StudentHome from "./student-home";

export default function Home() {
  const profile = useEffectiveProfile();

  if (profile === "student") return <StudentHome />;
  if (profile === "admin") return <HomeAdmin />;
  return <HomeProfessor />;
}
