import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "./app-theme";
import { useResponsiveLayout } from "./use-responsive-layout";

export function ScreenHeader({
  title,
  subtitle,
  withSafeArea = true,
}: {
  title: string;
  subtitle: string;
  withSafeArea?: boolean;
}) {
  const { colors } = useAppTheme();
  const { density } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ gap: 6, paddingTop: withSafeArea ? insets.top : 0 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: density.pageTitleFontSize,
          lineHeight: density.pageTitleLineHeight,
          fontWeight: "700",
          color: colors.text,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.muted, fontSize: density.bodyFontSize }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
