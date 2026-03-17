import { Ionicons } from "@expo/vector-icons";
import { Animated, StyleSheet, View } from "react-native";

import { Pressable } from "../../ui/Pressable";

type CopilotFabProps = {
  hasUnreadUpdates: boolean;
  pulseAnim: any;
  primaryBgColor: string;
  fabBottomOffset: number;
  onPress: () => void;
};

export function CopilotFab({
  hasUnreadUpdates,
  pulseAnim,
  primaryBgColor,
  fabBottomOffset,
  onPress,
}: CopilotFabProps) {
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
      {hasUnreadUpdates ? (
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
        {hasUnreadUpdates ? (
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
}

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
