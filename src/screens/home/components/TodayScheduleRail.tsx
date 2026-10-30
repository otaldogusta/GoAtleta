import { memo } from "react";
import { FlatList, View } from "react-native";
import { OperationalText as Text } from "../../../ui/OperationalText";

import { compactUiMetrics as metrics, radius, shadow } from "../../../theme/tokens";
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
  height?: number;
  onOpenLesson: (item: HomeScheduleItem) => void;
  onOpenAttendance: (item: HomeScheduleItem) => void;
};

export const TodayScheduleRail = memo(function TodayScheduleRail({
  title,
  subtitle,
  slots,
  totalDurationMinutes,
  width = 350,
  height,
  onOpenLesson,
  onOpenAttendance,
}: TodayScheduleRailProps) {
  const { colors } = useAppTheme();
  const durationHours = Math.round((totalDurationMinutes / 60) * 10) / 10;

  return (
    <View
      style={{
        width,
        height,
        maxHeight: height,
        minHeight: 0,
        alignSelf: "stretch",
        backgroundColor: colors.surface,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        ...shadow.card,
        overflow: "hidden",
      }}
    >
      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: metrics.titleFontSize, fontWeight: "900" }}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: metrics.metadataFontSize, fontWeight: "700" }}>
          {subtitle}
        </Text>
      </View>

      <View style={{ height: 1, backgroundColor: colors.borderSubtle }} />

      {slots.length === 0 ? (
        <View style={{ flex: 1, padding: 24, gap: 10 }}>
          <Text style={{ color: colors.textPrimary, fontSize: metrics.bodyFontSize, fontWeight: "900" }}>
            Nenhuma aula neste dia
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: metrics.bodyFontSize }}>
            Selecione outro dia da semana para ver as aulas programadas.
          </Text>
        </View>
      ) : (
        <FlatList
          data={slots}
          keyExtractor={(slot) => slot.key}
          style={{ flex: 1, minHeight: 0 }}
          scrollEnabled
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: slot }) => (
            <View>
              {slot.items.map((lesson) => (
                <View
                  key={`${slot.key}-${lesson.classId}`}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderSubtle,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <Text style={{ color: colors.textMuted, fontSize: metrics.metadataFontSize, fontWeight: "800" }}>
                      {lesson.timeLabel}
                    </Text>
                    {lesson.gender ? <ClassGenderBadge gender={lesson.gender} size="sm" /> : null}
                  </View>

                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: metrics.bodyFontSize, fontWeight: "900" }} numberOfLines={1}>
                      {lesson.className}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <GoAtletaIcon name="location" size={15} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: metrics.metadataFontSize, fontWeight: "600" }} numberOfLines={1}>
                        {lesson.unit}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Pressable
                      onPress={() => onOpenLesson(lesson)}
                      style={{
                        flex: 1,
                        minHeight: metrics.touchTarget,
                        borderRadius: radius.internal,
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: metrics.bodyFontSize, fontWeight: "800" }}>
                        Ver aula
                      </Text>
                      <GoAtletaIcon name="arrowForward" size={metrics.iconSize} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => onOpenAttendance(lesson)}
                      style={{
                        flex: 1,
                        minHeight: metrics.touchTarget,
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
                      <GoAtletaIcon name="students" size={metrics.iconSize} color={colors.textPrimary} />
                      <Text style={{ color: colors.textPrimary, fontSize: metrics.bodyFontSize, fontWeight: "800" }}>
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

      <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <GoAtletaIcon name="calendar" size={metrics.iconSize} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontSize: metrics.metadataFontSize, fontWeight: "700" }}>
          {slots.reduce((total, slot) => total + slot.items.length, 0)} aulas - {durationHours}h de duração
        </Text>
      </View>
    </View>
  );
});
