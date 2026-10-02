import { ActivityIndicator, Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";

export function SectionLoadingState() {
  const { colors } = useAppTheme();

  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Carregando" style={{ minHeight: 120, alignItems: "center", justifyContent: "center", gap: 10 }}>
      <ActivityIndicator size="small" color={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Carregando...</Text>
    </View>
  );
}
