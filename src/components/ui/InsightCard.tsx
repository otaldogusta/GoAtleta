import { useEffect, useState } from "react";
import { Animated, Linking, Platform, Pressable, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import type { ContextualInsight } from "../../copilot/hooks/useContextualInsight";

type InsightCardProps = {
  insight: ContextualInsight;
  onDismiss: () => void;
  onOpenAssistant?: () => void;
  compact?: boolean;
  embedded?: boolean;
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

export function InsightCard({ insight, onDismiss, onOpenAssistant, compact = false, embedded = false }: InsightCardProps) {
  const { colors, mode } = useAppTheme();
  const [showJustification, setShowJustification] = useState(false);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(-8));

  const handleActionPress = () => {
    if (!insight.action) return;
    if (insight.action.type === "whatsapp_reminder") {
      const cleanPhone = insight.action.params.phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.length <= 11 && cleanPhone.length > 0 ? "55" + cleanPhone : cleanPhone;
      const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(insight.action.params.message)}`;
      void Linking.openURL(url);
    }
  };

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

  if (compact) {
    const handleCompactAction = () => {
      if (insight.action) {
        handleActionPress();
        return;
      }
      onOpenAssistant?.();
    };

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          marginHorizontal: embedded ? 0 : 16,
          marginTop: embedded ? 8 : 10,
          marginBottom: embedded ? 0 : 16,
        }}
      >
        <View
          style={{
            minHeight: embedded ? 0 : 56,
            borderRadius: 14,
            borderWidth: embedded ? 0 : 1,
            borderColor: embedded ? "transparent" : colors.border,
            backgroundColor: embedded ? "transparent" : colors.card,
            paddingHorizontal: embedded ? 0 : 16,
            paddingVertical: embedded ? 0 : 10,
            flexDirection: embedded ? "column" : "row",
            alignItems: embedded ? "stretch" : "center",
            gap: 12,
          }}
        >
          {embedded ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <GoAtletaIcon name="assistant" size={20} color={colors.muted} />
                <Text numberOfLines={embedded ? 3 : 2} style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" }}>
                  {insight.insight}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                {insight.action || onOpenAssistant ? (
                  <Pressable
                    onPress={handleCompactAction}
                    accessibilityRole="button"
                    accessibilityLabel="Resolver insight"
                    style={({ pressed }) => ({ opacity: pressed ? 0.62 : 1, paddingVertical: 6, paddingHorizontal: 4 })}
                  >
                    <Text style={{ color: colors.primaryBg, fontSize: 13, fontWeight: "800" }}>Resolver</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onDismiss}
                  hitSlop={12}
                  accessibilityLabel="Fechar insight"
                  accessibilityRole="button"
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 2 })}
                >
                  <GoAtletaIcon name="close" size={17} color={colors.muted} />
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <GoAtletaIcon name="assistant" size={20} color={colors.muted} />
              <Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" }}>
                {insight.insight}
              </Text>
              {insight.action || onOpenAssistant ? (
                <Pressable
                  onPress={handleCompactAction}
                  accessibilityRole="button"
                  accessibilityLabel="Resolver insight"
                  style={({ pressed }) => ({ opacity: pressed ? 0.62 : 1, paddingVertical: 6, paddingHorizontal: 4 })}
                >
                  <Text style={{ color: colors.primaryBg, fontSize: 13, fontWeight: "800" }}>Resolver</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onDismiss}
                hitSlop={12}
                accessibilityLabel="Fechar insight"
                accessibilityRole="button"
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 2 })}
              >
                <GoAtletaIcon name="close" size={17} color={colors.muted} />
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    );
  }

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
        {/* Main Content row */}
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

          <View style={{ flex: 1, gap: 2, justifyContent: "center" }}>
            <Text
              style={{
                fontSize: 14,
                color: colors.text,
                lineHeight: 20,
                fontWeight: "600",
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

        {/* Expanded Justification View (Progressive Disclosure) */}
        {showJustification && insight.based_on && insight.based_on.length > 0 && (
          <View
            style={{
              marginTop: 4,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: 6,
            }}
          >
            {insight.based_on.map((fact, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: accentColor }} />
                <Text style={{ fontSize: 13, color: colors.text }}>
                  {fact}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Button */}
        {insight.action && (
          <Pressable
            onPress={handleActionPress}
            style={({ pressed }) => ({
              backgroundColor: accentColor,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 4,
              opacity: pressed ? 0.8 : 1,
            })}
            accessibilityLabel={insight.action.label}
            accessibilityRole="button"
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              {insight.action.label}
            </Text>
          </Pressable>
        )}

        {/* Footer row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {insight.based_on && insight.based_on.length > 0 && (
              <Pressable
                onPress={() => setShowJustification(!showJustification)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                })}
                accessibilityLabel="Ver justificativa"
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "500" }}>
                  {showJustification ? "Ocultar" : "Por quê?"}
                </Text>
                <GoAtletaIcon
                  name={showJustification ? "chevronUp" : "chevronDown"}
                  size={10}
                  color={colors.muted}
                />
              </Pressable>
            )}
          </View>

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
