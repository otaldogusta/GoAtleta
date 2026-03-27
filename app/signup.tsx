import { Ionicons } from "@expo/vector-icons";
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
import { Pressable } from "../src/ui/Pressable";

import { claimTrainerInvite } from "../src/api/trainer-invite";
import { useAuth } from "../src/auth/auth";
import { useAppTheme } from "../src/ui/app-theme";
import { ScreenBackdrop } from "../src/components/ui/ScreenBackdrop";
import { ScreenHeader } from "../src/ui/ScreenHeader";

export default function SignupScreen() {
  const { colors, mode } = useAppTheme();
  const { signUp, signInWithOAuth } = useAuth();
  const { inviteCode: inviteCodeParam } = useLocalSearchParams<{
    inviteCode?: string;
  }>();
  const solidInputBg = colors.inputBg;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const strengthAnim = useRef(new Animated.Value(0)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;
  const passwordShakeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [passwordTooShort, setPasswordTooShort] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);

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
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  useEffect(() => {
    if (hasInviteCodeFromLink) {
      setInviteCode(inviteCodeParam.trim());
    }
  }, [hasInviteCodeFromLink, inviteCodeParam]);

  const runShake = (anim: Animated.Value) => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

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
      setPasswordTooShort(true);
      runShake(passwordShakeAnim);
      return;
    }
    if (confirm && confirm !== password) {
      setConfirmMismatch(true);
      runShake(shakeAnim);
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const session = await signUp(email.trim(), password, "login", "");
      if (inviteCode.trim()) {
        if (session) {
          await claimTrainerInvite(inviteCode.trim());
          setMessage("Conta criada e convite validado. Confirme o e-mail por código para liberar acesso completo.");
        } else {
          setMessage(
            "Conta criada. Confirme o email e depois valide o convite ao entrar."
          );
        }
      } else {
        setMessage("Conta criada! Você já pode entrar, mas o app pedirá confirmação por código para ações sensíveis.");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao cadastrar.";
      const normalized = detail.toLowerCase();
      if (normalized.includes("user already registered")) {
        router.replace({
          pathname: "/login",
          params: {
            email: email.trim(),
            password,
            fromSignup: "1",
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
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chevron-back" size={16} color={colors.text} />
              </View>
            </Pressable>

            <ScreenHeader
              title="Comece agora"
              subtitle="Monte planos, turmas e calendários no seu ritmo."
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
                  }}
                />
              </View>

              <Animated.View style={{ transform: [{ translateX: passwordShakeAnim }] }}>
                {passwordTooShort ? (
                  <View style={{ position: "relative", marginBottom: 6 }}>
                    <View
                      style={{
                        backgroundColor: colors.dangerSolidBg,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Text style={{ color: colors.dangerSolidText, fontSize: 12, fontWeight: "600" }}>
                        A senha precisa ter pelo menos 6 caracteres.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 0,
                        height: 0,
                        marginLeft: 16,
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
                    borderColor: passwordTooShort ? colors.dangerSolidBg : colors.border,
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
                    onChangeText={(v) => {
                      setPassword(v);
                      if (passwordTooShort && v.trim().length >= 6) {
                        setPasswordTooShort(false);
                      }
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
                    }}
                  />
                  { password.length > 0 ? (
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
              </Animated.View>

              { password.length > 0 ? (
                <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                  {confirmMismatch ? (
                    <View style={{ position: "relative", marginBottom: 6 }}>
                      <View
                        style={{
                          backgroundColor: colors.dangerSolidBg,
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ color: colors.dangerSolidText, fontSize: 12, fontWeight: "600" }}>
                          As senhas não conferem
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 0,
                          height: 0,
                          marginLeft: 16,
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
                      borderColor: confirmMismatch ? colors.dangerSolidBg : colors.border,
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
                      onChangeText={(v) => {
                        setConfirm(v);
                        if (confirmMismatch) setConfirmMismatch(false);
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
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 999,
                              backgroundColor: colors.secondaryBg,
                              overflow: "hidden",
                            }}
                          >
                            <Animated.View
                              style={{ height: "100%", width: fillWidth, backgroundColor: segmentColor }}
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

              {!hasInviteCodeFromLink ? (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="key-outline" size={13} color={colors.muted} />
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
                      placeholder="Opcional — recebido por link ou email"
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
                      }}
                    />
                    {inviteCode.length > 0 ? (
                      <Pressable onPress={() => setInviteCode("")} style={{ paddingLeft: 4 }}>
                        <Ionicons name="close-circle" size={16} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              { message ? (
                <View style={{ gap: 8 }}>
                  <Text
                    style={{
                      color: message.startsWith("!")
                        ? colors.dangerSolidBg
                        : colors.muted,
                    }}
                  >
                    {message.startsWith("!") ? message.slice(1) : message}
                  </Text>
                  {email.trim() ? (
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
                  <Ionicons name="logo-google" size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.muted }}>Já tem conta?</Text>
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
    </View>
  );
}
