import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Animated, Text, View } from "react-native";
import type {
    SessionEnvironment,
    WeeklyObservabilitySummary,
} from "../../core/models";
import type { PeriodizationAutoPlanForCycleDayResult } from "./application/build-auto-plan-for-cycle-day";
import type {
    DriftFrequencyByClassItem,
  ObservabilityInsight,
    ObservabilityTrendByClass,
    UnstableObservabilityWeek,
} from "../../db/observability-summaries";
import { Pressable } from "../../ui/Pressable";
import { type ThemeColors } from "../../ui/app-theme";
import { getSectionCardStyle } from "../../ui/section-styles";
import type { WeeklyOperationalTeacherIntent } from "./application/format-weekly-operational-intent-for-teacher";

type WeekScheduleItem = {
  label: string;
  dayNumber: number;
  session: string;
  date: string;
  autoPlan?: PeriodizationAutoPlanForCycleDayResult | null;
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

const formatSessionEnvironmentLabel = (value?: SessionEnvironment) => {
  switch (value) {
    case "quadra":
      return "Quadra";
    case "academia":
      return "Academia";
    case "mista":
      return "Mista";
    case "preventiva":
      return "Preventiva";
    default:
      return "";
  }
};

type WeekTabProps = {
  colors: ThemeColors;
  weekSchedule: WeekScheduleItem[];
  activeWeek: WeekPlan;
  weeklyTeacherIntent: WeeklyOperationalTeacherIntent | null;
  weeklyObservabilitySummary: WeeklyObservabilitySummary | null;
  qaModeEnabled: boolean;
  showQaModeToggle: boolean;
  onToggleQaMode: () => void;
  showQaDebugPanel: boolean;
  onToggleQaDebugPanel: () => void;
  classObservabilityTrend: ObservabilityTrendByClass | null;
  classObservabilityDriftFrequency: DriftFrequencyByClassItem[];
  classRecentUnstableWeeks: UnstableObservabilityWeek[];
  classObservabilityInsights: ObservabilityInsight[];
  onGoToWeek: (weekNumber: number) => void;
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
  weeklyTeacherIntent,
  weeklyObservabilitySummary,
  qaModeEnabled,
  showQaModeToggle,
  onToggleQaMode,
  showQaDebugPanel,
  onToggleQaDebugPanel,
  classObservabilityTrend,
  classObservabilityDriftFrequency,
  classRecentUnstableWeeks,
  classObservabilityInsights,
  onGoToWeek,
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

      {showQaModeToggle ? (
        <Pressable
          onPress={onToggleQaMode}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: qaModeEnabled ? colors.infoBg : colors.border,
            backgroundColor: qaModeEnabled ? colors.infoBg : colors.card,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            {qaModeEnabled ? "QA MODE: ON" : "QA MODE: OFF"}
          </Text>
        </Pressable>
      ) : null}

      {weeklyTeacherIntent ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 8 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            {weeklyTeacherIntent.title}
          </Text>
          <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
            {weeklyTeacherIntent.summary}
          </Text>
          <View style={{ gap: 4 }}>
            {weeklyTeacherIntent.teacherNotes.map((note) => (
              <Text key={note} style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
                {`- ${note}`}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {qaModeEnabled && weeklyObservabilitySummary ? (
        <View
          style={[
            getSectionCardStyle(colors, "warning", { padding: 12, radius: 14, shadow: false }),
            { gap: 8 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
            QA SUMMARY
          </Text>
          <Text style={{ color: colors.text, fontSize: 11 }}>
            {`Trimestre: ${weeklyObservabilitySummary.quarter} · Fechamento: ${weeklyObservabilitySummary.closingType}`}
          </Text>
          <Text style={{ color: colors.text, fontSize: 11 }}>
            {`Foco: ${weeklyObservabilitySummary.quarterFocus}`}
          </Text>
          <Text style={{ color: colors.text, fontSize: 11 }}>
            {`Sessoes: ${weeklyObservabilitySummary.sessionSummaries
              .map((item) => `S${item.sessionIndexInWeek} ${item.sessionRole}`)
              .join(" | ")}`}
          </Text>
          <Text style={{ color: colors.text, fontSize: 11 }}>
            {`Coerencia: ${weeklyObservabilitySummary.coherence.every((item) => item.envelopeRespected) ? "ok" : "drift detectado"}`}
          </Text>
          {weeklyObservabilitySummary.weekRulesApplied.length ? (
            <Text style={{ color: colors.text, fontSize: 11 }}>
              {`Regras: ${weeklyObservabilitySummary.weekRulesApplied.join(", ")}`}
            </Text>
          ) : null}
          {weeklyObservabilitySummary.driftSignals.length ? (
            <Text style={{ color: colors.warningText, fontSize: 11 }}>
              {`Drift: ${weeklyObservabilitySummary.driftSignals
                .map((signal) => `${signal.code} (${signal.severity})`)
                .join(" | ")}`}
            </Text>
          ) : null}

          <Pressable
            onPress={onToggleQaDebugPanel}
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
              {showQaDebugPanel ? "Ocultar debug detalhado" : "Mostrar debug detalhado"}
            </Text>
          </Pressable>

          {showQaDebugPanel ? (
            <View style={{ gap: 6 }}>
              {weeklyObservabilitySummary.sessionDebug.map((item) => (
                <Text key={`qa-debug-${item.sessionIndex}`} style={{ color: colors.muted, fontSize: 10 }}>
                  {`S${item.sessionIndex} ${item.sessionRole} · envelope=${item.envelopeRespected ? "ok" : "fail"} · rules=${item.rulesApplied.join(",") || "-"}`}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {qaModeEnabled && classObservabilityTrend && classObservabilityTrend.totalWeeks > 0 ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            TENDÊNCIA DA TURMA
          </Text>
          <Text style={{ color: colors.text, fontSize: 11 }}>
            {`${classObservabilityTrend.totalWeeks} semanas · coerência ${Math.round(classObservabilityTrend.coherencePassRate * 100)}% · score médio ${(classObservabilityTrend.averageCoherenceScore * 100).toFixed(0)}%`}
          </Text>
          <Text style={{ color: classObservabilityTrend.unstableWeeks > 0 ? colors.warningText : colors.muted, fontSize: 11 }}>
            {`Instáveis: ${classObservabilityTrend.unstableWeeks} · severidade alta: ${classObservabilityTrend.highSeverityWeeks}`}
          </Text>
        </View>
      ) : null}

      {qaModeEnabled && classObservabilityDriftFrequency.some((item) => item.total > 0) ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            DRIFTS MAIS FREQUENTES
          </Text>
          {classObservabilityDriftFrequency
            .filter((item) => item.total > 0)
            .slice(0, 4)
            .map((item) => (
              <View key={item.code} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: colors.text, fontSize: 11, flex: 1 }}>
                  {item.code.replace(/_/g, " ")}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  {`${item.total}× (L${item.low} M${item.medium} H${item.high})`}
                </Text>
              </View>
            ))}
        </View>
      ) : null}

      {qaModeEnabled && classRecentUnstableWeeks.length > 0 ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            SEMANAS INSTÁVEIS RECENTES
          </Text>
          {classRecentUnstableWeeks.map((week) => {
            const topSignal = week.driftSignals[0];
            return (
              <Pressable
                key={week.planId}
                onPress={() => onGoToWeek(week.weekNumber)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                    {`Semana ${week.weekNumber} · coerência ${(week.coherenceScore * 100).toFixed(0)}%`}
                  </Text>
                  {topSignal ? (
                    <Text style={{ color: colors.warningText, fontSize: 10 }}>
                      {`${topSignal.code.replace(/_/g, " ")} · ${topSignal.severity}`}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={12} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {qaModeEnabled && classObservabilityInsights.length > 0 ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            INSIGHTS AUTOMATICOS
          </Text>
          {classObservabilityInsights.map((insight) => {
            const toneColor =
              insight.severity === "critical"
                ? colors.warningText
                : insight.severity === "warning"
                  ? colors.text
                  : colors.muted;
            return (
              <Text
                key={`${insight.code}-${insight.message}`}
                style={{ color: toneColor, fontSize: 11, lineHeight: 16 }}
              >
                {`- [${insight.severity.toUpperCase()}] ${insight.message}`}
              </Text>
            );
          })}
        </View>
      ) : null}

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

                {item.autoPlan?.sessionEnvironment ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 6,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                      {formatSessionEnvironmentLabel(item.autoPlan.sessionEnvironment)}
                    </Text>
                  </View>
                ) : null}

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
