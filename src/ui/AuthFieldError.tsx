import { Platform, Text, View } from "react-native";
import { useAppTheme } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";

// Same floating feedback as signup password confirmation; never reserves space.
export function AuthFieldError({ message }: { message: string }) {
  const { colors } = useAppTheme();
  if (!message) return null;
  return <View accessibilityRole="alert" pointerEvents="none"
    style={{ position: "absolute", top: -38, left: 0, zIndex: 60, maxWidth: "100%" }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.dangerSolidBg, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start",
      ...(Platform.OS === "web"
        ? { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.24)" } as any
        : { shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 }, elevation: 6 }) }}>
      <GoAtletaIcon name="warningCircle" size={14} color={colors.dangerSolidText} />
      <Text style={{ color: colors.dangerSolidText, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>{message}</Text>
    </View>
    <View style={{ width: 0, height: 0, marginLeft: 14, borderLeftWidth: 6,
      borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: "transparent",
      borderRightColor: "transparent", borderTopColor: colors.dangerSolidBg }} />
  </View>;
}
