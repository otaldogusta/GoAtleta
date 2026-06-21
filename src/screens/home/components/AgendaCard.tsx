import { memo, useCallback, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { LocationBadge } from "../../../ui/LocationBadge";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
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
  index: number;
  item: AgendaCardItem;
  label: string;
  isPast: boolean;
  isActive: boolean;
  isLast: boolean;
  showDivider: boolean;
  agendaCardWidth: number;
  agendaCardGap: number;
  colors: ThemeColors;
  mode: "light" | "dark";
  onCardPress: (index: number) => void;
};

export const AgendaCard = memo(function AgendaCard({
  index,
  item,
  label,
  isPast,
  isActive,
  isLast,
  showDivider,
  agendaCardWidth,
  agendaCardGap,
  colors,
  mode,
  onCardPress,
}: AgendaCardProps) {
  markRender("screen.home.render.agendaCard", { classId: item.classId, index });

  const handlePress = useCallback(() => onCardPress(index), [index, onCardPress]);
  const isCompactCard = agendaCardWidth <= 260;
  const isVeryCompactCard = agendaCardWidth <= 200;
  const isWebCard = Platform.OS === "web";
  const dateTimeLabel = useMemo(
    () => [item.dateLabel, item.timeLabel].filter(Boolean).join("  •  "),
    [item.dateLabel, item.timeLabel]
  );
  const isDark = mode === "dark";
  const cardBackground = isDark ? colors.surfaceElevated : colors.card;
  const inactiveBadgeBackground = isDark ? "rgba(148, 163, 184, 0.14)" : colors.secondaryBg;
  const badgeBackground = isActive ? colors.primaryBg : inactiveBadgeBackground;
  const badgeBorder = isActive ? colors.primaryBg : colors.border;
  const badgeText = isActive ? colors.primaryText : colors.text;
  const cardText = isPast ? colors.muted : colors.text;

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        width: agendaCardWidth,
        marginRight: isLast ? 0 : agendaCardGap,
      },
      Platform.OS === "web" ? ({ scrollSnapAlign: "start" } as any) : null,
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
      <Pressable onPress={handlePress}>
        <View
          style={[
            styles.outerCard,
            isWebCard ? styles.outerCardWeb : null,
          ]}
        >
          <View
            pointerEvents="none"
            style={styles.statusBadgeSlot}
          >
            <View style={[styles.statusBadge, isCompactCard ? styles.statusBadgeCompact : null, { backgroundColor: badgeBackground, borderColor: badgeBorder, opacity: isPast ? 0.78 : 1 }]}>
              <Text
                style={[
                  styles.statusBadgeText,
                  isVeryCompactCard
                    ? styles.statusBadgeTextVeryCompact
                    : isCompactCard
                      ? styles.statusBadgeTextCompact
                      : null,
                  {
                    color: badgeText,
                  },
                ]}
                numberOfLines={1}
              >
                {dateTimeLabel}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.innerCard,
              isCompactCard ? styles.innerCardCompact : null,
              isWebCard ? styles.innerCardWeb : null,
              {
                backgroundColor: cardBackground,
                borderColor: colors.border,
                opacity: isPast ? 0.78 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.content,
                isWebCard ? styles.contentWeb : null,
              ]}
            >
              <View style={[styles.classRow, isCompactCard ? styles.classRowCompact : null]}>
                <Text
                  style={[styles.className, isCompactCard ? styles.classNameCompact : null, { color: cardText }]}
                  numberOfLines={1}
                >
                  {item.className}
                </Text>
                {item.gender ? <ClassGenderBadge gender={item.gender} size="sm" /> : null}
              </View>

              <View style={styles.locationRow}>
                <LocationBadge
                  location={item.unit ?? ""}
                  palette={getUnitPalette(item.unit ?? "Sem unidade", colors)}
                  size="sm"
                  showIcon={true}
                />
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
    paddingTop: 18,
  },
  outerCardWeb: {
    paddingTop: 18,
  },
  innerCard: {
    paddingTop: 32,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  innerCardCompact: {
    paddingTop: 30,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  innerCardWeb: {
    paddingTop: 32,
    paddingHorizontal: 13,
    paddingBottom: 14,
  },
  statusBadge: {
    position: "relative",
    minWidth: 150,
    maxWidth: "92%",
    height: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    zIndex: 2,
    overflow: "hidden",
  },
  statusBadgeCompact: {
    minWidth: 132,
    maxWidth: "92%",
    height: 26,
    paddingHorizontal: 8,
  },
  statusBadgeSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
  statusBadgeTextCompact: {
    fontSize: 10,
  },
  statusBadgeTextVeryCompact: {
    fontSize: 9,
  },
  content: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contentWeb: {
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 2,
  },
  timeLabel: {
    fontSize: 12,
    flexShrink: 1,
    textAlign: "right",
  },
  dateText: {
    fontSize: 12,
    flexShrink: 1,
    textAlign: "center",
  },
  dateTextCompact: {
    fontSize: 11,
  },
  className: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },
  classNameCompact: {
    fontSize: 14,
  },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    width: "100%",
    gap: 6,
    marginBottom: 1,
  },
  classRowCompact: {
    gap: 3,
  },
  locationRow: {
    width: "100%",
    alignItems: "center",
    marginTop: 0,
  },
});
