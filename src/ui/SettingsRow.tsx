import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

export function SettingsRow({
  icon,
  iconBg,
  label,
  subtitle,
  onPress,
  rightContent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  rightContent: React.ReactNode;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 14,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={18} color={colors.text} />
        </View>
        <View>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{label}</Text>
          {subtitle ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightContent ? (
        rightContent
      ) : (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </View>
      )}
    </Pressable>
  );
}
