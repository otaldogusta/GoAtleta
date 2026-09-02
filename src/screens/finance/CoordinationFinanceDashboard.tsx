import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getOrganizationFinanceDashboard,
  listOrganizationInvoices,
  listTuitionAgreements,
  type OrganizationFinanceSummary,
  type OrganizationInvoice,
  type TuitionAgreement,
} from "../../api/finance";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { SectionLoadingState } from "../../components/ui/SectionLoadingState";
import {
  captureOrganizationAsyncIdentity,
  isOrganizationAsyncIdentityCurrent,
  type OrganizationAsyncIdentity,
} from "../../core/organization-async-identity";
import {
  canRecordManualPaymentForInvoice,
  formatFinanceDate,
  formatMoneyFromCents,
  getInvoiceOutstandingCents,
  type InvoiceStatus,
} from "../../finance/application/finance-format";
import { resolveFinanceScrollBottomPadding } from "../../finance/application/finance-responsive-layout";
import { summarizeFinanceInvoices } from "../../finance/application/finance-summary";
import { useOrganizationAsyncIdentity } from "../../hooks/use-organization-async-identity";
import { markRender, measureAsync } from "../../observability/perf";
import { navigateBackOrReplace } from "../../navigation/safe-router";
import { useOrganization } from "../../providers/OrganizationProvider";
import { radius, spacing } from "../../theme/tokens";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { AppRefreshControl } from "../../ui/AppRefreshControl";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useContainerResponsiveLayout } from "../../ui/use-container-responsive-layout";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import CoordinationFinanceSettings from "./CoordinationFinanceSettings";
import { ManualPaymentModal } from "./CoordinationReceivables";
import CoordinationTuitionSetup from "./CoordinationTuitionSetup";
import { NewChargeModal } from "./components/NewChargeModal";
import { PaymentStatusBadge } from "./components/PaymentStatusBadge";

type FilterValue =
  "all" | "attention" | Extract<InvoiceStatus, "open" | "overdue" | "paid">;
type FinanceSection = "overview" | "charges" | "plans" | "payers";
type FinanceWorkspaceModal = "settings" | null;
type AnchorLayout = { x: number; y: number; width: number; height: number };
type FinanceInvoice = OrganizationInvoice & {
  className?: string;
  payerName?: string;
  payerContact?: string;
};

const EMPTY_SUMMARY: OrganizationFinanceSummary = {
  organizationId: "",
  expectedCents: 0,
  receivedCents: 0,
  overdueCents: 0,
  openCents: 0,
  overdueCount: 0,
  openCount: 0,
  paidCount: 0,
  activeAgreementsCount: 0,
};

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const DESIGN_PREVIEW_MONTH = currentMonthKey();
const designPreviewDueDate = (day: number) =>
  `${DESIGN_PREVIEW_MONTH}-${String(day).padStart(2, "0")}`;

const DESIGN_PREVIEW_ROWS = [
  [
    "Lucas Oliveira",
    "Sub-15 A",
    "Carlos Oliveira",
    designPreviewDueDate(10),
    "paid",
  ],
  [
    "Mateus Souza",
    "Sub-13 B",
    "Juliana Souza",
    designPreviewDueDate(10),
    "paid",
  ],
  [
    "Gabriel Lima",
    "Sub-15 A",
    "Fernanda Lima",
    designPreviewDueDate(10),
    "paid",
  ],
  [
    "Enzo Martins",
    "Sub-13 A",
    "Rafael Martins",
    designPreviewDueDate(15),
    "open",
  ],
  [
    "Miguel Pereira",
    "Sub-11 A",
    "Patrícia Pereira",
    designPreviewDueDate(15),
    "open",
  ],
  [
    "Davi Santos",
    "Sub-15 B",
    "Marcos Santos",
    designPreviewDueDate(20),
    "overdue",
  ],
  [
    "Arthur Rocha",
    "Sub-13 A",
    "Camila Rocha",
    designPreviewDueDate(20),
    "overdue",
  ],
  ["Heitor Alves", "Sub-11 B", "Bruno Alves", designPreviewDueDate(25), "open"],
  [
    "Pedro Henrique",
    "Sub-11 A",
    "Ana Paula Henrique",
    designPreviewDueDate(25),
    "open",
  ],
  [
    "Bernardo Costa",
    "Sub-13 B",
    "Thiago Costa",
    designPreviewDueDate(28),
    "open",
  ],
  ["João Vitor", "Sub-11 A", "Vanessa Vitor", designPreviewDueDate(28), "open"],
  [
    "Samuel Bordim",
    "Sub-15 B",
    "Eduardo Bordim",
    designPreviewDueDate(28),
    "open",
  ],
  ...Array.from({ length: 20 }, (_, index) => [
    `Atleta ${index + 13}`,
    `Turma ${String.fromCharCode(65 + (index % 4))}`,
    `Responsável ${index + 13}`,
    designPreviewDueDate(28),
    "paid",
  ]),
] as const;

const DESIGN_PREVIEW_INVOICES: FinanceInvoice[] = DESIGN_PREVIEW_ROWS.map(
  ([studentName, className, payerName, dueDate, status], index) => ({
    id: `preview-invoice-${index + 1}`,
    studentId: `preview-student-${index + 1}`,
    studentName,
    competenceMonth: `${DESIGN_PREVIEW_MONTH}-01`,
    dueDate,
    amountCents: 16000,
    paidCents: status === "paid" ? 16000 : 0,
    status: status as InvoiceStatus,
    description: `Mensalidade ${className}`,
    className,
    payerName,
    payerContact:
      studentName === "Enzo Martins"
        ? "(41) 99876-5432 · rafael.martins@email.com"
        : undefined,
    createdAt: `${DESIGN_PREVIEW_MONTH}-01T12:00:00.000Z`,
    paidAt: status === "paid" ? `${dueDate}T12:00:00.000Z` : null,
  }),
);

const DESIGN_PREVIEW_AGREEMENTS: TuitionAgreement[] =
  DESIGN_PREVIEW_INVOICES.slice(0, 10).map((invoice, index) => ({
    id: `preview-agreement-${index + 1}`,
    studentId: invoice.studentId,
    studentName: invoice.studentName,
    planId: `preview-plan-${(index % 3) + 1}`,
    planName: ["Voleibol 2x/semana", "Voleibol 3x/semana", "Treinamento"][
      index % 3
    ],
    payerUserId: `preview-payer-${index + 1}`,
    status: "active",
    startsOn: "2026-01-01",
    endsOn: null,
    amountCents: invoice.amountCents,
    dueDay: Number(invoice.dueDate.slice(-2)),
  }));

const invoiceMonthKey = (invoice: OrganizationInvoice) =>
  invoice.competenceMonth.slice(0, 7);

export const formatFinanceMonthLabel = (monthKey: string) => {
  const parsed = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Mês atual";
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(parsed);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const formatFinanceCompactMonthLabel = (monthKey: string) => {
  const parsed = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Mês atual";
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(parsed)
    .replace(/\.$/, "");
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}. ${parsed.getFullYear()}`;
};

const DESIGN_PREVIEW_SUMMARY = summarizeFinanceInvoices(
  DESIGN_PREVIEW_INVOICES,
  "preview-organization",
  DESIGN_PREVIEW_AGREEMENTS.length,
);

const invoiceMatchesFilter = (
  invoice: OrganizationInvoice,
  filter: FilterValue,
) => {
  if (filter === "all") return true;
  if (filter === "attention") {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return (
      invoice.status === "overdue" ||
      invoice.status === "disputed" ||
      invoice.status === "awaiting_payment" ||
      (["open", "partially_paid"].includes(invoice.status) &&
        invoice.dueDate <= todayKey)
    );
  }
  if (filter === "overdue") return invoice.status === "overdue";
  if (filter === "paid") return invoice.status === "paid";
  return ["open", "awaiting_payment", "partially_paid"].includes(
    invoice.status,
  );
};

const getOverdueDays = (invoice: OrganizationInvoice) => {
  if (invoice.status !== "overdue") return 0;
  const due = new Date(`${invoice.dueDate}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(
    1,
    Math.floor((today.getTime() - due.getTime()) / 86_400_000),
  );
};

const getOperationalStatusLabel = (invoice: OrganizationInvoice) => {
  const overdueDays = getOverdueDays(invoice);
  if (overdueDays > 0) {
    return `${overdueDays} ${overdueDays === 1 ? "dia" : "dias"} atrasado`;
  }
  if (invoice.status === "awaiting_payment") return "Pagamento pendente";
  if (invoice.status === "partially_paid") return "Pagamento parcial";
  return undefined;
};

const isMissingFinanceFoundation = (error: unknown) => {
  const value = error instanceof Error ? error.message : String(error ?? "");
  return /get_organization_finance_dashboard_v1|PGRST202|could not find the function|404/i.test(
    value,
  );
};

type FinanceDashboardColors = ReturnType<typeof useAppTheme>["colors"];

const createFinanceDashboardStyles = (colors: FinanceDashboardColors) =>
  StyleSheet.create({
    summaryMetricCell: {
      minHeight: 76,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: "center",
      gap: 4,
      borderColor: colors.border,
    },
    summaryMetricCellCompact: {
      width: "33.333333%",
      paddingHorizontal: 10,
    },
    summaryMetricCellWide: { width: "25%" },
    summaryMetricCellLeftDivider: { borderLeftWidth: 1 },
    summaryMetricLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
    },
    summaryMetricValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    summaryMetricValueSuccess: { color: colors.success },
    summaryMetricValueWarning: { color: colors.warning },
    summaryMetricValueDanger: { color: colors.danger },
    sectionTabs: {
      flexDirection: "row",
      gap: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTabsCompact: { flexWrap: "wrap" },
    sectionTabsWide: { flexWrap: "nowrap" },
    sectionTab: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderBottomWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTabSelected: { borderBottomColor: colors.success },
    sectionTabIdle: { borderBottomColor: "transparent" },
    sectionTabLabel: { fontSize: 12 },
    sectionTabLabelSelected: {
      color: colors.text,
      fontWeight: "900",
    },
    sectionTabLabelIdle: {
      color: colors.muted,
      fontWeight: "700",
    },
    attentionRow: {
      minHeight: 58,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    attentionPrimaryColumn: {
      flex: 1,
      minWidth: 0,
      gap: 2,
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
    attentionValueColumn: {
      alignItems: "flex-end",
      gap: 3,
    },
    attentionValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
    },
    attentionStatus: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: "800",
    },
    receiptBreakdownRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    receiptBreakdownLabel: {
      color: colors.muted,
      fontSize: 12,
    },
    receiptBreakdownValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    flexSpacer: { flex: 1 },
    payerRow: {
      minHeight: 62,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    payerRowFirst: { borderTopWidth: 0 },
    payerRowDivided: { borderTopWidth: 1 },
    payerRowCompact: {
      flexDirection: "column",
      alignItems: "stretch",
      gap: 6,
    },
    payerRowWide: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    payerPrimaryColumn: {
      flex: 1.1,
      minWidth: 0,
      gap: 2,
    },
    payerStudentColumn: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    payerStudentName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    payerAmount: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
    },
    detailRow: { gap: 3 },
    detailLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
    },
    detailValue: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
    detailSupportingText: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
    },
    detailDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    detailHistorySection: {
      gap: 8,
    },
    detailHistoryTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    detailHistoryEntry: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    detailHistoryEntryBody: {
      flex: 1,
    },
    detailHistoryEntryTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    detailHistoryEntryMeta: {
      color: colors.muted,
      fontSize: 11,
    },
    filterButton: {
      minHeight: 32,
      borderRadius: radius.card,
      borderWidth: 1,
      paddingHorizontal: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    filterButtonSelected: {
      borderColor: colors.primaryBg,
      backgroundColor: colors.primaryBg,
    },
    filterButtonIdle: {
      borderColor: colors.border,
      backgroundColor: colors.secondaryBg,
    },
    filterLabel: {
      fontSize: 11,
      fontWeight: "800",
    },
    filterLabelSelected: { color: colors.primaryText },
    filterLabelIdle: { color: colors.text },
    pageButton: {
      width: 32,
      height: 32,
      borderRadius: radius.card,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    pageButtonSelected: {
      borderColor: colors.primaryBg,
      backgroundColor: colors.successBg,
    },
    pageButtonIdle: {
      borderColor: "transparent",
      backgroundColor: "transparent",
    },
    pageLabel: {
      fontSize: 11,
      fontWeight: "800",
    },
    pageLabelSelected: { color: colors.successText },
    pageLabelIdle: { color: colors.text },
    monthOptionLabel: {
      fontSize: 12,
      fontWeight: "800",
    },
    monthOptionLabelSelected: { color: colors.primaryText },
    monthOptionLabelIdle: { color: colors.text },
  });

const useFinanceDashboardStyles = (colors: FinanceDashboardColors) =>
  useMemo(() => createFinanceDashboardStyles(colors), [colors]);

function FinanceAction({
  label,
  icon,
  primary = false,
  compact = false,
  onPress,
}: {
  label: string;
  icon: "add" | "paymentCard" | "payments" | "options" | "management";
  primary?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 40,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: primary ? colors.primaryBg : colors.border,
        backgroundColor: primary ? colors.primaryBg : colors.card,
        paddingHorizontal: compact ? 11 : 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
      }}
    >
      <GoAtletaIcon
        name={icon}
        size={17}
        color={primary ? colors.primaryText : colors.text}
      />
      {compact ? null : (
        <Text
          numberOfLines={1}
          style={{
            color: primary ? colors.primaryText : colors.text,
            fontSize: 12,
            fontWeight: "800",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function FinanceSummaryStrip({
  summary,
  compact,
}: {
  summary: OrganizationFinanceSummary;
  compact: boolean;
}) {
  const { colors } = useAppTheme();
  const dashboardStyles = useFinanceDashboardStyles(colors);
  const receivedRate = summary.expectedCents
    ? Math.min(
        100,
        Math.round((summary.receivedCents / summary.expectedCents) * 100),
      )
    : 0;
  const items = [
    {
      label: "Recebido",
      value: formatMoneyFromCents(summary.receivedCents),
      valueStyle: dashboardStyles.summaryMetricValueSuccess,
    },
    {
      label: "Em aberto",
      value: formatMoneyFromCents(summary.openCents),
      valueStyle: dashboardStyles.summaryMetricValueWarning,
    },
    {
      label: "Vencido",
      value: formatMoneyFromCents(summary.overdueCents),
      valueStyle: dashboardStyles.summaryMetricValueDanger,
    },
  ];
  const columns = compact ? 3 : 4;

  return (
    <View
      style={{
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        overflow: "hidden",
        flexDirection: "row",
        flexWrap: "wrap",
      }}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[
            dashboardStyles.summaryMetricCell,
            compact
              ? dashboardStyles.summaryMetricCellCompact
              : dashboardStyles.summaryMetricCellWide,
            index % columns === 0
              ? undefined
              : dashboardStyles.summaryMetricCellLeftDivider,
          ]}
        >
          <Text style={dashboardStyles.summaryMetricLabel}>{item.label}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[dashboardStyles.summaryMetricValue, item.valueStyle]}
          >
            {item.value}
          </Text>
        </View>
      ))}
      <View
        style={{
          width: compact ? "100%" : "25%",
          minHeight: compact ? 64 : 76,
          paddingHorizontal: 16,
          paddingVertical: 12,
          justifyContent: "center",
          gap: 8,
          borderLeftWidth: compact ? 0 : 1,
          borderTopWidth: compact ? 1 : 0,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}
          >
            Taxa recebida
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>
            {receivedRate}%
          </Text>
        </View>
        <View
          style={{
            height: 7,
            borderRadius: radius.full,
            backgroundColor: colors.secondaryBg,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${receivedRate}%`,
              height: "100%",
              borderRadius: radius.full,
              backgroundColor: colors.success,
            }}
          />
        </View>
      </View>
    </View>
  );
}

function FinanceSectionTabs({
  active,
  compact,
  onChange,
}: {
  active: FinanceSection;
  compact: boolean;
  onChange: (section: FinanceSection) => void;
}) {
  const { colors } = useAppTheme();
  const dashboardStyles = useFinanceDashboardStyles(colors);
  const sections: readonly [FinanceSection, string][] = [
    ["overview", "Visão geral"],
    ["charges", "Cobranças"],
    ["plans", "Planos"],
    ["payers", "Pagadores"],
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={[
        dashboardStyles.sectionTabs,
        compact
          ? dashboardStyles.sectionTabsCompact
          : dashboardStyles.sectionTabsWide,
      ]}
    >
      {sections.map(([value, label]) => {
        const selected = value === active;
        return (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(value)}
            style={[
              dashboardStyles.sectionTab,
              selected
                ? dashboardStyles.sectionTabSelected
                : dashboardStyles.sectionTabIdle,
            ]}
          >
            <Text
              style={[
                dashboardStyles.sectionTabLabel,
                selected
                  ? dashboardStyles.sectionTabLabelSelected
                  : dashboardStyles.sectionTabLabelIdle,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FinanceOverviewPanel({
  summary,
  invoices,
  compact,
  onOpenCharges,
  onNewCharge,
}: {
  summary: OrganizationFinanceSummary;
  invoices: FinanceInvoice[];
  compact: boolean;
  onOpenCharges: () => void;
  onNewCharge: () => void;
}) {
  const { colors } = useAppTheme();
  const dashboardStyles = useFinanceDashboardStyles(colors);
  const attentionInvoices = invoices
    .filter((invoice) => invoiceMatchesFilter(invoice, "attention"))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, 5);
  const receivedRate = summary.expectedCents
    ? Math.min(
        100,
        Math.round((summary.receivedCents / summary.expectedCents) * 100),
      )
    : 0;

  return (
    <View style={{ gap: 16 }}>
      <FinanceSummaryStrip summary={summary} compact={compact} />
      <View
        style={{
          flexDirection: compact ? "column" : "row",
          alignItems: "stretch",
          gap: 16,
        }}
      >
        <View
          style={{
            flex: compact ? undefined : 1.35,
            minWidth: 0,
            borderRadius: radius.container,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              minHeight: 58,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}
              >
                Precisam de atenção
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {attentionInvoices.length
                  ? `${attentionInvoices.length} cobrança(s) para resolver agora`
                  : "Nenhuma pendência no mês"}
              </Text>
            </View>
            <Pressable onPress={onOpenCharges}>
              <Text
                style={{
                  color: colors.success,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                Ver cobranças
              </Text>
            </Pressable>
          </View>
          {attentionInvoices.length ? (
            attentionInvoices.map((invoice, index) => (
              <Pressable
                key={invoice.id}
                onPress={onOpenCharges}
                style={dashboardStyles.attentionRow}
              >
                <View style={dashboardStyles.attentionPrimaryColumn}>
                  <Text
                    numberOfLines={1}
                    style={dashboardStyles.listPrimaryText}
                  >
                    {invoice.studentName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={dashboardStyles.listSecondaryText}
                  >
                    {invoice.payerName ?? invoice.description}
                  </Text>
                </View>
                <View style={dashboardStyles.attentionValueColumn}>
                  <Text style={dashboardStyles.attentionValue}>
                    {formatMoneyFromCents(
                      getInvoiceOutstandingCents(
                        invoice.amountCents,
                        invoice.paidCents,
                      ),
                    )}
                  </Text>
                  <Text style={dashboardStyles.attentionStatus}>
                    {getOperationalStatusLabel(invoice) ?? "Requer atenção"}
                  </Text>
                </View>
                {index === 0 ? (
                  <GoAtletaIcon
                    name="chevronRight"
                    size={17}
                    color={colors.muted}
                  />
                ) : null}
              </Pressable>
            ))
          ) : (
            <View
              style={{
                minHeight: 174,
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                padding: 16,
              }}
            >
              <GoAtletaIcon name="success" size={24} color={colors.success} />
              <Text
                style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}
              >
                Tudo em dia
              </Text>
            </View>
          )}
        </View>

        <View
          style={{
            flex: compact ? undefined : 0.8,
            minWidth: compact ? 0 : 270,
            borderRadius: radius.container,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 16,
            gap: 14,
          }}
        >
          <View style={{ gap: 3 }}>
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}
            >
              Recebimentos do mês
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {receivedRate}% do valor emitido
            </Text>
          </View>
          <View
            style={{
              height: 9,
              borderRadius: radius.full,
              backgroundColor: colors.secondaryBg,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${receivedRate}%`,
                height: "100%",
                backgroundColor: colors.success,
              }}
            />
          </View>
          <View style={{ gap: 10 }}>
            {[
              ["Pagas", summary.paidCount],
              ["Em aberto", summary.openCount],
              ["Vencidas", summary.overdueCount],
            ].map(([label, value]) => (
              <View
                key={String(label)}
                style={dashboardStyles.receiptBreakdownRow}
              >
                <Text style={dashboardStyles.receiptBreakdownLabel}>
                  {label}
                </Text>
                <Text style={dashboardStyles.receiptBreakdownValue}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
          <View style={dashboardStyles.flexSpacer} />
          <FinanceAction
            label="Nova cobrança"
            icon="add"
            primary
            onPress={onNewCharge}
          />
        </View>
      </View>
    </View>
  );
}

function FinancePayersPanel({
  agreements,
  invoices,
  compact,
  onManagePeople,
}: {
  agreements: TuitionAgreement[];
  invoices: FinanceInvoice[];
  compact: boolean;
  onManagePeople: () => void;
}) {
  const { colors } = useAppTheme();
  const dashboardStyles = useFinanceDashboardStyles(colors);

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: compact ? "column" : "row",
          alignItems: compact ? "stretch" : "center",
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
            Pagadores
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Responsáveis financeiros usados nas cobranças
          </Text>
        </View>
        <FinanceAction
          label="Gerenciar responsáveis"
          icon="management"
          onPress={onManagePeople}
        />
      </View>
      <View
        style={{
          borderRadius: radius.container,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
        }}
      >
        {agreements.length ? (
          agreements.map((agreement, index) => {
            const invoice = invoices.find(
              (candidate) => candidate.studentId === agreement.studentId,
            );
            return (
              <View
                key={agreement.id}
                style={[
                  dashboardStyles.payerRow,
                  index === 0
                    ? dashboardStyles.payerRowFirst
                    : dashboardStyles.payerRowDivided,
                  compact
                    ? dashboardStyles.payerRowCompact
                    : dashboardStyles.payerRowWide,
                ]}
              >
                <View style={dashboardStyles.payerPrimaryColumn}>
                  <Text
                    numberOfLines={1}
                    style={dashboardStyles.listPrimaryText}
                  >
                    {invoice?.payerName ?? "Responsável financeiro vinculado"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={dashboardStyles.listSecondaryText}
                  >
                    {invoice?.payerContact ?? "Acesso gerenciado em Gestão"}
                  </Text>
                </View>
                <View style={dashboardStyles.payerStudentColumn}>
                  <Text
                    numberOfLines={1}
                    style={dashboardStyles.payerStudentName}
                  >
                    {agreement.studentName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={dashboardStyles.listSecondaryText}
                  >
                    {agreement.planName}
                  </Text>
                </View>
                <Text style={dashboardStyles.payerAmount}>
                  {formatMoneyFromCents(agreement.amountCents)}
                </Text>
              </View>
            );
          })
        ) : (
          <View
            style={{
              minHeight: 220,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 20,
            }}
          >
            <GoAtletaIcon name="family" size={25} color={colors.muted} />
            <Text
              style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}
            >
              Nenhum pagador vinculado
            </Text>
            <Text
              style={{
                maxWidth: 360,
                color: colors.muted,
                fontSize: 12,
                lineHeight: 18,
                textAlign: "center",
              }}
            >
              Cadastre o responsável no atleta e depois associe um plano de
              mensalidade.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InvoiceDetails({
  invoice,
  framed,
  showReminder = false,
  onClose,
  onRecord,
}: {
  invoice: FinanceInvoice | null;
  framed: boolean;
  showReminder?: boolean;
  onClose?: () => void;
  onRecord: (invoice: FinanceInvoice) => void;
}) {
  const { colors } = useAppTheme();
  const dashboardStyles = useFinanceDashboardStyles(colors);

  if (!invoice) {
    return (
      <View
        style={{
          minHeight: 280,
          borderRadius: radius.container,
          borderWidth: framed ? 1 : 0,
          borderColor: colors.border,
          backgroundColor: framed ? colors.card : "transparent",
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.lg,
          gap: 8,
        }}
      >
        <GoAtletaIcon name="receipt" size={24} color={colors.muted} />
        <Text
          style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          Selecione uma cobrança
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            lineHeight: 18,
            textAlign: "center",
          }}
        >
          Os detalhes e a ação de pagamento aparecem aqui.
        </Text>
      </View>
    );
  }

  const canRecord = canRecordManualPaymentForInvoice({
    amountCents: invoice.amountCents,
    paidCents: invoice.paidCents,
    status: invoice.status,
  });
  const operationalStatus = getOperationalStatusLabel(invoice);
  const detailRows = [
    [
      "Responsável financeiro",
      invoice.payerName ?? "Não informado",
      invoice.payerContact,
    ],
    ["Plano", invoice.description, invoice.className],
  ] as const;

  return (
    <View
      style={{
        borderRadius: radius.container,
        borderWidth: framed ? 1 : 0,
        borderColor: colors.border,
        backgroundColor: framed ? colors.card : "transparent",
        padding: spacing.md,
        gap: 14,
        flex: framed ? 1 : undefined,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}
          >
            {invoice.studentName}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
            {invoice.className ??
              invoice.description.replace(/^Mensalidade\s+/i, "")}
          </Text>
        </View>
        {onClose ? (
          <Pressable
            accessibilityLabel="Fechar detalhes"
            onPress={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoAtletaIcon name="close" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ gap: 5 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            lineHeight: 27,
            fontWeight: "900",
          }}
        >
          {formatMoneyFromCents(
            getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents),
          )}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <PaymentStatusBadge
            status={invoice.status}
            label={operationalStatus}
          />
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Vencimento em {formatFinanceDate(invoice.dueDate)}
          </Text>
        </View>
      </View>
      <View style={dashboardStyles.detailDivider} />
      <View style={{ gap: 13 }}>
        {detailRows.map(([label, value, supportingText]) => (
          <View key={label} style={dashboardStyles.detailRow}>
            <Text style={dashboardStyles.detailLabel}>{label}</Text>
            <Text style={dashboardStyles.detailValue}>{value}</Text>
            {supportingText ? (
              <Text style={dashboardStyles.detailSupportingText}>
                {supportingText}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <View style={dashboardStyles.detailDivider} />
      <View
        style={[
          dashboardStyles.detailHistorySection,
          framed && dashboardStyles.flexSpacer,
        ]}
      >
        <Text style={dashboardStyles.detailHistoryTitle}>Histórico</Text>
        <View style={dashboardStyles.detailHistoryEntry}>
          <GoAtletaIcon name="receipt" size={17} color={colors.muted} />
          <View style={dashboardStyles.detailHistoryEntryBody}>
            <Text style={dashboardStyles.detailHistoryEntryTitle}>
              Cobrança criada
            </Text>
            <Text style={dashboardStyles.detailHistoryEntryMeta}>
              {formatFinanceDate(invoice.createdAt)}
            </Text>
          </View>
        </View>
        {invoice.paidCents > 0 ? (
          <View style={dashboardStyles.detailHistoryEntry}>
            <GoAtletaIcon name="success" size={18} color={colors.success} />
            <View style={dashboardStyles.detailHistoryEntryBody}>
              <Text style={dashboardStyles.detailHistoryEntryTitle}>
                {formatMoneyFromCents(invoice.paidCents)} recebido
              </Text>
              <Text style={dashboardStyles.detailHistoryEntryMeta}>
                {invoice.paidAt
                  ? formatFinanceDate(invoice.paidAt)
                  : "Pagamento confirmado"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={framed ? dashboardStyles.flexSpacer : undefined} />
        )}
      </View>
      {canRecord ? (
        <Pressable
          onPress={() => onRecord(invoice)}
          style={{
            minHeight: 42,
            borderRadius: radius.card,
            backgroundColor: colors.primaryBg,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <GoAtletaIcon name="payments" size={18} color={colors.primaryText} />
          <Text
            style={{
              color: colors.primaryText,
              fontSize: 12,
              fontWeight: "900",
            }}
          >
            Registrar pagamento
          </Text>
        </Pressable>
      ) : null}
      {showReminder ? (
        <View
          style={{
            minHeight: 28,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          <GoAtletaIcon
            name="communications"
            size={16}
            color={colors.success}
          />
          <Text
            style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}
          >
            Enviar lembrete
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function InvoiceList({
  invoices,
  selectedId,
  showTable,
  onSelect,
}: {
  invoices: FinanceInvoice[];
  selectedId: string | null;
  showTable: boolean;
  onSelect: (invoice: FinanceInvoice) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      {showTable ? (
        <View
          style={{
            minHeight: 46,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: colors.secondaryBg,
          }}
        >
          <View style={{ width: 26 }} />
          <Text
            style={{
              flex: 1.35,
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            Atleta
          </Text>
          <Text
            style={{
              flex: 0.9,
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            Turma
          </Text>
          <Text
            style={{
              flex: 1.45,
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            Responsável pagador
          </Text>
          <View
            style={{
              flex: 1.05,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text
              style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}
            >
              Vencimento
            </Text>
            <GoAtletaIcon name="chevronUp" size={12} color={colors.muted} />
          </View>
          <Text
            style={{
              flex: 0.85,
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            Valor
          </Text>
          <Text
            style={{
              flex: 0.95,
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            Status
          </Text>
          <View style={{ width: 28 }} />
        </View>
      ) : null}
      {invoices.map((invoice, index) => {
        const selected = invoice.id === selectedId;
        return (
          <Pressable
            key={invoice.id}
            accessibilityLabel={`Ver cobrança de ${invoice.studentName}`}
            onPress={() => onSelect(invoice)}
            style={[
              {
                minHeight: showTable ? 49 : 78,
                paddingHorizontal: 14,
                paddingVertical: showTable ? 8 : 11,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
                backgroundColor: selected ? colors.successBg : "transparent",
                flexDirection: showTable ? "row" : "column",
                alignItems: showTable ? "center" : "stretch",
                gap: showTable ? 12 : 9,
              },
              Platform.OS === "web"
                ? ({ outlineStyle: "none" } as never)
                : null,
            ]}
          >
            {showTable ? (
              <>
                <View
                  style={{
                    width: 26,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected ? (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.success,
                      }}
                    >
                      <GoAtletaIcon
                        name="checkmark"
                        size={14}
                        color={colors.primaryText}
                      />
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1.35,
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {invoice.studentName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ flex: 0.9, color: colors.text, fontSize: 12 }}
                >
                  {invoice.className ??
                    invoice.description.replace(/^Mensalidade\s+/i, "")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1.45, color: colors.text, fontSize: 12 }}
                >
                  {invoice.payerName ?? "Não informado"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1.05, color: colors.text, fontSize: 12 }}
                >
                  {formatFinanceDate(invoice.dueDate)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 0.85,
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {formatMoneyFromCents(invoice.amountCents)}
                </Text>
                <View style={{ flex: 0.95 }}>
                  <PaymentStatusBadge
                    status={invoice.status}
                    label={
                      invoice.status === "paid"
                        ? "Pago"
                        : getOperationalStatusLabel(invoice)
                    }
                  />
                </View>
                <GoAtletaIcon
                  name="ellipsisVertical"
                  size={18}
                  color={colors.muted}
                />
              </>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: "900",
                      }}
                    >
                      {invoice.studentName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.muted, fontSize: 12 }}
                    >
                      {invoice.description} · vence{" "}
                      {formatFinanceDate(invoice.dueDate)}
                    </Text>
                  </View>
                  <GoAtletaIcon
                    name="chevronRight"
                    size={18}
                    color={colors.muted}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <PaymentStatusBadge
                    status={invoice.status}
                    label={getOperationalStatusLabel(invoice)}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 13,
                      fontWeight: "900",
                    }}
                  >
                    {formatMoneyFromCents(invoice.amountCents)}
                  </Text>
                </View>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CoordinationFinanceDashboard() {
  const params = useLocalSearchParams<{ designPreview?: string }>();
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id ?? "";
  const scopeKey = `${organizationId}:${params.designPreview ?? ""}`;

  return <CoordinationFinanceDashboardOrganizationScope key={scopeKey} />;
}

function CoordinationFinanceDashboardOrganizationScope() {
  markRender("screen.coordFinance.render.root");
  const params = useLocalSearchParams<{ designPreview?: string }>();
  const designPreview = __DEV__ && params.designPreview === "finance";
  const router = useRouter();
  const { colors } = useAppTheme();
  const dashboardStyles = useFinanceDashboardStyles(colors);
  const responsiveLayout = useResponsiveLayout("dashboard");
  const insets = useSafeAreaInsets();
  const { activeOrganization, memberPermissions, permissionsLoading } =
    useOrganization();
  const organizationId =
    activeOrganization?.id ?? (designPreview ? "preview-organization" : "");
  const {
    identity: organizationIdentity,
    identityRef: organizationIdentityRef,
  } = useOrganizationAsyncIdentity(organizationId);
  const canAccess =
    designPreview ||
    (activeOrganization?.role_level ?? 0) >= 50 ||
    memberPermissions.financial === true;
  const {
    containerRef,
    onLayout,
    width: contentWidth,
  } = useContainerResponsiveLayout("dashboard");
  const showDetailPanel = contentWidth >= 1060;
  const showTable = contentWidth >= 720;
  const compactHeader =
    responsiveLayout.tier === "mobile" || responsiveLayout.tier === "tablet";
  const monthTriggerRef = useRef<View | null>(null);
  const [monthTriggerLayout, setMonthTriggerLayout] =
    useState<AnchorLayout | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [serverSummary, setServerSummary] =
    useState<OrganizationFinanceSummary>(EMPTY_SUMMARY);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [agreements, setAgreements] = useState<TuitionAgreement[]>([]);
  const [activeSection, setActiveSection] = useState<FinanceSection>(
    designPreview ? "charges" : "overview",
  );
  const [detailInvoice, setDetailInvoice] = useState<FinanceInvoice | null>(
    null,
  );
  const [mobileDetailsVisible, setMobileDetailsVisible] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<FinanceInvoice | null>(
    null,
  );
  const [newChargeVisible, setNewChargeVisible] = useState(false);
  const [workspaceModal, setWorkspaceModal] =
    useState<FinanceWorkspaceModal>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [foundationPending, setFoundationPending] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const [dataIdentity, setDataIdentity] =
    useState<OrganizationAsyncIdentity | null>(null);
  const dataIsCurrent = Boolean(
    dataIdentity &&
    isOrganizationAsyncIdentityCurrent(organizationIdentity, dataIdentity),
  );
  const scopedServerSummary = useMemo(
    () =>
      dataIsCurrent ? serverSummary : { ...EMPTY_SUMMARY, organizationId },
    [dataIsCurrent, organizationId, serverSummary],
  );
  const scopedInvoices = useMemo(
    () => (dataIsCurrent ? invoices : []),
    [dataIsCurrent, invoices],
  );
  const scopedAgreements = useMemo(
    () => (dataIsCurrent ? agreements : []),
    [agreements, dataIsCurrent],
  );
  const scopedNotice = dataIsCurrent ? notice : "";
  const scopedError = dataIsCurrent ? error : "";
  const scopedFoundationPending = dataIsCurrent && foundationPending;

  const load = useCallback(
    async (refresh = false) => {
      const identity = captureOrganizationAsyncIdentity(
        organizationIdentityRef.current,
        organizationIdentity,
      );
      if (!identity) return;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      if (designPreview) {
        setDataIdentity(identity);
        setServerSummary(DESIGN_PREVIEW_SUMMARY);
        setInvoices(DESIGN_PREVIEW_INVOICES);
        setAgreements(DESIGN_PREVIEW_AGREEMENTS);
        setDetailInvoice(DESIGN_PREVIEW_INVOICES[3]);
        setFoundationPending(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!organizationId || !canAccess) {
        setDataIdentity(identity);
        setLoading(false);
        setRefreshing(false);
        setServerSummary({ ...EMPTY_SUMMARY, organizationId });
        setInvoices([]);
        setAgreements([]);
        return;
      }
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const [nextSummary, nextInvoices, nextAgreements] = await measureAsync(
          "screen.coordFinance.load.dashboard",
          () =>
            Promise.all([
              getOrganizationFinanceDashboard(organizationId),
              listOrganizationInvoices(organizationId),
              listTuitionAgreements(organizationId),
            ]),
          { organizationId },
        );
        if (
          requestId !== requestIdRef.current ||
          !isOrganizationAsyncIdentityCurrent(
            organizationIdentityRef.current,
            identity,
          )
        )
          return;
        setDataIdentity(identity);
        setServerSummary(nextSummary);
        setInvoices(nextInvoices);
        setAgreements(nextAgreements);
        setFoundationPending(false);
      } catch (loadError) {
        if (
          requestId !== requestIdRef.current ||
          !isOrganizationAsyncIdentityCurrent(
            organizationIdentityRef.current,
            identity,
          )
        )
          return;
        setDataIdentity(identity);
        setServerSummary({ ...EMPTY_SUMMARY, organizationId });
        setInvoices([]);
        setAgreements([]);
        if (isMissingFinanceFoundation(loadError)) setFoundationPending(true);
        else setError("Não foi possível carregar o financeiro.");
      } finally {
        if (
          requestId !== requestIdRef.current ||
          !isOrganizationAsyncIdentityCurrent(
            organizationIdentityRef.current,
            identity,
          )
        )
          return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      canAccess,
      designPreview,
      organizationId,
      organizationIdentity,
      organizationIdentityRef,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requestIdRef.current += 1;
      };
    }, [load]),
  );

  const monthOptions = useMemo(() => {
    const months = new Set(scopedInvoices.map(invoiceMonthKey));
    months.add(currentMonthKey());
    return Array.from(months).sort((left, right) => right.localeCompare(left));
  }, [scopedInvoices]);
  const monthlyInvoices = useMemo(
    () =>
      scopedInvoices.filter(
        (invoice) => invoiceMonthKey(invoice) === selectedMonth,
      ),
    [scopedInvoices, selectedMonth],
  );
  const summary = useMemo(
    () =>
      designPreview
        ? scopedServerSummary
        : summarizeFinanceInvoices(
            monthlyInvoices,
            organizationId,
            scopedServerSummary.activeAgreementsCount,
          ),
    [designPreview, monthlyInvoices, organizationId, scopedServerSummary],
  );
  const filteredInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return monthlyInvoices
      .filter((invoice) => invoiceMatchesFilter(invoice, filter))
      .filter((invoice) => {
        if (!normalizedQuery) return true;
        return [
          invoice.studentName,
          invoice.payerName ?? "",
          invoice.className ?? "",
          invoice.description,
          formatFinanceDate(invoice.dueDate),
        ].some((value) =>
          value.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
        );
      })
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  }, [filter, monthlyInvoices, query]);
  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const pageInvoices = useMemo(
    () =>
      filteredInvoices.slice(
        (visiblePage - 1) * pageSize,
        visiblePage * pageSize,
      ),
    [filteredInvoices, pageSize, visiblePage],
  );
  const visibleDetailInvoice = useMemo(
    () =>
      detailInvoice
        ? (filteredInvoices.find(
            (invoice) => invoice.id === detailInvoice.id,
          ) ?? null)
        : null,
    [detailInvoice, filteredInvoices],
  );

  const filters = useMemo(
    () =>
      [
        ["all", `Todas ${monthlyInvoices.length}`],
        [
          "attention",
          `Precisam de atenção ${monthlyInvoices.filter((invoice) => invoiceMatchesFilter(invoice, "attention")).length}`,
        ],
        ["open", `Em aberto ${summary.openCount}`],
        ["overdue", `Vencidas ${summary.overdueCount}`],
        ["paid", `Pagas ${summary.paidCount}`],
      ] as const,
    [
      monthlyInvoices,
      summary.openCount,
      summary.overdueCount,
      summary.paidCount,
    ],
  );

  const handlePaymentSuccess = useCallback(
    async (result: { studentName: string; amountCents: number }) => {
      const identity = captureOrganizationAsyncIdentity(
        organizationIdentityRef.current,
        organizationIdentity,
      );
      if (!identity) return;
      setNotice(
        `${formatMoneyFromCents(result.amountCents)} registrado para ${result.studentName}.`,
      );
      setPaymentInvoice(null);
      setMobileDetailsVisible(false);
      await load(true);
      if (
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
    },
    [load, organizationIdentity, organizationIdentityRef],
  );

  const handleInvoiceSuccess = useCallback(
    async (studentName: string) => {
      const identity = captureOrganizationAsyncIdentity(
        organizationIdentityRef.current,
        organizationIdentity,
      );
      if (!identity) return;
      setNotice(`Cobrança de ${studentName} emitida.`);
      await load(true);
      if (
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
    },
    [load, organizationIdentity, organizationIdentityRef],
  );

  const openMonthPicker = () => {
    const identity = captureOrganizationAsyncIdentity(
      organizationIdentityRef.current,
      organizationIdentity,
    );
    if (!identity || !dataIsCurrent) return;
    monthTriggerRef.current?.measureInWindow((x, y, width, height) => {
      if (
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
      setMonthTriggerLayout({ x, y, width, height });
      setShowMonthPicker(true);
    });
  };

  const selectInvoice = (invoice: FinanceInvoice) => {
    setDetailInvoice(invoice);
    if (!showDetailPanel) setMobileDetailsVisible(true);
  };

  const changeFinanceSection = (section: FinanceSection) => {
    setActiveSection(section);
    setDetailInvoice(null);
    setMobileDetailsVisible(false);
  };

  const financeChargeControls = (
    <>
      <View
        style={{
          minHeight: 42,
          flexGrow: 1,
          minWidth: compactHeader ? 220 : 250,
          maxWidth: compactHeader ? undefined : 320,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <GoAtletaIcon name="search" size={17} color={colors.muted} />
        <TextInput
          accessibilityLabel="Buscar cobranças"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Buscar atleta, responsável..."
          placeholderTextColor={colors.placeholder}
          style={[
            {
              flex: 1,
              minHeight: 40,
              borderWidth: 0,
              borderRadius: 0,
              paddingVertical: 0,
              color: colors.inputText,
              backgroundColor: "transparent",
              fontSize: 12,
            },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
          ]}
        />
        {query ? (
          <Pressable
            accessibilityLabel="Limpar busca"
            onPress={() => setQuery("")}
          >
            <GoAtletaIcon name="closeCircle" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <FinanceAction
        label="Filtros"
        icon="options"
        onPress={() => {
          setFilter((current) =>
            current === "attention" ? "all" : "attention",
          );
          setPage(1);
        }}
      />
    </>
  );

  const financeHeaderControls = (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      {activeSection === "overview" || activeSection === "charges" ? (
        <View ref={monthTriggerRef} collapsable={false}>
          <Pressable
            accessibilityLabel={`Selecionar mês. ${formatFinanceMonthLabel(selectedMonth)}`}
            onPress={openMonthPicker}
            style={{
              minHeight: 42,
              minWidth: responsiveLayout.isMobile ? 116 : 172,
              maxWidth: responsiveLayout.isMobile ? 124 : undefined,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              paddingHorizontal: responsiveLayout.isMobile ? 8 : 12,
              flexDirection: "row",
              alignItems: "center",
              gap: responsiveLayout.isMobile ? 5 : 8,
            }}
          >
            <GoAtletaIcon
              name="calendar"
              size={responsiveLayout.isMobile ? 16 : 17}
              color={colors.muted}
            />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: colors.text,
                fontSize: responsiveLayout.isMobile ? 11 : 12,
                fontWeight: "800",
              }}
            >
              {responsiveLayout.isMobile
                ? formatFinanceCompactMonthLabel(selectedMonth)
                : formatFinanceMonthLabel(selectedMonth)}
            </Text>
            <GoAtletaIcon
              name="chevronDown"
              size={responsiveLayout.isMobile ? 14 : 16}
              color={colors.muted}
            />
          </Pressable>
        </View>
      ) : null}
      {!compactHeader && activeSection === "charges"
        ? financeChargeControls
        : null}
      <FinanceAction
        label="Configurar financeiro"
        icon="management"
        compact
        onPress={() => setWorkspaceModal("settings")}
      />
    </View>
  );

  if (!permissionsLoading && !canAccess) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
          }}
        >
          <GoAtletaIcon name="lock" size={28} color={colors.muted} />
          <Text
            style={{
              marginTop: 12,
              color: colors.text,
              fontSize: 18,
              fontWeight: "800",
            }}
          >
            Financeiro restrito
          </Text>
          <Text
            style={{ marginTop: 5, color: colors.muted, textAlign: "center" }}
          >
            Solicite à coordenação a permissão financeira.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenPageHeader
        title="Financeiro"
        subtitle={
          activeOrganization?.name ??
          (designPreview ? "Rede Esportes Pinhais" : "Instituição")
        }
        onBack={() =>
          navigateBackOrReplace({ router, fallback: "/coord/dashboard" })
        }
        horizontalBleed={0}
        fadeHeight={10}
        contentStyle={{
          width: "100%",
          minWidth: 0,
          maxWidth:
            responsiveLayout.maxContentWidth + responsiveLayout.gutter * 2,
          alignSelf: "center",
          paddingHorizontal: responsiveLayout.gutter,
          paddingTop: Platform.OS === "web" ? 12 : 8,
          paddingBottom: 0,
          gap: 10,
        }}
        right={financeHeaderControls}
      >
        {compactHeader && activeSection === "charges" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {financeChargeControls}
          </View>
        ) : null}
        <FinanceSectionTabs
          active={activeSection}
          compact={responsiveLayout.isMobile}
          onChange={changeFinanceSection}
        />
      </ScreenPageHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: Platform.OS === "web" ? 12 : 8,
          paddingBottom: resolveFinanceScrollBottomPadding({
            usesWorkspaceShell: responsiveLayout.usesWorkspaceShell,
            bottomInset: insets.bottom,
          }),
        }}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primaryBg}
          />
        }
      >
        <ResponsivePage
          variant="dashboard"
          gap={
            Platform.OS === "web" && !responsiveLayout.isMobile
              ? 24
              : responsiveLayout.density.pageGap
          }
        >
          {scopedFoundationPending ? (
            <View
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.warningBorder,
                backgroundColor: colors.warningBg,
                padding: spacing.md,
                gap: 5,
              }}
            >
              <Text style={{ color: colors.warningText, fontWeight: "800" }}>
                Financeiro aguardando ativação
              </Text>
              <Text
                style={{
                  color: colors.warningText,
                  fontSize: 13,
                  lineHeight: 19,
                }}
              >
                A estrutura financeira ainda não está disponível neste ambiente.
              </Text>
            </View>
          ) : null}

          {scopedNotice ? (
            <Pressable
              accessibilityRole="alert"
              onPress={() => setNotice("")}
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.successBorder,
                backgroundColor: colors.successBg,
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
              }}
            >
              <GoAtletaIcon
                name="success"
                size={19}
                color={colors.successText}
              />
              <Text
                style={{
                  flex: 1,
                  color: colors.successText,
                  fontWeight: "800",
                }}
              >
                {scopedNotice}
              </Text>
            </Pressable>
          ) : null}

          {scopedError ? (
            <Pressable
              onPress={() => void load()}
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.dangerBorder,
                backgroundColor: colors.dangerBg,
                padding: spacing.md,
              }}
            >
              <Text style={{ color: colors.dangerText, fontWeight: "800" }}>
                {scopedError} Tocar para tentar novamente.
              </Text>
            </Pressable>
          ) : null}

          {loading ? (
            <SectionLoadingState />
          ) : activeSection === "overview" ? (
            <FinanceOverviewPanel
              summary={summary}
              invoices={monthlyInvoices}
              compact={compactHeader}
              onOpenCharges={() => {
                setFilter("attention");
                setPage(1);
                setActiveSection("charges");
              }}
              onNewCharge={() => setNewChargeVisible(true)}
            />
          ) : activeSection === "plans" ? (
            <View style={{ minHeight: responsiveLayout.isMobile ? 720 : 760 }}>
              <CoordinationTuitionSetup
                embedded
                showHeader={false}
                onInvoiceIssued={() => load(true)}
                onOpenPeopleManagement={() =>
                  router.push("/coord/management" as never)
                }
              />
            </View>
          ) : activeSection === "payers" ? (
            <FinancePayersPanel
              agreements={scopedAgreements}
              invoices={monthlyInvoices}
              compact={compactHeader}
              onManagePeople={() => router.push("/coord/management" as never)}
            />
          ) : (
            <>
              <FinanceSummaryStrip
                summary={summary}
                compact={responsiveLayout.isMobile}
              />
              <View
                ref={containerRef}
                onLayout={onLayout}
                style={{
                  width: "100%",
                  minWidth: 0,
                  flexDirection: showDetailPanel ? "row" : "column",
                  alignItems: "stretch",
                  gap: 16,
                }}
              >
                <View
                  style={{
                    flex: showDetailPanel ? 1 : undefined,
                    minWidth: 0,
                    gap: 16,
                  }}
                >
                  <View style={{ gap: 12 }}>
                    <View
                      style={{
                        flexDirection: responsiveLayout.isMobile
                          ? "column"
                          : "row",
                        alignItems: responsiveLayout.isMobile
                          ? "stretch"
                          : "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 17,
                            fontWeight: "900",
                          }}
                        >
                          Cobranças
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {filteredInvoices.length} de {monthlyInvoices.length}{" "}
                          cobrança(s)
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <FinanceAction
                          label="Nova cobrança"
                          icon="add"
                          primary
                          onPress={() => setNewChargeVisible(true)}
                        />
                      </View>
                    </View>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                    >
                      {filters.map(([value, label]) => {
                        const selected = filter === value;
                        return (
                          <Pressable
                            key={value}
                            onPress={() => {
                              setFilter(value);
                              setPage(1);
                            }}
                            style={[
                              dashboardStyles.filterButton,
                              selected
                                ? dashboardStyles.filterButtonSelected
                                : dashboardStyles.filterButtonIdle,
                            ]}
                          >
                            <Text
                              style={[
                                dashboardStyles.filterLabel,
                                selected
                                  ? dashboardStyles.filterLabelSelected
                                  : dashboardStyles.filterLabelIdle,
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View
                    style={{
                      borderRadius: radius.container,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      overflow: "hidden",
                    }}
                  >
                    {filteredInvoices.length ? (
                      <>
                        <InvoiceList
                          invoices={pageInvoices}
                          selectedId={visibleDetailInvoice?.id ?? null}
                          showTable={showTable}
                          onSelect={selectInvoice}
                        />
                        <View
                          style={{
                            minHeight: 46,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            paddingHorizontal: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <Text
                            style={{
                              flex: 1,
                              color: colors.muted,
                              fontSize: 11,
                            }}
                          >
                            Mostrando {(visiblePage - 1) * pageSize + 1} a{" "}
                            {Math.min(
                              visiblePage * pageSize,
                              filteredInvoices.length,
                            )}{" "}
                            de {filteredInvoices.length} cobranças
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Pressable
                              accessibilityLabel="Página anterior"
                              disabled={visiblePage <= 1}
                              onPress={() =>
                                setPage((current) => Math.max(1, current - 1))
                              }
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: radius.card,
                                borderWidth: 1,
                                borderColor: colors.border,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: visiblePage <= 1 ? 0.4 : 1,
                              }}
                            >
                              <GoAtletaIcon
                                name="chevronBack"
                                size={16}
                                color={colors.text}
                              />
                            </Pressable>
                            {Array.from(
                              { length: Math.min(pageCount, 5) },
                              (_, index) => index + 1,
                            ).map((pageNumber) => (
                              <Pressable
                                key={pageNumber}
                                accessibilityLabel={`Página ${pageNumber}`}
                                onPress={() => setPage(pageNumber)}
                                style={[
                                  dashboardStyles.pageButton,
                                  pageNumber === visiblePage
                                    ? dashboardStyles.pageButtonSelected
                                    : dashboardStyles.pageButtonIdle,
                                ]}
                              >
                                <Text
                                  style={[
                                    dashboardStyles.pageLabel,
                                    pageNumber === visiblePage
                                      ? dashboardStyles.pageLabelSelected
                                      : dashboardStyles.pageLabelIdle,
                                  ]}
                                >
                                  {pageNumber}
                                </Text>
                              </Pressable>
                            ))}
                            <Pressable
                              accessibilityLabel="Próxima página"
                              disabled={visiblePage >= pageCount}
                              onPress={() =>
                                setPage((current) =>
                                  Math.min(pageCount, current + 1),
                                )
                              }
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: radius.card,
                                borderWidth: 1,
                                borderColor: colors.border,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: visiblePage >= pageCount ? 0.4 : 1,
                              }}
                            >
                              <GoAtletaIcon
                                name="chevronForward"
                                size={16}
                                color={colors.text}
                              />
                            </Pressable>
                            <Pressable
                              accessibilityLabel="Alternar quantidade por página"
                              onPress={() => {
                                setPageSize((current) =>
                                  current === 12 ? 24 : 12,
                                );
                                setPage(1);
                              }}
                              style={{
                                minHeight: 32,
                                borderRadius: radius.card,
                                borderWidth: 1,
                                borderColor: colors.border,
                                paddingHorizontal: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.text,
                                  fontSize: 11,
                                  fontWeight: "700",
                                }}
                              >
                                {pageSize} por página
                              </Text>
                              <GoAtletaIcon
                                name="chevronDown"
                                size={14}
                                color={colors.muted}
                              />
                            </Pressable>
                          </View>
                        </View>
                      </>
                    ) : (
                      <View
                        style={{
                          minHeight: 210,
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                          padding: spacing.lg,
                        }}
                      >
                        <GoAtletaIcon
                          name="receipt"
                          size={24}
                          color={colors.muted}
                        />
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 14,
                            fontWeight: "800",
                            textAlign: "center",
                          }}
                        >
                          Nenhuma cobrança encontrada
                        </Text>
                        <Text
                          style={{
                            maxWidth: 340,
                            color: colors.muted,
                            fontSize: 12,
                            lineHeight: 18,
                            textAlign: "center",
                          }}
                        >
                          Ajuste o mês ou os filtros. Para começar, cadastre um
                          plano e vincule os atletas.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {showDetailPanel ? (
                  <View style={{ width: 320, minWidth: 320 }}>
                    <InvoiceDetails
                      invoice={visibleDetailInvoice}
                      framed
                      showReminder={designPreview}
                      onClose={
                        visibleDetailInvoice
                          ? () => setDetailInvoice(null)
                          : undefined
                      }
                      onRecord={setPaymentInvoice}
                    />
                  </View>
                ) : null}
              </View>
            </>
          )}
        </ResponsivePage>
      </ScrollView>

      <AnchoredDropdown
        visible={dataIsCurrent && showMonthPicker}
        layout={monthTriggerLayout}
        container={null}
        animationStyle={{ opacity: 1 }}
        zIndex={2400}
        maxHeight={220}
        nestedScrollEnabled
        density="compact"
        fitContent
        interactiveRefs={[monthTriggerRef]}
        onRequestClose={() => setShowMonthPicker(false)}
      >
        {monthOptions.map((month) => (
          <AnchoredDropdownOption
            key={month}
            active={selectedMonth === month}
            density="compact"
            onPress={() => {
              setSelectedMonth(month);
              setPage(1);
              setShowMonthPicker(false);
            }}
          >
            <Text
              style={[
                dashboardStyles.monthOptionLabel,
                selectedMonth === month
                  ? dashboardStyles.monthOptionLabelSelected
                  : dashboardStyles.monthOptionLabelIdle,
              ]}
            >
              {formatFinanceMonthLabel(month)}
            </Text>
          </AnchoredDropdownOption>
        ))}
      </AnchoredDropdown>

      <ModalSheet
        visible={
          mobileDetailsVisible &&
          Boolean(visibleDetailInvoice) &&
          !showDetailPanel
        }
        onClose={() => setMobileDetailsVisible(false)}
        position="bottom"
        cardStyle={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "88%",
          borderRadius: radius.container,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: spacing.md,
        }}
      >
        <InvoiceDetails
          invoice={visibleDetailInvoice}
          framed={false}
          onClose={() => setMobileDetailsVisible(false)}
          onRecord={setPaymentInvoice}
        />
      </ModalSheet>

      <ManualPaymentModal
        visible={dataIsCurrent && Boolean(paymentInvoice)}
        invoice={dataIsCurrent ? paymentInvoice : null}
        organizationId={organizationId}
        canRecord={canAccess}
        onClose={() => setPaymentInvoice(null)}
        onSuccess={handlePaymentSuccess}
      />

      <NewChargeModal
        visible={dataIsCurrent && newChargeVisible}
        organizationId={organizationId}
        competenceMonth={selectedMonth}
        onClose={() => setNewChargeVisible(false)}
        onOpenPlans={() => {
          setNewChargeVisible(false);
          setActiveSection("plans");
        }}
        onSuccess={handleInvoiceSuccess}
      />

      <ModalSheet
        visible={dataIsCurrent && workspaceModal === "settings"}
        onClose={() => setWorkspaceModal(null)}
        position="center"
        cardStyle={{
          width: responsiveLayout.isMobile ? "100%" : 760,
          maxWidth: "100%",
          height: responsiveLayout.isMobile ? "94%" : undefined,
          maxHeight: "94%",
          borderRadius: radius.container,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
          padding: 0,
        }}
      >
        <CoordinationFinanceSettings
          embedded
          allowLocalDemo={designPreview}
          onClose={() => setWorkspaceModal(null)}
        />
      </ModalSheet>
    </SafeAreaView>
  );
}
