import { memo, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { LocationBadge } from "../../../ui/LocationBadge";
import { Pressable } from "../../../ui/Pressable";
import { getUnitPalette } from "../../../ui/unit-colors";

type AgendaCardItem = {
  classId: string;
  className: string;
  unit: string;
  gender: ClassGroup["gender"] | null;
  dateLabel: string;
  endTime: number;
  timeLabel: string;
};

type AgendaCardProps = {
  item: AgendaCardItem;
  label: string;
  isPast: boolean;
  isActive: boolean;
  isLast: boolean;
  showDivider: boolean;
  agendaCardWidth: number;
  agendaCardGap: number;
  activeBorderColor: string;
  colors: Record<string, string>;
  mode: "light" | "dark";
  onPress: () => void;
};

export const AgendaCard = memo(function AgendaCard({
  item,
  label,
  isPast,
  isActive,
  isLast,
  showDivider,
  agendaCardWidth,
  agendaCardGap,
  activeBorderColor,
  colors,
  mode,
  onPress,
}: AgendaCardProps) {
  markRender("screen.home.render.agendaCard", { classId: item.classId });

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        width: agendaCardWidth,
        marginRight: isLast ? 0 : agendaCardGap,
      },
      Platform.OS === "web" ? styles.webSnap : null,
    ],
    [agendaCardGap, agendaCardWidth, isLast]
  );

  return (
    <View style={containerStyle}>
      {showDivider ? (
        <View
          pointerEvents="none"
          style={[
            styles.divider,
            {
              left: -Math.max(4, Math.round(agendaCardGap / 2)),
              backgroundColor: colors.border,
            },
          ]}
        />
      ) : null}
      <Pressable onPress={onPress}>
        <View
          style={[
            styles.outerCard,
            isActive && Platform.OS !== "android"
              ? {
                  shadowColor: mode === "dark" ? colors.primaryBg : "#000",
                  shadowOpacity: mode === "dark" ? 0.42 : 0.12,
                  shadowRadius: mode === "dark" ? 12 : 6,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: mode === "dark" ? 8 : 3,
                }
              : null,
          ]}
        >
          <View
            style={[
              styles.innerCard,
              {
                backgroundColor: colors.card,
                borderColor: isActive ? activeBorderColor : colors.border,
                opacity: isPast ? 0.6 : 1,
              },
            ]}
          >
            <View style={styles.content}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: colors.secondaryBg, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.statusText, { color: colors.text }]}>{label}</Text>
                </View>
                <Text style={[styles.dateText, { color: colors.muted }]} numberOfLines={1}>
                  {item.dateLabel}
                </Text>
              </View>

              <View style={styles.classRow}>
                <Text style={[styles.className, { color: colors.text }]} numberOfLines={1}>
                  {item.className}
                </Text>
                <LocationBadge
                  location={item.unit ?? ""}
                  palette={getUnitPalette(item.unit ?? "Sem unidade", colors)}
                  size="sm"
                  showIcon={true}
                />
              </View>

              <View style={styles.metaRow}>
                {item.gender ? <ClassGenderBadge gender={item.gender} size="sm" /> : null}
                <Text style={[styles.timeText, { color: colors.muted }]}>{item.timeLabel}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  webSnap: {
    scrollSnapAlign: "start",
  },
  divider: {
    position: "absolute",
    top: 10,
    bottom: 10,
    width: 1,
    borderRadius: 999,
    opacity: 0.9,
  },
  outerCard: {
    borderRadius: 14,
    backgroundColor: "transparent",
  },
  innerCard: {
    padding: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  content: {
    gap: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  statusPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 11,
  },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  className: {
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
