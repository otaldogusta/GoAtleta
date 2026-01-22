import {
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/api/config";
import { useAppTheme } from "../src/ui/app-theme";

const parseAccessToken = (url?: string | null) => {
  if (!url) return "";
  const [base, hash] = url.split("#");
  const query = hash || (base.includes("?") ? base.split("?")[1] : "");
  if (!query) return "";
  const params = new URLSearchParams(query);
  return params.get("access_token") ?? "";
};

const formatResetError = (raw: string) => {
  try {
    const parsed = JSON.parse(raw) as { error_code?: string; msg?: string };
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
  if (normalized.includes("invalid") && normalized.includes("token")) {
    return "Link inválido ou expirado.";
  }
  return raw.replace(/\s+/g, " ");
};

export default function ResetPasswordScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const strengthAnim = useRef(new Animated.Value(0)).current;

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
    if (typeof params.access_token === "string" && params.access_token) {
      setToken(params.access_token);
      return;
    }
    let active = true;
    (async () => {
      const initial = await Linking.getInitialURL();
      if (!active) return;
      const parsed = parseAccessToken(initial);
      if (parsed) {
        setToken(parsed);
      }
    })();
    const sub = Linking.addEventListener("url", (event) => {
      const parsed = parseAccessToken(event.url);
      if (parsed) {
        setToken(parsed);
      }
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const submit = async () => {
    if (!token) {
      setMessage("Link inválido ou expirado.");
      return;
    }
    if (!password.trim()) {
      setMessage("Informe a nova senha.");
      return;
    }
    if (password.length < 6) {
      setMessage("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMessage("As senhas não coincidem.");
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch(
        SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user",
        {
          method: "PUT",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Falha ao atualizar senha.");
      }
      setMessage("Senha atualizada. Entre novamente.");
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Falha ao atualizar senha.";
      setMessage(formatResetError(detail));
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
          contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1, justifyContent: "center", gap: 18 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>
                Nova senha
              </Text>
              <Text style={{ color: colors.muted }}>
                Crie uma nova senha para sua conta.
              </Text>
            </View>

            <View
              style={{
                padding: 16,
                borderRadius: 20,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 12,
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                }}
              >
                <TextInput
                  placeholder="Nova senha"
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
              {password.length > 0 ? (
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
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  borderRadius: 12,
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

              {message ? (
                <Text style={{ color: colors.muted }}>{message}</Text>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={busy}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: busy ? colors.primaryDisabledBg : colors.primaryBg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  Atualizar senha
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace("/login")}
                style={{ alignSelf: "center", paddingVertical: 6 }}
              >
                <Text style={{ color: colors.muted }}>Voltar para login</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
