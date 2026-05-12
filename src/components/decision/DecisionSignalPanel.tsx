import { Text, View } from "react-native";

import { AppCard } from "../../ui/AppCard";
import { AppEmptyState } from "../../ui/AppEmptyState";
import { useAppTheme } from "../../ui/app-theme";

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
    <AppCard compact>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{subtitle}</Text>
      </View>
      {!items.length ? (
        <AppEmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        items.map((item) => (
          <View key={item.label} style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.label}</Text>
            {item.detail ? <Text style={{ color: colors.muted, fontSize: 12 }}>{item.detail}</Text> : null}
          </View>
        ))
      )}
    </AppCard>
  );
}
