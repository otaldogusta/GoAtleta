import { useState } from "react";
import { Platform, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import type { ThemeColors } from "../../../ui/app-theme";

export type PlanTimeDistributionItem = {
  label: string;
  minutes: number;
};

const DISTRIBUTION_COLORS = ["#67A9FF", "#7BD66B", "#B784F7", "#F1B44C"];

export function PlanTimeDistribution({
  colors,
  items,
  compact = false,
  showLegend = true,
  showHoverTooltip = false,
}: {
  colors: ThemeColors;
  items: PlanTimeDistributionItem[];
  compact?: boolean;
  showLegend?: boolean;
  showHoverTooltip?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const visibleItems = items.filter((item) => item.minutes > 0);
  const totalMinutes = visibleItems.reduce((sum, item) => sum + item.minutes, 0);
  const total = Math.max(1, totalMinutes);
  const size = compact ? 84 : 112;
  const center = size / 2;
  const radius = compact ? 31 : 42;
  const strokeWidth = compact ? 8 : 10;
  const circumference = 2 * Math.PI * radius;
  const segments = visibleItems.map((item, index) => ({
    ...item,
    index,
    length: (item.minutes / total) * circumference,
    offset:
      visibleItems
        .slice(0, index)
        .reduce((sum, previous) => sum + (previous.minutes / total) * circumference, 0),
  }));

  const activeItem = activeIndex === null ? null : segments[activeIndex];
  const webHoverProps = Platform.OS === "web" && showHoverTooltip
    ? {
        onMouseMove: (event: any) => {
          const target = event.currentTarget as HTMLElement | null;
          const rect = target?.getBoundingClientRect?.();
          if (!rect) return;
          const x = Number(event.nativeEvent?.clientX ?? event.clientX) - rect.left - center;
          const y = Number(event.nativeEvent?.clientY ?? event.clientY) - rect.top - center;
          const distance = Math.sqrt(x * x + y * y);
          if (distance < radius - strokeWidth || distance > radius + strokeWidth) {
            setActiveIndex(null);
            return;
          }
          const clockwiseAngle = (Math.atan2(y, x) * 180) / Math.PI + 90;
          const position = (((clockwiseAngle % 360) + 360) % 360) / 360 * circumference;
          const hovered = segments.find((segment) => position >= segment.offset && position <= segment.offset + segment.length);
          setActiveIndex(hovered?.index ?? null);
        },
        onMouseLeave: () => setActiveIndex(null),
      }
    : {};

  return (
    <View style={{ position: "relative", flexDirection: "row", alignItems: "center", gap: compact ? 10 : 18, overflow: "visible" }}>
      <View
        {...webHoverProps}
        style={{ width: size, height: size, alignItems: "center", justifyContent: "center", overflow: "visible" }}
      >
        <Svg
          width={size}
          height={size}
          style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
          accessibilityLabel="Distribuição do tempo da aula"
        >
          <Circle cx={center} cy={center} r={radius} fill="none" stroke={colors.secondaryBg} strokeWidth={strokeWidth} />
          {segments.map((item) => (
            <Circle
              key={`${item.label}-${item.index}`}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={DISTRIBUTION_COLORS[item.index % DISTRIBUTION_COLORS.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${Math.max(0, item.length - 2)} ${circumference}`}
              strokeDashoffset={-item.offset}
              strokeLinecap="butt"
            />
          ))}
        </Svg>
        <Text style={{ color: colors.text, fontSize: compact ? 15 : 17, fontWeight: "900" }}>{totalMinutes}</Text>
        <Text style={{ color: colors.muted, fontSize: compact ? 9 : 10 }}>min</Text>
      </View>
      {showLegend ? <View style={{ flex: 1, gap: 8 }}>
        {visibleItems.map((item, index) => (
          <View key={`${item.label}-${index}`} style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 3,
                backgroundColor: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10 }}>{item.label}</Text>
              <Text style={{ color: colors.muted, fontSize: 9 }}>
                {item.minutes} min · {Math.round((item.minutes / total) * 100)}%
              </Text>
            </View>
          </View>
        ))}
      </View> : null}
      {showHoverTooltip && activeItem ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: size - 5,
            top: Math.max(4, size / 2 - 25),
            zIndex: 20,
            minWidth: 128,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            gap: 3,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: DISTRIBUTION_COLORS[activeItem.index % DISTRIBUTION_COLORS.length] }} />
            <Text style={{ color: colors.text, fontSize: 9, fontWeight: "800" }}>{activeItem.label}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 9 }}>
            {activeItem.minutes} min · {Math.round((activeItem.minutes / total) * 100)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}
