import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "../../ui/app-theme";
import { ShimmerBlock } from "../../ui/Shimmer";

export function ScreenLoadingState() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          gap: 16,
          paddingBottom: 24,
          paddingHorizontal: 16,
          paddingTop: 16,
        }}
      >
        <View style={{ gap: 10 }}>
          <ShimmerBlock style={{ height: 28, width: 140, borderRadius: 12 }} />
          <ShimmerBlock style={{ height: 16, width: 220, borderRadius: 8 }} />
        </View>
        <View style={{ gap: 10 }}>
          <ShimmerBlock style={{ height: 42, borderRadius: 22 }} />
          <ShimmerBlock style={{ height: 42, borderRadius: 22 }} />
        </View>
        <View style={{ gap: 12 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <ShimmerBlock key={`screen-loading-shimmer-${index}`} style={{ height: 90, borderRadius: 18 }} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
