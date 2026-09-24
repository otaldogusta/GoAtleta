import { markRender } from "../src/observability/perf";
// perf-check: ignore-measure -- preference loading belongs to the instrumented WhatsAppSettingsProvider.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { useWhatsAppSettings } from "../src/ui/whatsapp-settings-context";
import {
  hasWhatsAppEmbeddedSignupParams,
  parseWhatsAppEmbeddedSignupResult,
} from "../src/integrations/whatsapp/embedded-signup-result";

export default function WhatsAppSettingsScreen() {
  markRender("screen.whatsappSettings.render.root");
  const { colors } = useAppTheme();
  const router = useRouter();
  const callbackParams = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_code?: string | string[];
    error_reason?: string | string[];
    error_description?: string | string[];
  }>();
  const [embeddedSignupResult] = useState(
    () => parseWhatsAppEmbeddedSignupResult(callbackParams),
  );
  const { defaultMessageEnabled, setDefaultMessageEnabled, loading } = useWhatsAppSettings();

  useEffect(() => {
    if (!hasWhatsAppEmbeddedSignupParams(callbackParams)) return;
    // Authorization codes and provider errors must not remain in browser history.
    router.replace("/whatsapp-settings");
  }, [callbackParams, router]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Text style={{ color: colors.text, padding: 16 }}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} stickyHeaderIndices={[0]}>
        <ScreenPageHeader
          title="Configurações WhatsApp"
          onBack={() => navigateBackOrReplace({ router, fallback: "/prof/home" })}
        />

        {embeddedSignupResult.kind !== "idle" ? (
          <View
            style={{
              borderRadius: 12,
              padding: 12,
              backgroundColor: embeddedSignupResult.kind === "returned" ? "#E8F5E9" : "#FFF3E0",
              borderWidth: 1,
              borderColor: embeddedSignupResult.kind === "returned" ? "#A5D6A7" : "#FFCC80",
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: embeddedSignupResult.kind === "returned" ? "#2E7D32" : "#E65100",
              }}
            >
              {embeddedSignupResult.kind === "returned"
                ? "Retorno da Meta recebido"
                : embeddedSignupResult.kind === "cancelled"
                  ? "Conexão cancelada"
                  : "Conexão não concluída"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: embeddedSignupResult.kind === "returned" ? "#2E7D32" : "#E65100",
              }}
            >
              {embeddedSignupResult.kind === "returned"
                ? "A conexão só será ativada após a confirmação segura no servidor."
                : embeddedSignupResult.kind === "cancelled"
                  ? "Nenhuma alteração foi feita no seu WhatsApp."
                  : embeddedSignupResult.message}
            </Text>
          </View>
        ) : null}

        {/* Toggle Card */}
        <View
          style={{
            borderRadius: 16,
            padding: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Mensagem padrão
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Inclui mensagem automática ao abrir WhatsApp
              </Text>
            </View>
            <Pressable
              onPress={() => setDefaultMessageEnabled(!defaultMessageEnabled)}
              style={{
                width: 56,
                height: 32,
                borderRadius: 16,
                backgroundColor: defaultMessageEnabled ? "#25D366" : colors.secondaryBg,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "white",
                  marginLeft: defaultMessageEnabled ? 12 : 0,
                  position: "absolute",
                }}
              />
            </Pressable>
          </View>

          {/* Preview */}
          <View style={{ marginTop: 8, gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
              Exemplos de mensagem:
            </Text>
            <View style={{ gap: 6 }}>
              <View
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.text }}>
                  {`Global: "Olá! Sou o professor Gustavo da turma [turma] ([unidade])."`}
                </Text>
              </View>
              <View
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.text }}>
                  {`Individual: "Olá, [Responsável/Aluno]! Sou o treinador da turma [turma]. ([data])."`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Status Info */}
        <View
          style={{
            borderRadius: 12,
            padding: 12,
            backgroundColor: defaultMessageEnabled ? "#E8F5E9" : "#FFF3E0",
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: defaultMessageEnabled ? "#2E7D32" : "#E65100",
            }}
          >
            {defaultMessageEnabled ? "✓ Ativado" : "✗ Desativado"}
          </Text>
          <Text style={{ fontSize: 12, color: defaultMessageEnabled ? "#2E7D32" : "#E65100" }}>
            {defaultMessageEnabled
              ? "Mensagens padrão serão enviadas ao abrir WhatsApp"
              : "Nenhuma mensagem será pré-preenchida"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
