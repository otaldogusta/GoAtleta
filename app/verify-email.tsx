import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../src/auth/auth";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

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

export default function VerifyEmailScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { session, resendSignupCode, verifySignupCode, refreshUser } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const codeInputRef = useRef<TextInput | null>(null);
  const emailInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (typeof params.email === "string" && params.email.trim()) {
      const incoming = params.email.trim();
      setEmail(incoming);
      setEmailDraft(incoming);
      return;
    }
    if (session?.user?.email) {
      setEmail(session.user.email);
      setEmailDraft(session.user.email);
    }
  }, [params.email, session?.user?.email]);

  const isWideLayout = width >= 900;
  const contentPadding = isWideLayout ? 32 : 20;
  const titleSize = isWideLayout ? 42 : 34;
  const otpSize = width < 390 ? 44 : width >= 900 ? 60 : 52;
  const otpGap = width < 390 ? 6 : width >= 900 ? 12 : 10;

  const canConfirmEmailChange = emailDraft.trim().length > 4 && emailDraft.trim() !== email.trim();

  const codeLengthTarget = 6;

  const canSubmit = useMemo(() => {
    return email.trim().length > 4 && code.trim().length >= 6;
  }, [code, email]);

  const otpDigits = useMemo(() => {
    const value = code.padEnd(codeLengthTarget, " ").slice(0, codeLengthTarget);
    return value.split("");
  }, [code, codeLengthTarget]);

  const onResend = async () => {
    if (!email.trim()) {
      setMessage("Informe o e-mail para reenviar o código.");
      return;
    }
    setResendBusy(true);
    setMessage("");
    try {
      await resendSignupCode(email.trim(), "verify-email");
      setMessage("Código reenviado para seu e-mail. Verifique também a caixa de spam.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao reenviar código.";
      setMessage(normalizeVerifyError(detail));
    } finally {
      setResendBusy(false);
    }
  };

  const onVerify = async () => {
    if (!canSubmit) {
      setMessage("Preencha e-mail e código para continuar.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await verifySignupCode(email.trim(), code.trim());
      await refreshUser();
      setMessage("E-mail confirmado com sucesso.");
      if (session) {
        router.replace("/");
      } else {
        router.replace("/login");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao validar código.";
      setMessage(normalizeVerifyError(detail));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmEmailChange = () => {
    const nextEmail = emailDraft.trim();
    if (!nextEmail) return;
    setEmail(nextEmail);
    setEditingEmail(false);
    setMessage("");
  };

  const handleBack = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      router.replace(session ? "/" : "/login");
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(session ? "/" : "/login");
  }, [router, session]);

  useEffect(() => {
    if (!editingEmail) return;
    emailInputRef.current?.focus();
  }, [editingEmail]);

  useEffect(() => {
    if (code.length >= 6) {
      setCursorVisible(false);
      return;
    }
    const timer = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(timer);
  }, [code.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
          <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", gap: 22 }}>
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: titleSize, fontWeight: "800", color: colors.text }}>
                Confirmar e-mail
              </Text>
              <Text style={{ color: colors.muted }}>
                Digite o código de 6 dígitos recebido no seu e-mail.
              </Text>
              <Pressable
                onPress={() => setEditingEmail(true)}
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

            <Pressable
              onPress={() => codeInputRef.current?.focus()}
              style={{
                minHeight: 74,
                justifyContent: "center",
              }}
            >
              <TextInput
                ref={codeInputRef}
                value={code}
                onChangeText={(value) => setCode(value.replace(/[^0-9]/g, "").slice(0, 6))}
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
                    <View
                      key={`otp-${index}`}
                      style={{
                        width: otpSize,
                        height: otpSize,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isActive ? colors.text : colors.border,
                        backgroundColor: colors.card,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
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
                    </View>
                  );
                })}
              </View>
            </Pressable>

            {message ? <Text style={{ color: colors.muted }}>{message}</Text> : null}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable
                onPress={handleBack}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>Voltar</Text>
              </Pressable>

              <Pressable
                onPress={onVerify}
                disabled={busy}
                style={{
                  minWidth: 132,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: busy ? colors.primaryDisabledBg : colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  {busy ? "Validando..." : "Continuar"}
                </Text>
              </Pressable>
            </View>

            <View style={{ alignItems: "center", gap: 4, marginTop: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Não recebeu o código?</Text>
              <Pressable onPress={onResend} disabled={resendBusy} style={{ paddingVertical: 4 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                  {resendBusy ? "Reenviando..." : "Reenviar e-mail"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
