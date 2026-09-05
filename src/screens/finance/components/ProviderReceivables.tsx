import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { OrganizationProviderReceivable } from "../../../api/finance";
import { formatMoneyFromCents, formatFinanceDate } from "../../../finance/application/finance-format";
import { getProviderReceivableBillingLabel, getProviderReceivableDisplayDate, getProviderReceivableMatchLabel, getProviderReceivableStatusLabel, isProviderReceivableReceived, type ProviderReceivablesSummary } from "../../../finance/application/provider-receivables";
import { radius } from "../../../theme/tokens";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";

const createProviderStyles = (colors: ReturnType<typeof useAppTheme>["colors"]) => StyleSheet.create({
    providerCard: {
      borderRadius: radius.container,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    providerSummary: {
      minHeight: 72,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    providerSummaryCompact: {
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
    providerIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.secondaryBg,
    },
    providerSummaryBody: { flex: 1, minWidth: 160, gap: 2 },
    providerTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
    providerMeta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
    providerAmountColumn: { alignItems: "flex-end", gap: 2 },
    providerAmount: { color: colors.success, fontSize: 17, fontWeight: "900" },
    providerNetAmount: { color: colors.muted, fontSize: 11 },
    providerLink: { color: colors.success, fontSize: 12, fontWeight: "800" },
    providerListRow: {
      minHeight: 62,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    providerListRowFirst: { borderTopWidth: 0 },
    providerListRowCompact: { alignItems: "stretch", flexDirection: "column" },
    providerCustomerColumn: { flex: 1, minWidth: 0, gap: 2 },
    providerRowValue: { color: colors.text, fontSize: 12, fontWeight: "900" },
    providerStatus: {
      minHeight: 24,
      borderRadius: radius.full,
      paddingHorizontal: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    providerStatusSuccess: { backgroundColor: colors.successBg },
    providerStatusWarning: { backgroundColor: colors.warningBg },
    providerStatusLabel: { fontSize: 10, fontWeight: "800" },
    providerStatusLabelSuccess: { color: colors.successText },
    providerStatusLabelWarning: { color: colors.warningText },
    providerRowActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    listPrimaryText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    listSecondaryText: {
      color: colors.muted,
      fontSize: 11,
    },
});

export function ProviderReceivablesSummaryCard({
  summary,
  compact,
  onOpen,
}: {
  summary: ProviderReceivablesSummary | null;
  compact: boolean;
  onOpen: () => void;
}) {
  const { colors } = useAppTheme();
  const dashboardStyles = useMemo(() => createProviderStyles(colors), [colors]);
  if (!summary?.totalCount) return null;

  const receivedLabel = `${summary.receivedCount} ${
    summary.receivedCount === 1 ? "recebimento" : "recebimentos"
  }`;
  const reconciliationLabel = [
    summary.identifiedCustomerCount
      ? `${summary.identifiedCustomerCount} ${
          summary.identifiedCustomerCount === 1
            ? "cliente identificado"
            : "clientes identificados"
        }`
      : "",
    summary.reconciliationCount
      ? `${summary.reconciliationCount} a conciliar`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={dashboardStyles.providerCard}>
      <View
        style={[
          dashboardStyles.providerSummary,
          compact ? dashboardStyles.providerSummaryCompact : undefined,
        ]}
      >
        <View style={dashboardStyles.providerIcon}>
          <GoAtletaIcon name="receipt" size={19} color={colors.text} />
        </View>
        <View style={dashboardStyles.providerSummaryBody}>
          <Text style={dashboardStyles.providerTitle}>Asaas</Text>
          <Text style={dashboardStyles.providerMeta}>
            {receivedLabel}
            {reconciliationLabel ? ` · ${reconciliationLabel}` : ""}
          </Text>
        </View>
        <View style={dashboardStyles.providerAmountColumn}>
          <Text style={dashboardStyles.providerAmount}>
            {formatMoneyFromCents(summary.receivedGrossCents)}
          </Text>
          <Text style={dashboardStyles.providerNetAmount}>
            {formatMoneyFromCents(summary.receivedNetCents)} líquido
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Ver recebimentos do Asaas"
          onPress={onOpen}
        >
          <Text style={dashboardStyles.providerLink}>Ver importados</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ProviderReceivablesList({
  receivables,
  compact,
}: {
  receivables: OrganizationProviderReceivable[];
  compact: boolean;
}) {
  const { colors } = useAppTheme();
  const dashboardStyles = useMemo(() => createProviderStyles(colors), [colors]);

  if (!receivables.length) return null;

  return (
    <View>
      {receivables.map((receivable, index) => {
        const settled = isProviderReceivableReceived(receivable);
        const displayDate = getProviderReceivableDisplayDate(receivable);
        return (
          <View
            key={receivable.id}
            style={[
              dashboardStyles.providerListRow,
              index === 0 ? dashboardStyles.providerListRowFirst : undefined,
              compact ? dashboardStyles.providerListRowCompact : undefined,
            ]}
          >
            <View style={dashboardStyles.providerCustomerColumn}>
              <Text numberOfLines={1} style={dashboardStyles.listPrimaryText}>
                {receivable.customerName}
              </Text>
              <Text numberOfLines={1} style={dashboardStyles.listSecondaryText}>
                {getProviderReceivableBillingLabel(receivable.billingType)}
                {displayDate ? ` · ${formatFinanceDate(displayDate)}` : ""}
                {` · ${getProviderReceivableMatchLabel(receivable.matchStatus)}`}
              </Text>
            </View>
            <View style={dashboardStyles.providerRowActions}>
              <Text style={dashboardStyles.providerRowValue}>
                {formatMoneyFromCents(receivable.amountCents)}
              </Text>
              <View
                style={[
                  dashboardStyles.providerStatus,
                  settled
                    ? dashboardStyles.providerStatusSuccess
                    : dashboardStyles.providerStatusWarning,
                ]}
              >
                <Text
                  style={[
                    dashboardStyles.providerStatusLabel,
                    settled
                      ? dashboardStyles.providerStatusLabelSuccess
                      : dashboardStyles.providerStatusLabelWarning,
                  ]}
                >
                  {getProviderReceivableStatusLabel(receivable.providerStatus)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
