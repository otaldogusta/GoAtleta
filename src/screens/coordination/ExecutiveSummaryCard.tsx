import { useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";

import {
    type DataFixSuggestionsResult,
    type ExecutiveSummaryResult,
} from "../../api/ai";
import { radius } from "../../theme/tokens";
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
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 430;
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);

  if (loading) return null;

  return (
    <View
      style={{
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.surface,
        padding: isCompactLayout ? 12 : 16,
        gap: isCompactLayout ? 8 : 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: isCompactLayout ? "flex-start" : "center", gap: 8 }}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "900" }}>
            Assistente
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Resumo executivo, classificação de erro e sugestões de correção.
          </Text>
        </View>
        <View
          style={{
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.backgroundSubtle,
            paddingHorizontal: 10,
            paddingVertical: isCompactLayout ? 5 : 6,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 11 }}>
            Planejamento assistido
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          onPress={onGenerateExecutiveSummary}
          disabled={aiLoading}
          style={{
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: aiLoading ? colors.secondaryBg : colors.primaryBg,
            paddingHorizontal: 10,
            paddingVertical: isCompactLayout ? 8 : 9,
          }}
        >
          <Text style={{ color: aiLoading ? colors.muted : colors.primaryText, fontWeight: "700", fontSize: isCompactLayout ? 11 : 12 }}>
            Gerar resumo executivo
          </Text>
        </Pressable>
        <Pressable
          onPress={onSuggestDataFixes}
          disabled={aiLoading}
          style={{
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.backgroundSubtle,
            paddingHorizontal: 10,
            paddingVertical: isCompactLayout ? 8 : 9,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: isCompactLayout ? 11 : 12 }}>
            Sugerir correções
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowAdvancedActions((current) => !current)}
          style={{
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.backgroundSubtle,
            paddingHorizontal: 10,
            paddingVertical: isCompactLayout ? 8 : 9,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: isCompactLayout ? 11 : 12 }}>
            {showAdvancedActions ? "Ocultar ações" : "Mais ações"}
          </Text>
        </Pressable>
      </View>

      {showAdvancedActions ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable
            onPress={onCopyWhatsappMessage}
            disabled={aiLoading || aiExportLoading}
            style={{
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: colors.backgroundSubtle,
              paddingHorizontal: 10,
              paddingVertical: isCompactLayout ? 8 : 9,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: isCompactLayout ? 11 : 12 }}>
              Copiar WhatsApp
            </Text>
          </Pressable>
          <Pressable
            onPress={onExportMarkdown}
            disabled={aiLoading || aiExportLoading}
            style={{
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: colors.backgroundSubtle,
              paddingHorizontal: 10,
              paddingVertical: isCompactLayout ? 8 : 9,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: isCompactLayout ? 11 : 12 }}>
              Exportar Markdown
            </Text>
          </Pressable>
          <Pressable
            onPress={onExportPdf}
            disabled={aiLoading || aiExportLoading}
            style={{
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: colors.backgroundSubtle,
              paddingHorizontal: 10,
              paddingVertical: isCompactLayout ? 8 : 9,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: isCompactLayout ? 11 : 12 }}>
              Exportar PDF
            </Text>
          </Pressable>
        </View>
      ) : null}
      {aiMessage ? (
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{aiMessage}</Text>
      ) : null}
      {executiveSummary ? (
        <View
          style={{
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.backgroundSubtle,
            padding: 12,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 12 }}>
            Resumo: {executiveSummary.headline}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {executiveSummary.recommendedActions.slice(0, 2).join(" • ") || "Sem ações sugeridas."}
          </Text>
        </View>
      ) : null}
      {dataFixSuggestions ? (
        <View
          style={{
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.backgroundSubtle,
            padding: 12,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 12 }}>
            Correções sugeridas
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {dataFixSuggestions.summary}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
