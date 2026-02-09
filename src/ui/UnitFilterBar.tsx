import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "./app-theme";
import { FadeHorizontalScroll } from "./FadeHorizontalScroll";
import { getSectionCardStyle } from "./section-styles";
import { getUnitPalette } from "./unit-colors";

interface UnitFilterBarProps {
  units: string[];
  selectedUnit: string;
  onSelectUnit: (unit: string) => void;
}

export function UnitFilterBar({ units, selectedUnit, onSelectUnit }: UnitFilterBarProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[getSectionCardStyle(colors, "info", { padding: 10, radius: 16 })]}>
      <FadeHorizontalScroll
        fadeColor={colors.card}
        containerStyle={{ marginHorizontal: -10 }}
        contentContainerStyle={{ flexDirection: "row", gap: 8, paddingHorizontal: 10 }}
      >
        {units.map((unit) => {
          const active = selectedUnit === unit;
          const palette =
            unit === "Todas"
              ? { bg: colors.primaryBg, text: colors.primaryText }
              : getUnitPalette(unit, colors);
          return (
            <Pressable
              key={unit}
              onPress={() => onSelectUnit(unit)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: active ? palette.bg : colors.secondaryBg,
              }}
            >
              <Text
                style={{
                  color: active ? palette.text : colors.text,
                  fontSize: 12,
                  fontWeight: active ? "700" : "500",
                }}
              >
                {unit}
              </Text>
            </Pressable>
          );
        })}
      </FadeHorizontalScroll>
    </View>
  );
}
