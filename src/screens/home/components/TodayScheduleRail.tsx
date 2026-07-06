import { memo } from "react";
import { FlatList, Text, View } from "react-native";

import { radius, shadow } from "../../../theme/tokens";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import type { HomeScheduleItem, HomeScheduleSlot } from "./homeScheduleTypes";

type TodayScheduleRailProps = {
  title: string;
  subtitle: string;
  slots: HomeScheduleSlot[];
  totalDurationMinutes: number;
  compact?: boolean;
  width?: number;
  onOpenLesson: (item: HomeScheduleItem) => void;
  onOpenAttendance: (item: HomeScheduleItem) => void;
};

export const TodayScheduleRail = memo(function TodayScheduleRail({
  title,
  subtitle,
  slots,
  totalDurationMinutes,
  compact = false,
  width = 350,
  onOpenLesson,
  onOpenAttendance,
}: TodayScheduleRailProps) {
  const { colors } = useAppTheme();
  const durationHours = Math.round((totalDurationMinutes / 60) * 10) / 10;

  return (
    <View
      style={{
        width,
        alignSelf: "stretch",
        backgroundColor: colors.surface,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        shadowColor: shadow.card.shadowColor,
        shadowOpacity: shadow.card.shadowOpacity,
        shadowRadius: shadow.card.shadowRadius,
        shadowOffset: shadow.card.shadowOffset,
        overflow: "hidden",
      }}
    >
      <View style={{ paddingHorizontal: compact ? 14 : 18, paddingTop: compact ? 14 : 18, paddingBottom: compact ? 12 : 16, gap: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: compact ? 16 : 18, fontWeight: "900" }}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: compact ? 12 : 13, fontWeight: "700" }}>
          {subtitle}
        </Text>
      </View>

      <View style={{ height: 1, backgroundColor: colors.borderSubtle }} />

      {slots.length === 0 ? (
        <View style={{ padding: 24, gap: 10 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "900" }}>
            Nenhuma aula neste dia
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Selecione outro dia da semana para ver as aulas programadas.
          </Text>
        </View>
      ) : (
        <FlatList
          data={slots}
          keyExtractor={(slot) => slot.key}
          scrollEnabled={false}
          renderItem={({ item: slot }) => (
            <View>
              {slot.items.map((lesson) => (
                <View
                  key={`${slot.key}-${lesson.classId}`}
                  style={{
                    paddingHorizontal: compact ? 14 : 18,
                    paddingVertical: compact ? 10 : 13,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderSubtle,
                    gap: compact ? 8 : 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <Text style={{ color: colors.textMuted, fontSize: compact ? 12 : 13, fontWeight: "800" }}>
                      {lesson.timeLabel}
                    </Text>
                    {lesson.gender ? <ClassGenderBadge gender={lesson.gender} size="sm" /> : null}
                  </View>

                  <View style={{ gap: 10 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: compact ? 17 : 19, fontWeight: "900" }} numberOfLines={1}>
                      {lesson.className}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <GoAtletaIcon name="location" size={15} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: compact ? 12 : 13, fontWeight: "600" }} numberOfLines={1}>
                        {lesson.unit}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Pressable
                      onPress={() => onOpenLesson(lesson)}
                      style={{
                        flex: 1,
                        height: compact ? 34 : 38,
                        borderRadius: radius.internal,
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: compact ? 11 : 12, fontWeight: "800" }}>
                        Ver aula
                      </Text>
                      <GoAtletaIcon name="arrowForward" size={17} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => onOpenAttendance(lesson)}
                      style={{
                        flex: 1,
                        height: compact ? 34 : 38,
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
                      <GoAtletaIcon name="students" size={17} color={colors.textPrimary} />
                      <Text style={{ color: colors.textPrimary, fontSize: compact ? 11 : 12, fontWeight: "800" }}>
                        Chamada
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        />
      )}

      <View style={{ padding: compact ? 12 : 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <GoAtletaIcon name="calendar" size={22} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontSize: compact ? 12 : 13, fontWeight: "700" }}>
          {slots.reduce((total, slot) => total + slot.items.length, 0)} aulas - {durationHours}h de duração
        </Text>
      </View>
    </View>
  );
});
