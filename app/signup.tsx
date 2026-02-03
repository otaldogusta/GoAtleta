import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { Pressable } from "../src/ui/Pressable";

import { claimTrainerInvite } from "../src/api/trainer-invite";
import { useAuth } from "../src/auth/auth";
import { useAppTheme } from "../src/ui/app-theme";

export default function SignupScreen() {
  const { colors, mode } = useAppTheme();
  const { signUp } = useAuth();
  const solidInputBg =
    mode === "dark" ? "rgba(10, 16, 29, 0.25)" : "rgba(255, 255, 255, 0.12)";
  const webAutofillStyle =
    Platform.OS === "web"
      ? {
          WebkitBoxShadow: `0 0 0 1000px ${solidInputBg} inset`,
          boxShadow: `0 0 0 1000px ${solidInputBg} inset`,
          WebkitTextFillColor: colors.inputText,
          caretColor: colors.inputText,
          backgroundColor: "transparent",
          WebkitBackgroundClip: "padding-box",
          backgroundClip: "padding-box",
          filter: "none",
        }
      : null;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState<"student" | "trainer">("student");
  const [inviteCode, setInviteCode] = useState("");
  const strengthAnim = useRef(new Animated.Value(0)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;

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
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  const handleSignup = async () => {
    if (!email.trim()) {
      setMessage("Informe seu email.");
      return;
    }
    if (!password.trim()) {
      setMessage("Informe sua senha.");
      return;
    }
    if (password.trim().length < 6) {
      setMessage("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (confirm && confirm !== password) {
      setMessage("As senhas não conferem.");
      return;
    }
    if (role === "trainer" && !inviteCode.trim()) {
      setMessage("Informe o código de convite para treinador.");
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const session = await signUp(email.trim(), password);
      if (role === "trainer") {
        if (session) {
          await claimTrainerInvite(inviteCode.trim());
          setMessage("Conta criada e convite validado.");
        } else {
          setMessage(
            "Conta criada. Confirme o email e depois valide o convite ao entrar."
          );
        }
      } else {
        setMessage("Conta criada! Verifique o email se precisar confirmar.");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao cadastrar.";
      const normalized = detail.toLowerCase();
      if (normalized.includes("user already registered")) {
        setMessage("Esse email já esta cadastrado.");
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
                Comece agora
              </Text>
              <Text style={{ color: colors.muted }}>
                Monte planos, turmas e calendários no seu ritmo.
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
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  backgroundColor: solidInputBg,
                  overflow: "hidden",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 48,
                }}
              >

                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
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
                    outlineStyle: "none",
                    outlineWidth: 0,
                    ...(webAutofillStyle || {}),
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
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: solidInputBg,
                  overflow: "hidden",
                  minHeight: 48,
                }}
              >

                <TextInput
                  placeholder="Senha"
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showPassword}
                  underlineColorAndroid="transparent"
                  selectionColor={colors.primaryBg}
                  style={{
                    flex: 1,
                    padding: 0,
                    color: colors.inputText,
                    backgroundColor: "transparent",
                    outlineStyle: "none",
                    outlineWidth: 0,
                    ...(webAutofillStyle || {}),
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

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: solidInputBg,
                  overflow: "hidden",
                  minHeight: 48,
                }}
              >

                <TextInput
                  placeholder="Confirmar senha"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showConfirm}
                  underlineColorAndroid="transparent"
                  selectionColor={colors.primaryBg}
                  style={{
                    flex: 1,
                    padding: 0,
                    color: colors.inputText,
                    backgroundColor: "transparent",
                    outlineStyle: "none",
                    outlineWidth: 0,
                    ...(webAutofillStyle || {}),
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

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Quero acessar como
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { id: "student", label: "Aluno" },
                    { id: "trainer", label: "Treinador" },
                  ].map((option) => {
                    const active = role === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => {
                          setRole(option.id as "student" | "trainer");
                          if (option.id === "student") {
                            setInviteCode("");
                          }
                        }}
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
              </View>

              {role === "trainer" ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    backgroundColor: solidInputBg,
                    overflow: "hidden",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    minHeight: 48,
                  }}
                >

                  <TextInput
                    placeholder="Código de convite"
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
                      outlineStyle: "none",
                      outlineWidth: 0,
                        ...(webAutofillStyle || {}),
                    }}
                  />
                </View>
              ) : null}

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

              <Pressable
                onPress={handleSignup}
                disabled={busy}
                style={{
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: busy ? colors.primaryDisabledBg : colors.primaryBg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  Criar conta
                </Text>
              </Pressable>
            </View>

            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.muted }}>JÁ tem conta?</Text>
              <Pressable
                onPress={() => router.replace("/login")}
                style={{ paddingVertical: 4 }}
              >
                <Text style={{ color: colors.primaryBg, fontWeight: "700" }}>
                  Entrar
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
