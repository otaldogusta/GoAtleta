import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Text, View } from "react-native";
import { Pressable } from "../ui/Pressable";
import { useAppTheme } from "../ui/app-theme";

import { useBootstrap } from "./BootstrapProvider";

export function BootstrapGate({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const { ready, loading, error, retry } = useBootstrap();

  if (loading && !ready) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={["#0b1222", "#101b34", "#121a2a"]}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
          }}
        >
          <ActivityIndicator
            size="large"
            color={colors.text}
          />
          <Text style={{ color: colors.text, fontWeight: "600" }}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (error && !ready) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={["#0b1222", "#101b34", "#121a2a"]}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
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
      </View>
    );
  }

  return <>{children}</>;
}
