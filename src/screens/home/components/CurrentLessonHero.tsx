import { memo } from "react";
import { Text, View } from "react-native";

import { brandPalette, radius, shadow } from "../../../theme/tokens";
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
  onOpenLesson: () => void;
  onOpenAttendance: () => void;
};

export const CurrentLessonHero = memo(function CurrentLessonHero({
  slot,
  selectedDateLabel,
  isToday,
  compact = false,
  onOpenLesson,
  onOpenAttendance,
}: CurrentLessonHeroProps) {
  const { colors } = useAppTheme();
  const primaryItem = slot?.items[0] ?? null;
  const statusLabel = isToday ? "AULA ATUAL" : "PRÓXIMA AÇÃO";
  const title = primaryItem
    ? slot && slot.items.length > 1
      ? `${slot.items.length} turmas em paralelo`
      : primaryItem.className
    : "Sem aulas programadas";

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: compact ? 14 : 18,
        ...shadow.card,
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 14 : 18,
      }}
    >
      <View
        style={{
          width: compact ? 62 : 72,
          height: compact ? 62 : 72,
          borderRadius: radius.container,
          backgroundColor: colors.successBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name="calendar" size={compact ? 23 : 26} color={colors.successText} />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: compact ? 5 : 7 }}>
        <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "900" }}>
          {statusLabel}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: compact ? 14 : 16, fontWeight: "700" }}>
          {slot?.timeLabel ?? selectedDateLabel}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Text style={{ color: colors.textPrimary, fontSize: compact ? 21 : 24, fontWeight: "900" }} numberOfLines={1}>
            {title}
          </Text>
          {primaryItem?.gender ? <ClassGenderBadge gender={primaryItem.gender} size="sm" /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <GoAtletaIcon name="location" size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: compact ? 12 : 14, fontWeight: "600" }} numberOfLines={1}>
            {primaryItem?.unit ?? "Escolha um dia na agenda da semana"}
          </Text>
        </View>
      </View>

      <View
        style={{
          width: 1,
          alignSelf: "stretch",
          backgroundColor: colors.borderSubtle,
        }}
      />

      <View style={{ width: compact ? 150 : 180, gap: compact ? 6 : 8, flexShrink: 0 }}>
        <Pressable
          onPress={onOpenLesson}
          disabled={!primaryItem}
          style={{
            height: compact ? 38 : 42,
            paddingHorizontal: 12,
            borderRadius: radius.internal,
            backgroundColor: primaryItem ? colors.success : colors.primaryDisabledBg,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Text style={{ color: brandPalette.navyDeep, fontSize: compact ? 12 : 13, fontWeight: "900" }} numberOfLines={1}>
            Ver aula
          </Text>
          <GoAtletaIcon name="arrowForward" size={compact ? 16 : 18} color={brandPalette.navyDeep} />
        </Pressable>
        <Pressable
          onPress={onOpenAttendance}
          disabled={!primaryItem}
          style={{
            height: compact ? 36 : 40,
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
          <GoAtletaIcon name="students" size={compact ? 16 : 18} color={primaryItem ? colors.textPrimary : colors.textMuted} />
          <Text style={{ color: primaryItem ? colors.textPrimary : colors.textMuted, fontSize: compact ? 12 : 13, fontWeight: "800" }} numberOfLines={1}>
            Fazer chamada
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
