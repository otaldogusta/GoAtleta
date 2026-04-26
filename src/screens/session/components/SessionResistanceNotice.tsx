import { Text, View } from "react-native";

import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";

type NoticeAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

type Props = {
  colors: ThemeColors;
  title: string;
  description: string;
  tone?: "info" | "warning";
  actions?: NoticeAction[];
};

export function SessionResistanceNotice({
  colors,
  title,
  description,
  tone = "info",
  actions = [],
}: Props) {
  const accentColor = tone === "warning" ? colors.warningText : colors.infoText;
  const tintColor = tone === "warning" ? colors.warningBg : colors.infoBg;

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      <View
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: tintColor,
        }}
      >
        <Text style={{ color: accentColor, fontSize: 11, fontWeight: "800" }}>
          {tone === "warning" ? "Contexto pedagógico" : "Ponte da sessão"}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{description}</Text>
      </View>
      {actions.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor:
                  action.variant === "primary" ? colors.primaryBg : colors.secondaryBg,
              }}
            >
              <Text
                style={{
                  color:
                    action.variant === "primary" ? colors.primaryText : colors.text,
                  fontWeight: "700",
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
