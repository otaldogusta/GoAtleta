import {
  useEffect,
  useRef,
  useState } from "react";
import {
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "../src/auth/auth";
import { useAppTheme } from "../src/ui/app-theme";
import { setRememberPreference } from "../src/auth/session";
import { Button } from "../src/ui/Button";
import { ScreenHeader } from "../src/ui/ScreenHeader";

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const { signIn, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failedLoginAttempt, setFailedLoginAttempt] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);
  const [resetSent, setResetSent] = useState(false);
  const enterAnim = useRef(new Animated.Value(0)).current;
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberTouched, setRememberTouched] = useState(false);
  const [showRememberToast, setShowRememberToast] = useState(false);
  const rememberToastAnim = useRef(new Animated.Value(0)).current;
  const rememberMeRef = useRef(false);
  const rememberKey = "auth_remember_email";

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
      const saved = await AsyncStorage.getItem(rememberKey);
      if (!active) return;
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
        rememberMeRef.current = true;
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    rememberMeRef.current = rememberMe;
  }, [rememberMe]);

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  useEffect(() => {
    if (!showRememberToast) return;
    rememberToastAnim.setValue(0);
    Animated.timing(rememberToastAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(rememberToastAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setShowRememberToast(false));
    }, 1800);
    return () => clearTimeout(timer);
  }, [rememberToastAnim, showRememberToast]);

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
    if (!rememberTouched) return;
    void setRememberPreference(rememberMe);
  }, [rememberMe, rememberTouched]);

  useEffect(() => {
    if (!showReset && resetCountdown > 0) {
      setResetCountdown(0);
    }
    if (!showReset && resetSent) {
      setResetSent(false);
    }
  }, [showReset, resetCountdown, resetSent]);

  const formatCountdown = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      setMessage("Informe seu email.");
      return;
    }
    if (!password.trim()) {
      setMessage("Informe sua senha.");
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      await signIn(email.trim(), password, rememberMeRef.current);
      setFailedLoginAttempt(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao autenticar.";
      const normalized = detail.toLowerCase();
      if (normalized.includes("invalid login")) {
        setMessage("!Email ou senha incorretos.");
        setFailedLoginAttempt(true);
      } else {
        setMessage("Nao foi possivel concluir. Verifique os dados e tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
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
      setMessage("Enviamos um link de recuperacao para seu email.");
      setResetCountdown(180);
      setResetSent(true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao enviar link.";
      setMessage(
        detail.toLowerCase().includes("rate limit")
          ? "Aguarde alguns minutos e tente novamente."
          : "Nao foi possivel enviar o link. Verifique o email e tente novamente."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
            {showRememberToast && rememberTouched ? (
              <Animated.View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
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
                  Sessao nao sera lembrada.
                </Text>
              </Animated.View>
            ) : null}
            <Pressable
              onPress={() => router.replace("/welcome")}
              style={{ alignSelf: "flex-start" }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Ionicons name="chevron-back" size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "600" }}>Voltar</Text>
              </View>
            </Pressable>

            <ScreenHeader
              title="Bem-vindo de volta"
              subtitle="Retome seus planos com foco e praticidade."
            />

            <View
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
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  backgroundColor: colors.inputBg,
                  overflow: "hidden",
                }}
              >
                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor={colors.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    padding: 12,
                    color: colors.inputText,
                    backgroundColor: "transparent",
                    borderWidth: 0,
                    outlineStyle: "none",
                    outlineWidth: 0,
                  }}
                />
              </View>

              {!showReset ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      backgroundColor: colors.inputBg,
                    }}
                  >
                    <TextInput
                      placeholder="Senha"
                      value={password}
                      onChangeText={setPassword}
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry={!showPassword}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        color: colors.inputText,
                        outlineStyle: "none",
                        outlineWidth: 0,
                      }}
                    />
                    {password.length > 0 ? (
                      <Pressable
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={{ paddingLeft: 8, paddingVertical: 8 }}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off" : "eye"}
                          size={18}
                          color={colors.muted}
                        />
                      </Pressable>
                    ) : null}
                  </View>

                  {message ? (
                    <Text
                      style={{
                        color: message.startsWith("!")
                          ? colors.dangerSolidBg
                          : colors.muted,
                      }}
                    >
                      {message.startsWith("!") ? message.slice(1) : message}
                    </Text>
                  ) : null}

                <Button
                  label="Entrar"
                  onPress={handleLogin}
                  disabled={busy}
                  loading={busy}
                />

                  <Pressable
                    onPress={() => {
                      setRememberTouched(true);
                      setRememberMe((current) => {
                        const next = !current;
                        rememberMeRef.current = next;
                        if (!next) {
                          setShowRememberToast(true);
                        }
                        return next;
                      });
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: rememberMe ? colors.primaryBg : colors.border,
                        backgroundColor: rememberMe ? colors.primaryBg : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {rememberMe ? (
                        <Ionicons name="checkmark" size={12} color={colors.primaryText} />
                      ) : null}
                    </View>
                    <Text style={{ color: colors.muted }}>Lembre de mim</Text>
                  </Pressable>

                  {failedLoginAttempt && password.length > 0 ? (
                    <Pressable
                      onPress={() => {
                        setShowReset(true);
                        setMessage("");
                      }}
                      style={{ alignSelf: "center", paddingVertical: 6 }}
                    >
                      <Text style={{ color: colors.muted }}>Esqueceu a senha?</Text>
                    </Pressable>
                  ) : null}

                  <View style={{ marginTop: 12, gap: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Ou continue com
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 12,
                      }}
                    >
                      {[
                        { label: "Google", icon: "logo-google" as const },
                        { label: "Facebook", icon: "logo-facebook" as const },
                        { label: "Apple", icon: "logo-apple" as const },
                      ].map((provider) => (
                        <Pressable
                          key={provider.label}
                          onPress={() => {}}
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
                          <Ionicons
                            name={provider.icon}
                            size={20}
                            color={colors.text}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </>
              ) : (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: colors.muted }}>
                    Enviaremos um link para criar uma nova senha.
                  </Text>

                  {message ? (
                    <Text
                      style={{
                        color: message.startsWith("!")
                          ? colors.dangerSolidBg
                          : colors.muted,
                      }}
                    >
                      {message.startsWith("!") ? message.slice(1) : message}
                    </Text>
                  ) : null}

                  {resetCountdown > 0 ? (
                    <Text style={{ color: colors.muted }}>
                      Tempo restante: {formatCountdown(resetCountdown)}
                    </Text>
                  ) : null}

                  <Button
                    label="Enviar link"
                    onPress={handleReset}
                    disabled={busy || resetCountdown > 0}
                    loading={busy}
                  />

                  {resetSent && resetCountdown === 0 ? (
                    <Pressable
                      onPress={handleReset}
                      disabled={busy}
                      style={{ alignSelf: "center", paddingVertical: 6 }}
                    >
                      <Text style={{ color: colors.primaryBg, fontWeight: "700" }}>
                        Nao recebeu o link? Clique aqui
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      setShowReset(false);
                      setMessage("");
                    }}
                    style={{ alignSelf: "center", paddingVertical: 6 }}
                  >
                    <Text style={{ color: colors.muted }}>Voltar para login</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.muted }}>Nao tem conta?</Text>
              <Pressable
                onPress={() => router.replace("/signup")}
                style={{ paddingVertical: 4 }}
              >
                <Text style={{ color: colors.primaryBg, fontWeight: "700" }}>
                  Criar conta
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {busy && !showReset ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(11, 18, 32, 0.55)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              gap: 10,
            }}
          >
            <ActivityIndicator color={colors.primaryBg} />
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Entrando...
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
