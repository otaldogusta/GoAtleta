import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { InstitutionPlanCatalog, InstitutionPlanRequestReview } from "../../access/components/InstitutionPlanPicker";
import { listMyFamilyPlanOffers, requestMyFamilyPlan, type FamilyPlanOffer } from "../../api/family-plans";
import { SectionLoadingState } from "../../components/ui/SectionLoadingState";
import { familyPlanKindLabel, familyPlanStatusLabel, formatFamilyPlanTerms } from "../../finance/application/family-plans";
import { compactUiMetrics as metrics, radius } from "../../theme/tokens";
import { ModalSheet } from "../../ui/ModalSheet";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useAppTheme } from "../../ui/app-theme";
import { FamilyButton, FamilySurface } from "./FamilyUi";

export function FamilyPlansPanel({ relationshipId, studentName, institutionName, padding }: {
  relationshipId: string;
  studentName: string;
  institutionName: string;
  padding: number;
}) {
  const { colors } = useAppTheme();
  const [offers, setOffers] = useState<FamilyPlanOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FamilyPlanOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const operation = useRef<symbol | null>(null);
  const saveInFlight = useRef(false);
  const requestVersion = useRef(0);
  useLayoutEffect(() => {
    operation.current = Symbol();
    return () => { operation.current = null; };
  }, []);

  const load = useCallback(async (keepLatestOnTransientFailure = false) => {
    const scope = operation.current;
    const version = ++requestVersion.current;
    const isCurrent = () => Boolean(scope && scope === operation.current && version === requestVersion.current);
    setLoading(true);
    setFailed(false);
    try {
      const result = await listMyFamilyPlanOffers(relationshipId, () => {
        if (!isCurrent()) throw new Error("Family plan selection changed");
      });
      if (isCurrent()) setOffers(result);
    } catch (error) {
      if (isCurrent()) {
        const message = error instanceof Error ? error.message : "";
        const scopeLost = /FAMILY_PLAN_NOT_AUTHORIZED|42501|Missing auth token|JWT|sessão mudou/i.test(message);
        if (!keepLatestOnTransientFailure || scopeLost) setOffers([]);
        setFailed(true);
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [relationshipId]);

  useEffect(() => {
    const initialLoad = setTimeout(() => void load(), 0);
    return () => clearTimeout(initialLoad);
  }, [load]);

  const requestPlan = async () => {
    if (!selected || saveInFlight.current) return;
    const scope = operation.current;
    saveInFlight.current = true;
    setSubmitting(true);
    setSaveError("");
    try {
      await requestMyFamilyPlan(relationshipId, selected, () => {
        if (!scope || operation.current !== scope) throw new Error("Family plan selection changed");
      });
      if (operation.current !== scope) return;
      // Keep the new status visible even if the follow-up read needs a retry.
      setOffers(list => list.map(offer => offer.offer_id === selected.offer_id ? { ...offer, status: "pending" } : offer));
      setSelected(null);
      setOpen(false);
      void load(true);
    } catch (error) {
      if (operation.current !== scope) return;
      const message = error instanceof Error ? error.message : "";
      if (message.includes("FAMILY_PLAN_ACTIVE_AGREEMENT_EXISTS")) {
        setSelected(null);
        setSaveError("Este atleta já tem uma mensalidade ativa.");
        void load();
      } else if (message.includes("FAMILY_PLAN_TERMS_CHANGED") || message.includes("FAMILY_PLAN_UNAVAILABLE")) {
        setSelected(null);
        setSaveError("A oferta mudou. Confira os planos disponíveis.");
        void load();
      } else {
        setSaveError("Não foi possível enviar a solicitação. Tente novamente.");
      }
    } finally {
      saveInFlight.current = false;
      if (operation.current === scope) setSubmitting(false);
    }
  };

  const close = () => {
    if (saveInFlight.current) return;
    setSelected(null);
    setSaveError("");
    setOpen(false);
  };

  const history = offers.filter(offer => offer.status !== "available");
  const available = offers.filter(offer => offer.status === "available");

  return (
    <>
      <FamilySurface
        title="Planos"
        padding={padding}
        accessory={<FamilyButton label="Adicionar plano" icon="add" variant="primary" onPress={() => { setOpen(true); void load(); }} />}
      >
        {history.length ? history.map(offer => (
          <View key={offer.offer_id} style={{ gap: metrics.smallGap, paddingTop: metrics.smallGap, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "700" }}>{offer.name}</Text>
            <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize }}>
              {familyPlanKindLabel[offer.kind]} · {formatFamilyPlanTerms(offer.amount_cents, offer.billing_day)}
            </Text>
            <Text accessibilityLiveRegion="polite" style={{ color: offer.status === "accepted" ? colors.successText : colors.muted, fontSize: metrics.metadataFontSize }}>
              {offer.status !== "available" ? familyPlanStatusLabel[offer.status] : null}
            </Text>
          </View>
        )) : <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>Matrícula e mensalidade</Text>}
      </FamilySurface>

      <ModalSheet
        visible={open}
        onClose={close}
        dialogLabel="Planos"
        position="center"
        cardStyle={{
          width: "100%", maxWidth: 440, maxHeight: "78%", borderRadius: radius.xl,
          borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding, gap: metrics.gap,
        }}
      >
        {selected ? (
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          <InstitutionPlanRequestReview
            institutionName={institutionName}
            athleteName={studentName}
            offer={selected}
            busy={submitting}
            error={saveError}
            onBack={() => { setSelected(null); setSaveError(""); }}
            onSubmit={() => void requestPlan()}
          />
          </ScrollView>
        ) : (
          <>
            {saveError ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{saveError}</Text> : null}
            {loading || failed ? (
              <>
                <FamilyButton label="Pagamentos" icon="chevronBack" onPress={close} />
                {loading ? <SectionLoadingState /> : (
                  <>
                    <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>Não foi possível carregar os planos.</Text>
                    <FamilyButton label="Tentar novamente" onPress={() => void load()} />
                  </>
                )}
              </>
            ) : (
              <InstitutionPlanCatalog
                institutionName={institutionName}
                offers={available}
                backLabel="Pagamentos"
                onBack={close}
                onSelect={id => {
                  const offer = available.find(item => item.offer_id === id);
                  if (!offer) return;
                  setSelected(offer);
                  setSaveError("");
                }}
              />
            )}
          </>
        )}
      </ModalSheet>
    </>
  );
}
