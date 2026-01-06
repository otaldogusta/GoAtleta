import { ActivityIndicator, Text, View } from "react-native";
import { Pressable } from "../ui/Pressable";
import { useAppTheme } from "../ui/app-theme";

import { useBootstrap } from "./BootstrapProvider";

export function BootstrapGate({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const { ready, loading, error, retry } = useBootstrap();

  if (loading && !ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: 24,
          gap: 12,
        }}
      >
        <ActivityIndicator color={colors.primaryBg} />
        <Text style={{ color: colors.muted }}>Carregando...</Text>
      </View>
    );
  }

  if (error && !ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: 24,
          gap: 12,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          Ocorreu um erro ao iniciar
        </Text>
        <Text style={{ color: colors.muted, textAlign: "center" }}>
          Tente novamente. Se persistir, reinicie o app.
        </Text>
        <Pressable
          onPress={retry}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: colors.primaryBg,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            Tentar novamente
          </Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
