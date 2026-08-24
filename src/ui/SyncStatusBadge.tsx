import { Text, View } from "react-native";
import { useAppTheme } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";

type SyncStatusBadgeProps = {
  status: "saving" | "saved_local" | "synced" | "pending" | "error" | "offline";
  message?: string;
  size?: "sm" | "md";
  iconOnly?: boolean;
};

/**
 * Badge to show sync status with appropriate icon and color
 */
export function SyncStatusBadge({
  status,
  message,
  size = "md",
  iconOnly = false,
}: SyncStatusBadgeProps) {
  const { colors } = useAppTheme();

  const fontSize = size === "sm" ? 11 : 12;
  const iconSize = size === "sm" ? 14 : 16;
  const padding = size === "sm" ? 6 : 8;

  const config = {
    saving: {
      icon: "upload" as const,
      text: message || "Salvando...",
      bg: colors.secondaryBg,
      color: colors.muted,
    },
    saved_local: {
      icon: "save" as const,
      text: message || "Salvo no dispositivo",
      bg: colors.secondaryBg,
      color: colors.text,
    },
    synced: {
      icon: "cloudDone" as const,
      text: message || "Sincronizado",
      bg: colors.primaryBg,
      color: colors.primaryText,
    },
    pending: {
      icon: "sync" as const,
      text: message || "Alterações pendentes",
      bg: colors.secondaryBg,
      color: colors.muted,
    },
    error: {
      icon: "warningCircle" as const,
      text: message || "Erro ao sincronizar",
      bg: colors.dangerBg,
      color: colors.dangerText,
    },
    offline: {
      icon: "cloudOffline" as const,
      text: message || "Offline",
      bg: colors.warningBg,
      color: colors.warningText,
    },
  };

  const { icon, text, bg, color: textColor } = config[status];

  return (
    <View
      accessible
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: iconOnly ? 0 : 6,
        width: iconOnly ? 32 : undefined,
        height: iconOnly ? 32 : undefined,
        paddingVertical: iconOnly ? 0 : padding,
        paddingHorizontal: iconOnly ? 0 : padding + 4,
        borderRadius: 999,
        backgroundColor: bg,
        alignSelf: "flex-start",
      }}
    >
      <GoAtletaIcon name={icon} size={iconSize} color={textColor} />
      {iconOnly ? null : (
        <Text
          style={{
            color: textColor,
            fontWeight: "600",
            fontSize,
          }}
        >
          {text}
        </Text>
      )}
    </View>
  );
}
