import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "../../ui/app-theme";
import { spacing } from "../../theme/tokens";

type ScreenProps = {
  children: ReactNode;
};

export function Screen({ children }: ScreenProps) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
