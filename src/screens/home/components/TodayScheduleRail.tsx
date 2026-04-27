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
  mode: "light" | "dark";
  nowTime: number;
  onOpenSession: (item: TodayScheduleRailItem) => void;
  onOpenAttendance: (item: TodayScheduleRailItem) => void;
};

function TodayScheduleRailBase({
  items,
  colors,
  mode,
  nowTime,
  onOpenSession,
  onOpenAttendance,
}: TodayScheduleRailProps) {
  const isDark = mode === "dark";
  const railBackground = isDark ? "#080d18" : "rgba(248, 250, 252, 0.88)";
  const railBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)";
  const cardBackground = isDark ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.76)";
  const activeCardBackground = isDark ? "rgba(86,214,154,0.12)" : "rgba(255,255,255,0.9)";
  const cardBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)";
  const actionBg = isDark ? "rgba(86,214,154,0.22)" : colors.primaryBg;
  const secondaryActionBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)";

  return (
    <View
      style={{
        width: 304,
        alignSelf: "stretch",
        borderLeftWidth: 1,
        borderLeftColor: railBorder,
        backgroundColor: railBackground,
        paddingHorizontal: 12,
        paddingTop: 22,
        paddingBottom: 18,
        gap: 10,
      }}
    >
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>
          Aulas do dia
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Próximas aulas e rotina rápida.
        </Text>
      </View>

      {items.length === 0 ? (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: cardBorder,
            backgroundColor: cardBackground,
            padding: 13,
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
          contentContainerStyle={{ gap: 9, paddingBottom: 6 }}
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
                  borderColor: isCurrent ? colors.primaryBg : cardBorder,
                  backgroundColor: isCurrent ? activeCardBackground : cardBackground,
                  padding: 11,
                  gap: 9,
                  opacity: isPast ? 0.72 : 1,
                  ...(isDark
                    ? {}
                    : ({
                        boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.06)",
                      } as any)),
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
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                      {item.timeLabel}
                    </Text>
                    {isCurrent ? (
                      <View
                        style={{
                          borderRadius: 999,
                          backgroundColor: colors.primaryBg,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primaryText,
                            fontSize: 9,
                            fontWeight: "800",
                          }}
                        >
                          Agora
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text
                        style={{ color: colors.text, fontSize: 14, fontWeight: "800", flex: 1 }}
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

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pressable
                    onPress={() => onOpenSession(item)}
                    style={{
                      flexShrink: 0,
                      borderRadius: 999,
                      backgroundColor: actionBg,
                      alignItems: "center",
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>
                      Ver aula
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onOpenAttendance(item)}
                    style={{
                      flexShrink: 0,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: cardBorder,
                      backgroundColor: secondaryActionBg,
                      alignItems: "center",
                      paddingVertical: 7,
                      paddingHorizontal: 12,
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
