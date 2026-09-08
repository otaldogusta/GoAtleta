import { memo } from "react";
import { Animated, Platform, StyleSheet,  View } from "react-native";

import { useRenderDiagnostic } from "../../dev/useRenderDiagnostic";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useDraggableCopilotFab } from "./useDraggableCopilotFab";

export const COPILOT_FAB_SIZE = 58;
export const COPILOT_FAB_RIGHT = 16;
export const COPILOT_FAB_STACK_GAP = 12;

export function resolveCopilotFabBottom(insetBottom: number) {
  return Math.max(insetBottom + 92, 108);
}

export function resolveCopilotCompanionFabBottom(insetBottom: number) {
  return resolveCopilotFabBottom(insetBottom) + COPILOT_FAB_SIZE + COPILOT_FAB_STACK_GAP;
}

type CopilotFabProps = {
  showPulse: boolean;
  hasBadge?: boolean;
  pulseAnim: Animated.Value;
  primaryBgColor: string;
  fabBottomOffset: number;
  hintMessage: string | null;
  onPress: () => void;
};

export const CopilotFab = memo(function CopilotFab({
  showPulse,
  hasBadge = false,
  pulseAnim,
  primaryBgColor,
  fabBottomOffset,
  hintMessage,
  onPress,
}: CopilotFabProps) {
  useRenderDiagnostic("CopilotFab", { showPulse, hasBadge, fabBottomOffset, primaryBgColor, hasHintMessage: Boolean(hintMessage) });
  const showIndicator = hasBadge || showPulse;
  const drag = useDraggableCopilotFab(fabBottomOffset);
  return (
    <Animated.View
      ref={drag.wrapperRef}
      {...drag.panHandlers}
      style={[
        styles.fabWrapper,
        Platform.OS === "web" ? ({ position: "fixed" } as any) : null,
        {
          left: drag.position.x,
          top: drag.position.y,
          pointerEvents: "box-none",
        },
      ]}
    >
      {showPulse ? (
        <Animated.View
          style={[
            styles.fabPulseRing,
            {
              borderColor: primaryBgColor,
              pointerEvents: "none",
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 0],
              }),
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.18],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      <Pressable
        onPress={() => { if (drag.canOpen()) onPress(); }}
        accessibilityRole="button"
        accessibilityLabel="Abrir chat"
        accessibilityHint={`${hintMessage ?? "Abre o copiloto com o contexto da tela atual."} Arraste para reposicionar. No teclado, use Alt e as setas.`}
        style={{
          borderRadius: 999,
          width: COPILOT_FAB_SIZE,
          height: COPILOT_FAB_SIZE,
          backgroundColor: "#111111",
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "web"
            ? { boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.26)" }
            : {
                shadowColor: "#000",
                shadowOpacity: 0.26,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
                elevation: 7,
              }),
        }}
      >
        <GoAtletaIcon
          name="chat"
          size={28}
          color="#FFFFFF"
        />
        {showIndicator ? (
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
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fabWrapper: {
    position: "absolute",
    width: COPILOT_FAB_SIZE,
    height: COPILOT_FAB_SIZE,
    ...(Platform.OS === "web" ? { touchAction: "none" as const } : {}),
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
