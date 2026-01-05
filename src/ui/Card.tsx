import {
  Text
} from "react-native";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

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
        backgroundColor: colors.primaryBg,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: colors.primaryText,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{ color: colors.primaryText, marginTop: 6, opacity: 0.85 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
