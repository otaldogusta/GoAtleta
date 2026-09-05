import { markRender } from "../src/observability/perf";
// perf-check: ignore-measure -- visual fallback; auth recovery and boot timing are owned by app/_layout.tsx.
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useAppTheme } from "../src/ui/app-theme";

export default function AuthCallbackScreen() {
  markRender("screen.authCallback.render.root");
  const { colors } = useAppTheme();
  const router = useRouter();

  useEffect(() => {
    // Auth callback handling is centralized in app/_layout.tsx.
    // This screen is a visual fallback route only.
    if (Platform.OS !== "web") {
      router.replace("/");
    }
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color={colors.primaryBg} />
      <Text style={{ color: colors.text, marginTop: 16 }}>Processando autenticação...</Text>
    </View>
  );
}
