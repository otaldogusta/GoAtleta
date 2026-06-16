import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import type {
  ActivityCatalogAuditReport,
  ActivityCatalogUnusedVariant,
  ActivityCatalogUnknownReference,
} from "../../core/volleyball/activity-catalog-audit";
import type {
  ActivityCatalogInsight,
  ActivityCatalogInsightPriority,
  ActivityCatalogInsightReport,
} from "../../core/volleyball/activity-catalog-insights";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import {
  buildCatalogAuditExportPayload,
  formatCatalogAuditAsJson,
  formatCatalogAuditAsMarkdown,
  formatCatalogInsightActionMarkdown,
  getCatalogAuditCategoryLabel,
  getCatalogInsightScopeLabel,
} from "./catalogAuditFormatters";

type CatalogAuditInsightsPanelProps = {
  report: ActivityCatalogInsightReport;
  auditReport: ActivityCatalogAuditReport;
};

type PriorityFilter = "all" | ActivityCatalogInsightPriority;
type FallbackContent = {
  title: string;
  body: string;
};

const priorityLabels: Record<PriorityFilter, string> = {
  all: "Todos",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const priorityBadgeStyles: Record<
  ActivityCatalogInsightPriority,
  { label: string; borderColor: string; backgroundColor: string }
> = {
  high: {
    label: "Alta",
    borderColor: "#f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.14)",
  },
  medium: {
    label: "Média",
    borderColor: "#facc15",
    backgroundColor: "rgba(250, 204, 21, 0.12)",
  },
  low: {
    label: "Baixa",
    borderColor: "#64748b",
    backgroundColor: "rgba(100, 116, 139, 0.16)",
  },
};

const priorityGroups: ActivityCatalogInsightPriority[] = ["high", "medium", "low"];

const relatedVariantLimit = 6;
const unknownReferenceLimit = 6;

function PriorityFilterButton({
  value,
  selected,
  onPress,
}: {
  value: PriorityFilter;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={`Filtrar insights: ${priorityLabels[value]}`}
      onPress={onPress}
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : colors.secondaryBg,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "800" }}>
        {priorityLabels[value]}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const getInsightSkill = (insight: ActivityCatalogInsight) => {
  if (insight.scope.kind === "skill") return insight.scope.skill;
  return insight.suggestedActions.find((action) => action.target?.skill)?.target?.skill;
};

const relatedVariantsForInsight = (
  auditReport: ActivityCatalogAuditReport,
  insight: ActivityCatalogInsight
): ActivityCatalogUnusedVariant[] => {
  const skill = getInsightSkill(insight);
  if (!skill) return [];
  return auditReport.usage.unusedVariants
    .filter((item) => item.primarySkill === skill)
    .slice(0, relatedVariantLimit);
};

const unknownReferencesForInsight = (
  auditReport: ActivityCatalogAuditReport,
  insight: ActivityCatalogInsight
): ActivityCatalogUnknownReference[] => {
  if (insight.category !== "unknownReferences") return [];
  return auditReport.usage.unknownCatalogReferences.slice(0, unknownReferenceLimit);
};

function RelatedVariants({
  variants,
}: {
  variants: ActivityCatalogUnusedVariant[];
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "900" }}>Variantes relacionadas</Text>
      {variants.length ? (
        variants.map((item) => (
          <Text key={item.variantId} style={{ color: colors.muted }}>
            {item.title} · {item.primarySkill}
          </Text>
        ))
      ) : (
        <Text style={{ color: colors.muted }}>
          Nenhuma variante relacionada encontrada para este insight.
        </Text>
      )}
    </View>
  );
}

function UnknownReferences({
  references,
}: {
  references: ActivityCatalogUnknownReference[];
}) {
  const { colors } = useAppTheme();
  if (!references.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "900" }}>Referências desconhecidas</Text>
      {references.map((item, index) => (
        <Text key={`${item.reason}-${item.variantId ?? item.familyId ?? index}`} style={{ color: colors.muted }}>
          {item.reason} · {item.variantId ?? "sem variantId"} · {item.familyId ?? "sem familyId"}
        </Text>
      ))}
    </View>
  );
}

function InsightCard({
  insight,
  onOpenDetails,
  onCopyAction,
}: {
  insight: ActivityCatalogInsight;
  onOpenDetails: (insight: ActivityCatalogInsight) => void;
  onCopyAction: (insight: ActivityCatalogInsight) => void;
}) {
  const { colors } = useAppTheme();
  const badge = priorityBadgeStyles[insight.priority];
  const visibleEvidence = insight.evidence.slice(0, 3);
  const visibleActions = insight.suggestedActions.slice(0, 2);
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: badge.borderColor,
            backgroundColor: badge.backgroundColor,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>
            {badge.label}
          </Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900", flexShrink: 1 }}>
          {insight.title}
        </Text>
      </View>

      <Text style={{ color: colors.muted, fontWeight: "800" }}>
        {getCatalogAuditCategoryLabel(insight.category)}
      </Text>
      <Text style={{ color: colors.muted, lineHeight: 20 }}>{insight.message}</Text>

      {visibleEvidence.length ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>Evidências</Text>
          {visibleEvidence.map((item) => (
            <Text key={item} style={{ color: colors.muted }}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}

      {visibleActions.length ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>Ações sugeridas</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {visibleActions.map((action) => (
              <View
                key={`${action.type}-${action.label}`}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800" }}>{action.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <ActionButton label={`Ver detalhes: ${insight.title}`} onPress={() => onOpenDetails(insight)} />
        <ActionButton label={`Copiar ação: ${insight.title}`} onPress={() => onCopyAction(insight)} />
      </View>
    </View>
  );
}

function DetailModal({
  auditReport,
  insight,
  onClose,
}: {
  auditReport: ActivityCatalogAuditReport;
  insight: ActivityCatalogInsight | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const relatedVariants = insight ? relatedVariantsForInsight(auditReport, insight) : [];
  const unknownReferences = insight ? unknownReferencesForInsight(auditReport, insight) : [];

  return (
    <ModalSheet
      visible={Boolean(insight)}
      onClose={onClose}
      position="center"
      cardStyle={{
        width: "min(720px, 94vw)" as unknown as number,
        maxHeight: "86vh" as unknown as number,
        borderRadius: 18,
        padding: 16,
      }}
    >
      {insight ? (
        <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
              {insight.title}
            </Text>
            <Text style={{ color: colors.muted, fontWeight: "800" }}>
              Prioridade {priorityLabels[insight.priority]} · {getCatalogAuditCategoryLabel(insight.category)}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 21 }}>{insight.message}</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Escopo</Text>
            <Text style={{ color: colors.muted }}>{getCatalogInsightScopeLabel(insight)}</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Evidências completas</Text>
            {insight.evidence.map((item) => (
              <Text key={item} style={{ color: colors.muted }}>
                {item}
              </Text>
            ))}
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Ações sugeridas</Text>
            {insight.suggestedActions.map((action) => (
              <Text key={`${action.type}-${action.label}`} style={{ color: colors.muted }}>
                {action.label}
              </Text>
            ))}
          </View>

          <RelatedVariants variants={relatedVariants} />
          <UnknownReferences references={unknownReferences} />

          <ActionButton label="Fechar detalhes" onPress={onClose} />
        </ScrollView>
      ) : null}
    </ModalSheet>
  );
}

function FallbackCopyModal({
  content,
  onClose,
}: {
  content: FallbackContent | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <ModalSheet
      visible={Boolean(content)}
      onClose={onClose}
      position="center"
      cardStyle={{
        width: "min(720px, 94vw)" as unknown as number,
        maxHeight: "86vh" as unknown as number,
        borderRadius: 18,
        padding: 16,
      }}
    >
      {content ? (
        <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
            {content.title}
          </Text>
          <Text style={{ color: colors.muted }}>
            Não foi possível copiar automaticamente. Selecione o texto abaixo e copie manualmente.
          </Text>
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              padding: 12,
            }}
          >
            <Text selectable style={{ color: colors.text, fontFamily: "monospace" }}>
              {content.body}
            </Text>
          </View>
          <ActionButton label="Fechar conteúdo para cópia" onPress={onClose} />
        </ScrollView>
      ) : null}
    </ModalSheet>
  );
}

export function CatalogAuditInsightsPanel({ report, auditReport }: CatalogAuditInsightsPanelProps) {
  const { colors } = useAppTheme();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedInsight, setSelectedInsight] = useState<ActivityCatalogInsight | null>(null);
  const [fallbackContent, setFallbackContent] = useState<FallbackContent | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const filteredInsights =
    priorityFilter === "all"
      ? report.insights
      : report.insights.filter((item) => item.priority === priorityFilter);
  const payload = buildCatalogAuditExportPayload(auditReport, report);

  const copyContent = async (body: string, successMessage: string, fallbackTitle: string) => {
    try {
      await Clipboard.setStringAsync(body);
      setFeedback(successMessage);
    } catch {
      setFeedback("Não foi possível copiar automaticamente.");
      setFallbackContent({ title: fallbackTitle, body });
    }
  };

  const copyMarkdownReport = () =>
    copyContent(
      formatCatalogAuditAsMarkdown(payload),
      "Relatório copiado.",
      "Relatório Markdown"
    );

  const copyJsonReport = () =>
    copyContent(formatCatalogAuditAsJson(payload), "JSON copiado.", "Relatório JSON");

  const copyInsightAction = (insight: ActivityCatalogInsight) =>
    copyContent(
      formatCatalogInsightActionMarkdown(insight),
      "Ação copiada.",
      "Pacote de ação"
    );

  const groupedInsights = priorityGroups
    .map((priority) => ({
      priority,
      items: filteredInsights.filter((item) => item.priority === priority),
    }))
    .filter((group) => group.items.length);

  return (
    <>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 14,
          gap: 12,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            Centro de ação do Catálogo
          </Text>
          <Text style={{ color: colors.muted }}>
            Transforme cobertura e uso do catálogo em próximas ações pedagógicas.
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <ActionButton label="Copiar relatório Markdown" onPress={copyMarkdownReport} />
          <ActionButton label="Copiar JSON" onPress={copyJsonReport} />
        </View>

        {feedback ? (
          <Text style={{ color: colors.successText, fontWeight: "800" }}>{feedback}</Text>
        ) : null}

        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          Insights do Catálogo
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["all", "high", "medium", "low"] as PriorityFilter[]).map((value) => (
            <PriorityFilterButton
              key={value}
              value={value}
              selected={priorityFilter === value}
              onPress={() => setPriorityFilter(value)}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Text style={{ color: colors.muted, fontWeight: "700" }}>
            {report.highPriorityCount} alta
          </Text>
          <Text style={{ color: colors.muted, fontWeight: "700" }}>
            {report.mediumPriorityCount} média
          </Text>
          <Text style={{ color: colors.muted, fontWeight: "700" }}>
            {report.lowPriorityCount} baixa
          </Text>
        </View>

        {auditReport.usage.totalPlansScanned === 0 ? (
          <Text style={{ color: colors.muted }}>
            Sem planos para auditar. A cobertura do catálogo já pode ser analisada, mas os insights de uso dependem de atividades adicionadas a planos.
          </Text>
        ) : null}

        {groupedInsights.length ? (
          <View style={{ gap: 12 }}>
            {groupedInsights.map((group) => (
              <View key={group.priority} style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {priorityLabels[group.priority]} prioridade
                </Text>
                {group.items.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onOpenDetails={setSelectedInsight}
                    onCopyAction={copyInsightAction}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.muted }}>
            Nenhum insight crítico encontrado. A cobertura e o uso atual do catálogo não indicam lacunas relevantes neste momento.
          </Text>
        )}
      </View>

      <DetailModal
        auditReport={auditReport}
        insight={selectedInsight}
        onClose={() => setSelectedInsight(null)}
      />
      <FallbackCopyModal content={fallbackContent} onClose={() => setFallbackContent(null)} />
    </>
  );
}
