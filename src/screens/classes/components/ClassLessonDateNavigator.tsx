import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";

type ClassLessonDateNavigatorProps = {
  colors: ThemeColors;
  dateLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onOpenCalendar: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  calendarAccessibilityLabel?: string;
  calendarAccessibilityHint?: string;
  testID?: string;
};

export function isTodayLessonDateLabel(dateLabel: string, now = new Date()) {
  const todayLabel = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  return dateLabel === todayLabel;
}

export function ClassLessonDateNavigator({
  colors,
  dateLabel,
  onPrevious,
  onNext,
  onOpenCalendar,
  disabled = false,
  isLoading = false,
  calendarAccessibilityLabel = "Selecionar data da aula",
  calendarAccessibilityHint,
  testID,
}: ClassLessonDateNavigatorProps) {
  const isToday = isTodayLessonDateLabel(dateLabel);

  return (
    <View testID={testID} style={[styles.navigator, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={onPrevious}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Aula anterior"
        style={({ pressed }) => [styles.arrowButton, { borderColor: colors.border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}
      >
        <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={onOpenCalendar}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={calendarAccessibilityLabel}
        accessibilityHint={calendarAccessibilityHint}
        style={({ pressed }) => [styles.dateButton, { opacity: disabled ? 0.55 : pressed ? 0.72 : 1 }]}
      >
        <GoAtletaIcon name="calendar" size={16} color={colors.muted} />
        {isToday ? <Text style={[styles.todayLabel, { color: colors.primaryBg }]}>Hoje</Text> : null}
        <Text style={[styles.dateLabel, { color: colors.text }]}>{dateLabel}</Text>
        {isLoading ? <ActivityIndicator size="small" color={colors.primaryBg} style={styles.loader} /> : null}
      </Pressable>
      <Pressable
        onPress={onNext}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Próxima aula"
        style={({ pressed }) => [styles.arrowButton, { borderColor: colors.border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}
      >
        <GoAtletaIcon name="chevronRight" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  navigator: {
    width: "100%",
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dateButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loader: {
    marginTop: 4,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "800",
  },
  todayLabel: {
    fontSize: 12,
    fontWeight: "900",
  },
});
