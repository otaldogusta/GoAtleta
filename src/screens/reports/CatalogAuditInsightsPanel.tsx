import { useState } from "react";
import { Text, View } from "react-native";

import type {
  ActivityCatalogInsight,
  ActivityCatalogInsightPriority,
  ActivityCatalogInsightReport,
} from "../../core/volleyball/activity-catalog-insights";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type CatalogAuditInsightsPanelProps = {
  report: ActivityCatalogInsightReport;
};

type PriorityFilter = "all" | ActivityCatalogInsightPriority;

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

function InsightCard({ insight }: { insight: ActivityCatalogInsight }) {
  const { colors } = useAppTheme();
  const badge = priorityBadgeStyles[insight.priority];
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

      <Text style={{ color: colors.muted, lineHeight: 20 }}>{insight.message}</Text>

      {insight.evidence.length ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>Evidências</Text>
          {insight.evidence.map((item) => (
            <Text key={item} style={{ color: colors.muted }}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}

      {insight.suggestedActions.length ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>Ações sugeridas</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {insight.suggestedActions.map((action) => (
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
    </View>
  );
}

export function CatalogAuditInsightsPanel({ report }: CatalogAuditInsightsPanelProps) {
  const { colors } = useAppTheme();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const filteredInsights =
    priorityFilter === "all"
      ? report.insights
      : report.insights.filter((item) => item.priority === priorityFilter);

  return (
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
          Insights do Catálogo
        </Text>
        <Text style={{ color: colors.muted }}>
          Sinais derivados da cobertura e do uso real do catálogo para orientar próximas melhorias.
        </Text>
      </View>

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

      {filteredInsights.length ? (
        <View style={{ gap: 10 }}>
          {filteredInsights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.muted }}>
          Nenhum insight crítico encontrado.
        </Text>
      )}
    </View>
  );
}
