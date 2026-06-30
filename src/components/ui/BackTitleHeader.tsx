import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Platform, Text, View } from "react-native";

import { ptBR } from "../../constants/copy/pt-br";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type BackTitleHeaderProps = {
  title: string;
  onBack: () => void;
  accessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function BackTitleHeader({ title, onBack, accessory, style }: BackTitleHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[{ marginBottom: 4, minWidth: 0 }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${ptBR.common.accessibility.backFromPrefix} ${title}`}
        onPress={onBack}
        suppressWebHoverFeedback
        style={(state) => {
          const hovered = Platform.OS === "web" && Boolean((state as typeof state & { hovered?: boolean }).hovered);
          const pressed = Boolean(state.pressed);

          return {
            alignSelf: "flex-start",
            maxWidth: "100%",
            minHeight: 38,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 14,
            paddingLeft: 4,
            paddingRight: 10,
            paddingVertical: 4,
            backgroundColor: hovered || pressed ? "rgba(148, 163, 184, 0.12)" : "transparent",
            ...(hovered
              ? {
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }
              : null),
          };
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderLeftWidth: 2.4,
              borderBottomWidth: 2.4,
              borderColor: colors.text,
              transform: [{ rotate: "45deg" }],
              marginLeft: 4,
            }}
          />
        </View>
        <Text
          numberOfLines={2}
          style={{ flexShrink: 1, fontSize: 26, fontWeight: "700", color: colors.text }}
        >
          {title}
        </Text>
        {accessory}
      </Pressable>
    </View>
  );
}
