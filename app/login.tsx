import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../src/ui/Pressable";

import { useAuth } from "../src/auth/auth";
import {
  getPendingInvite,
  getPendingRelationshipInvite,
  getPendingTrainerInvite,
  resolvePendingInviteRedirect,
  resolvePendingTrainerCode,
  savePendingTrainerInvite,
} from "../src/auth/pending-invite";
import { sanitizePostLoginRedirect } from "../src/auth/post-login-redirect";
import { hasStoredSession } from "../src/auth/session";
import { useBiometricLock } from "../src/security/biometric-lock";
import { getBiometricsEnabled } from "../src/security/biometric-settings";
import { isBiometricsSupported } from "../src/security/biometrics";
import { isSupabaseConfigured } from "../src/api/config";
import { markRender, measureAsync } from "../src/observability/perf";
import { useAppTheme } from "../src/ui/app-theme";
import { Button } from "../src/ui/Button";
import { ScreenBackdrop } from "../src/components/ui/ScreenBackdrop";
import { ScreenHeader } from "../src/ui/ScreenHeader";
import { GoAtletaIcon } from "../src/ui/icon-registry";



export default function LoginScreen() {
  markRender("screen.login.render.root");

  const { colors, mode } = useAppTheme();
  const useNativeDriver = Platform.OS !== "web";

  const solidInputBg = colors.inputBg;
  const loginInputBg = mode === "dark" ? "#121c30" : solidInputBg;
  const { session, signIn, resetPassword, signInWithOAuth } = useAuth();
  const { unlockForLogin, markCredentialLoginSuccess } = useBiometricLock();
  const router = useRouter();
  const {
    email: prefillEmail,
    fromSignup,
    next,
    pendingHint,
    inviteCode,
    reset: resetParam,
  } = useLocalSearchParams<{
    email?: string;
    fromSignup?: string;
    next?: string;
    pendingHint?: string;
    inviteCode?: string;
    reset?: string;
  }>();
  const [email, setEmail] = useState(typeof prefillEmail === "string" ? prefillEmail.trim() : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const routeMessage = pendingHint === "1"
    ? "Conta encontrada sem vínculo ativo. Entre para validar seu convite na tela de acesso pendente."
    : fromSignup === "1" ? "Este email já está cadastrado. Entrar com os dados preenchidos." : "";
  const [message, setMessage] = useState(routeMessage);
  const [failedLoginAttempt, setFailedLoginAttempt] = useState(false);
  const requestedReset = resetParam === "1" || resetParam === "true";
  const [showReset, setShowReset] = useState(requestedReset);
  const [resetCountdown, setResetCountdown] = useState(0);
  const [resetSent, setResetSent] = useState(false);
  const [enterAnim] = useState(() => new Animated.Value(0));
  const [shakeAnim] = useState(() => new Animated.Value(0));
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberTouched, setRememberTouched] = useState(false);
  const [showRememberToast, setShowRememberToast] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricHint, setBiometricHint] = useState("");
  const [rememberToastAnim] = useState(() => new Animated.Value(0));
  const loginInFlightRef = useRef(false);
  const passwordInputRef = useRef<TextInput>(null);
  const rememberKey = "auth_remember_email";
  const loginRedirectTarget = useMemo(() => sanitizePostLoginRedirect(next), [next]);

  const runShake = useCallback((anim: Animated.Value) => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 8, duration: 50, useNativeDriver }),
      Animated.timing(anim, { toValue: -8, duration: 50, useNativeDriver }),
      Animated.timing(anim, { toValue: 6, duration: 50, useNativeDriver }),
      Animated.timing(anim, { toValue: -6, duration: 50, useNativeDriver }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver }),
    ]).start();
  }, [useNativeDriver]);

  useEffect(() => {
    if (resetCountdown <= 0) return;
    const timer = setInterval(() => {
      setResetCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resetCountdown]);

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await measureAsync(
        "screen.login.load.rememberedEmail",
        () => AsyncStorage.getItem(rememberKey)
      );
      if (!active) return;
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const routeInput = [prefillEmail, routeMessage, requestedReset].join("|");
  const [appliedRouteInput, setAppliedRouteInput] = useState(routeInput);
  if (appliedRouteInput !== routeInput) {
    setAppliedRouteInput(routeInput);
    if (requestedReset) setShowReset(true);
    if (typeof prefillEmail === "string" && prefillEmail.trim()) setEmail(prefillEmail.trim());
    if (routeMessage) setMessage(routeMessage);
  }
  useEffect(() => {
    if (typeof inviteCode === "string" && inviteCode.trim()) {
      void savePendingTrainerInvite(inviteCode);
    }
  }, [inviteCode]);


  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver,
    }).start();
  }, [enterAnim, useNativeDriver]);

  useEffect(() => {
    if (!showRememberToast) return;
    rememberToastAnim.setValue(0);
    Animated.timing(rememberToastAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(rememberToastAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver,
      }).start(() => setShowRememberToast(false));
    }, 1800);
    return () => clearTimeout(timer);
  }, [rememberToastAnim, showRememberToast, useNativeDriver]);

  useEffect(() => {
    if (!rememberMe) {
      void AsyncStorage.removeItem(rememberKey);
      return;
    }
    if (!email.trim()) {
      void AsyncStorage.removeItem(rememberKey);
      return;
    }
    void AsyncStorage.setItem(rememberKey, email.trim());
  }, [email, rememberMe]);

  useEffect(() => {
    if (!showReset && resetCountdown > 0) {
      Promise.resolve().then(() => {
        setResetCountdown(0);
      });
    }
    if (!showReset && resetSent) {
      Promise.resolve().then(() => {
        setResetSent(false);
      });
    }
  }, [showReset, resetCountdown, resetSent]);

  const refreshBiometricAvailability = useCallback(async () => {
    if (Platform.OS === "web") {
      setBiometricAvailable(false);
      setBiometricHint("");
      return;
    }
    try {
      const [enabled, storedSession, support] = await Promise.all([
        getBiometricsEnabled(),
        hasStoredSession(),
        isBiometricsSupported(),
      ]);
      if (!enabled || !storedSession) {
        setBiometricAvailable(false);
        setBiometricHint("");
        return;
      }
      if (!support.hasHardware) {
        setBiometricAvailable(false);
        setBiometricHint("Biometria indisponivel neste aparelho.");
        return;
      }
      if (!support.isEnrolled) {
        setBiometricAvailable(false);
        setBiometricHint("Cadastre biometria no aparelho para usar este acesso.");
        return;
      }
      setBiometricAvailable(true);
      setBiometricHint("");
    } catch {
      setBiometricAvailable(false);
      setBiometricHint("");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshBiometricAvailability();
      return undefined;
    }, [refreshBiometricAvailability])
  );

  useEffect(() => {
    if (!session) return;
    let alive = true;
    void (async () => {
      const [pendingStudentToken, pendingRelationshipToken, storedTrainerCode] = await Promise.all([
        getPendingInvite(),
        getPendingRelationshipInvite(),
        getPendingTrainerInvite(),
      ]);
      if (!alive) return;
      const pendingTrainerCode = resolvePendingTrainerCode({
        routeCode: typeof inviteCode === "string" ? inviteCode : undefined,
        storedCode: storedTrainerCode,
      });
      const target = resolvePendingInviteRedirect({
        pendingStudentToken,
        pendingTrainerCode,
        pendingRelationshipToken,
        defaultTarget: loginRedirectTarget ?? "/",
      });
      router.replace(target as Parameters<typeof router.replace>[0]);
    })();
    return () => {
      alive = false;
    };
  }, [inviteCode, loginRedirectTarget, router, session]);

  const formatCountdown = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const getLoginErrorMessage = (error: unknown) => {
    const detail = error instanceof Error ? error.message : "Falha ao autenticar.";
    const normalized = detail.toLowerCase();
    if (!isSupabaseConfigured || normalized === "not found") {
      return "Configuração local do Supabase ausente. Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env.local e reinicie o servidor.";
    }
    if (
      normalized.includes("invalid login") ||
      normalized.includes("invalid credentials") ||
      normalized.includes("login credentials")
    ) {
      return "!Conta não encontrada ou senha incorreta.";
    }
    if (
      normalized.includes("email not confirmed") ||
      normalized.includes("email_not_confirmed") ||
      normalized.includes("not confirmed")
    ) {
      return "!Email ainda não confirmado. Verifique sua caixa de entrada antes de entrar.";
    }
    if (
      normalized.includes("failed to fetch") ||
      normalized.includes("network request failed") ||
      normalized.includes("fetch failed")
    ) {
      return "Não foi possível conectar ao Supabase. Verifique sua internet e as variáveis do ambiente.";
    }
    if (
      normalized.includes("api key") ||
      normalized.includes("jwt") ||
      normalized.includes("invalid token") ||
      normalized.includes("project not found")
    ) {
      return "Configuração do Supabase inválida. Revise EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.";
    }
    return detail && detail !== "Falha ao autenticar."
      ? detail
      : "Não foi possível concluir. Verifique os dados e tente novamente.";
  };

  const handleLogin = async () => {
    if (busy || loginInFlightRef.current) return;
    if (!email.trim()) {
      setMessage("Informe seu email.");
      runShake(shakeAnim);
      return;
    }
    if (!password.trim()) {
      setMessage("Informe sua senha.");
      runShake(shakeAnim);
      return;
    }
    if (!isSupabaseConfigured) {
      setMessage("Configuração local do Supabase ausente. Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env.local e reinicie o servidor.");
      runShake(shakeAnim);
      return;
    }
    setMessage("");
    loginInFlightRef.current = true;
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      markCredentialLoginSuccess();
      setFailedLoginAttempt(false);
    } catch (error) {
      const nextMessage = getLoginErrorMessage(error);
      setMessage(nextMessage);
      setFailedLoginAttempt(
        nextMessage.startsWith("!Email ou senha incorretos.") ||
          nextMessage.startsWith("!Conta não encontrada")
      );
      runShake(shakeAnim);
    } finally {
      loginInFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (busy) return;
    if (!email.trim()) {
      setMessage("Informe seu email.");
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const webOrigin =
        Platform.OS === "web" && typeof window !== "undefined"
           ? window.location.origin
          : "";
      const redirectTo =
        Platform.OS === "web"
           ? `${webOrigin || "http://localhost:8081"}/reset-password`
          : Linking.createURL("reset-password");
      await resetPassword(email.trim(), redirectTo);
      setMessage("");
      setResetCountdown(180);
      setResetSent(true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao enviar link.";
      const normalized = detail.toLowerCase();
      if (normalized.includes("rate limit")) {
        setMessage("Limite de envios atingido no Supabase. Aguarde alguns minutos e tente novamente.");
      } else if (normalized.includes("redirect")) {
        setMessage("URL de redirecionamento não autorizada nas configurações do Supabase.");
      } else {
        setMessage(detail || "Não foi possível enviar o link. Verifique o email e tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: "google" | "facebook" | "apple") => {
    setMessage("");
    setBusy(true);
    try {
      const redirectPath = loginRedirectTarget
        ? `login?next=${encodeURIComponent(loginRedirectTarget)}`
        : "login";
      await signInWithOAuth(provider, redirectPath);
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

  const handleBiometricLogin = async () => {
    if (busy || biometricBusy) return;
    setMessage("");
    setBiometricBusy(true);
    try {
      const ok = await unlockForLogin("Entrar no Go Atleta");
      if (!ok) {
        setMessage("Nao foi possivel validar biometria. Use email e senha.");
        return;
      }
    } finally {
      setBiometricBusy(false);
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
            { showRememberToast && rememberTouched ? (
              <Animated.View
                accessibilityLiveRegion="polite"
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: mode === "light" ? "rgba(15, 23, 42, 0.08)" : colors.border,
                  opacity: rememberToastAnim,
                  transform: [
                    {
                      translateY: rememberToastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [6, 0],
                      }),
                    },
                  ],
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  E-mail não será lembrado.
                </Text>
              </Animated.View>
            ) : null}
            <Pressable
              accessibilityLabel={showReset ? "Voltar para entrar" : "Voltar"}
              accessibilityRole="button"
              onPress={() => {
                if (showReset) {
                  setShowReset(false);
                  setMessage("");
                } else if (router.canGoBack()) {
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
              title={showReset ? "Recuperar senha" : "Bem-vindo de volta"}
              subtitle={showReset ? "Digite seu e-mail para receber o link de acesso." : "Retome seus planos com foco e praticidade."}
            />

            <Animated.View
              style={{
                padding: 18,
                borderRadius: 22,
                backgroundColor: colors.card,
                borderWidth: 0,
                overflow: "visible",
                gap: 14,
                opacity: enterAnim,
                transform: [
                  {
                    translateY: enterAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                  { translateX: shakeAnim },
                ],
                ...(Platform.OS === "web"
                    ? { boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.16)" }
                    : {
                        shadowColor: "#000",
                        shadowOpacity: 0.16,
                        shadowRadius: 16,
                        shadowOffset: { width: 0, height: 8 },
                        elevation: 5,
                      }),
              }}
            >
              <View style={{ position: "relative", zIndex: message && (fromSignup === "1" || message.toLowerCase().includes("email")) ? 50 : 1 }}>
                { message && (fromSignup === "1" || message.toLowerCase().includes("email")) ? (
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
                        {message.startsWith("!") ? message.slice(1) : message}
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
                    borderWidth: message && (fromSignup === "1" || message.toLowerCase().includes("email")) ? 2 : 1,
                    borderColor: message && (fromSignup === "1" || message.toLowerCase().includes("email"))
                      ? colors.dangerSolidBg
                      : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    backgroundColor: loginInputBg,
                    overflow: "hidden",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    minHeight: 50,
                    justifyContent: "center",
                  }}
                >
                  <TextInput
                    accessibilityLabel="E-mail"
                    nativeID="login-email"
                    placeholder="Email"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (message) setMessage("");
                    }}
                    onSubmitEditing={() => {
                      if (showReset) {
                        void handleReset();
                        return;
                      }
                      passwordInputRef.current?.focus();
                    }}
                    placeholderTextColor={colors.placeholder}
                    keyboardType="email-address"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType={showReset ? "send" : "next"}
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
                      ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
                    }}
                  />
                </View>
              </View>

              { !showReset ? (
                <>
                  <View style={{ position: "relative", zIndex: message && !(fromSignup === "1" || message.toLowerCase().includes("email")) ? 50 : 1 }}>
                    { message && !(fromSignup === "1" || message.toLowerCase().includes("email")) ? (
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
                            {message.startsWith("!") ? message.slice(1) : message}
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
                        borderColor: message && !(fromSignup === "1" || message.toLowerCase().includes("email")) ? colors.dangerSolidBg : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: loginInputBg,
                        overflow: "hidden",
                        height: 50,
                      }}
                    >
                      <TextInput
                        accessibilityLabel="Senha"
                        ref={passwordInputRef}
                        nativeID="login-password"
                        placeholder="Senha"
                        value={password}
                        onChangeText={(v) => {
                          setPassword(v);
                          if (message) setMessage("");
                        }}
                        onSubmitEditing={() => {
                          void handleLogin();
                        }}
                        placeholderTextColor={colors.placeholder}
                        autoComplete="current-password"
                        autoCorrect={false}
                        secureTextEntry={!showPassword}
                        returnKeyType="go"
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
                          ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
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
                          marginLeft: 8,
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
                  </View>

                <Button
                  label="Entrar"
                  loadingLabel="Entrando..."
                  onPress={handleLogin}
                  disabled={busy || !email.trim() || !password.trim()}
                  loading={busy}
                />

                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: rememberMe }}
                    onPress={() => {
                      setRememberTouched(true);
                      setRememberMe((current) => {
                        const next = !current;
                        if (!next) {
                          setShowRememberToast(true);
                        }
                        return next;
                      });
                    }}
                    suppressWebHoverFeedback
                    style={({ pressed }: any) => ({
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 4,
                      backgroundColor: "transparent",
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    {({ hovered }: any) => (
                      <>
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: rememberMe
                              ? colors.primaryBg
                              : hovered
                              ? colors.primaryBg
                              : colors.border,
                            backgroundColor: rememberMe ? colors.primaryBg : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          { rememberMe ? (
                            <GoAtletaIcon name="checkmark" size={12} color={colors.primaryText} />
                          ) : null}
                        </View>
                        <Text style={{ color: hovered ? colors.text : colors.muted }}>
                          Lembrar meu e-mail
                        </Text>
                      </>
                    )}
                  </Pressable>

                  { failedLoginAttempt && password.length > 0 ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => {
                        setShowReset(true);
                        setMessage("");
                      }}
                      suppressWebHoverFeedback
                      style={({ pressed }: any) => ({
                        alignSelf: "center",
                        paddingVertical: 6,
                        backgroundColor: "transparent",
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      {({ hovered }: any) => (
                        <Text
                          style={{
                            color: hovered ? colors.text : colors.muted,
                            textDecorationLine: hovered ? "underline" : "none",
                          }}
                        >
                          Esqueceu a senha?
                        </Text>
                      )}
                    </Pressable>
                  ) : null}

                  {biometricAvailable ? (
                    <Button
                      label={biometricBusy ? "Validando biometria..." : "Entrar com biometria"}
                      onPress={handleBiometricLogin}
                      disabled={busy || biometricBusy}
                      loading={biometricBusy}
                    />
                  ) : null}
                  {!biometricAvailable && biometricHint ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{biometricHint}</Text>
                  ) : null}
                </>
              ) : (
                <View style={{ gap: 14, position: "relative", zIndex: 10 }}>
                  { message ? (
                    <View
                      accessibilityRole="alert"
                      style={{
                        position: "absolute",
                        top: -38,
                        left: 0,
                        zIndex: 20,
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
                          {message.startsWith("!") ? message.slice(1) : message}
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

                  <Button
                    label={
                      resetCountdown > 0
                        ? `Reenviar em ${formatCountdown(resetCountdown)}`
                        : resetSent
                        ? "Reenviar link"
                        : "Enviar link"
                    }
                    loadingLabel="Enviando link..."
                    onPress={handleReset}
                    disabled={busy || resetCountdown > 0 || !email.trim()}
                    loading={busy}
                  />
                </View>
              )}
            </Animated.View>

            {!showReset ? (
              <View style={{ marginTop: 12, gap: 10 }}>
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
                    accessibilityLabel="Entrar com Google"
                    accessibilityRole="button"
                    onPress={() => handleOAuth("google")}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: mode === "light" ? "rgba(15, 23, 42, 0.08)" : colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <GoAtletaIcon name="google" size={20} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.muted }}>Não tem conta?</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.replace("/signup")}
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
                    Criar conta
                  </Text>
                )}
              </Pressable>
            </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
