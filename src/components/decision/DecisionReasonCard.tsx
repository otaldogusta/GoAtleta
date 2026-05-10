import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { getSectionCardStyle } from "../../ui/section-styles";

export function DecisionReasonCard({
  items,
  title,
}: {
  items: { label: string; source: string }[];
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, shadow: false }), { gap: 12 }]}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
      {!items.length ? (
        <Text style={{ color: colors.muted }}>Sem justificativas registradas ainda.</Text>
      ) : (
        items.map((item) => (
          <View key={`${item.source}-${item.label}`} style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Origem: {item.source}</Text>
          </View>
        ))
      )}
    </View>
  );
}
