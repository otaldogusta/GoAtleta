import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "./app-theme";

export function AppSection({
  children,
  subtitle,
  title,
}: {
  children?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
