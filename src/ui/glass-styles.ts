import { Platform } from "react-native";

export function getGlassCardStyle(colors: { card: string; border: string }) {
  const isWeb = Platform.OS === "web";
  return {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isWeb
      ? {
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }
      : {}),
    shadowColor: "#000",
    shadowOpacity: isWeb ? 0.08 : 0.08,
    shadowRadius: isWeb ? 12 : 6,
    shadowOffset: { width: 0, height: isWeb ? 4 : 2 },
    elevation: isWeb ? 4 : 2,
  };
}

export function getGlassButtonStyle(colors: {
  secondaryBg: string;
  border: string;
}) {
  const isWeb = Platform.OS === "web";
  return {
    backgroundColor: colors.secondaryBg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isWeb
      ? {
          backdropFilter: "blur(16px) saturate(150%)",
          WebkitBackdropFilter: "blur(16px) saturate(150%)",
        }
      : {}),
    shadowColor: "#000",
    shadowOpacity: isWeb ? 0.06 : 0.06,
    shadowRadius: isWeb ? 8 : 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: isWeb ? 3 : 1,
  };
}
