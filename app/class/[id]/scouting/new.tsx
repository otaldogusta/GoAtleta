import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

import { ScreenLoadingState } from "../../../../src/components/ui/ScreenLoadingState";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../../../src/ui/app-theme";

export default function NewScoutingRoute() {
  const { id, date, type, source } = useLocalSearchParams<{
    id: string;
    date?: string;
    type?: string;
    source?: string;
  }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";

  useEffect(() => {
    router.replace({
      pathname: "/class/[id]/scouting",
      params: {
        id: classId,
        openNew: "1",
        date: typeof date === "string" ? date : undefined,
        type: typeof type === "string" ? type : undefined,
        source: typeof source === "string" ? source : undefined,
      },
    });
  }, [classId, date, router, source, type]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenLoadingState />
    </SafeAreaView>
  );
}
