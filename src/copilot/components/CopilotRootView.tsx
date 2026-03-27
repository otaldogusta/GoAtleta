import { Ionicons } from "@expo/vector-icons";
import { Linking, Text, View } from "react-native";

import type { InsightsView } from "../CopilotProvider";
import type { OperationalContextResult } from "../operational-context";
import type { CopilotAction } from "../hooks/useRegistryManager";
import type { Signal as CopilotSignal } from "../../ai/signal-engine";
import { Pressable } from "../../ui/Pressable";
import type { InsightsCategory } from "../CopilotProvider";

type SignalInsightsCategory = Exclude<InsightsCategory, "regulation">;

const categoryLabelById: Record<InsightsCategory, string> = {
  reports: "Relatórios",
  absences: "Faltas consecutivas",
  nfc: "Presença NFC",
  attendance: "Queda de presença",
  engagement: "Risco de engajamento",
  regulation: "Regulamento atualizado",
};

const regulationRelativeLabel = (value: string | null | undefined, nowMs: number) => {
  if (!value) return "sem data";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "sem data";
  const diffHours = Math.max(0, (nowMs - parsed) / 36e5);
  if (diffHours < 1) return "agora";
  if (diffHours < 24) return `há ${Math.floor(diffHours)}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays}d`;
  const d = new Date(parsed);
  return d.toLocaleDateString("pt-BR");
};

const resolveContextActionIcon = (action: { id: string; title: string }): keyof typeof Ionicons.glyphMap => {
  const key = normalizeComposerText(`${action.id} ${action.title}`);
  if (key.includes("treino")) return "sparkles-outline";
  if (key.includes("resumo")) return "document-text-outline";
  if (key.includes("engaj") || key.includes("risco")) return "pulse-outline";
  if (key.includes("pesquisa") || key.includes("cient")) return "search-outline";
  if (key.includes("mensagem") || key.includes("whatsapp")) return "chatbubble-outline";
  if (key.includes("checklist")) return "checkmark-done-outline";
  if (key.includes("regul")) return "shield-checkmark-outline";
  if (key.includes("duplic")) return "copy-outline";
  if (key.includes("nfc") || key.includes("presenca")) return "radio-outline";
  return "flash-outline";
};

const normalizeComposerText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const signalToCategory = (signalType: CopilotSignal["type"]): InsightsCategory => {
  switch (signalType) {
    case "report_delay":
      return "reports";
    case "repeated_absence":
      return "absences";
    case "unusual_presence_pattern":
      return "nfc";
    case "attendance_drop":
      return "attendance";
    case "engagement_risk":
      return "engagement";
  }
};

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

type CopilotRootViewProps = {
  isWebModal: boolean;
  colors: Colors;
  insightsView: InsightsView;
  setInsightsView: (view: InsightsView) => void;
  operationalContext: OperationalContextResult;
  state: {
    actions: CopilotAction[];
    runningActionId: string | null;
  };
  hasRegulationDetails: boolean;
  latestRegulationSourceUrl: string;
  rootQuickActions: CopilotAction[];
  canExpandRootActions: boolean;
  setShowAllRootActions: (value: boolean) => void;
  nowMs: number;
  setActiveSignal: (signalId: string | null) => void;
  runAction: (action: CopilotAction) => Promise<void>;
  onNavigateToRegulationHistory: () => void;
};

export function CopilotRootView({
  isWebModal,
  colors,
  insightsView,
  setInsightsView,
  operationalContext,
  state,
  hasRegulationDetails,
  latestRegulationSourceUrl,
  rootQuickActions,
  canExpandRootActions,
  setShowAllRootActions,
  nowMs,
  setActiveSignal,
  runAction,
  onNavigateToRegulationHistory,
}: CopilotRootViewProps) {
  if (insightsView.mode !== "root") return null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignItems: "center", gap: 4, paddingVertical: 4 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: isWebModal ? 28 : 22,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          Como posso ajudar?
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
          {operationalContext.panel.headerTitle}
        </Text>
      </View>
      {operationalContext.panel.attentionSignals.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
            PONTOS DE ATENÇÃO
          </Text>
          {operationalContext.panel.attentionSignals.map((signal, index) => (
            <View key={signal.id} style={{ gap: 6 }}>
              <Pressable
                onPress={() => {
                  setActiveSignal(signal.id);
                  setInsightsView({
                    mode: "detail",
                    category: signalToCategory(signal.type as Parameters<typeof signalToCategory>[0]),
                    itemId: signal.id,
                  });
                }}
                style={{ paddingVertical: 3, gap: 2 }}
              >
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                  {signal.title}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                  {categoryLabelById[signalToCategory(signal.type as Parameters<typeof signalToCategory>[0])]} - {regulationRelativeLabel(signal.detectedAt, nowMs)}
                </Text>
              </Pressable>
              {index < operationalContext.panel.attentionSignals.length - 1 ? (
                <View style={{ height: 1, backgroundColor: colors.border }} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {hasRegulationDetails ? (
        <View style={{ gap: 8 }}>
          {operationalContext.panel.attentionSignals.length ? (
            <View style={{ height: 1, backgroundColor: colors.border }} />
          ) : null}
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
            REGULAMENTAÇÃO
          </Text>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            {operationalContext.panel.activeRuleSetLabel === "Sem ruleset ativo"
              ? "Sem regulamento ativo definido"
              : operationalContext.panel.activeRuleSetLabel + " - ativo"}
          </Text>
          {operationalContext.panel.pendingRuleSetLabel ? (
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
              Próximo ciclo: {operationalContext.panel.pendingRuleSetLabel}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {operationalContext.panel.unreadRegulationCount > 0 ? (
              <Pressable
                onPress={() => setInsightsView({ mode: "category", category: "regulation" })}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  Ver mudanças
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onNavigateToRegulationHistory}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                Comparar
              </Text>
            </Pressable>
            {latestRegulationSourceUrl ? (
              <Pressable
                onPress={() => {
                  void Linking.openURL(latestRegulationSourceUrl);
                }}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Fonte</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {state.actions.length ? (
        <View style={{ gap: 8 }}>
          {hasRegulationDetails || operationalContext.panel.attentionSignals.length ? (
            <View style={{ height: 1, backgroundColor: colors.border }} />
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {rootQuickActions.map((action) => (
              <Pressable
                key={"root_action_" + action.id}
                onPress={() => {
                  void runAction(action);
                }}
                disabled={Boolean(state.runningActionId)}
                style={{
                  flexGrow: 1,
                  flexBasis: "48.5%",
                  minHeight: 98,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 8,
                  opacity: state.runningActionId && state.runningActionId !== action.id ? 0.6 : 1,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <Ionicons name={resolveContextActionIcon(action)} size={16} color={colors.text} />
                </View>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, flexShrink: 1 }}>
                  {state.runningActionId === action.id ? "Executando..." : action.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 16, flexShrink: 1 }}>
                  {action.description ?? "Ação contextual para este momento."}
                </Text>
              </Pressable>
            ))}
            {canExpandRootActions ? (
              <Pressable
                onPress={() => setShowAllRootActions(true)}
                style={{
                  flexGrow: 1,
                  flexBasis: "48.5%",
                  minHeight: 98,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 8,
                  alignItems: "flex-start",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </View>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Ver mais ações</Text>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 16 }}>
                  Mostrar lista completa de ações disponíveis.
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
