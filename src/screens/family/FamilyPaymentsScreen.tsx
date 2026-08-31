import { useCallback, useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";

import {
  getMyFamilyFinance,
  type FamilyFinanceData,
  type FamilyInvoiceStatus,
} from "../../api/family-access";
import { useRole } from "../../auth/role";
import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { markRender, measureAsync } from "../../observability/perf";
import { spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { useAppTheme } from "../../ui/app-theme";
import { FamilyScreenShell } from "./FamilyScreenShell";
import { FamilyStudentSwitcher } from "./FamilyStudentSwitcher";
import { FamilyEmptyState, FamilySurface } from "./FamilyUi";

const formatMoney = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(amountMinor / 100);

const formatDate = (value: string | null) => {
  if (!value) return "Sem vencimento";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR");
};

const invoiceStatusLabel: Record<FamilyInvoiceStatus, string> = {
  open: "A vencer",
  overdue: "Vencida",
  paid: "Paga",
  cancelled: "Cancelada",
  waived: "Isenta",
  unknown: "Em análise",
};

export function FamilyPaymentsScreen() {
  markRender("screen.familyPayments.render.root");
  const { colors } = useAppTheme();
  const { selectedFamilyStudent } = useRole();
  const selectedStudentId = selectedFamilyStudent?.studentId ?? null;
  const selectedRelationshipId = selectedFamilyStudent?.relationshipId ?? null;
  const canViewFinance = selectedFamilyStudent?.canViewFinance ?? false;
  const [data, setData] = useState<FamilyFinanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStudentId || !canViewFinance || !selectedRelationshipId) {
      setData(null);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      setData(
        await measureAsync(
          "screen.familyPayments.load.invoices",
          () => getMyFamilyFinance(selectedRelationshipId),
          { relationshipId: selectedRelationshipId },
        ),
      );
    } catch {
      setData(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [canViewFinance, selectedRelationshipId, selectedStudentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const hasInvoices = Boolean(data?.invoices.length);
  const hasPaymentLink = Boolean(
    data?.invoices.some(
      (invoice) =>
        invoice.paymentUrl && ["open", "overdue"].includes(invoice.status),
    ),
  );

  return (
    <FamilyScreenShell
      title="Pagamentos"
      subtitle="Mensalidades vinculadas ao atleta."
      refreshing={loading}
      onRefresh={selectedFamilyStudent?.canViewFinance ? load : undefined}
    >
      <FamilyStudentSwitcher />
      {!selectedFamilyStudent ? (
        <FamilyEmptyState
          icon="payments"
          title="Sem atleta selecionado"
          description="Selecione um vínculo familiar para consultar pagamentos."
        />
      ) : !selectedFamilyStudent.canViewFinance ? (
        <FamilyEmptyState
          icon="lock"
          title="Financeiro restrito"
          description="Este vínculo não possui acesso às mensalidades."
        />
      ) : failed ? (
        <FamilyEmptyState
          icon="warningCircle"
          title="Financeiro indisponível"
          description="Não foi possível carregar as mensalidades agora."
          action={<Button label="Tentar novamente" variant="outline" onPress={() => void load()} />}
        />
      ) : loading && !data ? (
        <FamilyEmptyState
          icon="payments"
          title="Carregando mensalidades"
          description="Aguarde um instante."
        />
      ) : (
        <>
          <ResponsiveGrid columns={{ compact: "1", split: "6/6" }} gap={spacing.md}>
            <FamilySurface title="Em aberto">
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>
                {formatMoney(
                  data?.summary.openAmountMinor ?? 0,
                  data?.summary.currency ?? "BRL",
                )}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {data?.summary.openCount ?? 0} cobrança(s)
              </Text>
            </FamilySurface>
            <FamilySurface title="Vencido">
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>
                {formatMoney(
                  data?.summary.overdueAmountMinor ?? 0,
                  data?.summary.currency ?? "BRL",
                )}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {data?.summary.overdueCount ?? 0} cobrança(s)
              </Text>
            </FamilySurface>
          </ResponsiveGrid>
          {(data?.summary.openCount ?? 0) > 0 &&
          selectedFamilyStudent.canPay &&
          !hasPaymentLink ? (
            <FamilySurface title="Pagamento online">
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Ainda não disponível. Consulte a instituição para pagar esta cobrança.
              </Text>
            </FamilySurface>
          ) : null}
          {!hasInvoices ? (
            <FamilyEmptyState
              icon="receipt"
              title="Nenhuma mensalidade disponível"
              description="As cobranças publicadas pela instituição aparecerão aqui."
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Mensalidades
              </Text>
              {data?.invoices.map((invoice) => (
                <FamilySurface
                  key={invoice.id}
                  eyebrow={invoiceStatusLabel[invoice.status]}
                  title={invoice.title}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: spacing.sm,
                    }}
                  >
                    <View style={{ gap: 3 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
                        {formatMoney(
                          ["open", "overdue"].includes(invoice.status)
                            ? invoice.outstandingAmountMinor
                            : invoice.amountMinor,
                          invoice.currency,
                        )}
                      </Text>
                      {invoice.paidAmountMinor > 0 && invoice.outstandingAmountMinor > 0 ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          Total {formatMoney(invoice.amountMinor, invoice.currency)} · pago {formatMoney(invoice.paidAmountMinor, invoice.currency)}
                        </Text>
                      ) : null}
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Vencimento: {formatDate(invoice.dueDate)}
                      </Text>
                      {invoice.reference ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          Referência: {invoice.reference}
                        </Text>
                      ) : null}
                    </View>
                    {selectedFamilyStudent.canPay &&
                    invoice.paymentUrl &&
                    ["open", "overdue"].includes(invoice.status) ? (
                      <Button
                        label="Pagar"
                        onPress={() => {
                          void Linking.openURL(invoice.paymentUrl as string);
                        }}
                      />
                    ) : null}
                  </View>
                </FamilySurface>
              ))}
            </View>
          )}
        </>
      )}
    </FamilyScreenShell>
  );
}
