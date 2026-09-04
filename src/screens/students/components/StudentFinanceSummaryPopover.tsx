import type { RefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  formatFinanceDate,
  formatMoneyFromCents,
  invoiceStatusLabel,
} from "../../../finance/application/finance-format";
import { radius, spacing } from "../../../theme/tokens";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { overlayLayers } from "../../../ui/overlay-layers";
import { Pressable } from "../../../ui/Pressable";
import type {
  StudentFinanceSummary,
  StudentOperationalIndicator,
} from "../application/student-operational-indicators";

type Props = {
  visible: boolean;
  layout: { x: number; y: number; width: number; height: number } | null;
  triggerRef: RefObject<View | null>;
  summary: StudentFinanceSummary | null;
  indicator: StudentOperationalIndicator;
  colors: ThemeColors;
  onClose: () => void;
  onOpenFinance: () => void;
};

const styles = StyleSheet.create({
  content: { padding: spacing.sm, gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 15, fontWeight: "800" },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  totals: { flexDirection: "row", gap: spacing.sm },
  total: { flex: 1, minWidth: 0, gap: 4 },
  label: { fontSize: 12 },
  amount: { fontSize: 17, fontWeight: "800" },
  details: { borderTopWidth: 1, paddingTop: spacing.sm, gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  value: { fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  description: { fontSize: 13, fontWeight: "700" },
  empty: { fontSize: 13, paddingVertical: spacing.sm },
  open: { minHeight: 44, borderWidth: 1, borderRadius: radius.internal, alignItems: "center", justifyContent: "center" },
  openText: { fontSize: 13, fontWeight: "700" },
});

export function StudentFinanceSummaryPopover({
  visible, layout, triggerRef, summary, indicator, colors, onClose, onOpenFinance,
}: Props) {
  const latest = summary?.latestInvoice;
  const row = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );

  return (
    <AnchoredDropdown
      visible={visible}
      layout={layout}
      container={null}
      animationStyle={null}
      zIndex={overlayLayers.floatingList}
      maxHeight={440}
      nestedScrollEnabled
      density="popover"
      fitContent
      preferredWidth={340}
      portalToBodyOnWeb
      interactiveRefs={[triggerRef]}
      onRequestClose={onClose}
    >
      <View accessibilityLabel="Resumo financeiro do aluno" style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Financeiro</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar resumo financeiro" onPress={onClose} style={styles.close}>
            <GoAtletaIcon name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
        {!summary ? (
          <Text style={[styles.empty, { color: colors.muted }]}>{indicator.detail}</Text>
        ) : !latest ? (
          <Text style={[styles.empty, { color: colors.muted }]}>Nenhuma cobrança para este aluno.</Text>
        ) : (
          <>
            <View style={styles.totals}>
              <View style={styles.total}>
                <Text style={[styles.label, { color: colors.muted }]}>Saldo em aberto</Text>
                <Text style={[styles.amount, { color: colors.text }]}>{formatMoneyFromCents(summary.outstandingCents)}</Text>
              </View>
              <View style={styles.total}>
                <Text style={[styles.label, { color: colors.muted }]}>Vencido</Text>
                <Text style={[styles.amount, { color: summary.overdueCents > 0 ? colors.dangerText : colors.text }]}>{formatMoneyFromCents(summary.overdueCents)}</Text>
              </View>
            </View>
            {summary.nextDueDate ? row("Próximo vencimento", formatFinanceDate(summary.nextDueDate)) : null}
            <View style={[styles.details, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.muted }]}>Última cobrança</Text>
              <Text numberOfLines={2} style={[styles.description, { color: colors.text }]}>{latest.description || "Mensalidade"}</Text>
              {row("Valor", formatMoneyFromCents(latest.amountCents))}
              {row("Vencimento", formatFinanceDate(latest.dueDate))}
              {row("Situação", invoiceStatusLabel[latest.status])}
              {summary.lastPaidAt ? row("Última quitação", formatFinanceDate(summary.lastPaidAt)) : null}
            </View>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir financeiro completo do aluno"
          onPress={onOpenFinance}
          style={[styles.open, { borderColor: colors.border, backgroundColor: colors.secondaryBg }]}
        >
          <Text style={[styles.openText, { color: colors.text }]}>Abrir financeiro</Text>
        </Pressable>
      </View>
    </AnchoredDropdown>
  );
}
