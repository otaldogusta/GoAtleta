import { Pressable as RNPressable } from "react-native";
import type { PressableProps as RNPressableProps, StyleProp, ViewStyle } from "react-native";

type WebContextMenuHandler = (event: unknown) => void;
type PressableProps = RNPressableProps & {
  onContextMenu: WebContextMenuHandler;
};

const flattenStyle = (style: StyleProp<ViewStyle>) => {
  if (!style) return [];
  if (Array.isArray(style)) return style.flatMap(flattenStyle);
  return [style];
};

const shouldSkipFeedback = (style: StyleProp<ViewStyle>) => {
  const styles = flattenStyle(style);
  return styles.some((item) => {
    if (!item) return false;
    const background = item.backgroundColor;
    const isOverlay =
      item.flex === 1 &&
      typeof background === "string" &&
      background.includes("rgba(0,0,0");
    return isOverlay;
  });
};

const pickBackground = (style: StyleProp<ViewStyle>) => {
  const styles = flattenStyle(style);
  for (let i = styles.length - 1; i >= 0; i -= 1) {
    const item = styles[i];
    if (!item) continue;
    if (typeof item.backgroundColor === "string") {
      return item.backgroundColor;
    }
  }
  return null;
};

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
        const hoveredBg = state.hovered ? pickBackground(base) : null;
        const hoverStyle = state.hovered && hoveredBg
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
        return [
          base,
          hoverStyle,
          state.pressed ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : null,
        ];
      }}
    />
  );
}
