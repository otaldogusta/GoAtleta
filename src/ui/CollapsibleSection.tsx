import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, View, type ViewStyle } from "react-native";

import { Pressable } from "./Pressable";
import { useCollapsibleAnimation } from "./use-collapsible";

type Props = {
  expanded: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
  rightAdornment?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  headerContentStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  chevronColor: string;
  chevronSize?: number;
  showChevron?: boolean;
  contentTranslateY?: number;
  contentDurationIn?: number;
  contentDurationOut?: number;
  chevronDuration?: number;
};

export function CollapsibleSection({
  expanded,
  onToggle,
  header,
  children,
  rightAdornment,
  containerStyle,
  headerStyle,
  headerContentStyle,
  contentContainerStyle,
  chevronColor,
  chevronSize = 16,
  showChevron = true,
  contentTranslateY = -8,
  contentDurationIn = 220,
  contentDurationOut = 180,
  chevronDuration = 180,
}: Props) {
  const chevronAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const { animatedStyle, isVisible } = useCollapsibleAnimation(expanded, {
    durationIn: contentDurationIn,
    durationOut: contentDurationOut,
    translateY: contentTranslateY,
  });

  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: expanded ? 1 : 0,
      duration: chevronDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [chevronAnim, expanded, chevronDuration]);

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={containerStyle}>
      <Pressable onPress={onToggle} style={headerStyle}>
        <View style={[{ flex: 1 }, headerContentStyle]}>{header}</View>
        {showChevron || rightAdornment ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {rightAdornment}
            {showChevron ? (
              <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                <Ionicons name="chevron-down" size={chevronSize} color={chevronColor} />
              </Animated.View>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      {isVisible ? (
        <Animated.View style={animatedStyle} pointerEvents={expanded ? "auto" : "none"}>
          <View style={contentContainerStyle}>{children}</View>
        </Animated.View>
      ) : null}
    </View>
  );
}
