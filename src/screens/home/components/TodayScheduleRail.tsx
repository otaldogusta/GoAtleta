import { memo } from "react";
import { ScrollView, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { LocationBadge } from "../../../ui/LocationBadge";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { getUnitPalette } from "../../../ui/unit-colors";

export type TodayScheduleRailItem = {
  classId: string;
  className: string;
  unit: string;
  gender: ClassGroup["gender"] | null;
  dateKey: string;
  startTime: number;
  endTime: number;
  timeLabel: string;
};

type TodayScheduleRailProps = {
  items: TodayScheduleRailItem[];
  colors: ThemeColors;
  nowTime: number;
  onOpenSession: (item: TodayScheduleRailItem) => void;
  onOpenAttendance: (item: TodayScheduleRailItem) => void;
};

function TodayScheduleRailBase({
  items,
  colors,
  nowTime,
  onOpenSession,
  onOpenAttendance,
}: TodayScheduleRailProps) {
  return (
    <View
      style={{
        width: 312,
        alignSelf: "stretch",
        borderLeftWidth: 1,
        borderLeftColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: 14,
        paddingTop: 24,
        paddingBottom: 20,
        gap: 12,
      }}
    >
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          Aulas do dia
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Próximas aulas e ações rápidas.
        </Text>
      </View>

      {items.length === 0 ? (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 14,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Sem aulas hoje</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Nenhuma turma programada para hoje.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 6 }}
        >
          {items.map((item) => {
            const isCurrent = item.startTime <= nowTime && item.endTime > nowTime;
            const isPast = item.endTime <= nowTime;
            return (
              <View
                key={`${item.classId}-${item.dateKey}-${item.startTime}`}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isCurrent ? colors.primaryBg : colors.border,
                  backgroundColor: colors.card,
                  padding: 12,
                  gap: 10,
                  opacity: isPast ? 0.72 : 1,
                }}
              >
                <View style={{ gap: 7 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                      {item.timeLabel}
                    </Text>
                    {isCurrent ? (
                      <View
                        style={{
                          borderRadius: 999,
                          backgroundColor: colors.primaryBg,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primaryText,
                            fontSize: 10,
                            fontWeight: "800",
                          }}
                        >
                          Agora
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text
                        style={{ color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 }}
                        numberOfLines={1}
                      >
                        {item.className}
                      </Text>
                      {item.gender ? <ClassGenderBadge gender={item.gender} size="sm" /> : null}
                    </View>
                    <LocationBadge
                      location={item.unit ?? ""}
                      palette={getUnitPalette(item.unit ?? "Sem unidade", colors)}
                      size="sm"
                      showIcon
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => onOpenSession(item)}
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      backgroundColor: colors.primaryBg,
                      alignItems: "center",
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>
                      Ver aula
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onOpenAttendance(item)}
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      alignItems: "center",
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                      Chamada
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export const TodayScheduleRail = memo(TodayScheduleRailBase);
TodayScheduleRail.displayName = "TodayScheduleRail";
