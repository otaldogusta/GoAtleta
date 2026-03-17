import React from "react";
import { Animated, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "../../ui/Pressable";
import { type ThemeColors } from "../../ui/app-theme";
import { getSectionCardStyle } from "../../ui/section-styles";

type WeekScheduleItem = {
  label: string;
  dayNumber: number;
  session: string;
  date: string;
};

type WeekPlan = {
  week: number;
  title: string;
  focus: string;
  volume: string;
  notes: string[];
  dateRange?: string;
  sessionDatesLabel?: string;
  jumpTarget: string;
  PSETarget: string;
  plannedSessionLoad: number;
  plannedWeeklyLoad: number;
  source: "AUTO" | "MANUAL";
};

type WeekTabProps = {
  colors: ThemeColors;
  weekSchedule: WeekScheduleItem[];
  activeWeek: WeekPlan;
  weekPlans: WeekPlan[];
  weekSwitchOpacity: Animated.Value;
  weekSwitchTranslateX: Animated.Value;
  goToPreviousAgendaWeek: () => void;
  goToNextAgendaWeek: () => void;
  handleSelectDay: (index: number) => void;
  formatWeekSessionLabel: (value: string) => string;
  hasWeekPlans: boolean;
  competitiveAgendaCard: React.ReactNode;
};

export function WeekTab({
  colors,
  weekSchedule,
  activeWeek,
  weekPlans,
  weekSwitchOpacity,
  weekSwitchTranslateX,
  goToPreviousAgendaWeek,
  goToNextAgendaWeek,
  handleSelectDay,
  formatWeekSessionLabel,
  hasWeekPlans,
  competitiveAgendaCard,
}: WeekTabProps) {
  return (
    <View style={{ gap: 10 }}>

      <View style={getSectionCardStyle(colors, "info")}>

        <View style={{ gap: 10 }}>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={goToPreviousAgendaWeek}
              disabled={!hasWeekPlans || activeWeek.week <= 1}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: !hasWeekPlans || activeWeek.week <= 1 ? 0.45 : 1,
              }}
            >
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </Pressable>

            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
              {`Semana ${activeWeek.week} de ${Math.max(1, weekPlans.length)}`}
            </Text>

            <Pressable
              onPress={goToNextAgendaWeek}
              disabled={!hasWeekPlans || activeWeek.week >= weekPlans.length}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: !hasWeekPlans || activeWeek.week >= weekPlans.length ? 0.45 : 1,
              }}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </Pressable>
          </View>

          <Animated.View
            style={{
              opacity: weekSwitchOpacity,
              transform: [{ translateX: weekSwitchTranslateX }],
              gap: 10,
            }}
          >
          <View

            style={{

              flexDirection: "row",

              flexWrap: "wrap",

              gap: 10,

            }}

          >

            {weekSchedule.map((item, index) => (

              <Pressable

                key={item.label}

                onPress={() => handleSelectDay(index)}

                style={{

                  width: "31%",

                  minWidth: 74,

                  maxWidth: 100,

                  aspectRatio: 1,

                  padding: 8,

                  borderRadius: 12,

                  backgroundColor: colors.secondaryBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                  gap: 6,

                }}

              >

                <Text style={{ color: colors.muted, fontSize: 11 }}>

                  {item.label}

                </Text>

                <Text
                  numberOfLines={2}
                  style={{ color: colors.text, fontSize: 11, fontWeight: "700", lineHeight: 14 }}
                >

                  {formatWeekSessionLabel(item.session || "Descanso")}

                </Text>

              </Pressable>

            ))}

          </View>

          </Animated.View>

        </View>

      </View>

      {competitiveAgendaCard}

    </View>
  );
}
