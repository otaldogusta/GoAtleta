import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Animated,
    Platform,
    ScrollView,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { claimStudentRelationshipInvite } from "../src/api/student-relationship-invite";
import { useAuth } from "../src/auth/auth";
import { hasValidEmailFormat } from "../src/auth/email-format";
import { hasVerifiedEmailAccess } from "../src/auth/email-verification-state";
import {
  clearPendingRelationshipInvite,
  getPendingInvite,
  getPendingRelationshipInvite,
  getPendingTrainerInvite,
  resolvePendingInviteRedirect,
} from "../src/auth/pending-invite";
import { useRole } from "../src/auth/role";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { markRender } from "../src/observability/perf";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import { Button } from "../src/ui/Button";
import { ScreenHeader } from "../src/ui/ScreenHeader";
import { ScreenBackdrop } from "../src/components/ui/ScreenBackdrop";
import { AuthFieldError } from "../src/ui/AuthFieldError";

const normalizeVerifyError = (failure: unknown) => {
  const raw = failure instanceof Error ? failure.message.toLowerCase() : "";
  if (raw.includes("expired") || raw.includes("otp_expired")) {
    return "Código expirado. Solicite um novo código e tente novamente.";
  }
  if (raw.includes("invalid") || raw.includes("otp") || raw.includes("token")) {
    return "Código inválido. Confira o código do e-mail e tente novamente.";
  }
  return "Não foi possível validar o código agora.";
};

const normalizeOtpCode = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 6);

// perf-check: ignore-measure -- form state comes from route/auth context; no screen data load runs here.
export default function VerifyEmailScreen() {
  markRender("screen.verifyEmail.render.root");
  const { colors, mode } = useAppTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { session, resendSignupCode, canReuseSignupPassword, correctPendingSignupEmail, verifySignupCode, refreshUser } = useAuth();
  const { refresh: refreshRole } = useRole();
  const refreshCurrentRole = useRef(refreshRole);
  const params = useLocalSearchParams<{ email?: string; delivery?: string }>();
  const email = session
    ? session.user?.email?.trim() || ""
    : typeof params.email === "string" ? params.email.trim() : "";
  const canEditEmail = !session || (
    Boolean(session.user?.email) &&
    session.user?.app_metadata?.provider === "email" &&
    !hasVerifiedEmailAccess(session.user) &&
    session.user?.app_metadata?.staff_invite_setup_required !== true
  );

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const requestInFlight = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [enterAnim] = useState(() => new Animated.Value(0));
  const [shakeAnim] = useState(() => new Animated.Value(0));
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const codeInputRef = useRef<TextInput | null>(null);
  const emailInputRef = useRef<TextInput | null>(null);
  const emailPasswordInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    refreshCurrentRole.current = refreshRole;
  }, [refreshRole]);

  useEffect(() => {
    Animated.spring(enterAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [enterAnim]);

  useEffect(() => {
    if (!editingEmail || !emailDraft.trim() || hasValidEmailFormat(emailDraft)) return;
    const timer = setTimeout(() => setEmailError("Digite um e-mail válido"), 800);
    return () => clearTimeout(timer);
  }, [editingEmail, emailDraft]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (params.delivery !== "failed") return;
    Promise.resolve().then(() => {
      setError("Não foi possível enviar o código. Toque em Reenviar.");
    });
  }, [params.delivery]);

  const isWideLayout = width >= 900;
  const contentPadding = isWideLayout ? 32 : 20;
  const otpGap = width < 390 ? 6 : width >= 900 ? 12 : 10;
  const otpSize = Math.min(isWideLayout ? 60 : 52,
    Math.floor((Math.min(width - contentPadding * 2, 440) - otpGap * 5) / 6));
  const otpError = editingEmail ? "" : error;
  const needsSignupPassword = editingEmail && !canReuseSignupPassword(email);
  const editInputFrame = {
    minHeight: 50, justifyContent: "center" as const, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: mode === "dark" ? "#121c30" : colors.inputBg,
  };
  const editInputText = {
    color: colors.inputText, backgroundColor: "transparent", fontSize: 15,
    padding: 0, borderRadius: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  };

  const canConfirmEmailChange = hasValidEmailFormat(emailDraft) && emailDraft.trim().toLowerCase() !== email.toLowerCase()
    && (!needsSignupPassword || emailPassword.trim().length >= 6);

  const codeLengthTarget = 6;

  const canSubmit = useMemo(() => {
    return hasValidEmailFormat(email) && /^\d{6}$/.test(code);
  }, [code, email]);

  const otpDigits = useMemo(() => {
    const value = code.padEnd(codeLengthTarget, " ").slice(0, codeLengthTarget);
    return value.split("");
  }, [code, codeLengthTarget]);

  const onResend = async () => {
    if (requestInFlight.current || resendCountdown > 0 || editingEmail) return;
    if (!email.trim()) {
      setError("Informe o e-mail para reenviar o código.");
      return;
    }
    setResendBusy(true);
    requestInFlight.current = true;
    setMessage("");
    setError("");
    try {
      await resendSignupCode(email, "verify-email");
      setResendCountdown(60);
      setMessage("Código reenviado para seu e-mail. Verifique também a caixa de spam.");
    } catch {
      setError("Não foi possível reenviar o código. Tente novamente em instantes.");
    } finally {
      setResendBusy(false);
      requestInFlight.current = false;
    }
  };

  const onVerify = async () => {
    if (requestInFlight.current || editingEmail) return;
    if (!canSubmit) {
      setError("Preencha e-mail e código para continuar.");
      return;
    }
    setBusy(true);
    requestInFlight.current = true;
    setMessage("");
    setError("");
    try {
      const verifiedSession = await verifySignupCode(email, code);
      if (!verifiedSession) await refreshUser();
      const [pendingStudentToken, pendingRelationshipToken, pendingTrainerCode] = await Promise.all([
        getPendingInvite(),
        getPendingRelationshipInvite(),
        getPendingTrainerInvite(),
      ]);

      const relationshipToken = pendingRelationshipToken.trim();
      if (relationshipToken) {
        try {
          const receipt = await claimStudentRelationshipInvite(relationshipToken);
          await clearPendingRelationshipInvite().catch(() => undefined);
          // Verification already hydrated the new session. Refreshing the old
          // render's user could restore the pending session after a correction.
          if (!verifiedSession) await refreshUser();
          await refreshCurrentRole.current();
          router.replace(
            receipt.relationshipKind === "athlete" ? "/student/home" : "/family/home",
          );
        } catch {
          router.replace(
            `/family-invite/${encodeURIComponent(relationshipToken)}` as Parameters<
              typeof router.replace
            >[0],
          );
        }
        return;
      }

      const pendingTarget = resolvePendingInviteRedirect({
        pendingStudentToken,
        pendingTrainerCode,
        pendingRelationshipToken: "",
        defaultTarget: "",
      });
      if (pendingTarget) {
        router.replace(pendingTarget as Parameters<typeof router.replace>[0]);
        return;
      }
      setMessage("E-mail confirmado com sucesso.");
      if (verifiedSession || session) {
        await refreshCurrentRole.current();
        router.replace("/");
      } else {
        router.replace("/login");
      }
    } catch (failure) {
      setError(normalizeVerifyError(failure));
      Animated.sequence([8, -8, 5, -5, 0].map((toValue) =>
        Animated.timing(shakeAnim, { toValue, duration: 50, useNativeDriver: true }))).start();
    } finally {
      setBusy(false);
      requestInFlight.current = false;
    }
  };

  const startEmailEdit = () => {
    setEmailDraft(email);
    setEmailPassword("");
    setEmailError("");
    setEditingEmail(true);
  };

  const cancelEmailEdit = () => {
    setEmailError("");
    setEmailPassword("");
    setEditingEmail(false);
  };

  const onConfirmEmailChange = async (value = emailDraft) => {
    if (requestInFlight.current || !canEditEmail) return;
    const nextEmail = value.trim().toLowerCase();
    if (!hasValidEmailFormat(nextEmail)) {
      setEmailError(nextEmail ? "Digite um e-mail válido" : "Digite seu e-mail");
      emailInputRef.current?.focus();
      return;
    }
    if (nextEmail === email.toLowerCase()) return;
    if (needsSignupPassword && emailPassword.trim().length < 6) {
      emailPasswordInputRef.current?.focus();
      return;
    }

    requestInFlight.current = true;
    setChangingEmail(true);
    setEmailError("");
    try {
      const { deliveryFailed } = await correctPendingSignupEmail(email, nextEmail, needsSignupPassword ? emailPassword : undefined);
      router.setParams({ email: nextEmail, delivery: deliveryFailed ? "failed" : "" });
      setCode("");
      setError(deliveryFailed ? "Não foi possível enviar o código. Toque em Reenviar." : "");
      setEditingEmail(false);
      setEmailPassword("");
      setResendCountdown(deliveryFailed ? 0 : 60);
      setMessage(deliveryFailed ? "" : "Enviamos um código para o e-mail corrigido.");
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message.toLowerCase() : "";
      if (detail.includes("informe a senha do cadastro")) return;
      setEmailError(detail.includes("already") || detail.includes("já está")
        ? "Este e-mail já está em uso."
        : "Não foi possível enviar o código para esse e-mail.");
    } finally {
      setChangingEmail(false);
      requestInFlight.current = false;
    }
  };

  const handleBack = () => {
    if (editingEmail) {
      cancelEmailEdit();
      return;
    }
    navigateBackOrReplace({ router, fallback: session ? "/" : "/login" });
  };

  useEffect(() => {
    if (!editingEmail) return;
    emailInputRef.current?.focus();
  }, [editingEmail]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const input = codeInputRef.current as unknown as HTMLInputElement | null;
    if (!input?.addEventListener) return;

    const handlePaste = (event: ClipboardEvent) => {
      const pastedCode = normalizeOtpCode(event.clipboardData?.getData("text") ?? "");
      if (!pastedCode) return;

      event.preventDefault();
      setCode(pastedCode);
      setMessage("");
      setError("");
    };

    input.addEventListener("paste", handlePaste);
    return () => input.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    if (code.length >= 6) {
      Promise.resolve().then(() => {
        setCursorVisible(false);
      });
      return;
    }
    const timer = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(timer);
  }, [code.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: contentPadding,
            paddingVertical: isWideLayout ? 36 : 20,
            gap: isWideLayout ? 34 : 28,
            justifyContent: "center",
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ width: "100%", maxWidth: 440, alignSelf: "center", gap: 22,
            opacity: enterAnim, transform: [{ translateX: shakeAnim },
              { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <Pressable accessibilityLabel="Voltar" disabled={busy || resendBusy || changingEmail} onPress={handleBack}
              suppressWebHoverFeedback style={({ hovered }: any) => ({ width: 38, height: 38, borderRadius: 19,
                alignItems: "center", justifyContent: "center", backgroundColor: colors.secondaryBg,
                borderWidth: 1, borderColor: hovered ? colors.primaryBg : colors.border })}>
              <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
            </Pressable>
            <View style={{ gap: 10 }}>
              <ScreenHeader title="Confirmar e-mail" subtitle="Digite o código de 6 dígitos recebido no seu e-mail." />
              {editingEmail ? (
                <View style={{ gap: 8, paddingTop: 30 }}>
                  <View style={{ position: "relative", zIndex: 50, overflow: "visible" }}>
                    <View style={[editInputFrame, emailError ? { borderColor: colors.dangerSolidBg } : null]}>
                      <TextInput
                        ref={emailInputRef}
                        accessibilityLabel="E-mail"
                        value={emailDraft}
                        editable={!changingEmail}
                        onChangeText={(value) => { setEmailDraft(value); setEmailError(""); }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        returnKeyType="go"
                        submitBehavior="submit"
                        blurOnSubmit={false}
                        onSubmitEditing={({ nativeEvent }) => { void onConfirmEmailChange(nativeEvent.text); }}
                        placeholder="E-mail"
                        placeholderTextColor={colors.placeholder}
                        style={editInputText}
                      />
                    </View>
                    <AuthFieldError message={emailError} />
                  </View>
                  {needsSignupPassword ? (
                    <View style={editInputFrame}>
                      <TextInput
                        ref={emailPasswordInputRef}
                        accessibilityLabel="Senha do cadastro"
                        placeholder="Senha do cadastro"
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="new-password"
                        value={emailPassword}
                        editable={!changingEmail}
                        onChangeText={(value) => { setEmailPassword(value); setEmailError(""); }}
                        onSubmitEditing={() => { void onConfirmEmailChange(); }}
                        style={editInputText}
                      />
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void onConfirmEmailChange()}
                      disabled={!canConfirmEmailChange || changingEmail}
                      suppressWebHoverFeedback
                      style={{ minHeight: 44, justifyContent: "center", opacity: canConfirmEmailChange && !changingEmail ? 1 : 0.55 }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {changingEmail ? "Enviando..." : "Enviar código"}
                      </Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={cancelEmailEdit} disabled={changingEmail}
                      suppressWebHoverFeedback style={{ minHeight: 44, justifyContent: "center" }}>
                      <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>Cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : canEditEmail ? (
                <Pressable
                  accessibilityRole="button" accessibilityLabel="Editar e-mail" accessibilityHint={email || undefined}
                  onPress={startEmailEdit} disabled={busy || resendBusy} suppressWebHoverFeedback
                  style={{ alignSelf: "flex-start", maxWidth: "100%", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  {({ hovered }: any) => (
                    <>
                      <Text style={{ color: hovered ? colors.primaryBg : colors.text, fontWeight: "600", flexShrink: 1 }}>
                        {email || "Informar e-mail"}
                      </Text>
                      <GoAtletaIcon name="pencil" size={16} color={hovered ? colors.primaryBg : colors.muted} />
                    </>
                  )}
                </Pressable>
              ) : <Text style={{ color: colors.text, fontWeight: "600" }}>{email}</Text>}
            </View>

            <View
              style={{
                minHeight: 74,
                justifyContent: "center",
                position: "relative", zIndex: 50, overflow: "visible",
              }}
            >
              <AuthFieldError message={otpError} />
              <TextInput
                ref={codeInputRef}
                accessibilityLabel="Código de confirmação"
                value={code}
                editable={!busy && !resendBusy && !editingEmail}
                onChangeText={(value) => { setCode(normalizeOtpCode(value)); setMessage(""); setError(""); }}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                maxLength={6}
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  opacity: 0,
                }}
              />
              <View style={{ flexDirection: "row", justifyContent: "center", gap: otpGap }}>
                {otpDigits.map((digit, index) => {
                  const isActive = code.length === index || (code.length >= 6 && index === 5);
                  const showCursor = isActive && !digit.trim() && cursorVisible;
                  return (
                    <Pressable
                      key={`otp-${index}`}
                      onPress={() => codeInputRef.current?.focus()}
                      disabled={editingEmail}
                      suppressWebHoverFeedback
                      style={({ hovered, pressed }: any) => ({
                        width: otpSize,
                        height: otpSize,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: otpError ? colors.dangerSolidBg : isActive || hovered ? colors.text : colors.border,
                        backgroundColor: hovered ? colors.inputBg : colors.card,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 24,
                          fontWeight: "700",
                          lineHeight: 26,
                        }}
                      >
                        {digit.trim() ? digit : showCursor ? "|" : " "}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {message && !editingEmail ? <Text style={{ color: colors.muted }}>{message}</Text> : null}

              <Button label="Continuar" loading={busy} loadingLabel="Validando..."
                onPress={() => void onVerify()} disabled={!canSubmit || busy || resendBusy || editingEmail} />

            <View style={{ alignItems: "center", gap: 4, marginTop: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Não recebeu o código?</Text>
              <Pressable onPress={onResend} disabled={busy || resendBusy || resendCountdown > 0 || editingEmail}
                suppressWebHoverFeedback style={{ paddingVertical: 4, opacity: resendCountdown > 0 ? 0.55 : 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                  {resendBusy ? "Reenviando..." : resendCountdown > 0
                    ? `Reenviar em ${Math.floor(resendCountdown / 60)}:${String(resendCountdown % 60).padStart(2, "0")}`
                    : "Reenviar e-mail"}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
