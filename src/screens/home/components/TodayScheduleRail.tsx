import { memo } from "react";
import { ScrollView, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { LocationBadge } from "../../../ui/LocationBadge";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { getUnitPalette } from "../../../ui/unit-colors";
import { webShellTokens } from "../../../ui/web-shell-tokens";

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
  const railBackground = isDark ? "rgba(9, 14, 32, 0.92)" : webShellTokens.surfaceSoft;
  const railBorder = isDark ? "rgba(255,255,255,0.06)" : webShellTokens.border;
  const currentCardBackground = isDark ? "rgba(255,255,255,0.08)" : webShellTokens.surface;
  const upcomingCardBackground = isDark ? "rgba(255,255,255,0.03)" : webShellTokens.surfaceAlt;
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : webShellTokens.border;
  const actionBg = isDark ? "rgba(86,214,154,0.22)" : webShellTokens.primary;

  const activeItem = items.find((item) => item.startTime <= nowTime && item.endTime > nowTime);
  const upcomingItems = items.filter((item) => item.startTime > nowTime);
  const futureItems = activeItem ? upcomingItems : items;

  return (
    <View
      style={{
        width: 320,
        alignSelf: "stretch",
        borderLeftWidth: 1,
        borderLeftColor: railBorder,
        backgroundColor: railBackground,
        paddingHorizontal: 14,
        paddingTop: 24,
        paddingBottom: 20,
        gap: 12,
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
            backgroundColor: currentCardBackground,
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
          contentContainerStyle={{ gap: 14, paddingBottom: 6 }}
        >
          {activeItem ? (
            <View
              style={{
                borderRadius: 22,
                backgroundColor: currentCardBackground,
                borderWidth: 1,
                borderColor: webShellTokens.primary,
                padding: 16,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}>
                    Aula atual
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>
                    {activeItem.className}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: webShellTokens.primary,
                    }}
                  />
                  <Text style={{ color: webShellTokens.primary, fontSize: 12, fontWeight: "700" }}>
                    Agora
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{activeItem.timeLabel}</Text>
              <LocationBadge
                location={activeItem.unit ?? ""}
                palette={getUnitPalette(activeItem.unit ?? "Sem unidade", colors)}
                size="sm"
                showIcon
              />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => onOpenSession(activeItem)}
                  style={{
                    flex: 1,
                    borderRadius: 999,
                    backgroundColor: actionBg,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>
                    Ver aula
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onOpenAttendance(activeItem)}
                  style={{
                    flexShrink: 0,
                    borderRadius: 999,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: webShellTokens.primary, fontSize: 12, fontWeight: "800" }}>
                    Chamada
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {futureItems.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                Próximas aulas
              </Text>
              {futureItems.map((item) => (
                <View
                  key={`${item.classId}-${item.dateKey}-${item.startTime}`}
                  style={{
                    borderRadius: 18,
                    backgroundColor: upcomingCardBackground,
                    padding: 13,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      {item.timeLabel}
                    </Text>
                    {item.gender ? <ClassGenderBadge gender={item.gender} size="sm" /> : null}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }} numberOfLines={1}>
                    {item.className}
                  </Text>
                  <LocationBadge
                    location={item.unit ?? ""}
                    palette={getUnitPalette(item.unit ?? "Sem unidade", colors)}
                    size="sm"
                    showIcon
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Nenhuma aula restante hoje.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

export const TodayScheduleRail = memo(TodayScheduleRailBase);
TodayScheduleRail.displayName = "TodayScheduleRail";
