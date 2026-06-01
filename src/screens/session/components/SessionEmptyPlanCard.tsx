import { Text, View } from "react-native";

import { ptBR } from "../../../constants/copy/pt-br";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import type { SessionSavedPlanPreview } from "./session-training-ui-types";

type Props = {
  colors: ThemeColors;
  title: string;
  description: string;
  applyTrainingLabel: string;
  generateAutomaticPlanLabel: string;
  showSavedClassPlans: boolean;
  savedPlans: SessionSavedPlanPreview[];
  isGeneratingPlan: boolean;
  isSavingPlan: boolean;
  onToggleSavedClassPlans: () => void;
  onGeneratePlan: () => void;
  onApplySavedPlan: (planId: string) => void;
};

export function SessionEmptyPlanCard({
  colors,
  title,
  description,
  applyTrainingLabel,
  generateAutomaticPlanLabel,
  showSavedClassPlans,
  savedPlans,
  isGeneratingPlan,
  isSavingPlan,
  onToggleSavedClassPlans,
  onGeneratePlan,
  onApplySavedPlan,
}: Props) {
  const planActionBusy = isGeneratingPlan || isSavingPlan;

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted }}>
        {description}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          onPress={onToggleSavedClassPlans}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: colors.primaryBg,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            {showSavedClassPlans ? ptBR.session.emptyPlan.hidePlans : applyTrainingLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={onGeneratePlan}
          disabled={planActionBusy}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
            opacity: planActionBusy ? 0.65 : 1,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {isSavingPlan
              ? ptBR.common.feedback.savingPlan
              : isGeneratingPlan
                ? ptBR.common.feedback.generatingPlan
                : generateAutomaticPlanLabel}
          </Text>
        </Pressable>
      </View>
      {showSavedClassPlans ? (
        <View
          style={{
            gap: 10,
            paddingTop: 4,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
              {ptBR.session.emptyPlan.savedPlansTitle}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {ptBR.session.emptyPlan.savedPlansDescription}
            </Text>
          </View>
          {savedPlans.length ? (
            savedPlans.map((savedPlan) => (
              <View
                key={savedPlan.id}
                style={{
                  gap: 8,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                    {savedPlan.title}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {savedPlan.meta}
                  </Text>
                  {savedPlan.preview ? (
                    <Text style={{ color: colors.text, fontSize: 12 }}>
                      {savedPlan.preview}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, flex: 1 }}>
                    {savedPlan.applicationLabel}
                  </Text>
                  <Pressable
                    onPress={() => onApplySavedPlan(savedPlan.id)}
                    disabled={savedPlan.isApplying}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: savedPlan.isApplying ? colors.border : colors.primaryBg,
                    }}
                  >
                    <Text
                      style={{
                        color: savedPlan.isApplying ? colors.muted : colors.primaryText,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      {savedPlan.isApplying ? ptBR.common.feedback.applying : ptBR.session.emptyPlan.applyThisDay}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {ptBR.session.emptyPlan.noSavedPlans}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
