import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "./app-theme";
import { FadeHorizontalScroll } from "./FadeHorizontalScroll";
import { getUnitPalette } from "./unit-colors";

interface UnitFilterBarProps {
  units: string[];
  selectedUnit: string;
  onSelectUnit: (unit: string) => void;
  showLabel?: boolean;
}

export function UnitFilterBar({ units, selectedUnit, onSelectUnit, showLabel = true }: UnitFilterBarProps) {
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: 8 }}>
      {showLabel ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Filtrar por unidade</Text>
      ) : null}
      <FadeHorizontalScroll
        fadeColor={colors.background}
        contentContainerStyle={{ flexDirection: "row", gap: 8 }}
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
                paddingVertical: 7,
                paddingHorizontal: 11,
                borderRadius: 999,
                backgroundColor: active ? palette.bg : colors.secondaryBg,
                borderWidth: 1,
                borderColor: active ? palette.bg : colors.border,
              }}
            >
              <Text
                style={{
                  color: active ? palette.text : colors.text,
                  fontSize: 12,
                  fontWeight: active ? "800" : "600",
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
