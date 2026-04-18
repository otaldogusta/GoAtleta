import { Text, View } from "react-native";
import type { ThemeColors } from "../../../ui/app-theme";

type Props = {
  manualOverrideMaskJson: string | undefined;
  colors: ThemeColors;
  compact?: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  warmup: "Aquecimento",
  mainPart: "Parte Principal",
  cooldown: "Volta à Calma",
  observations: "Observações",
};

const parseOverrideMask = (value: string | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
};

/**
 * Display badges for manually locked fields in a daily lesson plan.
 * Shows which fields are overridden and locked from auto-regeneration.
 */
export function LockedFieldBadges({ manualOverrideMaskJson, colors, compact }: Props) {
  const lockedFields = parseOverrideMask(manualOverrideMaskJson);

  if (!lockedFields.length) {
    return null;
  }

  return (
    <View
      style={{
        gap: 6,
        padding: compact ? 8 : 10,
        borderRadius: 12,
        backgroundColor: colors.warningBg,
        borderWidth: 1,
        borderColor: colors.warningBorder || colors.warningText,
      }}
    >
      <Text
        style={{
          color: colors.warningText,
          fontWeight: "700",
          fontSize: compact ? 11 : 12,
        }}
      >
        Campos editados manualmente
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {lockedFields.map((field) => (
          <View
            key={field}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: colors.warningText,
              opacity: 0.15,
            }}
          >
            <Text
              style={{
                color: colors.warningText,
                fontWeight: "600",
                fontSize: compact ? 10 : 11,
              }}
            >
              {FIELD_LABELS[field] || field}
            </Text>
          </View>
        ))}
      </View>
      <Text
        style={{
          color: colors.warningText,
          fontSize: compact ? 10 : 11,
          fontStyle: "italic",
        }}
      >
        Ao clicar em &quot;Regenerar&quot;, os campos editados manualmente continuam preservados.
      </Text>
    </View>
  );
}
