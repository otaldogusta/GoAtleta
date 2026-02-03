import { Platform } from "react-native";

export function getGlassCardStyle(colors: { card: string; border: string }) {
  return {
    backgroundColor: colors.card,
    borderWidth: Platform.OS === "web" ? 1 : 1.5,
    borderColor:
      Platform.OS === "web" ? colors.border : "rgba(255, 255, 255, 0.18)",
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }
      : {}),
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "web" ? 0.08 : 0.12,
    shadowRadius: Platform.OS === "web" ? 12 : 8,
    shadowOffset: { width: 0, height: Platform.OS === "web" ? 4 : 3 },
    elevation: 4,
  };
}

export function getGlassButtonStyle(colors: {
  secondaryBg: string;
  border: string;
}) {
  return {
    backgroundColor: colors.secondaryBg,
    borderWidth: Platform.OS === "web" ? 1 : 1,
    borderColor:
      Platform.OS === "web" ? colors.border : "rgba(255, 255, 255, 0.15)",
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(16px) saturate(150%)",
          WebkitBackdropFilter: "blur(16px) saturate(150%)",
        }
      : {}),
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "web" ? 0.06 : 0.1,
    shadowRadius: Platform.OS === "web" ? 8 : 6,
    shadowOffset: { width: 0, height: Platform.OS === "web" ? 2 : 2 },
    elevation: 3,
  };
}
