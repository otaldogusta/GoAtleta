import { Platform, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  const { colors, mode } = useAppTheme();
  const glassGradient =
    mode === "dark"
      ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.01)"]
      : ["rgba(255,255,255,0.25)", "rgba(255,255,255,0.08)"];

  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        ...(Platform.OS === "web"
          ? {
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }
          : null),
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 7,
      }}
    >
      <LinearGradient
        colors={glassGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
        pointerEvents="none"
      />
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
