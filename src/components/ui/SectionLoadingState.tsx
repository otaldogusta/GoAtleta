import { View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { ShimmerBlock } from "../../ui/Shimmer";

export function SectionLoadingState() {
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 8 }}>
        <ShimmerBlock style={{ height: 18, width: 150, borderRadius: 8 }} />
        <ShimmerBlock style={{ height: 14, width: 220, borderRadius: 8 }} />
      </View>
      <View style={{ gap: 10 }}>
        <ShimmerBlock style={{ height: 72, borderRadius: 16 }} />
        <ShimmerBlock style={{ height: 72, borderRadius: 16 }} />
        <ShimmerBlock style={{ height: 72, borderRadius: 16 }} />
      </View>
      <View
        style={{
          height: 1,
          borderRadius: 999,
          backgroundColor: colors.border,
          opacity: 0.35,
        }}
      />
    </View>
  );
}
