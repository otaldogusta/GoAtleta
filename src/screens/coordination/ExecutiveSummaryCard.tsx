import { Text, View } from "react-native";

import {
    type DataFixSuggestionsResult,
    type ExecutiveSummaryResult,
} from "../../api/ai";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type AppColors = ReturnType<typeof useAppTheme>["colors"];

type ExecutiveSummaryCardProps = {
  colors: AppColors;
  loading: boolean;
  aiLoading: boolean;
  aiExportLoading: boolean;
  aiMessage: string | null;
  executiveSummary: ExecutiveSummaryResult | null;
  dataFixSuggestions: DataFixSuggestionsResult | null;
  onGenerateExecutiveSummary: () => void;
  onSuggestDataFixes: () => void;
  onCopyWhatsappMessage: () => void;
  onExportMarkdown: () => void;
  onExportPdf: () => void;
};

export function ExecutiveSummaryCard({
  colors,
  loading,
  aiLoading,
  aiExportLoading,
  aiMessage,
  executiveSummary,
  dataFixSuggestions,
  onGenerateExecutiveSummary,
  onSuggestDataFixes,
  onCopyWhatsappMessage,
  onExportMarkdown,
  onExportPdf,
}: ExecutiveSummaryCardProps) {
  if (loading) return null;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 14,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
        IA Assistiva
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Resumo executivo, classificação de erro e sugestões de correção.
      </Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          onPress={onGenerateExecutiveSummary}
          disabled={aiLoading}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: aiLoading ? colors.secondaryBg : colors.primaryBg,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: aiLoading ? colors.muted : colors.primaryText, fontWeight: "700", fontSize: 12 }}>
            Gerar resumo executivo
          </Text>
        </Pressable>
        <Pressable
          onPress={onSuggestDataFixes}
          disabled={aiLoading}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Sugerir correções
          </Text>
        </Pressable>
        <Pressable
          onPress={onCopyWhatsappMessage}
          disabled={aiLoading || aiExportLoading}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Copiar WhatsApp
          </Text>
        </Pressable>
        <Pressable
          onPress={onExportMarkdown}
          disabled={aiLoading || aiExportLoading}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Exportar Markdown
          </Text>
        </Pressable>
        <Pressable
          onPress={onExportPdf}
          disabled={aiLoading || aiExportLoading}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Exportar PDF
          </Text>
        </Pressable>
      </View>
      {aiMessage ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>{aiMessage}</Text>
      ) : null}
      {executiveSummary ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            padding: 10,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Resumo: {executiveSummary.headline}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {executiveSummary.recommendedActions.slice(0, 2).join(" • ") || "Sem ações sugeridas."}
          </Text>
        </View>
      ) : null}
      {dataFixSuggestions ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            padding: 10,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Correções sugeridas
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {dataFixSuggestions.summary}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
