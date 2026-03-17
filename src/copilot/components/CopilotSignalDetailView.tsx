import { Text, View } from "react-native";

import type { InsightsView } from "../CopilotProvider";
import type { CopilotAction } from "../hooks/useRegistryManager";
import type { Signal as CopilotSignal } from "../../ai/signal-engine";
import { Pressable } from "../../ui/Pressable";

type Colors = {
  border: string;
  background: string;
  secondaryBg: string;
  text: string;
  muted: string;
  primaryBg: string;
  primaryText: string;
  card: string;
  inputBg: string;
  dangerText: string;
  warningText: string;
};

type CopilotSignalDetailViewProps = {
  colors: Colors;
  insightsView: InsightsView;
  activeDrawerSignal: CopilotSignal | null;
  activeCategoryLabel: string | null;
  selectedSeverityColor: string;
  selectedSeverityLabel: string;
  recommendedActionIds: Set<string>;
  orderedActions: CopilotAction[];
  recommendedActions: CopilotAction[];
  state: {
    runningActionId: string | null;
  };
  runAction: (action: CopilotAction) => Promise<void>;
};

export function CopilotSignalDetailView({
  colors,
  insightsView,
  activeDrawerSignal,
  activeCategoryLabel,
  selectedSeverityColor,
  selectedSeverityLabel,
  recommendedActionIds,
  orderedActions,
  recommendedActions,
  state,
  runAction,
}: CopilotSignalDetailViewProps) {
  if (
    insightsView.mode !== "detail" ||
    insightsView.category === "regulation" ||
    !activeDrawerSignal
  ) {
    return null;
  }

  return (
    <>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>
          {activeCategoryLabel ?? "Insight selecionado"}
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 10,
            gap: 4,
          }}
        >
          <Text style={{ color: selectedSeverityColor, fontSize: 11, fontWeight: "800" }}>
            Prioridade - {selectedSeverityLabel}
          </Text>
          <Text style={{ color: colors.text, fontWeight: "800" }}>{activeDrawerSignal.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{activeDrawerSignal.summary}</Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>Ações gerais</Text>
        {recommendedActions.length ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            As ações recomendadas para este insight aparecem primeiro.
          </Text>
        ) : null}
        {orderedActions.length ? (
          orderedActions.map((action) => {
            const isRecommended = recommendedActionIds.has(action.id);
            return (
              <Pressable
                key={action.id}
                onPress={() => {
                  void runAction(action);
                }}
                disabled={Boolean(state.runningActionId)}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isRecommended ? colors.primaryBg : colors.border,
                  backgroundColor: colors.card,
                  padding: 12,
                  opacity: state.runningActionId && state.runningActionId !== action.id ? 0.6 : 1,
                }}
              >
                {isRecommended ? (
                  <Text style={{ color: colors.primaryBg, fontSize: 10, fontWeight: "800", marginBottom: 4 }}>
                    RECOMENDADA PARA ESTE INSIGHT
                  </Text>
                ) : null}
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {state.runningActionId === action.id ? "Executando..." : action.title}
                </Text>
                {action.description ? (
                  <Text style={{ color: colors.muted, marginTop: 3, fontSize: 12 }}>{action.description}</Text>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <Text style={{ color: colors.muted }}>Sem ações disponíveis neste contexto.</Text>
        )}
      </View>
    </>
  );
}
