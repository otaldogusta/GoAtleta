import { Pressable, Text } from "react-native";

export function Card({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: "#111",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: "#aaa", marginTop: 6 }}>{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}
