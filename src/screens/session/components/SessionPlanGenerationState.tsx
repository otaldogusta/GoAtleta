import { Animated, Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";

type AnimatedNode = Animated.Value | Animated.AnimatedInterpolation<string | number>;

type SessionPlanGenerationStateProps = {
  colors: ThemeColors;
  label: string;
  subtitle: string;
  dots: readonly [AnimatedNode, AnimatedNode, AnimatedNode];
  pulse: Animated.AnimatedInterpolation<string | number>;
  animation: Animated.Value;
  showBlockSkeletons: boolean;
};

const skeletonSections = [
  { key: "warmup", label: "Aquecimento", accent: "warningText", width: "52%" },
  { key: "main", label: "Parte principal", accent: "primaryBg", width: "68%" },
  { key: "cooldown", label: "Volta a calma", accent: "successText", width: "46%" },
] as const;

export function SessionPlanGenerationState({
  colors,
  label,
  subtitle,
  dots,
  pulse,
  animation,
  showBlockSkeletons,
}: SessionPlanGenerationStateProps) {
  return (
    <>
      <View
        style={{
          padding: showBlockSkeletons ? 14 : undefined,
          paddingVertical: showBlockSkeletons ? undefined : 12,
          paddingHorizontal: showBlockSkeletons ? undefined : 14,
          borderRadius: showBlockSkeletons ? 18 : 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: showBlockSkeletons ? colors.card : colors.secondaryBg,
          gap: showBlockSkeletons ? 8 : 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: showBlockSkeletons ? 14 : 13, fontWeight: "800" }}>
            {label}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {dots.map((dotOpacity, index) => (
              <Animated.View
                key={`plan-generation-dot-${index}`}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.primaryBg,
                  opacity: dotOpacity,
                }}
              />
            ))}
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {subtitle}
        </Text>
      </View>

      {showBlockSkeletons
        ? skeletonSections.map((section, index) => {
            const borderColor = colors[section.accent];

            return (
              <Animated.View
                key={section.key}
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor,
                  gap: 10,
                  opacity: pulse,
                  transform: [
                    {
                      translateY: animation.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, index % 2 === 0 ? -2 : 2, 0],
                      }),
                    },
                  ],
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    {section.label}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View
                      style={{
                        width: 54,
                        height: 24,
                        borderRadius: 999,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                    <View
                      style={{
                        width: 68,
                        height: 24,
                        borderRadius: 999,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                  </View>
                </View>
                <View
                  style={{
                    width: section.width,
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                />
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      width: "82%",
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  />
                  <View
                    style={{
                      width: "61%",
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  />
                </View>
              </Animated.View>
            );
          })
        : null}
    </>
  );
}
