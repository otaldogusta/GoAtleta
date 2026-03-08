import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
};

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 30, lineHeight: 34, fontWeight: "800", color: colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 14, color: colors.muted }}>{subtitle}</Text>
        ) : null}
      </View>
      <Pressable
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="notifications-outline" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}
