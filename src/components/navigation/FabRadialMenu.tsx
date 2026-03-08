import { useEffect } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import type { RadialAction } from "./tab-config";

type FabRadialMenuProps = {
  visible: boolean;
  actions: RadialAction[];
  anchorBottom: number;
  onActionPress: (action: RadialAction) => void;
};

type RadialActionButtonProps = {
  action: RadialAction;
  index: number;
  total: number;
  progress: Animated.SharedValue<number>;
  onPress: (action: RadialAction) => void;
};

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
  const radius = 118;
  const normalized = total <= 1 ? 0.5 : index / (total - 1);
  const angleDeg = arcStart + (arcEnd - arcStart) * normalized;
  const angle = (angleDeg * Math.PI) / 180;
  const targetX = Math.cos(angle) * radius;
  const targetY = Math.sin(angle) * radius;

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.6, 1]);
    const opacity = interpolate(progress.value, [0, 0.2, 1], [0, 0.2, 1]);
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
          marginLeft: -28,
          width: 56,
          alignItems: "center",
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={() => onPress(action)}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Ionicons name={action.icon} size={21} color={colors.text} />
      </Pressable>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 6,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          fontSize: 11,
          fontWeight: "700",
        }}
      >
        {action.label}
      </Text>
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
        zIndex: 4200,
      }}
    >
      <View style={{ width: "100%", height: 220 }}>
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
