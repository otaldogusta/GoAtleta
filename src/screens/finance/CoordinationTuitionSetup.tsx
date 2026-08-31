import { useFocusEffect, useRouter } from "expo-router";
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
  createTuitionPlan,
  issueTuitionInvoice,
  listTuitionAgreements,
  listTuitionPlans,
  type TuitionAgreement,
  type TuitionPlan,
} from "../../api/finance";
import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { SectionLoadingState } from "../../components/ui/SectionLoadingState";
import {
  formatMoneyFromCents,
  parseMoneyInputToCents,
} from "../../finance/application/finance-format";
import { canOpenFamilyAccessFromFinance } from "../../finance/application/finance-permissions";
import { markRender, measureAsync } from "../../observability/perf";
import { useOrganization } from "../../providers/OrganizationProvider";
import { radius, spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme, type ThemeColors } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";

const createTuitionSetupStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    planRow: {
      minHeight: 62,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 11,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    agreementRow: {
      minHeight: 72,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 11,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    rowContent: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      color: colors.text,
      fontWeight: "800",
    },
    rowMeta: {
      color: colors.muted,
      fontSize: 12,
    },
    planAmount: {
      color: colors.text,
      fontWeight: "900",
    },
  });

const dateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentInvoiceDates = (dueDay: number) => {
  const today = new Date();
  const month = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const due = new Date(today.getFullYear(), today.getMonth(), dueDay, 12);
  return { competenceMonth: dateOnly(month), dueDate: dateOnly(due) };
};

function CompactInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <View
        style={{
          minHeight: 50,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          justifyContent: "center",
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          style={[
            {
              minHeight: 50,
              paddingVertical: 0,
              borderWidth: 0,
              borderRadius: 0,
              color: colors.inputText,
              backgroundColor: "transparent",
            },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
          ]}
        />
      </View>
    </View>
  );
}

type CoordinationTuitionSetupProps = {
  embedded?: boolean;
  showHeader?: boolean;
  onClose?: () => void;
  onOpenPeopleManagement?: () => void;
};

export default function CoordinationTuitionSetup({
  embedded = false,
  showHeader = true,
  onClose,
  onOpenPeopleManagement,
}: CoordinationTuitionSetupProps = {}) {
  markRender("screen.coordTuitionSetup.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createTuitionSetupStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { activeOrganization, memberPermissions, permissionsLoading } =
    useOrganization();
  const organizationId = activeOrganization?.id ?? "";
  const canManageFamilyAccess = canOpenFamilyAccessFromFinance({
    roleLevel: activeOrganization?.role_level ?? 0,
    canManageStudents: memberPermissions.students === true,
    permissionsLoading,
  });
  const [plans, setPlans] = useState<TuitionPlan[]>([]);
  const [agreements, setAgreements] = useState<TuitionAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [issuingId, setIssuingId] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [description, setDescription] = useState("");
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    if (!organizationId) {
      setPlans([]);
      setAgreements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextPlans, nextAgreements] = await measureAsync(
        "screen.coordTuitionSetup.load.plans",
        () =>
          Promise.all([
            listTuitionPlans(organizationId),
            listTuitionAgreements(organizationId),
          ]),
        { organizationId },
      );
      if (request !== requestRef.current) return;
      setPlans(nextPlans);
      setAgreements(nextAgreements);
    } catch {
      if (request !== requestRef.current) return;
      setPlans([]);
      setAgreements([]);
      setMessage("A fundação financeira local ainda não foi aplicada.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [organizationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requestRef.current += 1;
      };
    }, [load]),
  );

  const parsedAmount = useMemo(() => parseMoneyInputToCents(amount), [amount]);
  const parsedDay = Number(dueDay);
  const canCreate =
    name.trim().length >= 2 &&
    parsedAmount !== null &&
    Number.isInteger(parsedDay) &&
    parsedDay >= 1 &&
    parsedDay <= 28;

  const handleCreate = async () => {
    if (!organizationId || !canCreate || parsedAmount === null || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await createTuitionPlan({
        organizationId,
        name,
        amountCents: parsedAmount,
        dueDay: parsedDay,
        description,
      });
      setName("");
      setAmount("");
      setDescription("");
      setMessage("Plano de mensalidade criado.");
      await load();
    } catch {
      setMessage("Não foi possível criar o plano.");
    } finally {
      setBusy(false);
    }
  };

  const handleIssue = async (agreement: TuitionAgreement) => {
    if (!organizationId || issuingId) return;
    setIssuingId(agreement.id);
    setMessage("");
    const dates = currentInvoiceDates(agreement.dueDay);
    try {
      await issueTuitionInvoice({
        organizationId,
        agreementId: agreement.id,
        competenceMonth: dates.competenceMonth,
        dueDate: dates.dueDate,
        description: `Mensalidade ${agreement.planName}`,
        idempotencyKey: `tuition:${agreement.id}:${dates.competenceMonth}`,
      });
      setMessage(`Mensalidade de ${agreement.studentName} emitida.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setMessage(
        /unique|idempotency/i.test(detail)
          ? "A mensalidade deste mês já foi emitida."
          : "Não foi possível emitir a mensalidade.",
      );
    } finally {
      setIssuingId("");
    }
  };

  return (
    <SafeAreaView
      edges={embedded ? [] : ["top"]}
      style={{ flex: 1, minHeight: 0, backgroundColor: embedded ? colors.card : colors.background }}
    >
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingBottom: embedded ? spacing.md : insets.bottom + 84 }}
        keyboardShouldPersistTaps="handled"
      >
        <ResponsivePage variant="dashboard" gap={spacing.md}>
          {showHeader ? (
            <ScreenPageHeader
              title="Planos e mensalidades"
              subtitle={activeOrganization?.name ?? "Instituição"}
              onBack={onClose ?? (() => router.back())}
              horizontalBleed={0}
            />
          ) : (
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                Planos e mensalidades
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Valores, vencimentos e atletas associados
              </Text>
            </View>
          )}

          {message ? (
            <Pressable
              accessibilityRole="alert"
              onPress={() => setMessage("")}
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: spacing.md,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {message}
              </Text>
            </Pressable>
          ) : null}

          <ResponsiveGrid
            columns={{ compact: "1", split: "4/8" }}
            gap={spacing.md}
          >
            <View
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              <View style={{ gap: 3 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "900",
                  }}
                >
                  Novo plano
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Valor mensal recebido pela instituição.
                </Text>
              </View>
              <CompactInput
                label="Nome"
                value={name}
                onChangeText={setName}
                placeholder="Ex.: Mensalidade vôlei"
              />
              <CompactInput
                label="Valor (R$)"
                value={amount}
                onChangeText={setAmount}
                placeholder="149,90"
                keyboardType="decimal-pad"
              />
              <CompactInput
                label="Dia do vencimento"
                value={dueDay}
                onChangeText={setDueDay}
                placeholder="10"
                keyboardType="number-pad"
              />
              <CompactInput
                label="Descrição (opcional)"
                value={description}
                onChangeText={setDescription}
                placeholder="Turmas incluídas"
              />
              <Button
                label="Criar plano"
                loading={busy}
                loadingLabel="Criando..."
                disabled={!canCreate}
                onPress={() => void handleCreate()}
              />
            </View>

            <View style={{ gap: spacing.md }}>
              <View
                style={{
                  borderRadius: radius.container,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "900",
                  }}
                >
                  Planos cadastrados
                </Text>
                {loading ? <SectionLoadingState /> : null}
                {!loading && plans.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    Nenhum plano cadastrado.
                  </Text>
                ) : null}
                {plans.map((plan) => (
                  <View
                    key={plan.id}
                    style={styles.planRow}
                  >
                    <View style={styles.rowContent}>
                      <Text
                        numberOfLines={1}
                        style={styles.rowTitle}
                      >
                        {plan.name}
                      </Text>
                      <Text style={styles.rowMeta}>
                        vence no dia {plan.dueDay}
                      </Text>
                    </View>
                    <Text style={styles.planAmount}>
                      {formatMoneyFromCents(plan.amountCents)}
                    </Text>
                  </View>
                ))}
              </View>

              <View
                style={{
                  borderRadius: radius.container,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: "900",
                      }}
                    >
                      Atletas com mensalidade
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {agreements.length} atleta(s) com mensalidade
                    </Text>
                  </View>
                  {canManageFamilyAccess ? (
                    <Button
                      label="Gerenciar responsáveis"
                      variant="outline"
                      onPress={
                        onOpenPeopleManagement ??
                        (() => router.push("/coord/management" as never))
                      }
                    />
                  ) : null}
                </View>
                {!permissionsLoading && !canManageFamilyAccess ? (
                  <View
                    accessible
                    accessibilityLabel="Permissão Alunos necessária para gerenciar vínculos"
                    style={{
                      borderRadius: radius.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      padding: spacing.sm,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <GoAtletaIcon name="lock" size={17} color={colors.muted} />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.muted,
                        fontSize: 12,
                        lineHeight: 18,
                      }}
                    >
                      Para criar convites e definir o responsável financeiro,
                      solicite a permissão Alunos a um coordenador.
                    </Text>
                  </View>
                ) : null}
                {agreements.map((agreement) => (
                  <View
                    key={agreement.id}
                    style={styles.agreementRow}
                  >
                    <View style={styles.rowContent}>
                      <Text
                        numberOfLines={1}
                        style={styles.rowTitle}
                      >
                        {agreement.studentName}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={styles.rowMeta}
                      >
                        {agreement.planName} ·{" "}
                        {formatMoneyFromCents(agreement.amountCents)}
                      </Text>
                    </View>
                    <Button
                      label="Emitir mês"
                      variant="outline"
                      loading={issuingId === agreement.id}
                      loadingLabel="Emitindo..."
                      disabled={Boolean(issuingId)}
                      onPress={() => void handleIssue(agreement)}
                    />
                  </View>
                ))}
                {!loading && agreements.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: spacing.md,
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <GoAtletaIcon
                      name="family"
                      size={24}
                      color={colors.muted}
                    />
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      Nenhum atleta vinculado
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      {canManageFamilyAccess
                        ? "Gerencie o responsável no cadastro do atleta e defina quem pode pagar."
                        : "Os vínculos são gerenciados por quem tem a permissão Alunos."}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </ResponsiveGrid>
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
