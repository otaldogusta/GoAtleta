import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "../src/auth/auth";
import { Button } from "../src/ui/Button";
import { Pressable } from "../src/ui/Pressable";
import { ScreenHeader } from "../src/ui/ScreenHeader";
import { useAppTheme } from "../src/ui/app-theme";

export default function AdminLoginScreen() {
  const { colors } = useAppTheme();
  const { signIn, session } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (session) {
      router.replace("/");
    }
  }, [router, session]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage("Informe email e senha para testar.");
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      await signIn(email.trim(), password, true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao autenticar.";
      setMessage(
        detail.toLowerCase().includes("invalid login")
          ? "Email ou senha incorretos."
          : "Não foi possível autenticar."
      );
    } finally {
      setBusy(false);
    }
  };

  if (!__DEV__) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
          <ScreenHeader
            title="Rota de teste desativada"
            subtitle="Disponivel apenas em desenvolvimento."
          />
          <Pressable
            onPress={() => router.replace("/welcome")}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
          <View style={{ flex: 1, justifyContent: "center", gap: 20 }}>
            <ScreenHeader
              title="Login de teste"
              subtitle="Rota /admin ativa apenas em desenvolvimento."
            />

            <View
              style={{
                padding: 18,
                borderRadius: 22,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 12,
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
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              <TextInput
                placeholder="Senha"
                value={password}
                onChangeText={setPassword}
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              {message ? (
                <Text style={{ color: colors.muted }}>{message}</Text>
              ) : null}
              <Button
                label="Entrar"
                onPress={handleLogin}
                disabled={busy}
                loading={busy}
              />
              <Pressable
                onPress={() => router.replace("/welcome")}
                style={{ alignSelf: "center" }}
              >
                <Text style={{ color: colors.muted }}>Voltar</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
