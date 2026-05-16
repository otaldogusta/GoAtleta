import { memo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { radius, shadow } from "../../../theme/tokens";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";

type Conflict = {
  name: string;
  day: number;
  modality?: string;
  kind: "conflict" | "integration";
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

  const [showIntegrationTooltip, setShowIntegrationTooltip] = useState(false);
  const safeConflicts = conflicts ?? [];
  const parsed = parseTime(item.startTime || "");
  const duration = item.durationMinutes || 60;
  const timeLabel = parsed
    ? `${formatTimeRange(parsed.hour, parsed.minute, duration)} - ${item.name}`
    : item.name;
  const integrationCandidates = safeConflicts.filter((conflict) => conflict.kind === "integration");
  const conflictCandidates = safeConflicts.filter((conflict) => conflict.kind === "conflict");
  const canIntegrate = integrationCandidates.length > 0;
  const hasConflicts = conflictCandidates.length > 0;
  const integrationSummary = integrationCandidates.map((conflict) => conflict.name).join(" + ");
  const conflictSummary = conflictCandidates
    .map((conflict) => `${conflict.name} (${dayNames[conflict.day]})`)
    .join(", ");

  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface ?? colors.background,
          borderColor: colors.borderSubtle ?? colors.border,
        },
      ]}
    >
      {canIntegrate ? (
        <View style={styles.integrationWrap}>
          <Pressable
            style={[
              styles.integrationPill,
              { backgroundColor: colors.successBg ?? colors.primaryBg, borderColor: colors.successBorder ?? colors.primaryBg },
            ]}
            onHoverIn={() => {
              if (Platform.OS === "web") setShowIntegrationTooltip(true);
            }}
            onHoverOut={() => {
              if (Platform.OS === "web") setShowIntegrationTooltip(false);
            }}
          >
            <Text style={[styles.integrationPillText, { color: colors.successText ?? colors.primaryText }]}>
              Integrado
            </Text>
          </Pressable>
          {showIntegrationTooltip ? (
            <View
              style={[
                styles.integrationTooltip,
                {
                  backgroundColor: colors.surfaceElevated ?? colors.card,
                  borderColor: colors.borderSubtle ?? colors.border,
                },
              ]}
            >
              <Text style={[styles.integrationTooltipText, { color: colors.text }]}>
                {integrationSummary}
              </Text>
            </View>
          ) : null}
        </View>
      ) : hasConflicts ? (
        <View style={[styles.conflictPill, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}>
          <Text style={[styles.conflictPillText, { color: colors.dangerText }]}>
            Conflito de horário
          </Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.textPrimary ?? colors.text }]}>{timeLabel}</Text>
          <ClassGenderBadge gender={item.gender} />
        </View>
      </View>

      {hasConflicts ? (
        <Text style={[styles.conflictText, { color: colors.dangerText }]}>
          Conflitos: {conflictSummary}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: radius.container,
    borderWidth: 1,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(10, 19, 34, 0.05)" }
      : {
          shadowColor: shadow.card.shadowColor,
          shadowOpacity: shadow.card.shadowOpacity,
          shadowRadius: shadow.card.shadowRadius,
          shadowOffset: shadow.card.shadowOffset,
        }),
    elevation: shadow.card.elevation,
  },
  conflictPill: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: 6,
  },
  integrationPill: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: 6,
  },
  integrationWrap: {
    alignSelf: "flex-start",
    position: "relative",
    marginBottom: 6,
  },
  conflictPillText: {
    fontWeight: "700",
    fontSize: 11,
  },
  integrationPillText: {
    fontWeight: "700",
    fontSize: 11,
  },
  integrationTooltip: {
    position: "absolute",
    top: -42,
    left: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.internal,
    minWidth: 180,
    maxWidth: 260,
    borderWidth: 1,
    zIndex: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 18px rgba(0, 0, 0, 0.24)" }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.24,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
        }),
  },
  integrationTooltipText: {
    fontSize: 11,
    fontWeight: "600",
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
