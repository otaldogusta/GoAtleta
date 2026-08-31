import { Text, View } from "react-native";

import type { FamilyScheduleItem } from "../../api/family-access";
import { spacing } from "../../theme/tokens";
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

export function FamilyScheduleItemCard({ item }: { item: FamilyScheduleItem }) {
  const { colors } = useAppTheme();
  const startsAt = formatScheduleTime(item.startsAt);
  const endsAt = formatScheduleTime(item.endsAt);
  const time = startsAt ? `${startsAt}${endsAt ? `–${endsAt}` : ""}` : "Horário não informado";

  return (
    <FamilySurface
      eyebrow={formatScheduleDate(item.startsAt)}
      title={item.className ?? "Atividade"}
    >
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
          {time}
        </Text>
        {item.sessionType ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {item.sessionType}
          </Text>
        ) : null}
      </View>
    </FamilySurface>
  );
}
