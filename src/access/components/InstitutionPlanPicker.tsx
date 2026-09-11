import { type ReactNode, useEffect, useState } from "react";
import { Animated, Easing, ScrollView, Text, View } from "react-native";

import type { InstitutionAccessPlan } from "../institution-access-plans";
import { getPlanBillingPreview, type PlanEnrollmentStep, type PlanPaymentPreference } from "../plan-enrollment-flow";
import { radius, spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, PixLogoIcon } from "../../ui/icon-registry";
import { ModalDialogFrame } from "../../ui/ModalDialogFrame";
import { useModalCardStyle } from "../../ui/use-modal-card-style";

function DetailRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
      <Text style={{ flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 }}>{label}</Text>
      <Text style={{ flex: 1.25, color: danger ? colors.dangerText : colors.text, fontSize: 13, lineHeight: 19, fontWeight: danger ? "800" : "600" }}>
        {value}
      </Text>
    </View>
  );
}

export function InstitutionPlanPicker({
  institutionName,
  athleteName,
  plans,
  contentHeight,
  busy,
  onBack,
  onSubmit,
}: {
  institutionName: string;
  athleteName: string;
  plans: InstitutionAccessPlan[];
  contentHeight: number;
  busy: boolean;
  onBack: () => void;
  onSubmit: (plan: InstitutionAccessPlan) => void;
}) {
  const { colors } = useAppTheme();
  const [expandedPlanId, setExpandedPlanId] = useState("");
  const [termsPlanId, setTermsPlanId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const termsPlan = plans.find((plan) => plan.id === termsPlanId) ?? null;
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const termsModalStyle = useModalCardStyle({ maxWidth: 520, maxHeight: "82%" });

  const openPlanConfirmation = (plan: InstitutionAccessPlan) => {
    setSelectedPlanId(plan.id);
  };

  const closePlanConfirmation = () => {
    if (busy) return;
    setSelectedPlanId("");
  };

  const closeTerms = () => {
    setTermsPlanId("");
  };

  if (selectedPlan) {
    return (
      <>
        <PlanEnrollmentWizard
          institutionName={institutionName}
          athleteName={athleteName}
          plan={selectedPlan}
          contentHeight={contentHeight}
          busy={busy}
          onBack={closePlanConfirmation}
          onReviewTerms={() => setTermsPlanId(selectedPlan.id)}
          onSubmit={() => onSubmit(selectedPlan)}
        />
        <PlanTermsModal
          institutionName={institutionName}
          plan={termsPlan}
          cardStyle={termsModalStyle}
          onClose={closeTerms}
        />
      </>
    );
  }

  return (
    <View style={{ width: "100%", height: contentHeight, gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar para instituições"
        onPress={onBack}
        style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}
        suppressWebHoverFeedback
      >
        <GoAtletaIcon name="chevronBack" size={18} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Instituições</Text>
      </Pressable>

      <View style={{ gap: 3, paddingBottom: spacing.sm }}>
        <Text style={{ color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "800" }}>Planos</Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{institutionName}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >

      {plans.length === 0 ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.container, backgroundColor: colors.card, padding: spacing.md, gap: 5 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Nenhum plano disponível</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>A instituição ainda não publicou planos para solicitação.</Text>
        </View>
      ) : null}

      {plans.map((plan) => {
        const expanded = expandedPlanId === plan.id;
        return (
          <View key={plan.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.container, backgroundColor: colors.card, padding: spacing.md, gap: spacing.sm }}>
            <View style={{ gap: 5 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {plan.modalities.map((modality) => (
                  <View key={modality} style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: radius.full, backgroundColor: colors.successBg, paddingHorizontal: 9, paddingVertical: 5 }}>
                    <GoAtletaIcon name="training" size={13} color={colors.primaryBg} />
                    <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "800" }}>{modality}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" }}>{plan.name}</Text>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>
                {plan.enrollmentLabel} + {plan.installmentLabel}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{plan.frequencyLabel}</Text>
            </View>

            <View style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${expanded ? "Ocultar" : "Mostrar"} detalhes de ${plan.name}`}
                onPress={() => setExpandedPlanId(expanded ? "" : plan.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 40 }}
                suppressWebHoverFeedback
              >
                <GoAtletaIcon name={expanded ? "chevronUp" : "chevronDown"} size={18} color={expanded ? colors.primaryBg : colors.muted} />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Detalhes</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Selecionar ${plan.name}`}
                disabled={busy}
                onPress={() => openPlanConfirmation(plan)}
                style={({ pressed }) => ({
                  minWidth: 112,
                  minHeight: 38,
                  borderRadius: radius.full,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  backgroundColor: colors.primaryBg,
                  opacity: busy ? 0.55 : pressed ? 0.84 : 1,
                })}
              >
                <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: "800" }}>{busy ? "Enviando..." : "Selecionar"}</Text>
              </Pressable>
            </View>

            {expanded ? (
              <View style={{ gap: spacing.sm }}>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>Cobrança</Text>
                <DetailRow label="Modalidade" value={plan.modalities.join(" · ")} />
                <DetailRow label="Vencimento" value={`Dia ${plan.billingDay}`} />
                <DetailRow label="Periodicidade" value={plan.periodicityLabel} />
                <DetailRow label="Pagamento" value={plan.paymentMethodLabel} />
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>Regras</Text>
                <DetailRow label="Multa por atraso" value={`${plan.lateFeePercent}%`} danger />
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
                  Valor informado pela instituição para pagamentos após o vencimento.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ler termos do plano"
                  onPress={() => {
                    setTermsPlanId(plan.id);
                  }}
                  style={{ minHeight: 44, borderRadius: radius.internal, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Ler termos</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      </ScrollView>

      <PlanTermsModal institutionName={institutionName} plan={termsPlan} cardStyle={termsModalStyle} onClose={closeTerms} />
    </View>
  );
}

function TermsSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

function PlanEnrollmentWizard({
  institutionName,
  athleteName,
  plan,
  contentHeight,
  busy,
  onBack,
  onReviewTerms,
  onSubmit,
}: {
  institutionName: string;
  athleteName: string;
  plan: InstitutionAccessPlan;
  contentHeight: number;
  busy: boolean;
  onBack: () => void;
  onReviewTerms: () => void;
  onSubmit: () => void;
}) {
  const { colors } = useAppTheme();
  const [step, setStep] = useState<PlanEnrollmentStep>(1);
  const [billingDay, setBillingDay] = useState(plan.billingDay);
  const [paymentPreference, setPaymentPreference] = useState<PlanPaymentPreference>("Pix");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [entryProgress] = useState(() => new Animated.Value(0));
  const [stepOpacity] = useState(() => new Animated.Value(1));
  const [stepTranslateX] = useState(() => new Animated.Value(0));
  const billingPreview = getPlanBillingPreview(new Date(), billingDay);
  const stepTitle = step === 1 ? "Vencimento" : step === 2 ? "Matrícula" : "Revisão";

  useEffect(() => {
    Animated.timing(entryProgress, {
      toValue: 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entryProgress]);

  const runStepTransition = (direction: 1 | -1, changeStep: () => void) => {
    if (process.env.NODE_ENV === "test") {
      changeStep();
      return;
    }

    Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 0, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(stepTranslateX, { toValue: direction * -18, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      changeStep();
      stepTranslateX.setValue(direction * 18);
      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(stepTranslateX, { toValue: 0, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const goBack = () => {
    runStepTransition(-1, () => {
      if (step === 1) onBack();
      else setStep((current) => (current - 1) as PlanEnrollmentStep);
    });
  };

  const goForward = () => {
    runStepTransition(1, () => setStep((current) => (current + 1) as PlanEnrollmentStep));
  };

  return (
    <Animated.View
      style={{
        width: "100%",
        height: contentHeight,
        gap: spacing.md,
        opacity: entryProgress,
        transform: [{ translateX: entryProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? "Voltar para planos" : "Voltar uma etapa"}
          onPress={goBack}
          style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center" }}
        >
          <GoAtletaIcon name="chevronBack" size={19} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{institutionName}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{plan.name}</Text>
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {[1, 2, 3].map((position) => (
            <View key={position} style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: position <= step ? colors.primaryBg : colors.border }} />
          ))}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>Etapa {step} de 3 · {stepTitle}</Text>
      </View>

      <Animated.View
        style={{
          flex: 1,
          gap: spacing.xs,
          opacity: stepOpacity,
          transform: [{ translateX: stepTranslateX }],
        }}
      >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <>
            <Text style={{ color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: "900" }}>Qual dia fica melhor para o vencimento?</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {[5, 10, 15].map((day) => {
                const selected = billingDay === day;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="radio"
                    accessibilityLabel={`Vencimento dia ${day}`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => setBillingDay(day)}
                    style={{ flex: 1, minHeight: 58, borderRadius: radius.full, borderWidth: 1, borderColor: selected ? colors.primaryBg : colors.border, backgroundColor: selected ? colors.primaryBg : colors.card, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: selected ? colors.primaryText : colors.text, fontSize: 20, fontWeight: "900" }}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
            <DateSection title="Primeiro vencimento" dates={[billingPreview.enrollmentDueLabel]} />
            <DateSection title="Próximas mensalidades" dates={billingPreview.monthlyDueLabels} />
            <InfoNote>As datas são lembretes informados pela instituição e não representam débito automático.</InfoNote>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={{ color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: "900" }}>Quem vai participar?</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.primaryBg, borderRadius: radius.container, padding: spacing.md }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.secondaryBg, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>{getInitials(athleteName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{athleteName}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Atleta desta conta</Text>
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "800" }}>Como prefere receber a cobrança?</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Informe uma preferência para a instituição.</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              {(["Pix", "Boleto", "Cartão"] as PlanPaymentPreference[]).map((method) => {
                const selected = paymentPreference === method;
                return (
                  <Pressable
                    key={method}
                    accessibilityRole="radio"
                    accessibilityLabel={`Preferir ${method}`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => setPaymentPreference(method)}
                    style={{ flex: 1, minHeight: 76, borderRadius: radius.internal, borderWidth: 1, borderColor: selected ? colors.primaryBg : colors.border, backgroundColor: selected ? colors.successBg : colors.card, alignItems: "center", justifyContent: "center", gap: 5 }}
                  >
                    {method === "Pix" ? (
                      <PixLogoIcon size={23} color={selected ? colors.primaryBg : colors.muted} />
                    ) : (
                      <GoAtletaIcon name={method === "Cartão" ? "paymentCard" : "receipt"} size={22} color={selected ? colors.primaryBg : colors.muted} />
                    )}
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{method}</Text>
                  </Pressable>
                );
              })}
            </View>
            <InfoNote>A instituição enviará as instruções de pagamento. O Go Atleta não faz débito automático.</InfoNote>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: "900" }}>Revise antes de solicitar</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Confira os dados que serão enviados à instituição.</Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.container, overflow: "hidden" }}>
              <ReviewRow icon="plan" label="Plano" value={plan.name} />
              <ReviewRow icon="training" label="Modalidade" value={plan.modalities.join(" · ")} />
              <ReviewRow icon="profile" label="Atleta" value={athleteName} />
              <ReviewRow icon="calendar" label="Vencimento" value={`Dia ${billingDay}`} />
              <ReviewRow icon="payments" label="Valores" value={`${plan.enrollmentLabel} + ${plan.installmentLabel}`} />
              <ReviewRow icon="receipt" label="Preferência" value={paymentPreference} last />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ler termos completos" onPress={onReviewTerms} style={{ alignSelf: "flex-start", paddingVertical: 4 }} suppressWebHoverFeedback>
              <Text style={{ color: colors.primaryBg, fontSize: 13, fontWeight: "800" }}>Ler termos completos</Text>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Li e aceito os termos do plano"
              accessibilityState={{ checked: termsAccepted }}
              onPress={() => setTermsAccepted((accepted) => !accepted)}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}
              suppressWebHoverFeedback
            >
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: termsAccepted ? colors.primaryBg : colors.border, backgroundColor: termsAccepted ? colors.primaryBg : colors.inputBg, alignItems: "center", justifyContent: "center" }}>
                {termsAccepted ? <GoAtletaIcon name="checkmark" size={15} color={colors.primaryText} /> : null}
              </View>
              <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 20 }}>Li e aceito os termos deste plano e autorizo o envio da solicitação à instituição.</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <View style={{ gap: spacing.xs }}>
        <Button
          label={step === 3 ? (busy ? "Enviando..." : "Solicitar plano") : "Continuar"}
          disabled={busy || (step === 3 && !termsAccepted)}
          onPress={() => step === 3 ? onSubmit() : goForward()}
        />
        {step > 1 ? (
          <Pressable accessibilityRole="button" onPress={goBack} style={{ minHeight: 36, alignItems: "center", justifyContent: "center" }} suppressWebHoverFeedback>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        ) : null}
      </View>
      </Animated.View>
    </Animated.View>
  );
}

function DateSection({ title, dates }: { title: string; dates: string[] }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>
      {dates.map((date) => (
        <View key={date} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <GoAtletaIcon name="calendar" size={19} color={colors.muted} />
          <Text style={{ color: colors.text, fontSize: 14 }}>{date}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoNote({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
      <GoAtletaIcon name="info" size={19} color={colors.muted} />
      <Text style={{ flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

function ReviewRow({ icon, label, value, last = false }: { icon: "plan" | "training" | "profile" | "calendar" | "payments" | "receipt"; label: string; value: string; last?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <GoAtletaIcon name={icon} size={19} color={colors.muted} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" }}>{value}</Text>
      </View>
    </View>
  );
}

function PlanTermsModal({ institutionName, plan, cardStyle, onClose }: { institutionName: string; plan: InstitutionAccessPlan | null; cardStyle: object; onClose: () => void }) {
  const { colors } = useAppTheme();
  return (
    <ModalDialogFrame
      visible={Boolean(plan)}
      onClose={onClose}
      cardStyle={cardStyle}
      colors={colors}
      title="Termos do plano"
      closeAccessibilityLabel="Fechar termos"
      subtitle={plan ? `${institutionName} · ${plan.name}` : undefined}
      contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md }}
    >
      {plan ? (
        <>
          <TermsSection title="Matrícula e atividades">Ao confirmar, o responsável solicita a matrícula do atleta na {institutionName} para {plan.modalities.join(" e ")}, conforme o plano escolhido. As atividades são coletivas e podem ocorrer no endereço informado pela instituição ou em outro local previamente comunicado.</TermsSection>
          <TermsSection title="Horários">A instituição poderá ajustar horários ou locais por necessidade pedagógica ou operacional, comunicando o responsável com antecedência razoável sempre que possível.</TermsSection>
          <TermsSection title="Saúde e segurança">O responsável declara que o atleta está apto à prática esportiva e deverá enviar, em até 15 dias após a matrícula, o documento de aptidão solicitado pela instituição. Condições de saúde relevantes devem ser informadas para a segurança do atleta. A prática esportiva envolve riscos próprios, sem afastar o dever da instituição de prevenção, cuidado e primeiros socorros.</TermsSection>
          <TermsSection title="Valores, pagamento e vencimento">O plano prevê {plan.enrollmentLabel} e {plan.installmentLabel}. A instituição informa os meios disponíveis, como Pix, boleto ou cartão. O Go Atleta registra o plano e envia avisos, mas não realiza débito automático.</TermsSection>
          <TermsSection title="Atraso">Após o vencimento, poderá ser aplicada multa de {plan.lateFeePercent}% sobre o valor em atraso. Medidas adicionais de cobrança ou suspensão dependem de comunicação ao responsável e do cumprimento da legislação aplicável.</TermsSection>
          <TermsSection title="Cancelamento">O cancelamento deve ser solicitado pelo Go Atleta com pelo menos 15 dias de antecedência da data pretendida, sem afastar direitos previstos em lei. A instituição confirmará a data efetiva e eventuais valores já vencidos.</TermsSection>
          <TermsSection title="Convivência e desligamento">A instituição poderá desligar o atleta em caso de conduta grave ou indisciplina reiterada, após comunicar o responsável e apresentar o motivo da decisão.</TermsSection>
          <TermsSection title="Imagem, voz e dados">Dados de cadastro e saúde serão utilizados somente para matrícula, atendimento e segurança. O uso de imagem ou voz para divulgação depende de autorização específica, separada e facultativa do responsável.</TermsSection>
          <TermsSection title="Aceite eletrônico">A confirmação no Go Atleta representa a manifestação eletrônica de vontade do responsável e identifica o plano solicitado. Uma cópia destes termos deve permanecer disponível para consulta.</TermsSection>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>A solicitação ainda depende da análise da instituição. A liberação do acesso não comprova pagamento.</Text>
        </>
      ) : null}
    </ModalDialogFrame>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}` : parts[0]?.slice(0, 2) ?? "AT").toUpperCase();
}
