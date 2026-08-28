import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ENABLE_SOCIAL_LOGIN } from "../../src/api/config";
import { getInviteErrorCode } from "../../src/api/invite-errors";
import { claimStudentInvite, validateStudentInvite } from "../../src/api/student-invite";
import { useAuth } from "../../src/auth/auth";
import {
    clearPendingInvite,
    requiresInviteEmailVerification,
    savePendingInvite,
} from "../../src/auth/pending-invite";
import {
  canSubmitStudentInviteAuth,
  getStudentInviteAuthValidationMessage,
} from "../../src/auth/student-invite-auth";
import { useRole } from "../../src/auth/role";
import { Pressable } from "../../src/ui/Pressable";
import { ScreenBackdrop } from "../../src/components/ui/ScreenBackdrop";
import { useAppTheme } from "../../src/ui/app-theme";
import { ScreenHeader } from "../../src/ui/ScreenHeader";
import { GoAtletaIcon } from "../../src/ui/icon-registry";
import { markRender, measureAsync } from "../../src/observability/perf";

export default function StudentInviteScreen() {
  markRender("screen.studentInvite.render.main");
  const { colors } = useAppTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string | string[] }>();
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const {
    session,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    resendSignupCode,
  } = useAuth();
  const { role, loading: roleLoading, refresh } = useRole();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteState, setInviteState] = useState<"checking" | "valid" | "invalid">("checking");
  const [strengthAnim] = useState(() => new Animated.Value(0));
  const [enterAnim] = useState(() => new Animated.Value(0));
  const lastClaimUserRef = useRef<string | null>(null);
  const verificationRedirectUserRef = useRef<string | null>(null);
  const claimInFlightRef = useRef(false);

  const passwordChecks = useMemo(() => {
    const value = password;
    return {
      length: value.length >= 6,
      lower: /[a-z]/.test(value),
      upper: /[A-Z]/.test(value),
      number: /\d/.test(value),
      symbol: /[^A-Za-z0-9]/.test(value),
    };
  }, [password]);

  const strengthScore = useMemo(() => {
    const count =
      Number(passwordChecks.length) +
      Number(passwordChecks.lower) +
      Number(passwordChecks.upper) +
      Number(passwordChecks.number) +
      Number(passwordChecks.symbol);
    return count / 5;
  }, [passwordChecks]);

  const strengthLabel = useMemo(() => {
    if (!password) return "";
    if (strengthScore <= 0.33) return "Fraca";
    if (strengthScore <= 0.66) return "Média";
    return "Forte";
  }, [password, strengthScore]);

  const parseClaimError = (error: unknown) => {
    const code = getInviteErrorCode(error);
    if (code === "INVITE_EXPIRED") return "Convite expirado.";
    if (code === "INVITE_ALREADY_USED") return "Esse link já foi usado por outra conta. Peça um novo link.";
    if (code === "INVITE_REVOKED") return "Convite cancelado. Peça um novo link.";
    if (code === "INVITE_INVALID") return "Convite inválido.";
    if (code === "STUDENT_ALREADY_LINKED") return "Este aluno já está vinculado a outra conta.";
    if (code === "INVITE_EMAIL_MISMATCH") return "Este convite foi enviado para outro e-mail.";
    if (code === "EMAIL_NOT_VERIFIED") return "Confirme seu e-mail para concluir o convite.";
    if (code === "UNAUTHORIZED" || code === "MISSING_AUTH_TOKEN") return "Sessão expirada. Entre novamente.";
    if (code === "FORBIDDEN") return "Sem permissão para validar o convite.";
    return "Não foi possível validar o convite.";
  };

  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: strengthScore,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [strengthAnim, strengthScore]);

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  useEffect(() => {
    if (!tokenValue) return;
    void savePendingInvite(tokenValue);
  }, [tokenValue]);

  useEffect(() => {
    let active = true;
    if (!tokenValue) {
      Promise.resolve().then(() => {
        setInviteState("invalid");
      });
      Promise.resolve().then(() => {
        setMessage("Convite inválido. Peça um novo link ao professor.");
      });
      return () => { active = false; };
    }
    Promise.resolve().then(() => {
      setInviteState("checking");
    });
    Promise.resolve().then(() => {
      setMessage("Verificando convite...");
    });
    void measureAsync(
      "screen.studentInvite.load.validation",
      () => validateStudentInvite(tokenValue)
    )
      .then(() => {
        if (!active) return;
        setInviteState("valid");
        setMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setInviteState("invalid");
        setMessage(parseClaimError(error));
      });
    return () => { active = false; };
  }, [tokenValue]);

  const handleClaim = useCallback(async () => {
    if (claimInFlightRef.current) return;
    if (!tokenValue) {
      setMessage("Convite inválido.");
      return;
    }
    setBusy(true);
    claimInFlightRef.current = true;
    setMessage("");
    try {
      await claimStudentInvite(tokenValue);
      await clearPendingInvite();
      await refresh();
      router.replace("/");
    } catch (error) {
      setMessage(parseClaimError(error));
    } finally {
      claimInFlightRef.current = false;
      setBusy(false);
    }
  }, [refresh, router, tokenValue]);

  useEffect(() => {
    if (!session || !tokenValue || inviteState !== "valid") return;
    if (roleLoading) return;
    if (role === "trainer") {
      Promise.resolve().then(() => {
        setMessage("Esse convite é para alunos. Saia e use outra conta.");
      });
      return;
    }
    if (requiresInviteEmailVerification(session.user)) {
      const userId = session.user.id ?? "unknown";
      if (verificationRedirectUserRef.current === userId) return;
      verificationRedirectUserRef.current = userId;
      void (async () => {
        let deliveryFailed = false;
        const sessionEmail = String(session.user.email ?? email).trim().toLowerCase();
        try {
          await resendSignupCode(sessionEmail, "verify-email");
        } catch {
          deliveryFailed = true;
        }
        router.replace({
          pathname: "/verify-email",
          params: {
            email: sessionEmail,
            delivery: deliveryFailed ? "failed" : undefined,
          },
        });
      })();
      return;
    }
    const userId = session.user.id ?? "unknown";
    if (lastClaimUserRef.current === userId) return;
    lastClaimUserRef.current = userId;
    void handleClaim();
  }, [email, handleClaim, inviteState, resendSignupCode, role, roleLoading, router, session, tokenValue]);

  const canSubmit = useMemo(() => {
    return canSubmitStudentInviteAuth({ mode, email, password, confirm });
  }, [confirm, email, mode, password]);

  const handleAuth = async () => {
    if (!tokenValue) {
      setMessage("Convite inválido.");
      return;
    }
    const validationMessage = getStudentInviteAuthValidationMessage({
      mode,
      email,
      password,
      confirm,
    });
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (mode === "login") {
        await signIn(email.trim(), password, true);
        setMessage("Validando convite...");
        return;
      }
      const sessionData = await signUp(email.trim(), password, `invite/${tokenValue}`);
      if (sessionData) {
        verificationRedirectUserRef.current = sessionData.user.id ?? "unknown";
        let deliveryFailed = false;
        try {
          await resendSignupCode(email.trim(), "verify-email");
        } catch {
          deliveryFailed = true;
        }
        router.replace({
          pathname: "/verify-email",
          params: {
            email: email.trim().toLowerCase(),
            delivery: deliveryFailed ? "failed" : undefined,
          },
        });
        return;
      }
      setMessage(
        "Conta criada! Confirme seu email. Assim que confirmar, voltamos direto para concluir o convite."
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao autenticar.";
      const lower = detail.toLowerCase();
      if (lower.includes("user already registered")) {
        setMessage("Esse email já esta cadastrado.");
      } else if (lower.includes("invalid login")) {
        setMessage("Email ou senha incorretos.");
      } else if (lower.includes("weak_password") || lower.includes("at least 6")) {
        setMessage("A senha precisa ter pelo menos 6 caracteres.");
      } else {
        setMessage("Não foi possível concluir. Verifique os dados e tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: "google" | "facebook" | "apple") => {
    if (!tokenValue) {
      setMessage("Convite inválido.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await signInWithOAuth(provider, `invite/${tokenValue}`);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.toLowerCase() : "Falha ao autenticar.";
      setMessage(
        detail.includes("cancel")
          ? "Login cancelado."
          : "Não foi possível entrar com essa conta."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackdrop />
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              role="main"
              style={{
                flex: 1,
                justifyContent: "center",
                maxWidth: 440,
                width: "100%",
                alignSelf: "center",
                gap: 24,
                opacity: enterAnim,
                transform: [
                  {
                    translateY: enterAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              }}
            >
              <Pressable
                accessibilityLabel="Voltar para entrar"
                accessibilityRole="button"
                onPress={() => router.replace("/login")}
                suppressWebHoverFeedback
                style={{ alignSelf: "flex-start" }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: colors.secondaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GoAtletaIcon name="chevronBack" size={16} color={colors.text} />
                </View>
              </Pressable>

              <ScreenHeader
                title={mode === "signup" ? "Ative seu convite" : "Vincule seu acesso"}
                subtitle={
                  mode === "signup"
                    ? "Crie sua conta para acessar seus treinos."
                    : "Entre para vincular seu convite e continuar."
                }
                withSafeArea={false}
              />

              {inviteState === "invalid" ? (
                <View accessibilityRole="alert" style={{ gap: 14 }}>
                  <Text style={{ color: colors.dangerText }}>{message}</Text>
                  <Text style={{ color: colors.muted }}>
                    Solicite ao professor que gere e envie um novo convite.
                  </Text>
                </View>
              ) : inviteState === "checking" ? (
                <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>
                  Verificando convite...
                </Text>
              ) : <View
                style={{
                  padding: 18,
                  borderRadius: 22,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 14,
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 5,
                }}
              >
                <View role="tablist" style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { id: "signup" as const, label: "Criar conta" },
                    { id: "login" as const, label: "Entrar" },
                  ].map((option) => {
                    const active = mode === option.id;
                    return (
                      <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        key={option.id}
                        onPress={() => setMode(option.id)}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 12,
                          alignItems: "center",
                          backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? colors.primaryText : colors.text,
                            fontWeight: "700",
                          }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  overflow: "visible",
                  minHeight: 50,
                  paddingHorizontal: 14,
                  justifyContent: "center",
                }}
              >
                <TextInput
                  accessibilityLabel="E-mail"
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor={colors.placeholder}
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCapitalize="none"
                  style={{
                    minHeight: 50,
                    paddingVertical: 0,
                    color: colors.inputText,
                    backgroundColor: "transparent",
                    borderWidth: 0,
                    borderRadius: 0,
                  }}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 50,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                }}
              >
                <TextInput
                  accessibilityLabel="Senha"
                  placeholder="Senha"
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showPassword}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    color: colors.inputText,
                    backgroundColor: "transparent",
                    borderRadius: 0,
                  }}
                />
                <Pressable
                  accessibilityElementsHidden={password.length === 0}
                  accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  accessibilityRole="button"
                  onPress={() => setShowPassword((prev) => !prev)}
                  disabled={password.length === 0}
                  style={{
                    width: 34,
                    height: 34,
                    paddingLeft: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: password.length > 0 ? 1 : 0,
                  }}
                >
                  <GoAtletaIcon
                    name={showPassword ? "eyeOffSolid" : "viewSolid"}
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>
              </View>

              { mode === "signup" ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    minHeight: 50,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                  }}
                >
                  <TextInput
                    accessibilityLabel="Confirmar senha"
                    placeholder="Confirmar senha"
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholderTextColor={colors.placeholder}
                    secureTextEntry={!showConfirm}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      color: colors.inputText,
                      backgroundColor: "transparent",
                      borderRadius: 0,
                    }}
                  />
                  <Pressable
                    accessibilityElementsHidden={confirm.length === 0}
                    accessibilityLabel={showConfirm ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                    accessibilityRole="button"
                    onPress={() => setShowConfirm((prev) => !prev)}
                    disabled={confirm.length === 0}
                    style={{
                      width: 34,
                      height: 34,
                      paddingLeft: 8,
                      paddingVertical: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: confirm.length > 0 ? 1 : 0,
                    }}
                  >
                    <GoAtletaIcon
                      name={showConfirm ? "eyeOffSolid" : "viewSolid"}
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
              ) : null}

              { mode === "signup" && password.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      {strengthLabel}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[0, 1, 2].map((index) => {
                      const start = index / 3;
                      const end = (index + 1) / 3;
                      const fillWidth = strengthAnim.interpolate({
                        inputRange: [start, end],
                        outputRange: ["0%", "100%"],
                        extrapolate: "clamp",
                      });
                      const segmentColor =
                        index === 0
                           ? colors.dangerSolidBg
                          : index === 1
                           ? colors.warningBg
                          : colors.successBg;
                      return (
                        <View
                          key={String(index)}
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 999,
                            backgroundColor: colors.secondaryBg,
                            overflow: "hidden",
                          }}
                        >
                          <Animated.View
                            style={{
                              height: "100%",
                              width: fillWidth,
                              backgroundColor: segmentColor,
                            }}
                          />
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {[
                      { key: "minúscula", ok: passwordChecks.lower },
                      { key: "maiúscula", ok: passwordChecks.upper },
                      { key: "número", ok: passwordChecks.number },
                      { key: "símbolo", ok: passwordChecks.symbol },
                    ].map((item) => (
                      <View
                        key={item.key}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <GoAtletaIcon
                          name={item.ok ? "checkmark" : "close"}
                          size={12}
                          color={item.ok ? colors.successBg : colors.dangerSolidBg}
                        />
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {item.key}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Exemplo: @Senha1234_
                  </Text>
                </View>
              ) : null}

              { message ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: message.startsWith("!") ? colors.dangerText : colors.muted }}
                >
                  {message.startsWith("!") ? message.slice(1) : message}
                </Text>
              ) : null}

              {session &&
              (role === "trainer" ||
                message.toLowerCase().includes("outra conta") ||
                message.toLowerCase().includes("usado") ||
                message.toLowerCase().includes("vinculado")) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void signOut()}
                  style={{
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Entrar com outra conta
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityLabel={
                  busy
                    ? "Validando convite"
                    : mode === "signup"
                      ? "Criar conta e vincular convite"
                      : "Entrar e vincular convite"
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || !canSubmit, busy }}
                onPress={handleAuth}
                disabled={busy || !canSubmit}
                style={{
                  minHeight: 50,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor:
                    busy || !canSubmit ? colors.primaryDisabledBg : colors.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  {busy
                    ? "Validando..."
                    : mode === "signup"
                     ? "Criar conta e vincular"
                    : "Entrar e vincular"}
                </Text>
              </Pressable>

              {ENABLE_SOCIAL_LOGIN ? (
                <View style={{ marginTop: 12, gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Ou continue com</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
                    {[
                      { id: "google" as const, icon: "google" as const },
                      { id: "facebook" as const, icon: "facebook" as const },
                      { id: "apple" as const, icon: "apple" as const },
                    ].map((provider) => (
                      <Pressable
                        accessibilityLabel={`Continuar com ${
                          provider.id === "google"
                            ? "Google"
                            : provider.id === "facebook"
                              ? "Facebook"
                              : "Apple"
                        }`}
                        accessibilityRole="button"
                        key={provider.id}
                        onPress={() => handleOAuth(provider.id)}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 16,
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <GoAtletaIcon name={provider.icon} size={20} color={colors.text} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
