import { useLocalSearchParams, useRouter } from "expo-router";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../ui/Pressable";
import { markRender } from "../../observability/perf";

import { useAuth } from "../../auth/auth";
import {
  savePendingTrainerInvite,
} from "../../auth/pending-invite";
import { shadow } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { ScreenBackdrop } from "../../components/ui/ScreenBackdrop";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Button } from "../../ui/Button";
import type { StaffSignupFields } from "../../api/staff-invite";

export type SignupCompletion = {
  email: string;
  busy: boolean;
  error: string;
  onChange: () => void;
  onSubmit: (fields: StaffSignupFields) => Promise<void>;
  onCancel: () => void;
};

const hasValidEmailFormat = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

// perf-check: ignore-measure - this form has no automatic asynchronous screen load.
export default function SignupScreen({ completion }: { completion?: SignupCompletion } = {}) {
  markRender("screen.signup.render.root");
  const { colors, mode } = useAppTheme();
  const { signUp, signInWithOAuth, resendSignupCode } = useAuth();
  const { inviteCode: inviteCodeParam } = useLocalSearchParams<{
    inviteCode?: string;
  }>();
  const solidInputBg = mode === "dark" ? "#121c30" : colors.inputBg;
  const router = useRouter();
  const [emailInput, setEmail] = useState("");
  const email = completion ? completion.email : emailInput;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localBusy, setBusy] = useState(false);
  const busy = localBusy || Boolean(completion?.busy);
  const [localMessage, setMessage] = useState("");
  const message = completion?.error || localMessage;
  const submitting = useRef(false);
  const [inviteCode, setInviteCode] = useState("");
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [strengthAnim] = useState(() => new Animated.Value(0));
  const [enterAnim] = useState(() => new Animated.Value(0));
  const [emailShakeAnim] = useState(() => new Animated.Value(0));
  const [passwordShakeAnim] = useState(() => new Animated.Value(0));
  const [shakeAnim] = useState(() => new Animated.Value(0));
  const [formShakeAnim] = useState(() => new Animated.Value(0));
  const emailInputRef = useRef<TextInput | null>(null);
  const [emailError, setEmailError] = useState<"missing" | "invalid" | null>(
    null,
  );
  const [passwordTooShort, setPasswordTooShort] = useState(false);
  const [confirmError, setConfirmError] = useState<"missing" | "mismatch" | null>(
    null
  );

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

  const hasInviteCodeFromLink =
    typeof inviteCodeParam === "string" && inviteCodeParam.trim().length > 0;

  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: strengthScore,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [strengthAnim, strengthScore]);

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  useEffect(() => {
    if (hasInviteCodeFromLink && !completion) {
      const normalizedCode = inviteCodeParam.trim().toUpperCase();
      Promise.resolve().then(() => {
        setInviteCode(normalizedCode);
      });
      Promise.resolve().then(() => {
        setShowInviteCode(true);
      });
      void savePendingTrainerInvite(normalizedCode);
    }
  }, [hasInviteCodeFromLink, inviteCodeParam, completion]);

  const runShake = useCallback((anim: Animated.Value) => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (completion?.error) runShake(formShakeAnim);
  }, [completion?.error, formShakeAnim, runShake]);

  useEffect(() => {
    if (!email.trim()) return;
    const timer = setTimeout(() => {
      if (email.trim() && !hasValidEmailFormat(email)) {
        setEmailError("invalid");
      } else {
        setEmailError(null);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [email]);

useEffect(() => {
    if (!confirm.trim() || confirm === password) return;
    const timer = setTimeout(() => {
      if (confirm && confirm !== password) {
        setConfirmError("mismatch");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [confirm, password]);

  const handleSignup = async () => {
    if (busy || submitting.current) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("");
      setEmailError("missing");
      runShake(emailShakeAnim);
      emailInputRef.current?.focus();
      return;
    }
    if (!hasValidEmailFormat(normalizedEmail)) {
      setMessage("");
      setEmailError("invalid");
      runShake(emailShakeAnim);
      emailInputRef.current?.focus();
      return;
    }
    setEmailError(null);
    if (!password.trim()) {
      setMessage("Informe sua senha.");
      return;
    }
    if (password.trim().length < 6) {
      setMessage("A senha precisa ter pelo menos 6 caracteres.");
      setPasswordTooShort(true);
      runShake(passwordShakeAnim);
      return;
    }
    if (!confirm.trim()) {
      setConfirmError("missing");
      runShake(shakeAnim);
      return;
    }
    if (confirm !== password) {
      setConfirmError("mismatch");
      runShake(shakeAnim);
      return;
    }
    if (completion) {
      if (password.length > 128) {
        setMessage("Use no máximo 128 caracteres na senha.");
        runShake(shakeAnim);
        return;
      }
      setMessage("");
      submitting.current = true;
      setBusy(true);
      try {
        await completion.onSubmit({ password });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível concluir o cadastro.");
        runShake(shakeAnim);
      } finally {
        submitting.current = false;
        setBusy(false);
      }
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const session = await signUp(normalizedEmail, password, "login", "");
      let initialCodeDeliveryFailed = false;
      if (session) {
        try {
          await resendSignupCode(normalizedEmail, "verify-email");
        } catch {
          initialCodeDeliveryFailed = true;
        }
      }
      const verifyEmailRoute = {
        pathname: "/verify-email" as const,
        params: {
          email: normalizedEmail,
          delivery: initialCodeDeliveryFailed ? "failed" : undefined,
        },
      };
      if (inviteCode.trim()) {
        await savePendingTrainerInvite(inviteCode.trim());
        if (session) {
          router.replace(verifyEmailRoute);
        } else {
          router.replace("/login");
        }
      } else {
        if (session) {
          router.replace(verifyEmailRoute);
        } else {
          router.replace("/login");
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao cadastrar.";
      const normalized = detail.toLowerCase();
      if (normalized.includes("user already registered")) {
        router.replace({
          pathname: "/login",
          params: {
            email: email.trim(),
            fromSignup: "1",
            inviteCode: inviteCode.trim() || undefined,
          },
        });
        return;
      } else if (normalized.includes("invite")) {
        setMessage("Convite inválido ou expirado.");
      } else if (normalized.includes("weak_password") || normalized.includes("at least 6")) {
        setMessage("A senha precisa ter pelo menos 6 caracteres.");
      } else {
        setMessage("Não foi possível concluir. Verifique os dados e tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (busy) return;
    setMessage("");
    setBusy(true);
    try {
      await signInWithOAuth("google", "signup");
    } catch (error) {
      const detail = error instanceof Error ? error.message.toLowerCase() : "falha ao autenticar.";
      setMessage(detail.includes("cancel") ? "Cadastro cancelado." : "Não foi possível criar conta com Google.");
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
              style={{
                flex: 1,
                justifyContent: "center",
                maxWidth: 440,
                width: "100%",
                alignSelf: "center",
                gap: 18,
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
              accessibilityLabel="Voltar"
              disabled={busy}
              onPress={() => {
                if (completion) {
                  completion.onCancel();
                  return;
                }
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/welcome");
                }
              }}
              suppressWebHoverFeedback
              style={({ pressed, hovered }: any) => ({
                alignSelf: "flex-start",
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: hovered ? colors.primaryBg : colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
                ...(Platform.OS === "web"
                  ? { boxShadow: hovered ? "0px 0px 10px rgba(74, 222, 128, 0.2)" : "0px 4px 8px rgba(0, 0, 0, 0.12)" }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.12,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 3,
                    }),
              })}
            >
              {({ hovered }: any) => (
                <GoAtletaIcon name="chevronBack" size={18} color={hovered ? colors.primaryBg : colors.text} />
              )}
            </Pressable>

            <ScreenHeader
              title={completion ? "Conclua seu cadastro" : "Comece agora"}
              subtitle={completion ? "" : "Monte planos, turmas e calendários no seu ritmo."}
            />

            <Animated.View
              style={{
                padding: 18,
                transform: [{ translateX: formShakeAnim }],
                borderRadius: 22,
                backgroundColor: colors.card,
                borderWidth: 0,
                overflow: "visible",
                gap: 14,
                ...shadow.elevated,
              }}
            >
              <Animated.View
                style={{
                  position: "relative",
                  zIndex: emailError ? 50 : 1,
                  transform: [{ translateX: emailShakeAnim }],
                }}
              >
                {emailError ? (
                  <View
                    accessibilityRole="alert"
                    style={{
                      position: "absolute",
                      top: -38,
                      left: 0,
                      zIndex: 60,
                      ...(Platform.OS === "web" ? ({ pointerEvents: "none" } as any) : {}),
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: colors.dangerSolidBg,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        alignSelf: "flex-start",
                        ...(Platform.OS === "web"
                          ? ({ boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.24)" } as any)
                          : {
                              shadowColor: "#000",
                              shadowOpacity: 0.24,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 3 },
                              elevation: 6,
                            }),
                      }}
                    >
                      <GoAtletaIcon
                        name="warningCircle"
                        size={14}
                        color={colors.dangerSolidText}
                      />
                      <Text
                        style={{
                          color: colors.dangerSolidText,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {emailError === "missing"
                          ? "Digite seu e-mail"
                          : "Digite um e-mail válido"}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 0,
                        height: 0,
                        marginLeft: 14,
                        borderLeftWidth: 6,
                        borderRightWidth: 6,
                        borderTopWidth: 6,
                        borderLeftColor: "transparent",
                        borderRightColor: "transparent",
                        borderTopColor: colors.dangerSolidBg,
                      }}
                    />
                  </View>
                ) : null}
                <View
                  style={{
                    borderWidth: emailError ? 2 : 1,
                    borderColor: emailError
                      ? colors.dangerSolidBg
                      : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    backgroundColor: solidInputBg,
                    overflow: "hidden",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    minHeight: 50,
                  }}
                >
                  <TextInput
                    ref={emailInputRef}
                    accessibilityLabel="E-mail"
                    accessibilityHint={
                      emailError
                        ? emailError === "missing"
                          ? "Campo obrigatório. Digite seu e-mail."
                          : "Formato inválido. Digite um e-mail válido."
                        : undefined
                    }
                    placeholder="Email"
                    value={email}
                    editable={!completion && !busy}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholderTextColor={colors.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    underlineColorAndroid="transparent"
                    selectionColor={colors.primaryBg}
                    style={{
                      flex: 1,
                      padding: 0,
                      color: colors.inputText,
                      backgroundColor: "transparent",
                      borderWidth: 0,
                      fontSize: 15,
                      borderRadius: 0,
                      ...(Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : {}),
                    }}
                  />
                </View>
              </Animated.View>

              <Animated.View style={{ position: "relative", zIndex: passwordTooShort ? 50 : 1, transform: [{ translateX: passwordShakeAnim }] }}>
                {passwordTooShort ? (
                  <View
                    accessibilityRole="alert"
                    style={{
                      position: "absolute",
                      top: -38,
                      left: 0,
                      zIndex: 60,
                      ...(Platform.OS === "web" ? ({ pointerEvents: "none" } as any) : {}),
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: colors.dangerSolidBg,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        alignSelf: "flex-start",
                        ...(Platform.OS === "web"
                          ? ({ boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.24)" } as any)
                          : {
                              shadowColor: "#000",
                              shadowOpacity: 0.24,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 3 },
                              elevation: 6,
                            }),
                      }}
                    >
                      <GoAtletaIcon name="warningCircle" size={14} color={colors.dangerSolidText} />
                      <Text style={{ color: colors.dangerSolidText, fontSize: 12, fontWeight: "600" }}>
                        A senha precisa ter pelo menos 6 caracteres.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 0,
                        height: 0,
                        marginLeft: 14,
                        borderLeftWidth: 6,
                        borderRightWidth: 6,
                        borderTopWidth: 6,
                        borderLeftColor: "transparent",
                        borderRightColor: "transparent",
                        borderTopColor: colors.dangerSolidBg,
                      }}
                    />
                  </View>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: passwordTooShort ? colors.dangerSolidBg : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: solidInputBg,
                    overflow: "hidden",
                    minHeight: 50,
                  }}
                >

                  <TextInput
                    accessibilityLabel="Senha"
                    placeholder="Senha"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    editable={!busy}
                    maxLength={completion ? 128 : undefined}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setMessage("");
                      completion?.onChange();
                      setPasswordTooShort(false);
                      setConfirmError(null);
                    }}
                    placeholderTextColor={colors.placeholder}
                    secureTextEntry={!showPassword}
                    underlineColorAndroid="transparent"
                    selectionColor={colors.primaryBg}
                    style={{
                      flex: 1,
                      padding: 0,
                      color: colors.inputText,
                      backgroundColor: "transparent",
                      borderWidth: 0,
                      fontSize: 15,
                      borderRadius: 0,
                      ...(Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : {}),
                    }}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
              </Animated.View>

              { password.length > 0 ? (
                <Animated.View style={{ position: "relative", zIndex: confirmError ? 50 : 1, transform: [{ translateX: shakeAnim }] }}>
                  {confirmError ? (
                    <View
                      accessibilityRole="alert"
                      style={{
                        position: "absolute",
                        top: -38,
                        left: 0,
                        zIndex: 60,
                        ...(Platform.OS === "web" ? ({ pointerEvents: "none" } as any) : {}),
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: colors.dangerSolidBg,
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          alignSelf: "flex-start",
                          ...(Platform.OS === "web"
                            ? ({ boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.24)" } as any)
                            : {
                                shadowColor: "#000",
                                shadowOpacity: 0.24,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 3 },
                                elevation: 6,
                              }),
                        }}
                      >
                        <GoAtletaIcon name="warningCircle" size={14} color={colors.dangerSolidText} />
                        <Text style={{ color: colors.dangerSolidText, fontSize: 12, fontWeight: "600" }}>
                          {confirmError === "missing" ? "Confirme sua senha" : "As senhas não coincidem"}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 0,
                          height: 0,
                          marginLeft: 14,
                          borderLeftWidth: 6,
                          borderRightWidth: 6,
                          borderTopWidth: 6,
                          borderLeftColor: "transparent",
                          borderRightColor: "transparent",
                          borderTopColor: colors.dangerSolidBg,
                        }}
                      />
                    </View>
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: confirmError ? colors.dangerSolidBg : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: solidInputBg,
                      overflow: "hidden",
                      minHeight: 50,
                    }}
                  >
                    <TextInput
                      accessibilityLabel="Confirmar senha"
                      placeholder="Confirmar senha"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      editable={!busy}
                      maxLength={completion ? 128 : undefined}
                      value={confirm}
                      onChangeText={(v) => {
                        setConfirm(v);
                        setConfirmError(null);
                        setMessage("");
                        completion?.onChange();
                      }}
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry={!showConfirm}
                      underlineColorAndroid="transparent"
                      selectionColor={colors.primaryBg}
                      style={{
                        flex: 1,
                        padding: 0,
                        color: colors.inputText,
                        backgroundColor: "transparent",
                        borderWidth: 0,
                        fontSize: 15,
                        borderRadius: 0,
                        ...(Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : {}),
                      }}
                    />
                    <Pressable
                      accessibilityLabel={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
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
                </Animated.View>
              ) : null}

              { password.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
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
                            style={[styles.strengthSegment, { backgroundColor: colors.secondaryBg }]}
                          >
                            <Animated.View
                              style={[styles.strengthFill, { width: fillWidth, backgroundColor: segmentColor }]}
                            />
                          </View>
                        );
                      })}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{strengthLabel}</Text>
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
                        style={styles.passwordCriterion}
                      >
                        <GoAtletaIcon
                          name={item.ok ? "checkmark" : "close"}
                          size={12}
                          color={item.ok ? colors.successBg : colors.dangerSolidBg}
                        />
                        <Text style={[styles.passwordHint, { color: colors.muted }]}>
                          {item.key}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.passwordHint, { color: colors.muted }]}>
                    Exemplo: @Senha1234_
                  </Text>
                </View>
              ) : null}

              {!completion && !hasInviteCodeFromLink && !showInviteCode ? (
                <Pressable
                  onPress={() => setShowInviteCode(true)}
                  style={{
                    alignSelf: "center",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 6,
                  }}
                >
                  <GoAtletaIcon name="key" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontWeight: "600" }}>
                    Possui um código de convite?
                  </Text>
                </Pressable>
              ) : !completion && !hasInviteCodeFromLink ? (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <GoAtletaIcon name="key" size={13} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.4 }}>
                      Código de convite
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 14,
                      backgroundColor: solidInputBg,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      minHeight: 48,
                      gap: 8,
                    }}
                  >
                    <TextInput
                      placeholder="Digite o código recebido"
                      value={inviteCode}
                      onChangeText={setInviteCode}
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="characters"
                      style={{
                        flex: 1,
                        padding: 0,
                        color: colors.inputText,
                        backgroundColor: "transparent",
                        borderWidth: 0,
                        fontSize: 13,
                        borderRadius: 0,
                        ...(Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : {}),
                      }}
                    />
                    {inviteCode.length > 0 ? (
                      <Pressable onPress={() => setInviteCode("")} style={{ paddingLeft: 4 }}>
                        <GoAtletaIcon name="closeCircle" size={16} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      setInviteCode("");
                      setShowInviteCode(false);
                    }}
                    style={{ alignSelf: "flex-end", paddingVertical: 4 }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
                      Não tenho código
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              { message ? (
                <View style={{ gap: 8 }}>
                  <Text
                    accessibilityRole="alert"
                    style={{
                      color: completion || message.startsWith("!")
                        ? colors.dangerSolidBg
                        : colors.muted,
                    }}
                  >
                    {message.startsWith("!") ? message.slice(1) : message}
                  </Text>
                  {!completion && email.trim() ? (
                    <Pressable
                      onPress={() =>
                        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`)
                      }
                      style={{
                        alignSelf: "flex-start",
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondaryBg,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                        Confirmar com codigo
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <Button
                label={completion ? "Concluir cadastro" : "Criar conta"}
                loadingLabel={completion ? "Concluindo..." : "Criando conta..."}
                onPress={handleSignup}
                disabled={
                  busy ||
                  Boolean(completion && password.length > 128) ||
                  !email.trim() ||
                  !hasValidEmailFormat(email) ||
                  !password.trim() ||
                  password.length < 6 ||
                  !confirm.trim() ||
                  password !== confirm
                }
                loading={busy}
              />
            </Animated.View>

            {!completion ? <View style={{ marginTop: 12, gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>ou</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              <View style={{ alignItems: "center" }}>
                <Pressable
                  onPress={handleGoogleSignup}
                  disabled={busy}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GoAtletaIcon name="google" size={20} color={colors.text} />
                </Pressable>
              </View>
            </View> : null}

            {!completion ? <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.muted }}>Já tem conta?</Text>
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: "/login",
                    params: inviteCode.trim()
                      ? { inviteCode: inviteCode.trim() }
                      : undefined,
                  })
                }
                suppressWebHoverFeedback
                style={({ pressed }: any) => ({
                  paddingVertical: 4,
                  paddingHorizontal: 6,
                  backgroundColor: "transparent",
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                {({ hovered }: any) => (
                  <Text
                    style={{
                      color: hovered ? "#4ade80" : colors.primaryBg,
                      fontWeight: "700",
                      textDecorationLine: hovered ? "underline" : "none",
                    }}
                  >
                    Entrar
                  </Text>
                )}
              </Pressable>
            </View> : null}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  strengthFill: { height: "100%" },
  strengthSegment: { flex: 1, height: 4, borderRadius: 999, overflow: "hidden" },
  passwordCriterion: { flexDirection: "row", alignItems: "center", gap: 6 },
  passwordHint: { fontSize: 12 },
});
