import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import type { UnitPalette } from "./unit-colors";

type LocationBadgeProps = {
  location: string;
  palette?: UnitPalette;
  size?: "sm" | "md";
  showIcon?: boolean;
};

/**
 * Badge to display location/unit with optional icon
 */
export function LocationBadge({
  location,
  palette,
  size = "md",
  showIcon = true,
}: LocationBadgeProps) {
  const label = location.trim() || "Sem unidade";
  const fontSize = size === "sm" ? 11 : 12;
  const iconSize = size === "sm" ? 12 : 14;
  const padding = size === "sm" ? 4 : 6;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: padding,
        paddingHorizontal: padding + 4,
        borderRadius: 999,
        backgroundColor: palette?.bg ?? "#f0f0f0",
      }}
    >
      {showIcon ? (
        <Ionicons
          name="location"
          size={iconSize}
          color={palette?.text ?? "#333"}
        />
      ) : null}
      <Text
        style={{
          color: palette?.text ?? "#333",
          fontWeight: "600",
          fontSize,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
