import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Text, View } from "react-native";
import { Pressable } from "../ui/Pressable";
import { useAppTheme } from "../ui/app-theme";
import { brandPalette, radius } from "../theme/tokens";
import { ptBR } from "../constants/copy/pt-br";

import { useBootstrap } from "./BootstrapProvider";

export function BootstrapGate({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const { ready, loading, error, retry } = useBootstrap();

  if (loading && !ready) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={[brandPalette.navyDeep, brandPalette.navy, brandPalette.graphite]}
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
          <Text style={{ color: colors.text, fontWeight: "600" }}>{ptBR.loading.generic}</Text>
          {__DEV__ ? (
            <View style={{ marginTop: 12, maxWidth: 520 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>
                Debug: bootstrap progress
              </Text>
              { }
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {(globalThis as any).__BOOTSTRAP_LOGS ? (globalThis as any).__BOOTSTRAP_LOGS.slice(-5).join(' \n') : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  if (error && !ready) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={[brandPalette.navyDeep, brandPalette.navy, brandPalette.graphite]}
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
            {ptBR.errors.startupTitle}
          </Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>
            {ptBR.errors.startupDescription}
          </Text>
          <Pressable
            onPress={retry}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: radius.internal,
              backgroundColor: colors.primaryBg,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              {ptBR.common.actions.retry}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}
