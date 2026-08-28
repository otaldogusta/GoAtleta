import { type RefObject, useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { useAppTheme } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { radius } from "../../../theme/tokens";

export type TrainingFabMenuLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const TRAINING_FAB_MENU_WIDTH = 220;

export function resolveTrainingFabMenuLayout(
  x: number,
  y: number,
  width: number,
  height: number,
): TrainingFabMenuLayout | null {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: Math.max(16, x + width - TRAINING_FAB_MENU_WIDTH),
    y,
    width: TRAINING_FAB_MENU_WIDTH,
    height,
  };
}

type TrainingFabMenuProps = {
  visible: boolean;
  importBusy?: boolean;
  anchorRef: RefObject<View | null>;
  layout: TrainingFabMenuLayout | null;
  onClose: () => void;
  onCreatePress: () => void;
  onImportPress: () => void;
};

export function TrainingFabMenu({
  visible,
  importBusy = false,
  anchorRef,
  layout,
  onClose,
  onCreatePress,
  onImportPress,
}: TrainingFabMenuProps) {
  const { colors } = useAppTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      Promise.resolve().then(() => {
        setMounted(true);
      });
      Animated.timing(anim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (!mounted) return;
    Animated.timing(anim, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [anim, mounted, visible]);

  if (!mounted) return null;

  return (
    <AnchoredDropdown
      visible={mounted}
      layout={layout}
      container={null}
      animationStyle={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      }}
      zIndex={3190}
      maxHeight={104}
      nestedScrollEnabled={false}
      density="menu"
      interactiveRefs={[anchorRef]}
      onRequestClose={onClose}
      showVerticalScrollIndicator={false}
      panelStyle={{ backgroundColor: colors.card }}
      scrollContentStyle={{ padding: 6, gap: 8 }}
    >
      <Pressable
        onPress={onCreatePress}
        style={{
          borderWidth: 1,
          borderColor: colors.primaryBg,
          backgroundColor: colors.primaryBg,
          borderRadius: radius.internal,
          paddingHorizontal: 9,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <GoAtletaIcon name="calendar" size={16} color={colors.primaryText} />
        <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: "700" }}>
          Criar treino
        </Text>
      </Pressable>
      <Pressable
        disabled={importBusy}
        onPress={onImportPress}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          borderRadius: radius.internal,
          paddingHorizontal: 9,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          opacity: importBusy ? 0.65 : 1,
        }}
      >
        <GoAtletaIcon name="upload" size={16} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
          {importBusy ? "Importando..." : "Importar planilha"}
        </Text>
      </Pressable>
    </AnchoredDropdown>
  );
}
