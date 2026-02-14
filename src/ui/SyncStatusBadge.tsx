import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "./app-theme";

type SyncStatusBadgeProps = {
  status: "saving" | "saved_local" | "synced" | "error";
  message?: string;
  size?: "sm" | "md";
};

/**
 * Badge to show sync status with appropriate icon and color
 */
export function SyncStatusBadge({
  status,
  message,
  size = "md",
}: SyncStatusBadgeProps) {
  const { colors } = useAppTheme();

  const fontSize = size === "sm" ? 11 : 12;
  const iconSize = size === "sm" ? 14 : 16;
  const padding = size === "sm" ? 6 : 8;

  const config = {
    saving: {
      icon: "cloud-upload-outline" as const,
      text: message || "Salvando...",
      bg: colors.secondaryBg,
      color: colors.muted,
    },
    saved_local: {
      icon: "save-outline" as const,
      text: message || "Salvo no dispositivo",
      bg: colors.secondaryBg,
      color: colors.text,
    },
    synced: {
      icon: "cloud-done-outline" as const,
      text: message || "Sincronizado",
      bg: colors.primaryBg,
      color: colors.primaryText,
    },
    error: {
      icon: "alert-circle-outline" as const,
      text: message || "Erro ao sincronizar",
      bg: "#fee",
      color: "#c33",
    },
  };

  const { icon, text, bg, color: textColor } = config[status];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: padding,
        paddingHorizontal: padding + 4,
        borderRadius: 999,
        backgroundColor: bg,
        alignSelf: "flex-start",
      }}
    >
      <Ionicons name={icon} size={iconSize} color={textColor} />
      <Text
        style={{
          color: textColor,
          fontWeight: "600",
          fontSize,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
