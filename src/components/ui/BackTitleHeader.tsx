import { Ionicons } from "@expo/vector-icons";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type BackTitleHeaderProps = {
  title: string;
  onBack: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BackTitleHeader({ title, onBack, style }: BackTitleHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[{ marginBottom: 4 }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voltar de ${title}`}
        onPress={onBack}
        style={{
          alignSelf: "flex-start",
          maxWidth: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: 16,
          paddingVertical: 2,
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
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </View>
        <Text
          numberOfLines={2}
          style={{ flexShrink: 1, fontSize: 26, fontWeight: "700", color: colors.text }}
        >
          {title}
        </Text>
      </Pressable>
    </View>
  );
}
