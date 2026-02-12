import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRole } from "../src/auth/role";
import { useEffectiveProfile } from "../src/core/effective-profile";
import HomeAdmin from "../src/screens/home/HomeAdmin";
import HomeProfessor from "../src/screens/home/HomeProfessor";
import { ShimmerBlock } from "../src/ui/Shimmer";
import { useAppTheme } from "../src/ui/app-theme";
import StudentHome from "./student-home";

export default function Home() {
  const { colors } = useAppTheme();
  const { loading } = useRole();
  const profile = useEffectiveProfile();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ gap: 8 }}>
              <ShimmerBlock style={{ width: 180, height: 22, borderRadius: 10 }} />
              <ShimmerBlock style={{ width: 140, height: 14, borderRadius: 8 }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ShimmerBlock style={{ width: 44, height: 32, borderRadius: 16 }} />
              <ShimmerBlock style={{ width: 56, height: 56, borderRadius: 28 }} />
            </View>
          </View>
          <ShimmerBlock style={{ height: 140, borderRadius: 20 }} />
          <ShimmerBlock style={{ height: 140, borderRadius: 20 }} />
          <ShimmerBlock style={{ height: 140, borderRadius: 20 }} />
          <ShimmerBlock style={{ height: 120, borderRadius: 20 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (profile === "student") return <StudentHome />;
  if (profile === "admin") return <HomeAdmin />;
  return <HomeProfessor />;
}
