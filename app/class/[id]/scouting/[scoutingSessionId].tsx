import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenLoadingState } from "../../../../src/components/ui/ScreenLoadingState";
import { useAppTheme } from "../../../../src/ui/app-theme";

export default function ClassScoutingSessionRedirect() {
  const { id } = useLocalSearchParams<{ id: string; scoutingSessionId?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";

  useEffect(() => {
    router.replace({
      pathname: "/class/[id]/scouting",
      params: { id: classId },
    });
  }, [classId, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenLoadingState />
    </SafeAreaView>
  );
}
