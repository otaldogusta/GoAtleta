import { Text, View } from "react-native";

import type { Signal as CopilotSignal } from "../../ai/signal-engine";
import type { RegulationUpdate } from "../../api/regulation-updates";
import { Pressable } from "../../ui/Pressable";
import type { InsightsCategory, InsightsView } from "../types";

type SignalInsightsCategory = Exclude<InsightsCategory, "regulation">;

const categoryLabelById: Record<InsightsCategory, string> = {
  reports: "Relatórios",
  absences: "Faltas consecutivas",
  nfc: "Presença NFC",
  attendance: "Queda de presença",
  engagement: "Risco de engajamento",
  regulation: "Regulamento atualizado",
};

const regulationDateLabel = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("pt-BR");
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

type CopilotCategoryViewProps = {
  colors: Colors;
  insightsView: InsightsView;
  setInsightsView: (view: InsightsView) => void;
  state: {
    regulationUpdates: RegulationUpdate[];
  };
  signalsByCategory: Record<SignalInsightsCategory, CopilotSignal[]>;
  setActiveSignal: (signalId: string | null) => void;
};

export function CopilotCategoryView({
  colors,
  insightsView,
  setInsightsView,
  state,
  signalsByCategory,
  setActiveSignal,
}: CopilotCategoryViewProps) {
  if (insightsView.mode !== "category") return null;

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "800" }}>
        {categoryLabelById[insightsView.category]}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {insightsView.category === "regulation"
          ? "Toque em uma atualização para ver detalhes e fonte oficial."
          : "Toque em um insight para ver detalhes e ações relacionadas."}
      </Text>
      {insightsView.category === "regulation"
        ? state.regulationUpdates.filter((item) => !item.isRead).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setInsightsView({
                  mode: "detail",
                  category: "regulation",
                  itemId: item.id,
                });
              }}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 10,
                gap: 4,
              }}
            >
              <Text style={{ color: colors.primaryBg, fontWeight: "800", fontSize: 11 }}>
                {item.sourceAuthority}
              </Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{item.diffSummary}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Publicado em {regulationDateLabel(item.publishedAt ?? item.createdAt)}
                {item.isRead ? " - lido" : " - não lido"}
              </Text>
            </Pressable>
          ))
        : signalsByCategory[insightsView.category as SignalInsightsCategory].map((signal) => {
            const severityColor =
              signal.severity === "critical"
                ? colors.dangerText
                : signal.severity === "high"
                  ? colors.warningText
                  : signal.severity === "medium"
                    ? colors.text
                    : colors.muted;
            return (
              <Pressable
                key={signal.id}
                onPress={() => {
                  setActiveSignal(signal.id);
                  setInsightsView({
                    mode: "detail",
                    category: insightsView.category,
                    itemId: signal.id,
                  });
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 10,
                  gap: 4,
                }}
              >
                <Text style={{ color: severityColor, fontWeight: "800", fontSize: 11 }}>
                  {signal.severity.toUpperCase()}
                </Text>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{signal.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{signal.summary}</Text>
              </Pressable>
            );
          })}
    </View>
  );
}
