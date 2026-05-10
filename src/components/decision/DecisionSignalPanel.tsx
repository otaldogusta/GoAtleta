import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { getSectionCardStyle } from "../../ui/section-styles";

type DecisionSignalItem = {
  detail?: string;
  label: string;
};

export function DecisionSignalPanel({
  emptyDescription,
  emptyTitle,
  items,
  subtitle,
  title,
}: {
  emptyDescription: string;
  emptyTitle: string;
  items: DecisionSignalItem[];
  subtitle: string;
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, shadow: false }), { gap: 12 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.muted }}>{subtitle}</Text>
      </View>
      {!items.length ? (
        <>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{emptyTitle}</Text>
          <Text style={{ color: colors.muted }}>{emptyDescription}</Text>
        </>
      ) : (
        items.map((item) => (
          <View key={item.label} style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.label}</Text>
            {item.detail ? <Text style={{ color: colors.muted, fontSize: 12 }}>{item.detail}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}
