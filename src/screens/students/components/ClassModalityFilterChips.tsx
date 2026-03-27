import { Pressable, Text, View } from "react-native";
import { getClassModalityLabel, getClassModalityOrder } from "../../../core/class-modality";
import type { ClassGroup } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";

export type ClassModalityFilterValue = "all" | ClassGroup["modality"];

type Props = {
  colors: ThemeColors;
  value: ClassModalityFilterValue;
  modalities: ClassGroup["modality"][];
  onChange: (value: ClassModalityFilterValue) => void;
  label?: string;
};

export function ClassModalityFilterChips({
  colors,
  value,
  modalities,
  onChange,
  label = "Modalidade",
}: Props) {
  const uniqueModalities = Array.from(new Set(modalities)).sort(
    (a, b) => getClassModalityOrder(a) - getClassModalityOrder(b)
  );

  if (uniqueModalities.length <= 1) return null;

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          onPress={() => onChange("all")}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: value === "all" ? colors.primaryBg : colors.border,
            backgroundColor: value === "all" ? colors.primaryBg : colors.secondaryBg,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: value === "all" ? colors.primaryText : colors.text,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            Todas
          </Text>
        </Pressable>
        {uniqueModalities.map((modality) => {
          const active = value === modality;
          return (
            <Pressable
              key={modality}
              onPress={() => onChange(modality)}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.primaryBg : colors.border,
                backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: active ? colors.primaryText : colors.text,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {getClassModalityLabel(modality)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
