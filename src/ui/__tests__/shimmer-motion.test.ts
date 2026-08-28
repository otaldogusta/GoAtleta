import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shimmerSource = readFileSync(resolve(__dirname, "../Shimmer.tsx"), "utf8");

describe("shimmer motion", () => {
  it("keeps the Android pulse on the native driver without blocking interactions", () => {
    expect(shimmerSource).toContain('useNativeDriver: isNativeAnimation');
    expect(shimmerSource).toContain("isInteraction: false");
    expect(shimmerSource).toContain('pointerEvents="none"');
  });

  it("uses a visible pulse instead of a sharp translated block on native", () => {
    expect(shimmerSource).toContain('inputRange: [0, 0.5, 1]');
    expect(shimmerSource).toContain('mode === "dark" ? [0.05, 0.52, 0.05] : [0.04, 0.4, 0.04]');
    expect(shimmerSource).not.toContain("transform: [{ translateX }]");
  });

  it("stops the loop and renders a stable state when reduced motion is enabled", () => {
    expect(shimmerSource).toContain("AccessibilityInfo.isReduceMotionEnabled()");
    expect(shimmerSource).toContain('"reduceMotionChanged"');
    expect(shimmerSource).toContain("if (prefersReducedMotion) return undefined");
    expect(shimmerSource).toContain('animationName: prefersReducedMotion ? "none"');
  });
});
