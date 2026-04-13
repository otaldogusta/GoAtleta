import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useRenderDiagnostic } from "../../dev/useRenderDiagnostic";
import { Pressable } from "../../ui/Pressable";

type CopilotFabProps = {
  showPulse: boolean;
  pulseAnim: Animated.Value;
  primaryBgColor: string;
  fabBottomOffset: number;
  hintMessage: string | null;
  onPress: () => void;
};

export const CopilotFab = memo(function CopilotFab({
  showPulse,
  pulseAnim,
  primaryBgColor,
  fabBottomOffset,
  hintMessage,
  onPress,
}: CopilotFabProps) {
  useRenderDiagnostic("CopilotFab", { showPulse, fabBottomOffset, primaryBgColor, hasHintMessage: Boolean(hintMessage) });
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.fabWrapper,
        {
          bottom: fabBottomOffset,
        },
      ]}
    >
      {showPulse ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 76,
            maxWidth: 220,
            borderRadius: 999,
            backgroundColor: "rgba(17,17,17,0.92)",
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
            {hintMessage ?? "Nova sugestão útil"}
          </Text>
        </View>
      ) : null}
      {showPulse ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fabPulseRing,
            {
              borderColor: primaryBgColor,
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.28, 0],
              }),
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.14],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Abrir chat"
        accessibilityHint={hintMessage ?? "Abre o copiloto com o contexto da tela atual."}
        style={{
          borderRadius: 999,
          width: 58,
          height: 58,
          backgroundColor: "#111111",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.26,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 7,
        }}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFFFFF" />
        {showPulse ? (
          <View
            style={{
              position: "absolute",
              top: 9,
              right: 9,
              borderRadius: 999,
              width: 8,
              height: 8,
              backgroundColor: primaryBgColor,
            }}
          />
        ) : null}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  fabWrapper: {
    position: "absolute",
    right: 16,
    bottom: 24,
    zIndex: 5200,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPulseRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
});
