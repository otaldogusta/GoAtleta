import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { getSectionCardStyle } from "../../ui/section-styles";

export type DecisionSummaryCardItem = {
  detail?: string;
  label: string;
  tone?: "danger" | "info" | "neutral" | "success" | "warning";
  value: string;
};

export function DecisionSummaryCards({
  items,
}: {
  items: DecisionSummaryCardItem[];
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[
            getSectionCardStyle(colors, "neutral", { radius: 16, shadow: false, padding: 12 }),
            { flexGrow: 1, flexBasis: 220, minHeight: 92 },
          ]}
        >
          <Text style={{ color: colors.muted, fontWeight: "700" }}>{item.label}</Text>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{item.value}</Text>
          {item.detail ? <Text style={{ color: colors.muted, fontSize: 12 }}>{item.detail}</Text> : null}
        </View>
      ))}
    </View>
  );
}
