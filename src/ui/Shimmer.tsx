import { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, Platform, View } from "react-native";
import { useAppTheme } from "./app-theme";

type ShimmerBlockProps = {
  style: StyleProp<ViewStyle>;
};

let shimmerProgress: Animated.Value | null = null;
let shimmerLoop: Animated.CompositeAnimation | null = null;
let shimmerConsumers = 0;
let webShimmerStylesInjected = false;

const WEB_SHIMMER_STYLE_ID = "goatleta-shimmer-keyframes";
const SHIMMER_DURATION_MS = 1600;

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
  progress.setValue(0);
  shimmerLoop = Animated.loop(
    Animated.timing(progress, {
      toValue: 1,
      duration: SHIMMER_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
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
  const anim = useRef<Animated.Value | null>(isWeb ? null : getShimmerProgress()).current;
  const [width, setWidth] = useState(0);
  const glassBase = mode === "dark"
    ? "rgba(255, 255, 255, 0.10)"
    : "rgba(15, 23, 42, 0.06)";
  const glassSheen = mode === "dark"
    ? "rgba(255, 255, 255, 0.22)"
    : "rgba(15, 23, 42, 0.12)";
  const baseColor = glassBase;
  const sheenColor = glassSheen;

  useEffect(() => {
    if (isWeb) {
      ensureWebShimmerStyles();
      return undefined;
    }

    acquireShimmerDriver();
    return () => releaseShimmerDriver();
  }, [isWeb]);

  if (isWeb) {
    const webSheenStyle = {
      position: "absolute",
      top: -6,
      bottom: -6,
      left: 0,
      width: "42%",
      backgroundImage: `linear-gradient(90deg, transparent 0%, ${sheenColor} 52%, transparent 100%)`,
      opacity: 0.7,
      animationName: "goatleta-shimmer-sweep",
      animationDuration: `${SHIMMER_DURATION_MS}ms`,
      animationTimingFunction: "linear",
      animationIterationCount: "infinite",
      willChange: "transform",
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
        <View pointerEvents="none" style={webSheenStyle} />
      </View>
    );
  }

  const shimmerWidth = Math.max(120, width * 0.8);
  const translateX = (anim ?? getShimmerProgress()).interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, width + shimmerWidth],
  });

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        {
          backgroundColor: baseColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -6,
            bottom: -6,
            width: shimmerWidth,
            backgroundColor: sheenColor,
            opacity: 0.18,
            transform: [{ translateX }],
          }}
        />
      ) : null}
    </View>
  );
}
