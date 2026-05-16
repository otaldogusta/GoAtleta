import { memo } from "react";
import { Text, View } from "react-native";

import { Pressable } from "../../../ui/Pressable";
import { radius, shadow } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import type { WeekDaySummary } from "./homeScheduleTypes";

type WeekDaySelectorProps = {
  days: WeekDaySummary[];
  selectedDateKey: string;
  colors: ThemeColors;
  compact?: boolean;
  onSelect: (dateKey: string) => void;
};

export const WeekDaySelector = memo(function WeekDaySelector({
  days,
  selectedDateKey,
  colors,
  compact = false,
  onSelect,
}: WeekDaySelectorProps) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: compact ? 14 : 16,
        shadowColor: shadow.card.shadowColor,
        shadowOpacity: shadow.card.shadowOpacity,
        shadowRadius: shadow.card.shadowRadius,
        shadowOffset: shadow.card.shadowOffset,
        gap: compact ? 12 : 14,
      }}
    >
        <Text style={{ color: colors.textPrimary, fontSize: compact ? 16 : 17, fontWeight: "900" }}>
        Agenda da semana
      </Text>

      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        {days.map((day, index) => {
          const isSelected = day.dateKey === selectedDateKey;
          return (
            <Pressable
              key={day.dateKey}
              onPress={() => onSelect(day.dateKey)}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: compact ? 68 : 78,
                borderRadius: radius.card,
                backgroundColor: isSelected ? colors.successBg : colors.surface,
                borderWidth: isSelected ? 1 : 0,
                borderColor: isSelected ? colors.successBorder : "transparent",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? 4 : 5,
                paddingHorizontal: 8,
                marginRight: index === days.length - 1 ? 0 : 8,
              }}
            >
              <Text
                style={{
                  color: isSelected ? colors.successText : colors.textPrimary,
                  fontSize: compact ? 11 : 12,
                  fontWeight: "800",
                }}
                numberOfLines={1}
              >
                {day.weekdayLabel}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: compact ? 12 : 13, fontWeight: "700" }}>
                {day.dateLabel}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: compact ? 11 : 12 }} numberOfLines={1}>
                {day.lessonCount} {day.lessonCount === 1 ? "aula" : "aulas"}
              </Text>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isSelected ? colors.success : day.isToday ? colors.primaryBg : "transparent",
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
