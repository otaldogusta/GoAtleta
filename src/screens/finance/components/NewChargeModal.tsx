import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  issueTuitionInvoice,
  listTuitionAgreements,
  type TuitionAgreement,
} from "../../../api/finance";
import { SectionLoadingState } from "../../../components/ui/SectionLoadingState";
import { formatMoneyFromCents } from "../../../finance/application/finance-format";
import { radius, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useResponsiveLayout } from "../../../ui/use-responsive-layout";

const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const value = new Date(year, Math.max(0, (month || 1) - 1), 1, 12);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(value);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const invoiceDates = (monthKey: string, dueDay: number) => ({
  competenceMonth: `${monthKey}-01`,
  dueDate: `${monthKey}-${String(Math.max(1, Math.min(28, dueDay))).padStart(2, "0")}`,
});

type NewChargeModalProps = {
  visible: boolean;
  organizationId: string;
  competenceMonth: string;
  onClose: () => void;
  onOpenPlans: () => void;
  onSuccess: (studentName: string) => void;
};

export function NewChargeModal({
  visible,
  organizationId,
  competenceMonth,
  onClose,
  onOpenPlans,
  onSuccess,
}: NewChargeModalProps) {
  const { colors } = useAppTheme();
  const responsiveLayout = useResponsiveLayout();
  const compact = responsiveLayout.isMobile;
  const [agreements, setAgreements] = useState<TuitionAgreement[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- Opening the modal resets its local selection while synchronizing remote agreements. */
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setSelectedId("");
    setError("");
    if (!organizationId) {
      setAgreements([]);
      setError("Selecione uma instituição para emitir a cobrança.");
      return;
    }
    setLoading(true);
    void listTuitionAgreements(organizationId)
      .then((rows) => {
        if (!active) return;
        setAgreements(rows.filter((agreement) => agreement.status === "active"));
      })
      .catch(() => {
        if (!active) return;
        setAgreements([]);
        setError("Não foi possível carregar os vínculos financeiros.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedAgreement = useMemo(
    () => agreements.find((agreement) => agreement.id === selectedId) ?? null,
    [agreements, selectedId],
  );

  const handleIssue = async () => {
    if (!selectedAgreement || busy) return;
    const dates = invoiceDates(competenceMonth, selectedAgreement.dueDay);
    setBusy(true);
    setError("");
    try {
      await issueTuitionInvoice({
        organizationId,
        agreementId: selectedAgreement.id,
        competenceMonth: dates.competenceMonth,
        dueDate: dates.dueDate,
        description: `Mensalidade ${selectedAgreement.planName}`,
        idempotencyKey: `tuition:${selectedAgreement.id}:${dates.competenceMonth}`,
      });
      onSuccess(selectedAgreement.studentName);
      onClose();
    } catch (issueError) {
      const detail = issueError instanceof Error ? issueError.message : "";
      setError(
        /unique|idempotency/i.test(detail)
          ? "A cobrança deste mês já foi emitida para este atleta."
          : "Não foi possível emitir a cobrança.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      cardStyle={{
        width: compact ? "100%" : 640,
        maxWidth: "100%",
        maxHeight: "88%",
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        overflow: "hidden",
        padding: 0,
      }}
    >
      <View
        style={{
          minHeight: 64,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
            Nova cobrança
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
            Emitir mensalidade de {monthLabel(competenceMonth)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Fechar nova cobrança"
          onPress={onClose}
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}
        >
          <GoAtletaIcon name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView
        style={{ minHeight: 0 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
            Escolha o atleta
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            Apenas atletas com plano e responsável financeiro vinculados aparecem aqui.
          </Text>
        </View>

        {loading ? <SectionLoadingState /> : null}

        {!loading && agreements.length === 0 ? (
          <View
            style={{
              minHeight: 150,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              padding: spacing.md,
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
            }}
          >
            <GoAtletaIcon name="paymentCard" size={24} color={colors.muted} />
            <Text style={{ color: colors.text, fontWeight: "900" }}>Nenhum vínculo ativo</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }}>
              Cadastre um plano e vincule o atleta antes de emitir a primeira cobrança.
            </Text>
            <Button label="Abrir planos e mensalidades" variant="outline" onPress={onOpenPlans} />
          </View>
        ) : null}

        {!loading
          ? agreements.map((agreement) => {
              const selected = agreement.id === selectedId;
              return (
                <Pressable
                  key={agreement.id}
                  accessibilityLabel={`Selecionar ${agreement.studentName}`}
                  onPress={() => setSelectedId(agreement.id)}
                  style={{
                    minHeight: 58,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: selected ? colors.success : colors.border,
                    backgroundColor: selected ? colors.successBg : colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: selected ? 0 : 1,
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.success : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selected ? <GoAtletaIcon name="checkmark" size={14} color={colors.primaryText} /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                      {agreement.studentName}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                      {agreement.planName} · vence dia {agreement.dueDay}
                    </Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>
                    {formatMoneyFromCents(agreement.amountCents)}
                  </Text>
                </Pressable>
              );
            })
          : null}

        {error ? (
          <View
            accessibilityRole="alert"
            style={{
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.dangerBorder,
              backgroundColor: colors.dangerBg,
              padding: 11,
            }}
          >
            <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: "800" }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {agreements.length ? (
        <View style={{ padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button
            label="Emitir cobrança"
            loading={busy}
            loadingLabel="Emitindo..."
            disabled={!selectedAgreement || busy}
            onPress={() => void handleIssue()}
          />
        </View>
      ) : null}
    </ModalSheet>
  );
}
