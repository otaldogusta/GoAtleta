import { Animated, Platform, StyleSheet } from "react-native";
import { COPILOT_FAB_SIZE } from "../../../copilot/components/CopilotFab";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { useDraggableFab } from "../../../ui/useDraggableFab";
import { createWebPortal } from "../../../ui/web-portal";

export function ClassNavigationFab({ colors, bottom, onPress }: {
  colors: ThemeColors;
  bottom: number;
  onPress: () => void;
}) {
  const { position, wrapperRef, panHandlers, canOpen } = useDraggableFab(bottom, "class-navigation-fab-position:v1");
  const button = (
    <Animated.View
      ref={wrapperRef}
      {...panHandlers}
      style={[
        styles.wrapper,
        Platform.OS === "web" ? ({ position: "fixed", touchAction: "none" } as any) : null,
        { left: position.x, top: position.y },
      ]}
    >
      <Pressable
        onPress={() => { if (canOpen()) onPress(); }}
        accessibilityRole="button"
        accessibilityLabel="Abrir menu da turma"
        accessibilityHint="Arraste para reposicionar. No teclado, use Alt e as setas."
        style={({ pressed }) => [styles.button, {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.76 : 1,
        }]}
      >
        <GoAtletaIcon name="list" size={24} color={colors.primaryBg} />
      </Pressable>
    </Animated.View>
  );
  return Platform.OS === "web" && typeof document !== "undefined"
    ? createWebPortal(button, document.body)
    : button;
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    width: COPILOT_FAB_SIZE,
    height: COPILOT_FAB_SIZE,
    zIndex: 5100,
    elevation: 12,
  },
  button: {
    width: COPILOT_FAB_SIZE,
    height: COPILOT_FAB_SIZE,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
