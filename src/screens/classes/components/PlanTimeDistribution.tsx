import { Text, View } from "react-native";
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
}: {
  colors: ThemeColors;
  items: PlanTimeDistributionItem[];
}) {
  const visibleItems = items.filter((item) => item.minutes > 0);
  const totalMinutes = visibleItems.reduce((sum, item) => sum + item.minutes, 0);
  const total = Math.max(1, totalMinutes);
  const radius = 42;
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

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
      <View style={{ width: 112, height: 112, alignItems: "center", justifyContent: "center" }}>
        <Svg
          width={112}
          height={112}
          style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
          accessibilityLabel="Distribuição do tempo da aula"
        >
          <Circle cx={56} cy={56} r={radius} fill="none" stroke={colors.secondaryBg} strokeWidth={10} />
          {segments.map((item) => {
            return (
              <Circle
                key={`${item.label}-${item.index}`}
                cx={56}
                cy={56}
                r={radius}
                fill="none"
                stroke={DISTRIBUTION_COLORS[item.index % DISTRIBUTION_COLORS.length]}
                strokeWidth={10}
                strokeDasharray={`${Math.max(0, item.length - 2)} ${circumference}`}
                strokeDashoffset={-item.offset}
                strokeLinecap="butt"
              />
            );
          })}
        </Svg>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{totalMinutes}</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>min</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
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
      </View>
    </View>
  );
}
