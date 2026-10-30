import { View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import type { FamilyScheduleItem } from "../../api/family-access";
import { compactUiMetrics as metrics } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { FamilySurface } from "./FamilyUi";

const formatScheduleDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
};

const formatScheduleTime = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
};

export function FamilyScheduleItemCard({ item, padding = 12 }: { item: FamilyScheduleItem; padding?: number }) {
  const { colors } = useAppTheme();
  const startsAt = formatScheduleTime(item.startsAt);
  const endsAt = formatScheduleTime(item.endsAt);
  const time = startsAt ? `${startsAt}${endsAt ? `–${endsAt}` : ""}` : "Horário não informado";

  return (
    <FamilySurface padding={padding}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: metrics.gap }}>
        <View style={{ minWidth: 0, flex: 1, gap: metrics.smallGap }}>
          <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "700" }}>{item.className ?? "Atividade"}</Text>
          <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>{formatScheduleDate(item.startsAt)}</Text>
        </View>
        <View style={{ maxWidth: "50%", minWidth: 0, alignItems: "flex-end", gap: metrics.smallGap }}>
          <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "600", textAlign: "right" }}>{time}</Text>
          {item.sessionType ? <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight, textAlign: "right" }}>{item.sessionType}</Text> : null}
        </View>
      </View>
    </FamilySurface>
  );
}
