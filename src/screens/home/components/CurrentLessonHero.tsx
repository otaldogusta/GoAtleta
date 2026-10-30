import { memo } from "react";
import { View } from "react-native";
import { OperationalText as Text } from "../../../ui/OperationalText";

import { brandPalette, compactUiMetrics as metrics, radius, shadow } from "../../../theme/tokens";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import type { HomeScheduleSlot } from "./homeScheduleTypes";

type CurrentLessonHeroProps = {
  slot: HomeScheduleSlot | null;
  selectedDateLabel: string;
  isToday: boolean;
  compact?: boolean;
  mobile?: boolean;
  currentPosition?: number;
  totalSlots?: number;
  onOpenLesson: () => void;
  onOpenAttendance: () => void;
};

export const CurrentLessonHero = memo(function CurrentLessonHero({
  slot,
  selectedDateLabel,
  isToday,
  compact = false,
  mobile = false,
  currentPosition = 0,
  totalSlots = 0,
  onOpenLesson,
  onOpenAttendance,
}: CurrentLessonHeroProps) {
  const { colors } = useAppTheme();
  const primaryItem = slot?.items[0] ?? null;
  const canNavigate = totalSlots > 1;
  const statusLabel = isToday ? "AULA ATUAL" : "PRÓXIMA AÇÃO";
  const title = primaryItem?.className ?? "Sem aulas programadas";

  return (
    <View
      accessibilityLabel={
        canNavigate
          ? `Aula ${currentPosition + 1} de ${totalSlots}. Arraste para navegar.`
          : undefined
      }
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: 12,
        ...shadow.card,
        flexDirection: mobile ? "column" : "row",
        alignItems: mobile ? "stretch" : "center",
        gap: metrics.gap,
      }}
    >
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: metrics.gap,
        }}
      >
        <View
          style={{
            width: metrics.controlHeight,
            height: metrics.controlHeight,
            borderRadius: mobile ? radius.card : radius.container,
            backgroundColor: colors.successBg,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <GoAtletaIcon name="calendar" size={metrics.iconSize} color={colors.successText} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: metrics.smallGap }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.successText, fontSize: mobile ? 10 : 11, fontWeight: "900" }}>
                {statusLabel}
              </Text>
              <Text
              style={{ flexShrink: 1, color: colors.textMuted, fontSize: metrics.metadataFontSize, fontWeight: "700" }}
                numberOfLines={1}
              >
                {slot?.timeLabel ?? selectedDateLabel}
              </Text>
            </View>

          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Text
              style={{ flexShrink: 1, color: colors.textPrimary, fontSize: metrics.titleFontSize, lineHeight: metrics.titleLineHeight, fontWeight: "900" }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {primaryItem?.gender ? <ClassGenderBadge gender={primaryItem.gender} size="sm" /> : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <GoAtletaIcon name="location" size={metrics.secondaryIconSize} color={colors.textMuted} />
            <Text style={{ flex: 1, color: colors.textMuted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight, fontWeight: "600" }} numberOfLines={1}>
              {primaryItem?.unit ?? "Escolha um dia na agenda da semana"}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{
          width: mobile ? "100%" : 1,
          height: mobile ? 1 : undefined,
          alignSelf: "stretch",
          backgroundColor: colors.borderSubtle,
        }}
      />

      <View
        style={{
          width: mobile ? "100%" : compact ? 150 : 180,
          flexDirection: mobile ? "row" : "column",
          gap: mobile ? 8 : compact ? 6 : 8,
          flexShrink: 0,
        }}
      >
        <Pressable
          onPress={onOpenLesson}
          disabled={!primaryItem}
          style={{
            flex: mobile ? 1 : undefined,
            minHeight: metrics.touchTarget,
            paddingHorizontal: 12,
            borderRadius: radius.internal,
            backgroundColor: primaryItem ? colors.success : colors.primaryDisabledBg,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Text style={{ color: brandPalette.navyDeep, fontSize: metrics.bodyFontSize, fontWeight: "900" }} numberOfLines={1}>
            Ver aula
          </Text>
          <GoAtletaIcon name="arrowForward" size={metrics.iconSize} color={brandPalette.navyDeep} />
        </Pressable>
        <Pressable
          onPress={onOpenAttendance}
          disabled={!primaryItem}
          style={{
            flex: mobile ? 1 : undefined,
            minHeight: metrics.touchTarget,
            paddingHorizontal: 12,
            borderRadius: radius.internal,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <GoAtletaIcon name="students" size={metrics.iconSize} color={primaryItem ? colors.textPrimary : colors.textMuted} />
          <Text style={{ color: primaryItem ? colors.textPrimary : colors.textMuted, fontSize: metrics.bodyFontSize, fontWeight: "800" }} numberOfLines={1}>
            Fazer chamada
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
