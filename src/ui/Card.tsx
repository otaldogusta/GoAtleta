import { Text } from "react-native";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { getGlassCardStyle } from "./glass-styles";

export function Card({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: 16,
        overflow: "hidden",
        ...getGlassCardStyle(colors),
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: colors.text,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{ color: colors.text, marginTop: 6, opacity: 0.8 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
