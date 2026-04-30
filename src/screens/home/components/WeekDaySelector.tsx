import { memo } from "react";
import { Text, View } from "react-native";

import { Pressable } from "../../../ui/Pressable";
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
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.06)",
        padding: compact ? 14 : 16,
        shadowColor: "#0F172A",
        shadowOpacity: 0.05,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        gap: compact ? 12 : 14,
      }}
    >
        <Text style={{ color: "#101827", fontSize: compact ? 16 : 17, fontWeight: "800" }}>
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
                borderRadius: 14,
                backgroundColor: isSelected ? "#EEF5F1" : "#FFFFFF",
                borderWidth: isSelected ? 1 : 0,
                borderColor: isSelected ? "rgba(28,112,84,0.18)" : "transparent",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? 4 : 5,
                paddingHorizontal: 8,
                marginRight: index === days.length - 1 ? 0 : 8,
              }}
            >
              <Text
                style={{
                  color: isSelected ? "#1B7A5E" : "#222B38",
                  fontSize: compact ? 11 : 12,
                  fontWeight: "800",
                }}
                numberOfLines={1}
              >
                {day.weekdayLabel}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: compact ? 12 : 13, fontWeight: "700" }}>
                {day.dateLabel}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: compact ? 11 : 12 }} numberOfLines={1}>
                {day.lessonCount} {day.lessonCount === 1 ? "aula" : "aulas"}
              </Text>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isSelected ? "#1B7A5E" : day.isToday ? colors.primaryBg : "transparent",
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
