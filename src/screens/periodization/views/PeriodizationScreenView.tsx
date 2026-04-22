import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

import { getSectionCardStyle } from "../../../ui/section-styles";
import { CycleTab } from "../CycleTab";
import { OverviewTab } from "../OverviewTab";
import { WeekTab } from "../WeekTab";
import { type PeriodizationScreenViewModel } from "./buildPeriodizationScreenViewModel";

export function PeriodizationScreenView({
  activeTab,
  colors,
  contextCardProps,
  overviewTabProps,
  cycleTabProps,
  weekTabProps,
}: PeriodizationScreenViewModel) {
  const {
    selectedClass,
    normalizeText,
    periodizationContext,
    isLoadingPeriodizationKnowledge,
    periodizationKnowledgeSnapshot,
    periodizationPlanReview,
    formatPeriodizationContextModel,
    formatPeriodizationContextLoad,
  } = contextCardProps;
  return (
    <>
      {activeTab === "geral" ? <OverviewTab {...overviewTabProps} /> : null}

      {activeTab === "geral" && selectedClass ? (
        <View
          style={[
            getSectionCardStyle(colors, "info", { padding: 12, radius: 16, shadow: false }),
            { gap: 8, marginBottom: 12 },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="layers-outline" size={18} color={colors.primaryText} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Contexto pedagógico
            </Text>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText(
                `${formatPeriodizationContextModel(periodizationContext.model)} · ${
                  periodizationContext.objective || "Sem objetivo definido"
                }`
              )}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText(
                `${periodizationContext.focus || "Sem foco"}${
                  formatPeriodizationContextLoad(periodizationContext)
                    ? ` · ${formatPeriodizationContextLoad(periodizationContext)}`
                    : ""
                }${periodizationContext.cyclePhase ? ` · ${periodizationContext.cyclePhase}` : ""}`
              )}
            </Text>
            {periodizationContext.constraints?.length ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText(
                  `${periodizationContext.constraints.length} restrição(ões) ativas no momento`
                )}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {activeTab === "geral" && selectedClass ? (
        <View
          style={[
            getSectionCardStyle(colors, "info", { padding: 12, radius: 16, shadow: false }),
            { gap: 10 },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryText} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Revisão científica
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: isLoadingPeriodizationKnowledge
                  ? colors.secondaryBg
                  : periodizationKnowledgeSnapshot
                    ? periodizationPlanReview?.ok
                      ? colors.successBg
                      : colors.warningBg
                    : colors.secondaryBg,
              }}
            >
              <Text
                style={{
                  color: isLoadingPeriodizationKnowledge
                    ? colors.muted
                    : periodizationKnowledgeSnapshot
                      ? periodizationPlanReview?.ok
                        ? colors.successText
                        : colors.warningText
                      : colors.muted,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {isLoadingPeriodizationKnowledge
                  ? "Carregando base"
                  : periodizationKnowledgeSnapshot
                    ? periodizationPlanReview?.ok
                      ? "Plano validado"
                      : `${periodizationPlanReview?.issues.length ?? 0} alerta(s)`
                    : "Base ausente"}
              </Text>
            </View>
          </View>

          {isLoadingPeriodizationKnowledge ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Carregando snapshot científico da turma.
            </Text>
          ) : periodizationKnowledgeSnapshot ? (
            <>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText(
                  `Base ${periodizationKnowledgeSnapshot.versionLabel} · ${periodizationKnowledgeSnapshot.domain}`
                )}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {periodizationPlanReview
                  ? normalizeText(
                      periodizationPlanReview.issues.length
                        ? `${periodizationPlanReview.issues.length} alerta(s) para revisar antes de fechar o ciclo.`
                        : "Plano alinhado com a base científica ativa."
                    )
                  : normalizeText("Base ativa, sem resumo de revisão disponível neste momento.")}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Nenhuma base científica ativa para esta turma.
            </Text>
          )}
        </View>
      ) : null}

      {activeTab === "ciclo" ? <CycleTab {...cycleTabProps} /> : null}

      {activeTab === "semana" ? <WeekTab {...weekTabProps} /> : null}
    </>
  );
}
