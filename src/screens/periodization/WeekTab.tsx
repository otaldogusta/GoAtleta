import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Animated, Text, View } from "react-native";
import type {
    DerivedObservabilityRecommendationState,
    RankedObservabilityRecommendation,
    RecommendationAxisAlignmentSummary,
    RecommendationAxisPersistenceSummary,
    RecommendationAxisTransitionSummary,
    RecommendationEvidence,
    RecommendationFamilyAggregate,
    RecommendationProblemAxisSummary,
    RecommendationProblemFamilySummary,
    RecommendationProblemFamilyTimelineItem,
    RecommendationQADigest,
    RecommendationWindowComparisonSummary,
    WeeklyObservabilitySummary,
} from "../../core/models";
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
  sessionRoleLabel?: string;
  sessionObjectiveLabel?: string;
  sessionMainTaskLabel?: string;
  sessionClosingLabel?: string;
  functionalVariationLabel?: string;
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
  classRankedRecommendations: RankedObservabilityRecommendation[];
  classObservabilityRecommendationStates: DerivedObservabilityRecommendationState[];
  classRecommendationEvidence: RecommendationEvidence[];
  classRecommendationAggregates: RecommendationFamilyAggregate[];
  classRecommendationProblemFamilySummary: RecommendationProblemFamilySummary;
  classRecommendationProblemAxisSummary: RecommendationProblemAxisSummary | null;
  classRecommendationProblemFamilyTimeline: RecommendationProblemFamilyTimelineItem[];
  classRecommendationAxisTransitionSummary: RecommendationAxisTransitionSummary | null;
  classRecommendationAxisPersistenceSummary: RecommendationAxisPersistenceSummary | null;
  classRecommendationQADigest: RecommendationQADigest | null;
  classRecommendationWindowComparison: RecommendationWindowComparisonSummary | null;
  classRecommendationAxisAlignment: RecommendationAxisAlignmentSummary | null;
  onAcceptRecommendation?: (state: DerivedObservabilityRecommendationState) => void;
  onRejectRecommendation?: (state: DerivedObservabilityRecommendationState) => void;
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
  classRankedRecommendations,
  classObservabilityRecommendationStates,
  classRecommendationEvidence,
  classRecommendationAggregates,
  classRecommendationProblemFamilySummary,
  classRecommendationProblemAxisSummary,
  classRecommendationProblemFamilyTimeline,
  classRecommendationAxisTransitionSummary,
  classRecommendationAxisPersistenceSummary,
  classRecommendationQADigest,
  classRecommendationWindowComparison,
  classRecommendationAxisAlignment,
  onAcceptRecommendation,
  onRejectRecommendation,
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
          <View
            style={{
              gap: 4,
              paddingTop: 6,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
              ESTABILIDADE DA SEMANA
            </Text>
            <Text style={{ color: colors.text, fontSize: 11 }}>
              {`Status: ${weeklyObservabilitySummary.stability.status} · Severidade: ${weeklyObservabilitySummary.stability.severity}`}
            </Text>
            {weeklyObservabilitySummary.stability.reasons.length ? (
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                {`Motivos: ${weeklyObservabilitySummary.stability.reasons.join(" | ")}`}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              gap: 4,
              paddingTop: 6,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
              AUTORIDADE SEMANAL
            </Text>
            <Text style={{ color: colors.text, fontSize: 11 }}>
              {`Pass rate: ${Math.round(weeklyObservabilitySummary.authority.passRate * 100)}%`}
            </Text>
            <Text style={{ color: colors.text, fontSize: 11 }}>
              {`Sessoes verificadas: ${weeklyObservabilitySummary.authority.totalChecks} · Violacoes: ${weeklyObservabilitySummary.authority.totalViolations}`}
            </Text>
            <Text style={{ color: colors.text, fontSize: 11 }}>
              {`Impacto na estabilidade: ${weeklyObservabilitySummary.stability.severity}`}
            </Text>
            {weeklyObservabilitySummary.authority.checks.map((check) => (
              <View key={`authority-check-${check.sessionIndexInWeek}`} style={{ gap: 2 }}>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  {`S${check.sessionIndexInWeek} · ${check.sessionRole} · ${check.isWithinEnvelope ? "OK" : "Violacao"}`}
                </Text>
                {!check.isWithinEnvelope ? (
                  <Text style={{ color: colors.warningText, fontSize: 10 }}>
                    {`- ${check.violations.join(", ")}`}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
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
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {`Atenção: ${classObservabilityTrend.attentionWeeks} · com violacao de autoridade: ${classObservabilityTrend.authorityViolationWeeks}`}
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
            const evidenceParts = [
              insight.evidence?.count != null ? `count=${insight.evidence.count}` : null,
              insight.evidence?.ratio != null ? `ratio=${insight.evidence.ratio}` : null,
              insight.evidence?.weeksConsidered != null
                ? `weeks=${insight.evidence.weeksConsidered}`
                : null,
              insight.evidence?.dominantCode ? `dominant=${insight.evidence.dominantCode}` : null,
            ].filter(Boolean);
            return (
              <Text
                key={`${insight.code}-${insight.message}`}
                style={{ color: toneColor, fontSize: 11, lineHeight: 16 }}
              >
                {`- [${insight.severity.toUpperCase()}] [${insight.scope.toUpperCase()}] ${insight.message}${evidenceParts.length ? ` (${evidenceParts.join(" · ")})` : ""}`}
              </Text>
            );
          })}
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationProblemFamilySummary.cohorts.length > 0 ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            LINHA DO TEMPO DOS EIXOS
          </Text>
          {classRecommendationProblemFamilyTimeline.slice(-4).map((item) => (
            <Text key={`axis-timeline-${item.weekNumber}`} style={{ color: colors.text, fontSize: 10 }}>
              {`S${item.weekNumber} · ${item.dominantLabel}`}
            </Text>
          ))}
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationAxisTransitionSummary ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            TRANSICAO DE EIXO
          </Text>
          <Text style={{ color: colors.text, fontSize: 10 }}>
            {`Tipo: ${classRecommendationAxisTransitionSummary.transitionType}`}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
            {classRecommendationAxisTransitionSummary.summary}
          </Text>
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationAxisPersistenceSummary ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            PERSISTENCIA DE EIXO
          </Text>
          <Text style={{ color: colors.text, fontSize: 10 }}>
            {`Tipo: ${classRecommendationAxisPersistenceSummary.persistenceType}`}
          </Text>
          {classRecommendationAxisPersistenceSummary.earlyWarning !== "none" ? (
            <Text
              style={{
                color:
                  classRecommendationAxisPersistenceSummary.earlyWarning === "warning"
                    ? colors.warningText
                    : colors.text,
                fontSize: 10,
                fontWeight: "700",
              }}
            >
              {`Alerta: ${classRecommendationAxisPersistenceSummary.earlyWarning}`}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
            {classRecommendationAxisPersistenceSummary.summary}
          </Text>
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationQADigest ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            DIGEST QA DA TURMA
          </Text>
          <Text style={{ color: colors.text, fontSize: 10, lineHeight: 16 }}>
            {classRecommendationQADigest.summary}
          </Text>
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationWindowComparison ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            JANELA CURTA vs MEDIA
          </Text>
          <Text style={{ color: colors.text, fontSize: 10 }}>
            {`Curta (${classRecommendationWindowComparison.shortWindow.windowSize}s): ${classRecommendationWindowComparison.shortWindow.dominantLabel ?? "-"}`}
          </Text>
          <Text style={{ color: colors.text, fontSize: 10 }}>
            {`Media (${classRecommendationWindowComparison.mediumWindow.windowSize}s): ${classRecommendationWindowComparison.mediumWindow.dominantLabel ?? "-"}`}
          </Text>
          <Text style={{ color: colors.text, fontSize: 10 }}>
            {`Divergencia: ${classRecommendationWindowComparison.divergence}`}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
            {classRecommendationWindowComparison.summary}
          </Text>
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationAxisAlignment ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            ALINHAMENTO EIXO x RECOMMENDATION
          </Text>
          <Text style={{ color: colors.text, fontSize: 10 }}>
            {`Tipo: ${classRecommendationAxisAlignment.alignmentType}`}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
            {classRecommendationAxisAlignment.summary}
          </Text>
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationProblemFamilySummary.cohorts.length > 0 ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            RESUMO POR EIXO
          </Text>
          <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
            {`Dominante: ${classRecommendationProblemAxisSummary?.dominantLabel ?? "-"}`}
          </Text>
          {classRecommendationProblemAxisSummary?.secondaryLabel ? (
            <Text style={{ color: colors.text, fontSize: 10 }}>
              {`Secundario: ${classRecommendationProblemAxisSummary.secondaryLabel}`}
            </Text>
          ) : null}
          <Text style={{ color: colors.text, fontSize: 10 }}>
            {`Tensao: ${classRecommendationProblemAxisSummary?.tension ?? "isolated"}`}
          </Text>
          {classRecommendationProblemAxisSummary?.summary ? (
            <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
              {classRecommendationProblemAxisSummary.summary}
            </Text>
          ) : null}
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationProblemFamilySummary.cohorts.length > 0 ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            EIXOS DE PROBLEMA (FAMILIAS)
          </Text>
          {classRecommendationProblemFamilySummary.dominantFamilyLabel ? (
            <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
              {`Dominante: ${classRecommendationProblemFamilySummary.dominantFamilyLabel}`}
            </Text>
          ) : null}
          {classRecommendationProblemFamilySummary.cohorts.map((cohort) => (
            <View key={cohort.family} style={{ gap: 1 }}>
              <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                {`${cohort.familyLabel} · recs=${cohort.recommendationsCount}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                {`alta=${cohort.highPriorityCount} · cautela=${cohort.cautiousCount}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>{cohort.familyHelperText}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {qaModeEnabled && classObservabilityRecommendationStates.length > 0 ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            RECOMENDACOES INTERNAS
          </Text>
          {classObservabilityRecommendationStates.map((state) => {
            const { recommendation, decision, decisionStatus } = state;
            const ranking =
              classRankedRecommendations.find(
                (item) => item.recommendation.code === recommendation.code
              ) ?? null;
            const isCautiousPresentation = ranking?.presentation.tone === "cautious";
            const evidence = decision
              ? classRecommendationEvidence.find(
                  (item) =>
                    item.recommendationCode === recommendation.code &&
                    item.baselineWeekNumber === decision.weekNumber
                )
              : null;
            const toneColor =
              recommendation.priority === "high"
                ? colors.warningText
                : recommendation.priority === "medium"
                  ? colors.text
                  : colors.muted;
            const statusColor =
              decisionStatus === "accepted"
                ? colors.successText
                : decisionStatus === "rejected"
                  ? colors.warningText
                  : colors.muted;
            const statusLabel =
              decisionStatus === "accepted"
                ? "ACEITA"
                : decisionStatus === "rejected"
                  ? "REJEITADA"
                  : "PENDENTE";

            return (
              <View
                key={recommendation.code}
                style={{
                  gap: 2,
                  paddingBottom: 6,
                  paddingHorizontal: 6,
                  paddingTop: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  borderRadius: 8,
                  backgroundColor: isCautiousPresentation ? colors.warningBg : "transparent",
                }}
              >
                <Text style={{ color: toneColor, fontSize: 11, fontWeight: "700" }}>
                  {`[${recommendation.priority.toUpperCase()}] ${recommendation.title}`}
                </Text>
                <Text style={{ color: colors.text, fontSize: 11, lineHeight: 16 }}>
                  {recommendation.message}
                </Text>
                {ranking ? (
                  <>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      {`confianca=${ranking.confidence} · historico=${ranking.framing}`}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                      {`Familia: ${ranking.familyPresentation.familyLabel}`}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      {ranking.familyPresentation.familyHelperText}
                    </Text>
                    <Text
                      style={{
                        color: isCautiousPresentation ? colors.warningText : colors.text,
                        fontSize: 10,
                        fontWeight: "700",
                      }}
                    >
                      {ranking.presentation.shortLabel}
                    </Text>
                    <Text
                      style={{
                        color: isCautiousPresentation ? colors.warningText : colors.muted,
                        fontSize: 10,
                      }}
                    >
                      {ranking.presentation.helperText}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      {ranking.framingMessage}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      {`ranking=${ranking.rankingReason} · score=${ranking.rankingScore}`}
                    </Text>
                  </>
                ) : null}
                <Text style={{ color: statusColor, fontSize: 10, fontWeight: "700" }}>
                  {`STATUS: ${statusLabel}`}
                </Text>
                {decision?.reasonType ? (
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {`motivo=${decision.reasonType}${decision.reasonNote ? ` · nota=${decision.reasonNote}` : ""}`}
                  </Text>
                ) : null}
                {evidence ? (
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {`evidencia=${evidence.outcome} · ${evidence.rationale}`}
                  </Text>
                ) : null}
                {decisionStatus === "pending" ? (
                  <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
                    <Pressable
                      onPress={() => {
                        if (onAcceptRecommendation) {
                          onAcceptRecommendation(state);
                        }
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: colors.successBg,
                        borderWidth: 1,
                        borderColor: colors.successText,
                      }}
                    >
                      <Text style={{ color: colors.successText, fontSize: 10, fontWeight: "700" }}>
                        ACEITAR
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (onRejectRecommendation) {
                          onRejectRecommendation(state);
                        }
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: colors.warningBg,
                        borderWidth: 1,
                        borderColor: colors.warningText,
                      }}
                    >
                      <Text style={{ color: colors.warningText, fontSize: 10, fontWeight: "700" }}>
                        REJEITAR
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {showQaDebugPanel ? (
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {`acao=${recommendation.action} · rationale=${recommendation.rationale} · evidencia=${recommendation.sourceSignals.join(",")}`}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {qaModeEnabled && classRecommendationAggregates.length > 0 ? (
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }),
            { gap: 6 },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            HISTORICO DE RECOMMENDATIONS
          </Text>
          {classRecommendationAggregates.map((aggregate) => (
            <View
              key={aggregate.recommendationCode}
              style={{ gap: 2, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                {aggregate.recommendationCode}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                {`sugestoes=${aggregate.totalSuggested} · aceitas=${aggregate.totalAccepted} · rejeitadas=${aggregate.totalRejected}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                {`improved=${aggregate.improvedCount} · unchanged=${aggregate.unchangedCount} · worsened=${aggregate.worsenedCount} · insufficient=${aggregate.insufficientEvidenceCount}`}
              </Text>
              <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                {`confianca=${aggregate.confidence}`}
              </Text>
            </View>
          ))}
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

                {item.sessionRoleLabel ? (
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}
                  >
                    {item.sessionRoleLabel}
                  </Text>
                ) : null}

                <Text
                  numberOfLines={2}
                  style={{ color: colors.text, fontSize: 11, fontWeight: "700", lineHeight: 14 }}
                >

                  {formatWeekSessionLabel(item.session || "Descanso")}

                </Text>

                {item.sessionClosingLabel ? (
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 9 }}>
                    {item.sessionClosingLabel}
                  </Text>
                ) : null}

                {item.functionalVariationLabel ? (
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 9 }}>
                    {item.functionalVariationLabel}
                  </Text>
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
