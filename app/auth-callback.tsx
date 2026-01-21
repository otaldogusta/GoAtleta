import { useEffect, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { useAuth } from "../src/auth/auth";
import { useAppTheme } from "../src/ui/app-theme";

export default function AuthCallbackScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { session, signIn: _signIn } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get token from hash
        if (typeof window === "undefined") return;
        const hash = window.location.hash.replace(/^#/, "");
        if (!hash) {
          throw new Error("No token found");
        }

        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");

        if (!accessToken) {
          throw new Error("No access token");
        }

        // Token was already saved by Supabase redirect
        // Just wait for session to be loaded, then redirect
        if (session) {
          // Clear the hash and redirect
          window.history.replaceState(null, "", window.location.pathname);
          router.replace("/");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Auth failed");
      }
    };

    handleCallback();
  }, [session, router]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text }}>Erro: {error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.text, marginTop: 16 }}>Processando login...</Text>
    </View>
  );
}
