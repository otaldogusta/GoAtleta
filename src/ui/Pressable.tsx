import { Platform, Pressable as RNPressable } from "react-native";
import type { PressableProps as RNPressableProps, StyleProp, ViewStyle } from "react-native";

type WebContextMenuHandler = (event: unknown) => void;
type PressableProps = RNPressableProps & {
  onContextMenu?: WebContextMenuHandler;
  suppressWebHoverFeedback?: boolean;
  disableWebPressScale?: boolean;
};

const flattenStyle = (style: unknown): ViewStyle[] => {
  if (!style) return [];
  if (Array.isArray(style)) return (style as unknown[]).flatMap(flattenStyle);
  return [style as ViewStyle];
};

const shouldSkipFeedback = (style: StyleProp<ViewStyle>) => {
  const styles = flattenStyle(style);
  return styles.some((item: ViewStyle) => {
    if (!item) return false;
    const background = item.backgroundColor;
    const inset = item as ViewStyle & { inset?: number };
    const fillsViewport =
      (item.position === "absolute" || item.position === "fixed") &&
      ((inset.inset === 0) ||
        (item.top === 0 && item.right === 0 && item.bottom === 0 && item.left === 0));
    const isOverlay =
      (item.flex === 1 || fillsViewport) &&
      typeof background === "string" &&
      (background.includes("rgba(0,0,0") || background.includes("rgba(0, 0, 0"));
    return isOverlay;
  });
};

const pickBackground = (style: StyleProp<ViewStyle>) => {
  const styles = flattenStyle(style);
  for (let i = styles.length - 1; i >= 0; i -= 1) {
    const item = styles[i];
    if (!item) continue;
    if (
      typeof item.backgroundColor === "string" &&
      item.backgroundColor !== "transparent"
    ) {
      return item.backgroundColor;
    }
  }
  return null;
};

const pickBorderRadius = (style: StyleProp<ViewStyle>) => {
  const defaultWebRadius = 12;
  const styles = flattenStyle(style);
  for (let i = styles.length - 1; i >= 0; i -= 1) {
    const item = styles[i];
    if (!item) continue;
    if (typeof item.borderRadius === "number") return item.borderRadius;
  }

  const merged = Object.assign({}, ...styles);
  if (
    typeof merged.width === "number" &&
    typeof merged.height === "number" &&
    merged.width === merged.height
  ) {
    return 999;
  }
  if (merged.flexDirection === "row" && merged.alignItems === "center") {
    return defaultWebRadius;
  }
  return defaultWebRadius;
};

const webClickableStyle = {
  cursor: "pointer",
  outlineStyle: "none",
} as unknown as ViewStyle;

const getWebFallbackHoverStyle = (style: StyleProp<ViewStyle>) =>
  ({
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderRadius: pickBorderRadius(style),
    overflow: "hidden",
  }) as ViewStyle;

const clamp = (value: number) => Math.max(0, Math.min(255, value));

const parseColor = (value: string) => {
  const hex = value.startsWith("#") ? value.slice(1) : "";
  if (hex.length === 3 || hex.length === 6) {
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b, a: 1 };
  }
  const rgb = value.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/
  );
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    const a = rgb[4] ? Number(rgb[4]) : 1;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b, a };
  }
  return null;
};

const lightenColor = (value: string, amount = 0.06) => {
  if (value === "transparent") return value;
  const parsed = parseColor(value);
  if (!parsed) return value;
  const { r, g, b, a } = parsed;
  const nr = clamp(Math.round(r + (255 - r) * amount));
  const ng = clamp(Math.round(g + (255 - g) * amount));
  const nb = clamp(Math.round(b + (255 - b) * amount));
  return a < 1
    ? `rgba(${nr}, ${ng}, ${nb}, ${a})`
    : `rgb(${nr}, ${ng}, ${nb})`;
};

const darkenColor = (value: string, amount = 0.08) => {
  if (value === "transparent") return value;
  const parsed = parseColor(value);
  if (!parsed) return value;
  const { r, g, b, a } = parsed;
  const nr = clamp(Math.round(r * (1 - amount)));
  const ng = clamp(Math.round(g * (1 - amount)));
  const nb = clamp(Math.round(b * (1 - amount)));
  return a < 1
    ? `rgba(${nr}, ${ng}, ${nb}, ${a})`
    : `rgb(${nr}, ${ng}, ${nb})`;
};

export function Pressable({
  style,
  disabled,
  disableWebPressScale,
  suppressWebHoverFeedback,
  ...rest
}: PressableProps) {
  return (
    <RNPressable
      {...rest}
      disabled={disabled}
      style={(state) => {
        const base =
          typeof style === "function" ? style(state) : style;
        if (disabled || shouldSkipFeedback(base)) return base;

        if (Platform.OS !== "web") {
          return [
            base,
            state.pressed ? { opacity: 0.96 } : null,
          ];
        }

        const isHovered = Boolean((state as typeof state & { hovered?: boolean }).hovered);
        if (suppressWebHoverFeedback) {
          return [
            base,
            webClickableStyle,
            state.pressed && !disableWebPressScale ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : null,
          ];
        }

        const hoveredBg = isHovered ? pickBackground(base) : null;
        const hoverStyle = isHovered && hoveredBg
          ? (() => {
              const parsed = parseColor(hoveredBg);
              const luminance = parsed
                ? (0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b) /
                  255
                : 0;
              if (luminance > 0.82) {
                return { backgroundColor: darkenColor(hoveredBg, 0.12) };
              }
              return { backgroundColor: lightenColor(hoveredBg, 0.08) };
            })()
          : null;
        const fallbackHoverStyle = isHovered && !hoverStyle ? getWebFallbackHoverStyle(base) : null;
        return [
          base,
          webClickableStyle,
          hoverStyle,
          fallbackHoverStyle,
          state.pressed && !disableWebPressScale ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : null,
        ];
      }}
    />
  );
}
