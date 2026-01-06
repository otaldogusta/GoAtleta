import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "./app-theme";

export function ScreenHeader({
  title,
  subtitle,
  withSafeArea = true,
}: {
  title: string;
  subtitle?: string;
  withSafeArea?: boolean;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ gap: 6, paddingTop: withSafeArea ? insets.top : 0 }}>
      <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
        {title}
      </Text>
      {subtitle ? <Text style={{ color: colors.muted }}>{subtitle}</Text> : null}
    </View>
  );
}
