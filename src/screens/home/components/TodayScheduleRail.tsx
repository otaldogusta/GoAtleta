import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Text, View } from "react-native";

import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";
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
  const durationHours = Math.round((totalDurationMinutes / 60) * 10) / 10;

  return (
    <View
      style={{
        width,
        alignSelf: "stretch",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.06)",
        shadowColor: "#0F172A",
        shadowOpacity: 0.06,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        overflow: "hidden",
      }}
    >
      <View style={{ paddingHorizontal: compact ? 14 : 18, paddingTop: compact ? 14 : 18, paddingBottom: compact ? 12 : 16, gap: 4 }}>
        <Text style={{ color: "#101827", fontSize: compact ? 16 : 18, fontWeight: "900" }}>
          {title}
        </Text>
        <Text style={{ color: "#667085", fontSize: compact ? 12 : 13, fontWeight: "700" }}>
          {subtitle}
        </Text>
      </View>

      <View style={{ height: 1, backgroundColor: "rgba(15,23,42,0.08)" }} />

      {slots.length === 0 ? (
        <View style={{ padding: 24, gap: 10 }}>
          <Text style={{ color: "#101827", fontSize: 15, fontWeight: "800" }}>
            Nenhuma aula neste dia
          </Text>
          <Text style={{ color: "#667085", fontSize: 13 }}>
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
                    borderBottomColor: "rgba(15,23,42,0.08)",
                    gap: compact ? 8 : 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <Text style={{ color: "#667085", fontSize: compact ? 12 : 13, fontWeight: "800" }}>
                      {lesson.timeLabel}
                    </Text>
                    {lesson.gender ? <ClassGenderBadge gender={lesson.gender} size="sm" /> : null}
                  </View>

                  <View style={{ gap: 10 }}>
                    <Text style={{ color: "#101827", fontSize: compact ? 17 : 19, fontWeight: "900" }} numberOfLines={1}>
                      {lesson.className}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="location" size={15} color="#475467" />
                      <Text style={{ color: "#667085", fontSize: compact ? 12 : 13, fontWeight: "600" }} numberOfLines={1}>
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
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "rgba(15,23,42,0.10)",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: "#101827", fontSize: compact ? 11 : 12, fontWeight: "800" }}>
                        Ver aula
                      </Text>
                      <Ionicons name="arrow-forward" size={17} color="#101827" />
                    </Pressable>
                    <Pressable
                      onPress={() => onOpenAttendance(lesson)}
                      style={{
                        flex: 1,
                        height: compact ? 34 : 38,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "rgba(15,23,42,0.10)",
                        backgroundColor: "#FFFFFF",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 8,
                      }}
                    >
                      <Ionicons name="people-outline" size={17} color="#101827" />
                      <Text style={{ color: "#101827", fontSize: compact ? 11 : 12, fontWeight: "800" }}>
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
        <Ionicons name="calendar-outline" size={22} color="#475467" />
        <Text style={{ color: "#667085", fontSize: compact ? 12 : 13, fontWeight: "700" }}>
          {slots.reduce((total, slot) => total + slot.items.length, 0)} aulas - {durationHours}h de duração
        </Text>
      </View>
    </View>
  );
});
