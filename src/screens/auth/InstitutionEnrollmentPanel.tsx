import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { InstitutionPlanCatalog, InstitutionPlanRequestReview } from "../../access/components/InstitutionPlanPicker";
import { listDiscoverableFamilyPlanOffers, requestFamilyEnrollment, type FamilyPlanOffer } from "../../api/family-plans";
import { familyAccessErrorMessage, type FamilyAccessRequestInput } from "../../api/family-access-request";
import { SectionLoadingState } from "../../components/ui/SectionLoadingState";
import { createProfileRequestId } from "../../core/profile-request-id";
import { radius, spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useAppTheme } from "../../ui/app-theme";

export function InstitutionEnrollmentPanel({ institutionName, request, onBack, onSent }: {
  institutionName: string;
  request: FamilyAccessRequestInput;
  onBack: () => void;
  onSent: (id?: string) => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();
  const [attempt, setAttempt] = useState(0);
  const [offers, setOffers] = useState<FamilyPlanOffer[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<FamilyPlanOffer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const mounted = useRef(false);
  const submitting = useRef(false);
  const requestKeys = useRef(new Map<string, string>());

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const assertCurrent = () => {
      if (!active || !mounted.current) throw new Error("A instituição mudou.");
    };
    void listDiscoverableFamilyPlanOffers(request.organizationId, assertCurrent)
      .then(result => { if (active) setOffers(result); })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [request.organizationId, attempt]);

  const reloadOffers = () => {
    setOffers(null);
    setLoadFailed(false);
    setAttempt(previous => previous + 1);
  };

  const submit = async () => {
    if (!selected || submitting.current || sent) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const termsKey = JSON.stringify([selected.offer_id, selected.amount_cents, selected.billing_day]);
    const idempotencyKey = requestKeys.current.get(termsKey) ?? createProfileRequestId();
    requestKeys.current.set(termsKey, idempotencyKey);
    try {
      const receipt = await requestFamilyEnrollment(request, selected, idempotencyKey, () => {
        if (!mounted.current) throw new Error("A instituição mudou.");
      });
      if (!mounted.current) return;
      if (!receipt) throw new Error("O servidor não confirmou a solicitação.");
      setSent(true);
      await onSent(receipt);
    } catch (cause) {
      if (!mounted.current) return;
      const message = cause instanceof Error ? cause.message : "";
      if (/FAMILY_PLAN_TERMS_CHANGED|FAMILY_PLAN_UNAVAILABLE/.test(message)) {
        setError("A oferta mudou. Confira os planos disponíveis.");
        setSelected(null);
        reloadOffers();
      } else if (message.includes("FAMILY_ENROLLMENT_ALREADY_REQUESTED")) {
        setError("Já existe uma inscrição solicitada para esta instituição.");
        await onSent();
      } else {
        setError(familyAccessErrorMessage(cause));
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <View style={{ width: "100%", gap: spacing.sm, padding: spacing.md, borderRadius: radius.container,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      {sent ? (
        <>
          <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "800" }}>Inscrição solicitada</Text>
          <Text style={{ color: colors.muted }}>A instituição vai analisar a solicitação.</Text>
          <Button label="Atualizar status" loading={busy} variant="ghost" onPress={() => void onSent()} />
        </>
      ) : selected ? (
        <InstitutionPlanRequestReview institutionName={institutionName} athleteName={request.studentName}
          offer={selected} busy={busy} error={error} onBack={() => { setSelected(null); setError(""); }}
          onSubmit={() => void submit()} />
      ) : (
        <>
          {error || loadFailed ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>
            {loadFailed ? "Não foi possível carregar os planos." : error}
          </Text> : null}
          {!offers ? (
            <>
              <Button label="Instituições" variant="ghost" onPress={onBack} />
              {loadFailed ? <Button label="Tentar novamente" variant="outline" onPress={reloadOffers} /> : <SectionLoadingState />}
            </>
          ) : (
            <InstitutionPlanCatalog institutionName={institutionName} offers={offers} onBack={onBack}
              contentHeight={Math.min(610, Math.max(325, height - 98))}
              onSelect={(offerId) => {
                setError("");
                setSelected(offers.find(offer => offer.offer_id === offerId) ?? null);
              }} />
          )}
        </>
      )}
    </View>
  );
}
