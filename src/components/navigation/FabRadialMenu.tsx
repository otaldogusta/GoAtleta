import { useEffect } from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { radius, shadow } from "../../theme/tokens";
import type { RadialAction } from "./tab-config";

type FabRadialMenuProps = {
  visible: boolean;
  actions: RadialAction[];
  anchorBottom: number;
  onActionPress: (action: RadialAction) => void;
  onClose?: () => void;
};

type RadialActionButtonProps = {
  action: RadialAction;
  index: number;
  total: number;
  progress: SharedValue<number>;
  onPress: (action: RadialAction) => void;
};

const BUTTON_WRAP_WIDTH = 96;

function RadialActionButton({
  action,
  index,
  total,
  progress,
  onPress,
}: RadialActionButtonProps) {
  const { colors } = useAppTheme();
  const arcStart = -160;
  const arcEnd = -20;
  const arcRadius = 120;
  const normalized = total <= 1 ? 0.5 : index / (total - 1);
  const angleDeg = arcStart + (arcEnd - arcStart) * normalized;
  const angle = (angleDeg * Math.PI) / 180;
  const targetX = Math.cos(angle) * arcRadius;
  const targetY = Math.sin(angle) * arcRadius;

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.55, 1]);
    const opacity = interpolate(progress.value, [0, 0.25, 1], [0, 0.3, 1]);
    const x = targetX * progress.value;
    const y = targetY * progress.value;
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: "50%",
          bottom: 0,
          marginLeft: -BUTTON_WRAP_WIDTH / 2,
          width: BUTTON_WRAP_WIDTH,
          alignItems: "center",
          zIndex: 4210,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={() => onPress(action)}
        style={(state) => {
          const isHovered = Boolean((state as typeof state & { hovered?: boolean }).hovered);
          return [
            {
              width: 52,
              height: 52,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isHovered
                ? (colors.backgroundSubtle ?? colors.secondaryBg)
                : (colors.surfaceElevated ?? colors.card),
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isHovered
                ? (colors.primaryBg ?? colors.border)
                : (colors.borderSubtle ?? colors.border),
              transform: [{ scale: state.pressed ? 0.94 : isHovered ? 1.05 : 1 }],
              ...(Platform.OS === "web"
                ? {
                    cursor: "pointer",
                    boxShadow: isHovered
                      ? "0px 10px 24px rgba(0, 0, 0, 0.45), 0px 0px 0px 1px rgba(255, 255, 255, 0.15)"
                      : "0px 8px 22px rgba(0, 0, 0, 0.38), 0px 0px 0px 1px rgba(255, 255, 255, 0.08)",
                  }
                : shadow.elevated),
            },
          ];
        }}
      >
        <GoAtletaIcon name={action.icon} size={20} color={colors.textPrimary ?? colors.text} />
      </Pressable>
      <View
        style={{
          marginTop: 6,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: radius.full,
          backgroundColor: colors.surfaceElevated ?? colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderSubtle ?? colors.border,
          maxWidth: BUTTON_WRAP_WIDTH,
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "web"
            ? {
                boxShadow: "0px 4px 14px rgba(0, 0, 0, 0.35)",
              }
            : shadow.card),
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary ?? colors.text,
            fontSize: 10,
            fontWeight: "800",
            textAlign: "center",
            includeFontPadding: false,
          }}
        >
          {action.label}
        </Text>
      </View>
    </Animated.View>
  );
}

export function FabRadialMenu({
  visible,
  actions,
  anchorBottom,
  onActionPress,
}: FabRadialMenuProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 220 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [progress, visible]);

  return (
    <View
      pointerEvents={visible ? "box-none" : "none"}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: anchorBottom,
        height: 220,
        zIndex: 3100,
      }}
    >
      <View style={{ width: "100%", height: 220, pointerEvents: "box-none" }}>
        {actions.map((action, index) => (
          <RadialActionButton
            key={action.id}
            action={action}
            index={index}
            total={actions.length}
            progress={progress}
            onPress={onActionPress}
          />
        ))}
      </View>
    </View>
  );
}
