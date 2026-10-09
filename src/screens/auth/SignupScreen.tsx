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
  clearPendingTrainerInvite,
} from "../../auth/pending-invite";
import { semanticColors, shadow } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { ScreenBackdrop } from "../../components/ui/ScreenBackdrop";
import { ScreenHeader } from "../../ui/ScreenHeader";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Button } from "../../ui/Button";
import type { StaffSignupFields } from "../../api/staff-invite";

import { estimatePasswordStrength } from "../../auth/password-strength";
import { SignupInviteCode } from "./SignupInviteCode";

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
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);
  const [localBusy, setBusy] = useState(false);
  const busy = localBusy || Boolean(completion?.busy);
  const [localMessage, setMessage] = useState("");
  const message = completion?.error || localMessage;
  const submitting = useRef(false);
  const [inviteCode, setInviteCode] = useState("");
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [verifiedInviteCode, setVerifiedInviteCode] = useState("");
  const inviteNeedsVerification = !completion && Boolean(inviteCode.trim()) && verifiedInviteCode !== inviteCode.trim().toUpperCase();
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

  const { score: strengthScore } = useMemo(
    () => estimatePasswordStrength(password), [password],
  );

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
        setVerifiedInviteCode("");
      });
      Promise.resolve().then(() => {
        setShowInviteCode(true);
      });
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
    if (busy || submitting.current || inviteNeedsVerification) return;
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
    submitting.current = true;
    try {
      if (inviteCode.trim()) await savePendingTrainerInvite(inviteCode.trim());
      else await clearPendingTrainerInvite();
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
          ...(inviteCode.trim() ? { inviteCode: inviteCode.trim() } : {}),
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
      submitting.current = false;
      setBusy(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (busy || inviteNeedsVerification) return;
    setMessage("");
    setBusy(true);
    try {
      if (inviteCode.trim()) await savePendingTrainerInvite(inviteCode.trim());
      else await clearPendingTrainerInvite();
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
                    suppressWebHoverFeedback
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
                    {({ hovered }: any) => <GoAtletaIcon
                      name={showPassword ? "eyeOffSolid" : "viewSolid"}
                      size={18}
                      color={hovered ? colors.primaryBg : colors.muted}
                    />}
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
                      suppressWebHoverFeedback
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
                      {({ hovered }: any) => <GoAtletaIcon
                        name={showConfirm ? "eyeOffSolid" : "viewSolid"}
                        size={18}
                        color={hovered ? colors.primaryBg : colors.muted}
                      />}
                    </Pressable>
                  </View>
                </Animated.View>
              ) : null}

              { password.length > 0 ? (
                <View style={{ gap: 8, position: "relative", zIndex: showPasswordHelp ? 60 : 1, overflow: "visible" }}>
                  {showPasswordHelp ? (
                    <View pointerEvents="none" style={{ position: "absolute", bottom: 36, right: 0,
                      width: 280, maxWidth: "100%", zIndex: 60 }}>
                      <View style={{ backgroundColor: colors.secondaryBg, borderColor: colors.border,
                        borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
                        ...shadow.elevated }}>
                        <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                          Use uma senha longa e evite repetições. Símbolos como @, # e ! podem ajudar, mas são opcionais.
                        </Text>
                      </View>
                      <View style={{ alignSelf: "flex-end", marginRight: 8, width: 0, height: 0,
                        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6,
                        borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.secondaryBg }} />
                    </View>
                  ) : null}
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
                          strengthScore <= 0.33
                            ? semanticColors[mode].danger
                            : strengthScore <= 0.66
                            ? semanticColors[mode].warning
                            : semanticColors[mode].success;
                        return (
                          <View
                            key={String(index)}
                            style={[styles.strengthSegment, { backgroundColor: colors.secondaryBg }]}
                          >
                            <Animated.View
                              testID={`password-strength-fill-${index}`}
                              style={[styles.strengthFill, { width: fillWidth, backgroundColor: segmentColor }]}
                            />
                          </View>
                        );
                      })}
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Ajuda sobre a senha"
                      accessibilityState={{ expanded: showPasswordHelp }} suppressWebHoverFeedback
                      onPress={() => setShowPasswordHelp((visible) => !visible)}
                      onBlur={() => setShowPasswordHelp(false)}
                      {...(Platform.OS === "web" ? { onKeyDown: (event: any) => {
                        if (event.key === "Escape") setShowPasswordHelp(false);
                      } } as any : {})}
                      style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
                      {({ hovered }: any) => <Text style={{ color: hovered ? colors.primaryBg : colors.muted,
                        fontSize: 12, fontWeight: "600", width: 16, height: 16, lineHeight: 14,
                        textAlign: "center", borderWidth: 1, borderRadius: 8,
                        borderColor: hovered ? colors.primaryBg : colors.muted }}>?</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {!completion && !showInviteCode ? (
                <Pressable
                  onPress={() => setShowInviteCode(true)}
                  suppressWebHoverFeedback
                  style={{
                    alignSelf: "center",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 6,
                  }}
                >
                  {({ hovered }: any) => (
                    <>
                      <GoAtletaIcon name="key" size={14} color={hovered ? colors.primaryBg : colors.muted} />
                      <Text style={{ color: hovered ? colors.primaryBg : colors.muted, fontWeight: "600",
                        textDecorationLine: hovered ? "underline" : "none" }}>
                        Possui um código de convite?
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : !completion ? (
                <SignupInviteCode code={inviteCode} disabled={busy}
                  onChange={(value) => { setInviteCode(value); setVerifiedInviteCode(""); }}
                  onVerified={setVerifiedInviteCode}
                  onRemove={() => { setInviteCode(""); setVerifiedInviteCode(""); setShowInviteCode(false); }} />
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
                  busy || inviteNeedsVerification ||
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
                  disabled={busy || inviteNeedsVerification}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy || inviteNeedsVerification ? 0.55 : 1,
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
});
