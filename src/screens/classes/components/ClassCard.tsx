import { memo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";

type Conflict = {
  name: string;
  day: number;
};

type ClassCardProps = {
  item: ClassGroup;
  conflicts?: Conflict[] | null;
  dayNames: string[];
  colors: Record<string, string>;
  onOpen: (value: ClassGroup) => void;
};

const parseTime = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const formatTimeRange = (hour: number, minute: number, durationMinutes: number) => {
  const start = hour * 60 + minute;
  const end = start + durationMinutes;
  const endHour = Math.floor(end / 60) % 24;
  const endMinute = end % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hour)}:${pad(minute)} - ${pad(endHour)}:${pad(endMinute)}`;
};

export const ClassCard = memo(function ClassCard({
  item,
  conflicts,
  dayNames,
  colors,
  onOpen,
}: ClassCardProps) {
  markRender("screen.classes.render.classCard", { classId: item.id });

  const safeConflicts = conflicts ?? [];
  const parsed = parseTime(item.startTime || "");
  const duration = item.durationMinutes || 60;
  const timeLabel = parsed
    ? `${formatTimeRange(parsed.hour, parsed.minute, duration)} - ${item.name}`
    : item.name;
  const hasConflicts = safeConflicts.length > 0;

  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      {hasConflicts ? (
        <View style={[styles.conflictPill, { backgroundColor: colors.dangerBg }]}>
          <Text style={[styles.conflictPillText, { color: colors.dangerText }]}>Conflito de horário</Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>{timeLabel}</Text>
          <ClassGenderBadge gender={item.gender} />
        </View>
      </View>

      {hasConflicts ? (
        <Text style={[styles.conflictText, { color: colors.dangerText }]}>
          {"Conflitos: " +
            safeConflicts
              .map((conflict) => `${conflict.name} (${dayNames[conflict.day]})`)
              .join(", ")}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 12px rgba(0, 0, 0, 0.08)" }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
        }),
    elevation: 3,
  },
  conflictPill: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    marginBottom: 6,
  },
  conflictPillText: {
    fontWeight: "700",
    fontSize: 11,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  conflictText: {
    marginTop: 6,
  },
});
