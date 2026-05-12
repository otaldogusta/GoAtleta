import { Text, View } from "react-native";

import { AppCard } from "../../ui/AppCard";
import { AppEmptyState } from "../../ui/AppEmptyState";
import { useAppTheme } from "../../ui/app-theme";

export function DecisionReasonCard({
  items,
  title,
}: {
  items: { label: string; source: string }[];
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <AppCard compact>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{title}</Text>
      {!items.length ? (
        <AppEmptyState title="Sem prioridade definida" description="Os sinais aparecem quando houver contexto suficiente." />
      ) : (
        items.map((item) => (
          <View key={`${item.source}-${item.label}`} style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Origem: {item.source}</Text>
          </View>
        ))
      )}
    </AppCard>
  );
}
