import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { brandPalette, radius, shadow } from "../../../theme/tokens";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
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
        shadowColor: shadow.card.shadowColor,
        shadowOpacity: shadow.card.shadowOpacity,
        shadowRadius: shadow.card.shadowRadius,
        shadowOffset: shadow.card.shadowOffset,
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
        <Ionicons name="calendar-outline" size={compact ? 23 : 26} color={colors.successText} />
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
          <Ionicons name="location" size={16} color={colors.textMuted} />
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

      <View style={{ width: compact ? 204 : 240, gap: compact ? 8 : 10 }}>
        <Pressable
          onPress={onOpenLesson}
          disabled={!primaryItem}
          style={{
            height: compact ? 40 : 46,
            borderRadius: radius.internal,
            backgroundColor: primaryItem ? colors.success : colors.primaryDisabledBg,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Text style={{ color: brandPalette.navyDeep, fontSize: compact ? 12 : 14, fontWeight: "900" }}>
            Ver aula
          </Text>
          <Ionicons name="arrow-forward" size={20} color={brandPalette.navyDeep} />
        </Pressable>
        <Pressable
          onPress={onOpenAttendance}
          disabled={!primaryItem}
          style={{
            height: compact ? 38 : 42,
            borderRadius: radius.internal,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Ionicons name="people-outline" size={20} color={primaryItem ? colors.textPrimary : colors.textMuted} />
          <Text style={{ color: primaryItem ? colors.textPrimary : colors.textMuted, fontSize: compact ? 12 : 14, fontWeight: "800" }}>
            Fazer chamada
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
