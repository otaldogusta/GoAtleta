import { useEffect, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { AccessibilityInfo, Animated, Easing, Platform, View } from "react-native";
import { useAppTheme } from "./app-theme";

type ShimmerBlockProps = {
  style: StyleProp<ViewStyle>;
};

let shimmerProgress: Animated.Value | null = null;
let shimmerLoop: Animated.CompositeAnimation | null = null;
let shimmerConsumers = 0;
let webShimmerStylesInjected = false;

const WEB_SHIMMER_STYLE_ID = "goatleta-shimmer-keyframes";
const SHIMMER_DURATION_MS = 1250;

const ensureWebShimmerStyles = () => {
  if (Platform.OS !== "web" || webShimmerStylesInjected) return;

  const documentRef = (globalThis as unknown as {
    document?: {
      getElementById: (id: string) => unknown;
      createElement: (tagName: string) => { id: string; textContent: string | null };
      head?: { appendChild: (node: unknown) => void };
      body?: { appendChild: (node: unknown) => void };
    };
  }).document;

  if (!documentRef || documentRef.getElementById(WEB_SHIMMER_STYLE_ID)) {
    webShimmerStylesInjected = true;
    return;
  }

  const styleElement = documentRef.createElement("style");
  styleElement.id = WEB_SHIMMER_STYLE_ID;
  styleElement.textContent = `
    @keyframes goatleta-shimmer-sweep {
      0% { transform: translate3d(-140%, 0, 0) skewX(-10deg); }
      100% { transform: translate3d(340%, 0, 0) skewX(-10deg); }
    }
  `;
  (documentRef.head ?? documentRef.body)?.appendChild(styleElement);
  webShimmerStylesInjected = true;
};

const getShimmerProgress = () => {
  if (!shimmerProgress) {
    shimmerProgress = new Animated.Value(0);
  }
  return shimmerProgress;
};

const startShimmerLoop = () => {
  if (shimmerLoop) return;
  const progress = getShimmerProgress();
  const isNativeAnimation = Platform.OS === "ios" || Platform.OS === "android";
  shimmerLoop = Animated.loop(
    Animated.timing(progress, {
      toValue: 1,
      duration: SHIMMER_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: isNativeAnimation,
      isInteraction: false,
    })
  );
  shimmerLoop.start();
};

const stopShimmerLoop = () => {
  if (!shimmerLoop) return;
  shimmerLoop.stop();
  shimmerLoop = null;
  getShimmerProgress().setValue(0);
};

const acquireShimmerDriver = () => {
  shimmerConsumers += 1;
  if (shimmerConsumers === 1) {
    startShimmerLoop();
  }
};

const releaseShimmerDriver = () => {
  shimmerConsumers = Math.max(0, shimmerConsumers - 1);
  if (shimmerConsumers === 0) {
    stopShimmerLoop();
  }
};

export function ShimmerBlock({ style }: ShimmerBlockProps) {
  const { mode } = useAppTheme();
  const isWeb = Platform.OS === "web";
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [anim] = useState(() => isWeb ? null : getShimmerProgress());
  const glassBase = mode === "dark"
    ? "rgba(255, 255, 255, 0.10)"
    : "rgba(15, 23, 42, 0.06)";
  const glassSheen = mode === "dark"
    ? "rgba(255, 255, 255, 0.22)"
    : "rgba(15, 23, 42, 0.12)";
  const baseColor = glassBase;
  const sheenColor = glassSheen;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setPrefersReducedMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setPrefersReducedMotion
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    if (isWeb) {
      ensureWebShimmerStyles();
      return undefined;
    }

    acquireShimmerDriver();
    return () => releaseShimmerDriver();
  }, [isWeb, prefersReducedMotion]);

  if (isWeb) {
    const webSheenStyle = {
      position: "absolute",
      top: -6,
      bottom: -6,
      left: 0,
      width: "42%",
      backgroundImage: `linear-gradient(90deg, transparent 0%, ${sheenColor} 52%, transparent 100%)`,
      opacity: 0.7,
      animationName: prefersReducedMotion ? "none" : "goatleta-shimmer-sweep",
      animationDuration: `${SHIMMER_DURATION_MS}ms`,
      animationTimingFunction: "linear",
      animationIterationCount: "infinite",
      willChange: "transform",
      pointerEvents: "none",
    } as ViewStyle;

    return (
      <View
        style={[
          {
            backgroundColor: baseColor,
            overflow: "hidden",
          },
          style,
        ]}
      >
        <View style={webSheenStyle} />
      </View>
    );
  }

  const sheenOpacity = prefersReducedMotion
    ? mode === "dark" ? 0.18 : 0.13
    : (anim ?? getShimmerProgress()).interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: mode === "dark" ? [0.05, 0.52, 0.05] : [0.04, 0.4, 0.04],
      });

  return (
    <View
      style={[
        {
          backgroundColor: baseColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: sheenColor,
          opacity: sheenOpacity,
        }}
      />
    </View>
  );
}
