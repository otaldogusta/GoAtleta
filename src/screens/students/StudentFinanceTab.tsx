import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { listOrganizationInvoices, type OrganizationInvoice } from "../../api/finance";
import { formatFinanceDate, formatMoneyFromCents, getInvoiceOutstandingCents } from "../../finance/application/finance-format";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { deriveStudentFinanceProfile, financeToneForInvoice, invoiceStatusForProfile, selectStudentInvoices, type FinanceTone } from "./application/student-finance-profile";

type Props = {
  organizationId: string;
  studentId: string;
  onOpenFinance?: () => void;
};

const monthLabel = (value: string) => {
  const parsed = new Date(`${value.slice(0, 7)}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Cobrança";
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(parsed);
  return month.charAt(0).toUpperCase() + month.slice(1);
};

export function StudentFinanceTab({ organizationId, studentId, onOpenFinance }: Props) {
  const { colors } = useAppTheme();
  const [invoices, setInvoices] = useState<OrganizationInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [requestedYear, setRequestedYear] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void listOrganizationInvoices(organizationId).then(result => {
      if (!current) return;
      setInvoices(selectStudentInvoices(result, studentId));
      setLoading(false);
    }).catch(() => {
      if (!current) return;
      setInvoices([]);
      setError(true);
      setLoading(false);
    });
    return () => { current = false; };
  }, [organizationId, studentId, retry]);

  const availableYears = useMemo(() => [...new Set(invoices.map(invoice => Number(invoice.competenceMonth.slice(0, 4))))]
    .filter(Number.isFinite).sort((a, b) => b - a), [invoices]);
  const year = requestedYear && availableYears.includes(requestedYear)
    ? requestedYear
    : availableYears[0] ?? new Date().getFullYear();
  const finance = useMemo(() => deriveStudentFinanceProfile(invoices, year), [invoices, year]);
  const yearIndex = availableYears.indexOf(year);
  const highlighted = finance.highlight;
  const tone = highlighted ? financeToneForInvoice(highlighted) : "neutral";
  const toneColors = (value: FinanceTone) => {
    if (value === "danger") return { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.dangerText };
    if (value === "success") return { bg: colors.successBg, border: colors.successBorder, text: colors.successText };
    if (value === "warning") return { bg: colors.warningBg, border: colors.warningBorder, text: colors.warningText };
    return { bg: colors.secondaryBg, border: colors.border, text: colors.muted };
  };
  const accent = toneColors(tone);
  const amount = highlighted
    ? tone === "warning" || tone === "danger"
      ? getInvoiceOutstandingCents(highlighted.amountCents, highlighted.paidCents)
      : highlighted.amountCents
    : 0;
  const highlightTitle = tone === "danger" ? "Cobrança vencida" : tone === "success" ? "Última cobrança" : "Próxima cobrança";

  return <View testID="student-finance-tab" style={{ width: "100%", maxWidth: 780, gap: 18 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Financeiro</Text>
      {availableYears.length > 1 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ano mais recente" disabled={yearIndex <= 0} onPress={() => setRequestedYear(availableYears[yearIndex - 1])} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: yearIndex <= 0 ? 0.4 : 1 }}><GoAtletaIcon name="chevronBack" size={16} color={colors.muted} /></Pressable>
        <Text style={{ color: colors.text, minWidth: 42, textAlign: "center", fontSize: 13, fontWeight: "600" }}>{year}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ano anterior" disabled={yearIndex >= availableYears.length - 1} onPress={() => setRequestedYear(availableYears[yearIndex + 1])} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: yearIndex >= availableYears.length - 1 ? 0.4 : 1 }}><GoAtletaIcon name="chevronForward" size={16} color={colors.muted} /></Pressable>
      </View> : availableYears.length ? <Text style={{ color: colors.muted, fontSize: 13 }}>{year}</Text> : null}
    </View>
    {loading ? <Text style={{ color: colors.muted, fontSize: 13 }}>Carregando financeiro...</Text> :
      error ? <View style={{ gap: 12 }}><Text style={{ color: colors.muted, fontSize: 13 }}>Não foi possível carregar o financeiro.</Text><Pressable accessibilityRole="button" accessibilityLabel="Tentar carregar financeiro novamente" onPress={() => { setLoading(true); setError(false); setRetry(value => value + 1); }} style={{ minHeight: 40, alignSelf: "flex-start", justifyContent: "center" }}><Text style={{ color: colors.text, fontWeight: "600" }}>Tentar novamente</Text></Pressable></View> :
      !highlighted ? <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, padding: 18, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center" }}><GoAtletaIcon name="payments" size={18} color={colors.muted} /></View>
        <Text style={{ color: colors.muted, fontSize: 13, flexGrow: 1, flexShrink: 1, minWidth: 170 }}>Nenhuma cobrança registrada.</Text>
        {onOpenFinance ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir financeiro do atleta" onPress={onOpenFinance} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, justifyContent: "center" }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Abrir financeiro</Text></Pressable> : null}
      </View> :
      <>
        <View style={{ padding: 22, borderRadius: 16, borderWidth: 1, borderColor: accent.border, backgroundColor: accent.bg, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: accent.text, fontSize: 12, fontWeight: "600" }}>{highlightTitle}</Text>
            <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.card }}><Text style={{ color: accent.text, fontSize: 12, fontWeight: "700" }}>{invoiceStatusForProfile(highlighted)}</Text></View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700" }}>{formatMoneyFromCents(amount)}</Text>
            {onOpenFinance ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir financeiro do atleta" onPress={onOpenFinance} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: accent.border, backgroundColor: colors.card, justifyContent: "center" }}><Text style={{ color: accent.text, fontSize: 13, fontWeight: "700" }}>Abrir financeiro ↗</Text></Pressable> : null}
          </View>
          <Text style={{ color: accent.text, fontSize: 13 }}>{monthLabel(highlighted.competenceMonth)} · {tone === "success" && highlighted.paidAt ? `pago em ${formatFinanceDate(highlighted.paidAt)}` : `vence ${formatFinanceDate(highlighted.dueDate)}`}</Text>
          <View style={{ borderTopWidth: 1, borderTopColor: accent.border, paddingTop: 12, marginTop: 4, flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
            <Text style={{ color: accent.text, fontSize: 12 }}>Pago em {year} <Text style={{ fontWeight: "700" }}>{formatMoneyFromCents(finance.paidCents)}</Text></Text>
            <Text style={{ color: accent.text, fontSize: 12 }}>{finance.overdueCount ? `${finance.overdueCount} em atraso` : "Sem atrasos"}</Text>
          </View>
        </View>
        {finance.history.length ? <View style={{ gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 8, marginBottom: 6 }}>Histórico</Text>
          {finance.history.map(invoice => {
            const rowTone = financeToneForInvoice(invoice);
            const rowAccent = toneColors(rowTone);
            const expanded = expandedId === invoice.id;
            return <View key={invoice.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Detalhes da cobrança de ${monthLabel(invoice.competenceMonth)}`} accessibilityState={{ expanded }} onPress={() => setExpandedId(expanded ? null : invoice.id)} style={{ minHeight: 64, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: rowAccent.bg, alignItems: "center", justifyContent: "center" }}><GoAtletaIcon name={rowTone === "success" ? "checkmark" : "payments"} size={16} color={rowAccent.text} /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{monthLabel(invoice.competenceMonth)}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{invoiceStatusForProfile(invoice)} · {invoice.paidAt ? formatFinanceDate(invoice.paidAt) : formatFinanceDate(invoice.dueDate)}</Text></View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{formatMoneyFromCents(invoice.amountCents)}</Text>
                <GoAtletaIcon name={expanded ? "chevronUp" : "chevronRight"} size={16} color={colors.muted} />
              </Pressable>
              {expanded ? <View style={{ paddingBottom: 14, paddingLeft: 46, gap: 4 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{invoice.description}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Vencimento: {formatFinanceDate(invoice.dueDate)}</Text></View> : null}
            </View>;
          })}
        </View> : null}
      </>}
  </View>;
}
