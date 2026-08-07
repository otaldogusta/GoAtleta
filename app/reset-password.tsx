import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
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

import { updatePasswordWithAccessToken } from "../src/api/auth-password";
import { useAuth } from "../src/auth/auth";
import { ScreenHeader } from "../src/ui/ScreenHeader";
import { markRender } from "../src/observability/perf";
import { useAppTheme } from "../src/ui/app-theme";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import { Button } from "../src/ui/Button";
import { Pressable } from "../src/ui/Pressable";

const parseAccessToken = (url: string | null) => {
  if (!url) return "";
  const [base, hash] = url.split("#");
  const query = hash || (base.includes("?") ? base.split("?")[1] : "");
  if (!query) return "";
  const params = new URLSearchParams(query);
  return params.get("access_token") ?? "";
};

const checkIsExpiredLink = (url: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("otp_expired") ||
    lower.includes("expired") ||
    (lower.includes("error=") && lower.includes("access_denied"))
  );
};

const formatResetError = (raw: string) => {
  try {
    const parsed = JSON.parse(raw) as { error_code: string; msg: string };
    if (parsed.error_code === "same_password") {
      return "A nova senha precisa ser diferente da anterior.";
    }
    if (parsed.msg) {
      return parsed.msg;
    }
  } catch {
    // ignore parse error
  }
  const normalized = raw.toLowerCase();
  if (normalized.includes("same_password")) {
    return "A nova senha precisa ser diferente da anterior.";
  }
  if (normalized.includes("invalid") || normalized.includes("expired") || normalized.includes("token")) {
    return "Link de recuperação inválido ou expirado.";
  }
  return raw.replace(/\s+/g, " ");
};

// perf-check: ignore-measure - token recovery is derived from route and URL;
export default function ResetPasswordScreen() {
  markRender("screen.resetPassword.render.root");
  const { colors, mode } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();

  const [token, setToken] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const [enterAnim] = useState(() => new Animated.Value(0));
  const [shakeAnim] = useState(() => new Animated.Value(0));
  const [strengthAnim] = useState(() => new Animated.Value(0));

  const solidInputBg = colors.inputBg;
  const loginInputBg = mode === "dark" ? "#121c30" : solidInputBg;

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

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

  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: strengthScore,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [strengthAnim, strengthScore]);

  useEffect(() => {
    // 1. Check search/hash parameters on Web
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const fullUrl = window.location.href;
      if (checkIsExpiredLink(fullUrl)) {
        setIsExpired(true);
        return;
      }
      const parsedToken = parseAccessToken(fullUrl);
      if (parsedToken) {
        setToken(parsedToken);
        setIsExpired(false);
        return;
      }
    }

    // 2. Check search params from router
    if (typeof params.access_token === "string" && params.access_token) {
      setToken(params.access_token);
      setIsExpired(false);
      return;
    }

    // 3. Fallback to active session access token if available
    if (session?.access_token) {
      setToken(session.access_token);
      setIsExpired(false);
      return;
    }

    // 4. Initial URL listener for Expo/Native
    let active = true;
    void Linking.getInitialURL().then((initial) => {
      if (!active) return;
      if (checkIsExpiredLink(initial)) {
        setIsExpired(true);
        return;
      }
      const parsed = parseAccessToken(initial);
      if (parsed) {
        setToken(parsed);
        setIsExpired(false);
      }
    });

    const sub = Linking.addEventListener("url", (event) => {
      if (checkIsExpiredLink(event.url)) {
        setIsExpired(true);
        return;
      }
      const parsed = parseAccessToken(event.url);
      if (parsed) {
        setToken(parsed);
        setIsExpired(false);
      }
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, [params.access_token, session?.access_token]);

  const submit = async () => {
    if (!token) {
      setIsExpired(true);
      setMessage("Link de recuperação inválido ou expirado.");
      triggerShake();
      return;
    }
    if (!password.trim()) {
      setMessage("Informe a nova senha.");
      triggerShake();
      return;
    }
    if (password.length < 6) {
      setMessage("A senha precisa ter pelo menos 6 caracteres.");
      triggerShake();
      return;
    }
    if (password !== confirm) {
      setMessage("As senhas não conferem.");
      triggerShake();
      return;
    }

    setMessage("");
    setBusy(true);
    try {
      await updatePasswordWithAccessToken(token, password);
      setSuccess(true);
      setPassword("");
      setConfirm("");
      setToken("");
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState({}, "", "/login");
      }
      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao atualizar senha.";
      const formatted = formatResetError(detail);
      setMessage(formatted);
      if (formatted.includes("expirado") || formatted.includes("inválido")) {
        setIsExpired(true);
      }
      triggerShake();
    } finally {
      setBusy(false);
    }
  };

  const isButtonDisabled =
    busy || isExpired || success || !password.trim() || password.length < 6 || password !== confirm;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1, justifyContent: "center", maxWidth: 440, width: "100%", alignSelf: "center", gap: 18 }}>
            <Pressable
              onPress={() => router.replace("/login")}
              style={({ pressed }: any) => ({
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {({ hovered }: any) => (
                <GoAtletaIcon name="chevronBack" size={18} color={hovered ? colors.primaryBg : colors.text} />
              )}
            </Pressable>

            { isExpired ? (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <GoAtletaIcon name="warningCircle" size={26} color={colors.dangerSolidBg} />
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>
                    Link expirado
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  Solicite um novo link para cadastrar uma nova senha.
                </Text>
              </View>
            ) : (
              <ScreenHeader
                title={success ? "Senha atualizada!" : "Criar nova senha"}
                subtitle={
                  success
                    ? "Sua senha foi redefinida com sucesso. Redirecionando..."
                    : "Digite sua nova senha abaixo para recuperar o acesso."
                }
              />
            )}

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
                  ? ({ boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.16)" } as any)
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.16,
                      shadowRadius: 16,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 5,
                    }),
              }}
            >
              { isExpired ? (
                <Button
                  label="Solicitar novo link"
                  onPress={() => {
                    if (Platform.OS === "web" && typeof window !== "undefined") {
                      window.history.replaceState({}, "", "/login?reset=1");
                    }
                    router.replace({ pathname: "/login", params: { reset: "1" } });
                  }}
                />
              ) : success ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: colors.successBg,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <GoAtletaIcon name="checkmark" size={16} color={colors.successText} />
                  <Text style={{ color: colors.successText, fontSize: 13, fontWeight: "600", flex: 1 }}>
                    Senha redefinida! Redirecionando para a tela de login...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={{ position: "relative", zIndex: 10 }}>
                    { message ? (
                      <View
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
                            {message}
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
                        borderColor: message ? colors.dangerSolidBg : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: loginInputBg,
                        overflow: "hidden",
                        height: 50,
                      }}
                    >
                      <TextInput
                        nativeID="reset-password"
                        placeholder="Nova senha"
                        value={password}
                        onChangeText={(v) => {
                          setPassword(v);
                          if (message) setMessage("");
                        }}
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
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
                        }}
                      />
                      <Pressable
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

                  { password.length > 0 ? (
                    <View style={{ gap: 8, marginTop: 4 }}>
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
                    </View>
                  ) : null}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: message ? colors.dangerSolidBg : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: loginInputBg,
                      overflow: "hidden",
                      height: 50,
                    }}
                  >
                    <TextInput
                      nativeID="reset-confirm-password"
                      placeholder="Confirmar nova senha"
                      value={confirm}
                      onChangeText={(v) => {
                        setConfirm(v);
                        if (message) setMessage("");
                      }}
                      onSubmitEditing={() => {
                        void submit();
                      }}
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      autoCorrect={false}
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
                      }}
                    />
                    <Pressable
                      onPress={() => setShowConfirm((prev) => !prev)}
                      disabled={confirm.length === 0}
                      style={{
                        width: 34,
                        height: 34,
                        marginLeft: 8,
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

                  <Button
                    label="Atualizar senha"
                    loadingLabel="Atualizando senha..."
                    onPress={submit}
                    disabled={isButtonDisabled}
                    loading={busy}
                  />
                </>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
