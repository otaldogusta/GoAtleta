import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
  canRecordManualPaymentForInvoice,
  formatFinanceDate,
  formatMoneyFromCents,
  getInvoiceOutstandingCents,
  type InvoiceStatus,
} from "../../finance/application/finance-format";
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
  | "all"
  | "attention"
  | Extract<InvoiceStatus, "open" | "overdue" | "paid">;
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

const DESIGN_PREVIEW_SUMMARY: OrganizationFinanceSummary = {
  organizationId: "preview-organization",
  expectedCents: 864000,
  receivedCents: 648000,
  overdueCents: 72000,
  openCents: 144000,
  overdueCount: 2,
  openCount: 7,
  paidCount: 23,
  activeAgreementsCount: 10,
};

const ACTIVE_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "open",
  "awaiting_payment",
  "partially_paid",
  "overdue",
];

const DESIGN_PREVIEW_ROWS = [
  ["Lucas Oliveira", "Sub-15 A", "Carlos Oliveira", "2026-08-10", "paid"],
  ["Mateus Souza", "Sub-13 B", "Juliana Souza", "2026-08-10", "paid"],
  ["Gabriel Lima", "Sub-15 A", "Fernanda Lima", "2026-08-10", "paid"],
  ["Enzo Martins", "Sub-13 A", "Rafael Martins", "2026-08-15", "open"],
  ["Miguel Pereira", "Sub-11 A", "Patrícia Pereira", "2026-08-15", "open"],
  ["Davi Santos", "Sub-15 B", "Marcos Santos", "2026-08-20", "overdue"],
  ["Arthur Rocha", "Sub-13 A", "Camila Rocha", "2026-08-20", "overdue"],
  ["Heitor Alves", "Sub-11 B", "Bruno Alves", "2026-08-25", "open"],
  ["Pedro Henrique", "Sub-11 A", "Ana Paula Henrique", "2026-08-25", "open"],
  ["Bernardo Costa", "Sub-13 B", "Thiago Costa", "2026-08-30", "open"],
  ["João Vitor", "Sub-11 A", "Vanessa Vitor", "2026-08-30", "open"],
  ["Samuel Bordim", "Sub-15 B", "Eduardo Bordim", "2026-08-31", "open"],
  ...Array.from({ length: 20 }, (_, index) => [
    `Atleta ${index + 13}`,
    `Turma ${String.fromCharCode(65 + (index % 4))}`,
    `Responsável ${index + 13}`,
    "2026-08-31",
    "paid",
  ]),
] as const;

const DESIGN_PREVIEW_INVOICES: FinanceInvoice[] = DESIGN_PREVIEW_ROWS.map(
  ([studentName, className, payerName, dueDate, status], index) => ({
  id: `preview-invoice-${index + 1}`,
  studentId: `preview-student-${index + 1}`,
  studentName,
  competenceMonth: "2026-08-01",
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
  createdAt: "2026-08-01T12:00:00.000Z",
  paidAt: status === "paid" ? `${dueDate}T12:00:00.000Z` : null,
  })
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

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

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

export const summarizeFinanceInvoices = (
  invoices: OrganizationInvoice[],
  organizationId: string,
  activeAgreementsCount = 0
): OrganizationFinanceSummary => {
  const billable = invoices.filter(
    (invoice) => !["draft", "canceled", "refunded"].includes(invoice.status)
  );
  return billable.reduce<OrganizationFinanceSummary>(
    (summary, invoice) => {
      const outstanding = getInvoiceOutstandingCents(
        invoice.amountCents,
        invoice.paidCents
      );
      summary.expectedCents += invoice.amountCents;
      summary.receivedCents += invoice.paidCents;
      if (invoice.status === "overdue") {
        summary.overdueCents += outstanding;
        summary.overdueCount += 1;
      }
      if (ACTIVE_INVOICE_STATUSES.includes(invoice.status)) {
        summary.openCents += outstanding;
        summary.openCount += 1;
      }
      if (invoice.status === "paid") summary.paidCount += 1;
      return summary;
    },
    { ...EMPTY_SUMMARY, organizationId, activeAgreementsCount }
  );
};

const invoiceMatchesFilter = (
  invoice: OrganizationInvoice,
  filter: FilterValue
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
  return ["open", "awaiting_payment", "partially_paid"].includes(invoice.status);
};

const getOverdueDays = (invoice: OrganizationInvoice) => {
  if (invoice.status !== "overdue") return 0;
  const due = new Date(`${invoice.dueDate}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(1, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
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
    value
  );
};

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
  const receivedRate = summary.expectedCents
    ? Math.min(100, Math.round((summary.receivedCents / summary.expectedCents) * 100))
    : 0;
  const items = [
    { label: "Recebido", value: formatMoneyFromCents(summary.receivedCents), color: colors.success },
    { label: "Em aberto", value: formatMoneyFromCents(summary.openCents), color: colors.warning },
    { label: "Vencido", value: formatMoneyFromCents(summary.overdueCents), color: colors.danger },
  ];
  const columns = compact ? 2 : 4;

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
          style={{
            width: compact ? "50%" : "25%",
            minHeight: 76,
            paddingHorizontal: 16,
            paddingVertical: 12,
            justifyContent: "center",
            gap: 4,
            borderLeftWidth: index % columns === 0 ? 0 : 1,
            borderTopWidth: compact && index >= 2 ? 1 : 0,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{item.label}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: item.color, fontSize: 18, lineHeight: 22, fontWeight: "900" }}
          >
            {item.value}
          </Text>
        </View>
      ))}
      <View
        style={{
          width: compact ? "50%" : "25%",
          minHeight: 76,
          paddingHorizontal: 16,
          paddingVertical: 12,
          justifyContent: "center",
          gap: 8,
          borderLeftWidth: 1,
          borderTopWidth: compact ? 1 : 0,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Taxa recebida</Text>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>{receivedRate}%</Text>
        </View>
        <View style={{ height: 7, borderRadius: radius.full, backgroundColor: colors.secondaryBg, overflow: "hidden" }}>
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
  const sections: readonly [FinanceSection, string][] = [
    ["overview", "Visão geral"],
    ["charges", "Cobranças"],
    ["plans", "Planos"],
    ["payers", "Pagadores"],
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        flexWrap: compact ? "wrap" : "nowrap",
        gap: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {sections.map(([value, label]) => {
        const selected = value === active;
        return (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(value)}
            style={{
              minHeight: 40,
              paddingHorizontal: 14,
              borderBottomWidth: 2,
              borderBottomColor: selected ? colors.success : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: selected ? colors.text : colors.muted,
                fontSize: 12,
                fontWeight: selected ? "900" : "700",
              }}
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
            flex: 1.35,
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
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
                Precisam de atenção
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {attentionInvoices.length
                  ? `${attentionInvoices.length} cobrança(s) para resolver agora`
                  : "Nenhuma pendência no mês"}
              </Text>
            </View>
            <Pressable onPress={onOpenCharges}>
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}>
                Ver cobranças
              </Text>
            </Pressable>
          </View>
          {attentionInvoices.length ? (
            attentionInvoices.map((invoice, index) => (
              <Pressable
                key={invoice.id}
                onPress={onOpenCharges}
                style={{
                  minHeight: 58,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                    {invoice.studentName}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
                    {invoice.payerName ?? invoice.description}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>
                    {formatMoneyFromCents(getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents))}
                  </Text>
                  <Text style={{ color: colors.danger, fontSize: 11, fontWeight: "800" }}>
                    {getOperationalStatusLabel(invoice) ?? "Requer atenção"}
                  </Text>
                </View>
                {index === 0 ? (
                  <GoAtletaIcon name="chevronRight" size={17} color={colors.muted} />
                ) : null}
              </Pressable>
            ))
          ) : (
            <View style={{ minHeight: 174, alignItems: "center", justifyContent: "center", gap: 7, padding: 16 }}>
              <GoAtletaIcon name="success" size={24} color={colors.success} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                Tudo em dia
              </Text>
            </View>
          )}
        </View>

        <View
          style={{
            flex: 0.8,
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
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
              Recebimentos do mês
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {receivedRate}% do valor emitido
            </Text>
          </View>
          <View style={{ height: 9, borderRadius: radius.full, backgroundColor: colors.secondaryBg, overflow: "hidden" }}>
            <View style={{ width: `${receivedRate}%`, height: "100%", backgroundColor: colors.success }} />
          </View>
          <View style={{ gap: 10 }}>
            {[
              ["Pagas", summary.paidCount],
              ["Em aberto", summary.openCount],
              ["Vencidas", summary.overdueCount],
            ].map(([label, value]) => (
              <View key={String(label)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <FinanceAction label="Nova cobrança" icon="add" primary onPress={onNewCharge} />
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
                style={{
                  minHeight: 62,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flexDirection: compact ? "column" : "row",
                  alignItems: compact ? "stretch" : "center",
                  gap: compact ? 6 : 14,
                }}
              >
                <View style={{ flex: 1.1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                    {invoice?.payerName ?? "Responsável financeiro vinculado"}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
                    {invoice?.payerContact ?? "Acesso gerenciado em Gestão"}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                    {agreement.studentName}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
                    {agreement.planName}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>
                  {formatMoneyFromCents(agreement.amountCents)}
                </Text>
              </View>
            );
          })
        ) : (
          <View style={{ minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 }}>
            <GoAtletaIcon name="family" size={25} color={colors.muted} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
              Nenhum pagador vinculado
            </Text>
            <Text style={{ maxWidth: 360, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }}>
              Cadastre o responsável no atleta e depois associe um plano de mensalidade.
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
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" }}>
          Selecione uma cobrança
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }}>
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
    ["Responsável financeiro", invoice.payerName ?? "Não informado", invoice.payerContact],
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
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
            {invoice.studentName}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
            {invoice.className ?? invoice.description.replace(/^Mensalidade\s+/i, "")}
          </Text>
        </View>
        {onClose ? (
          <Pressable
            accessibilityLabel="Fechar detalhes"
            onPress={onClose}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }}
          >
            <GoAtletaIcon name="close" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ gap: 5 }}>
        <Text style={{ color: colors.text, fontSize: 22, lineHeight: 27, fontWeight: "900" }}>
          {formatMoneyFromCents(getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents))}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <PaymentStatusBadge status={invoice.status} label={operationalStatus} />
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Vencimento em {formatFinanceDate(invoice.dueDate)}
          </Text>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ gap: 13 }}>
        {detailRows.map(([label, value, supportingText]) => (
          <View key={label} style={{ gap: 3 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{label}</Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 13,
                lineHeight: 18,
                fontWeight: "700",
              }}
            >
              {value}
            </Text>
            {supportingText ? (
              <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
                {supportingText}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ gap: 8, flex: framed ? 1 : undefined }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>Histórico</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <GoAtletaIcon name="receipt" size={17} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
              Cobrança criada
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {formatFinanceDate(invoice.createdAt)}
            </Text>
          </View>
        </View>
        {invoice.paidCents > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <GoAtletaIcon name="success" size={18} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                {formatMoneyFromCents(invoice.paidCents)} recebido
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {invoice.paidAt ? formatFinanceDate(invoice.paidAt) : "Pagamento confirmado"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ flex: framed ? 1 : undefined }} />
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
          <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "900" }}>Registrar pagamento</Text>
        </Pressable>
      ) : null}
      {showReminder ? (
        <View style={{ minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <GoAtletaIcon name="communications" size={16} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}>
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
          <Text style={{ flex: 1.35, color: colors.muted, fontSize: 11, fontWeight: "800" }}>Atleta</Text>
          <Text style={{ flex: 0.9, color: colors.muted, fontSize: 11, fontWeight: "800" }}>Turma</Text>
          <Text style={{ flex: 1.45, color: colors.muted, fontSize: 11, fontWeight: "800" }}>Responsável pagador</Text>
          <View style={{ flex: 1.05, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>Vencimento</Text>
            <GoAtletaIcon name="chevronUp" size={12} color={colors.muted} />
          </View>
          <Text style={{ flex: 0.85, color: colors.muted, fontSize: 11, fontWeight: "800" }}>Valor</Text>
          <Text style={{ flex: 0.95, color: colors.muted, fontSize: 11, fontWeight: "800" }}>Status</Text>
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
              Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
            ]}
          >
            {showTable ? (
              <>
                <View style={{ width: 26, alignItems: "center", justifyContent: "center" }}>
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
                      <GoAtletaIcon name="checkmark" size={14} color={colors.primaryText} />
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={{ flex: 1.35, color: colors.text, fontSize: 12, fontWeight: "600" }}>
                  {invoice.studentName}
                </Text>
                <Text numberOfLines={1} style={{ flex: 0.9, color: colors.text, fontSize: 12 }}>
                  {invoice.className ?? invoice.description.replace(/^Mensalidade\s+/i, "")}
                </Text>
                <Text numberOfLines={1} style={{ flex: 1.45, color: colors.text, fontSize: 12 }}>
                  {invoice.payerName ?? "Não informado"}
                </Text>
                <Text numberOfLines={1} style={{ flex: 1.05, color: colors.text, fontSize: 12 }}>{formatFinanceDate(invoice.dueDate)}</Text>
                <Text numberOfLines={1} style={{ flex: 0.85, color: colors.text, fontSize: 12, fontWeight: "600" }}>
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
                <GoAtletaIcon name="ellipsisVertical" size={18} color={colors.muted} />
              </>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>{invoice.studentName}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                      {invoice.description} · vence {formatFinanceDate(invoice.dueDate)}
                    </Text>
                  </View>
                  <GoAtletaIcon name="chevronRight" size={18} color={colors.muted} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <PaymentStatusBadge
                    status={invoice.status}
                    label={getOperationalStatusLabel(invoice)}
                  />
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>{formatMoneyFromCents(invoice.amountCents)}</Text>
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
  markRender("screen.coordFinance.render.root");
  const params = useLocalSearchParams<{ designPreview?: string }>();
  const designPreview = __DEV__ && params.designPreview === "finance";
  const router = useRouter();
  const { colors } = useAppTheme();
  const responsiveLayout = useResponsiveLayout("dashboard");
  const insets = useSafeAreaInsets();
  const { activeOrganization, memberPermissions, permissionsLoading } = useOrganization();
  const organizationId = activeOrganization?.id ?? (designPreview ? "preview-organization" : "");
  const canAccess = designPreview || (activeOrganization?.role_level ?? 0) >= 50 || memberPermissions.financial === true;
  const { containerRef, onLayout, width: contentWidth } = useContainerResponsiveLayout("dashboard");
  const showDetailPanel = contentWidth >= 1060;
  const showTable = contentWidth >= 720;
  const compactHeader = responsiveLayout.tier === "mobile" || responsiveLayout.tier === "tablet";
  const monthTriggerRef = useRef<View | null>(null);
  const [monthTriggerLayout, setMonthTriggerLayout] = useState<AnchorLayout | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [serverSummary, setServerSummary] = useState<OrganizationFinanceSummary>(EMPTY_SUMMARY);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [agreements, setAgreements] = useState<TuitionAgreement[]>([]);
  const [activeSection, setActiveSection] = useState<FinanceSection>(
    designPreview ? "charges" : "overview",
  );
  const [detailInvoice, setDetailInvoice] = useState<FinanceInvoice | null>(null);
  const [mobileDetailsVisible, setMobileDetailsVisible] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<FinanceInvoice | null>(null);
  const [newChargeVisible, setNewChargeVisible] = useState(false);
  const [workspaceModal, setWorkspaceModal] = useState<FinanceWorkspaceModal>(null);
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

  const load = useCallback(
    async (refresh = false) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      if (designPreview) {
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
          () => Promise.all([
            getOrganizationFinanceDashboard(organizationId),
            listOrganizationInvoices(organizationId),
            listTuitionAgreements(organizationId),
          ]),
          { organizationId }
        );
        if (requestId !== requestIdRef.current) return;
        setServerSummary(nextSummary);
        setInvoices(nextInvoices);
        setAgreements(nextAgreements);
        setFoundationPending(false);
      } catch (loadError) {
        if (requestId !== requestIdRef.current) return;
        setServerSummary({ ...EMPTY_SUMMARY, organizationId });
        setInvoices([]);
        setAgreements([]);
        if (isMissingFinanceFoundation(loadError)) setFoundationPending(true);
        else setError("Não foi possível carregar o financeiro.");
      } finally {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canAccess, designPreview, organizationId]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requestIdRef.current += 1;
      };
    }, [load])
  );

  const monthOptions = useMemo(() => {
    const months = new Set(invoices.map(invoiceMonthKey));
    months.add(currentMonthKey());
    return Array.from(months).sort((left, right) => right.localeCompare(left));
  }, [invoices]);
  const monthlyInvoices = useMemo(
    () => invoices.filter((invoice) => invoiceMonthKey(invoice) === selectedMonth),
    [invoices, selectedMonth]
  );
  const summary = useMemo(
    () =>
      designPreview
        ? serverSummary
        : summarizeFinanceInvoices(
            monthlyInvoices,
            organizationId,
            serverSummary.activeAgreementsCount
          ),
    [designPreview, monthlyInvoices, organizationId, serverSummary]
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
          value.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
        );
      })
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  }, [filter, monthlyInvoices, query]);
  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const pageInvoices = useMemo(
    () => filteredInvoices.slice((visiblePage - 1) * pageSize, visiblePage * pageSize),
    [filteredInvoices, pageSize, visiblePage]
  );
  const visibleDetailInvoice = useMemo(
    () =>
      detailInvoice && filteredInvoices.some((invoice) => invoice.id === detailInvoice.id)
        ? detailInvoice
        : null,
    [detailInvoice, filteredInvoices]
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
    [monthlyInvoices, summary.openCount, summary.overdueCount, summary.paidCount],
  );

  const handlePaymentSuccess = useCallback(
    async (result: { studentName: string; amountCents: number }) => {
      setNotice(`${formatMoneyFromCents(result.amountCents)} registrado para ${result.studentName}.`);
      setPaymentInvoice(null);
      setMobileDetailsVisible(false);
      await load(true);
    },
    [load]
  );

  const handleInvoiceSuccess = useCallback(
    async (studentName: string) => {
      setNotice(`Cobrança de ${studentName} emitida.`);
      await load(true);
    },
    [load],
  );

  const openMonthPicker = () => {
    monthTriggerRef.current?.measureInWindow((x, y, width, height) => {
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

  const financeHeaderControls = (
    <View
      style={{
        flexDirection: "row",
        flexWrap: compactHeader ? "wrap" : "nowrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      {activeSection === "overview" || activeSection === "charges" ? (
        <View ref={monthTriggerRef} collapsable={false}>
          <Pressable
            accessibilityLabel="Selecionar mês"
            onPress={openMonthPicker}
            style={{
              minHeight: 42,
              minWidth: 172,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <GoAtletaIcon name="calendar" size={17} color={colors.muted} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: "800" }}
            >
              {formatFinanceMonthLabel(selectedMonth)}
            </Text>
            <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {activeSection === "charges" ? (
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
              <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery("")}>
                <GoAtletaIcon name="closeCircle" size={17} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <FinanceAction
            label="Filtros"
            icon="options"
            onPress={() => {
              setFilter((current) => (current === "attention" ? "all" : "attention"));
              setPage(1);
            }}
          />
        </>
      ) : null}
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <GoAtletaIcon name="lock" size={28} color={colors.muted} />
          <Text style={{ marginTop: 12, color: colors.text, fontSize: 18, fontWeight: "800" }}>Financeiro restrito</Text>
          <Text style={{ marginTop: 5, color: colors.muted, textAlign: "center" }}>
            Solicite à coordenação a permissão financeira.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Financeiro"
        subtitle={activeOrganization?.name ?? (designPreview ? "Rede Esportes Pinhais" : "Instituição")}
        onBack={() =>
          navigateBackOrReplace({ router, fallback: "/coord/dashboard" })
        }
        horizontalBleed={0}
        fadeHeight={10}
        contentStyle={{
          width: "100%",
          minWidth: 0,
          maxWidth: responsiveLayout.maxContentWidth + responsiveLayout.gutter * 2,
          alignSelf: "center",
          paddingHorizontal: responsiveLayout.gutter,
          paddingTop: Platform.OS === "web" ? 12 : 8,
          paddingBottom: 0,
          gap: 10,
        }}
        right={compactHeader ? undefined : financeHeaderControls}
      >
        {compactHeader ? financeHeaderControls : null}
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
          paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 108,
        }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primaryBg} />}
      >
        <ResponsivePage
          variant="dashboard"
          gap={Platform.OS === "web" && !responsiveLayout.isMobile ? 24 : responsiveLayout.density.pageGap}
        >
          {foundationPending ? (
            <View style={{ borderRadius: radius.container, borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningBg, padding: spacing.md, gap: 5 }}>
              <Text style={{ color: colors.warningText, fontWeight: "800" }}>Financeiro aguardando ativação</Text>
              <Text style={{ color: colors.warningText, fontSize: 13, lineHeight: 19 }}>
                A estrutura financeira ainda não está disponível neste ambiente.
              </Text>
            </View>
          ) : null}

          {notice ? (
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
              <GoAtletaIcon name="success" size={19} color={colors.successText} />
              <Text style={{ flex: 1, color: colors.successText, fontWeight: "800" }}>{notice}</Text>
            </Pressable>
          ) : null}

          {error ? (
            <Pressable onPress={() => void load()} style={{ borderRadius: radius.container, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg, padding: spacing.md }}>
              <Text style={{ color: colors.dangerText, fontWeight: "800" }}>{error} Tocar para tentar novamente.</Text>
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
                onOpenPeopleManagement={() =>
                  router.push("/coord/management" as never)
                }
              />
            </View>
          ) : activeSection === "payers" ? (
            <FinancePayersPanel
              agreements={agreements}
              invoices={monthlyInvoices}
              compact={compactHeader}
              onManagePeople={() =>
                router.push("/coord/management" as never)
              }
            />
          ) : (
            <>
              <FinanceSummaryStrip summary={summary} compact={responsiveLayout.isMobile} />
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
                        flexDirection: responsiveLayout.isMobile ? "column" : "row",
                        alignItems: responsiveLayout.isMobile ? "stretch" : "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Cobranças</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {filteredInvoices.length} de {monthlyInvoices.length} cobrança(s)
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <FinanceAction
                          label="Nova cobrança"
                          icon="add"
                          primary
                          onPress={() => setNewChargeVisible(true)}
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {filters.map(([value, label]) => {
                        const selected = filter === value;
                        return (
                          <Pressable
                            key={value}
                              onPress={() => {
                                setFilter(value);
                                setPage(1);
                              }}
                            style={{
                              minHeight: 32,
                              borderRadius: radius.card,
                              borderWidth: 1,
                              borderColor: selected ? colors.primaryBg : colors.border,
                              backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
                              paddingHorizontal: 11,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: selected ? colors.primaryText : colors.text, fontSize: 11, fontWeight: "800" }}>
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
                          <Text style={{ flex: 1, color: colors.muted, fontSize: 11 }}>
                            Mostrando {(visiblePage - 1) * pageSize + 1} a {Math.min(visiblePage * pageSize, filteredInvoices.length)} de {filteredInvoices.length} cobranças
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Pressable
                              accessibilityLabel="Página anterior"
                              disabled={visiblePage <= 1}
                              onPress={() => setPage((current) => Math.max(1, current - 1))}
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
                              <GoAtletaIcon name="chevronBack" size={16} color={colors.text} />
                            </Pressable>
                            {Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1).map((pageNumber) => (
                              <Pressable
                                key={pageNumber}
                                accessibilityLabel={`Página ${pageNumber}`}
                                onPress={() => setPage(pageNumber)}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: radius.card,
                                  borderWidth: 1,
                                  borderColor: pageNumber === visiblePage ? colors.primaryBg : "transparent",
                                  backgroundColor: pageNumber === visiblePage ? colors.successBg : "transparent",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text style={{ color: pageNumber === visiblePage ? colors.successText : colors.text, fontSize: 11, fontWeight: "800" }}>
                                  {pageNumber}
                                </Text>
                              </Pressable>
                            ))}
                            <Pressable
                              accessibilityLabel="Próxima página"
                              disabled={visiblePage >= pageCount}
                              onPress={() => setPage((current) => Math.min(pageCount, current + 1))}
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
                              <GoAtletaIcon name="chevronForward" size={16} color={colors.text} />
                            </Pressable>
                            <Pressable
                              accessibilityLabel="Alternar quantidade por página"
                              onPress={() => {
                                setPageSize((current) => (current === 12 ? 24 : 12));
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
                              <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                                {pageSize} por página
                              </Text>
                              <GoAtletaIcon name="chevronDown" size={14} color={colors.muted} />
                            </Pressable>
                          </View>
                        </View>
                      </>
                    ) : (
                      <View style={{ minHeight: 210, alignItems: "center", justifyContent: "center", gap: 7, padding: spacing.lg }}>
                        <GoAtletaIcon name="receipt" size={24} color={colors.muted} />
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" }}>Nenhuma cobrança encontrada</Text>
                        <Text style={{ maxWidth: 340, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }}>
                          Ajuste o mês ou os filtros. Para começar, cadastre um plano e vincule os atletas.
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
                      onClose={visibleDetailInvoice ? () => setDetailInvoice(null) : undefined}
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
        visible={showMonthPicker}
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
            <Text style={{ color: selectedMonth === month ? colors.primaryText : colors.text, fontSize: 12, fontWeight: "800" }}>
              {formatFinanceMonthLabel(month)}
            </Text>
          </AnchoredDropdownOption>
        ))}
      </AnchoredDropdown>

      <ModalSheet
        visible={mobileDetailsVisible && Boolean(visibleDetailInvoice) && !showDetailPanel}
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
        visible={Boolean(paymentInvoice)}
        invoice={paymentInvoice}
        organizationId={organizationId}
        canRecord={canAccess}
        onClose={() => setPaymentInvoice(null)}
        onSuccess={handlePaymentSuccess}
      />

      <NewChargeModal
        visible={newChargeVisible}
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
        visible={workspaceModal === "settings"}
        onClose={() => setWorkspaceModal(null)}
        position="center"
        cardStyle={{
          width: responsiveLayout.isMobile ? "100%" : 760,
          maxWidth: "100%",
          height: responsiveLayout.isMobile ? "94%" : "82%",
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
          onClose={() => setWorkspaceModal(null)}
        />
      </ModalSheet>
    </SafeAreaView>
  );
}
