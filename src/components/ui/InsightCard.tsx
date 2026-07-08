import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import type { ContextualInsight } from "../../copilot/hooks/useContextualInsight";

type InsightCardProps = {
  insight: ContextualInsight;
  onDismiss: () => void;
  onOpenAssistant?: () => void;
};

const confidenceLabel = (confidence: number): string => {
  if (confidence >= 0.85) return "Alta confiança";
  if (confidence >= 0.70) return "Média confiança";
  return "Baixa confiança";
};

const confidenceColor = (confidence: number, colors: ReturnType<typeof useAppTheme>["colors"]): string => {
  if (confidence >= 0.85) return colors.successText ?? "#22c55e";
  if (confidence >= 0.70) return colors.warningText ?? "#f59e0b";
  return colors.muted ?? "#94a3b8";
};

export function InsightCard({ insight, onDismiss, onOpenAssistant }: InsightCardProps) {
  const { colors, mode } = useAppTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const cardBg = mode === "dark"
    ? "rgba(99, 60, 180, 0.12)"
    : "rgba(124, 58, 237, 0.06)";
  const borderColor = mode === "dark"
    ? "rgba(139, 92, 246, 0.35)"
    : "rgba(124, 58, 237, 0.22)";
  const accentColor = "#7c3aed";

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
      }}
    >
      <View
        style={{
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor,
          borderRadius: 14,
          padding: 14,
          gap: 10,
          ...(Platform.OS === "web" ? { boxShadow: "0 2px 12px rgba(124,58,237,0.08)" } : {}),
        }}
      >
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: accentColor,
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <GoAtletaIcon name="sparkles" size={16} color="#fff" />
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: accentColor,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Copiloto · Insight
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.text,
                lineHeight: 20,
                fontWeight: "400",
              }}
            >
              {insight.insight}
            </Text>
          </View>

          {/* Dismiss button */}
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              padding: 2,
            })}
            accessibilityLabel="Fechar insight"
            accessibilityRole="button"
          >
            <GoAtletaIcon name="close" size={16} color={colors.muted} />
          </Pressable>
        </View>

        {/* Footer row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{
              fontSize: 11,
              color: confidenceColor(insight.confidence, colors),
              fontWeight: "500",
            }}
          >
            {confidenceLabel(insight.confidence)}
          </Text>

          {onOpenAssistant && (
            <Pressable
              onPress={onOpenAssistant}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              })}
              accessibilityLabel="Abrir assistente"
              accessibilityRole="button"
            >
              <Text
                style={{
                  fontSize: 11,
                  color: accentColor,
                  fontWeight: "600",
                }}
              >
                Ver no Assistente
              </Text>
              <GoAtletaIcon name="chevronForward" size={11} color={accentColor} />
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
