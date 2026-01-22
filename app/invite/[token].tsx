import { useEffect, useMemo, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "../../src/auth/auth";
import { useRole } from "../../src/auth/role";
import { claimStudentInvite } from "../../src/api/student-invite";
import { Pressable } from "../../src/ui/Pressable";
import { useAppTheme } from "../../src/ui/app-theme";

export default function StudentInviteScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const { session, signIn, signUp, signInWithOAuth } = useAuth();
  const { refresh } = useRole();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const strengthAnim = useRef(new Animated.Value(0)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;
  const autoClaimRef = useRef(false);

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
    if (strengthScore <= 0.66) return "Media";
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
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  const handleClaim = async () => {
    if (!tokenValue) {
      setMessage("Convite inválido.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await claimStudentInvite(tokenValue);
      await refresh();
      router.replace("/");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const lower = detail.toLowerCase();
      if (lower.includes("expired")) {
        setMessage("Convite expirado.");
      } else if (lower.includes("used")) {
        setMessage("Convite já utilizado.");
      } else if (lower.includes("invalid")) {
        setMessage("Convite inválido.");
      } else {
        setMessage("Não foi possível validar o convite.");
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!session || !tokenValue) return;
    if (autoClaimRef.current) return;
    autoClaimRef.current = true;
    void handleClaim();
  }, [session, tokenValue]);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) return false;
    if (mode === "signup" && confirm && confirm !== password) return false;
    return true;
  }, [confirm, email, mode, password]);

  const handleAuth = async () => {
    if (!tokenValue) {
      setMessage("Convite inválido.");
      return;
    }
    if (!email.trim()) {
      setMessage("Informe seu email.");
      return;
    }
    if (!password.trim()) {
      setMessage("Informe sua senha.");
      return;
    }
    if (mode === "signup" && password.trim().length < 6) {
      setMessage("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (mode === "signup" && confirm && confirm !== password) {
      setMessage("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (mode === "login") {
        await signIn(email.trim(), password, true);
        await handleClaim();
        return;
      }
      const sessionData = await signUp(email.trim(), password);
      if (sessionData) {
        await handleClaim();
        return;
      }
      setMessage("Conta criada. Confirme o email e depois volte para ativar.");
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
            <Pressable
              onPress={() => router.replace("/login")}
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

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>
                {mode === "signup" ? "Ative seu convite" : "Vincule seu acesso"}
              </Text>
              <Text style={{ color: colors.muted }}>
                {mode === "signup"
                  ? "Crie sua conta para acessar seus treinos."
                  : "Entre para vincular seu convite e continuar."}
              </Text>
            </View>

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
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { id: "signup" as const, label: "Criar conta" },
                  { id: "login" as const, label: "Entrar" },
                ].map((option) => {
                  const active = mode === option.id;
                  return (
                    <Pressable
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
                    backgroundColor: "transparent",
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

              {mode === "signup" ? (
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
                      outlineStyle: "none",
                      outlineWidth: 0,
                    }}
                  />
                  {confirm.length > 0 ? (
                    <Pressable
                      onPress={() => setShowConfirm((prev) => !prev)}
                      style={{ paddingLeft: 8, paddingVertical: 8 }}
                    >
                      <Ionicons
                        name={showConfirm ? "eye-off" : "eye"}
                        size={18}
                        color={colors.muted}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {mode === "signup" && password.length > 0 ? (
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
                        <Ionicons
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

              {message ? (
                <Text style={{ color: message.startsWith("!") ? colors.dangerSolidBg : colors.muted }}>
                  {message.startsWith("!") ? message.slice(1) : message}
                </Text>
              ) : null}

              <Pressable
                onPress={handleAuth}
                disabled={busy || !canSubmit}
                style={{
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor:
                    busy || !canSubmit ? colors.primaryDisabledBg : colors.primaryBg,
                  alignItems: "center",
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

              <View style={{ marginTop: 12, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Ou continue com</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
                  {[
                    { id: "google" as const, icon: "logo-google" as const },
                    { id: "facebook" as const, icon: "logo-facebook" as const },
                    { id: "apple" as const, icon: "logo-apple" as const },
                  ].map((provider) => (
                    <Pressable
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
                      <Ionicons name={provider.icon} size={20} color={colors.text} />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
