import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const normalizeVerifyError = (message: string) => {
  const raw = String(message ?? "").toLowerCase();
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
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { session, resendSignupCode, verifySignupCode, refreshUser } = useAuth();
  const { refresh: refreshRole } = useRole();
  const params = useLocalSearchParams<{ email?: string; delivery?: string }>();

  const [email, setEmail] = useState("");
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
  const [cursorVisible, setCursorVisible] = useState(true);
  const codeInputRef = useRef<TextInput | null>(null);
  const emailInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    Animated.spring(enterAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [enterAnim]);

  useEffect(() => {
    if (!session?.user?.email && typeof params.email === "string" && params.email.trim()) {
      const incoming = params.email.trim();
      Promise.resolve().then(() => {
        setEmail(incoming);
      });
      Promise.resolve().then(() => {
        setEmailDraft(incoming);
      });
      return;
    }
    if (session?.user?.email) {
      Promise.resolve().then(() => {
        setEmail(session.user.email);
      });
      Promise.resolve().then(() => {
        setEmailDraft(session.user.email);
      });
    }
  }, [params.email, session?.user?.email]);

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

  const canConfirmEmailChange = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDraft.trim()) && emailDraft.trim() !== email.trim();

  const codeLengthTarget = 6;

  const canSubmit = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && /^\d{6}$/.test(code);
  }, [code, email]);

  const otpDigits = useMemo(() => {
    const value = code.padEnd(codeLengthTarget, " ").slice(0, codeLengthTarget);
    return value.split("");
  }, [code, codeLengthTarget]);

  const onResend = async () => {
    if (requestInFlight.current || resendCountdown > 0) return;
    if (!email.trim()) {
      setError("Informe o e-mail para reenviar o código.");
      return;
    }
    setResendBusy(true);
    requestInFlight.current = true;
    setMessage("");
    setError("");
    try {
      await resendSignupCode(email.trim(), "verify-email");
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
    if (requestInFlight.current) return;
    if (!canSubmit) {
      setError("Preencha e-mail e código para continuar.");
      return;
    }
    setBusy(true);
    requestInFlight.current = true;
    setMessage("");
    setError("");
    try {
      const verifiedSession = await verifySignupCode(email.trim(), code.trim());
      await refreshUser();
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
          await Promise.all([refreshUser(), refreshRole()]);
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
        await refreshRole();
        router.replace("/");
      } else {
        router.replace("/login");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao validar código.";
      setError(normalizeVerifyError(detail));
      Animated.sequence([8, -8, 5, -5, 0].map((toValue) =>
        Animated.timing(shakeAnim, { toValue, duration: 50, useNativeDriver: true }))).start();
    } finally {
      setBusy(false);
      requestInFlight.current = false;
    }
  };

  const onConfirmEmailChange = () => {
    const nextEmail = emailDraft.trim();
    if (!canConfirmEmailChange || session) return;
    setEmail(nextEmail);
    setCode("");
    setError("");
    setEditingEmail(false);
    setMessage("Reenvie o código para confirmar este e-mail.");
  };

  const handleBack = useCallback(() => {
    navigateBackOrReplace({ router, fallback: session ? "/" : "/login" });
  }, [router, session]);

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
            <Pressable accessibilityLabel="Voltar" disabled={busy || resendBusy} onPress={handleBack}
              suppressWebHoverFeedback style={({ hovered }: any) => ({ width: 38, height: 38, borderRadius: 19,
                alignItems: "center", justifyContent: "center", backgroundColor: colors.secondaryBg,
                borderWidth: 1, borderColor: hovered ? colors.primaryBg : colors.border })}>
              <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
            </Pressable>
            <View style={{ gap: 10 }}>
              <ScreenHeader title="Confirmar e-mail" subtitle="Digite o código de 6 dígitos recebido no seu e-mail." />
              <Pressable
                onPress={() => setEditingEmail(true)}
                disabled={Boolean(session) || busy || resendBusy}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {editingEmail ? (
                  <View style={{ flex: 1, gap: 8 }}>
                    <TextInput
                      ref={emailInputRef}
                      value={emailDraft}
                      onChangeText={setEmailDraft}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="Email"
                      placeholderTextColor={colors.placeholder}
                      style={{
                        color: colors.text,
                        fontWeight: "600",
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        paddingVertical: 2,
                      }}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      {canConfirmEmailChange ? (
                        <Pressable onPress={onConfirmEmailChange} style={{ paddingVertical: 2 }}>
                          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                            Confirmar
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => {
                          setEmailDraft(email);
                          setEditingEmail(false);
                        }}
                        style={{ paddingVertical: 2 }}
                      >
                        <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 12 }}>
                          Cancelar
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>{email}</Text>
                )}
              </Pressable>
            </View>

            <View
              style={{
                minHeight: 74,
                justifyContent: "center",
                position: "relative", zIndex: error ? 50 : 1, overflow: "visible",
              }}
            >
              <AuthFieldError message={error} />
              <TextInput
                ref={codeInputRef}
                accessibilityLabel="Código de confirmação"
                value={code}
                editable={!busy && !resendBusy}
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
                      suppressWebHoverFeedback
                      style={({ hovered, pressed }: any) => ({
                        width: otpSize,
                        height: otpSize,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: error ? colors.dangerSolidBg : isActive || hovered ? colors.text : colors.border,
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

            {message ? <Text style={{ color: colors.muted }}>{message}</Text> : null}

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
