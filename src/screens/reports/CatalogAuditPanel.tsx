import { Text, View } from "react-native";
import type { ReactNode } from "react";

import type {
  ActivityCatalogAuditReport,
  ActivityCatalogCoverageBucket,
  ActivityCatalogUsageRankItem,
} from "../../core/volleyball/activity-catalog-audit";
import { buildActivityCatalogInsights } from "../../core/volleyball/activity-catalog-insights";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { CatalogAuditInsightsPanel } from "./CatalogAuditInsightsPanel";

type CatalogAuditPanelProps = {
  report: ActivityCatalogAuditReport | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

const skillLabels: Record<string, string> = {
  passe: "Passe",
  levantamento: "Levantamento",
  ataque: "Ataque",
  bloqueio: "Bloqueio",
  defesa: "Defesa",
  saque: "Saque",
  transicao: "Transição",
};

const formatDateTime = (value: string | undefined) => {
  if (!value) return "sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const sortBuckets = (entries: Array<[string, ActivityCatalogCoverageBucket]>) =>
  [...entries].sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]));

const sortRank = (items: ActivityCatalogUsageRankItem[]) =>
  [...items].sort((left, right) => right.count - left.count || left.title.localeCompare(right.title));

function MetricCard({ label, value }: { label: string; value: string | number }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: 130,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        padding: 12,
        gap: 4,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 14,
        gap: 10,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{title}</Text>
      {children}
    </View>
  );
}

export function CatalogAuditPanel({ report, loading, error, onRefresh }: CatalogAuditPanelProps) {
  const { colors } = useAppTheme();

  if (loading) {
    return (
      <Section title="Auditoria do Catálogo">
        <Text style={{ color: colors.muted }}>Carregando planos e cobertura do catálogo...</Text>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Auditoria do Catálogo">
        <Text style={{ color: colors.dangerSolidBg, fontWeight: "800" }}>Falha ao carregar auditoria</Text>
        <Text style={{ color: colors.muted }}>{error}</Text>
        <Pressable
          onPress={onRefresh}
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>Tentar novamente</Text>
        </Pressable>
      </Section>
    );
  }

  if (!report) {
    return (
      <Section title="Auditoria do Catálogo">
        <Text style={{ color: colors.muted }}>Nenhum relatório de auditoria disponível.</Text>
      </Section>
    );
  }

  const coverage = report.coverage;
  const usage = report.usage;
  const skillEntries = sortBuckets(Object.entries(coverage.bySkill));
  const mostUsed = sortRank(usage.mostUsedVariants).slice(0, 5);
  const unused = usage.unusedVariants.slice(0, 6);
  const unknown = usage.unknownCatalogReferences.slice(0, 6);
  const insightReport = buildActivityCatalogInsights(report);

  return (
    <View style={{ gap: 12 }}>
      <Section title="Auditoria do Catálogo">
        <Text style={{ color: colors.muted }}>
          Cobertura pedagógica e uso real derivados dos planos carregados. Não mede qualidade da aula nem eventos de clique.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <MetricCard label="Famílias" value={coverage.totalFamilies} />
          <MetricCard label="Variantes" value={coverage.totalVariants} />
          <MetricCard label="Usos em planos" value={usage.totalCatalogActivitiesUsed} />
          <MetricCard label="Planos lidos" value={usage.totalPlansScanned} />
        </View>
      </Section>

      <CatalogAuditInsightsPanel report={insightReport} />

      <Section title="Cobertura por fundamento">
        <View style={{ gap: 8 }}>
          {skillEntries.map(([skill, bucket]) => (
            <View
              key={skill}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                borderRadius: 12,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", flex: 1 }}>
                {skillLabels[skill] ?? skill}
              </Text>
              <Text style={{ color: colors.muted, fontWeight: "700" }}>
                {bucket.total} variantes
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Variantes mais usadas">
        {mostUsed.length ? (
          <View style={{ gap: 8 }}>
            {mostUsed.map((item) => (
              <View key={item.variantId} style={{ gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>{item.title}</Text>
                <Text style={{ color: colors.muted }}>
                  {item.count} uso(s) · último uso: {formatDateTime(item.lastUsedAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.muted }}>Nenhuma atividade do catálogo usada nos planos carregados.</Text>
        )}
      </Section>

      <Section title="Variantes nunca usadas">
        {unused.length ? (
          <View style={{ gap: 6 }}>
            {unused.map((item) => (
              <Text key={item.variantId} style={{ color: colors.muted }}>
                {item.title} · {skillLabels[item.primarySkill] ?? item.primarySkill}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.muted }}>Todas as variantes aparecem nos planos carregados.</Text>
        )}
      </Section>

      <Section title="Referências desconhecidas">
        {unknown.length ? (
          <View style={{ gap: 6 }}>
            {unknown.map((item, index) => (
              <Text key={`${item.reason}-${item.variantId ?? item.familyId ?? index}`} style={{ color: colors.muted }}>
                {item.reason} · {item.activityName || item.variantId || item.familyId || "atividade sem nome"}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.muted }}>Nenhuma referência desconhecida encontrada.</Text>
        )}
      </Section>
    </View>
  );
}
