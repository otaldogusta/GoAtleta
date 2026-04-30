import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";
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
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.06)",
        padding: compact ? 14 : 18,
        shadowColor: "#0F172A",
        shadowOpacity: 0.06,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 14 : 18,
      }}
    >
      <View
        style={{
          width: compact ? 62 : 72,
          height: compact ? 62 : 72,
          borderRadius: compact ? 14 : 16,
          backgroundColor: "#EFF4F1",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="calendar-outline" size={compact ? 23 : 26} color="#1B6F56" />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: compact ? 5 : 7 }}>
        <Text style={{ color: "#1B7A5E", fontSize: 11, fontWeight: "900" }}>
          {statusLabel}
        </Text>
        <Text style={{ color: "#667085", fontSize: compact ? 14 : 16, fontWeight: "700" }}>
          {slot?.timeLabel ?? selectedDateLabel}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Text style={{ color: "#101827", fontSize: compact ? 21 : 24, fontWeight: "900" }} numberOfLines={1}>
            {title}
          </Text>
          {primaryItem?.gender ? <ClassGenderBadge gender={primaryItem.gender} size="sm" /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="location" size={16} color="#475467" />
          <Text style={{ color: "#667085", fontSize: compact ? 12 : 14, fontWeight: "600" }} numberOfLines={1}>
            {primaryItem?.unit ?? "Escolha um dia na agenda da semana"}
          </Text>
        </View>
      </View>

      <View
        style={{
          width: 1,
          alignSelf: "stretch",
          backgroundColor: "rgba(15,23,42,0.08)",
        }}
      />

      <View style={{ width: compact ? 204 : 240, gap: compact ? 8 : 10 }}>
        <Pressable
          onPress={onOpenLesson}
          disabled={!primaryItem}
          style={{
            height: compact ? 40 : 46,
            borderRadius: 12,
            backgroundColor: primaryItem ? "#1B7A5E" : "#D0D5DD",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: compact ? 12 : 14, fontWeight: "800" }}>
            Ver aula
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable
          onPress={onOpenAttendance}
          disabled={!primaryItem}
          style={{
            height: compact ? 38 : 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.10)",
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Ionicons name="people-outline" size={20} color={primaryItem ? "#101827" : "#98A2B3"} />
          <Text style={{ color: primaryItem ? "#101827" : "#98A2B3", fontSize: compact ? 12 : 14, fontWeight: "800" }}>
            Fazer chamada
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
