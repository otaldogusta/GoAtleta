import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  listOrganizationInvoices,
  recordManualPayment,
  type OrganizationInvoice,
} from "../../api/finance";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { SectionLoadingState } from "../../components/ui/SectionLoadingState";
import { createClientId } from "../../core/client-id";
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
  isFinancePaidDateAllowed,
  parseMoneyInputToCents,
  toFinancePaidAtIso,
} from "../../finance/application/finance-format";
import { useOrganizationAsyncIdentity } from "../../hooks/use-organization-async-identity";
import { markRender, measureAsync } from "../../observability/perf";
import { useOrganization } from "../../providers/OrganizationProvider";
import { radius, spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { ConfirmCloseOverlay } from "../../ui/ConfirmCloseOverlay";
import { DateInput } from "../../ui/DateInput";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme, type ThemeColors } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { PaymentStatusBadge } from "./components/PaymentStatusBadge";

type ManualPaymentMethod = Parameters<typeof recordManualPayment>[0]["method"];

type ManualPaymentSuccess = {
  invoiceId: string;
  studentName: string;
  amountCents: number;
};

const PAYMENT_METHODS: readonly {
  value: ManualPaymentMethod;
  label: string;
}[] = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "card", label: "Cartão" },
  { value: "cash", label: "Dinheiro" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

const createManualPaymentStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    paymentMethodOption: {
      minHeight: 38,
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    paymentMethodOptionSelected: {
      borderColor: colors.primaryBg,
      backgroundColor: colors.primaryBg,
    },
    paymentMethodOptionIdle: {
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    },
    paymentMethodLabel: {
      fontSize: 12,
      fontWeight: "800",
    },
    paymentMethodLabelSelected: {
      color: colors.primaryText,
    },
    paymentMethodLabelIdle: {
      color: colors.text,
    },
  });

const createReceivablesStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      minHeight: 96,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
    },
    rowContent: {
      flexGrow: 1,
      flexBasis: 220,
      minWidth: 0,
      gap: 4,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },
    rowMeta: {
      color: colors.muted,
      fontSize: 12,
    },
    rowPaymentMeta: {
      color: colors.muted,
      fontSize: 11,
    },
    rowSummary: {
      minWidth: 150,
      alignItems: "flex-end",
      gap: 6,
    },
    rowBalance: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    rowAction: {
      minHeight: 34,
      borderRadius: radius.full,
      backgroundColor: colors.primaryBg,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    rowActionText: {
      color: colors.primaryText,
      fontSize: 11,
      fontWeight: "900",
    },
    emptyState: {
      minHeight: 220,
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      padding: spacing.lg,
    },
    emptyTitle: {
      color: colors.text,
      fontWeight: "900",
    },
    emptyDescription: {
      color: colors.muted,
      fontSize: 13,
      textAlign: "center",
    },
  });

type ReceivablesStyles = ReturnType<typeof createReceivablesStyles>;

const todayDateOnly = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const moneyInputFromCents = (cents: number) =>
  (Math.max(0, cents) / 100).toFixed(2).replace(".", ",");

const paymentErrorMessage = (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error ?? "");
  if (/PAYMENT_EXCEEDS_BALANCE/i.test(detail)) {
    return "O saldo mudou enquanto você registrava. Atualize as cobranças e tente novamente.";
  }
  if (/INVOICE_NOT_PAYABLE/i.test(detail)) {
    return "Esta cobrança não aceita mais pagamentos.";
  }
  if (/PAYMENT_DATE_IN_FUTURE/i.test(detail)) {
    return "A data do recebimento não pode estar no futuro.";
  }
  if (/NOT_AUTHORIZED|permission|403/i.test(detail)) {
    return "Sua permissão financeira mudou. Atualize a tela antes de continuar.";
  }
  if (/record_manual_payment_v1|PGRST202|could not find the function|404/i.test(detail)) {
    return "O registro de pagamento ainda não está disponível neste ambiente.";
  }
  return "Não foi possível registrar o pagamento. Revise os dados e tente novamente.";
};

function PaymentTextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad";
  multiline?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <View
        style={{
          minHeight: multiline ? 88 : 50,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          justifyContent: multiline ? "flex-start" : "center",
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={multiline ? 500 : undefined}
          style={[
            {
              minHeight: multiline ? 86 : 50,
              paddingVertical: multiline ? 12 : 0,
              borderWidth: 0,
              borderRadius: 0,
              color: colors.inputText,
              backgroundColor: "transparent",
              textAlignVertical: multiline ? "top" : "center",
            },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
          ]}
        />
      </View>
    </View>
  );
}

export function ManualPaymentModal({
  visible,
  invoice,
  organizationId,
  canRecord,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  invoice: OrganizationInvoice | null;
  organizationId: string;
  canRecord: boolean;
  onClose: () => void;
  onSuccess: (result: ManualPaymentSuccess) => Promise<void> | void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createManualPaymentStyles(colors), [colors]);
  const {
    identity: organizationIdentity,
    identityRef: organizationIdentityRef,
  } = useOrganizationAsyncIdentity(
    organizationId,
  );
  const invoiceIdRef = useRef(invoice?.id ?? "");
  const outstandingCents = invoice
    ? getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents)
    : 0;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ManualPaymentMethod>("pix");
  const [paidDate, setPaidDate] = useState(todayDateOnly());
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [initialFingerprint, setInitialFingerprint] = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const submissionRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  useEffect(() => {
    invoiceIdRef.current = invoice?.id ?? "";
  }, [invoice]);

  useEffect(() => {
    if (!visible || !invoice) return;
    const initialAmount = moneyInputFromCents(
      getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents)
    );
    const initialDate = todayDateOnly();
    const timer = setTimeout(() => {
      setAmount(initialAmount);
      setMethod("pix");
      setPaidDate(initialDate);
      setNotes("");
      setConfirmed(false);
      setBusy(false);
      setFormError("");
      setShowCloseConfirm(false);
      setInitialFingerprint(
        JSON.stringify([initialAmount, "pix", initialDate, "", false])
      );
      submissionRef.current = null;
    }, 0);
    return () => clearTimeout(timer);
  }, [invoice, organizationIdentity, visible]);

  const currentFingerprint = JSON.stringify([
    amount,
    method,
    paidDate,
    notes,
    confirmed,
  ]);
  const dirty = Boolean(initialFingerprint) && currentFingerprint !== initialFingerprint;
  const parsedAmount = useMemo(() => parseMoneyInputToCents(amount), [amount]);
  const paidAt = useMemo(() => toFinancePaidAtIso(paidDate), [paidDate]);
  const paidDateAllowed = isFinancePaidDateAllowed(paidDate, todayDateOnly());
  const invoicePayable = invoice
    ? canRecordManualPaymentForInvoice({
        amountCents: invoice.amountCents,
        paidCents: invoice.paidCents,
        status: invoice.status,
      })
    : false;
  const amountError = !amount.trim()
    ? "Informe o valor recebido."
    : parsedAmount === null
      ? "Informe um valor válido."
      : parsedAmount > outstandingCents
        ? `O valor não pode superar o saldo de ${formatMoneyFromCents(outstandingCents)}.`
        : "";
  const canSubmit = Boolean(
    invoice &&
      organizationId &&
      canRecord &&
      invoicePayable &&
      parsedAmount !== null &&
      parsedAmount <= outstandingCents &&
      paidAt &&
      paidDateAllowed &&
      confirmed &&
      !busy
  );

  const clearFormError = () => {
    if (formError) setFormError("");
  };

  const requestClose = () => {
    if (busy) return;
    if (dirty) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    const identity = captureOrganizationAsyncIdentity(
      organizationIdentityRef.current,
      organizationIdentity,
    );
    if (!identity || !invoice || !canSubmit || parsedAmount === null || !paidAt)
      return;
    const submittedInvoice = invoice;
    const payloadFingerprint = JSON.stringify([
      submittedInvoice.id,
      parsedAmount,
      method,
      paidAt,
      notes.trim(),
    ]);
    if (submissionRef.current?.fingerprint !== payloadFingerprint) {
      submissionRef.current = {
        fingerprint: payloadFingerprint,
        idempotencyKey: createClientId(),
      };
    }

    setBusy(true);
    setFormError("");
    try {
      await recordManualPayment({
        organizationId,
        invoiceId: submittedInvoice.id,
        amountCents: parsedAmount,
        method,
        paidAt,
        notes,
        idempotencyKey: submissionRef.current.idempotencyKey,
      });
      if (
        invoiceIdRef.current !== submittedInvoice.id ||
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
      await onSuccess({
        invoiceId: submittedInvoice.id,
        studentName: submittedInvoice.studentName,
        amountCents: parsedAmount,
      });
      if (
        invoiceIdRef.current !== submittedInvoice.id ||
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
      submissionRef.current = null;
      onClose();
    } catch (error) {
      if (
        invoiceIdRef.current !== submittedInvoice.id ||
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
      setFormError(paymentErrorMessage(error));
    } finally {
      if (
        invoiceIdRef.current === submittedInvoice.id &&
        isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      ) {
        setBusy(false);
      }
    }
  };

  return (
    <>
      <ModalSheet
        visible={visible}
        onClose={requestClose}
        position="center"
        cardStyle={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "92%",
          borderRadius: radius.container,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%", maxHeight: "100%" }}
        >
          <View
            style={{
              minHeight: 68,
              paddingHorizontal: spacing.md,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
                Registrar pagamento
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                {invoice?.studentName ?? "Cobrança"}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar registro de pagamento"
              onPress={requestClose}
              disabled={busy}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.55 : 1,
              }}
            >
              <GoAtletaIcon name="close" size={21} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                padding: spacing.md,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.md,
              }}
            >
              <View style={{ flexGrow: 1, minWidth: 130, gap: 3 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Saldo</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
                  {formatMoneyFromCents(outstandingCents)}
                </Text>
              </View>
              <View style={{ flexGrow: 1, minWidth: 170, gap: 3 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Cobrança</Text>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                  Total {formatMoneyFromCents(invoice?.amountCents ?? 0)} · pago {formatMoneyFromCents(invoice?.paidCents ?? 0)}
                </Text>
              </View>
            </View>

            <PaymentTextField
              label="Valor recebido (R$)"
              value={amount}
              onChangeText={(value) => {
                setAmount(value);
                clearFormError();
              }}
              placeholder="0,00"
              keyboardType="decimal-pad"
            />
            {amountError && amount.trim() ? (
              <Text accessibilityRole="alert" style={{ marginTop: -10, color: colors.dangerText, fontSize: 12, fontWeight: "700" }}>
                {amountError}
              </Text>
            ) : null}

            <View style={{ gap: 7 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>Forma de recebimento</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {PAYMENT_METHODS.map((option) => {
                  const selected = method === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        setMethod(option.value);
                        clearFormError();
                      }}
                      style={[
                        styles.paymentMethodOption,
                        selected
                          ? styles.paymentMethodOptionSelected
                          : styles.paymentMethodOptionIdle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.paymentMethodLabel,
                          selected
                            ? styles.paymentMethodLabelSelected
                            : styles.paymentMethodLabelIdle,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>Data do recebimento</Text>
              <DateInput
                value={paidDate}
                onChange={(value) => {
                  setPaidDate(value);
                  clearFormError();
                }}
                placeholder="DD/MM/AAAA"
                invalid={!paidAt || !paidDateAllowed}
              />
              {paidAt && !paidDateAllowed ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.dangerText, fontSize: 12, fontWeight: "700" }}
                >
                  A data do recebimento não pode estar no futuro.
                </Text>
              ) : null}
            </View>

            <PaymentTextField
              label="Observação (opcional)"
              value={notes}
              onChangeText={(value) => {
                setNotes(value);
                clearFormError();
              }}
              placeholder="Ex.: recebido pela secretaria"
              multiline
            />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
              onPress={() => {
                setConfirmed((current) => !current);
                clearFormError();
              }}
              style={{
                minHeight: 52,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: confirmed ? colors.successBorder : colors.border,
                backgroundColor: confirmed ? colors.successBg : colors.inputBg,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: confirmed ? colors.success : colors.border,
                  backgroundColor: confirmed ? colors.success : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {confirmed ? <GoAtletaIcon name="checkmark" size={16} color={colors.primaryText} /> : null}
              </View>
              <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" }}>
                Confirmo que este valor já foi recebido pela instituição.
              </Text>
            </Pressable>

            {formError ? (
              <View
                accessibilityRole="alert"
                style={{
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.dangerBorder,
                  backgroundColor: colors.dangerBg,
                  padding: 12,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <GoAtletaIcon name="warningCircle" size={18} color={colors.dangerText} />
                <Text style={{ flex: 1, color: colors.dangerText, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>
                  {formError}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={{
              padding: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: "row",
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Button label="Cancelar" variant="outline" onPress={requestClose} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Registrar pagamento"
                loadingLabel="Registrando..."
                onPress={() => void handleSubmit()}
                disabled={!canSubmit}
                loading={busy}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </ModalSheet>

      <ConfirmCloseOverlay
        visible={showCloseConfirm}
        title="Sair sem registrar?"
        message="Os dados deste pagamento serão descartados."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        onConfirm={() => {
          setShowCloseConfirm(false);
          onClose();
        }}
        onCancel={() => setShowCloseConfirm(false)}
      />
    </>
  );
}

function ReceivableRow({
  invoice,
  onRecord,
  styles,
}: {
  invoice: OrganizationInvoice;
  onRecord: (invoice: OrganizationInvoice) => void;
  styles: ReceivablesStyles;
}) {
  const outstandingCents = getInvoiceOutstandingCents(
    invoice.amountCents,
    invoice.paidCents
  );
  const canRecord = canRecordManualPaymentForInvoice({
    amountCents: invoice.amountCents,
    paidCents: invoice.paidCents,
    status: invoice.status,
  });

  return (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {invoice.studentName}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {invoice.description} · {formatFinanceDate(invoice.dueDate)}
        </Text>
        {invoice.paidCents > 0 ? (
          <Text style={styles.rowPaymentMeta}>
            Total {formatMoneyFromCents(invoice.amountCents)} · pago {formatMoneyFromCents(invoice.paidCents)}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowSummary}>
        <Text style={styles.rowBalance}>
          Saldo {formatMoneyFromCents(outstandingCents)}
        </Text>
        <PaymentStatusBadge status={invoice.status} />
        {canRecord ? (
          <Pressable
            accessibilityLabel={`Registrar pagamento de ${invoice.studentName}`}
            onPress={() => onRecord(invoice)}
            style={styles.rowAction}
          >
            <Text style={styles.rowActionText}>
              Registrar pagamento
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function CoordinationReceivables() {
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id ?? "";

  return <CoordinationReceivablesOrganizationScope key={organizationId} />;
}

function CoordinationReceivablesOrganizationScope() {
  markRender("screen.coordReceivables.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createReceivablesStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { activeOrganization, memberPermissions, permissionsLoading } = useOrganization();
  const organizationId = activeOrganization?.id ?? "";
  const {
    identity: organizationIdentity,
    identityRef: organizationIdentityRef,
  } = useOrganizationAsyncIdentity(
    organizationId,
  );
  const canAccess =
    (activeOrganization?.role_level ?? 0) >= 50 || memberPermissions.financial === true;
  const [rows, setRows] = useState<OrganizationInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<OrganizationInvoice | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const [dataIdentity, setDataIdentity] =
    useState<OrganizationAsyncIdentity | null>(null);
  const dataIsCurrent = Boolean(
    dataIdentity &&
      isOrganizationAsyncIdentityCurrent(
        organizationIdentity,
        dataIdentity,
      ),
  );
  const scopedRows = dataIsCurrent ? rows : [];
  const scopedSelectedInvoice = dataIsCurrent ? selectedInvoice : null;
  const scopedNotice = dataIsCurrent ? notice : "";
  const scopedError = dataIsCurrent ? error : "";

  const load = useCallback(async () => {
    const identity = captureOrganizationAsyncIdentity(
      organizationIdentityRef.current,
      organizationIdentity,
    );
    if (!identity) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    if (!organizationId || !canAccess) {
      setDataIdentity(identity);
      setRows([]);
      setSelectedInvoice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await measureAsync(
        "screen.coordReceivables.load.invoices",
        () => listOrganizationInvoices(organizationId),
        { organizationId },
      );
      if (
        request !== requestRef.current ||
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
      setDataIdentity(identity);
      setRows(next);
      setSelectedInvoice((current) =>
        current && next.some((invoice) => invoice.id === current.id)
          ? current
          : null,
      );
    } catch {
      if (
        request !== requestRef.current ||
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
      setDataIdentity(identity);
      setRows([]);
      setSelectedInvoice(null);
      setError("Cobranças indisponíveis até a fundação financeira ser aplicada.");
    } finally {
      if (
        request === requestRef.current &&
        isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      ) {
        setLoading(false);
      }
    }
  }, [
    canAccess,
    organizationId,
    organizationIdentity,
    organizationIdentityRef,
  ]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requestRef.current += 1;
      };
    }, [load])
  );

  const handlePaymentSuccess = useCallback(
    async (result: ManualPaymentSuccess) => {
      const identity = captureOrganizationAsyncIdentity(
        organizationIdentityRef.current,
        organizationIdentity,
      );
      if (!identity) return;
      setNotice(
        `${formatMoneyFromCents(result.amountCents)} registrado para ${result.studentName}.`
      );
      setSelectedInvoice(null);
      await load();
      if (
        !isOrganizationAsyncIdentityCurrent(
          organizationIdentityRef.current,
          identity,
        )
      )
        return;
    },
    [load, organizationIdentity, organizationIdentityRef]
  );

  if (!permissionsLoading && !canAccess) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <GoAtletaIcon name="lock" size={28} color={colors.muted} />
          <Text style={{ marginTop: 12, color: colors.text, fontSize: 18, fontWeight: "800" }}>
            Financeiro restrito
          </Text>
          <Text style={{ marginTop: 5, color: colors.muted, textAlign: "center" }}>
            Solicite à coordenação a permissão financeira.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <ResponsivePage variant="dashboard" gap={spacing.md}>
          <ScreenPageHeader
            title="Cobranças"
            subtitle={`${scopedRows.length} título(s)`}
            onBack={() => router.back()}
            horizontalBleed={0}
          />
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
              <GoAtletaIcon name="success" size={19} color={colors.successText} />
              <Text style={{ flex: 1, color: colors.successText, fontWeight: "800" }}>{scopedNotice}</Text>
            </Pressable>
          ) : null}
          {loading ? <SectionLoadingState /> : null}
          {scopedError ? (
            <Pressable
              onPress={() => void load()}
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.warningBorder,
                backgroundColor: colors.warningBg,
                padding: spacing.md,
              }}
            >
              <Text style={{ color: colors.warningText, fontWeight: "800" }}>{scopedError}</Text>
            </Pressable>
          ) : null}
          {!loading && !scopedError ? (
            <View style={{ borderRadius: radius.container, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: "hidden" }}>
              {scopedRows.length ? (
                scopedRows.map((invoice) => (
                  <ReceivableRow
                    key={invoice.id}
                    invoice={invoice}
                    onRecord={setSelectedInvoice}
                    styles={styles}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <GoAtletaIcon name="document" size={28} color={colors.muted} />
                  <Text style={styles.emptyTitle}>Nenhuma cobrança emitida</Text>
                  <Text style={styles.emptyDescription}>
                    Os títulos aparecem aqui depois que um plano é vinculado ao atleta.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </ResponsivePage>
      </ScrollView>

      <ManualPaymentModal
        visible={dataIsCurrent && Boolean(scopedSelectedInvoice)}
        invoice={scopedSelectedInvoice}
        organizationId={organizationId}
        canRecord={canAccess}
        onClose={() => setSelectedInvoice(null)}
        onSuccess={handlePaymentSuccess}
      />
    </SafeAreaView>
  );
}
