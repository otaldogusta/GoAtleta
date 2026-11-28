import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";

import {
  listOrganizationFamilyPlans,
  publishOrganizationFamilyPlan,
  reviewOrganizationFamilyPlan,
  setOrganizationFamilyPlanDiscoverable,
  unpublishOrganizationFamilyPlan,
  type OrganizationFamilyPlanRequest,
  type OrganizationFamilyPlans,
  type OrganizationFamilyPlanOffer,
} from "../../api/family-plans";
import type { TuitionPlan } from "../../api/finance";
import { SectionLoadingState } from "../../components/ui/SectionLoadingState";
import { assertSessionIdentity, getSessionIdentity } from "../../auth/session";
import { isOrganizationAsyncIdentityCurrent } from "../../core/organization-async-identity";
import { familyPlanKindLabel, familyPlanStatusLabel, formatFamilyPlanTerms } from "../../finance/application/family-plans";
import { formatMoneyFromCents, parseMoneyInputToCents } from "../../finance/application/finance-format";
import { useOrganizationAsyncIdentity } from "../../hooks/use-organization-async-identity";
import { compactUiMetrics, radius, spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useAppTheme } from "../../ui/app-theme";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { FinanceCompactInput } from "./FinanceCompactInput";

function FamilyPlanRow({ title, subtitle, actionsBelow = false, children }: {
  title: string;
  subtitle: string;
  actionsBelow?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{
      gap: spacing.sm,
      flexDirection: actionsBelow ? "column" : "row",
      flexWrap: actionsBelow ? "nowrap" : "wrap",
      alignItems: actionsBelow ? "flex-start" : "center",
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    }}>
      <View style={[
        { minWidth: 0, gap: spacing.xs },
        actionsBelow ? { alignSelf: "stretch" } : { flexGrow: 1, flexShrink: 1, flexBasis: 150 },
      ]}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: compactUiMetrics.metadataFontSize }}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

function reviewErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("FAMILY_PLAN_ACTIVE_AGREEMENT_EXISTS")) return "O atleta já tem uma mensalidade ativa.";
  if (message.includes("FAMILY_PLAN_PAYER_INELIGIBLE")) return "O vínculo do responsável perdeu a permissão financeira.";
  if (message.includes("FAMILY_PLAN_UNAVAILABLE")) return "O plano não está mais disponível para adesão.";
  if (message.includes("FAMILY_PLAN_ALREADY_REVIEWED")) return "Esta solicitação já foi revisada. Atualize a lista.";
  return "Não foi possível registrar a decisão. Tente novamente.";
}

export function CoordinationFamilyPlans({ organizationId, plans, onAgreementActivated }: {
  organizationId: string;
  plans: TuitionPlan[];
  onAgreementActivated: () => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const { confirm } = useConfirmDialog();
  const { identity, identityRef } = useOrganizationAsyncIdentity(organizationId);
  const [data, setData] = useState<OrganizationFamilyPlans | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [enrollmentName, setEnrollmentName] = useState("");
  const [amount, setAmount] = useState("");
  const requestVersion = useRef(0);
  const inFlight = useRef(false);

  const assertOrganization = useCallback(() => {
    if (!isOrganizationAsyncIdentityCurrent(identityRef.current, identity))
      throw new Error("A instituição mudou. Abra novamente a operação.");
  }, [identity, identityRef]);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setFailed(false);
    try {
      const result = await listOrganizationFamilyPlans(organizationId, assertOrganization);
      if (version === requestVersion.current) setData(result);
    } catch {
      if (version === requestVersion.current && isOrganizationAsyncIdentityCurrent(identityRef.current, identity)) {
        setData(null);
        setFailed(true);
      }
    }
  }, [assertOrganization, organizationId, identity, identityRef]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]));

  const updatePublication = async (operation: () => Promise<unknown>, afterSave?: () => void) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      await operation();
      assertOrganization();
      afterSave?.();
      await load();
    } catch {
      if (isOrganizationAsyncIdentityCurrent(identityRef.current, identity))
        setMessage("Não foi possível alterar a oferta. Tente novamente.");
    } finally {
      inFlight.current = false;
      if (isOrganizationAsyncIdentityCurrent(identityRef.current, identity)) setBusy(false);
    }
  };

  const review = (request: OrganizationFamilyPlanRequest, accept: boolean) => {
    const currentSession = getSessionIdentity();
    const confirmLabel = accept ? "Aceitar" : "Recusar";
    void confirm({
      title: `${confirmLabel} solicitação`,
      message: `${request.student_name} · ${request.offer_name}. ${formatFamilyPlanTerms(request.amount_cents, request.billing_day)}. ${
        accept ? (request.kind === "monthly" ? "A aceitação ativa o acordo mensal." : "A decisão ficará visível para o responsável.") : "A decisão ficará visível para o responsável."
      }`,
      confirmLabel,
      cancelLabel: "Cancelar",
      tone: accept ? "default" : "danger",
      onConfirm: async () => {
        try {
          assertSessionIdentity(currentSession);
          await reviewOrganizationFamilyPlan(organizationId, request.request_id, accept, assertOrganization);
          await load();
          if (accept && request.kind === "monthly") await onAgreementActivated();
        } catch (error) {
          throw new Error(reviewErrorMessage(error));
        }
      },
    });
  };

  const parsedAmount = parseMoneyInputToCents(amount);
  const normalizedName = enrollmentName.trim();
  const canPublishEnrollment = normalizedName.length >= 2 && normalizedName.length <= 120 &&
    parsedAmount !== null && parsedAmount <= 99999999999;
  const publishedEnrollment = data?.offers.filter(offer => offer.kind === "enrollment" && offer.published) ?? [];
  const monthlyPlans = plans.filter(plan => plan.active);
  const accessStatus = { pending: "Vínculo em análise", approved: "Vínculo aprovado", rejected: "Vínculo recusado" } as const;
  const discoveryAction = (offer: OrganizationFamilyPlanOffer) => (
    <Button label={offer.discoverable ? "Tirar da inscrição" : "Mostrar na inscrição"} variant="outline" disabled={busy}
      onPress={() => void updatePublication(() =>
        setOrganizationFamilyPlanDiscoverable(organizationId, offer.offer_id, !offer.discoverable, assertOrganization))} />
  );

  return (
    <View style={{ borderRadius: radius.container, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: spacing.md, gap: spacing.md }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: compactUiMetrics.titleFontSize, fontWeight: "900" }}>Planos para famílias</Text>
      {failed ? (
        <>
          <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>Não foi possível carregar as ofertas e solicitações.</Text>
          <Button label="Tentar novamente" variant="outline" onPress={() => void load()} />
        </>
      ) : !data ? <SectionLoadingState /> : (
        <>
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Mensalidades</Text>
            {!monthlyPlans.length ? <Text style={{ color: colors.muted }}>Cadastre um plano para publicar.</Text> : null}
            {monthlyPlans.map(plan => {
              const offer = data.offers.find(item => item.tuition_plan_id === plan.id && item.published);
              return (
                <FamilyPlanRow key={plan.id} title={plan.name} subtitle={formatFamilyPlanTerms(plan.amountCents, plan.dueDay)}>
                  <Button
                    label={offer ? "Ocultar" : "Publicar"}
                    variant="outline"
                    disabled={busy}
                    onPress={() => void updatePublication(() => offer
                      ? unpublishOrganizationFamilyPlan(organizationId, offer.offer_id, assertOrganization)
                      : publishOrganizationFamilyPlan(organizationId, { tuitionPlanId: plan.id }, assertOrganization))}
                  />
                  {offer ? discoveryAction(offer) : null}
                </FamilyPlanRow>
              );
            })}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Matrículas</Text>
            {publishedEnrollment.map(offer => (
              <FamilyPlanRow key={offer.offer_id} title={offer.name} subtitle={`${formatMoneyFromCents(offer.amount_cents)} · valor único`}>
                <Button label="Ocultar" variant="outline" disabled={busy}
                  onPress={() => void updatePublication(() => unpublishOrganizationFamilyPlan(organizationId, offer.offer_id, assertOrganization))} />
                {discoveryAction(offer)}
              </FamilyPlanRow>
            ))}
            <FinanceCompactInput label="Nome da oferta de matrícula" value={enrollmentName} onChangeText={setEnrollmentName} placeholder="Ex.: Matrícula vôlei" />
            <FinanceCompactInput label="Valor único (R$)" value={amount} onChangeText={setAmount} placeholder="99,90" keyboardType="decimal-pad" />
            <Button label="Publicar matrícula" disabled={busy || !canPublishEnrollment} onPress={() => {
              if (parsedAmount === null || !canPublishEnrollment) return;
              void updatePublication(
                () => publishOrganizationFamilyPlan(organizationId, { enrollmentName: normalizedName, amountCents: parsedAmount }, assertOrganization),
                () => { setEnrollmentName(""); setAmount(""); },
              );
            }} />
          </View>

          {message ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{message}</Text> : null}
          {data.enrollments?.length ? (
            <View style={{ gap: spacing.sm }}>
              <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "800" }}>Inscrições pela busca de instituições</Text>
              {data.enrollments.map(enrollment => (
                <FamilyPlanRow key={enrollment.request_id} title={enrollment.student_name}
                  subtitle={`${familyPlanKindLabel[enrollment.kind]} · ${enrollment.name} · ${formatFamilyPlanTerms(enrollment.amount_cents, enrollment.billing_day)} · ${accessStatus[enrollment.access_status]}`} />
              ))}
            </View>
          ) : null}
          <View style={{ gap: spacing.sm }}>
            <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "800" }}>Solicitações das famílias</Text>
            {!data.requests.length ? <Text style={{ color: colors.muted }}>Nenhuma solicitação recebida.</Text> : null}
            {data.requests.map(request => (
              <FamilyPlanRow
                key={request.request_id}
                title={request.student_name}
                subtitle={`${familyPlanKindLabel[request.kind]} · ${request.offer_name} · ${formatFamilyPlanTerms(request.amount_cents, request.billing_day)} · ${familyPlanStatusLabel[request.status]}`}
                actionsBelow
              >
                {request.status === "pending" ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                    <Button label="Recusar" variant="outline" onPress={() => review(request, false)} />
                    <Button label="Aceitar" onPress={() => review(request, true)} />
                  </View>
                ) : null}
              </FamilyPlanRow>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
