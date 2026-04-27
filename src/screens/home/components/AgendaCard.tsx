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
  activeBorderColor: string;
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
  activeBorderColor,
  colors,
  mode,
  onCardPress,
}: AgendaCardProps) {
  markRender("screen.home.render.agendaCard", { classId: item.classId, index });

  const handlePress = useCallback(() => onCardPress(index), [index, onCardPress]);
  const badgeLabel = useMemo(() => item.timeLabel, [item.timeLabel]);
  const isCompactCard = agendaCardWidth <= 260;
  const isVeryCompactCard = agendaCardWidth <= 200;
  const isWebCard = Platform.OS === "web";

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
            pointerEvents="none"
            style={[styles.statusBadgeSlot, Platform.OS === "web" ? styles.webOpticalShift : null]}
          >
            <View
              style={[
                styles.statusBadge,
                isCompactCard ? styles.statusBadgeCompact : null,
                {
                  backgroundColor: mode === "dark" ? colors.secondaryBg : colors.primaryBg,
                  borderColor: isActive ? activeBorderColor : colors.border,
                  opacity: isPast ? 0.72 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isVeryCompactCard
                    ? styles.statusBadgeTextVeryCompact
                    : isCompactCard
                      ? styles.statusBadgeTextCompact
                      : null,
                  {
                    color:
                      mode === "dark"
                        ? colors.text
                        : isActive
                          ? colors.primaryText
                          : colors.primaryText,
                  },
                ]}
                numberOfLines={1}
              >
                {badgeLabel}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.innerCard,
              isCompactCard ? styles.innerCardCompact : null,
              isWebCard ? styles.innerCardWeb : null,
              {
                backgroundColor: colors.card,
                borderColor: isActive ? activeBorderColor : colors.border,
                opacity: isPast ? 0.6 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.content,
                isWebCard ? styles.contentWeb : null,
                isWebCard ? styles.webOpticalShift : null,
              ]}
            >
              <View style={styles.headerRow}>
                <Text
                  style={[styles.dateText, isCompactCard ? styles.dateTextCompact : null, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {item.dateLabel}
                </Text>
              </View>

              <View style={[styles.classRow, isCompactCard ? styles.classRowCompact : null]}>
                <Text
                  style={[styles.className, isCompactCard ? styles.classNameCompact : null, { color: colors.text }]}
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
    paddingTop: 14,
  },
  outerCardWeb: {
    paddingTop: 12,
  },
  innerCard: {
    paddingTop: 16,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  innerCardCompact: {
    paddingTop: 14,
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  innerCardWeb: {
    paddingTop: 14,
    paddingHorizontal: 11,
    paddingBottom: 11,
  },
  statusBadge: {
    position: "relative",
    minWidth: 100,
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
    minWidth: 0,
    maxWidth: "88%",
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
  webOpticalShift: {
    transform: [{ translateX: 2 }],
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
    marginBottom: 1,
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
